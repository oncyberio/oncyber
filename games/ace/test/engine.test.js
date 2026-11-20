import test from "node:test";
import assert from "node:assert/strict";
import {
    createEngine,
    startMatch,
    update,
    EMPTY_INPUT,
} from "../src/engine.js";
import { createBall, launch, predict } from "../src/physics.js";
import {
    createMatch,
    awardPoint,
    pointLabel,
    createRally,
    rallyHit,
    rallyBounce,
} from "../src/rules.js";

function play(seed, difficulty = "pro", games = 2, maxSeconds = 1800) {
    const engine = createEngine({ seed, difficulty, games, autoHuman: true });
    startMatch(engine);
    const rallies = [];
    const reasons = {};
    let t = 0;
    while (engine.phase !== "over" && t < maxSeconds) {
        for (const e of update(engine, EMPTY_INPUT, 1 / 60)) {
            if (e.type === "verdict") {
                rallies.push(e.rallyHits);
                reasons[e.reason] = (reasons[e.reason] || 0) + 1;
            }
        }
        t += 1 / 60;
    }
    return { engine, rallies, reasons, t };
}

test("shot solver lands where it aims and clears the net", () => {
    const ball = createBall();
    const target = { x: -2, y: 0.034, z: -9 };
    launch(ball, { x: 1, y: 1, z: 10 }, target, "topspin", 0.6);
    const p = predict(ball, 3, 1);
    assert.equal(p.net, null);
    const b = p.bounces[0];
    assert.ok(
        Math.abs(b.x - target.x) < 0.05 && Math.abs(b.z - target.z) < 0.08,
        JSON.stringify(b)
    );
});

test("tennis scoring: deuce, advantage, game", () => {
    const m = createMatch(2);
    for (let i = 0; i < 3; i++) {
        awardPoint(m, 0);
        awardPoint(m, 1);
    }
    assert.equal(pointLabel(m).text, "DEUCE");
    awardPoint(m, 0);
    assert.equal(pointLabel(m).kind, "advantage");
    awardPoint(m, 1);
    assert.equal(pointLabel(m).text, "DEUCE");
    awardPoint(m, 0);
    const r = awardPoint(m, 0);
    assert.equal(r.game, true);
    assert.deepEqual(m.games, [1, 0]);
    assert.equal(m.server, 1);
});

test("referee: out ball loses, serve must hit the box", () => {
    const m = createMatch();
    const rally = createRally(m);
    rallyHit(rally, 0);
    // Long serve lands beyond the service line.
    assert.equal(rallyBounce(rally, rally.boxSign * 2, -8).reason, "fault");
    const r2 = createRally(m);
    rallyHit(r2, 0);
    assert.equal(rallyBounce(r2, r2.boxSign * 2, -4), null);
    assert.equal(rallyBounce(r2, r2.boxSign * 2, -12).reason, "ace");
});

test("bot vs CPU plays full matches with real rallies", () => {
    let total = 0;
    let count = 0;
    const allReasons = {};
    for (const seed of [1, 2, 3, 4]) {
        const { engine, rallies, reasons, t } = play(seed);
        assert.equal(
            engine.phase,
            "over",
            `seed ${seed} did not finish in ${t.toFixed(0)}s`
        );
        total += rallies.reduce((a, b) => a + b, 0);
        count += rallies.length;
        for (const [k, v] of Object.entries(reasons))
            allReasons[k] = (allReasons[k] || 0) + v;
    }
    const avg = total / count;
    console.log("avg rally hits", avg.toFixed(2), allReasons);
    assert.ok(avg > 2.5, `rallies too short: ${avg}`);
});
