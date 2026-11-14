import assert from "node:assert/strict";
import test from "node:test";
import {
    MATCH_MAX_BYTES,
    MATCH_RATE,
    createMatchChannel,
    packetBytes,
} from "../src/match.ts";
import { createPartyLink } from "../src/partyLink.ts";

function channel(rate) {
    const sent = [];
    let time = 1000;
    const c = createMatchChannel({
        post: (packet, to) => sent.push({ packet, to }),
        now: () => time,
        rate,
    });
    return { c, sent, advance: (ms) => (time += ms) };
}

test("a 60 fps game sends about thirty packets a second, never a burst", () => {
    const { c, sent, advance } = channel();
    for (let frame = 0; frame < 120; frame++) {
        c.state({ frame });
        c.pump();
        advance(1000 / 60);
    }
    assert.ok(
        sent.length >= 2 * MATCH_RATE - 2 && sent.length <= 2 * MATCH_RATE + 2,
        `sent ${sent.length}`
    );
    // After a long stall the channel catches up by two slots, not thirty.
    advance(1000);
    c.state({ late: 1 });
    c.event("a");
    c.event("b");
    c.event("c");
    const before = sent.length;
    assert.ok(c.pump() <= 3);
    assert.ok(sent.length - before <= 3);
});

test("state keeps only the newest value; events all go, in order, ahead of state", () => {
    const { c, sent, advance } = channel();
    c.state(1);
    c.state(2);
    c.event("hit");
    c.event("point", "member-b");
    for (let i = 0; i < 5; i++) {
        c.pump();
        advance(40);
    }
    assert.deepEqual(
        sent.map((s) => s.packet.slice(1)),
        [
            [1, "hit"],
            [1, "point"],
            [0, 2],
        ]
    );
    assert.equal(sent[1].to, "member-b");
    assert.deepEqual(
        sent.map((s) => s.packet[0]),
        [1, 2, 3]
    );
});

test("a packet over the size limit is never sent", () => {
    const { c, sent } = channel();
    c.state("x".repeat(MATCH_MAX_BYTES));
    c.pump();
    assert.equal(sent.length, 0);
    assert.equal(c.stats.dropped, 1);
    assert.ok(packetBytes([1, 0, "x".repeat(100)]) < MATCH_MAX_BYTES);
    const loop = {};
    loop.self = loop;
    assert.equal(packetBytes(loop), Infinity);
});

test("receiving drops malformed packets and state older than the last one from that sender", () => {
    const { c } = channel();
    assert.equal(c.receive("a", [5, 0, { x: 1 }]).kind, "state");
    assert.equal(c.receive("a", [4, 0, { x: 0 }]), null);
    assert.equal(c.receive("a", [3, 1, "hit"]).kind, "event");
    assert.equal(c.receive("b", [1, 0, {}]).seq, 1);
    for (const bad of [null, "x", [1], [1.5, 0, 0], [1, 2, 0]])
        assert.equal(c.receive("a", bad), null);
    assert.equal(c.receive("", [9, 0, 0]), null);
    assert.equal(c.stats.stale, 1);
    // A sender that reconnected starts from 1 again.
    c.forget("a");
    assert.equal(c.receive("a", [1, 0, {}]).seq, 1);
});

test("the party link turns page messages into party, roster and match events", (t) => {
    const posted = [];
    const page = { postMessage: (message) => posted.push(message) };
    const scope = Object.assign(new EventTarget(), {
        parent: page,
        location: { search: "?check" },
    });
    const link = createPartyLink("ace", scope);
    t.after(() => link.dispose());
    const say = (source, data) =>
        scope.dispatchEvent(
            Object.assign(new Event("message"), { source, data })
        );
    const seen = [];
    link.on("party", (party) => seen.push(["party", party?.size]));
    link.on("arrived", (e) => seen.push(["arrived", e.member.id, e.late]));
    link.on("dropped", (e) => seen.push(["dropped", e.member.id]));
    link.on("host", (e) => seen.push(["host", e.member?.id, e.self]));
    link.on("match", (packet) =>
        seen.push(["match", packet.from, packet.kind, packet.data])
    );
    link.on("choose", (option) => seen.push(["choose", option]));
    const m = (id, order, state = "here") => ({
        id,
        session: id,
        name: id,
        seat: "player",
        state,
        order,
    });

    say(
        {},
        {
            type: "ace:party",
            party: { id: "p", members: [{ id: "x", name: "X" }] },
        }
    );
    assert.equal(link.party, null, "only the page is heard");
    say(page, {
        type: "garden:party",
        party: { id: "p", members: [{ id: "x", name: "X" }] },
    });
    assert.equal(link.party, null, "only this game's messages are heard");
    say(page, {
        type: "ace:party",
        party: { id: "p", members: [{ id: "x", name: "X" }] },
    });
    say(page, {
        type: "ace:roster",
        roster: { self: "b", host: "a", members: [m("a", 1), m("b", 2)] },
    });
    say(page, {
        type: "ace:roster",
        roster: {
            self: "b",
            host: "b",
            members: [m("a", 1, "away"), m("b", 2), m("c", 3)],
        },
    });
    say(page, { type: "ace:match", from: "a", data: [1, 0, { x: 1 }] });
    say(page, { type: "ace:match", from: "a", data: [1, 0, { x: 2 }] });
    assert.deepEqual(seen, [
        ["party", 2],
        ["arrived", "a", false],
        ["arrived", "b", false],
        ["host", "a", false],
        ["dropped", "a"],
        ["arrived", "c", true],
        ["host", "b", true],
        ["match", "a", "state", { x: 1 }],
    ]);

    link.channel.event({ t: "hi" }, "a");
    link.channel.pump();
    assert.deepEqual(posted.at(-1), {
        type: "ace:match",
        data: [1, 1, { t: "hi" }],
        to: "a",
    });
    say(page, { type: "ace:match-limit", dropped: 3 });
    assert.equal(link.channel.stats.limited, 3);

    link.report(() => ({
        options: [{ id: "solo", solo: true }],
        phase: "menu",
        match: null,
    }));
    say(page, { type: "ace:party-probe", id: 7, op: "choose", option: "solo" });
    assert.deepEqual(seen.at(-1), ["choose", "solo"]);
    assert.deepEqual(posted.at(-1), {
        type: "ace:party-report",
        id: 7,
        report: {
            options: [{ id: "solo", solo: true }],
            phase: "menu",
            match: null,
        },
    });
});

test("outside a check, a probe can read the report but not drive the game", (t) => {
    const page = { postMessage() {} };
    const scope = Object.assign(new EventTarget(), {
        parent: page,
        location: { search: "" },
    });
    const link = createPartyLink("ace", scope);
    t.after(() => link.dispose());
    let chosen = 0;
    link.on("choose", () => chosen++);
    scope.dispatchEvent(
        Object.assign(new Event("message"), {
            source: page,
            data: { type: "ace:party-probe", op: "choose", option: "singles" },
        })
    );
    assert.equal(chosen, 0);
});
