import test from "node:test";
import assert from "node:assert/strict";
import * as nodeModule from "node:module";
import { readFile } from "node:fs/promises";
import * as THREE from "three";

test(
  "a real avatar plays padel: recovery walks, charged footwork and stroke preparation",
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
    // The site's own texture-free avatar (Node decodes no images), read the
    // way a match body reads an NPC model.
    const avatar = await createPadelAvatar({
      url: new URL("../../../frontend/public/models/pfp.vrm", import.meta.url)
        .href,
    });
    t.after(() => avatar.dispose());
    assert.equal(avatar.root.userData.proceduralFallback, false);
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
        "the simulation owns the complete physics root"
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
    assert.equal(actions.get("padel-ready:upper").getEffectiveWeight(), 1);
    // No lobby jump, emote or travel clip is loaded into a match body.
    for (const name of ["idle", "falling", "death", "hiphop", "TRAVEL_CROUCH"])
      assert.equal(actions.has(`${name}:upper`), false);
    // First person hides the body; leaving it restores the body.
    avatar.setFirstPerson(true);
    assert.equal(body.visible, false);
    avatar.setFirstPerson(false);
    assert.equal(body.visible, true);
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
  }
);
