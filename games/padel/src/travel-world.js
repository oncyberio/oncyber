import * as THREE from "three";
import {
  createWorldCubeReveal,
  createTravelGlowTexture,
  sampleTravelGlowAngle,
} from "./native-world-reveal.js";

const smooth = (value) => {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

// Use the same world-space fragments and loading halo as the lobby. Avatars are
// separate scene roots, so they stay intact while the destination assembles.
export function createPadelTravelWorld({ scene, court, camera }) {
  let effect,
    mode,
    parked = false,
    elapsed = 0;
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(0.788, 0.797, 128),
    material
  );
  halo.name = "padel-travel-halo";
  halo.rotation.x = -Math.PI / 2;
  halo.visible = false;
  const texture = createTravelGlowTexture(THREE);
  const glowMaterial = material.clone();
  glowMaterial.map = texture;
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), glowMaterial);
  glow.position.z = 0.001;
  halo.add(glow);
  scene.add(halo);

  function prepare(state, departing = false) {
    const nextMode = departing ? "dissolve" : "reveal";
    const direction = departing ? "inward" : "outward";
    if (effect && mode === nextMode && !parked) {
      effect.setRevealAnchor(state.anchor);
    } else if (
      !effect?.restart({ mode: nextMode, anchor: state.anchor, direction })
    ) {
      effect?.dispose();
      effect = createWorldCubeReveal(THREE, [court.root], {
        scene,
        anchor: state.anchor,
        mode: nextMode,
        direction,
        exclude: (object) => object === court.sky,
        cellSize: 2,
        radius: 18,
        coverage: "all",
        refinement: {
          minCellSize: 1,
          maxCellSize: 24,
          detailRadius: 10,
          focus: camera.position,
          forward: camera.getWorldDirection(new THREE.Vector3()),
        },
        maxTriangles: 120000,
        maxCells: 9000,
        maxFragments: 18000,
        maxClipTests: 300000,
        maxBatches: 128,
      });
    }
    mode = nextMode;
    parked = false;
    elapsed = 0;
    update(state, 0);
  }

  function update(state, dt) {
    if (!effect) return;
    elapsed += dt;
    const world = THREE.MathUtils.clamp(state.worldProgress, 0, 1);
    effect.setProgress(mode === "dissolve" ? 1 - world : world);
    court.setTravelVisibility(smooth((world - 0.5) * 2));
    const visibility = state.locked
      ? 1 - smooth(state.handoffProgress || 0)
      : 0;
    halo.visible = visibility > 0.001;
    halo.position.set(state.anchor.x, state.anchor.y + 0.026, state.anchor.z);
    halo.scale.setScalar(2);
    material.opacity = visibility * 0.18;
    glowMaterial.opacity = visibility * 0.95;
    glow.rotation.z = state.reducedMotion
      ? 0
      : sampleTravelGlowAngle(elapsed * 1000);
  }

  function finish() {
    effect?.park();
    parked = true;
    court.setTravelVisibility(1);
    halo.visible = false;
  }

  return {
    prepare,
    update,
    finish,
    get stats() {
      return effect?.stats;
    },
    dispose() {
      effect?.dispose();
      court.setTravelVisibility(1);
      halo.removeFromParent();
      halo.geometry.dispose();
      glow.geometry.dispose();
      material.dispose();
      glowMaterial.dispose();
      texture.dispose();
    },
  };
}
