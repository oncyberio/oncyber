import test from "node:test";
import assert from "node:assert/strict";
import * as nodeModule from "node:module";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { createMatch } from "./simulation.js";

test(
  "a real avatar meets overhead balls with its short paddle, lands smoothly and never moves its physics root",
  {
    skip:
      typeof nodeModule.registerHooks !== "function" &&
      "asset import hooks require Node 22.15+",
  },
  async (t) => {
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
    const fetch = globalThis.fetch,
      oldWindow = globalThis.window;
    globalThis.window = {
      location: { href: new URL("../public/", import.meta.url).href },
    };
    globalThis.fetch = async (url) => ({
      ok: true,
      arrayBuffer: async () => {
        const b = await readFile(new URL(url));
        return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
      },
      json: async () => JSON.parse(await readFile(url, "utf8")),
    });
    t.after(() => {
      hooks.deregister();
      globalThis.fetch = fetch;
      if (oldWindow === undefined) delete globalThis.window;
      else globalThis.window = oldWindow;
    });
    const { createPadelAvatar } = await import("./avatars.js");
    const avatar = await createPadelAvatar();
    t.after(() => avatar.dispose());
    const mount = avatar.root.children.find(
      (node) => node.name === "padel-racket"
    );
    const paddle = mount.children[0],
      body = avatar.root.getObjectByName("padel-body");
    const nodes = [];
    body.traverse((node) => {
      if (node.name.startsWith("Normalized_")) nodes.push(node);
    });
    const lengths = nodes.map((node) => node.position.clone());
    let maxContactError = 0;
    for (const npc of [false, true])
      for (const height of [2.25, 2.7, 2.9]) {
        avatar.reset({
          animationMode: "match",
          x: 0,
          y: 0,
          z: 0,
          action: "idle",
        });
        const contact = { x: 0, y: height, z: -0.38 };
        const player = {
          x: 0,
          y: 0,
          z: 0,
          yaw: Math.PI,
          vx: 0,
          vz: 0,
          action: "idle",
          preparedStroke: "smash",
          charge: npc ? 0 : 0.8,
          assistContact: contact,
          contactTimeToHit: 0.4,
        };
        let priorLift = 0;
        for (let frame = 0; frame < 24; frame++) {
          player.contactTimeToHit = 0.4 - frame / 60;
          avatar.update(1 / 60, player);
          assert.ok(
            Math.abs(avatar.root.userData.overheadLift - priorLift) < 0.12,
            "takeoff cannot jump between poses"
          );
          priorLift = avatar.root.userData.overheadLift;
        }
        Object.assign(player, {
          action: "smash",
          padelStroke: "smash",
          charge: 0,
          strokeProgress: 0,
          contactPoint: contact,
          contactKind: "normal",
        });
        avatar.update(1 / 60, player);
        const head = paddle.localToWorld(new THREE.Vector3(0, 0.29, 0));
        const error = head.distanceTo(
          new THREE.Vector3(contact.x, contact.y, contact.z)
        );
        maxContactError = Math.max(error, maxContactError);
        assert.ok(
          error < 0.14,
          `the real paddle face must meet a ${height}m overhead, gap=${error}`
        );
        assert.ok(
          avatar.root.userData.overheadLift <= 0.9,
          "the body hop is bounded"
        );
        const paused = nodes.map((node) => node.quaternion.clone()),
          pausedLift = body.position.y;
        avatar.update(0, player);
        assert.equal(
          body.position.y,
          pausedLift,
          "pausing cannot accumulate another hop"
        );
        assert.ok(
          nodes.every(
            (node, i) =>
              node.quaternion
                .clone()
                .normalize()
                .angleTo(paused[i].clone().normalize()) < 1e-6
          ),
          "paused overhead keeps its pose"
        );
        for (let frame = 1; frame <= 60; frame++) {
          player.strokeProgress = Math.min(1, frame / 40.8);
          if (frame > 41) {
            player.action = "idle";
            player.padelStroke = null;
            player.preparedStroke = null;
            player.assistContact = null;
          }
          avatar.update(1 / 60, player);
          assert.deepEqual(
            avatar.root.position.toArray(),
            [0, 0, 0],
            "overhead never teleports the simulation root"
          );
          assert.ok(
            nodes.every((node) =>
              node.quaternion.toArray().every(Number.isFinite)
            )
          );
          nodes.forEach((node, i) => {
            if (!/Hips/.test(node.name))
              assert.ok(
                node.position.distanceTo(lengths[i]) < 1e-6,
                "IK preserves every bone length"
              );
          });
        }
        assert.ok(
          body.position.y < 0.003,
          "landing returns completely to court height"
        );
      }
    // Drive the same Enter hold/release as gameplay. The animation follows the
    // simulation's planned contact rather than a hand-authored pose fixture.
    const match = createMatch();
    match.start();
    match.phase = "rally";
    match.rallyHits = 1;
    Object.assign(match.players[0], { x: 0, z: 3.4 });
    Object.assign(match.players[2], { x: 4.3, z: 7.8 });
    Object.assign(match.players[1], { x: -3.8, z: -8.2 });
    Object.assign(match.players[3], { x: 3.8, z: -8.2 });
    Object.assign(match.ball, {
      x: 0.4,
      y: 5.5,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 4,
      lastHit: 1,
      bounces: 0,
      isServe: false,
      active: true,
    });
    match.consumeEvents();
    avatar.reset(match.players[0]);
    let contactError = null;
    for (let step = 0; step < 120; step++) {
      match.update(
        1 / 120,
        step < 86
          ? { powerHeld: true }
          : step === 86
          ? { powerReleased: true }
          : {}
      );
      const renderFrame = step % 2 || step === 86;
      if (renderFrame) avatar.update(1 / 60, match.players[0], match.ball);
      const shot = match
        .consumeEvents()
        .find((event) => event.type === "shot" && event.playerIndex === 0);
      if (!shot) continue;
      if (!renderFrame) avatar.update(1 / 60, match.players[0], match.ball);
      assert.equal(shot.shotType, "smash");
      const head = paddle.localToWorld(new THREE.Vector3(0, 0.29, 0));
      contactError = head.distanceTo(
        new THREE.Vector3(shot.position.x, shot.position.y, shot.position.z)
      );
      // The face's 16.5cm half-height plus the 6.5cm ball is a real edge contact.
      assert.ok(
        contactError < 0.19,
        `the actual powered shot meets the paddle face, gap=${contactError}`
      );
      assert.deepEqual(avatar.root.position.toArray(), [
        match.players[0].x,
        match.players[0].y,
        match.players[0].z,
      ]);
      break;
    }
    assert.notEqual(
      contactError,
      null,
      "the real held/released shot must execute"
    );
    t.diagnostic(
      `actual powered-shot paddle gap=${contactError.toFixed(
        3
      )}m; pose fixtures=${maxContactError.toFixed(3)}m`
    );
  }
);
