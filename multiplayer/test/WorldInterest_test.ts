import assert from "assert";
import { InterestIndex, AOI_LIMIT, CANDIDATE_LIMIT } from "../src/world/interest";
import { blankPose, ActorPose } from "../src/world/shared";

const actor = (id: number, x = 0, z = 0, slot = id - 1): ActorPose => ({ ...blankPose(slot), id, x, z });
describe("shared world interest", () => {
    it("keeps a 10,000-person one-cell crowd bounded and preserves explicit nearby pins", () => {
        const actors = new Map<number, ActorPose>();
        for (let id = 1; id <= 10000; id++) actors.set(id, actor(id, (id % 97) / 100, (id % 61) / 100));
        const index = new InterestIndex();
        index.rebuild(actors.values());
        const visible = index.select(actors.get(1)!, [], actors, [9999, 10000]);
        assert.equal(visible.length, AOI_LIMIT);
        assert.equal(new Set(visible).size, AOI_LIMIT);
        assert.ok(!visible.includes(1));
        assert.ok(visible.includes(9999) && visible.includes(10000));
        assert.equal(index.candidateVisits, CANDIDATE_LIMIT);
    });
    it("retains actors in the hysteresis band but rejects new or pinned actors beyond it", () => {
        const actors = new Map([actor(1), actor(2, 50), actor(3, 53), actor(4, 49)].map((p) => [p.id, p] as const));
        const index = new InterestIndex();
        index.rebuild(actors.values());
        assert.deepEqual(index.select(actors.get(1)!, [2], actors, [3]), [2]);
    });
    it("removes departed actors before rebuilding buckets", () => {
        const actors = new Map([actor(1), actor(2), actor(3)].map((p) => [p.id, p] as const));
        const index = new InterestIndex();
        index.rebuild(actors.values());
        actors.delete(2);
        assert.deepEqual(index.select(actors.get(1)!, [2], actors), [3]);
    });
    it("does not confuse a recycled actor slot with its departed occupant", () => {
        const actors = new Map([actor(1), actor(2)].map((p) => [p.id, p] as const));
        const index = new InterestIndex();
        index.rebuild(actors.values());
        actors.delete(2);
        actors.set(50000, actor(50000, 0, 0, 1));
        assert.deepEqual(index.select(actors.get(1)!, [], actors, [50000]), [50000]);
        index.rebuild(actors.values());
        assert.deepEqual(index.select(actors.get(1)!, [], actors), [50000]);
    });
    it("grows stamps for larger configured capacities and safely wraps selection generations", () => {
        const actors = new Map([actor(1), actor(2, 0, 0, 50000)].map((p) => [p.id, p] as const));
        const index = new InterestIndex();
        index.rebuild(actors.values());
        assert.deepEqual(index.select(actors.get(1)!, [], actors), [2]);
        (index as any).generation = 0xffffffff;
        assert.deepEqual(index.select(actors.get(1)!, [], actors), [2]);
        assert.deepEqual(index.select(actors.get(1)!, [], actors), [2]);
    });
    it("selects the true nearest actors when every candidate fits the bounded search", () => {
        let seed = 19;
        const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
        const actors = new Map<number, ActorPose>([[1, actor(1)]]);
        for (let id = 2; id <= 350; id++) actors.set(id, actor(id, random() * 20 - 10, random() * 20 - 10));
        const index = new InterestIndex();
        index.rebuild(actors.values());
        const expected = Array.from(actors.values())
            .filter((p) => p.id !== 1)
            .sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))
            .slice(0, 128)
            .map((p) => p.id);
        assert.deepEqual(index.select(actors.get(1)!, [], actors), expected);
        assert.deepEqual(index.select(actors.get(1)!, [], actors, [], 64), expected.slice(0, 64));
    });
});
