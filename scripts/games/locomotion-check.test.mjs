import assert from "node:assert/strict";
import test from "node:test";
import {
    judgeWalk,
    lobbyDistance,
    locomotionStage,
} from "./locomotion-check.mjs";

const walk = (seconds, metres, scale = 1, restAt = 1) => ({
    x: 3,
    z: 4 - metres * scale,
    time: restAt + seconds,
    scale,
    floor: true,
    rest: { x: 3, z: 4, time: restAt },
});

test("the lobby covers about 5.6 m in two seconds of forward", () => {
    assert.ok(Math.abs(lobbyDistance(2) - 5.6) < 0.05);
    assert.ok(lobbyDistance(2, true) > lobbyDistance(2));
});

test("a walk at the lobby's pace passes, in the game's own scale and at any frame rate", () => {
    assert.equal(judgeWalk(walk(2, lobbyDistance(2)), 1, 2.1).status, "passed");
    assert.equal(
        judgeWalk(walk(2, lobbyDistance(2), 2), 1, 2.1).status,
        "passed"
    );
    assert.equal(
        judgeWalk(walk(2, lobbyDistance(2) * 1.04), 1, 2).status,
        "passed"
    );
    // The key registered a few steps after it went down; the walk is timed from rest.
    const late = judgeWalk(walk(2.05, lobbyDistance(2.05), 1, 1.15), 1, 19);
    assert.equal(late.status, "passed");
    assert.deepEqual([late.seconds, late.wallSeconds], [2.05, 19]);
});

test("a faster, slower or stalled walk fails with the numbers", () => {
    const fast = judgeWalk(walk(2, 8.8), 1, 2);
    assert.equal(fast.status, "failed");
    assert.match(fast.error, /walked 8\.8 m in 2 s; the lobby covers 5\.604 m/);
    assert.equal(judgeWalk(walk(2, 4), 1, 2).status, "failed");
    assert.match(
        judgeWalk(walk(0.5, 1), 1, 60).error,
        /did not walk from rest for 2 s/
    );
    // Already moving when the key went down: not a walk from rest.
    assert.equal(
        judgeWalk(walk(2.5, lobbyDistance(2.5), 1, 0.5), 1, 2).status,
        "failed"
    );
});

test("games that do not claim the lobby's walk are skipped", async () => {
    assert.equal(await locomotionStage(null, {}), null);
    assert.equal(await locomotionStage(null, { locomotion: "own" }), null);
});
