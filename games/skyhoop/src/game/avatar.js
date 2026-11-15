import * as THREE from "three/webgpu";
import { buildGLB, humanBones, parseGLB, vrmVersion } from "./glb.js";

// The visitor's body: their VRM, lit like the rest of the bowl, walking on
// Oncyber's lobby locomotion clips in the arrival and seated astride the
// broom in a match (a procedural riding pose blended over the clips).
// Loaded by the DOM-free glTF reader shared with Bloom Garden.

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
            const mat = new THREE.MeshStandardNodeMaterial({
                roughness: 0.72,
                metalness: 0,
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

/**
 * An avatar: a root you position, with a VRM swapped in when it loads.
 * `driveAvatar(av, dt, { speed, air, act, riding, lean, bank })` animates it.
 */
export function createAvatar() {
    const root = new THREE.Group();
    const toy = new THREE.Group();
    root.add(toy);
    return { root, toy, rig: null, phase: 0, carry: 0, wave: 0, jumpT: 0, ride: 0 };
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
    let mixer = null;
    const clips = {};
    let hipsHeight = 0.9 / scale;
    {
        const hb = vrm.humanoid.getRawBoneNode?.("hips") || vrm.humanoid.getNormalizedBoneNode("hips");
        if (hb) hipsHeight = Math.abs(vrm.scene.worldToLocal(hb.getWorldPosition(new THREE.Vector3())).y - box.min.y);
    }
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
        bones: Object.fromEntries(HUMAN_BONES.map((n) => [n, bone(n)]).filter(([, b]) => b)),
        baseY: holder.position.y,
        hipsHeight: hipsHeight * scale,
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
    { speed = 0, air = false, act = "", riding = false, lean = 0, bank = 0, crouch = 0 }
) {
    av.ride = approach(av.ride, riding ? 1 : 0, 5, dt);
    av.lean = lean;
    av.bank = bank;
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
    // Riding: seated astride the broom, leaning into the flight, hands on
    // the handle. Euler angles in the normalized VRM 1 frame (facing +Z,
    // left arm along +X); VRM 0 rigs mirror x and z.
    if (av.ride > 0.001) {
        const flip = rig.vrm0 ? -1 : 1;
        const lean = av.lean || 0;
        const set = (name, x, y, z) => {
            const b = rig.bones[name];
            if (!b) return;
            qa.setFromEuler(eul.set(x * flip, y, z * flip));
            b.quaternion.slerp(qa, av.ride);
        };
        set("leftUpperLeg", -1.45, 0, 0.28);
        set("rightUpperLeg", -1.45, 0, -0.28);
        set("leftLowerLeg", 1.75, 0, 0);
        set("rightLowerLeg", 1.75, 0, 0);
        set("leftFoot", -0.3, 0, 0);
        set("rightFoot", -0.3, 0, 0);
        set("spine", 0.32 + lean * 0.25, 0, -(av.bank || 0) * 0.15);
        set("chest", 0.18 + lean * 0.15, 0, 0);
        set("upperChest", 0.1, 0, 0);
        set("neck", -0.25 - lean * 0.2, 0, 0);
        set("head", -0.3 - lean * 0.2, 0, 0);
        set("leftUpperArm", 0.1, -1.2, -0.75);
        set("rightUpperArm", 0.1, 1.2, 0.75);
        set("leftLowerArm", 0, -0.35, 0);
        set("rightLowerArm", 0, 0.35, 0);
        // Sit the hips on the seat (the avatar root's origin while riding).
        rig.holder.position.y = rig.baseY + (0.1 - rig.hipsHeight) * av.ride;
    } else if (crouch > 0.001) {
        // The lobby handoff pose: crouched low, then standing up.
        const flip = rig.vrm0 ? -1 : 1;
        const k = crouch * (2 - crouch);
        const set = (name, x, y, z) => {
            const b = rig.bones[name];
            if (!b) return;
            qa.setFromEuler(eul.set(x * flip, y, z * flip));
            b.quaternion.slerp(qa, k);
        };
        set("leftUpperLeg", -1.7, 0, 0.15);
        set("rightUpperLeg", -1.7, 0, -0.15);
        set("leftLowerLeg", 2.3, 0, 0);
        set("rightLowerLeg", 2.3, 0, 0);
        set("leftFoot", -0.55, 0, 0);
        set("rightFoot", -0.55, 0, 0);
        set("spine", 0.45, 0, 0);
        set("chest", 0.2, 0, 0);
        set("head", -0.35, 0, 0);
        rig.holder.position.y = rig.baseY - rig.hipsHeight * 0.5 * k;
    } else rig.holder.position.y = rig.baseY;
    rig.vrm.update(dt);
}


export function disposeAvatar(av) {
    av.root.parent?.remove(av.root);
    if (av.rig) {
        av.rig.mixer?.stopAllAction();
        av.rig.vrm.dispose();
    }
}

