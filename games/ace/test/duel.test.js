import test from "node:test";
import assert from "node:assert/strict";
import {
    createMatchChannel,
    MATCH_MAX_BYTES,
    packetBytes,
} from "../../runtime/src/match.ts";
import {
    matchAuthority,
    readRoster,
    rosterEvents,
} from "../../runtime/src/roster.ts";
import {
    createEngine,
    startMatch,
    update,
    EMPTY_INPUT,
} from "../src/engine.js";
import { createDuel } from "../src/duel.js";
import { createMatchResults, versusMatchReport } from "../src/result.js";
import { createResults } from "../../runtime/src/results.ts";
import { partyFormats } from "../../runtime/src/party.ts";
import {
    applySnapshot,
    applyStats,
    mirrorEvent,
    readEvent,
    seatRival,
    snapshot,
    standIn,
} from "../src/versus.js";

// A party room in memory: members, a host, and the match channel between
// them, with every packet checked against the channel's size limit.
function room() {
    let time = 0;
    const seats = [];
    const stats = { packets: 0, largest: 0 };
    const view = () => ({
        host: seats.find((s) => s.host)?.id ?? "",
        members: seats.map((s, i) => ({
            id: s.id,
            session: s.id,
            name: s.name,
            seat: "player",
            state: s.state,
            order: i + 1,
        })),
    });
    function announce() {
        if (!seats.some((s) => s.host && s.state === "here")) {
            for (const s of seats) s.host = false;
            const next = seats.find((s) => s.state === "here");
            if (next) next.host = true;
        }
        for (const s of seats)
            if (s.state === "here")
                s.setRoster({ ...view(), self: s.id, online: true });
    }
    function join(id, name = id.toUpperCase()) {
        const listeners = {};
        const fire = (type, ...args) =>
            (listeners[type] ?? []).forEach((f) => f(...args));
        const seat = {
            id,
            name,
            state: "here",
            host: false,
            notes: [],
            starts: [],
            over: 0,
            // What this member's page would hear (docs/games/results.md).
            results: [],
        };
        // The host's `results` service and the game's use of it (game.js).
        const reporter = createResults((result) => seat.results.push(result));
        seat.reporter = createMatchResults(async (operation, value) => {
            if (operation === "begin")
                return reporter.begin(value.match || undefined);
            if (operation === "report") return reporter.report(value).match;
            reporter.abandon();
            return true;
        });
        const link = {
            roster: readRoster(null),
            on: (type, f) => (listeners[type] ??= []).push(f),
            channel: createMatchChannel({
                now: () => time,
                post(packet, to) {
                    if (seat.state !== "here") return; // offline: lost
                    stats.packets++;
                    stats.largest = Math.max(
                        stats.largest,
                        packetBytes(packet)
                    );
                    assert.ok(packetBytes(packet) <= MATCH_MAX_BYTES);
                    const copy = JSON.parse(JSON.stringify(packet));
                    for (const other of seats)
                        if (
                            other !== seat &&
                            other.state === "here" &&
                            (!to || to === other.id)
                        )
                            other.deliver(id, copy);
                },
            }),
        };
        seat.deliver = (from, packet) => {
            const got = link.channel.receive(from, packet);
            if (got) fire("match", got);
        };
        seat.setRoster = (raw) => {
            const next = readRoster(raw);
            const events = rosterEvents(
                link.roster.self ? link.roster : null,
                next
            );
            link.roster = next;
            fire("roster", next, events);
        };
        seat.duel = createDuel({
            link,
            pick: matchAuthority,
            now: () => time,
            hooks: {
                start: (info) => {
                    seat.starts.push(info);
                    seat.reporter.versus(info, seat.duel.match);
                },
                note: (text) => seat.notes.push(text),
                over: () => seat.over++,
            },
        });
        seats.push(seat);
        announce();
        return seat;
    }
    return {
        stats,
        join,
        /** The connection drops: the seat is held, the member plays on alone. */
        drop(seat) {
            seat.state = "away";
            seat.setRoster({ ...view(), self: seat.id, online: false });
            announce();
        },
        reconnect(seat) {
            seat.state = "here";
            announce();
        },
        /** The page reloads: same member, same seat, a game that remembers nothing. */
        reload(seat) {
            const at = seats.indexOf(seat);
            seats.splice(at, 1);
            const fresh = join(seat.id, seat.name);
            seats.splice(at, 0, seats.pop());
            announce();
            return fresh;
        },
        /** Run `seconds` of 60 fps frames; each member presses buttons like a simple bot. */
        run(seconds, who = seats) {
            let events = 0;
            for (let f = 0; f < seconds * 60; f++) {
                time += 1000 / 60;
                for (const seat of who) {
                    events += seat.duel.frame(
                        seat.duel.state === "playing" ? bot(seat) : EMPTY_INPUT,
                        1 / 60
                    ).length;
                    const { duel } = seat;
                    if (duel.state === "playing")
                        seat.reporter.settle(duel.engine.match, () =>
                            versusMatchReport({
                                format: partyFormats(2)[0].id,
                                match: duel.engine.match,
                                players: duel.players,
                                selfId: duel.players.find(
                                    (id) => id !== duel.foe
                                ),
                                nameOf: (id) =>
                                    seats.find((s) => s.id === id)?.name,
                            })
                        );
                }
            }
            return events;
        },
    };
}

// A stand-in for a player: serves, runs to the ball, swings. Two of these
// would rally forever, so it lets every sixth ball go.
function bot(seat) {
    const e = seat.duel.engine;
    const me = e.athletes[0];
    let press = null;
    let move = { x: 0, z: 0 };
    if (e.phase === "serve" && e.match.server === 0 && e.phaseTime > 0.5)
        press = "flat";
    if (
        e.phase === "toss" &&
        e.match.server === 0 &&
        e.ball.v.y < 0.3 &&
        e.ball.v.y > -0.4
    )
        press = "flat";
    if (
        e.phase === "rally" &&
        e.rally.lastHitter === 1 &&
        e.ball.v.z > 0 &&
        e.hitCount % 6 !== 5
    ) {
        if (
            seat.pressed !== e.hitCount &&
            (me.z - e.ball.p.z) / Math.max(1, e.ball.v.z) < 0.85
        ) {
            press = "topspin";
            seat.pressed = e.hitCount;
        }
        if (e.plan) {
            const dx = e.plan.standX - me.x;
            const dz = e.plan.standZ - me.z;
            const d = Math.hypot(dx, dz);
            if (d > 0.3) move = { x: dx / d, z: dz / d };
        }
    }
    return { move, aim: { x: 0.4, y: 0.2 }, press, release: false };
}

function started() {
    const party = room();
    const a = party.join("a");
    const b = party.join("b");
    a.duel.want(2);
    party.run(0.5);
    assert.equal(a.duel.state, "waiting", "one pick is not a match");
    b.duel.want(2);
    party.run(1.5);
    return { party, a, b };
}

test("a snapshot fits a packet and rebuilds the court, turned around for the guest", () => {
    const engine = createEngine({ seed: 7 });
    startMatch(engine);
    seatRival(engine);
    for (let i = 0; i < 400; i++) update(engine, EMPTY_INPUT, 1 / 60);
    engine.athletes[0].x = 2.5;
    engine.match.points = [2, 1];
    const snap = JSON.parse(JSON.stringify(snapshot(engine)));
    assert.ok(
        packetBytes([1, 0, { t: "s", n: 1, s: snap }]) < MATCH_MAX_BYTES * 0.7
    );
    const guest = createEngine({ seed: 1 });
    applySnapshot(guest, snap, true);
    assert.equal(
        guest.athletes[1].x,
        -2.5,
        "the authority's player is across the net"
    );
    assert.ok(guest.athletes[0].z > 0, "the guest stands on the near half");
    assert.deepEqual(guest.match.points, [1, 2]);
    assert.equal(guest.match.server, 1 - engine.match.server);
    assert.equal(guest.ball.p.z, -snap[3][2]);
    const watcher = createEngine({ seed: 1 });
    applySnapshot(watcher, snap, false);
    assert.equal(watcher.athletes[0].x, 2.5);
    assert.deepEqual(watcher.match.points, [2, 1]);
    assert.deepEqual(
        mirrorEvent({ type: "point", winner: 0, games: [1, 0], x: 2, z: -3 }),
        { type: "point", winner: 1, games: [0, 1], x: -2, z: 3 }
    );
});

test("a person steers the far athlete; standing the CPU in takes it back", () => {
    const engine = createEngine({ seed: 3 });
    startMatch(engine);
    seatRival(engine);
    engine.match.server = 1;
    for (let i = 0; i < 300; i++) update(engine, EMPTY_INPUT, 1 / 60);
    assert.equal(engine.phase, "serve", "nobody tosses for a person");
    engine.rival.input.press = "flat";
    update(engine, EMPTY_INPUT, 1 / 60);
    assert.equal(engine.phase, "toss");
    assert.equal(engine.rival.input.press, null, "an edge applies once");
    standIn(engine);
    for (let i = 0; i < 300 && engine.hitCount === 0; i++)
        update(engine, EMPTY_INPUT, 1 / 60);
    assert.ok(engine.hitCount > 0, "the CPU serves in their place");
});

test("two members who both pick 1 v 1 play each other: the host runs the match", () => {
    const { party, a, b } = started();
    assert.equal(a.duel.role, "authority");
    assert.equal(b.duel.role, "guest");
    assert.deepEqual(
        a.starts.map((s) => s.role),
        ["authority"]
    );
    assert.deepEqual(
        b.starts.map((s) => s.role),
        ["guest"]
    );
    const events = party.run(40);
    assert.ok(events > 20, "both screens get the rally's events");
    const host = a.duel.engine;
    const guest = b.duel.engine;
    assert.ok(host.hitCount > 4, `rallies were played (${host.hitCount} hits)`);
    assert.ok(
        host.match.points[0] +
            host.match.points[1] +
            host.match.games[0] +
            host.match.games[1] >
            0,
        "points were scored"
    );
    // The guest's screen is the host's, turned around, a frame or two behind.
    assert.deepEqual(guest.match.games, [...host.match.games].reverse());
    assert.equal(guest.match.server, 1 - host.match.server);
    assert.ok(Math.abs(guest.athletes[0].x + host.athletes[1].x) < 1.5);
    assert.ok(Math.abs(guest.time - host.time) < 0.25);
    assert.ok(party.stats.largest <= MATCH_MAX_BYTES);
    // About thirty state packets a second each way, plus events.
    const perSecond = party.stats.packets / 2 / 42;
    assert.ok(
        perSecond > 25 && perSecond < 34,
        `${perSecond.toFixed(1)} packets a second per member`
    );
});

test("the guest's input reaches the host's engine: their serve goes in play", () => {
    const { party, a, b } = started();
    // Play until the guest has served at least once.
    let served = false;
    for (let i = 0; i < 240 && !served; i++) {
        party.run(0.5);
        served =
            a.duel.engine.match.stats[1].aces +
                a.duel.engine.match.games[0] +
                a.duel.engine.match.games[1] >
                0 || a.duel.engine.match.server === 1;
    }
    const before = a.duel.engine.hitCount;
    party.run(15);
    assert.ok(
        a.duel.engine.hitCount > before,
        "rallies continue with the guest serving"
    );
    assert.equal(b.duel.role, "guest");
});

test("the guest drops mid-match: the CPU stands in, and they get their side back on return", () => {
    const { party, a, b } = started();
    party.run(8);
    const score = () =>
        JSON.stringify([a.duel.engine.match.games, a.duel.engine.match.points]);
    party.drop(b);
    assert.equal(a.duel.standIn, true);
    assert.equal(a.duel.engine.rival, null);
    assert.match(a.notes.at(-1), /B dropped/);
    assert.equal(b.duel.role, "authority", "the dropped player plays on alone");
    const hits = a.duel.engine.hitCount;
    const clock = a.duel.engine.time;
    party.run(12);
    assert.ok(a.duel.engine.time > clock + 11, "the match went on");
    assert.ok(a.duel.engine.hitCount > hits, "the CPU played their side");

    const kept = score();
    party.reconnect(b);
    party.run(2.5);
    assert.equal(a.duel.standIn, false);
    assert.ok(a.duel.engine.rival, "their person steers again");
    assert.equal(b.duel.role, "guest");
    assert.equal(b.starts.at(-1).resume, true);
    assert.match(a.notes.at(-1), /B is back/);
    assert.deepEqual(
        b.duel.engine.match.games,
        [...a.duel.engine.match.games].reverse(),
        "with the authority's score"
    );
    assert.ok(kept.length > 0);
});

test("the host drops mid-match: the role moves, the guest takes the match over with the score", () => {
    const { party, a, b } = started();
    party.run(25);
    const games = [...b.duel.engine.match.games];
    party.drop(a);
    assert.equal(b.duel.role, "authority");
    assert.equal(b.duel.standIn, true);
    assert.deepEqual(b.duel.engine.match.games, games);
    assert.equal(
        b.duel.engine.phase,
        "setup",
        "the point is replayed from the serve"
    );
    const clock = b.duel.engine.time;
    party.run(10);
    assert.ok(
        b.duel.engine.time > clock + 9 && b.duel.engine.hitCount > 0,
        "the match went on against the CPU"
    );

    // The old host returns as the guest of the member who stayed.
    party.reconnect(a);
    party.run(2.5);
    assert.equal(a.duel.role, "guest");
    assert.equal(b.duel.role, "authority");
    assert.equal(b.duel.standIn, false);
    party.run(5);
    assert.deepEqual(
        a.duel.engine.match.games,
        [...b.duel.engine.match.games].reverse()
    );
});

test("hiding the tab hands the match to the other player until it is shown again", () => {
    const { party, a, b } = started();
    party.run(5);
    a.duel.hidden(true);
    party.run(1, [b]); // a hidden tab draws no frames
    assert.equal(b.duel.role, "authority");
    assert.match(b.notes.at(-1), /stepped away/);
    party.run(5, [b]);
    a.duel.hidden(false);
    party.run(2.5);
    assert.equal(a.duel.role, "guest");
    assert.equal(b.duel.standIn, false);
});

test("an authority that stalls without leaving is replaced after three seconds", () => {
    const { party, a, b } = started();
    party.run(5);
    party.run(4, [b]);
    assert.equal(b.duel.role, "authority");
    assert.match(b.notes.at(-1), /Lost touch/);
    // It wakes up still sending its own match; the adopter keeps the engine.
    party.run(2.5);
    assert.equal(a.duel.role, "guest");
    assert.equal(b.duel.role, "authority");
    assert.equal(b.duel.standIn, false);
});

test("leaving on purpose is final: the CPU finishes, and a rematch needs both again", () => {
    const { party, a, b } = started();
    party.run(5);
    b.duel.leave();
    party.run(1);
    assert.equal(a.duel.standIn, true);
    assert.match(a.notes.at(-1), /B left/);
    assert.equal(b.duel.state, "idle");
    b.duel.want(2);
    party.run(2);
    assert.equal(
        a.duel.role,
        "authority",
        "a still-playing member is not pulled out of their match"
    );
    assert.match(a.notes.at(-1), /wants to play/);
    a.duel.leave();
    a.duel.want(2);
    party.run(2.5);
    assert.deepEqual([a.duel.state, b.duel.state], ["playing", "playing"]);
    assert.equal(
        a.duel.engine.rival !== null || b.duel.engine.rival !== null,
        true
    );
});

test("a third member who arrives late can watch the match being played", () => {
    const { party, a, b } = started();
    party.run(3);
    const c = party.join("c");
    party.run(2);
    assert.deepEqual(c.duel.live?.players, ["a", "b"]);
    assert.equal(c.duel.watch(), true);
    party.run(5);
    assert.equal(c.duel.role, "watch");
    assert.equal(c.duel.describe().role, "spectator");
    assert.ok(
        Math.abs(c.duel.engine.time - a.duel.engine.time) < 0.25,
        "the spectator sees the authority's court"
    );
    assert.deepEqual(c.duel.engine.match.games, a.duel.engine.match.games);
    assert.equal(b.duel.role, "guest", "the players are unaffected");
    // The players leave: watching ends.
    a.duel.leave();
    b.duel.leave();
    party.run(8);
    assert.equal(c.duel.state, "idle");
    assert.equal(c.over, 1);
});

test("a player who reloads the page is offered their match back", () => {
    const { party, a, b } = started();
    party.run(6);
    party.drop(b);
    party.run(2, [a]);
    assert.equal(a.duel.standIn, true);
    const again = party.reload(b);
    party.run(2);
    assert.equal(again.duel.state, "idle", "a fresh game starts in its menu");
    assert.equal(again.duel.mine?.from, "a", "and hears its match is still on");
    assert.equal(again.duel.rejoin(), true);
    party.run(2.5);
    assert.equal(again.duel.role, "guest");
    assert.equal(a.duel.standIn, false);
    assert.ok(a.duel.engine.rival, "their person steers again");
    assert.deepEqual(
        again.duel.engine.match.games,
        [...a.duel.engine.match.games].reverse()
    );
});

test("both players drop and return at once (the room restarted): one match, not two", () => {
    const { party, a, b } = started();
    party.run(6);
    party.drop(a);
    party.drop(b);
    party.run(5);
    assert.deepEqual(
        [a.duel.role, b.duel.role],
        ["authority", "authority"],
        "each plays on alone"
    );
    party.reconnect(b);
    party.reconnect(a);
    party.run(3);
    assert.deepEqual([a.duel.role, b.duel.role].sort(), ["authority", "guest"]);
    assert.ok(!a.duel.standIn && !b.duel.standIn);
    const [host, guest] = a.duel.role === "authority" ? [a, b] : [b, a];
    party.run(3);
    assert.deepEqual(
        guest.duel.engine.match.games,
        [...host.duel.engine.match.games].reverse()
    );
});

test("packets from another member are checked before they touch the game", () => {
    const engine = createEngine({ seed: 9 });
    startMatch(engine);
    seatRival(engine);
    for (let i = 0; i < 200; i++) update(engine, EMPTY_INPUT, 1 / 60);
    const good = () => JSON.parse(JSON.stringify(snapshot(engine)));
    const view = createEngine({ seed: 1 });
    assert.equal(applySnapshot(view, good(), true), true);
    const before = JSON.stringify(view.match);
    const broken = [
        (s) => (s[0] = null),
        (s) => (s[1] = "<img src=x>"),
        (s) => (s[3][0] = "NaN"),
        (s) => s[3].pop(),
        (s) => (s[4][7] = "nuke"),
        (s) => (s[4][4] = { toString: 1 }),
        (s) => (s[6] = [1, 2]),
        (s) => s.push(1),
        (s) => (s[9][0] = [1, 2]),
    ];
    for (const breakIt of broken) {
        const snap = good();
        breakIt(snap);
        assert.equal(
            applySnapshot(view, snap, true),
            false,
            breakIt.toString()
        );
    }
    assert.equal(applySnapshot(view, "nope", true), false);
    assert.equal(
        JSON.stringify(view.match),
        before,
        "a refused snapshot changes nothing"
    );

    assert.equal(readEvent({ type: "explode" }), null);
    assert.deepEqual(
        readEvent({
            type: "point",
            winner: 1,
            who: 7,
            reason: "winner",
            games: [1, "<b>"],
            label: { text: "<script>" },
            shot: "<img>",
            x: Infinity,
            z: 2,
        }),
        { type: "point", winner: 1, reason: "winner", z: 2 }
    );
    applyStats(view, [["<b>", 1, 2, 3], [0, 0, 0, 0], "x"], false);
    assert.deepEqual(view.match.stats[0], {
        aces: 0,
        winners: 1,
        perfects: 2,
        faults: 3,
    });
    assert.equal(view.match.longestRally, 0);
});

// Every finished match reports exactly one result (docs/games/results.md).
function playOut(party, a, b, who) {
    for (let s = 0; s < 900 && a.duel.engine.match.winner === null; s += 5)
        party.run(5, who);
    assert.notEqual(a.duel.engine.match.winner, null, "the match ended");
    party.run(3, who);
}

test("a 1 v 1 played to the end reports one result from each side, the same match", () => {
    const party = room();
    const a = party.join("a");
    const b = party.join("b");
    a.duel.want(1);
    b.duel.want(1);
    party.run(1.5);
    assert.match(a.duel.match, /^[A-Za-z0-9_-]{6,64}$/);
    assert.equal(b.duel.match, a.duel.match, "both sides hold the match's id");
    playOut(party, a, b);
    assert.equal(a.results.length, 1);
    assert.equal(b.results.length, 1);
    const [mine] = a.results;
    const [theirs] = b.results;
    assert.equal(mine.match, a.duel.match);
    assert.equal(theirs.match, mine.match);
    assert.equal(mine.format, "singles");
    assert.equal(theirs.format, "singles");
    // Both players by their room ids, in the same order on both pages.
    const seen = (r) => r.teams.map((t) => [t.players[0].id, t.score]);
    assert.deepEqual(seen(mine), [
        ["a", a.duel.engine.match.games[0]],
        ["b", a.duel.engine.match.games[1]],
    ]);
    assert.deepEqual(seen(theirs), seen(mine));
    assert.equal(theirs.winner, mine.winner);
    assert.equal(mine.winner, a.duel.engine.match.winner);
    assert.deepEqual(
        [mine, theirs].map((r) => r.teams.map((t) => t.players[0].kind)),
        [
            ["self", "peer"],
            ["peer", "self"],
        ]
    );
    // A rematch is a new match with its own id and its own one result.
    a.duel.want(1);
    b.duel.want(1);
    party.run(1.5);
    assert.notEqual(a.duel.match, mine.match);
    playOut(party, a, b);
    assert.equal(a.results.length, 2);
    assert.equal(b.results.length, 2);
    assert.equal(a.results[1].match, b.results[1].match);
});

test("a match that changes hands still reports once, under the same id", () => {
    const party = room();
    const a = party.join("a");
    const b = party.join("b");
    a.duel.want(1);
    b.duel.want(1);
    party.run(8);
    const id = a.duel.match;
    // The host drops; the guest takes the match over, then the host returns.
    party.drop(a);
    party.run(4, [b]);
    assert.equal(b.duel.role, "authority");
    party.reconnect(a);
    party.run(2.5);
    assert.equal(a.duel.role, "guest");
    assert.equal(a.duel.match, id);
    assert.equal(b.duel.match, id);
    playOut(party, a, b);
    assert.deepEqual(
        [a.results, b.results].map((r) => r.map((x) => x.match)),
        [[id], [id]]
    );
    assert.equal(a.results[0].winner, b.results[0].winner);
});

test("a player who reloads rejoins under the match's id; walking away reports nothing", () => {
    const party = room();
    const a = party.join("a");
    const b = party.join("b");
    a.duel.want(1);
    b.duel.want(1);
    party.run(6);
    const id = a.duel.match;
    party.drop(b);
    party.run(2, [a]);
    const again = party.reload(b);
    party.run(2);
    assert.equal(again.duel.rejoin(), true);
    assert.equal(again.duel.match, id);
    party.run(2.5);
    // They walk away for good: nothing from them; the one who stayed
    // finishes against the CPU and reports the match once.
    again.duel.leave();
    again.reporter.abandon();
    playOut(party, a, again, [a]);
    assert.deepEqual(again.results, []);
    assert.deepEqual(
        a.results.map((r) => r.match),
        [id]
    );
    assert.deepEqual(
        a.results[0].teams.map((t) => t.players[0].id),
        ["a", "b"]
    );
});
