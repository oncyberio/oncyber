import * as THREE from "three/webgpu";
import { float, normalLocal, positionLocal } from "three/tsl";
import { outline, toon } from "./toon.js";
import { buildGLB, humanBones, parseGLB, vrmVersion } from "./glb.js";
import { plateTexture } from "./text.js";

// Player bodies: the visitor's VRM (and other players'), toon-shaded like
// ACE! (glTF base colours under a toon ramp, inverted-hull ink) and animated
// with Oncyber's native lobby locomotion clips. Loaded by our own DOM-free
// glTF reader so the same code runs on the web and in native WebGPU hosts.

const HEIGHT = 1.62;

const HUMAN_BONES = [
    "hips", "spine", "chest", "upperChest", "neck", "head",
    "leftShoulder", "leftUpperArm", "leftLowerArm", "leftHand",
    "rightShoulder", "rightUpperArm", "rightLowerArm", "rightHand",
    "leftUpperLeg", "leftLowerLeg", "leftFoot", "leftToes",
    "rightUpperLeg", "rightLowerLeg", "rightFoot", "rightToes",
];

/**
 * A VRM-like avatar from GLB bytes: { scene, humanoid, meta, update, dispose }.
 * Animation targets a normalized proxy rig (identity rest pose, the VRM
 * convention the lobby clips are authored for); update() maps it onto the
 * real bones, as @pixiv/three-vrm's normalized rig does.
 */
export async function loadVRM(bytes, decodeImage) {
    const glb = parseGLB(bytes);
    const version = vrmVersion(glb.json);
    const map = humanBones(glb.json);
    if (!version || map.hips === undefined) throw new Error("NOT_A_VRM");
    const { scene, nodes } = await buildGLB(glb, {
        decodeImage,
        makeMaterial: (m) => {
            const mat = new THREE.MeshToonNodeMaterial({
                gradientMap: avatarRamp(),
                color: m.color,
                map: m.map || null,
                side: m.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
            });
            if (m.emissive) mat.emissive.copy(m.emissive);
            if (m.emissiveMap) mat.emissiveMap = m.emissiveMap;
            if (m.alphaMode === "MASK") mat.alphaTest = m.alphaCutoff;
            if (m.alphaMode === "BLEND") {
                mat.transparent = true;
                mat.opacity = m.opacity;
            }
            mat.depthWrite = true;
            return mat;
        },
    });
    scene.updateMatrixWorld(true);
    const proxyRoot = new THREE.Group();
    const bones = {};
    for (const name of HUMAN_BONES) {
        const node = nodes[map[name]];
        if (!node) continue;
        const proxy = new THREE.Object3D();
        proxy.name = `proxy_${name}`;
        proxyRoot.add(proxy);
        const parentWorld = new THREE.Quaternion();
        node.parent?.getWorldQuaternion(parentWorld);
        bones[name] = {
            node,
            proxy,
            rest: node.quaternion.clone(),
            parentWorld,
            parentWorldInv: parentWorld.clone().invert(),
        };
        if (name === "hips") proxy.position.copy(node.position);
    }
    const q = new THREE.Quaternion();
    const vrm = {
        scene,
        proxyRoot,
        meta: { metaVersion: version },
        humanoid: {
            getNormalizedBoneNode: (name) => bones[name]?.proxy || null,
            getRawBoneNode: (name) => bones[name]?.node || null,
        },
        expressionManager: null,
        update() {
            for (const b of Object.values(bones)) {
                // raw = parentWorld⁻¹ · normalized · parentWorld · rest
                q.copy(b.proxy.quaternion)
                    .multiply(b.parentWorld)
                    .premultiply(b.parentWorldInv);
                b.node.quaternion.copy(q).multiply(b.rest);
            }
            if (bones.hips) bones.hips.node.position.copy(bones.hips.proxy.position);
        },
        dispose() {
            scene.traverse((o) => {
                if (!o.isMesh) return;
                o.geometry.dispose();
                for (const m of [].concat(o.material)) {
                    m.map?.dispose();
                    m.dispose();
                }
            });
        },
    };
    // VRM 0.x faces -Z; turn it to +Z like three-vrm's rotateVRM0.
    if (version === "0") scene.rotation.y = Math.PI;
    scene.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.frustumCulled = false;
    });
    return vrm;
}

let ramp = null;
function avatarRamp() {
    if (ramp) return ramp;
    const data = new Uint8Array([
        150, 150, 160, 255, 215, 215, 220, 255, 255, 255, 255, 255,
    ]);
    ramp = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
    ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
    ramp.generateMipmaps = false;
    ramp.needsUpdate = true;
    return ramp;
}

const inkCache = new Map();
function inkMaterial(width) {
    const key = width.toFixed(5);
    if (inkCache.has(key)) return inkCache.get(key);
    const m = new THREE.MeshBasicNodeMaterial({
        color: 0x1d1a2e,
        side: THREE.BackSide,
    });
    m.positionNode = positionLocal.add(
        normalLocal.normalize().mul(float(width))
    );
    inkCache.set(key, m);
    return m;
}

function addInk(vrm, worldWidth = 0.011) {
    const meshes = [];
    vrm.scene.traverse((o) => o.isMesh && meshes.push(o));
    const v = new THREE.Vector3();
    for (const mesh of meshes) {
        const mats = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];
        if (mats.some((m) => m.transparent || m.alphaTest > 0 || m.alphaMap))
            continue;
        const w = worldWidth / (mesh.getWorldScale(v).x || 1);
        const ink = mesh.isSkinnedMesh
            ? new THREE.SkinnedMesh(mesh.geometry, inkMaterial(w))
            : new THREE.Mesh(mesh.geometry, inkMaterial(w));
        if (mesh.isSkinnedMesh) {
            ink.bind(mesh.skeleton, mesh.bindMatrix);
            ink.bindMode = mesh.bindMode;
        }
        if (mesh.morphTargetInfluences)
            ink.morphTargetInfluences = mesh.morphTargetInfluences;
        ink.position.copy(mesh.position);
        ink.quaternion.copy(mesh.quaternion);
        ink.scale.copy(mesh.scale);
        ink.frustumCulled = false;
        ink.name = "ink";
        mesh.parent.add(ink);
    }
}

// ------------------------------------------------------------------ motion

const RIG = {
    mixamorigHips: "hips",
    mixamorigSpine: "spine",
    mixamorigSpine1: "chest",
    mixamorigSpine2: "upperChest",
    mixamorigNeck: "neck",
    mixamorigHead: "head",
    mixamorigLeftShoulder: "leftShoulder",
    mixamorigLeftArm: "leftUpperArm",
    mixamorigLeftForeArm: "leftLowerArm",
    mixamorigLeftHand: "leftHand",
    mixamorigRightShoulder: "rightShoulder",
    mixamorigRightArm: "rightUpperArm",
    mixamorigRightForeArm: "rightLowerArm",
    mixamorigRightHand: "rightHand",
    mixamorigLeftUpLeg: "leftUpperLeg",
    mixamorigLeftLeg: "leftLowerLeg",
    mixamorigLeftFoot: "leftFoot",
    mixamorigLeftToeBase: "leftToes",
    mixamorigRightUpLeg: "rightUpperLeg",
    mixamorigRightLeg: "rightLowerLeg",
    mixamorigRightFoot: "rightFoot",
    mixamorigRightToeBase: "rightToes",
};

let motionData = null;
/** Lobby locomotion clips, a declared release asset (`load` returns JSON). */
export function loadMotion(load) {
    if (!motionData && load)
        motionData = load().catch((err) => {
            console.warn("[garden] avatar motion unavailable", err);
            return null;
        });
    return motionData || Promise.resolve(null);
}

function sourceHipsHeight(clip) {
    const t = clip.tracks.find((k) => k.name === "mixamorigHips.position");
    return t ? Math.abs(t.values[1]) || 1 : 1;
}

function retarget(data, vrm, ref, sourceHeight) {
    const source = THREE.AnimationClip.parse(data);
    const tracks = [];
    const vrm0 = vrm.meta?.metaVersion === "0";
    for (const track of source.tracks) {
        const [bone, prop] = track.name.split(".");
        const node = vrm.humanoid.getNormalizedBoneNode(RIG[bone]);
        if (!node) continue;
        const values = track.values.slice();
        if (prop === "quaternion") {
            if (vrm0)
                for (let i = 0; i < values.length; i += 4) {
                    values[i] *= -1;
                    values[i + 2] *= -1;
                }
            tracks.push(
                new THREE.QuaternionKeyframeTrack(
                    `${node.name}.quaternion`,
                    track.times,
                    values
                )
            );
        } else if (prop === "position" && bone === "mixamorigHips") {
            for (let i = 0; i < values.length; i += 3) {
                values[i] = ref.x;
                values[i + 1] *= ref.height / sourceHeight;
                values[i + 2] = ref.z;
            }
            tracks.push(
                new THREE.VectorKeyframeTrack(
                    `${node.name}.position`,
                    track.times,
                    values
                )
            );
        }
    }
    return new THREE.AnimationClip(data.name, data.duration, tracks);
}

// ------------------------------------------------------------------ body

/** A plain toy body for while a VRM loads, or if it can't. */
function toyBody(color = 0x2f7bff) {
    const g = new THREE.Group();
    const torso = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.26, 0.55, 6, 12),
        toon(color)
    );
    torso.position.y = 0.85;
    outline(torso, 0.02);
    const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 16, 12),
        toon(0xffd9b8)
    );
    head.position.y = 1.45;
    outline(head, 0.02);
    for (const s of [-1, 1]) {
        const leg = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.09, 0.4, 4, 8),
            toon(0x2a2340)
        );
        leg.position.set(s * 0.12, 0.3, 0);
        outline(leg, 0.015);
        g.add(leg);
    }
    g.add(torso, head);
    g.traverse((o) => o.isMesh && (o.castShadow = true));
    return g;
}

/**
 * An avatar: a root you position, with a VRM swapped in when it loads.
 * `drive(dt, { speed, air, act, holding })` animates it.
 */
export function createAvatar(color) {
    const root = new THREE.Group();
    const toy = toyBody(color);
    root.add(toy);
    return { root, toy, rig: null, phase: 0, carry: 0, wave: 0, jumpT: 0 };
}

export async function attachVRM(av, vrm) {
    const data = await loadMotion();
    if (vrm.proxyRoot) av.root.add(vrm.proxyRoot);
    const holder = new THREE.Group();
    holder.add(vrm.scene);
    av.root.add(holder);
    vrm.scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(vrm.scene);
    const h = box.max.y - box.min.y;
    const scale = Math.max(0.3, Math.min(3, HEIGHT / (h || HEIGHT)));
    holder.scale.setScalar(scale);
    holder.position.y = -box.min.y * scale;
    av.root.updateMatrixWorld(true);
    addInk(vrm);
    let mixer = null;
    const clips = {};
    if (data) {
        const hips = vrm.humanoid.getNormalizedBoneNode("hips");
        const raw = vrm.humanoid.getRawBoneNode?.("hips") || hips;
        const p = vrm.scene.worldToLocal(
            raw.getWorldPosition(new THREE.Vector3())
        );
        const ref = {
            x: hips.position.x,
            z: hips.position.z,
            height: Math.abs(p.y),
        };
        const srcH = sourceHipsHeight(data.IDLE);
        mixer = new THREE.AnimationMixer(vrm.proxyRoot || vrm.scene);
        for (const key of ["IDLE", "WALK", "RUN", "JUMP", "WAVING"]) {
            if (!data[key]) continue;
            const action = mixer.clipAction(
                retarget(data[key], vrm, ref, srcH)
            );
            action.play();
            action.setEffectiveWeight(key === "IDLE" ? 1 : 0);
            clips[key] = {
                action,
                w: key === "IDLE" ? 1 : 0,
                duration: data[key].duration,
            };
        }
    }
    av.toy.visible = false;
    const bone = (n) => vrm.humanoid.getNormalizedBoneNode(n);
    av.rig = {
        vrm,
        holder,
        mixer,
        clips,
        arms: {
            lu: bone("leftUpperArm"),
            ll: bone("leftLowerArm"),
            ru: bone("rightUpperArm"),
            rl: bone("rightLowerArm"),
        },
        spine: bone("spine"),
        vrm0: vrm.meta?.metaVersion === "0",
    };
    return av.rig;
}

const approach = (cur, target, rate, dt) =>
    cur + (target - cur) * Math.min(1, rate * dt);
const qa = new THREE.Quaternion();
const qb = new THREE.Quaternion();
const eul = new THREE.Euler();

export function driveAvatar(
    av,
    dt,
    { speed = 0, air = false, act = "", holding = false }
) {
    av.carry = approach(av.carry, holding ? 1 : 0, 10, dt);
    const rig = av.rig;
    if (!rig) {
        // Toy body: bob and lean.
        av.phase += dt * (4 + speed * 2);
        av.toy.position.y =
            speed > 0.2 ? Math.abs(Math.sin(av.phase)) * 0.06 : 0;
        av.toy.rotation.x = Math.min(0.25, speed * 0.04);
        return;
    }
    const C = rig.clips;
    if (rig.mixer) {
        const want = { IDLE: 0, WALK: 0, RUN: 0, JUMP: 0, WAVING: 0 };
        if (air) want.JUMP = 1;
        else if (act === "wave" || act === "pet" || act === "cheer")
            want.WAVING = 1;
        else if (speed < 0.3) want.IDLE = 1;
        else if (speed < 2.8) {
            const k = Math.min(1, (speed - 0.3) / 1.2);
            want.WALK = k;
            want.IDLE = 1 - k;
        } else {
            const k = Math.min(1, (speed - 2.8) / 1.5);
            want.RUN = k;
            want.WALK = 1 - k;
        }
        for (const key in C) {
            const c = C[key];
            c.w = approach(c.w, want[key] || 0, key === "JUMP" ? 14 : 9, dt);
            c.action.setEffectiveWeight(c.w);
        }
        // Keep the feet planted: play locomotion at the speed of travel.
        if (C.WALK) C.WALK.action.timeScale = Math.max(0.6, speed / 1.5);
        if (C.RUN) C.RUN.action.timeScale = Math.max(0.7, speed / 5.0);
        if (C.JUMP && air && av.jumpT === 0) C.JUMP.action.time = 0.35;
        av.jumpT = air ? av.jumpT + dt : 0;
        rig.mixer.update(dt);
    }
    // Carrying: both arms forward and in, overriding the clip's arm swing.
    if (av.carry > 0.01) {
        const s = rig.vrm0 ? -1 : 1;
        const pose = [
            [rig.arms.lu, eul.set(0, s * 0.9, 1.1)],
            [rig.arms.ru, null],
        ];
        void pose;
        const set = (b, x, y, z) => {
            if (!b) return;
            qa.setFromEuler(eul.set(x, y, z));
            qb.copy(b.quaternion);
            b.quaternion.copy(qb.slerp(qa, av.carry));
        };
        // Normalized VRM bones share a T-pose frame: arms out along ±x.
        // Held up overhead, so it stays in view from behind.
        const P = [0.35, 1.25, 0.15, 0.7];
        set(rig.arms.lu, 0, s * P[0], s * P[1]);
        set(rig.arms.ru, 0, -s * P[0], -s * P[1]);
        set(rig.arms.ll, 0, s * P[2], s * P[3]);
        set(rig.arms.rl, 0, -s * P[2], -s * P[3]);
    }
    rig.vrm.update(dt);
}

/** Where a carried thing sits, in the avatar root's frame. */
export const CARRY_OFFSET = new THREE.Vector3(0, 1.95, 0.12);

export function disposeAvatar(av) {
    av.root.parent?.remove(av.root);
    if (av.rig) {
        av.rig.mixer?.stopAllAction();
        av.rig.vrm.dispose();
    }
}

/** A nameplate sprite. */
export function nameplate(text, color = "#2f7bff") {
    const mat = new THREE.SpriteNodeMaterial({
        map: plateTexture(text, color),
        transparent: true,
        depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.6, 0.4, 1);
    sprite.renderOrder = 10;
    return sprite;
}
