import assert from "node:assert/strict";
import test from "node:test";
import { CAMERA, MOTION } from "../src/constants.ts";
import { createWalker, distanceFromRest } from "../src/motion.ts";
import {
    createJumpInput,
    keyCode,
    readGamepad,
    readKeys,
    stickVector,
} from "../src/input.ts";
import {
    cameraPose,
    createFollowCamera,
    dragLook,
    lobbyFov,
    turnLook,
    updateCamera,
    wheelLook,
} from "../src/camera.ts";
import { arrival, readLobbyView } from "../src/arrival.ts";
import { applyCameraPose } from "../src/three.ts";

const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
const ahead = { strafe: 0, forward: -1, yaw: 0, running: false, jump: false };
const idle = { ...ahead, forward: 0 };

test("a walker covers the lobby's distance at any frame rate", () => {
    for (const fps of [30, 60, 144]) {
        const walker = createWalker();
        let shown;
        for (let n = 0; n < fps * 2; n++)
            shown = walker.advance(1 / fps, ahead);
        assert.ok(
            Math.abs(Math.hypot(shown.x, shown.z) - distanceFromRest(2)) < 0.06,
            `${fps} fps`
        );
        assert.ok(
            shown.z < 0 && near(shown.x, 0),
            "forward is away from the camera, down -z at yaw 0"
        );
        assert.ok(near(walker.state.time, 2, 0.02));
    }
});

test("speed tops out at walk and run, and release brakes to an exact rest", () => {
    const walker = createWalker();
    for (let n = 0; n < 120; n++) walker.advance(1 / 60, ahead);
    assert.ok(near(walker.speed(), MOTION.walkSpeed, 0.01));
    for (let n = 0; n < 120; n++)
        walker.advance(1 / 60, { ...ahead, running: true });
    assert.ok(near(walker.speed(), MOTION.runSpeed, 0.01));
    for (let n = 0; n < 30; n++) walker.advance(1 / 60, idle);
    assert.equal(walker.speed(), 0);
});

test("scale moves a taller avatar further, and constrain keeps it inside", () => {
    const big = createWalker({}, { scale: 2 });
    for (let n = 0; n < 120; n++) big.advance(1 / 60, ahead);
    assert.ok(near(-big.state.z, distanceFromRest(2) * 2, 1e-9));
    assert.ok(near(big.velocity(0).z, -MOTION.walkSpeed * 2, 0.02));
    const fenced = createWalker(
        {},
        { constrain: (s) => (s.z = Math.max(-1, s.z)) }
    );
    let shown;
    for (let n = 0; n < 120; n++) shown = fenced.advance(1 / 60, ahead);
    assert.equal(fenced.state.z, -1);
    assert.equal(shown.z, -1);
});

test("jump, double jump, then no third until landing; a held key does not repeat", () => {
    const walker = createWalker();
    const jump = createJumpInput();
    const frame = () =>
        walker.advance(1 / 60, { ...idle, jump: jump.read(1 / 60) });
    jump.queue();
    frame();
    assert.equal(walker.state.jumpCount, 1);
    for (let n = 0; n < 10; n++) frame();
    jump.queue();
    jump.queue();
    jump.queue(); // a third press in the air is dropped
    for (let n = 0; n < 8; n++) frame();
    assert.equal(walker.state.jumpCount, 2);
    let peak = 0;
    for (let n = 0; n < 200; n++) peak = Math.max(peak, frame().y);
    assert.ok(peak > 1 && peak < 2.2, String(peak));
    assert.equal(walker.state.y, 0);
    assert.equal(walker.state.floor, true);
    // The lobby's single jump: v²/2g = 1 m.
    const one = createWalker();
    one.advance(1 / 60, { ...idle, jump: true });
    let top = 0;
    for (let n = 0; n < 120; n++)
        top = Math.max(top, one.advance(1 / 60, { ...idle, jump: true }).y);
    assert.ok(
        near(top, MOTION.jumpSpeed ** 2 / (2 * MOTION.gravity), 0.06),
        String(top)
    );
    assert.equal(one.state.jumpCount, 0);
});

test("place keeps the clock running forward", () => {
    const walker = createWalker();
    for (let n = 0; n < 60; n++) walker.advance(1 / 60, ahead);
    walker.place({ x: 3, z: 4, rotation: 1 });
    assert.ok(near(walker.state.time, 1, 0.02));
    assert.deepEqual(
        [walker.state.x, walker.state.z, walker.speed()],
        [3, 4, 0]
    );
    assert.deepEqual(walker.rest, { x: 3, z: 4, time: walker.state.time });
    for (let n = 0; n < 6; n++) walker.advance(1 / 60, idle);
    const stood = walker.rest.time;
    for (let n = 0; n < 60; n++) walker.advance(1 / 60, ahead);
    assert.ok(
        near(walker.state.time - walker.rest.time, 1, 1e-9) &&
            near(walker.rest.time, stood + 0, 1e-9),
        "rest marks the last still step"
    );
});

test("keys, stick and gamepad give the same actions", () => {
    assert.deepEqual(readKeys(new Set(["KeyW", "KeyD", "ShiftRight"]), 0.016), {
        strafe: 1,
        forward: -1,
        turn: 0,
        running: true,
    });
    assert.equal(readKeys(new Set(["ArrowUp"]), 0.016).forward, -1);
    assert.ok(
        near(readKeys(new Set(["ArrowLeft"]), 0.1).turn, (Math.PI / 2) * 0.1)
    );
    assert.ok(readKeys(new Set(["ArrowRight"]), 0.1).turn < 0);
    assert.equal(keyCode({ key: " " }), "Space");
    assert.equal(keyCode({ key: "w" }), "KeyW");
    assert.deepEqual(stickVector(0, -15), { strafe: 0, forward: -0.5 });
    assert.ok(near(Math.hypot(...Object.values(stickVector(90, 90))), 1));
    const pad = (axes, down = []) => ({
        axes,
        buttons: Array.from({ length: 16 }, (_, n) => ({
            pressed: down.includes(n),
        })),
    });
    assert.deepEqual(readGamepad(pad([0.1, -0.1, 0, 0]), 0.016), {
        strafe: 0,
        forward: 0,
        lookYaw: 0,
        lookPitch: 0,
        running: false,
        jump: false,
    });
    const read = readGamepad(pad([0, -1, 1, 0], [0, 10]), 0.016);
    assert.equal(read.forward, -1);
    assert.ok(read.lookYaw < 0 && read.running && read.jump);
    assert.equal(readGamepad(null, 0.016).forward, 0);
});

test("the follow camera is the lobby's: 5 m back, 1.2 m up, 58 degrees", () => {
    const camera = createFollowCamera();
    const pose = cameraPose(camera, { x: 2, z: 3 }, 1280);
    assert.deepEqual(pose.target, { x: 2, y: CAMERA.lookHeight, z: 3 });
    assert.ok(
        near(
            Math.hypot(
                pose.position.x - 2,
                pose.position.y - 1.2,
                pose.position.z - 3
            ),
            CAMERA.distance
        )
    );
    // The lobby's own formula.
    assert.ok(
        near(pose.position.y, 1.2 - Math.sin(-0.28) * 5) &&
            near(pose.position.z, 3 + Math.cos(-0.28) * 5) &&
            near(pose.position.x, 2)
    );
    assert.equal(pose.fov, 58);
    assert.equal(cameraPose(camera, { x: 0, z: 0 }, 390).fov, 72);
    assert.equal(lobbyFov(600), 58);
});

test("drag, wheel and arrows look around within the lobby's limits", () => {
    const camera = createFollowCamera();
    dragLook(camera, 100, 0);
    assert.ok(near(camera.targetYaw, -0.32));
    assert.equal(camera.yaw, 0);
    for (let n = 0; n < 60; n++) updateCamera(camera, 1 / 60);
    assert.ok(near(camera.yaw, -0.32, 1e-4));
    dragLook(camera, 0, 10000);
    assert.equal(camera.targetPitch, CAMERA.pitchMin);
    wheelLook(camera, -100000);
    assert.ok(
        near(camera.targetPitch, CAMERA.pitchMin + 160 * CAMERA.wheelPitch)
    );
    dragLook(camera, 0, -10000);
    assert.equal(camera.targetPitch, CAMERA.pitchMax);
    turnLook(camera, 0.5);
    assert.ok(
        near(camera.yaw - camera.targetYaw, 0, 1e-4),
        "arrow turns are immediate"
    );
});

const view = {
    cameraOffset: { x: 1.2, y: 1.5, z: 3 },
    cameraTargetOffset: { x: 0.1, y: 1.1, z: 0 },
    avatarRotation: 0.4,
    avatarHeight: 1.8,
    fov: 50,
};

test("arrival keeps the lobby's framing and faces the way the game picks", () => {
    for (const facing of [0, Math.PI / 2, -2.2]) {
        const a = arrival(view, { at: { x: 10, y: 1, z: -4 }, facing });
        const d = {
            x: a.position.x - a.target.x,
            y: a.position.y - a.target.y,
            z: a.position.z - a.target.z,
        };
        // The camera looks along `facing`: it sits behind the look point.
        assert.ok(
            near(
                Math.atan2(d.x, d.z),
                Math.atan2(Math.sin(facing), Math.cos(facing))
            )
        );
        // Rigid: same distances as in the lobby.
        assert.ok(near(Math.hypot(d.x, d.y, d.z), Math.hypot(1.1, 0.4, 3)));
        assert.ok(
            near(
                Math.hypot(a.position.x - 10, a.position.z + 4),
                Math.hypot(1.2, 3)
            )
        );
        assert.ok(near(a.position.y, 2.5) && near(a.target.y, 2.1));
        assert.equal(a.fov, 50);
        // The avatar turned by the same amount as the camera.
        const incoming = Math.atan2(1.1, 3);
        assert.ok(
            near(
                Math.sin(a.avatarRotation - 0.4),
                Math.sin(facing - incoming)
            ) &&
                near(
                    Math.cos(a.avatarRotation - 0.4),
                    Math.cos(facing - incoming)
                )
        );
        // The follow camera starts on exactly that frame.
        const pose = cameraPose(a.camera, { x: 10, y: 1, z: -4 }, 1280);
        for (const k of ["x", "y", "z"])
            assert.ok(
                near(pose.position[k], a.position[k]) &&
                    near(pose.target[k], a.target[k]),
                k
            );
        assert.equal(pose.fov, 50);
    }
});

test("arrival can pick the avatar's heading instead, with the camera where the lobby had it", () => {
    const off = {
        ...view,
        avatarRotation: view.avatarRotation + 0.4,
    };
    const a = arrival(off, {
        at: { x: 3, z: 5 },
        facing: 0,
        avatarFacing: Math.PI,
    });
    assert.ok(Math.abs(Math.abs(a.avatarRotation) - Math.PI) < 1e-9);
    // The same rigid picture as picking the camera's heading.
    const b = arrival(off, { at: { x: 3, z: 5 }, facing: a.camera.yaw });
    for (const k of ["x", "y", "z"]) {
        assert.ok(Math.abs(a.position[k] - b.position[k]) < 1e-9);
        assert.ok(Math.abs(a.target[k] - b.target[k]) < 1e-9);
    }
    // The follow camera starts on that exact frame.
    const pose = cameraPose(a.camera, { x: 3, z: 5 });
    for (const k of ["x", "y", "z"])
        assert.ok(Math.abs(pose.position[k] - a.position[k]) < 1e-9);
    // With no view the camera goes behind the avatar.
    assert.equal(
        arrival(null, { at: { x: 0, z: 0 }, facing: 0, avatarFacing: 1 })
            .avatarRotation,
        1
    );
});

test("arrival scales to the game's avatar and accepts enter()'s continuity", () => {
    const a = arrival(view, {
        at: { x: 0, z: 0 },
        facing: 0,
        avatarHeight: 3.6,
    });
    assert.equal(a.scale, 2);
    assert.ok(
        near(a.position.y, 3) &&
            near(Math.hypot(a.position.x, a.position.z), Math.hypot(1.2, 3) * 2)
    );
    const half = Math.sin(0.2),
        continuity = {
            avatar: {
                id: "v",
                position: [5, 0, 5],
                rotation: [0, half, 0, Math.cos(0.2)],
            },
            camera: {
                position: [6.2, 1.5, 8],
                target: [5.1, 1.1, 5],
                fov: 50,
                mode: "third-person",
            },
            party: [],
        };
    const read = readLobbyView(continuity);
    assert.ok(
        near(read.avatarRotation, 0.4) &&
            near(read.cameraOffset.x, 1.2) &&
            near(read.cameraTargetOffset.y, 1.1)
    );
    const b = arrival(continuity, { at: { x: 0, z: 0 }, facing: 0 }),
        c = arrival(view, { at: { x: 0, z: 0 }, facing: 0 });
    for (const k of ["x", "y", "z"])
        assert.ok(
            near(b.position[k], c.position[k]) && near(b.target[k], c.target[k])
        );
});

test("with no usable view, arrival is the lobby's follow camera behind the visitor", () => {
    for (const bad of [
        null,
        undefined,
        {},
        { ...view, fov: 0 },
        { ...view, cameraOffset: view.cameraTargetOffset },
        { ...view, cameraOffset: { x: NaN, y: 0, z: 0 } },
    ]) {
        const a = arrival(bad, { at: { x: 1, z: 2 }, facing: 0 });
        assert.equal(a.fov, 58);
        assert.equal(a.avatarRotation, 0);
        assert.deepEqual(a.target, { x: 1, y: 1.2, z: 2 });
        assert.ok(
            a.position.z > 2 &&
                near(
                    Math.hypot(
                        a.position.x - 1,
                        a.position.y - 1.2,
                        a.position.z - 2
                    ),
                    5
                )
        );
    }
});

test("after arrival the camera holds, then settles into the lobby's once the visitor moves", () => {
    const a = arrival(
        { ...view, cameraOffset: { x: 0, y: 3, z: 2.5 } },
        { at: { x: 0, z: 0 }, facing: 0 }
    );
    const camera = a.camera;
    for (let n = 0; n < 120; n++) updateCamera(camera, 1 / 60);
    assert.ok(
        near(cameraPose(camera, { x: 0, z: 0 }).position.y, a.position.y),
        "holds while the visitor stands"
    );
    for (let n = 0; n < 600; n++) updateCamera(camera, 1 / 60, true);
    const pose = cameraPose(camera, { x: 0, z: 0 }, 1280);
    assert.equal(camera.settling, false);
    assert.equal(pose.fov, 58);
    assert.deepEqual(pose.target, { x: 0, y: 1.2, z: 0 });
    assert.ok(
        camera.pitch >= CAMERA.pitchMin - 1e-6 && near(camera.distance, 5)
    );
});

test("applyCameraPose sets a three.js-shaped camera", () => {
    const calls = [];
    const camera = {
        position: { set: (...p) => calls.push(["position", ...p]) },
        fov: 42,
        near: 0.1,
        lookAt: (...p) => calls.push(["lookAt", ...p]),
        updateProjectionMatrix: () => calls.push(["projection"]),
    };
    const pose = cameraPose(createFollowCamera(), { x: 0, z: 0 });
    applyCameraPose(camera, pose);
    assert.deepEqual(
        calls.map((c) => c[0]),
        ["position", "lookAt", "projection"]
    );
    assert.deepEqual([camera.fov, camera.near], [58, 0.08]);
    applyCameraPose(camera, pose);
    assert.equal(calls.length, 5, "no projection update when nothing changed");
});
