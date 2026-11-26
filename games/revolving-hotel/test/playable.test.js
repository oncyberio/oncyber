import assert from "node:assert/strict";
import test from "node:test";
import { createRun } from "../src/playable.mjs";
test("ordinary movement and strikes can clear the corridor and finish at the lift", () => {
    const game = createRun([]),
        dt = 1 / 90,
        forward = new Set(["forward", "sprint"]),
        stopped = new Set();
    let state;
    for (let i = 0; i < 2400; i++) {
        state = game.snapshot();
        if (state.cleared) break;
        const [hero, ...agents] = state.people;
        const fighting = agents.some(
            (a) => a.health > 0 && Math.abs(a.z - hero.z) < 0.85
        );
        game.action("strike");
        game.step(dt, fighting ? stopped : forward);
    }
    assert.ok(state.cleared);
    assert.deepEqual(
        state.people.slice(1).map((a) => a.health),
        [0, 0]
    );
    assert.ok(state.people[0].health > 0);
});
test("a run resumes during a gravity change without moving the player between surfaces", () => {
    const a = createRun([]),
        b = createRun([]),
        held = new Set();
    for (let i = 0; i < 520; i++) a.step(1 / 60, held);
    b.restore(a.snapshot());
    assert.deepEqual(a.snapshot(), b.snapshot());
    for (let i = 0; i < 180; i++) {
        a.step(1 / 60, held);
        b.step(1 / 60, held);
    }
    assert.deepEqual(a.snapshot(), b.snapshot());
    assert.notEqual(a.snapshot().people[0].normal, 0);
});
