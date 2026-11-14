import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { build } from "./world.js";
import { createPadelTravelWorld } from "./travel-world.js";

const state = (extra = {}) => ({
  anchor: { x: 0, y: 0, z: 10.8 },
  worldProgress: 0,
  handoffProgress: 0,
  locked: true,
  reducedMotion: false,
  ...extra,
});
function camera() {
  const value = new THREE.PerspectiveCamera(65, 16 / 9, 0.1, 240);
  value.position.set(0, 2.5, 16);
  value.lookAt(0, 1, 10.8);
  value.updateMatrixWorld();
  return value;
}
function fixture(t) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xaabbcc);
  scene.fog = new THREE.Fog(0xaabbcc, 40, 100);
  const root = new THREE.Group();
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 24),
    new THREE.MeshStandardMaterial({ color: 0x336699 })
  );
  ground.rotation.x = -Math.PI / 2;
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(100, 8, 6),
    new THREE.MeshBasicMaterial({ side: THREE.BackSide })
  );
  root.add(ground, sky);
  scene.add(root);
  const avatar = new THREE.Group();
  avatar.position.set(0, 0.4, 10.8);
  scene.add(avatar);
  const court = {
    root,
    sky,
    brightness: 1,
    setTravelVisibility(value) {
      this.brightness = value;
    },
  };
  const travel = createPadelTravelWorld({ scene, court, camera: camera() });
  t.after(() => {
    travel.dispose();
    for (const mesh of [ground, sky]) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
  });
  return { scene, court, ground, avatar, travel };
}
const fragments = (scene) => scene.getObjectByName("native-world-cube-reveal");
const halo = (scene) => scene.getObjectByName("padel-travel-halo");

test("arrival assembles only court geometry and restores its background and fog", (t) => {
  const { scene, court, ground, avatar, travel } = fixture(t);
  const background = scene.background,
    fog = scene.fog;
  travel.prepare(state());
  assert.equal(ground.visible, false);
  assert.equal(court.sky.visible, true);
  assert.equal(court.brightness, 0);
  assert.equal(scene.background.getHex(), 0);
  assert.equal(scene.fog, null);
  assert.equal(avatar.visible, true);
  assert.deepEqual(avatar.position.toArray(), [0, 0.4, 10.8]);
  assert.ok(fragments(scene));
  const schedule = fragments(scene).userData.worldRevealSchedule.toSorted(
    (a, b) => a.distance - b.distance
  );
  assert.ok(
    schedule[0].delay < schedule.at(-1).delay,
    "arrival assembles outwards from the avatar"
  );
  travel.update(state({ worldProgress: 0.75 }), 1 / 60);
  assert.equal(court.brightness, 0.5);
  assert.equal(ground.visible, false);
  travel.update(state({ worldProgress: 1 }), 1 / 60);
  assert.equal(ground.visible, true);
  assert.equal(scene.background, background);
  assert.equal(scene.fog, fog);
  assert.equal(court.brightness, 1);
  travel.finish();
  assert.equal(fragments(scene), undefined);
  assert.equal(halo(scene).visible, false);
});

test("departure reuses the native fragments and dissolves the court to black", (t) => {
  const { scene, court, ground, travel } = fixture(t);
  travel.prepare(state());
  const stats = travel.stats;
  const geometry = fragments(scene).children[0].geometry;
  travel.update(state({ worldProgress: 1 }), 0);
  travel.finish();
  travel.prepare(state({ worldProgress: 1 }), true);
  assert.equal(travel.stats, stats);
  assert.equal(fragments(scene).children[0].geometry, geometry);
  assert.equal(ground.visible, true);
  const schedule = fragments(scene).userData.worldRevealSchedule.toSorted(
    (a, b) => a.distance - b.distance
  );
  assert.ok(
    schedule[0].delay > schedule.at(-1).delay,
    "departure dissolves inwards like native travel"
  );
  travel.update(state({ worldProgress: 0.5 }), 1 / 60);
  assert.equal(ground.visible, false);
  assert.equal(fragments(scene).visible, true);
  travel.update(state(), 1 / 60);
  assert.equal(ground.visible, false);
  assert.equal(fragments(scene).visible, false);
  assert.equal(scene.background.getHex(), 0);
  assert.equal(court.brightness, 0);
});

test("staging updates the reveal anchor without rebuilding an active transition", (t) => {
  const { scene, travel } = fixture(t);
  travel.prepare(state());
  const group = fragments(scene);
  const stats = travel.stats;
  const anchor = { x: 3.5, y: 0, z: 8.2 };
  travel.prepare(state({ anchor }));
  assert.equal(fragments(scene), group);
  assert.equal(travel.stats, stats);
  assert.deepEqual(halo(scene).position.toArray(), [3.5, 0.026, 8.2]);
});

test("a cancelled or completed arrival can prepare another arrival", (t) => {
  const { scene, ground, travel } = fixture(t);
  travel.prepare(state());
  const stats = travel.stats;
  travel.update(state({ worldProgress: 0.4 }), 0.2);
  travel.finish();
  assert.equal(ground.visible, true);
  travel.prepare(state());
  assert.equal(travel.stats, stats);
  assert.ok(fragments(scene));
  assert.equal(ground.visible, false);
  assert.equal(scene.background.getHex(), 0);
});

test("the ground halo holds its anchor, fades at handoff, and respects reduced motion", (t) => {
  const { scene, travel } = fixture(t);
  travel.prepare(state());
  const ring = halo(scene),
    glow = ring.children[0];
  const initialAngle = glow.rotation.z;
  travel.update(state(), 0.25);
  assert.notEqual(glow.rotation.z, initialAngle);
  assert.deepEqual(ring.position.toArray(), [0, 0.026, 10.8]);
  travel.update(state({ reducedMotion: true, handoffProgress: 0.5 }), 0.1);
  assert.equal(glow.rotation.z, 0);
  assert.equal(ring.material.opacity, 0.09);
  assert.equal(glow.material.opacity, 0.475);
  travel.update(state({ locked: false }), 0);
  assert.equal(ring.visible, false);
});

test("finish and disposal restore scene hooks without disposing court resources", (t) => {
  const { scene, court, ground, travel } = fixture(t);
  const background = scene.background,
    fog = scene.fog;
  const originalHook = () => {};
  scene.onBeforeRender = originalHook;
  let sourceDisposals = 0;
  ground.geometry.addEventListener("dispose", () => sourceDisposals++);
  ground.material.addEventListener("dispose", () => sourceDisposals++);
  travel.prepare(state());
  assert.notEqual(scene.onBeforeRender, originalHook);
  travel.dispose();
  assert.equal(scene.onBeforeRender, originalHook);
  assert.equal(scene.background, background);
  assert.equal(scene.fog, fog);
  assert.equal(ground.visible, true);
  assert.equal(court.brightness, 1);
  assert.equal(fragments(scene), undefined);
  assert.equal(halo(scene), undefined);
  assert.equal(sourceDisposals, 0);
});

function withCanvasStub(run) {
  const previous = globalThis.document;
  globalThis.document = {
    createElement: () => ({
      getContext: () => ({
        createImageData: (width, height) => ({
          data: new Uint8ClampedArray(width * height * 4),
        }),
        putImageData() {},
        fillText() {},
      }),
    }),
  };
  try {
    return run();
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
}

test("the full club stays within bounded geometry and draw budgets", (t) =>
  withCanvasStub(() => {
    const scene = new THREE.Scene();
    const court = build(scene);
    const travel = createPadelTravelWorld({ scene, court, camera: camera() });
    try {
      let playingSurface;
      court.root.traverse((object) => {
        if (object.geometry?.hasAttribute("courtCoordinate"))
          playingSurface = object;
      });
      assert.ok(
        playingSurface,
        "the painted court needs stable surface coordinates"
      );
      const shader = {
        uniforms: {},
        vertexShader: "#include <common>\n#include <begin_vertex>",
        fragmentShader: "#include <common>\n#include <color_fragment>",
      };
      playingSurface.material.onBeforeCompile(shader);
      assert.match(shader.vertexShader, /attribute vec2 courtCoordinate/);
      assert.match(shader.vertexShader, /vCourt\s*=\s*courtCoordinate/);
      assert.ok(shader.uniforms.court_marking.value.isColor);
      const start = performance.now();
      travel.prepare(state());
      const prepareMs = performance.now() - start;
      const stats = travel.stats;
      assert.ok(stats.cells > 1000 && stats.cells <= 9000);
      assert.ok(stats.fragments <= 18000);
      assert.ok(stats.triangles <= 120000);
      assert.ok(stats.clipTests <= 300000);
      assert.ok(stats.batches <= 128);
      assert.ok(stats.drawCalls <= 32);
      assert.equal(stats.refinementLimited, 0);
      // Net, far cage and independently hidden near cage each retain their
      // custom weave shader. The sky stays excluded; other surfaces reveal.
      assert.equal(stats.skipped, 3);
      assert.equal(court.sky.material.uniforms.travelVisibility.value, 0);
      const surfaceFragments = fragments(scene).children.find((object) =>
        object.geometry.hasAttribute("courtCoordinate")
      );
      assert.ok(
        surfaceFragments,
        "native fragment clipping must retain surface coordinates"
      );
      const coordinates =
        surfaceFragments.geometry.getAttribute("courtCoordinate");
      const fixedCoordinates = coordinates.array.slice();
      const frameTimes = [];
      for (let frame = 0; frame < 108; frame++) {
        const frameStart = performance.now();
        travel.update(state({ worldProgress: frame / 107 }), 1 / 60);
        frameTimes.push(performance.now() - frameStart);
      }
      assert.deepEqual(
        coordinates.array,
        fixedCoordinates,
        "markings cannot swim as their tiles rotate"
      );
      const positions = surfaceFragments.geometry.getAttribute("position");
      const { start: first, count } = surfaceFragments.geometry.drawRange;
      for (let vertex = first; vertex < first + count; vertex++) {
        assert.ok(
          Math.abs(coordinates.getX(vertex) - positions.getX(vertex)) < 1e-5
        );
        assert.ok(
          Math.abs(coordinates.getY(vertex) - positions.getZ(vertex)) < 1e-5
        );
      }
      assert.equal(court.sky.material.uniforms.travelVisibility.value, 1);
      travel.finish();
      const reuseStart = performance.now();
      travel.prepare(state({ worldProgress: 1 }), true);
      const reuseMs = performance.now() - reuseStart;
      assert.equal(travel.stats, stats);
      assert.equal(stats.reuseMiss, "");
      t.diagnostic(
        JSON.stringify({
          cells: stats.cells,
          fragments: stats.fragments,
          triangles: stats.triangles,
          draws: stats.drawCalls,
          prepareMs: Math.round(prepareMs),
          reuseMs: Math.round(reuseMs),
          meanUpdateMs:
            frameTimes.reduce((sum, ms) => sum + ms, 0) / frameTimes.length,
          maxUpdateMs: Math.max(...frameTimes),
        })
      );
    } finally {
      travel.dispose();
      court.dispose();
    }
  }));
