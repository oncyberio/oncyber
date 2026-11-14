import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  createPadelVisit,
  padelPositionAllowed,
  moveInPadelWorld,
  findPadelVisitPath,
  serializePadelVisitPose,
} from "./visit.js";

class Canvas {
  constructor() {
    this.listeners = new Map();
    this.capture = new Set();
    this.focuses = 0;
  }
  addEventListener(name, fn) {
    const list = this.listeners.get(name) || [];
    list.push(fn);
    this.listeners.set(name, list);
  }
  removeEventListener(name, fn) {
    this.listeners.set(
      name,
      this.listeners.get(name).filter((value) => value !== fn)
    );
  }
  fire(name, event = {}) {
    for (const fn of this.listeners.get(name) || [])
      fn({ pointerId: 1, button: 0, preventDefault() {}, ...event });
  }
  focus() {
    this.focuses++;
  }
  setPointerCapture(id) {
    this.capture.add(id);
  }
  hasPointerCapture(id) {
    return this.capture.has(id);
  }
  releasePointerCapture(id) {
    this.capture.delete(id);
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 1000, height: 700 };
  }
}
function visit(options = {}) {
  const canvas = new Canvas(),
    camera = new THREE.PerspectiveCamera(46, 1000 / 700, 0.1, 240);
  const controller = createPadelVisit({
    canvas,
    camera,
    random: () => 0.5,
    ...options,
  });
  controller.update(0, new Set());
  return { controller, canvas, camera };
}
function advance(controller, seconds, keys = new Set()) {
  for (let i = 0; i < Math.round(seconds * 60); i++)
    controller.update(1 / 60, keys);
}
function clickWorld(canvas, camera, x, z) {
  const screen = new THREE.Vector3(x, 0, z).project(camera);
  const event = {
    clientX: (screen.x * 0.5 + 0.5) * 1000,
    clientY: (-screen.y * 0.5 + 0.5) * 700,
  };
  canvas.fire("pointerdown", event);
  canvas.fire("pointerup", event);
}

test("visitors collide with the enclosed court but can use its four side entries", () => {
  assert.equal(padelPositionAllowed(-7.2, 11.8), true);
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
test("click paths enter through the doors and route outside the net without crossing glass", () => {
  for (const [start, target] of [
    [
      { x: 0, z: 8 },
      { x: 0, z: -8 },
    ],
    [
      { x: -7.2, z: 11.8 },
      { x: 3, z: -8 },
    ],
    [
      { x: 0, z: 8 },
      { x: 7, z: 8 },
    ],
  ]) {
    const path = findPadelVisitPath(start, target);
    assert.ok(path.length >= 2);
    assert.deepEqual(path.at(-1), target);
    let previous = start;
    for (const point of path) {
      for (let i = 0; i <= 100; i++) {
        const t = i / 100;
        assert.ok(
          padelPositionAllowed(
            previous.x + (point.x - previous.x) * t,
            previous.z + (point.z - previous.z) * t
          )
        );
      }
      previous = point;
    }
  }
});

test("visit movement uses the native camera-relative walk, sprint and grounded jump state", () => {
  const walk = visit(),
    run = visit();
  advance(walk.controller, 1, new Set(["KeyW"]));
  advance(run.controller, 1, new Set(["KeyW", "ShiftLeft"]));
  assert.ok(walk.controller.state.x > -7.2 && walk.controller.state.z < 11.8);
  assert.ok(run.controller.state.speed > walk.controller.state.speed * 1.5);
  assert.equal(walk.controller.state.animationMode, "visit");
  const jumper = visit().controller;
  let peak = 0;
  for (let i = 0; i < 120; i++) {
    jumper.update(1 / 60, new Set(i === 0 ? ["Space"] : []));
    peak = Math.max(peak, jumper.state.y);
  }
  assert.ok(peak > 0.65);
  assert.equal(jumper.state.y, 0);
  assert.equal(jumper.state.grounded, true);
  assert.equal(jumper.state.jumpCount, 0);
});

test("visit clicking moves the player, dragging orbits, and keyboard input cancels a path", () => {
  const { controller, canvas, camera } = visit();
  clickWorld(canvas, camera, -7.2, 8.8);
  assert.ok(controller.destination);
  advance(controller, 2);
  assert.ok(
    Math.hypot(controller.state.x + 7.2, controller.state.z - 8.8) < 0.15
  );
  assert.equal(controller.destination, null);
  const oldCamera = camera.position.clone();
  canvas.fire("pointerdown", { clientX: 500, clientY: 350 });
  canvas.fire("pointermove", { clientX: 620, clientY: 390 });
  canvas.fire("pointerup", { clientX: 620, clientY: 390 });
  advance(controller, 0.3);
  assert.ok(camera.position.distanceTo(oldCamera) > 0.5);
  assert.equal(controller.destination, null);
  clickWorld(canvas, camera, -7.2, 6.8);
  assert.ok(controller.destination);
  controller.update(1 / 60, new Set(["KeyD"]));
  assert.equal(controller.destination, null);
});

test("click-to-walk actually reaches the other side of the net rather than stopping against it", () => {
  const { controller, canvas, camera } = visit({ spawn: { x: -3, z: 4 } });
  clickWorld(canvas, camera, -3, -4);
  assert.ok(controller.destination);
  advance(controller, 8);
  assert.ok(Math.hypot(controller.state.x + 3, controller.state.z + 4) < 0.16);
});

test("chat focus cancels captured dragging, click intent and movement immediately", () => {
  const { controller, canvas } = visit();
  advance(controller, 0.3, new Set(["KeyW"]));
  canvas.fire("pointerdown", { clientX: 400, clientY: 350 });
  assert.ok(canvas.hasPointerCapture(1));
  controller.setEnabled(false);
  assert.equal(canvas.hasPointerCapture(1), false);
  const position = { x: controller.state.x, z: controller.state.z };
  advance(controller, 0.5, new Set(["KeyW", "Space"]));
  assert.deepEqual({ x: controller.state.x, z: controller.state.z }, position);
  assert.equal(controller.state.y, 0);
  assert.equal(controller.state.speed, 0);
  controller.setEnabled(true);
  advance(controller, 0.3, new Set(["KeyW"]));
  assert.ok(controller.state.z < position.z);
});

test("visit pose publishing is ten times a second and stops while the match owns the player", () => {
  const poses = [];
  const { controller } = visit({ onPose: (pose) => poses.push(pose) });
  advance(controller, 1, new Set(["KeyW"]));
  assert.equal(poses.length, 10);
  assert.ok(
    poses.every((pose) =>
      [pose.x, pose.y, pose.z, pose.rotation, pose.vx, pose.vz].every(
        Number.isFinite
      )
    )
  );
  assert.equal(poses.at(-1).rotation, controller.state.yaw);
  assert.deepEqual(poses.at(-1), serializePadelVisitPose(controller.state));
  controller.setActive(false);
  const position = { ...controller.state };
  advance(controller, 1, new Set(["KeyW"]));
  assert.equal(poses.length, 10);
  assert.deepEqual(controller.state, position);
});

test("returning to visit preserves its location and clears airborne momentum and match camera settings", () => {
  const { controller, camera } = visit();
  advance(controller, 0.3, new Set(["Space"]));
  assert.ok(controller.state.y > 0);
  const original = { x: controller.state.x, z: controller.state.z };
  controller.setActive(false);
  camera.fov = 96;
  camera.near = 0.045;
  controller.reset();
  controller.setActive(true);
  controller.update(0, new Set());
  assert.deepEqual({ x: controller.state.x, z: controller.state.z }, original);
  assert.equal(controller.state.y, 0);
  assert.equal(controller.state.verticalVelocity, 0);
  assert.equal(camera.fov, 58);
  assert.equal(camera.near, 0.1);
});

test("visit disposal releases controls and invalid frame deltas never corrupt a pose", () => {
  const { controller, canvas } = visit();
  controller.update(NaN, new Set(["KeyW"]));
  assert.ok(
    [controller.state.x, controller.state.y, controller.state.z].every(
      Number.isFinite
    )
  );
  canvas.fire("pointerdown", { clientX: 400, clientY: 350 });
  controller.dispose();
  controller.dispose();
  assert.equal(canvas.capture.size, 0);
  assert.ok(
    [...canvas.listeners.values()].every((listeners) => listeners.length === 0)
  );
  const position = { ...controller.state };
  advance(controller, 1, new Set(["KeyW"]));
  assert.deepEqual(controller.state, position);
});

test("clicking away from a collider still works when the visitor is already touching it", () => {
  assert.deepEqual(findPadelVisitPath({ x: 0, z: 0.5 }, { x: 0, z: 3 }), [
    { x: 0, z: 3 },
  ]);
  const { controller, canvas, camera } = visit({ spawn: { x: 0, z: 0.5 } });
  clickWorld(canvas, camera, 0, 3);
  assert.ok(controller.destination);
  advance(controller, 1.5);
  assert.ok(Math.hypot(controller.state.x, controller.state.z - 3) < 0.15);
});
