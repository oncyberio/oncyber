// Fails when the lobby's feel and the kit's drift apart. The lobby's code is
// the source: fix the kit's constants (or the lobby) until this passes.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { CAMERA, GAIT, KEYS, MOTION, TOUCH } from "../src/constants.ts";
import { distanceFromRest, stepWalker, walkerState } from "../src/motion.ts";

const root = new URL("../../../../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const lobby = createRequire(import.meta.url)(
    new URL("multiplayer/protocol/movement.js", root).pathname
);
const movement = read("multiplayer/protocol/movement.js");
const scene = read("frontend/features/lobby/createLobbyScene.tsx");
const controls = read("frontend/features/lobby/lobbyControls.ts");
const gait = read("frontend/features/lobby/locomotion.ts");

/** The first capture of `pattern` in `source`, as numbers. */
function numbers(source, pattern, what) {
    const match = source.match(pattern);
    assert.ok(
        match,
        `the lobby no longer has ${what} where the kit reads it (${pattern}); update this test and the kit's constants together`
    );
    return match.slice(1).map(Number);
}

test("movement constants match multiplayer/protocol/movement.js", () => {
    assert.equal(MOTION.step, lobby.STEP);
    assert.equal(MOTION.acceleration, lobby.ACCELERATION);
    assert.deepEqual(
        numbers(
            movement,
            /running \? ([\d.]+) : ([\d.]+)/,
            "the run and walk speeds"
        ),
        [MOTION.runSpeed, MOTION.walkSpeed]
    );
    assert.deepEqual(
        numbers(
            movement,
            /moving \? ([\d.]+) : ([\d.]+)\) \* dt/,
            "the steer and brake rates"
        ),
        [MOTION.steerRate, MOTION.brakeRate]
    );
    assert.deepEqual(
        numbers(movement, /!moving && speed < ([\d.]+)/, "the rest speed"),
        [MOTION.restSpeed]
    );
    assert.deepEqual(
        numbers(
            movement,
            /Math\.abs\(strafe\) \+ Math\.abs\(forward\) > ([\d.]+)/,
            "the input deadzone"
        ),
        [MOTION.inputDeadzone]
    );
    assert.deepEqual(
        numbers(
            movement,
            /s\.jumpCount < (\d+)\) \{\s*s\.vy = ([\d.]+)/,
            "the jump"
        ),
        [MOTION.maxJumps, MOTION.jumpSpeed]
    );
    assert.deepEqual(numbers(movement, /s\.vy -= ([\d.]+) \* dt/, "gravity"), [
        MOTION.gravity,
    ]);
    assert.deepEqual(
        numbers(
            movement,
            /Math\.hypot\(dx, dz\) > ([\d.]+)\) s\.rotation = .*Math\.exp\(-([\d.]+) \* dt\)/,
            "the facing turn"
        ),
        [MOTION.faceMinSpeed, MOTION.faceRate]
    );
    assert.deepEqual(
        numbers(
            movement,
            /dt = clamp\(finite\(dt\), 0, ([\d.]+)\)/,
            "the longest frame"
        ),
        [MOTION.maxFrame]
    );
    assert.deepEqual(
        numbers(
            gait,
            /LOBBY_GAIT_SPEEDS = \{ WALK: ([\d.]+), RUN: ([\d.]+) \}/,
            "the gait speeds"
        ),
        [GAIT.walk, GAIT.run]
    );
    assert.deepEqual(
        numbers(
            read("docs/locomotion.md"),
            /\(([\d.]+) m lobby\s+reference\)/,
            "the reference height"
        ),
        [MOTION.referenceHeight]
    );
});

test("the kit's step is the lobby's step, input for input", () => {
    // A seeded walk through every control: steer, strafe, run, jump twice, release.
    let seed = 7;
    const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
    const theirs = lobby.state(),
        ours = walkerState();
    let controls = {
        strafe: 0,
        forward: 0,
        yaw: 0,
        running: false,
        jump: false,
        animation: -1,
    };
    for (let n = 0; n < 60 * 40; n++) {
        if (n % 20 === 0)
            controls = lobby.input({
                strafe: Math.round(random() * 2 - 1),
                forward:
                    Math.round(random() * 2 - 1) * (random() < 0.8 ? 1 : 0.4),
                yaw: random() * 6 - 3,
                running: random() < 0.4,
                jump: false,
                animation: -1,
            });
        controls.jump = random() < 0.04;
        lobby.step(theirs, controls);
        stepWalker(ours, controls);
        for (const key of [
            "x",
            "y",
            "z",
            "rotation",
            "vx",
            "vz",
            "vy",
            "jumpCount",
            "floor",
        ])
            assert.ok(
                typeof ours[key] === "number"
                    ? Math.abs(ours[key] - theirs[key]) < 1e-9
                    : ours[key] === theirs[key],
                `step ${n}: ${key} is ${ours[key]}, the lobby's is ${theirs[key]}`
            );
    }
    assert.ok(Math.hypot(ours.x, ours.z) > 1, "the walk went somewhere");
});

test("two seconds of forward covers the lobby's distance", () => {
    for (const running of [false, true]) {
        const s = lobby.state();
        for (let n = 0; n < 120; n++)
            lobby.step(
                s,
                lobby.input({
                    strafe: 0,
                    forward: -1,
                    yaw: 0,
                    running,
                    jump: false,
                    animation: -1,
                })
            );
        assert.ok(
            Math.abs(distanceFromRest(2, running) - Math.hypot(s.x, s.z)) < 1e-9
        );
    }
    // And the numbers a person would quote: about 5.6 m walking, 8.5 m running.
    assert.ok(
        Math.abs(distanceFromRest(2) - 5.6) < 0.05,
        String(distanceFromRest(2))
    );
    assert.ok(
        Math.abs(distanceFromRest(2, true) - 8.54) < 0.05,
        String(distanceFromRest(2, true))
    );
});

test("camera constants match createLobbyScene.tsx", () => {
    assert.deepEqual(
        numbers(
            scene,
            /new THREE\.PerspectiveCamera\(([\d.]+), 1, ([\d.]+), [\d.]+\)/,
            "the camera's lens"
        ),
        [CAMERA.fov, CAMERA.near]
    );
    assert.deepEqual(
        numbers(
            scene,
            /camera\.fov = width < (\d+) \? (\d+) : (\d+);/,
            "the narrow-view field of view"
        ),
        [CAMERA.narrowWidth, CAMERA.narrowFov, CAMERA.fov]
    );
    assert.deepEqual(
        numbers(scene, /const LOOK_HEIGHT = ([\d.]+);/, "the look height"),
        [CAMERA.lookHeight]
    );
    assert.deepEqual(
        numbers(scene, /let pitch = (-[\d.]+);/, "the resting pitch"),
        [CAMERA.pitch]
    );
    assert.deepEqual(
        numbers(
            scene,
            /const distance =\s*\(([\d.]+) \+ entrance/,
            "the follow distance"
        ),
        [CAMERA.distance]
    );
    assert.deepEqual(
        numbers(scene, /targetYaw -= dx \* ([\d.]+);/, "the drag yaw"),
        [CAMERA.dragYaw]
    );
    assert.deepEqual(
        numbers(
            scene,
            /targetPitch - dy \* ([\d.]+),\s*(-[\d.]+),\s*([\d.]+)\s*\)/,
            "the drag pitch and its limits"
        ),
        [CAMERA.dragPitch, CAMERA.pitchMin, CAMERA.pitchMax]
    );
    assert.deepEqual(
        numbers(
            scene,
            /event\.deltaY \* unit,\s*-(\d+),\s*(\d+)\s*\)/,
            "the wheel clamp"
        ),
        [CAMERA.wheelMax, CAMERA.wheelMax]
    );
    assert.deepEqual(
        numbers(scene, /targetPitch - delta \* ([\d.]+),/, "the wheel pitch"),
        [CAMERA.wheelPitch]
    );
    assert.deepEqual(
        numbers(
            scene,
            /yaw \+= \(targetYaw - yaw\) \* \(1 - Math\.exp\(-(\d+) \* delta\)\)/,
            "the look easing"
        ),
        [CAMERA.lookRate]
    );
    assert.deepEqual(
        numbers(
            scene,
            /event\.clientY - drag\.startY\s*\) > (\d+);/,
            "the drag threshold"
        ),
        [CAMERA.dragThreshold]
    );
    assert.deepEqual(
        numbers(
            scene,
            /event\.clientX - rect\.left - rect\.width \/ 2\) \/ (\d+),/,
            "the touch stick radius"
        ),
        [TOUCH.stickRadius]
    );
    assert.match(
        controls,
        /\(Math\.PI \/ 2\) \*/,
        "arrow keys turn at a quarter turn per second"
    );
    assert.equal(CAMERA.keyTurnRate, Math.PI / 2);
});

test("keys match lobbyControls.ts and createLobbyScene.tsx", () => {
    const has = (source, expression, what) =>
        assert.ok(
            source.replace(/\s+/g, " ").includes(expression),
            `the lobby's ${what} changed; expected ${expression}`
        );
    has(
        controls,
        `strafe: Number(keys.has("${KEYS.right[0]}")) - Number(keys.has("${KEYS.left[0]}"))`,
        "strafe keys"
    );
    has(
        controls,
        `Number(keys.has("${KEYS.back[0]}") || keys.has("${KEYS.back[1]}")) - Number(keys.has("${KEYS.forward[0]}") || keys.has("${KEYS.forward[1]}"))`,
        "forward and back keys"
    );
    has(
        controls,
        `(Number(keys.has("${KEYS.turnLeft[0]}")) - Number(keys.has("${KEYS.turnRight[0]}")))`,
        "turn keys"
    );
    has(
        scene,
        `keys.has("${KEYS.run[0]}") || keys.has("${KEYS.run[1]}")`,
        "run keys"
    );
    has(scene, `code === "${KEYS.jump[0]}" && !event.repeat`, "jump key");
    assert.deepEqual(
        [
            KEYS.left.length,
            KEYS.right.length,
            KEYS.turnLeft.length,
            KEYS.turnRight.length,
            KEYS.jump.length,
        ],
        [1, 1, 1, 1, 1]
    );
});
