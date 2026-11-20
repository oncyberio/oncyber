import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createEffects } from "./world.js";

function fixture(t) {
  const scene = new THREE.Scene();
  const effects = createEffects(scene);
  t.after(() => effects.dispose());
  return {
    scene,
    effects,
    path: scene.getObjectByName("Padel · outgoing shot trajectory"),
    glow: scene.getObjectByName("Padel · outgoing trajectory glow"),
    bounce: scene.getObjectByName("Padel · outgoing first bounce"),
    match: { phase: "rally", players: [{ assistTarget: null }] },
  };
}
function preview(overrides = {}) {
  return {
    active: true,
    charging: true,
    committed: false,
    quality: 0.7,
    safe: true,
    trajectory: {
      points: [
        { x: 0, y: 1.2, z: 7 },
        { x: 0.3, y: 3.8, z: 3 },
        { x: 0.8, y: 4.7, z: -1 },
        { x: 1.3, y: 2.9, z: -5 },
        { x: 1.8, y: 0.065, z: -8 },
      ],
      bounce: { x: 1.8, y: 0.065, z: -8 },
      safe: true,
      blocked: false,
    },
    ...overrides,
  };
}

test("outgoing preparation follows the sampled 3D arc and marks the actual first bounce", (t) => {
  const { effects, path, glow, bounce, match } = fixture(t);
  const state = preview();
  effects.update(1 / 60, match, state);
  assert.equal(path.visible, true);
  assert.equal(glow.visible, true);
  assert.equal(bounce.visible, true);
  assert.deepEqual(effects.trajectoryState, {
    visible: true,
    pointCount: 5,
    bounceVisible: true,
    risky: false,
  });
  const positions = path.geometry.attributes.position;
  for (let i = 0; i < 5; i++) {
    const point = state.trajectory.points[i];
    assert.ok(Math.abs(positions.getX(i * 8) - point.x) < 1e-6);
    assert.ok(Math.abs(positions.getY(i * 8) - point.y) < 1e-6);
    assert.ok(Math.abs(positions.getZ(i * 8) - point.z) < 1e-6);
  }
  assert.equal(bounce.position.x, 1.8);
  assert.equal(bounce.position.z, -8);
  assert.equal(bounce.position.y, 0.036);
  assert.ok(
    path.material.uniforms.minPixels.value > 1,
    "tube has a readable minimum radius in screen pixels"
  );
  path.onBeforeRender({
    getSize(target) {
      target.set(1111, 924);
    },
  });
  assert.equal(path.material.uniforms.viewport.value.y, 924);
  effects.update(1 / 60, match, {
    ...state,
    trajectory: { ...state.trajectory, estimated: true },
  });
  assert.equal(path.visible, true);
  assert.equal(path.material.uniforms.opacity.value, 0.72);
  assert.equal(glow.material.uniforms.opacity.value, 0.1);
  effects.update(1 / 60, match, state);
  assert.equal(path.material.uniforms.opacity.value, 0.9);
  assert.equal(glow.material.uniforms.opacity.value, 0.14);
});

test("safe trajectories remain blue regardless of timing quality; unsafe and blocked trajectories turn coral", (t) => {
  const { effects, path, bounce, match } = fixture(t);
  const state = preview({ quality: 0 });
  effects.update(1 / 60, match, state);
  assert.equal(path.material.uniforms.tint.value.getHex(), 0x8ec9ff);
  effects.update(1 / 60, match, {
    ...state,
    trajectory: { ...state.trajectory, safe: false },
  });
  assert.equal(path.material.uniforms.tint.value.getHex(), 0xff7868);
  effects.update(1 / 60, match, {
    ...state,
    trajectory: { ...state.trajectory, blocked: true, bounce: null },
  });
  assert.equal(effects.trajectoryState.risky, true);
  assert.equal(bounce.visible, false);
});

test("preview disappears outside preparation, on inactive states and for malformed or empty samples", (t) => {
  const { effects, path, glow, bounce, match } = fixture(t);
  for (const state of [
    preview({ active: false }),
    preview({ charging: false, committed: false }),
    preview({ trajectory: { points: [], bounce: null } }),
    preview({
      trajectory: {
        points: [
          { x: 0, y: 1, z: 0 },
          { x: NaN, y: 2, z: 1 },
        ],
      },
    }),
    preview({
      trajectory: {
        points: [
          { x: 0, y: 1, z: 0 },
          { x: 0, y: 1, z: 0 },
        ],
      },
    }),
  ]) {
    effects.update(1 / 60, match, preview());
    effects.update(0, match, state);
    assert.equal(path.visible, false);
    assert.equal(glow.visible, false);
    assert.equal(bounce.visible, false);
    assert.equal(path.geometry.drawRange.count, 0);
  }
  effects.update(0, match, preview({ charging: false, committed: true }));
  assert.equal(path.visible, true);
});

test("trajectory geometry is bounded and reused across updates, including vertical segments", (t) => {
  const { effects, path, match } = fixture(t);
  const geometry = path.geometry,
    positions = geometry.attributes.position.array,
    material = path.material;
  const points = Array.from({ length: 2000 }, (_, i) => ({
    x: 0,
    y: i / 200,
    z: 0,
  }));
  for (let i = 0; i < 20; i++)
    effects.update(
      1 / 60,
      match,
      preview({ trajectory: { points, bounce: null, safe: true } })
    );
  assert.equal(effects.trajectoryState.pointCount, 72);
  assert.equal(path.geometry, geometry);
  assert.equal(path.material, material);
  assert.equal(path.geometry.attributes.position.array, positions);
  assert.equal(positions.length, 72 * 8 * 3);
  assert.equal(geometry.drawRange.count, 71 * 8 * 6);
  assert.ok(geometry.attributes.normal.array.every(Number.isFinite));
  assert.ok(positions.every(Number.isFinite));
  // The initial ring-to-ring triangles face outwards so culling does not erase the tube.
  const normal = new THREE.Vector3().fromBufferAttribute(
    geometry.attributes.normal,
    0
  );
  const tangent = new THREE.Vector3(0, 1, 0);
  const nextNormal = new THREE.Vector3().fromBufferAttribute(
    geometry.attributes.normal,
    1
  );
  assert.ok(
    new THREE.Vector3()
      .crossVectors(nextNormal.clone().sub(normal), tangent)
      .dot(normal) > 0
  );
});

test("trajectory materials and buffers dispose once without affecting the existing effects pool", (t) => {
  const { scene, effects, path, glow, bounce, match } = fixture(t);
  const resources = [
    path.geometry,
    path.material,
    glow.material,
    bounce.geometry,
    bounce.material,
  ];
  const counts = resources.map(() => 0);
  resources.forEach((resource, index) =>
    resource.addEventListener("dispose", () => counts[index]++)
  );
  effects.update(1 / 60, match, preview());
  effects.contact({ type: "bounce", point: { x: 1, y: 0.065, z: -8 } });
  effects.update(1 / 60, match, preview());
  assert.equal(scene.children.length, 1);
  effects.dispose();
  effects.dispose();
  assert.equal(scene.children.length, 0);
  assert.deepEqual(
    counts,
    resources.map(() => 1)
  );
});
