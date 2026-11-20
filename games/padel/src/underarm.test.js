import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createPadelUnderarm } from "./underarm.js";
test("underarm serve keeps the hand below the shoulder without stretching the arm or moving the root", () => {
  const scene = new THREE.Group();
  const upper = new THREE.Bone(),
    lower = new THREE.Bone(),
    hand = new THREE.Bone();
  upper.position.set(0.3, 1.4, 0);
  lower.position.set(0.3, 0, 0);
  hand.position.set(0.27, 0, 0);
  scene.add(upper);
  upper.add(lower);
  lower.add(hand);
  const map = { rightUpperArm: upper, rightLowerArm: lower, rightHand: hand };
  const pose = createPadelUnderarm({
    scene,
    humanoid: { getNormalizedBoneNode: (n) => map[n] },
  });
  const p = new THREE.Vector3();
  for (let i = 0; i <= 60; i++) {
    upper.quaternion.identity();
    lower.quaternion.identity();
    pose.update({
      padelStroke: "serve",
      action: "serve",
      strokeProgress: i / 60,
      yaw: Math.PI,
    });
    hand.getWorldPosition(p);
    assert.ok(p.y < 1.13 && p.y > 0.85, `underhand path: ${p.y}`);
    assert.deepEqual(scene.position.toArray(), [0, 0, 0]);
    assert.equal(lower.position.length(), 0.3);
    assert.equal(hand.position.length(), 0.27);
  }
});
