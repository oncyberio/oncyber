import test from "node:test";
import assert from "node:assert/strict";
import {
    CLUB_SPAWN,
    createClubConstraint,
    moveInPadelWorld,
    padelPositionAllowed,
} from "./club.js";

test("visitors collide with the enclosed court but can use its four side entries", () => {
    assert.equal(padelPositionAllowed(CLUB_SPAWN.x, CLUB_SPAWN.z), true);
    for (const p of [
        [0, 0],
        [0, 10],
        [0, -10],
        [5, 7],
        [-5, -7],
        [5, 4],
        [-5, -4],
    ])
        assert.equal(padelPositionAllowed(...p), false);
    for (const p of [
        [5, 1.25],
        [-5, 1.25],
        [5, -1.25],
        [-5, -1.25],
        [6.6, 0],
    ])
        assert.equal(padelPositionAllowed(...p), true);
    const blocked = moveInPadelWorld(0, 1, 0, -4);
    assert.ok(blocked.z >= 0.43, "cannot tunnel through the net");
    assert.ok(
        moveInPadelWorld(0, 9, 0, 4).z < 9.61,
        "back glass blocks long frames"
    );
});

test("the walker's constraint sweeps from the last whole step, for whole steps and drawn poses alike", () => {
    // A stand-in for the locomotion kit's walker: `state` is the whole-step
    // state; the pose it draws is a copy moved a little further.
    const walker = { state: { x: 0, z: 9 } };
    const constrain = createClubConstraint(() => walker);
    constrain(walker.state);
    assert.deepEqual({ ...walker.state }, { x: 0, z: 9 });
    // One step that would land beyond the back glass stops in front of it.
    walker.state.z = 11;
    constrain(walker.state);
    assert.ok(walker.state.z < 9.61, `stopped at ${walker.state.z}`);
    // The drawn pose is swept from the whole-step state, not remembered.
    const shown = { ...walker.state, z: 12 };
    constrain(shown);
    assert.ok(shown.z < 9.61);
    const kept = walker.state.z;
    walker.state.z -= 0.05;
    constrain(walker.state);
    assert.ok(Math.abs(walker.state.z - (kept - 0.05)) < 1e-9);
    // Placed somewhere else: the sweep starts again from there.
    walker.state = { x: -7.2, z: 11.8 };
    constrain.reset(walker.state);
    walker.state.x -= 0.05;
    constrain(walker.state);
    assert.ok(Math.abs(walker.state.x + 7.25) < 1e-9);
    // A position inside a wall (a bad save, a bug) recovers to the spawn side.
    walker.state = { x: 0, z: 0 };
    constrain.reset(walker.state);
    constrain(walker.state);
    assert.equal(padelPositionAllowed(walker.state.x, walker.state.z), true);
});
