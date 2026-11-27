import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createBall } from "./world.js";

function fixture(t) {
  const original = globalThis.document;
  globalThis.document = {
    createElement() {
      return {
        getContext() {
          return {
            createImageData(width, height) {
              return { data: new Uint8ClampedArray(width * height * 4) };
            },
            putImageData() {},
          };
        },
      };
    },
  };
  const scene = new THREE.Scene();
  const view = createBall(scene);
  const sphere = view.root.children[0];
  const shadow = scene.getObjectByName("Padel ball · ground shadow");
  const trail = scene.getObjectByName("Padel ball · velocity trail");
  t.after(() => {
    view.dispose();
    if (original === undefined) delete globalThis.document;
    else globalThis.document = original;
  });
  return { scene, view, sphere, shadow, trail };
}
const ball = (overrides = {}) => ({
  x: 0,
  y: 1,
  z: 0,
  vx: 20,
  vy: 0,
  vz: 0,
  ...overrides,
});
const close = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} ≠ ${expected}`);

test("dead-ball fade applies to the ball, projected shadow and trail together", (t) => {
  const { view, sphere, shadow, trail } = fixture(t);
  view.update(ball({ active: false }));
  assert.equal(view.root.visible, true);
  assert.equal(trail.visible, true);
  const shadowOpacity = shadow.material.uniforms.opacity.value;
  const trailOpacity = trail.material.opacity;
  view.update(ball({ active: false, x: 0.1, opacity: 0.25 }));
  close(sphere.material.opacity, 0.25);
  close(shadow.material.uniforms.opacity.value, shadowOpacity * 0.25);
  close(trail.material.opacity, trailOpacity * 0.25);
  assert.equal(
    sphere.castShadow,
    false,
    "faded ball must not leave an opaque shadow-map silhouette"
  );
  view.update(ball({ opacity: 0 }));
  assert.equal(view.root.visible, false);
  assert.equal(shadow.visible, false);
  assert.equal(trail.visible, false);
  assert.equal(shadow.material.uniforms.opacity.value, 0);
  assert.equal(trail.material.opacity, 0);
});

test("visual ball rests on the floor and rolling spin follows actual displacement and reversal", (t) => {
  const { view, sphere, shadow } = fixture(t);
  const resting = ball({ y: 0.065, vx: 0, vy: 0, vz: 0 });
  view.update(resting, 0);
  close(view.root.position.y, 0.108);
  assert.ok(view.root.position.y - sphere.geometry.parameters.radius >= 0);
  view.update({ ...resting, x: 0.108, vx: 2.16 }, 0.05);
  const expected = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 0, -1),
    1
  );
  close(sphere.quaternion.angleTo(expected), 0);
  view.update({ ...resting, x: 0, vx: -2.16 }, 0.05);
  close(sphere.quaternion.angleTo(new THREE.Quaternion()), 0);
  const stopped = sphere.quaternion.clone();
  view.update(resting, 0.05);
  close(sphere.quaternion.angleTo(stopped), 0);
  view.update({ ...resting, y: 1, vy: 4 }, 0.05);
  close(
    sphere.quaternion.angleTo(stopped),
    0,
    "pure vertical motion should not make a resting ball spin"
  );
  close(shadow.position.y, 0.018);
});

test("hidden service-ball replacement resets trail history instead of drawing a cross-court streak", (t) => {
  const { view, trail } = fixture(t);
  view.update(ball({ x: -3, z: 8 }));
  view.update(ball({ x: -3, z: 8, opacity: 0 }));
  view.update(ball({ x: 3, y: 0.065, z: -8, opacity: 0.1 }));
  const positions = trail.geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    close(positions.getX(i), 3);
    close(positions.getY(i), 0.108);
    close(positions.getZ(i), -8);
  }
});

test("invalid coordinates, opacity, velocities and time do not poison render state", (t) => {
  const { view, sphere, shadow, trail } = fixture(t);
  view.update(ball({ vx: Infinity, vy: NaN, vz: -Infinity }), NaN);
  assert.ok(view.root.position.toArray().every(Number.isFinite));
  assert.ok(sphere.quaternion.toArray().every(Number.isFinite));
  assert.equal(trail.visible, false);
  view.update(ball({ opacity: NaN }));
  assert.equal(view.root.visible, false);
  view.update(ball({ x: Infinity }));
  assert.equal(view.root.visible, false);
  assert.ok(view.root.position.toArray().every(Number.isFinite));
  view.update(ball({ opacity: 5 }), -1);
  assert.equal(sphere.material.opacity, 1);
  view.update(ball({ opacity: -2 }));
  assert.equal(view.root.visible, false);
  assert.equal(shadow.material.uniforms.opacity.value, 0);
});

test("ball rendering retains and disposes its bounded resources exactly once", (t) => {
  const { scene, view, sphere, shadow, trail } = fixture(t);
  const resources = [
    sphere.geometry,
    sphere.material,
    sphere.material.map,
    shadow.geometry,
    shadow.material,
    trail.geometry,
    trail.material,
  ];
  const counts = resources.map(() => 0);
  resources.forEach((resource, index) =>
    resource.addEventListener("dispose", () => counts[index]++)
  );
  for (let i = 0; i < 100; i++)
    view.update(ball({ x: i / 100, opacity: (i % 10) / 10 }));
  assert.equal(scene.children.length, 3);
  view.dispose();
  view.dispose();
  view.update(ball());
  assert.equal(scene.children.length, 0);
  assert.deepEqual(
    counts,
    resources.map(() => 1)
  );
});
