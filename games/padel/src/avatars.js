import * as THREE from "three";
import { createPadelUnderarm } from "./underarm.js";
import { createPadelOverhead } from "./overhead.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import basisScript from "three/addons/libs/basis/basis_transcoder.js?url";
import basisWasm from "three/addons/libs/basis/basis_transcoder.wasm?url";
import {
  createPadelMotion,
  createPadelFootwork,
  createPadelReach,
} from "./animation-clips.js";
import {
  courtMovement,
  createCourtLocomotion,
  createLocalViewVisibility,
  createRacketPresentation,
} from "./locomotion.js";

// Cache bytes, never animated Object3Ds: each player owns a separate humanoid.
const modelBytes = new Map();
const Q = THREE.Quaternion;
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const HEIGHT = 1.78;
const TEAM_COLORS = [0x3479ff, 0xff6254];

function bytes(url) {
  if (!modelBytes.has(url)) {
    const promise = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok)
          throw new Error(`Avatar response: ${response.status}`);
        return await response.arrayBuffer();
      } finally {
        clearTimeout(timeout);
      }
    })();
    modelBytes.set(url, promise);
    promise.catch(() => modelBytes.delete(url));
    // Keep the common NPC model cached without accumulating every visited user.
    if (modelBytes.size > 12) modelBytes.delete(modelBytes.keys().next().value);
  }
  return modelBytes.get(url);
}

// Match the native lobby pipeline: authored GLTF colors/textures under diffuse
// Lambert lighting. Legacy MToon shade colors can wash out the entire back of
// Square in this court's sunlight; the native app deliberately bypasses them.
function nativeMaterials(root) {
  const replacements = new Map();
  const replacedTextures = new Set();
  const retainedTextures = new Set();
  const supported = new Set([
    "MeshStandardMaterial",
    "MeshPhysicalMaterial",
    "MeshBasicMaterial",
    "MeshLambertMaterial",
  ]);
  const channels = [
    "map",
    "lightMap",
    "lightMapIntensity",
    "aoMap",
    "aoMapIntensity",
    "emissiveMap",
    "emissiveIntensity",
    "bumpMap",
    "bumpScale",
    "normalMap",
    "normalMapType",
    "displacementMap",
    "displacementScale",
    "displacementBias",
    "alphaMap",
    "wireframe",
    "wireframeLinewidth",
    "flatShading",
    "fog",
  ];
  const textureRefs = (material, target) => {
    const seen = new Set();
    const visit = (value) => {
      if (!value || typeof value !== "object" || seen.has(value)) return;
      seen.add(value);
      if (value.isTexture) target.add(value);
      else Object.values(value).forEach(visit);
    };
    Object.values(material).forEach(visit);
  };
  const convert = (source) => {
    if (replacements.has(source)) return replacements.get(source);
    if (
      !supported.has(source.type) ||
      source.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile ||
      source.customProgramCacheKey !==
        THREE.Material.prototype.customProgramCacheKey
    )
      return source;
    const target = new THREE.MeshLambertMaterial();
    THREE.Material.prototype.copy.call(target, source);
    target.depthWrite = true;
    target.depthTest = true;
    for (const channel of channels)
      if (source[channel] !== undefined) target[channel] = source[channel];
    if (source.color?.isColor) target.color.copy(source.color);
    if (source.emissive?.isColor) target.emissive.copy(source.emissive);
    if (source.normalScale?.isVector2)
      target.normalScale.copy(source.normalScale);
    target.envMap = null;
    target.reflectivity = 0;
    // A restrained ink edge and stepped key-light response keep the authored
    // skin/jersey texture. No duplicate skinned mesh, MToon or extra draw pass.
    target.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        `
        float volleyFacing = abs(dot(normalize(normal), normalize(vViewPosition)));
        float volleyInk = 1.0 - smoothstep(0.10, 0.34, volleyFacing);
        float volleyLight = dot(reflectedLight.directDiffuse, vec3(0.2126, 0.7152, 0.0722));
        float volleyBand = mix(0.90, 1.04, smoothstep(0.16, 0.24, volleyLight));
        outgoingLight *= volleyBand * (1.0 - volleyInk * 0.30);
        #include <opaque_fragment>
        `
      );
    };
    target.customProgramCacheKey = () => "padel-native-ink-v1";
    replacements.set(source, target);
    return target;
  };
  root.traverse((mesh) => {
    if (!mesh.isMesh) return;
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(convert)
      : convert(mesh.material);
    for (const material of Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material])
      textureRefs(material, retainedTextures);
  });
  for (const source of replacements.keys()) {
    textureRefs(source, replacedTextures);
    source.dispose();
  }
  for (const texture of replacedTextures)
    if (!retainedTextures.has(texture)) texture.dispose();
}

// `source` is avatar bytes (the visitor's, from the host's avatar service: only
// avatars the page vouches for) or the URL of a file in this build (the NPCs).
async function loadVRM(source, renderer) {
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((resource) => {
    if (resource.endsWith("basis_transcoder.js")) return basisScript;
    if (resource.endsWith("basis_transcoder.wasm")) return basisWasm;
    return resource;
  });
  const loader = new GLTFLoader(manager);
  loader.register((parser) => {
    const plugin = new VRMLoaderPlugin(parser, { autoUpdateHumanBones: true });
    plugin.mtoonMaterialPlugin.getMaterialType = () => null;
    return plugin;
  });
  let ktx;
  if (renderer) {
    ktx = new KTX2Loader(manager).setTranscoderPath("/").setWorkerLimit(1);
    ktx.detectSupport(renderer);
    loader.setKTX2Loader(ktx);
  }
  let gltf;
  try {
    if (typeof source === "string") {
      const absolute = new URL(source, window.location.href).href;
      gltf = await loader.parseAsync(
        (await bytes(absolute)).slice(0),
        new URL(".", absolute).href
      );
    } else gltf = await loader.parseAsync(source.slice(0), "");
    const vrm = gltf.userData.vrm;
    if (!vrm?.humanoid?.getNormalizedBoneNode("hips"))
      throw new Error("Avatar has no VRM humanoid");
    nativeMaterials(vrm.scene);
    VRMUtils.rotateVRM0(vrm);
    vrm.scene.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
      object.frustumCulled = false;
    });
    vrm.update(0);
    return vrm;
  } catch (error) {
    if (gltf?.scene) VRMUtils.deepDispose(gltf.scene);
    throw error;
  } finally {
    ktx?.dispose();
  }
}

/**
 * The visitor's avatar for the avatar kit (its `load`): the same reader and
 * materials as a match body, so the club and the court show one avatar.
 */
export async function loadClubAvatar(avatarBytes, renderer) {
  const vrm = await loadVRM(avatarBytes, renderer);
  vrm.dispose = () => VRMUtils.deepDispose(vrm.scene);
  return vrm;
}

// A fully articulated, neutral square-head body is still playable offline.
// It shares the exact same procedural solver as a user's VRM, not a capsule.
function makeFallback(team) {
  const scene = new THREE.Group();
  const bones = {};
  const neutral = new THREE.MeshStandardMaterial({
    color: 0xe5e7eb,
    roughness: 0.86,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x303745,
    roughness: 0.82,
  });
  const accent = new THREE.MeshStandardMaterial({
    color: TEAM_COLORS[team % 2],
    roughness: 0.65,
  });
  const bone = (name, parent, x, y, z) => {
    const node = new THREE.Group();
    node.name = `procedural-${name}`;
    node.position.set(x, y, z);
    parent.add(node);
    bones[name] = node;
    return node;
  };
  const box = (parent, size, at, material = neutral) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...at);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
  };
  const hips = bone("hips", scene, 0, 0.93, 0);
  box(hips, [0.32, 0.19, 0.22], [0, 0.03, 0], dark);
  const spine = bone("spine", hips, 0, 0.11, 0);
  box(spine, [0.3, 0.26, 0.2], [0, 0.1, 0]);
  const chest = bone("chest", spine, 0, 0.22, 0);
  box(chest, [0.4, 0.24, 0.21], [0, 0.08, 0]);
  box(chest, [0.1, 0.06, 0.012], [0.1, 0.13, 0.112], accent);
  const neck = bone("neck", chest, 0, 0.25, 0);
  const head = bone("head", neck, 0, 0.09, 0);
  box(head, [0.3, 0.32, 0.27], [0, 0.11, 0]);
  // Two discreet eyes keep the square head's front legible on the court.
  box(head, [0.045, 0.023, 0.008], [-0.065, 0.13, 0.14], dark);
  box(head, [0.045, 0.023, 0.008], [0.065, 0.13, 0.14], dark);
  for (const [side, sign] of [
    ["left", 1],
    ["right", -1],
  ]) {
    const upperArm = bone(`${side}UpperArm`, chest, sign * 0.22, 0.17, 0);
    box(upperArm, [0.27, 0.105, 0.12], [sign * 0.135, 0, 0]);
    const lowerArm = bone(`${side}LowerArm`, upperArm, sign * 0.29, 0, 0);
    box(lowerArm, [0.255, 0.09, 0.1], [sign * 0.125, 0, 0]);
    const hand = bone(`${side}Hand`, lowerArm, sign * 0.27, 0, 0);
    box(hand, [0.095, 0.07, 0.095], [sign * 0.035, 0, 0]);
    const thigh = bone(`${side}UpperLeg`, hips, sign * 0.105, -0.01, 0);
    box(thigh, [0.14, 0.4, 0.16], [0, -0.2, 0], dark);
    const shin = bone(`${side}LowerLeg`, thigh, 0, -0.43, 0);
    box(shin, [0.105, 0.38, 0.12], [0, -0.19, 0]);
    const foot = bone(`${side}Foot`, shin, 0, -0.4, 0);
    box(foot, [0.145, 0.095, 0.25], [0, -0.04, 0.05], dark);
  }
  return {
    scene,
    humanoid: { getNormalizedBoneNode: (name) => bones[name] },
    update() {},
  };
}

/** A short solid carbon paddle with real perforations, not a tennis string bed. */
function makeRacket(index, legacy) {
  const root = new THREE.Group();
  root.name = "padel-racket";
  const color = TEAM_COLORS[index % 2];
  const edge = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.4,
    metalness: 0.22,
  });
  const carbon = new THREE.MeshStandardMaterial({
    color: 0x1a2530,
    roughness: 0.64,
    metalness: 0.1,
  });
  const grip = new THREE.MeshStandardMaterial({
    color: 0xe8e6dd,
    roughness: 0.95,
  });
  const shape = new THREE.Shape();
  shape.absellipse(0, 0.29, 0.14, 0.165, 0, Math.PI * 2, false);
  for (let y = -2; y <= 2; y++)
    for (let x = -2; x <= 2; x++) {
      const px = x * 0.046,
        py = y * 0.048;
      if ((px / 0.113) ** 2 + (py / 0.135) ** 2 > 0.95) continue;
      const hole = new THREE.Path();
      hole.absarc(px, 0.29 + py, 0.0105, 0, Math.PI * 2, true);
      shape.holes.push(hole);
    }
  const face = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, {
      depth: 0.021,
      bevelEnabled: true,
      bevelThickness: 0.003,
      bevelSize: 0.003,
      bevelSegments: 1,
      curveSegments: 20,
    }),
    carbon
  );
  face.position.z = -0.0105;
  root.add(face);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.144, 0.008, 5, 40),
    edge
  );
  rim.position.y = 0.29;
  rim.scale.y = 1.17;
  root.add(rim);
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.021, 0.13, 8),
    grip
  );
  handle.position.y = 0.035;
  root.add(handle);
  const throat = new THREE.Mesh(
    new THREE.CylinderGeometry(0.037, 0.018, 0.085, 6),
    edge
  );
  throat.position.y = 0.13;
  root.add(throat);
  const butt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.024, 0.024, 0.018, 8),
    edge
  );
  butt.position.y = -0.032;
  root.add(butt);
  root.traverse((mesh) => {
    if (mesh.isMesh) mesh.castShadow = true;
  });
  root.rotation.z = legacy ? -Math.PI / 2 : Math.PI / 2;
  return root;
}

/**
 * A match body: an avatar, the padel capture and a wrist-mounted racket.
 * `bytes` resolves to the visitor's avatar (through the host's avatar
 * service); `url` is a model in this build, for the NPCs. With neither, or
 * when both fail, the body is the articulated procedural one. The club's
 * visitor (arrival, walking, emotes, leaving) is the avatar kit's, not this.
 */
export async function createPadelAvatar({
  renderer,
  bytes: avatarBytes,
  url,
  pfp,
  index = 0,
} = {}) {
  let vrm;
  for (const candidate of [avatarBytes, url].filter(Boolean)) {
    try {
      vrm = await loadVRM(
        typeof candidate === "function" ? await candidate() : candidate,
        renderer
      );
      break;
    } catch (error) {
      console.warn(
        "[Padel] Avatar unavailable; trying the next body:",
        error.message
      );
    }
  }
  const proceduralFallback = !vrm;
  vrm ||= makeFallback(index);
  const root = new THREE.Group();
  root.name = `padel-avatar-${index}`;
  root.userData.proceduralFallback = proceduralFallback;
  const body = new THREE.Group();
  body.name = "padel-body";
  body.add(vrm.scene);
  root.add(body);
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(vrm.scene);
  const sourceHeight = bounds.max.y - bounds.min.y;
  vrm.scene.scale.multiplyScalar(
    HEIGHT /
      (Number.isFinite(sourceHeight) && sourceHeight > 0.1
        ? sourceHeight
        : HEIGHT)
  );
  root.updateMatrixWorld(true);
  bounds.setFromObject(vrm.scene);
  vrm.scene.position.y -= bounds.min.y;
  root.updateMatrixWorld(true);
  const nodes = [];
  vrm.scene.traverse((node) => {
    if (
      node.name.startsWith("Normalized_") ||
      node.name.startsWith("procedural-")
    )
      nodes.push(node);
  });
  // VRM releases differ in normalized-node names; use the humanoid map as the
  // authority, including all fingers, instead of relying on those names alone.
  const names = ["hips", "spine", "chest", "upperChest", "neck", "head"];
  for (const side of ["left", "right"]) {
    for (const bone of [
      "Shoulder",
      "UpperArm",
      "LowerArm",
      "Hand",
      "UpperLeg",
      "LowerLeg",
      "Foot",
      "Toes",
    ])
      names.push(side + bone);
    for (const finger of ["Thumb", "Index", "Middle", "Ring", "Little"])
      for (const joint of finger === "Thumb"
        ? ["Metacarpal", "Proximal", "Distal"]
        : ["Proximal", "Intermediate", "Distal"])
        names.push(side + finger + joint);
  }
  for (const name of names) {
    const node = vrm.humanoid.getNormalizedBoneNode(name);
    if (node && !nodes.includes(node)) nodes.push(node);
  }
  const clean = nodes.map((node) => ({
    node,
    position: node.position.clone(),
    quaternion: node.quaternion.clone(),
  }));
  const bind = clean.map((entry) => ({
    position: entry.position.clone(),
    quaternion: entry.quaternion.clone(),
  }));
  const rightHand = vrm.humanoid.getNormalizedBoneNode("rightHand");
  const motion = await createPadelMotion(vrm).catch((error) => {
    console.warn("[Padel] Motion unavailable:", error.message);
    return null;
  });
  const footwork = createPadelFootwork(vrm);
  const reach = createPadelReach(vrm);
  const underarm = createPadelUnderarm(vrm);
  const overhead = createPadelOverhead(
    vrm,
    body,
    vrm.meta?.metaVersion === "0"
  );
  const locomotion = createCourtLocomotion(vrm, root);
  const viewVisibility = createLocalViewVisibility(body);
  const head = vrm.humanoid.getNormalizedBoneNode("head");
  const neck = vrm.humanoid.getNormalizedBoneNode("neck");
  const gazeRotation = new Q();
  const gazeEuler = new THREE.Euler(0, 0, 0, "YXZ");
  let gazeYaw = 0,
    gazePitch = 0;
  const mount = new THREE.Group();
  mount.name = "padel-racket";
  const racket = makeRacket(index, vrm.meta?.metaVersion === "0");
  mount.add(racket);
  root.add(mount);
  const racketPresentation = createRacketPresentation(
    mount,
    vrm.meta?.metaVersion === "0"
  );
  const actorInverse = new THREE.Matrix4(),
    inverseQ = new Q();
  let previous = null,
    speed = 0,
    bodyYaw = 0,
    recoveryFacing = false,
    animationMode = null,
    animationResetToken,
    needsReset = true,
    disposed = false;
  const retiredMaterials = new Set();
  root.userData.animationSource = motion
    ? "native-locomotion+rokoko-tennis-adapted-for-padel"
    : "fallback";
  const avatar = {
    root,
    height: HEIGHT,
    setFirstPerson(enabled) {
      if (disposed) return;
      enabled = Boolean(enabled) && animationMode === "match";
      const changed = Boolean(enabled) !== viewVisibility.active;
      viewVisibility.set(enabled);
      if (changed && enabled) racketPresentation.update(true);
      else if (!enabled) racketPresentation.restore();
      root.userData.firstPerson = viewVisibility.active;
    },
    reset(player = {}) {
      if (disposed) return;
      needsReset = true;
      avatar.update(0, player);
    },
    update(dt, player = {}, ball) {
      if (disposed) return;
      dt = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.05);
      const x = Number.isFinite(player.x) ? player.x : 0;
      const y = Number.isFinite(player.y) ? player.y : 0;
      const z = Number.isFinite(player.z) ? player.z : 0;
      const yaw = Number.isFinite(player.yaw)
        ? player.yaw
        : index
        ? 0
        : Math.PI;
      // One mode: this body only plays padel.
      const nextMode = "match";
      const sportsEnabled = true;
      const distance = previous
        ? Math.hypot(x - previous.x, z - previous.z)
        : 0;
      const reset =
        needsReset ||
        distance > 2 ||
        nextMode !== animationMode ||
        player.animationResetToken !== animationResetToken;
      animationMode = nextMode;
      animationResetToken = player.animationResetToken;
      mount.visible = sportsEnabled;
      if (!sportsEnabled && viewVisibility.active) avatar.setFirstPerson(false);
      root.position.set(x, y, z);
      root.rotation.y = yaw;
      body.position.y = 0;
      if (reset) {
        speed = bodyYaw = 0;
        recoveryFacing = false;
        clean.forEach((entry, i) => {
          entry.node.position.copy(bind[i].position);
          entry.node.quaternion.copy(bind[i].quaternion);
        });
        body.rotation.set(0, 0, 0);
        motion?.reset(player);
        footwork.reset();
        reach.reset();
        overhead.reset();
        locomotion.reset();
        gazeYaw = gazePitch = 0;
        needsReset = false;
      } else {
        for (const entry of clean) {
          entry.node.position.copy(entry.position);
          entry.node.quaternion.copy(entry.quaternion);
        }
      }
      const measured = reset
        ? 0
        : dt > 0
        ? distance / dt
        : Math.hypot(player.vx || 0, player.vz || 0);
      speed = lerp(speed, Math.min(measured, 8), 1 - Math.exp(-dt * 18));
      previous ||= { x, z };
      previous.x = x;
      previous.z = z;
      const swinging = [
        "forehand",
        "backhand",
        "serve",
        "smash",
        "hit",
        "swing",
        "power",
      ].includes(player.action);
      const preparing =
        Number(player.charge) > 0.015 ||
        Boolean(player.swingPending) ||
        (player.preparedStroke === "smash" &&
          player.assistContact &&
          Number.isFinite(player.contactTimeToHit) &&
          player.contactTimeToHit <= 0.4);
      const movement = courtMovement(player.vx || 0, player.vz || 0, yaw);
      const recovering =
        sportsEnabled && Boolean(player.recovering) && !swinging && !preparing;
      if (recovering) recoveryFacing = true;
      let turn = 0;
      if (recovering && speed > 0.15) {
        // Between points, walk toward the next position. Athletic backpedaling
        // belongs to live rallies, not the relaxed walk to the service line.
        turn = Math.atan2(player.vx || 0, player.vz || 0) - yaw;
        turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      } else if (sportsEnabled && !swinging && !preparing && speed > 0.3) {
        // Backpedal and shuffle at every speed. A fast backward input must
        // never turn the player's entire body away from the rally.
        turn = movement.facing;
      }
      const delta = Math.atan2(
        Math.sin(turn - bodyYaw),
        Math.cos(turn - bodyYaw)
      );
      bodyYaw += reset
        ? delta
        : clamp(
            delta * (1 - Math.exp(-dt * (swinging || preparing ? 15 : 10))),
            -dt * 7.5,
            dt * 7.5
          );
      bodyYaw = Math.atan2(Math.sin(bodyYaw), Math.cos(bodyYaw));
      if (
        recoveryFacing &&
        !recovering &&
        Math.abs(bodyYaw) < 0.01 &&
        speed < 0.2
      ) {
        recoveryFacing = false;
        locomotion.reset();
      }
      body.rotation.y = bodyYaw;
      root.updateWorldMatrix(true, false);
      // The capture sees the body's real facing while it turns. The simulation
      // continues to own court-facing root yaw and every player position.
      const motionPlayer = recoveryFacing
        ? { ...player, yaw: yaw + bodyYaw }
        : player;
      const visibleMovement = recoveryFacing
        ? courtMovement(player.vx || 0, player.vz || 0, yaw + bodyYaw)
        : movement;
      motion?.update(reset ? 0 : dt, motionPlayer, speed, reset ? 0 : distance);
      if (!motion) {
        const l = vrm.humanoid.getNormalizedBoneNode("leftUpperArm"),
          r = vrm.humanoid.getNormalizedBoneNode("rightUpperArm");
        if (l) l.rotation.z = -1.15;
        if (r) r.rotation.z = 1.15;
      }
      // Save precisely the mixer result. Restoring this on the next tick is
      // required because unchanged mixer tracks are intentionally not rewritten.
      for (const entry of clean) {
        entry.position.copy(entry.node.position);
        entry.quaternion.copy(entry.node.quaternion);
      }
      if (sportsEnabled) {
        // Charging keeps the recorded racket preparation above the waist.
        // Manual positioning still needs planted directional steps below it;
        // only the committed contact adjustment owns the short assist steps.
        const legPlayer = player.manualPreparation
          ? { ...player, charge: 0, swingPending: false, assistActive: false }
          : player;
        // Fade out the court-facing foot solver while the full-body walking
        // capture turns toward the recovery destination, then retire its anchors.
        locomotion.update(reset ? 0 : dt, legPlayer, recoveryFacing ? 0 : speed);
        footwork.update(reset ? 0 : dt, legPlayer);
        reach.update(reset ? 0 : dt, player);
        underarm.update(player);
        overhead.update(reset ? 0 : dt, player);
      }
      if (
        sportsEnabled &&
        ball &&
        Number.isFinite(ball.x) &&
        Number.isFinite(ball.z)
      ) {
        const dx = ball.x - x,
          dz = ball.z - z;
        const direction = Math.atan2(dx, dz) - yaw - bodyYaw;
        const targetYaw = clamp(
          recoveryFacing
            ? 0
            : Math.atan2(Math.sin(direction), Math.cos(direction)),
          -0.58,
          0.58
        );
        const targetPitch = clamp(
          recoveryFacing
            ? 0
            : -Math.atan2(
                (ball.y || 0) - 1.5,
                Math.max(1.2, Math.hypot(dx, dz))
              ),
          -0.25,
          0.23
        );
        const tracking = 1 - Math.exp(-dt * 8);
        gazeYaw = lerp(gazeYaw, targetYaw, tracking);
        gazePitch = lerp(gazePitch, targetPitch, tracking);
        const mirror = vrm.meta?.metaVersion === "0" ? -1 : 1;
        // Small additive tracking preserves the recorded torso/racket arc.
        // These offsets are deliberately applied after saving the mixer pose.
        for (const [node, share] of [
          [neck, 0.35],
          [head, 0.65],
        ]) {
          if (!node) continue;
          gazeEuler.set(gazePitch * share * mirror, gazeYaw * share, 0);
          gazeRotation.setFromEuler(gazeEuler);
          node.quaternion.multiply(gazeRotation);
        }
      }
      if (reset && vrm.springBoneManager) {
        vrm.humanoid.update?.();
        root.updateMatrixWorld(true);
        vrm.springBoneManager.reset();
      }
      vrm.update(dt);
      root.updateMatrixWorld(true);
      if (rightHand) {
        actorInverse.copy(root.matrixWorld).invert();
        rightHand.getWorldPosition(mount.position).applyMatrix4(actorInverse);
        rightHand.getWorldQuaternion(mount.quaternion);
        root.getWorldQuaternion(inverseQ).invert();
        mount.quaternion.premultiply(inverseQ);
      }
      racketPresentation.update(sportsEnabled && viewVisibility.active);
      root.userData.motion = motion?.mode || "fallback";
      root.userData.overheadLift = sportsEnabled ? overhead.lift : 0;
      root.userData.animationMode = animationMode;
      root.userData.stroke = sportsEnabled
        ? player.padelStroke || "ready"
        : null;
      root.userData.locomotion = {
        direction:
          visibleMovement.speed < 0.15
            ? "idle"
            : Object.entries(visibleMovement.weights).reduce(
                (best, entry) => (entry[1] > best[1] ? entry : best),
                ["forward", -1]
              )[0],
        weights: visibleMovement.weights,
        bodyYaw,
        recovering: recoveryFacing,
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      motion?.dispose();
      root.removeFromParent();
      VRMUtils.deepDispose(root);
      for (const material of retiredMaterials) {
        for (const value of Object.values(material))
          if (value?.isTexture) value.dispose();
        material.dispose();
      }
      retiredMaterials.clear();
      root.clear();
    },
  };
  avatar.update(0, {
    x: 0,
    z: 0,
    action: "idle",
    yaw: index % 2 ? 0 : Math.PI,
  });
  const photoMeshes = [];
  root.traverse((object) => {
    if (object.isMesh && object.name.toLowerCase().endsWith("_pfp"))
      photoMeshes.push(object);
  });
  avatar.profileReady = Promise.resolve(false);
  if (typeof pfp === "string" && pfp && photoMeshes.length) {
    avatar.profileReady = new THREE.TextureLoader()
      .setCrossOrigin("anonymous")
      .loadAsync(pfp)
      .then((texture) => {
        if (disposed) {
          texture.dispose();
          return false;
        }
        texture.flipY = false;
        texture.colorSpace = THREE.SRGBColorSpace;
        for (const mesh of photoMeshes) {
          for (const material of Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material])
            retiredMaterials.add(material);
          mesh.material = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.DoubleSide,
          });
        }
        root.userData.profilePhotoApplied = true;
        return true;
      })
      .catch(() => false);
  }
  return avatar;
}
