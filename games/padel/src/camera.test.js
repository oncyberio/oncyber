import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  calculatePadelCameraPose,
  createPadelCamera,
  PADEL_CAMERA_MODES,
} from "./camera.js";
const player = { x: 0, y: 0, z: 10.7 };
const ball = { x: 0, y: 1.2, z: -3, active: true };
const state = (mode, extra = {}) => ({
  mode,
  playing: true,
  player,
  ball,
  aspect: 16 / 9,
  ...extra,
});
const close = (actual, expected, epsilon = 1e-8) =>
  assert.ok(Math.abs(actual - expected) < epsilon, `${actual} != ${expected}`);
function view(pose) {
  const camera = new THREE.PerspectiveCamera(
    pose.fov,
    pose.aspect,
    pose.near,
    240
  );
  camera.position.copy(pose.position);
  camera.lookAt(pose.lookAt);
  camera.updateMatrixWorld();
  return camera;
}
function visible(camera, point) {
  const projected = new THREE.Vector3(...point).project(camera);
  return (
    Math.abs(projected.x) <= 1 &&
    Math.abs(projected.y) <= 1 &&
    projected.z >= -1 &&
    projected.z <= 1
  );
}

test("setup and broadcast preserve the established court composition", () => {
  for (const mode of PADEL_CAMERA_MODES) {
    const setup = calculatePadelCameraPose(state(mode, { playing: false }));
    assert.deepEqual(setup.position.toArray(), [12, 13.7, 25]);
    assert.deepEqual(setup.lookAt.toArray(), [-3.7, 0.45, 0]);
    assert.equal(setup.fov, 46);
    assert.equal(setup.firstPerson, false);
  }
  const broadcast = calculatePadelCameraPose(
    state("broadcast", { player: { ...player, x: 4 }, ball: { ...ball, x: 3 } })
  );
  assert.deepEqual(broadcast.position.toArray(), [0.4, 11.9, 22.8]);
  assert.deepEqual(broadcast.lookAt.toArray(), [0.18, 0.45, -1.5]);
  const portrait = calculatePadelCameraPose(
    state("broadcast", { aspect: 0.8 })
  );
  assert.deepEqual(portrait.position.toArray(), [0, 17.9, 31.8]);
});

test("first person uses a stable root-locked eye in front of the normalized avatar", () => {
  for (const x of [-6.7, 0, 6.7])
    for (const z of [0.9, 9, 15]) {
      const pose = calculatePadelCameraPose(
        state("first-person", { player: { x, y: 0, z }, avatarHeight: 1.78 })
      );
      close(pose.position.x, x);
      close(pose.position.y, 1.602);
      close(pose.position.z, z - 0.12);
      assert.ok(pose.lookAt.z < pose.position.z);
      assert.equal(pose.firstPerson, true);
    }
  const low = calculatePadelCameraPose(
    state("first-person", { avatarHeight: 1.5 })
  );
  close(low.position.y, 1.35);
  const crouch = calculatePadelCameraPose(
    state("first-person", {
      player: { ...player, action: "crouch", actionTime: 0.75 },
    })
  );
  assert.deepEqual(
    crouch.position.toArray(),
    calculatePadelCameraPose(state("first-person")).position.toArray()
  );
});

test("courtside and first person keep net and opponent in view across useful screen shapes", () => {
  for (const mode of ["courtside", "first-person"]) {
    for (const aspect of [0.55, 0.8, 1.4, 16 / 9, 2.4]) {
      for (const x of [-3, 0, 3]) {
        const pose = calculatePadelCameraPose(
          state(mode, { player: { x, y: 0, z: 9 }, aspect })
        );
        const camera = view(pose);
        assert.ok(
          visible(camera, [0, 0.914, 0]),
          `${mode} loses net at aspect${aspect},x${x}`
        );
        assert.ok(
          visible(camera, [0, 1.1, -10]),
          `${mode} loses opponent at aspect${aspect},x${x}`
        );
      }
    }
  }
  const third = view(calculatePadelCameraPose(state("courtside")));
  assert.ok(visible(third, [0, 0, player.z]));
  assert.ok(visible(third, [0, 1.78, player.z]));
});

test("lob tracking is bounded and a passing ball cannot turn first person backwards", () => {
  const lob = calculatePadelCameraPose(
    state("first-person", { ball: { x: 20, y: 30, z: 8, active: true } })
  );
  const direction = lob.lookAt.clone().sub(lob.position).normalize();
  assert.ok(direction.z < -0.9);
  assert.ok(Math.abs(Math.asin(direction.y)) <= 0.21 + 1e-8);
  const behind = calculatePadelCameraPose(
    state("first-person", { ball: { x: 6, y: 8, z: 13, active: true } })
  );
  const neutral = calculatePadelCameraPose(
    state("first-person", { ball: { ...ball, active: false } })
  );
  assert.deepEqual(behind.lookAt.toArray(), neutral.lookAt.toArray());
  const nearNet = calculatePadelCameraPose(
    state("first-person", {
      player: { x: 0, y: 0, z: 0.9 },
      ball: { x: 0, y: 12, z: -1, active: true },
    })
  );
  assert.ok(visible(view(nearNet), [0, 0.914, 0]));
  assert.ok(visible(view(nearNet), [0, 1.1, -10]));
});

test("mode changes ease to the new view while a paused snap works with zero delta", () => {
  const camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.1, 240);
  const controller = createPadelCamera(camera);
  controller.update(0, state("broadcast"));
  const from = camera.position.clone();
  controller.update(0, state("courtside"));
  assert.deepEqual(camera.position.toArray(), from.toArray());
  controller.update(1 / 60, state("courtside"));
  assert.ok(camera.position.distanceTo(from) > 0);
  assert.ok(camera.position.distanceTo(from) < 0.15);
  for (let i = 0; i < 30; i++) controller.update(1 / 60, state("courtside"));
  const target = calculatePadelCameraPose(state("courtside"));
  assert.ok(camera.position.distanceTo(target.position) < 1e-8);
  const result = controller.update(0, state("first-person"), true);
  assert.equal(result.firstPerson, true);
  assert.ok(
    camera.position.distanceTo(
      calculatePadelCameraPose(state("first-person")).position
    ) < 1e-8
  );
  close(camera.fov, 66);
  close(camera.near, 0.045);
});

test("settled first person follows movement exactly without trailing through the avatar", () => {
  const camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.1, 240);
  const controller = createPadelCamera(camera);
  controller.update(0, state("first-person"));
  for (let i = 1; i <= 90; i++) {
    const next = { x: i * 0.035, y: 0, z: 10.7 - i * 0.04 };
    controller.update(1 / 60, state("first-person", { player: next }));
    close(camera.position.x, next.x);
    close(camera.position.y, 1.602);
    close(camera.position.z, next.z - 0.12);
  }
});

test("point resets snap a follow camera instead of flying across the court", () => {
  for (const mode of ["courtside", "first-person"]) {
    const camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.1, 240);
    const controller = createPadelCamera(camera);
    controller.update(0, state(mode, { player: { x: -5, y: 0, z: 2 } }));
    const resetState = state(mode, { player: { x: 1.65, y: 0, z: 12.45 } });
    controller.update(1 / 60, resetState);
    assert.ok(
      camera.position.distanceTo(
        calculatePadelCameraPose(resetState).position
      ) < 1e-8
    );
  }
});

test("camera inputs stay finite and extreme frame deltas cannot jump a transition", () => {
  const bad = {
    mode: "unknown",
    playing: true,
    player: { x: NaN, y: Infinity, z: -Infinity },
    ball: { x: Infinity, y: NaN, z: Infinity },
    aspect: 0,
    avatarHeight: NaN,
  };
  const pose = calculatePadelCameraPose(bad);
  assert.equal(pose.mode, "broadcast");
  assert.ok(
    [
      ...pose.position.toArray(),
      ...pose.lookAt.toArray(),
      pose.fov,
      pose.aspect,
    ].every(Number.isFinite)
  );
  const a = new THREE.PerspectiveCamera(),
    b = new THREE.PerspectiveCamera();
  const ca = createPadelCamera(a),
    cb = createPadelCamera(b);
  ca.update(0, state("broadcast"));
  cb.update(0, state("broadcast"));
  ca.update(100, state("first-person"));
  cb.update(0.1, state("first-person"));
  assert.deepEqual(a.position.toArray(), b.position.toArray());
  close(a.fov, b.fov);
  const before = a.position.clone();
  ca.update(NaN, state("first-person"));
  assert.deepEqual(a.position.toArray(), before.toArray());
  ca.reset();
  ca.update(0, state("first-person"));
  assert.ok(
    a.position.distanceTo(
      calculatePadelCameraPose(state("first-person")).position
    ) < 1e-8
  );
});

test("a paused resize snap updates adaptive FOV and the projection immediately", () => {
  for (const mode of ["courtside", "first-person"]) {
    const camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.1, 240);
    const controller = createPadelCamera(camera);
    controller.update(0, state(mode));
    const landscapeFov = camera.fov;
    const resized = state(mode, { aspect: 0.55 });
    // A stopped render loop provides no future dt to finish FOV smoothing.
    // Resize callers must request the same snap used by paused mode switches.
    controller.update(0, resized, true);
    const expected = calculatePadelCameraPose(resized);
    close(camera.aspect, 0.55);
    close(camera.fov, expected.fov);
    assert.ok(camera.fov > landscapeFov);
    const target = new THREE.Vector3(2.5, 0, -8);
    const pointer = target.clone().project(camera);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(pointer.x, pointer.y), camera);
    const hit = ray.ray.intersectPlane(
      new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
      new THREE.Vector3()
    );
    assert.ok(
      hit.distanceTo(target) < 1e-8,
      "court mouse aiming must use the resized projection"
    );
  }
});
