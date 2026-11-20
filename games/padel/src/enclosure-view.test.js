import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  createPadelEnclosureView,
  PADEL_NEAR_WALL_LAYER,
} from "./enclosure-view.js";

function fixture(t) {
  const scene = new THREE.Scene(),
    rear = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    transparent: true,
    opacity: 0.085,
  });
  const geometry = new THREE.PlaneGeometry(10, 3);
  const near = new THREE.Mesh(geometry, material),
    far = near.clone();
  near.position.z = 10;
  far.position.z = -10;
  rear.add(near);
  scene.add(rear, far);
  const camera = new THREE.PerspectiveCamera();
  const view = createPadelEnclosureView({ scene, rear });
  const effects = scene.getObjectByName(
    "Padel · invisible wall contact ripples"
  );
  t.after(() => {
    view.dispose();
    geometry.dispose();
    material.dispose();
  });
  return { scene, rear, near, far, camera, view, effects, material };
}

test("low third person hides only near cage by camera layer, preserving native reveal sources", (t) => {
  const { near, far, rear, camera, view, material } = fixture(t);
  const originalFarLayers = far.layers.mask;
  view.setView({ mode: "courtside", playing: true, camera });
  assert.equal(view.hidden, true);
  assert.equal(camera.layers.test(near.layers), false);
  assert.equal(camera.layers.test(far.layers), true);
  assert.equal(far.layers.mask, originalFarLayers);
  assert.equal(near.visible, true);
  assert.equal(rear.visible, true);
  assert.equal(near.material, far.material);
  assert.equal(material.opacity, 0.085);
  assert.equal(material.visible, true);
  assert.deepEqual(view.viewState, {
    rearHidden: true,
    hiddenPanels: 1,
    activeImpacts: 0,
  });
});

test("broadcast, first person, social visits and native travel restore the complete enclosure", (t) => {
  const { near, camera, view } = fixture(t);
  for (const state of [
    { mode: "broadcast", playing: true },
    { mode: "first-person", playing: true },
    { mode: "courtside", playing: false },
    { mode: "courtside", playing: true, travelLocked: true },
  ]) {
    view.setView({ mode: "courtside", playing: true, camera });
    assert.equal(camera.layers.test(near.layers), false);
    view.setView({ ...state, camera });
    assert.equal(view.hidden, false);
    assert.equal(camera.layers.test(near.layers), true);
  }
});

test("near-wall impacts glow at the contact plane while distant and malformed events are ignored", (t) => {
  const { camera, view, effects } = fixture(t);
  const nearBack = {
    type: "wall",
    side: "back",
    surface: "glass",
    position: { x: 1.4, y: 1.2, z: 9.966 },
  };
  assert.equal(view.wallImpact(nearBack), false);
  view.setView({ mode: "courtside", playing: true, camera });
  assert.equal(view.wallImpact(nearBack), true);
  const glow = effects.children.find((child) => child.visible);
  assert.equal(glow.position.x, 1.4);
  assert.equal(glow.position.y, 1.2);
  assert.ok(Math.abs(glow.position.z - 9.986) < 1e-8);
  assert.equal(
    view.wallImpact({ side: "back", position: { x: 0, y: 2, z: -10 } }),
    false
  );
  assert.equal(
    view.wallImpact({ side: "side", position: { x: 5, y: 2, z: 3 } }),
    false
  );
  assert.equal(
    view.wallImpact({ side: "back", position: { x: NaN, y: 2, z: 10 } }),
    false
  );
  assert.equal(
    view.wallImpact({ side: "side", position: { x: -4.966, y: 2, z: 8 } }),
    true
  );
  const side = effects.children.filter((child) => child.visible)[1];
  assert.equal(side.rotation.y, Math.PI / 2);
  assert.ok(Math.abs(side.position.x + 4.986) < 1e-8);
});

test("impact pool is bounded, fades fully and clears on camera change", (t) => {
  const { camera, view, effects } = fixture(t);
  view.setView({ mode: "courtside", playing: true, camera });
  for (let i = 0; i < 60; i++)
    view.wallImpact({ side: "back", position: { x: 0, y: 1, z: 10 } });
  assert.equal(effects.children.length, 6);
  assert.equal(view.viewState.activeImpacts, 6);
  view.tick(0.26);
  assert.equal(effects.children[0].material.uniforms.age.value, 0.5);
  view.tick(0.3);
  assert.equal(view.viewState.activeImpacts, 0);
  assert.equal(effects.visible, false);
  view.wallImpact({ side: "back", position: { x: 0, y: 1, z: 10 } });
  view.setView({ mode: "broadcast", playing: true, camera });
  assert.equal(view.viewState.activeImpacts, 0);
  assert.equal(effects.visible, false);
});

test("disposing removes effect resources and restores owned layers without clobbering other camera layers", (t) => {
  const { scene, near, camera, view, effects } = fixture(t);
  let geometryDisposals = 0,
    materialDisposals = 0;
  effects.children[0].geometry.addEventListener(
    "dispose",
    () => geometryDisposals++
  );
  for (const child of effects.children)
    child.material.addEventListener("dispose", () => materialDisposals++);
  view.setView({ mode: "courtside", playing: true, camera });
  camera.layers.enable(5);
  view.dispose();
  view.dispose();
  assert.equal(near.layers.mask, 1);
  assert.equal(camera.layers.isEnabled(PADEL_NEAR_WALL_LAYER), false);
  assert.equal(camera.layers.isEnabled(5), true);
  assert.equal(scene.children.includes(effects), false);
  assert.equal(geometryDisposals, 1);
  assert.equal(materialDisposals, 6);
});
