import { test } from "node:test";
import assert from "node:assert/strict";
import { createMatch, stepMatch, playerRider, swapPlayer, HOOP_X, HOOPS, TEAMS } from "../src/game/sim.js";

const run = (m, seconds, input = null) => {
    for (let t = 0; t < seconds; t += 1 / 30) stepMatch(m, 1 / 30, input);
};

test("a match starts with seven riders a side and the throw-up after kick-off", () => {
    const m = createMatch({ seed: 3 });
    assert.equal(m.riders.length, 14);
    assert.equal(m.riders.filter((r) => r.team === 0).length, 7);
    assert.equal(m.phase, "kickoff");
    run(m, 3.5);
    assert.equal(m.phase, "play");
});

test("bots play a whole match to a result", () => {
    const m = createMatch({ seed: 11, playerTeam: null, duration: 240 });
    run(m, 300);
    assert.equal(m.phase, "end");
    assert.ok(m.stats.shots[0] + m.stats.shots[1] > 0, "someone shoots");
    assert.equal(m.score[0] % 10, 0);
});

test("a Comet through a hoop scores for the attacking team", () => {
    const m = createMatch({ seed: 5 });
    m.phase = "play";
    const h = HOOPS[1];
    // Team 0 attacks +HOOP_X.
    m.comet.holder = -1;
    m.comet.lastTouch = 0;
    m.comet.pos = { x: HOOP_X - 2, y: h.y, z: h.z };
    m.comet.vel = { x: 30, y: 0, z: 0 };
    // Keep the keeper away.
    const keeper = m.riders.find((r) => r.team === 1 && r.role === "keeper");
    keeper.pos = { x: 0, y: 40, z: 30 };
    stepMatch(m, 0.2);
    assert.deepEqual(m.score, [10, 0]);
    assert.equal(m.phase, "goal");
    assert.equal(TEAMS[0].sign, 1);
});

test("the player can grab the Comet, charge and throw it", () => {
    const m = createMatch({ seed: 9 });
    m.phase = "play";
    const me = playerRider(m);
    me.pos = { x: 10, y: 15, z: 0 };
    m.comet.holder = -1;
    m.comet.pos = { x: 10.5, y: 15.3, z: 0 };
    m.comet.vel = { x: 0, y: 0, z: 0 };
    const hold = { aim: { x: 1, y: 0, z: 0 }, throttle: 0, strafe: 0, lift: 0, boost: false, shoot: false };
    stepMatch(m, 1 / 60, hold);
    stepMatch(m, 1 / 60, hold);
    assert.equal(m.comet.holder, me.id);
    for (let i = 0; i < 30; i++) stepMatch(m, 1 / 60, { ...hold, shoot: true });
    assert.ok(me.charge > 0.5);
    stepMatch(m, 1 / 60, hold);
    assert.equal(m.comet.holder, -1);
    assert.ok(m.comet.vel.x > 30, "thrown hard along the aim");
});

test("swapping hands the visitor their team's Finder", () => {
    const m = createMatch({ seed: 2 });
    const before = playerRider(m);
    const finder = swapPlayer(m, "finder");
    assert.equal(finder.role, "finder");
    assert.equal(playerRider(m), finder);
    assert.equal(before.bot, true);
    assert.equal(finder.bot, false);
});
