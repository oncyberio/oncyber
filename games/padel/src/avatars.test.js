import test from "node:test";
import assert from "node:assert/strict";
import * as nodeModule from "node:module";
import { readFile } from "node:fs/promises";
import * as THREE from "three";

test(
  "the real avatar visits with native movement, jumps and emotes, then returns cleanly to padel",
  {
    skip:
      typeof nodeModule.registerHooks !== "function" &&
      "asset import hooks require Node 22.15+",
  },
  async (t) => {
    // Only Vite's URL imports need adapting; the actual avatar loader, VRM,
    // animation mixer, visibility and additive layers execute unchanged.
    const hooks = nodeModule.registerHooks({
      load(url, context, next) {
        return url.endsWith("?url")
          ? {
              format: "module",
              shortCircuit: true,
              source: `export default ${JSON.stringify(url)}`,
            }
          : next(url, context);
      },
    });
    const originalFetch = globalThis.fetch;
    const originalWindow = globalThis.window;
    globalThis.window = {
      location: { href: new URL("../public/", import.meta.url).href },
    };
    globalThis.fetch = async (url) => ({
      ok: true,
      arrayBuffer: async () => {
        const bytes = await readFile(new URL(url));
        return bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength
        );
      },
      json: async () => JSON.parse(await readFile(url, "utf8")),
    });
    const originalClipAction = THREE.AnimationMixer.prototype.clipAction;
    const actions = new Map();
    THREE.AnimationMixer.prototype.clipAction = function (clip, ...args) {
      const action = originalClipAction.call(this, clip, ...args);
      actions.set(clip.name, action);
      return action;
    };
    t.after(() => {
      hooks.deregister();
      globalThis.fetch = originalFetch;
      if (originalWindow === undefined) delete globalThis.window;
      else globalThis.window = originalWindow;
      THREE.AnimationMixer.prototype.clipAction = originalClipAction;
    });
    const { createPadelAvatar } = await import("./avatars.js");
    const avatar = await createPadelAvatar();
    t.after(() => avatar.dispose());
    assert.equal(avatar.root.userData.proceduralFallback, false);
    assert.equal(
      avatar.travelYawOffset,
      Math.PI,
      "VRM0 travel views import the native lobby's raw facing basis"
    );
    const body = avatar.root.getObjectByName("padel-body");
    const racket = avatar.root.getObjectByName("padel-racket");
    const hips = avatar.root.getObjectByName("Normalized_Hips");
    const head = avatar.root.getObjectByName("Normalized_Head");
    const bones = [];
    body.traverse((node) => {
      if (node.name.startsWith("Normalized_")) bones.push(node);
    });
    const pose = () =>
      bones.map((node) => [node.position.toArray(), node.quaternion.toArray()]);
    const state = {
      animationMode: "visit",
      x: 2,
      y: 0,
      z: 4,
      yaw: 0,
      vx: 0,
      vz: 0,
      grounded: true,
      action: "idle",
    };
    const dt = 1 / 60;
    const tick = (seconds = dt) => {
      avatar.update(seconds, state, { x: -10, y: 8, z: -10 });
      assert.deepEqual(
        avatar.root.position.toArray(),
        [state.x, state.y, state.z],
        "the visitor controller owns the complete physics root"
      );
      assert.ok(Math.abs(avatar.root.rotation.y - state.yaw) < 1e-8);
      assert.ok(
        bones.every((node) =>
          [...node.position.toArray(), ...node.quaternion.toArray()].every(
            Number.isFinite
          )
        )
      );
    };
    const settle = (frames = 70) => {
      for (let i = 0; i < frames; i++) tick();
    };
    const noPadelWeights = () => {
      for (const [name, action] of actions)
        if (name.startsWith("padel-"))
          assert.equal(
            action.getEffectiveWeight(),
            0,
            `visitors cannot retain ${name}`
          );
    };
    avatar.setFirstPerson(true);
    assert.equal(body.visible, false);
    tick(0);
    assert.equal(
      body.visible,
      true,
      "entering the social world restores the avatar after a first-person match"
    );
    assert.equal(racket.visible, false);
    assert.equal(avatar.root.userData.motion, "idle");
    noPadelWeights();
    avatar.setFirstPerson(true);
    assert.equal(
      body.visible,
      true,
      "a stale match camera request cannot hide a visitor"
    );
    const idlePose = pose();
    for (let i = 0; i < 10; i++) tick(0);
    assert.deepEqual(
      pose(),
      idlePose,
      "paused visitors must not flash into a bind or athletic pose"
    );

    // Native travel points in every world direction, including what was the
    // backpedal direction during a match. This is a free-walking visitor.
    for (const [speed, yaw] of [
      [1.4, 0],
      [2.8, Math.PI / 2],
      [5.2, Math.PI],
      [7.4, -Math.PI / 2],
    ]) {
      Object.assign(state, {
        yaw,
        vx: Math.sin(yaw) * speed,
        vz: Math.cos(yaw) * speed,
        action: "run",
      });
      for (let i = 0; i < 80; i++) {
        state.x += state.vx * dt;
        state.z += state.vz * dt;
        tick();
      }
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
        head.getWorldQuaternion(new THREE.Quaternion())
      );
      const travel = new THREE.Vector3(state.vx, 0, state.vz).normalize();
      forward.y = 0;
      assert.ok(
        forward.normalize().dot(travel) > 0.88,
        "the visitor's actual face should follow travel instead of staying locked to the net"
      );
      assert.equal(avatar.root.userData.motion, "locomotion");
      assert.equal(racket.visible, false);
      noPadelWeights();
    }
    assert.ok(actions.get("sprint:upper").getEffectiveWeight() > 0.99);
    Object.assign(state, { vx: 0, vz: 0, action: "idle" });
    settle();
    const restHipY = hips.position.y;
    Object.assign(state, {
      action: "load",
      actionTime: 0.08,
      jumpWindup: 0.13,
    });
    settle(6);
    assert.equal(avatar.root.userData.motion, "load");
    Object.assign(state, {
      action: "jump",
      grounded: false,
      y: 0.8,
      actionTime: 0.2,
    });
    settle(25);
    assert.equal(avatar.root.userData.motion, "air");
    assert.ok(
      Math.abs(hips.position.y - restHipY) < 0.12,
      "flight cannot add another jump on top of controller height"
    );
    const airPose = pose();
    for (let i = 0; i < 10; i++) tick(0);
    assert.deepEqual(
      pose(),
      airPose,
      "paused flight must not accumulate hip-height correction"
    );
    Object.assign(state, { grounded: true, y: 0, action: "idle" });
    tick();
    assert.equal(avatar.root.userData.motion, "landing");
    settle();
    assert.equal(avatar.root.userData.motion, "idle");

    assert.equal(await avatar.preloadEmotes(), true);
    for (const emote of ["WAVE", "HIPHOP", "FLOORSITTING", "DEATH"]) {
      Object.assign(state, { emote, emoteTime: 4, emoteLoop: false });
      settle();
      assert.equal(
        avatar.root.userData.motion,
        `emote:${emote === "WAVE" ? "waving" : emote.toLowerCase()}`
      );
      noPadelWeights();
      let floor = Infinity;
      body.traverse((mesh) => {
        const positions = mesh.geometry?.getAttribute?.("position");
        if (!mesh.isMesh || !positions) return;
        const stride = Math.max(1, Math.ceil(positions.count / 64));
        for (let i = 0; i < positions.count; i += stride) {
          const p = mesh
            .getVertexPosition(i, new THREE.Vector3())
            .applyMatrix4(mesh.matrixWorld);
          floor = Math.min(floor, p.y - state.y);
        }
      });
      assert.ok(
        floor > -0.005,
        `${emote} should not sink through the floor (${floor})`
      );
    }
    Object.assign(state, { vx: 3, vz: 0, yaw: Math.PI / 2, action: "run" });
    for (let i = 0; i < 60; i++) {
      state.x += state.vx * dt;
      tick();
    }
    assert.equal(
      avatar.root.userData.motion,
      "locomotion",
      "movement interrupts a remote or local emote"
    );
    assert.equal(actions.get("death:upper").getEffectiveWeight(), 0);

    Object.assign(state, {
      animationMode: "match",
      action: "idle",
      x: 0,
      y: 0,
      z: 10,
      yaw: Math.PI,
      vx: 0,
      vz: 0,
    });
    tick(0);
    assert.equal(racket.visible, true);
    assert.equal(body.position.y, 0);
    assert.equal(avatar.root.userData.motion, "ready");
    assert.equal(actions.get("idle:upper").getEffectiveWeight(), 0);
    assert.equal(actions.get("padel-ready:upper").getEffectiveWeight(), 1);
    for (const name of ["falling", "drop_idle", "death", "hiphop"])
      assert.equal(actions.get(`${name}:upper`).getEffectiveWeight(), 0);
    // Recovery walks face the service formation instead of moonwalking with
    // the live-rally backpedal. Root orientation remains simulation-owned.
    Object.assign(state, { recovering: true, action: "walk", vx: 0, vz: 2.2 });
    let previousTurn = body.rotation.y;
    for (let frame = 0; frame < 75; frame++) {
      state.z += state.vz * dt;
      tick();
      assert.ok(
        Math.abs(body.rotation.y - previousTurn) <= dt * 7.5 + 1e-8,
        "recovery facing turns continuously instead of snapping"
      );
      previousTurn = body.rotation.y;
    }
    assert.equal(avatar.root.userData.locomotion.recovering, true);
    assert.equal(avatar.root.userData.locomotion.direction, "forward");
    assert.ok(
      Math.abs(Math.abs(body.rotation.y) - Math.PI) < 0.015,
      "a player walking toward their back line faces their actual movement"
    );
    assert.ok(
      actions.get("walk:upper").getEffectiveWeight() > 0.8,
      "the captured forward walk supplies a natural recovery gait"
    );
    const pausedWalk = pose();
    tick(0);
    assert.deepEqual(
      pose(),
      pausedWalk,
      "a paused recovery walk holds its pose"
    );
    Object.assign(state, { recovering: false, action: "idle", vx: 0, vz: 0 });
    settle(80);
    assert.ok(
      Math.abs(body.rotation.y) < 0.01,
      "arrival turns gently back toward the court"
    );
    assert.equal(avatar.root.userData.locomotion.recovering, false);
    assert.equal(avatar.root.userData.motion, "ready");
    assert.equal(actions.get("padel-ready:upper").getEffectiveWeight(), 1);
    // Crossing the angular seam during the return must not leave a complete
    // revolution in the body angle and keep recovery active after arrival.
    for (const heading of [3.02, 3.26]) {
      Object.assign(state, {
        recovering: true,
        action: "walk",
        vx: Math.sin(state.yaw + heading) * 2.2,
        vz: Math.cos(state.yaw + heading) * 2.2,
      });
      for (let frame = 0; frame < 65; frame++) {
        const previousHeading = body.rotation.y;
        state.x += state.vx * dt;
        state.z += state.vz * dt;
        tick();
        const turn = body.rotation.y - previousHeading;
        assert.ok(
          Math.abs(Math.atan2(Math.sin(turn), Math.cos(turn))) <=
            dt * 7.5 + 1e-8,
          "crossing the angle seam preserves the bounded visual turn"
        );
      }
    }
    Object.assign(state, { recovering: false, action: "idle", vx: 0, vz: 0 });
    settle(80);
    assert.equal(
      avatar.root.userData.locomotion.recovering,
      false,
      "a return that crosses the angle seam must finish recovery"
    );
    assert.ok(Math.abs(body.rotation.y) < 0.01);
    assert.equal(avatar.root.userData.motion, "ready");
    // Ordinary rally movement still backpedals without turning around.
    Object.assign(state, { action: "walk", vz: 2.2 });
    for (let frame = 0; frame < 60; frame++) {
      state.z += state.vz * dt;
      tick();
    }
    assert.equal(avatar.root.userData.locomotion.direction, "back");
    assert.ok(Math.abs(body.rotation.y) < 0.01);
    Object.assign(state, { action: "idle", vx: 0, vz: 0 });
    settle();
    const feet = ["LeftFoot", "RightFoot"].map((name) =>
      avatar.root.getObjectByName(`Normalized_${name}`)
    );
    const legs = ["LeftUpLeg", "LeftLeg", "RightUpLeg", "RightLeg"].map(
      (name) => avatar.root.getObjectByName(`Normalized_${name}`)
    );
    assert.ok([...feet, ...legs].every(Boolean));
    for (const stroke of ["forehand", "backhand"]) {
      Object.assign(state, {
        charge: 0.6,
        preparedStroke: stroke,
        preparationTime: 0.5,
        manualPreparation: true,
      });
      settle(30);
      for (const [targetX, targetZ] of [
        [0, -2.2],
        [0, 2.2],
        [-2.2, 0],
        [2.2, 0],
        [0, -5.4],
        [0, 5.4],
        [-5.4, 0],
        [5.4, 0],
      ]) {
        let planted = 0,
          sampled = 0,
          legMotion = 0,
          previousFeet,
          previousLegs;
        for (let frame = 0; frame < 90; frame++) {
          state.vx += (targetX - state.vx) * (1 - Math.exp(-17 * dt));
          state.vz += (targetZ - state.vz) * (1 - Math.exp(-17 * dt));
          state.x += state.vx * dt;
          state.z += state.vz * dt;
          state.action = "walk";
          tick();
          const at = feet.map((foot) =>
            foot.getWorldPosition(new THREE.Vector3())
          );
          const pose = legs.map((leg) => leg.quaternion.clone());
          if (previousLegs)
            assert.ok(
              pose.every(
                (rotation, i) => rotation.angleTo(previousLegs[i]) < 0.35
              ),
              "charged direction changes must not snap the legs"
            );
          if (frame > 20) {
            sampled++;
            if (at.some((foot, i) => foot.distanceTo(previousFeet[i]) < 0.02))
              planted++;
            legMotion += Math.max(
              ...pose.map((rotation, i) => rotation.angleTo(previousLegs[i]))
            );
          }
          previousFeet = at;
          previousLegs = pose;
          assert.equal(avatar.root.userData.motion, `${stroke}-prepare`);
          assert.ok(
            actions.get(`padel-${stroke}:upper`).getEffectiveWeight() > 0.98,
            "movement must preserve the charged racket preparation"
          );
        }
        assert.ok(
          legMotion > 1,
          `${stroke} preparation must keep moving legs in direction ${targetX},${targetZ}`
        );
        assert.ok(
          planted > sampled * 0.35,
          `charged steps should plant a foot instead of sliding (${planted}/${sampled})`
        );
      }
      Object.assign(state, { action: "idle", vx: 0, vz: 0 });
      settle();
      const chargedStillPose = pose();
      tick(0);
      assert.deepEqual(pose(), chargedStillPose);
      Object.assign(state, { charge: 0, manualPreparation: false });
      settle();
    }
    Object.assign(state, {
      charge: 0.6,
      preparedStroke: "forehand",
      preparationTime: 0.5,
    });
    settle(15);
    assert.equal(avatar.root.userData.motion, "forehand-prepare");
    Object.assign(state, { animationMode: "visit", emote: null });
    tick(0);
    assert.equal(
      avatar.root.userData.motion,
      "idle",
      "stale charge or stroke fields must never enter visitor animation"
    );
    assert.equal(racket.visible, false);
    noPadelWeights();

    await Promise.all([avatar.prepareTravel(), avatar.prepareTravel()]);
    Object.assign(state, {
      animationMode: "travel",
      x: 2,
      y: 0.65,
      z: -4,
      yaw: 0.6,
      vx: 4,
      vz: 3,
      action: "jump",
      grounded: false,
      travelPose: { name: "TRAVEL_CROUCH_IDLE", time: 0.42 },
    });
    tick(0);
    assert.equal(avatar.root.userData.motion, "travel:TRAVEL_CROUCH_IDLE");
    assert.equal(racket.visible, false);
    assert.equal(
      body.rotation.y,
      0,
      "the arrival view owns the exact actor heading"
    );
    assert.equal(
      body.position.y,
      0,
      "authored crouching cannot receive another visual height offset"
    );
    const heldCrouch = pose();
    for (let i = 0; i < 20; i++) tick();
    assert.deepEqual(
      pose(),
      heldCrouch,
      "arrival pose time is externally sampled, not advanced by a second local clock"
    );
    const crouchHeight = hips.position.y;
    assert.ok(
      crouchHeight < 0.65,
      "the actual VRM must reach the packed crouch depth even if stale flight fields exist"
    );
    assert.ok(
      Math.abs(hips.position.z) > 0.005,
      "preserve the source pelvis sway instead of flattening every horizontal travel key"
    );
    const cycle = actions.get("TRAVEL_CROUCH_IDLE:upper").getClip().duration;
    state.travelPose.time += cycle;
    tick(0);
    bones.forEach((node, i) => {
      assert.ok(
        node.quaternion
          .toArray()
          .every((value, j) => Math.abs(value - heldCrouch[i][1][j]) < 1e-7)
      );
      assert.ok(
        node.position.distanceTo(
          new THREE.Vector3().fromArray(heldCrouch[i][0])
        ) < 1e-6
      );
    });
    let maxArrivalStep = 0;
    let preceding = bones.map((node) => node.quaternion.clone());
    for (let frame = 0; frame <= 71; frame++) {
      const time = frame / 60;
      state.travelPose =
        time < 1
          ? {
              name: "TRAVEL_STAND_UP",
              time,
              previous: { name: "TRAVEL_CROUCH_IDLE", time: 0.42 },
              blend: Math.min(1, time / 0.1),
            }
          : {
              name: "IDLE_CC0",
              time: time - 1,
              previous: { name: "TRAVEL_STAND_UP", time: 1 },
              blend: Math.min(1, (time - 1) / 0.18),
            };
      tick();
      for (let i = 0; i < bones.length; i++) {
        maxArrivalStep = Math.max(
          maxArrivalStep,
          bones[i].quaternion.angleTo(preceding[i])
        );
        preceding[i].copy(bones[i].quaternion);
      }
      assert.equal(body.position.y, 0);
      const left =
        avatar.root
          .getObjectByName("Normalized_LeftFoot")
          .getWorldPosition(new THREE.Vector3()).y - state.y;
      const right =
        avatar.root
          .getObjectByName("Normalized_RightFoot")
          .getWorldPosition(new THREE.Vector3()).y - state.y;
      assert.ok(
        Math.min(left, right) > -0.02 && Math.min(left, right) < 0.09,
        "the anchored support foot stays near the source floor through crouch and stand"
      );
    }
    assert.ok(
      maxArrivalStep < 0.25,
      `native arrival blends must remain bounded (${maxArrivalStep}rad/frame)`
    );
    assert.ok(hips.position.y > crouchHeight + 0.3);
    assert.equal(actions.get("TRAVEL_STAND_UP:upper").getEffectiveWeight(), 0);
    assert.equal(actions.get("IDLE_CC0:upper").getEffectiveWeight(), 1);
    const readyPose = pose();
    Object.assign(state, {
      animationMode: "visit",
      grounded: true,
      action: "idle",
      vx: 0,
      vz: 0,
      travelReadyIdle: true,
      travelIdleTime: state.travelPose.time,
      emote: null,
      charge: 0,
    });
    tick(0);
    pose().forEach((bone, i) =>
      bone.forEach((part, j) =>
        part.forEach((value, k) =>
          assert.ok(
            Math.abs(value - readyPose[i][j][k]) < 1e-12,
            "arrival-to-visitor handoff preserves the displayed ready-idle phase"
          )
        )
      )
    );
    settle(360);
    assert.equal(
      avatar.root.userData.motion,
      "travel-ready-idle",
      "post-arrival ready idle persists while the visitor rests"
    );
    Object.assign(state, { vx: 1.4, yaw: Math.PI / 2, y: 0 });
    for (let i = 0; i < 60; i++) {
      state.x += state.vx * dt;
      tick();
    }
    Object.assign(state, { vx: 0 });
    settle();
    assert.equal(
      avatar.root.userData.motion,
      "idle",
      "first movement permanently releases the arrival idle despite a stale true flag"
    );
    assert.equal(actions.get("IDLE_CC0:upper").getEffectiveWeight(), 0);
    t.diagnostic(
      `native arrival maximum joint step=${maxArrivalStep.toFixed(3)}rad`
    );
  }
);
