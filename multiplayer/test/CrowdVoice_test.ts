import assert from "assert";
import { CrowdModel } from "../src/rooms/crowd/core";
import { profile, STAGE_LISTENER_LIMIT, VOICE_LIMIT } from "../src/rooms/crowd/protocol";

function fixture(count: number) {
    const model = new CrowdModel();
    const people = Array.from({ length: count }, (_, index) => {
        const id = String(index + 1).padStart(2, "0");
        const person = model.add(id, profile(id, {}), 1000);
        person.x = person.z = 0;
        person.voiceReady = true;
        model.index(person);
        return person;
    });
    const refresh = () => {
        model.updateVisibility();
        model.updateVoice();
        for (const person of people) {
            assert(person.voice.size <= VOICE_LIMIT);
            for (const id of person.voice) {
                const peer = model.people.get(id)!;
                assert(person.visible.has(id) && peer.visible.has(person.id));
                assert(person.voiceReady && peer.voiceReady);
                assert(peer.voice.has(person.id));
                assert(Math.hypot(person.x - peer.x, person.z - peer.z) <= 14);
            }
        }
    };
    return { model, people, refresh };
}

describe("crowd voice retention", () => {
    it("enters at 12m, retains to 14m without range-boundary churn, and requires reentry", () => {
        const { model, people: [a, b], refresh } = fixture(2);
        const move = (x: number) => { b.x = x; model.index(b); refresh(); };
        move(13);
        assert.equal(a.voice.size, 0);
        move(11.9);
        for (const x of [12.1, 11.9, 12.3, 13.9, 12.1]) {
            move(x);
            assert.deepStrictEqual([...a.voice], [b.id]);
            assert.deepStrictEqual([...b.voice], [a.id]);
        }
        move(14.1);
        assert.equal(a.voice.size + b.voice.size, 0);
        move(13);
        assert.equal(a.voice.size + b.voice.size, 0);
        move(11.9);
        assert.equal(a.voice.size, 1);
        b.voiceReady = false;
        refresh();
        assert.equal(a.voice.size + b.voice.size, 0);
        b.voiceReady = true;
        refresh();
        model.remove(b.id);
        model.updateVisibility();
        model.updateVoice();
        assert.equal(a.voice.size, 0);
    });

    it("keeps eight existing peers through small distance changes and releases lost eligibility", () => {
        const { model, people, refresh } = fixture(10);
        refresh();
        const a = people[0];
        const initial = [...a.voice].sort();
        assert.equal(initial.length, 8);
        const newcomer = people.find((p) => p !== a && !a.voice.has(p.id))!;
        for (let tick = 0; tick < 12; tick++) {
            for (const p of people.slice(1)) {
                p.x = p === newcomer ? 0.01 : 0.1 + Math.sin(tick) * 0.05;
                model.index(p);
            }
            refresh();
            assert.deepStrictEqual([...a.voice].sort(), initial);
        }
        const departing = model.people.get(initial[0])!;
        departing.x = 20;
        model.index(departing);
        refresh();
        assert(!a.voice.has(departing.id));
        assert(a.voice.has(newcomer.id), "a vacant voice slot admits a nearby ready peer");
    });
});

describe("crowd stage voice", () => {
    it("streams speakers one-way to their nearest 50 listeners anywhere in the room", () => {
        const { model, people } = fixture(60);
        people.forEach((p, i) => { p.x = i * 20; p.z = 0; model.index(p); });
        const [speaker] = people;
        model.speakers.add(speaker.id);
        model.updateVisibility();
        model.updateVoice();
        assert.equal(speaker.voice.size, STAGE_LISTENER_LIMIT);
        assert.equal(speaker.speakOnly.size, STAGE_LISTENER_LIMIT);
        assert.equal(speaker.listenOnly.size, 0);
        const far = people[STAGE_LISTENER_LIMIT];
        assert(speaker.voice.has(far.id) && far.listenOnly.has(speaker.id) && model.linked(speaker, far));
        const unheard = people[STAGE_LISTENER_LIMIT + 1];
        assert(!speaker.voice.has(unheard.id) && !unheard.voice.has(speaker.id));
    });
    it("keeps nearby speakers two-way and upgrades two speakers to a two-way link", () => {
        const { model, people: [a, b, c] } = fixture(3);
        c.x = 100; model.index(c);
        model.speakers.add(a.id);
        model.updateVisibility();
        model.updateVoice();
        assert(a.voice.has(b.id) && !a.speakOnly.has(b.id) && !b.listenOnly.has(a.id));
        assert(a.speakOnly.has(c.id) && c.listenOnly.has(a.id));
        model.speakers.add(c.id);
        model.updateVoice();
        assert(!a.speakOnly.has(c.id) && !c.listenOnly.has(a.id) && model.linked(a, c));
    });
    it("muted people only listen, and are never heard on stage", () => {
        const { model, people: [a, b] } = fixture(2);
        b.muted = true;
        model.speakers.add(b.id);
        model.updateVisibility();
        model.updateVoice();
        assert(b.listenOnly.has(a.id) && a.speakOnly.has(b.id));
        assert(!b.speakOnly.size);
    });
});
