import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createPadelVisit, padelPositionAllowed } from "./visit.js";
import {
  createPadelTravel,
  mapPadelTravelView,
  findPadelTravelLanding,
  capturePadelTravelView,
  PADEL_TRAVEL_TIMING,
} from "./travel.js";
const source = {
  cameraOffset: { x: 3.1, y: 2.5, z: -5.2 },
  cameraTargetOffset: { x: 0.3, y: 1.1, z: 0.1 },
  avatarRotation: 0.6,
  avatarLift: 0.16,
  avatarHeight: 1.96,
  fov: 61,
  cameraMode: "third-person",
};
function setup(options = {}) {
  const camera = new THREE.PerspectiveCamera(
    58,
    options.aspect || 16 / 9,
    0.1,
    1000
  );
  const canvas = { addEventListener() {}, removeEventListener() {} };
  const visit = createPadelVisit({ camera, canvas, random: () => 0.5 });
  visit.update(0);
  const travel = createPadelTravel({ camera, visit });
  return { camera, visit, travel };
}
function advance(travel, seconds) {
  const count = Math.ceil(seconds * 120);
  for (let i = 0; i < count; i++) travel.update(seconds / count);
}
const close = (a, b, epsilon = 1e-8) =>
  assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
function sameCamera(camera, position, quaternion, fov) {
  assert.ok(camera.position.distanceTo(position) < 1e-8);
  assert.ok(camera.quaternion.angleTo(quaternion) < 1e-7);
  close(camera.fov, fov);
}

test("incoming framing preserves projected avatar markers across heights, heading, target offsets and aspect ratios", () => {
  for (const height of [0.9, 1.78, 2.5])
    for (const aspect of [0.65, 16 / 9, 2.4]) {
      const { camera, travel } = setup({ aspect });
      const incoming = new THREE.PerspectiveCamera(
        source.fov,
        aspect,
        0.1,
        1000
      );
      incoming.position.set(...Object.values(source.cameraOffset));
      incoming.lookAt(...Object.values(source.cameraTargetOffset));
      incoming.updateMatrixWorld(true);
      const state = travel.prepare({
        travelView: source,
        avatarHeight: height,
      });
      for (const local of [
        [0, 0, 0],
        [0, source.avatarHeight, 0],
        [-0.28, 0.95, 0.18],
        [0.35, 0.85, -0.15],
      ]) {
        const marker = new THREE.Vector3(...local).applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          source.avatarRotation
        );
        const before = marker
          .clone()
          .add(new THREE.Vector3(0, source.avatarLift, 0))
          .project(incoming);
        const after = marker
          .clone()
          .multiplyScalar(height / source.avatarHeight)
          .add(
            new THREE.Vector3(state.anchor.x, state.player.y, state.anchor.z)
          )
          .project(camera);
        close(before.x, after.x);
        close(before.y, after.y);
      }
    }
});

test("hidden staging never consumes reveal time and incoming camera stays locked through world appearance", () => {
  const { camera, visit, travel } = setup();
  travel.prepare({ travelView: source });
  const position = camera.position.clone(),
    quaternion = camera.quaternion.clone(),
    fov = camera.fov;
  advance(travel, 8);
  assert.equal(travel.state.phase, "staged");
  assert.equal(travel.state.worldProgress, 0);
  travel.startReveal();
  for (let i = 0; i < 100; i++) {
    visit.update(1 / 60, new Set(["KeyW", "Space"]));
    travel.update(1 / 60);
    sameCamera(camera, position, quaternion, fov);
  }
  assert.equal(visit.state.speed, 0);
  assert.equal(visit.state.y, 0);
  assert.equal(travel.state.player.travelPose.name, "TRAVEL_CROUCH_IDLE");
  assert.equal(travel.state.phase, "revealing");
  assert.equal(travel.state.locked, true);
  const progress = travel.state.worldProgress;
  travel.startReveal();
  assert.equal(
    travel.state.worldProgress,
    progress,
    "duplicate reveal messages must not restart it"
  );
});

test("stand and rear camera handoff begin together after 1.8s, then release at 2.98s without a follow-camera jump", () => {
  const { camera, visit, travel } = setup();
  travel.prepare({ travelView: source });
  const initialPosition = camera.position.clone(),
    initialQuaternion = camera.quaternion.clone(),
    fov = camera.fov;
  travel.startReveal();
  advance(travel, 1.8 + 1e-9);
  assert.equal(travel.state.phase, "handoff");
  assert.equal(travel.state.player.travelPose.name, "TRAVEL_STAND_UP");
  close(travel.state.player.travelPose.blend, 0);
  sameCamera(camera, initialPosition, initialQuaternion, fov);
  advance(travel, 0.05);
  close(travel.state.player.travelPose.blend, 0.5, 1e-6);
  assert.equal(
    travel.state.player.travelPose.previous.name,
    "TRAVEL_CROUCH_IDLE"
  );
  assert.ok(camera.position.distanceTo(initialPosition) > 0.001);
  advance(travel, 0.95);
  assert.equal(travel.state.player.travelPose.name, "IDLE_CC0");
  assert.equal(travel.state.player.travelPose.previous.name, "TRAVEL_STAND_UP");
  assert.equal(travel.state.locked, true);
  advance(travel, 0.18);
  assert.equal(travel.state.phase, "ready");
  assert.equal(travel.state.done, true);
  assert.equal(travel.state.locked, false);
  close(travel.state.player.y, 0);
  const finalPosition = camera.position.clone(),
    finalQuaternion = camera.quaternion.clone();
  visit.update(1 / 60);
  sameCamera(camera, finalPosition, finalQuaternion, 58);
  visit.update(1 / 60, new Set(["KeyW"]));
  assert.ok(visit.state.speed > 0);
});

test("the handoff orbits around the avatar instead of cutting through its body", () => {
  const { camera, travel } = setup();
  travel.prepare({
    travelView: {
      ...source,
      avatarRotation: Math.PI,
      cameraOffset: { x: 0, y: 2.5, z: -6 },
      cameraTargetOffset: { x: 0, y: 1.3, z: 0 },
    },
  });
  travel.startReveal();
  advance(travel, 1.8);
  for (let i = 0; i < 150; i++) {
    travel.update(1 / 120);
    assert.ok(
      Math.hypot(
        camera.position.x - travel.state.anchor.x,
        camera.position.z - travel.state.anchor.z
      ) > 4
    );
  }
});

test("ready idle continues its authored phase until movement, jumping or a social emote", () => {
  const { travel, visit } = setup();
  travel.prepare({ travelView: source });
  travel.startReveal();
  advance(travel, 3);
  const idle = travel.state.player.travelIdleTime;
  travel.update(0.05);
  assert.ok(travel.state.player.travelIdleTime > idle);
  travel.releaseReadyIdle();
  travel.update(0);
  assert.equal(travel.state.player.animationMode, "visit");
  travel.prepare({ travelView: source });
  travel.startReveal();
  advance(travel, 3);
  visit.update(0.05, new Set(["Space"]));
  travel.update(0.05);
  assert.equal(travel.state.player.animationMode, "visit");
});

test("group slots are grounded and corrected only when they overlap an actual collider or fence", () => {
  const valid = findPadelTravelLanding({
    spawnOffset: { x: 1.5, y: 3, z: -0.3 },
  });
  assert.deepEqual(valid, { x: 1.5, y: 0, z: 10.5 });
  for (const anchor of [
    { x: 0, y: 0, z: 0 },
    { x: 1.5, y: 0, z: 10 },
    { x: -9.7, y: 1, z: 4 },
    { x: 50, y: 0, z: 90 },
  ]) {
    const placed = findPadelTravelLanding(null, anchor);
    assert.equal(padelPositionAllowed(placed.x, placed.z), true);
    assert.equal(placed.y, 0);
  }
  const { travel, visit } = setup();
  travel.prepare({
    travelView: { ...source, spawnOffset: { x: 2, y: 1, z: 1 } },
  });
  close(visit.state.x, (2 * 1.78) / source.avatarHeight);
  close(visit.state.z, 10.8 + 1.78 / source.avatarHeight);
});

test("invalid framing is rejected and fallback staging, hostile deltas and capture stay finite", () => {
  for (const change of [
    { fov: NaN },
    { fov: 180 },
    { avatarRotation: Infinity },
    { cameraOffset: { x: NaN, y: 1, z: 3 } },
  ])
    assert.equal(mapPadelTravelView({ ...source, ...change }), null);
  const { camera, travel, visit } = setup();
  travel.prepare({ travelView: { ...source, fov: Infinity } });
  travel.startReveal();
  travel.update(NaN);
  travel.update(-3);
  travel.update(Infinity);
  assert.equal(travel.state.worldProgress, 0);
  travel.update(100);
  close(travel.state.worldProgress, 0.1 / PADEL_TRAVEL_TIMING.reveal);
  assert.ok(camera.position.toArray().every(Number.isFinite));
  const captured = capturePadelTravelView(camera, visit.state);
  assert.equal(captured.avatarIdleTime, 0);
  assert.ok(mapPadelTravelView(captured));
});

test("reduced motion still stages exact framing before visibly revealing and releasing in one frame", () => {
  const { camera, travel, visit } = setup();
  travel.prepare({ travelView: source, reducedMotion: true });
  const initial = camera.position.clone();
  advance(travel, 1);
  assert.equal(travel.state.phase, "staged");
  assert.equal(travel.state.player.travelPose.name, "IDLE_CC0");
  assert.equal(camera.position.distanceTo(initial), 0);
  travel.startReveal();
  travel.update(0);
  assert.equal(travel.state.phase, "ready");
  assert.equal(travel.state.worldProgress, 1);
  assert.equal(travel.state.locked, false);
  visit.update(0);
  assert.equal(camera.fov, 58);
});

test("departure crouches over the reverse reveal, preserves its camera, then holds until parent acknowledges the frame", () => {
  const { travel, camera, visit } = setup();
  const before = camera.position.clone(),
    quaternion = camera.quaternion.clone(),
    fov = camera.fov;
  travel.startDepart();
  assert.equal(travel.state.phase, "departing");
  assert.equal(travel.state.player.travelPose.name, "TRAVEL_CROUCH_DOWN");
  advance(travel, 1.1 + 1e-8);
  assert.equal(travel.state.phase, "departed");
  assert.equal(travel.state.worldProgress, 0);
  assert.equal(travel.state.done, true);
  assert.equal(travel.state.locked, true);
  assert.equal(travel.state.player.travelPose.name, "TRAVEL_CROUCH_IDLE");
  visit.update(1 / 60, new Set(["KeyD"]));
  travel.update(1 / 60);
  assert.equal(visit.state.speed, 0);
  sameCamera(camera, before, quaternion, fov);
  const view = travel.capture();
  const reconstructed = new THREE.PerspectiveCamera(
    view.fov,
    camera.aspect,
    0.1,
    1000
  );
  reconstructed.position.set(
    view.cameraOffset.x + visit.state.x,
    view.cameraOffset.y,
    view.cameraOffset.z + visit.state.z
  );
  reconstructed.lookAt(
    view.cameraTargetOffset.x + visit.state.x,
    view.cameraTargetOffset.y,
    view.cameraTargetOffset.z + visit.state.z
  );
  reconstructed.updateMatrixWorld(true);
  sameCamera(reconstructed, before, quaternion, fov);
  travel.cancel();
  visit.update(0.05, new Set(["KeyD"]));
  assert.ok(visit.state.speed > 0);
});

test("travel locks do not override a social input lock when the camera is handed back", () => {
  const { travel, visit } = setup();
  visit.setEnabled(false);
  travel.prepare({ travelView: source });
  travel.startReveal();
  advance(travel, 3);
  visit.update(0.05, new Set(["KeyW"]));
  assert.equal(visit.state.speed, 0);
  visit.setEnabled(true);
  visit.update(0.05, new Set(["KeyW"]));
  assert.ok(visit.state.speed > 0);
});

test("VRM0 imported yaw is corrected once while native return capture removes that correction", () => {
  const { travel, visit } = setup();
  travel.prepare({ travelView: source, travelYawOffset: Math.PI });
  close(Math.cos(visit.state.yaw), Math.cos(source.avatarRotation + Math.PI));
  close(Math.sin(visit.state.yaw), Math.sin(source.avatarRotation + Math.PI));
  const captured = travel.capture();
  close(captured.avatarRotation, source.avatarRotation);
  travel.startReveal();
  advance(travel, 3);
  assert.equal(visit.state.travelReadyIdle, true);
  assert.ok(visit.state.travelIdleTime >= 0.18);
  travel.startDepart();
  advance(travel, 1.2);
  close(travel.capture().avatarRotation, source.avatarRotation);
  travel.releaseReadyIdle();
  assert.equal(visit.state.travelReadyIdle, false);
});

test("first-person departure keeps the held eye framing and marks its captured return view correctly", () => {
  const { camera, travel, visit } = setup();
  visit.place({ x: 0, z: 12, yaw: Math.PI });
  camera.position.set(0, 1.602, 11.88);
  camera.lookAt(0.3, 1.1, -6);
  camera.fov = 66;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  const position = camera.position.clone(),
    quaternion = camera.quaternion.clone();
  travel.startDepart({ cameraMode: "first-person", travelYawOffset: Math.PI });
  assert.equal(travel.state.view.cameraMode, "first-person");
  assert.equal(travel.capture().cameraMode, "first-person");
  advance(travel, 1.2);
  sameCamera(camera, position, quaternion, 66);
  assert.equal(travel.capture().cameraMode, "first-person");
  travel.cancel();
  assert.equal(travel.capture().cameraMode, "third-person");
});
