import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import {
  createPadelMotion,
  createPadelFootwork,
  createPadelReach,
} from "./animation-clips.js";
import { createMatch } from "./simulation.js";

test("padel strokes retarget on the real avatar, preserve the physics root, and retire unused clips", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => ({
    ok: true,
    json: async () => JSON.parse(await readFile(url, "utf8")),
  });
  const originalAction = THREE.AnimationMixer.prototype.clipAction;
  const actions = new Map();
  THREE.AnimationMixer.prototype.clipAction = function (clip, ...args) {
    const action = originalAction.call(this, clip, ...args);
    actions.set(clip.name, action);
    return action;
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    THREE.AnimationMixer.prototype.clipAction = originalAction;
  });
  // The site's own texture-free avatar: Padel bundles no fallback avatar.
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
  const motion = await createPadelMotion(vrm);
  t.after(() => {
    motion.dispose();
    VRMUtils.deepDispose(vrm.scene);
  });
  const bones = Object.values(vrm.humanoid.normalizedHumanBones).map(
    ({ node }) => node
  );
  let clean = bones.map((node) => ({
    p: node.position.clone(),
    q: node.quaternion.clone(),
  }));
  const hips = vrm.humanoid.getNormalizedBoneNode("hips");
  const origin = hips.position.clone();
  function tick(state = {}, speed = 0, dt = 1 / 60) {
    bones.forEach((node, i) => {
      node.position.copy(clean[i].p);
      node.quaternion.copy(clean[i].q);
    });
    motion.update(
      dt,
      { action: "idle", grounded: true, ...state },
      speed,
      speed * dt
    );
    clean = bones.map((node) => ({
      p: node.position.clone(),
      q: node.quaternion.clone(),
    }));
    vrm.update(dt);
    vrm.scene.updateMatrixWorld(true);
    for (const node of bones) {
      assert.ok(node.position.toArray().every(Number.isFinite));
      assert.ok(node.quaternion.toArray().every(Number.isFinite));
    }
    assert.ok(Math.abs(hips.position.x - origin.x) < 1e-7);
    assert.ok(Math.abs(hips.position.z - origin.z) < 1e-7);
  }
  function settle(state = {}, speed = 0) {
    for (let i = 0; i < 90; i++) tick(state, speed);
  }
  settle();
  const idlePose = vrm.humanoid
    .getNormalizedBoneNode("rightHand")
    .quaternion.toArray();
  for (let i = 0; i < 12; i++) tick({}, 0, 0);
  assert.deepEqual(
    vrm.humanoid.getNormalizedBoneNode("rightHand").quaternion.toArray(),
    idlePose,
    "paused samples cannot revert to bind pose"
  );
  for (const stroke of ["forehand", "backhand", "serve", "smash"]) {
    settle({ charge: 0.9, padelStroke: stroke });
    const beforeContact = actions.get(`padel-${stroke}:upper`).time;
    const beforePose = bones.map((node) => node.quaternion.clone());
    tick({ action: stroke, padelStroke: stroke, strokeProgress: 0 });
    assert.ok(
      actions.get(`padel-${stroke}:upper`).time - beforeContact <= 0.101,
      "release must advance through the capture, not jump over its forward swing"
    );
    assert.ok(
      bones.every((node, i) => node.quaternion.angleTo(beforePose[i]) < 0.65),
      `${stroke} release must not snap a joint across its backswing`
    );
    assert.equal(motion.mode, `${stroke}-followthrough`);
    for (let i = 0; i < 32; i++)
      tick(
        { action: stroke, padelStroke: stroke, strokeProgress: i / 32 },
        stroke === "serve" ? 0 : 3.8
      );
    settle();
  }
  const sampled = [...actions].filter(
    ([, action]) => action.getEffectiveWeight() > 0
  );
  assert.deepEqual(
    sampled.map(([name]) => name),
    ["padel-ready:upper", "padel-ready:lower"]
  );
  assert.ok(sampled.every(([, action]) => action.getEffectiveWeight() === 1));
  settle({ charge: 0.9, padelStroke: "backhand" }, 5.4);
  assert.ok(actions.get("padel-backhand:upper").getEffectiveWeight() > 0.99);
  assert.ok(
    actions.get("run:lower").getEffectiveWeight() > 0.8,
    "a moving swing keeps the native running feet"
  );
  motion.reset();
  tick();
  assert.equal(motion.mode, "ready");
  settle({ charge: 0.8, preparedStroke: "forehand" });
  tick({ charge: 0.81, preparedStroke: "backhand" });
  assert.equal(
    motion.mode,
    "forehand-prepare",
    "the chosen backswing stays stable while charging"
  );
  const acquiredPose = bones.map((node) => node.quaternion.clone());
  tick({
    charge: 0.82,
    preparedStroke: "smash",
    contactTimeToHit: 0.35,
    assistContact: { x: 0, y: 2.7, z: -0.38 },
  });
  assert.equal(
    motion.mode,
    "smash-prepare",
    "a confirmed overhead can replace an early groundstroke before contact"
  );
  assert.ok(
    bones.every((node, i) => node.quaternion.angleTo(acquiredPose[i]) < 0.65),
    "acquiring an overhead crossfades instead of snapping the arm at launch"
  );
  settle();
  tick({
    preparedStroke: "smash",
    contactTimeToHit: 0.3,
    assistContact: { x: 0, y: 2.7, z: -0.38 },
  });
  assert.equal(
    motion.mode,
    "smash-prepare",
    "NPC overhead approach uses the same windup with no human charge"
  );
  settle();
  settle({ charge: 0.8, preparedStroke: "forehand" });
  tick({ charge: 0.82, preparedStroke: "forehand", assistActive: true }, 2);
  for (let i = 0; i < 60; i++)
    tick({ charge: 0.9, preparedStroke: "forehand", assistActive: true }, 2);
  assert.equal(
    actions.get("run:lower").getEffectiveWeight(),
    0,
    "a short sideways adjustment cannot play a forward run underneath the racket pose"
  );
  settle();
  motion.reset();
  for (let i = 0; i < 18; i++)
    tick({
      swingPending: true,
      charge: 0,
      preparedStroke: "backhand",
      contactTimeToHit: 0.4 - i / 60,
    });
  assert.equal(
    motion.mode,
    "backhand-prepare",
    "a queued control shot must hold its backswing with no power charge"
  );
  assert.ok(actions.get("padel-backhand:upper").getEffectiveWeight() > 0.95);
  tick({ action: "backhand", padelStroke: "backhand", strokeProgress: 0 });
  assert.equal(motion.mode, "backhand-followthrough");
  settle();
  assert.ok(
    actions.get("padel-ready:upper").getEffectiveWeight() === 1,
    "contact and recovery retire a pending swing without leaving a held arm pose"
  );
  // Drive an actual incoming passage while the player runs across its line.
  // The manual forecast switches hand before release, so the capture must
  // acquire that backswing before the committed ball reaches the paddle.
  const match = createMatch();
  match.start();
  match.phase = "rally";
  Object.assign(match.players[0], { x: 0, z: 9 });
  Object.assign(match.ball, {
    x: 0.6,
    y: 1.2,
    z: 4.3,
    vx: 0,
    vy: 3.8,
    vz: 6,
    active: true,
    lastHit: 1,
    bounces: 1,
    isServe: false,
  });
  motion.reset();
  tick(match.players[0], 0, 0);
  let manualSwitch = false,
    shot = null,
    maximumStep = 0,
    maximumStepAt = "";
  for (let frame = 0; frame < 110 && !shot; frame++) {
    const input =
      frame < 44
        ? { powerHeld: true, moveX: frame < 32 ? 1 : 0 }
        : frame === 44
        ? { powerReleased: true }
        : {};
    match.update(1 / 120, input);
    const player = match.players[0];
    const before = bones.map((node) => node.quaternion.clone());
    tick(player, Math.hypot(player.vx, player.vz), 1 / 120);
    bones.forEach((node, i) => {
      const step = node.quaternion.angleTo(before[i]);
      if (step > maximumStep) {
        maximumStep = step;
        maximumStepAt = `${node.name} frame ${frame} ${motion.mode}`;
      }
    });
    if (frame === 43) {
      assert.equal(player.preparedStroke, "backhand");
      assert.equal(
        motion.mode,
        "backhand-prepare",
        "crossing the incoming ball must acquire the backhand before release"
      );
      assert.ok(actions.get("padel-backhand:upper").getEffectiveWeight() > 0.7);
      manualSwitch = true;
    }
    shot = match
      .consumeEvents()
      .find((event) => event.type === "shot" && event.playerIndex === 0);
  }
  assert.ok(manualSwitch && shot);
  assert.equal(shot.stroke, "backhand");
  assert.equal(motion.mode, "backhand-followthrough");
  assert.ok(
    maximumStep < 0.65,
    `manual hand changes must crossfade without a joint snap (${maximumStep} ${maximumStepAt})`
  );
  for (const blocked of [
    { manualPreparation: false, contactTimeToHit: 0.6 },
    { manualPreparation: true, contactTimeToHit: 0.1 },
    { manualPreparation: true, contactTimeToHit: 0.6, swingPending: true },
  ]) {
    motion.reset();
    settle({ charge: 0.8, preparedStroke: "forehand" });
    for (let frame = 0; frame < 25; frame++)
      tick({ charge: 0.8, preparedStroke: "backhand", ...blocked });
    assert.equal(
      motion.mode,
      "forehand-prepare",
      "automatic, late and committed approaches retain the existing stroke latch"
    );
  }
});

test("short preparation steps plant the supporting foot without moving or stretching the avatar root", async (t) => {
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
  const motion = await createPadelMotion(vrm);
  const footwork = createPadelFootwork(vrm);
  t.after(() => {
    motion.dispose();
    VRMUtils.deepDispose(vrm.scene);
  });
  const bones = Object.values(vrm.humanoid.normalizedHumanBones).map(
    ({ node }) => node
  );
  let pose;
  const leftFoot = vrm.humanoid.getNormalizedBoneNode("leftFoot");
  const rightFoot = vrm.humanoid.getNormalizedBoneNode("rightFoot");
  const root = vrm.scene;
  for (let i = 0; i < 60; i++)
    motion.update(1 / 60, { charge: 0.8, preparedStroke: "forehand" });
  root.updateWorldMatrix(true, true);
  const initialLeft = leftFoot.getWorldPosition(new THREE.Vector3());
  const initialRight = rightFoot.getWorldPosition(new THREE.Vector3());
  let maxDrift = 0;
  for (let i = 0; i < 15; i++) {
    if (pose)
      bones.forEach((node, j) => {
        node.position.copy(pose[j].p);
        node.quaternion.copy(pose[j].q);
      });
    root.position.x = i / 60;
    const expectedRoot = root.position.clone();
    const preparation =
      i < 7 ? { charge: 0.8 } : { charge: 0, swingPending: true };
    motion.update(
      1 / 60,
      { ...preparation, preparedStroke: "forehand", assistActive: true },
      1,
      1 / 60
    );
    pose = bones.map((node) => ({
      p: node.position.clone(),
      q: node.quaternion.clone(),
    }));
    footwork.update(1 / 60, {
      ...preparation,
      assistActive: true,
      vx: 1,
      vz: 0,
    });
    assert.ok(
      root.position.equals(expectedRoot),
      "IK must never move the simulation root"
    );
    maxDrift = Math.max(
      maxDrift,
      leftFoot.getWorldPosition(new THREE.Vector3()).distanceTo(initialLeft)
    );
    for (const side of ["left", "right"]) {
      for (const name of ["UpperLeg", "LowerLeg", "Foot"])
        assert.ok(
          vrm.humanoid
            .getNormalizedBoneNode(side + name)
            .quaternion.toArray()
            .every(Number.isFinite)
        );
    }
  }
  assert.ok(
    maxDrift < 0.06,
    `supporting foot should stay planted during 23cm of movement, drift=${maxDrift}`
  );
  assert.ok(
    rightFoot.getWorldPosition(new THREE.Vector3()).y < initialLeft.y + 0.12,
    "adjustment steps stay low, rather than bouncing the avatar into the air"
  );
  const pausedFeet = [leftFoot, rightFoot].map((node) =>
    node.getWorldPosition(new THREE.Vector3())
  );
  bones.forEach((node, j) => {
    node.position.copy(pose[j].p);
    node.quaternion.copy(pose[j].q);
  });
  footwork.update(0, { charge: 0.8, assistActive: true, vx: 1, vz: 0 });
  for (const [i, node] of [leftFoot, rightFoot].entries())
    assert.ok(
      node.getWorldPosition(new THREE.Vector3()).distanceTo(pausedFeet[i]) <
        1e-8,
      "paused rendering preserves the planted pose instead of reverting to capture feet"
    );
  for (let i = 0; i < 30; i++) {
    bones.forEach((node, j) => {
      node.position.copy(pose[j].p);
      node.quaternion.copy(pose[j].q);
    });
    motion.update(1 / 60, { charge: 0.8, preparedStroke: "forehand" });
    pose = bones.map((node) => ({
      p: node.position.clone(),
      q: node.quaternion.clone(),
    }));
    footwork.update(1 / 60, { charge: 0.8, assistActive: false, vx: 0, vz: 0 });
  }
  assert.ok(
    Math.abs(
      rightFoot.getWorldPosition(new THREE.Vector3()).y - initialRight.y
    ) < 0.025,
    "arriving midway through an adjustment must finish lowering the foot while charge stays held"
  );
  footwork.reset();
});

test("forgiving contacts add a restrained reach and recover cleanly on the real avatar", async (t) => {
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
  const motion = await createPadelMotion(vrm);
  const reach = createPadelReach(vrm);
  t.after(() => {
    motion.dispose();
    VRMUtils.deepDispose(vrm.scene);
  });
  const bones = Object.values(vrm.humanoid.normalizedHumanBones).map(
    ({ node }) => node
  );
  const hand = vrm.humanoid.getNormalizedBoneNode("rightHand");
  const hips = vrm.humanoid.getNormalizedBoneNode("hips");
  for (let i = 0; i < 60; i++)
    motion.update(1 / 60, {
      action: "forehand",
      padelStroke: "forehand",
      strokeProgress: 0.15,
    });
  let base = bones.map((node) => ({
    p: node.position.clone(),
    q: node.quaternion.clone(),
  }));
  const restore = () => {
    bones.forEach((node, i) => {
      node.position.copy(base[i].p);
      node.quaternion.copy(base[i].q);
    });
    vrm.scene.updateMatrixWorld(true);
  };
  restore();
  const handBase = hand.getWorldPosition(new THREE.Vector3());
  const rootBase = vrm.scene.position.clone(),
    hipsBase = hips.position.clone();
  const distances = [];
  for (const [contactKind, contactQuality] of [
    ["normal", 1],
    ["reach", 0.82],
    ["stretch", 0.62],
  ]) {
    reach.reset();
    for (let i = 0; i < 24; i++) {
      restore();
      reach.update(1 / 60, {
        action: "forehand",
        strokeProgress: 0.15,
        contactKind,
        contactQuality,
        x: 0,
        z: 0,
        contactPoint: { x: 1.8, y: 1.2, z: -0.4 },
      });
      assert.ok(
        vrm.scene.position.equals(rootBase) && hips.position.equals(hipsBase),
        "reach cannot translate the player or hips"
      );
      assert.ok(
        bones.every((node, j) => node.quaternion.angleTo(base[j].q) < 0.85),
        "reach corrections must remain anatomically restrained"
      );
      assert.ok(
        bones.every((node) => node.quaternion.toArray().every(Number.isFinite))
      );
    }
    distances.push(
      hand.getWorldPosition(new THREE.Vector3()).distanceTo(handBase)
    );
  }
  assert.ok(
    distances[0] < 1e-8,
    "normal contacts preserve the original captured stroke"
  );
  assert.ok(
    distances[1] > 0.02 && distances[2] > distances[1],
    "stretch contacts should visibly reach further than ordinary reaches"
  );
  assert.ok(
    distances[2] < 0.3,
    `reach must stay small, actual correction=${distances[2]}`
  );
  for (let i = 0; i < 90; i++) {
    restore();
    reach.update(1 / 60, { action: "idle" });
  }
  assert.ok(
    hand.getWorldPosition(new THREE.Vector3()).distanceTo(handBase) < 0.0001,
    "reach fades completely back into the capture after recovery"
  );
  motion.reset();
  for (let i = 0; i < 60; i++)
    motion.update(1 / 60, {
      action: "backhand",
      padelStroke: "backhand",
      strokeProgress: 0.15,
    });
  base = bones.map((node) => ({
    p: node.position.clone(),
    q: node.quaternion.clone(),
  }));
  restore();
  const leftHand = vrm.humanoid.getNormalizedBoneNode("leftHand");
  const gripDistance = hand
    .getWorldPosition(new THREE.Vector3())
    .distanceTo(leftHand.getWorldPosition(new THREE.Vector3()));
  reach.reset();
  for (let i = 0; i < 24; i++) {
    restore();
    reach.update(1 / 60, {
      action: "backhand",
      padelStroke: "backhand",
      strokeProgress: 0.15,
      contactKind: "stretch",
      contactQuality: 0.62,
      x: 0,
      z: 0,
      contactPoint: { x: -1.8, y: 1.2, z: -0.4 },
    });
  }
  const reachingGrip = hand
    .getWorldPosition(new THREE.Vector3())
    .distanceTo(leftHand.getWorldPosition(new THREE.Vector3()));
  assert.ok(
    Math.abs(reachingGrip - gripDistance) < 0.06,
    "a two-handed backhand should keep the support hand near its captured grip while reaching"
  );
});

test("adapted strokes preserve original tennis motion provenance", async () => {
  const pack = JSON.parse(
    await readFile(
      new URL("./anim/tennis-motion.json", import.meta.url),
      "utf8"
    )
  );
  assert.deepEqual(
    pack.clips.map(({ name }) => name),
    ["tennis-ready", "tennis-forehand", "tennis-backhand", "tennis-serve"]
  );
  assert.match(pack.sourceUrl, /rokoko\.com/);
  assert.match(pack.license, /commercial/);
  for (const { contact, clip } of pack.clips) {
    assert.ok(contact > 0 && contact < clip.duration);
    assert.ok(clip.tracks.every(({ name }) => !name.endsWith(".scale")));
    const hips = clip.tracks.find(
      ({ name }) => name === "mixamorigHips.position"
    );
    for (let i = 0; i < hips.values.length; i += 3) {
      assert.equal(hips.values[i], 0);
      assert.equal(hips.values[i + 2], 0);
    }
  }
});
