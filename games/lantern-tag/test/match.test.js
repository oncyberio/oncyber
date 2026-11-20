// Whole party rounds through an in-memory room: who runs the round, joining
// one in progress, catching, dropping, taking over, and two starting at once.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createMatch } from "../src/match.js";
import { POSTS } from "../src/round.js";

/** A room: every member gets a link shaped like the runtime's party link. */
function room(ids) {
    const members = ids.map((id, order) => ({
        id,
        name: id,
        state: "here",
        order,
    }));
    const clock = { now: 0 };
    const links = new Map();
    const queue = [];
    for (const id of ids) {
        const handlers = {};
        links.set(id, {
            handlers,
            get roster() {
                return {
                    self: id,
                    host: members.find((m) => m.state === "here")?.id ?? "",
                    members,
                };
            },
            channel: {
                pending: null,
                state(data) {
                    this.pending = data;
                },
                event(data, to) {
                    queue.push({ from: id, to, data });
                },
                pump() {
                    if (this.pending)
                        queue.push({ from: id, data: this.pending });
                    this.pending = null;
                },
                flush() {},
            },
            on(type, handler) {
                (handlers[type] ??= []).push(handler);
                return () => {};
            },
        });
    }
    const fire = (id, type, ...args) =>
        (links.get(id).handlers[type] ?? []).forEach((h) => h(...args));
    return {
        clock,
        link: (id) => links.get(id),
        /** Deliver everything sent so far, as JSON, to members still here. */
        deliver() {
            for (const packet of queue.splice(0)) {
                const data = JSON.parse(JSON.stringify(packet.data));
                assert.ok(
                    JSON.stringify(data).length < 1100,
                    "a packet fits the channel"
                );
                for (const member of members)
                    if (
                        member.id !== packet.from &&
                        member.state === "here" &&
                        (!packet.to || packet.to === member.id)
                    )
                        fire(member.id, "match", {
                            from: packet.from,
                            kind: "state",
                            data,
                        });
            }
        },
        drop(id) {
            const member = members.find((m) => m.id === id);
            member.state = "away";
            for (const other of members)
                if (other.state === "here")
                    fire(other.id, "dropped", { member });
        },
    };
}

const authorityOf = (roster, players) =>
    players.includes(roster.host) &&
    roster.members.find((m) => m.id === roster.host)?.state === "here"
        ? roster.host
        : roster.members.find(
              (m) => m.state === "here" && players.includes(m.id)
          )?.id ?? "";

function party(ids) {
    const r = room(ids);
    const events = Object.fromEntries(ids.map((id) => [id, []]));
    let n = 0;
    const matches = Object.fromEntries(
        ids.map((id) => [
            id,
            createMatch({
                link: r.link(id),
                authorityOf,
                self: () => id,
                now: () => r.clock.now,
                newId: () => `round-${id}-${++n}`,
                onEvent: (event) => events[id].push(event.type),
            }),
        ])
    );
    const at = Object.fromEntries(ids.map((id) => [id, [50, 50]]));
    /** Run `seconds` of frames for the members still in the room. */
    const run = (seconds, alive = ids) => {
        for (let t = 0; t < seconds; t += 0.1) {
            r.clock.now += 100;
            for (const id of alive) matches[id].update(0.1, at[id]);
            r.deliver();
        }
    };
    return { r, matches, events, at, run };
}

test("a member starts the party's round and another joins it in progress", () => {
    const { matches, run, events, at } = party(["a", "b", "c"]);
    matches.a.startParty({ format: "round", seed: 1, duration: 30 });
    run(1);
    assert.equal(matches.a.role, "authority");
    assert.ok(matches.b.joinable(), "b hears the round before joining");
    const id = matches.b.startParty({ format: "round", seed: 2, duration: 30 });
    assert.equal(id, matches.a.round.id);
    run(1);
    assert.equal(matches.b.role, "guest");
    assert.deepEqual(matches.a.report().players, ["a", "b"]);
    assert.deepEqual(matches.b.report().players, ["a", "b"]);
    assert.ok(events.a.includes("joined"));
    // b walks to a lit lantern: the authority awards it, b hears it.
    const post = Number(Object.keys(matches.b.round.lit)[0]);
    at.b = POSTS[post];
    run(0.5);
    assert.equal(matches.a.round.scores.b, 1);
    assert.equal(matches.b.round.scores.b, 1);
    assert.ok(events.b.includes("caught"));
    // c never joined and is not in the round.
    assert.equal(matches.c.round, null);
    // The round ends for both, once each.
    at.b = [50, 50];
    run(30);
    assert.ok(matches.a.round.over && matches.b.round.over);
    assert.equal(events.a.filter((e) => e === "over").length, 1);
    assert.equal(events.b.filter((e) => e === "over").length, 1);
    assert.deepEqual(matches.a.round.scores, matches.b.round.scores);
});

test("when a guest drops the round goes on without them", () => {
    const { r, matches, run } = party(["a", "b"]);
    matches.a.startParty({ format: "duel", seed: 1, duration: 60 });
    run(0.5);
    matches.b.startParty({ format: "duel", seed: 1, duration: 60 });
    run(1);
    r.drop("b");
    const before = matches.a.report().progress;
    run(2, ["a"]);
    assert.deepEqual(matches.a.report().players, ["a"]);
    assert.ok(matches.a.report().progress >= before + 15);
});

test("when the member running the round drops, another takes it over", () => {
    const { r, matches, run, events } = party(["a", "b"]);
    matches.a.startParty({ format: "duel", seed: 1, duration: 60 });
    run(0.5);
    matches.b.startParty({ format: "duel", seed: 1, duration: 60 });
    run(3);
    const before = matches.b.report();
    assert.equal(before.role, "guest");
    r.drop("a");
    run(2, ["b"]);
    const after = matches.b.report();
    assert.equal(after.role, "authority");
    assert.equal(after.authority, "b");
    assert.deepEqual(after.players, ["b"]);
    assert.ok(after.progress >= before.progress + 15);
    assert.ok(events.b.includes("taken-over"));
    assert.ok(Object.keys(matches.b.round.lit).length > 0);
});

test("a silent authority is taken over after three seconds", () => {
    const { matches, run } = party(["a", "b"]);
    matches.a.startParty({ format: "duel", seed: 1, duration: 60 });
    run(0.5);
    matches.b.startParty({ format: "duel", seed: 1, duration: 60 });
    run(1);
    run(3.5, ["b"]);
    assert.equal(matches.b.role, "authority");
});

test("two rounds started at once become one", () => {
    const { matches, run, events } = party(["a", "b"]);
    matches.b.startParty({ format: "duel", seed: 1, duration: 60 });
    matches.a.startParty({ format: "duel", seed: 2, duration: 60 });
    run(1);
    // The roster's pick (the host, a) keeps its round; b follows it.
    assert.equal(matches.a.role, "authority");
    assert.equal(matches.b.role, "guest");
    assert.equal(matches.b.round.id, matches.a.round.id);
    assert.ok(events.b.includes("merged"));
    assert.deepEqual(matches.a.report().players, ["a", "b"]);
});

test("a member who leaves hands the round on and keeps their score on the board", () => {
    const { matches, run } = party(["a", "b"]);
    matches.a.startParty({ format: "duel", seed: 1, duration: 60 });
    run(0.5);
    matches.b.startParty({ format: "duel", seed: 1, duration: 60 });
    run(1);
    matches.a.leave();
    run(1, ["b"]);
    assert.equal(matches.a.round, null);
    assert.equal(matches.b.role, "authority");
    assert.deepEqual(matches.b.report().players, ["b"]);
    assert.ok("a" in matches.b.round.scores);
});

test("a solo round uses no channel", () => {
    const { matches, run, at } = party(["a", "b"]);
    matches.a.startSolo({ seed: 4, duration: 10 });
    run(1);
    assert.equal(matches.b.joinable(), null);
    assert.equal(matches.a.versus, false);
    const post = Number(Object.keys(matches.a.round.lit)[0]);
    at.a = POSTS[post];
    run(0.3);
    assert.equal(matches.a.round.scores.a, 1);
});
