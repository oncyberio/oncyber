import assert from "node:assert/strict";
import { test } from "node:test";
import {
    LIFE,
    POSTS,
    autopilot,
    catchLantern,
    createRound,
    joinRound,
    keepInYard,
    leaveRound,
    litFor,
    playing,
    readSnapshot,
    roundResult,
    snapshot,
    standings,
    stepRound,
    touching,
} from "../src/round.js";

const play = (round, seconds, step = 0.1) => {
    const events = [];
    for (let t = 0; t < seconds - 1e-9; t += step)
        events.push(...stepRound(round, step));
    return events;
};

test("a round lights lanterns, lets them fade for the night, and ends", () => {
    const round = createRound({
        id: "round-1",
        seed: 7,
        duration: 30,
        players: ["a"],
    });
    play(round, 1);
    assert.equal(Object.keys(round.lit).length, litFor(1));
    const events = play(round, 29.5);
    assert.ok(round.over);
    assert.ok(round.missed >= 2 * Math.floor(25 / (LIFE + 1)));
    assert.equal(events.filter((e) => e.type === "over").length, 1);
    assert.deepEqual(round.lit, {});
    // Nothing moves once it is over.
    assert.deepEqual(stepRound(round, 1), []);
});

test("the same seed draws the same lanterns", () => {
    const a = createRound({ id: "round-1", seed: 42, players: ["a"] });
    const b = createRound({ id: "round-1", seed: 42, players: ["a"] });
    play(a, 40);
    play(b, 40);
    assert.deepEqual(a, b);
});

test("walking up to a lit lantern catches it, once", () => {
    const round = createRound({ id: "round-1", seed: 3, players: ["a", "b"] });
    play(round, 1);
    const [post, since] = Object.entries(round.lit)[0];
    assert.deepEqual(touching(round, [100, 100]), []);
    assert.ok(touching(round, POSTS[post]).includes(Number(post)));
    assert.ok(catchLantern(round, "a", Number(post), since));
    assert.equal(round.scores.a, 1);
    // The second to arrive, a stranger and a stale claim get nothing.
    assert.equal(catchLantern(round, "b", Number(post), since), false);
    assert.equal(catchLantern(round, "zed", Number(post), since), false);
    play(round, 2);
    const next = Object.entries(round.lit)[0];
    assert.equal(catchLantern(round, "b", Number(next[0]), next[1] + 5), false);
    assert.equal(round.scores.b, 0);
});

test("joining starts from zero and leaving keeps the score", () => {
    const round = createRound({ id: "round-1", seed: 3, players: ["a"] });
    play(round, 1);
    assert.ok(joinRound(round, "b"));
    assert.equal(round.scores.b, 0);
    const [post, since] = Object.entries(round.lit)[0];
    catchLantern(round, "b", Number(post), since);
    leaveRound(round, "b");
    assert.deepEqual(playing(round), ["a"]);
    assert.equal(round.scores.b, 1);
    assert.ok(standings(round).find((s) => s.id === "b").gone);
    assert.ok(joinRound(round, "b"));
    assert.deepEqual(playing(round), ["a", "b"]);
    assert.equal(round.scores.b, 1);
});

test("a snapshot carries the round, and another member can run it on", () => {
    const round = createRound({
        id: "round-1",
        seed: 9,
        duration: 20,
        players: ["a", "b"],
    });
    play(round, 5);
    leaveRound(round, "b");
    const wire = JSON.parse(JSON.stringify(snapshot(round)));
    assert.ok(JSON.stringify(wire).length < 600);
    const copy = readSnapshot(wire);
    assert.equal(copy.id, "round-1");
    assert.deepEqual(copy.scores, round.scores);
    assert.deepEqual(copy.gone, ["b"]);
    assert.deepEqual(Object.keys(copy.lit), Object.keys(round.lit));
    play(round, 15);
    play(copy, 15);
    assert.ok(copy.over);
    assert.equal(copy.missed, round.missed);
});

test("a snapshot from the network is not trusted", () => {
    assert.equal(readSnapshot(null), null);
    assert.equal(readSnapshot(["x"]), null);
    assert.equal(readSnapshot(["bad id!", 1, 0, 90, 0, 0, [], [], 0, 0]), null);
    const round = readSnapshot(
        [
            "round-1",
            1,
            0,
            90,
            99999,
            0,
            [[99, 0], [2, 5], "x"],
            [
                ["a", 1e9, 0],
                ["stranger", 5, 0],
                [7, 1],
            ],
            -4,
            0,
        ],
        (id) => id === "a"
    );
    assert.equal(round.elapsed, 90);
    assert.deepEqual(Object.keys(round.lit), ["2"]);
    assert.deepEqual(round.scores, { a: 10000 });
    assert.equal(round.missed, 0);
});

test("one result for a finished round, from the visitor's side", () => {
    const solo = createRound({
        id: "round-1",
        seed: 1,
        duration: 12,
        players: ["me"],
    });
    const name = (id) => id.toUpperCase();
    assert.equal(roundResult(solo, { format: "solo", self: "me", name }), null);
    play(solo, 12.5);
    const alone = roundResult(solo, { format: "solo", self: "me", name });
    assert.equal(alone.teams.length, 2);
    assert.equal(alone.teams[1].players[0].kind, "cpu");
    assert.equal(alone.teams[1].score, solo.missed);
    assert.equal(alone.winner, 1);

    const duel = createRound({
        id: "round-2",
        seed: 1,
        duration: 5,
        players: ["b", "a"],
    });
    play(duel, 1);
    const [post, since] = Object.entries(duel.lit)[0];
    catchLantern(duel, "b", Number(post), since);
    play(duel, 5);
    const fromA = roundResult(duel, { format: "duel", self: "a", name });
    const fromB = roundResult(duel, { format: "duel", self: "b", name });
    // The same teams in the same order on both pages.
    assert.deepEqual(
        fromA.teams.map((t) => t.players[0].id),
        ["a", "b"]
    );
    assert.deepEqual(
        fromB.teams.map((t) => t.score),
        [0, 1]
    );
    assert.equal(fromA.winner, 1);
    assert.equal(fromA.teams[0].players[0].kind, "self");
    assert.equal(fromB.teams[0].players[0].kind, "peer");
    // Someone who left reports nothing.
    leaveRound(duel, "a");
    assert.equal(roundResult(duel, { format: "duel", self: "a", name }), null);
});

test("the yard keeps a walker inside the walls and out of the well", () => {
    const far = { x: 40, z: -40 };
    keepInYard(far);
    assert.ok(Math.abs(far.x) < 12 && Math.abs(far.z) < 12);
    const well = { x: 0.2, z: 0.1 };
    keepInYard(well);
    assert.ok(Math.hypot(well.x, well.z) >= 1.49);
});

test("the autopilot reaches a lantern", () => {
    const round = createRound({ id: "round-1", seed: 5, players: ["a"] });
    play(round, 1);
    const at = [0, 3];
    for (let i = 0; i < 400 && !touching(round, at).length; i++) {
        const way = autopilot(round, at);
        at[0] += way.strafe * 0.1;
        at[1] += way.forward * 0.1;
    }
    assert.ok(touching(round, at).length > 0);
});
