import { test } from "node:test";
import assert from "node:assert/strict";
import {
    addXp,
    evolve,
    feed,
    give,
    newEgg,
    rival,
    rng,
    sanitize,
    tick,
    readyToGrow,
    GROW_AT,
    HATCH_AFTER,
    alignmentOf,
    pet,
    toss,
} from "../src/game/sim.js";
import {
    cheerFighter,
    cheerRacer,
    COURSE_LENGTH,
    createBout,
    createRace,
    raceStandings,
    stepBout,
    stepRace,
    gauge,
} from "../src/game/games.js";

const hatched = (r = rng(1)) => {
    const c = newEgg(r);
    c.stage = "child";
    return c;
};

test("eggs hatch on a timer and children grow up", () => {
    const c = newEgg(rng(2));
    for (let t = 0; t < HATCH_AFTER + 1; t++) tick(c, 1);
    assert.ok(c.hatch >= HATCH_AFTER);
    c.stage = "child";
    let t = 0;
    while (!readyToGrow(c) && t < GROW_AT * 2) {
        tick(c, 1);
        t++;
    }
    assert.ok(readyToGrow(c), "child grows within twice the nominal time");
    const evo = evolve(c);
    assert.equal(c.stage, "adult");
    assert.ok(["sunny", "shade", "breeze"].includes(evo.align));
});

test("levels carry over at 100 xp and cap at 99", () => {
    const c = hatched();
    assert.equal(addXp(c, "run", 250), 2);
    assert.equal(c.stats.run.lv, 2);
    assert.equal(Math.round(c.stats.run.xp), 50);
    addXp(c, "run", 1e6);
    assert.equal(c.stats.run.lv, 99);
});

test("care steers alignment", () => {
    const kind = hatched();
    for (let i = 0; i < 6; i++) feed(kind, "sunpeach");
    for (let i = 0; i < 10; i++) pet(kind);
    assert.equal(alignmentOf(kind), "sunny");
    const rascal = hatched();
    for (let i = 0; i < 6; i++) feed(rascal, "moonplum");
    for (let i = 0; i < 4; i++) toss(rascal, true);
    assert.equal(alignmentOf(rascal), "shade");
});

test("critters grow parts and stats", () => {
    const c = hatched();
    const r = give(c, "tweet");
    assert.equal(c.look.parts.wings > 0.3, true);
    assert.deepEqual(r.part, "wings");
    assert.ok(c.stats.fly.xp >= 45 || c.stats.fly.lv > 0);
    assert.ok(c.look.tint !== null);
});

test("sanitize round-trips and rejects junk", () => {
    const c = hatched();
    give(c, "hopper");
    const back = sanitize(JSON.parse(JSON.stringify(c)));
    assert.equal(back.id, c.id);
    assert.equal(back.look.parts.ears, c.look.parts.ears);
    assert.equal(sanitize(null), null);
    assert.equal(sanitize({ id: 3 }), null);
    const weird = sanitize({
        id: "x",
        stats: { run: { lv: 1e9 } },
        happy: "x",
    });
    assert.equal(weird.stats.run.lv, 99);
    assert.equal(weird.happy, 0);
});

test("a race finishes and better runners tend to win", () => {
    let fastWins = 0;
    for (let seed = 1; seed <= 30; seed++) {
        const r = rng(seed);
        const slow = rival(r, 5);
        const fast = rival(r, 45);
        const race = createRace([slow, fast, rival(r, 5), rival(r, 5)], seed);
        let steps = 0;
        while (!race.over && steps++ < 20000) stepRace(race, 1 / 30);
        assert.ok(race.over);
        assert.ok(race.racers.every((x) => x.done && x.place > 0));
        if (raceStandings(race)[0].lane === 1) fastWins++;
    }
    assert.ok(fastWins >= 24, `fast won ${fastWins}/30`);
});

test("cheering helps and has a cooldown", () => {
    const r = rng(9);
    const a = rival(r, 20);
    const race = createRace([a, a], 4);
    assert.equal(cheerRacer(race, 0), true);
    assert.equal(cheerRacer(race, 0), false);
    for (let i = 0; i < 90; i++) stepRace(race, 1 / 30);
    assert.ok(race.racers[0].s > 0);
    assert.ok(COURSE_LENGTH > 80);
});

test("bouts end, stronger fighters usually win", () => {
    let strong = 0;
    for (let seed = 1; seed <= 30; seed++) {
        const r = rng(seed * 7);
        const bout = createBout(rival(r, 50), rival(r, 5), seed);
        let steps = 0;
        while (!bout.over && steps++ < 4000) {
            if (steps % 40 === 0) cheerFighter(bout, 1);
            stepBout(bout, 1 / 30);
        }
        assert.ok(bout.over, "bout ends");
        if (bout.winner === 0) strong++;
    }
    assert.ok(strong >= 22, `strong won ${strong}/30`);
});

test("gauge sweeps 0..1", () => {
    const bout = createBout(rival(rng(1), 1), rival(rng(2), 1), 1);
    for (let i = 0; i < 100; i++) {
        bout.t = i * 0.05;
        const g = gauge(bout, 0);
        assert.ok(g >= 0 && g <= 1);
    }
});
