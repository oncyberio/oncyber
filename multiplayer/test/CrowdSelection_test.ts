import assert from "assert";
import { CrowdModel, Person } from "../src/rooms/crowd/core";
import { AOI_LIMIT, CANDIDATE_LIMIT, VOICE_LIMIT } from "../src/rooms/crowd/protocol";
const { FullSortReference, fixture } = require("../loadtest/crowd-core.cjs");

/** Compare visual selection with the full-sort reference through movement and
 * churn. Voice keeps its bounded mutual contract; its new entry/exit policy is
 * covered separately rather than compared to the old single-radius reference. */
describe("bounded crowd selection equivalence", () => {
    for (const scenario of ["dense", "spread", "coincident"]) {
        it(`preserves nearest order, hysteresis and mutual voice for ${scenario} movement`, () => {
            const count = 512;
            const actual = fixture(CrowdModel, count, scenario);
            const expected = fixture(FullSortReference, count, scenario);
            const compare = () => {
                for (const p of actual.model.people.values() as Iterable<Person>) {
                    const reference = expected.model.people.get(p.id);
                    assert.deepStrictEqual([...p.visible], [...reference.visible], `AOI ${p.id}`);
                    assert(p.visible.size <= AOI_LIMIT);
                    assert(p.voice.size <= VOICE_LIMIT);
                    for (const id of p.voice) assert(actual.model.people.get(id).voice.has(p.id));
                }
            };
            for (let tick = 0; tick < 40; tick++) {
                for (const { model, people } of [actual, expected]) {
                    for (let i = 0; i < people.length; i++) {
                        const p = people[i];
                        if (!model.people.has(p.id)) continue;
                        if (scenario === "coincident") {
                            p.x = tick < 15 ? 0 : (i % 16) * 0.2;
                            p.z = tick < 15 ? 0 : Math.floor(i / 16) * 0.2;
                        } else {
                            p.x += Math.cos(i + tick) * 0.1;
                            p.z += Math.sin(i + tick) * 0.1;
                        }
                        p.voiceReady = tick < 10 || i % 3 !== 0;
                        model.index(p);
                    }
                    if (tick === 20) for (let i = 0; i < 32; i++) model.remove(people[i].id);
                    for (let i = tick % 4; i < people.length; i += 4)
                        if (model.people.has(people[i].id)) {
                            model.selectVisible(people[i]);
                            assert(model.lastCandidateVisits <= CANDIDATE_LIMIT);
                        }
                    if (tick % 5 === 1) model.updateVoice();
                }
                // Departed peers are removed from voice on the scheduled voice refresh.
                if (tick % 5 === 1) compare();
            }
        });
    }
    it("bounds candidate work and voice after a 2048-player single-cell join", () => {
        const { model, people } = fixture(CrowdModel, 2048, "dense");
        for (const p of people) {
            p.x = p.z = 0;
            model.index(p);
        }
        model.updateVisibility();
        model.updateVoice();
        for (const p of people) {
            assert.strictEqual(p.visible.size, AOI_LIMIT);
            assert(!p.visible.has(p.id));
            assert(p.voice.size <= VOICE_LIMIT);
            for (const id of p.voice) assert(model.people.get(id).voice.has(p.id));
        }
        for (const p of people) model.remove(p.id);
        model.updateVoice();
        assert.strictEqual(model.people.size, 0);
    });
});
