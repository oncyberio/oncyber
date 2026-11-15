import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import {
  courtMovement,
  createCourtLocomotion,
  createLocalViewVisibility,
  createRacketPresentation,
} from "./locomotion.js";
import { createPadelMotion } from "./animation-clips.js";

test("four-way movement blends diagonals and never turns a backpedal away from the court", () => {
  for (const yaw of [0, Math.PI]) {
    const world = (x, z) =>
      courtMovement(
        x * Math.cos(yaw) + z * Math.sin(yaw),
        -x * Math.sin(yaw) + z * Math.cos(yaw),
        yaw
      );
    assert.ok(world(0, 5.4).weights.forward > 0.999);
    assert.ok(world(0, -6.6).weights.back > 0.999);
    assert.ok(Math.abs(world(0, -6.6).facing) < 1e-7);
    assert.ok(world(-5.4, 0).weights.left > 0.999);
    assert.ok(world(5.4, 0).weights.right > 0.999);
    const diagonal = world(3, -3);
    assert.ok(
      Math.abs(diagonal.weights.right - 0.5) < 1e-7 &&
        Math.abs(diagonal.weights.back - 0.5) < 1e-7
    );
    for (let a = -Math.PI; a < Math.PI; a += 0.02) {
      const first = world(Math.sin(a) * 6.6, Math.cos(a) * 6.6);
      const next = world(Math.sin(a + 0.02) * 6.6, Math.cos(a + 0.02) * 6.6);
      assert.ok(Math.abs(first.facing) <= 0.42);
      assert.ok(
        Math.abs(first.facing - next.facing) < 0.02,
        "diagonal facing cannot snap at cardinal boundaries"
      );
    }
  }
});

test("first-person hides only the body and restores its exact previous visibility", () => {
  const root = new THREE.Group(),
    body = new THREE.Group(),
    racket = new THREE.Group();
  root.add(body, racket);
  const visibility = createLocalViewVisibility(body);
  visibility.set(true);
  assert.equal(body.visible, false);
  assert.equal(root.visible, true);
  assert.equal(racket.visible, true);
  visibility.set(true);
  visibility.set(false);
  assert.equal(body.visible, true);
  body.visible = false;
  visibility.set(true);
  visibility.set(false);
  assert.equal(
    body.visible,
    false,
    "exit must not reveal a body that was already hidden"
  );
});

test("first-person racket reveals its face, preserves relative swings, and restores the exact normal mount", () => {
  const camera = new THREE.PerspectiveCamera(66, 16 / 9, 0.045, 100);
  camera.position.set(0, 1.602, 0.12);
  camera.lookAt(0, 1.05, 20);
  camera.updateMatrixWorld(true);
  for (const legacy of [false, true]) {
    const mount = new THREE.Group();
    const presentation = createRacketPresentation(mount, legacy);
    let previousNatural, previousPresented;
    for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      mount.position.set(-0.5, 0.75, -0.2);
      mount.quaternion.setFromEuler(
        new THREE.Euler(angle, angle / 2, angle / 3)
      );
      const naturalPosition = mount.position.clone(),
        naturalRotation = mount.quaternion.clone();
      presentation.update(true);
      const center = new THREE.Vector3(legacy ? 0.485 : -0.485, 0, 0)
        .multiply(mount.scale)
        .applyQuaternion(mount.quaternion)
        .add(mount.position)
        .project(camera);
      assert.ok(
        Math.abs(center.x) < 1 &&
          Math.abs(center.y) < 1 &&
          Math.abs(center.z) < 1,
        "the racket head should remain near the lower edge, rather than behind the camera"
      );
      if (previousNatural) {
        const nativeDelta = naturalRotation
          .clone()
          .multiply(previousNatural.clone().invert());
        const presentedDelta = mount.quaternion
          .clone()
          .multiply(previousPresented.clone().invert());
        assert.ok(
          nativeDelta.angleTo(presentedDelta) < 1e-7,
          "a fixed grip roll must preserve the captured relative swing rotation"
        );
      }
      previousNatural = naturalRotation.clone();
      previousPresented = mount.quaternion.clone();
      presentation.restore();
      assert.ok(mount.position.equals(naturalPosition));
      assert.ok(mount.quaternion.equals(naturalRotation));
      assert.ok(mount.scale.equals(new THREE.Vector3(1, 1, 1)));
    }
  }
});

test("real avatar uses planted steps in all four directions with bounded transitions and no root mutation", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => ({
    ok: true,
    json: async () => JSON.parse(await readFile(url, "utf8")),
  });
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  const data = await readFile(
    new URL("../../../frontend/public/models/pfp.vrm", import.meta.url)
  );
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  const gltf = await loader.parseAsync(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    ""
  );
  const vrm = gltf.userData.vrm;
  VRMUtils.rotateVRM0(vrm);
  const actor = new THREE.Group();
  actor.add(vrm.scene);
  actor.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(vrm.scene);
  vrm.scene.scale.multiplyScalar(1.78 / (bounds.max.y - bounds.min.y));
  actor.updateMatrixWorld(true);
  bounds.setFromObject(vrm.scene);
  vrm.scene.position.y -= bounds.min.y;
  actor.rotation.y = Math.PI;
  actor.updateMatrixWorld(true);
  const motion = await createPadelMotion(vrm);
  const locomotion = createCourtLocomotion(vrm, actor);
  motion.update(0, { action: "idle" });
  vrm.scene.updateWorldMatrix(true, true);
  const rightHand = vrm.humanoid.getNormalizedBoneNode("rightHand");
  const firstPersonMount = new THREE.Group();
  firstPersonMount.position.copy(
    actor.worldToLocal(rightHand.getWorldPosition(new THREE.Vector3()))
  );
  firstPersonMount.quaternion
    .copy(rightHand.getWorldQuaternion(new THREE.Quaternion()))
    .premultiply(actor.getWorldQuaternion(new THREE.Quaternion()).invert());
  const racketView = createRacketPresentation(
    firstPersonMount,
    vrm.meta?.metaVersion === "0"
  );
  function visibleFace() {
    const center = new THREE.Vector3(
      vrm.meta?.metaVersion === "0" ? 0.485 : -0.485,
      0,
      0
    )
      .multiply(firstPersonMount.scale)
      .applyQuaternion(firstPersonMount.quaternion)
      .add(firstPersonMount.position);
    const viewer = new THREE.Vector3(0, 1.602, 0.12).sub(center).normalize();
    return Math.abs(
      new THREE.Vector3(0, 0, 1)
        .applyQuaternion(firstPersonMount.quaternion)
        .dot(viewer)
    );
  }
  racketView.update(true);
  assert.ok(
    visibleFace() > 0.45,
    `the real avatar's idle racket should reveal its string bed, face visibility=${visibleFace()}`
  );
  const bones = Object.values(vrm.humanoid.normalizedHumanBones).map(
    ({ node }) => node
  );
  const feet = ["leftFoot", "rightFoot"].map((name) =>
    vrm.humanoid.getNormalizedBoneNode(name)
  );
  let base, previousFeet, previousStance, previousPose;
  t.after(() => {
    motion.dispose();
    VRMUtils.deepDispose(actor);
  });
  const dt = 1 / 60;
  let maxSlip = 0,
    maxSlipInfo = "",
    stanceSamples = 0,
    maxAngle = 0,
    maxAngleInfo = "";
  let vx = 0,
    vz = 0;
  for (const [targetX, targetZ] of [
    [0, -2.4],
    [0, 2.4],
    [-2.4, 0],
    [2.4, 0],
    [0, -5.4],
    [0, 5.4],
    [-5.4, 0],
    [5.4, 0],
    [3.8, 3.8],
    [-3.8, -3.8],
  ]) {
    for (let i = 0; i < 90; i++) {
      // Match the movement controller's real acceleration through reversals.
      vx += (targetX - vx) * (1 - Math.exp(-17 * dt));
      vz += (targetZ - vz) * (1 - Math.exp(-17 * dt));
      if (base)
        bones.forEach((node, j) => {
          node.position.copy(base[j].p);
          node.quaternion.copy(base[j].q);
        });
      actor.position.x += vx * dt;
      actor.position.z += vz * dt;
      const rootPosition = actor.position.clone();
      const rootRotation = actor.quaternion.clone();
      const speed = Math.hypot(vx, vz);
      motion.update(
        dt,
        { action: "run", vx, vz, yaw: Math.PI },
        speed,
        speed * dt
      );
      base = bones.map((node) => ({
        p: node.position.clone(),
        q: node.quaternion.clone(),
      }));
      locomotion.update(dt, { vx, vz, yaw: Math.PI }, speed);
      assert.ok(
        actor.position.equals(rootPosition) &&
          actor.quaternion.equals(rootRotation),
        "directional gait cannot move or turn the physics root"
      );
      assert.ok(
        bones.every((node) => node.quaternion.toArray().every(Number.isFinite))
      );
      const locations = feet.map((node) =>
        node.getWorldPosition(new THREE.Vector3())
      );
      const state = locomotion.state;
      if (i > 15 && previousFeet && state.weight > 0.99) {
        feet.forEach((_, j) => {
          if (state.stance[j] && previousStance[j]) {
            const slip = locations[j].distanceTo(previousFeet[j]);
            if (slip > maxSlip) {
              maxSlip = slip;
              maxSlipInfo = JSON.stringify({
                vx,
                vz,
                phase: state.phase,
                foot: j,
                root: actor.position.toArray(),
                at: locations[j].toArray(),
              });
            }
            stanceSamples++;
          }
        });
      }
      if (previousPose)
        bones.forEach((node, j) => {
          const angle = node.quaternion.angleTo(previousPose[j]);
          if (angle > maxAngle) {
            maxAngle = angle;
            maxAngleInfo = JSON.stringify({
              node: node.name,
              vx,
              vz,
              frame: i,
            });
          }
        });
      previousFeet = locations;
      previousStance = state.stance;
      previousPose = bones.map((node) => node.quaternion.clone());
    }
  }
  assert.ok(stanceSamples > 300);
  t.diagnostic(
    `stance samples=${stanceSamples}, maximum slip=${maxSlip.toFixed(
      4
    )}m, maximum joint step=${maxAngle.toFixed(3)}rad ${maxAngleInfo}`
  );
  assert.ok(
    maxSlip < 0.055,
    `planted foot slipped ${maxSlip}m in one frame ${maxSlipInfo}`
  );
  assert.ok(
    maxAngle < 0.42,
    `a direction change snapped a joint by ${maxAngle}rad ${maxAngleInfo}`
  );
  const pausedPose = bones.map((node) => node.quaternion.clone());
  bones.forEach((node, j) => {
    node.position.copy(base[j].p);
    node.quaternion.copy(base[j].q);
  });
  locomotion.update(
    0,
    { vx: -3.8, vz: -3.8, yaw: Math.PI },
    Math.hypot(3.8, 3.8)
  );
  assert.ok(
    bones.every((node, i) =>
      node.quaternion
        .toArray()
        .every(
          (value, j) => Math.abs(value - pausedPose[i].toArray()[j]) < 1e-8
        )
    ),
    "pause preserves the directional foot pose"
  );
  for (let i = 0; i < 75; i++) {
    vx *= Math.exp(-17 * dt);
    vz *= Math.exp(-17 * dt);
    bones.forEach((node, j) => {
      node.position.copy(base[j].p);
      node.quaternion.copy(base[j].q);
    });
    actor.position.x += vx * dt;
    actor.position.z += vz * dt;
    const speed = Math.hypot(vx, vz);
    motion.update(
      dt,
      { action: "idle", vx, vz, yaw: Math.PI },
      speed,
      speed * dt
    );
    base = bones.map((node) => ({
      p: node.position.clone(),
      q: node.quaternion.clone(),
    }));
    locomotion.update(dt, { vx, vz, yaw: Math.PI }, speed);
    assert.ok(
      bones.every((node, j) => node.quaternion.angleTo(previousPose[j]) < 0.42),
      "stopping must fade foot orientation into the captured ready stance without a final pop"
    );
    previousPose = bones.map((node) => node.quaternion.clone());
  }
  assert.equal(locomotion.state.active, false);
  assert.ok(
    bones.every((node, i) => node.quaternion.equals(base[i].q)),
    "idle fully retires the directional leg correction"
  );
});
