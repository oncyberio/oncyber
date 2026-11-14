import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import basisScript from "three/addons/libs/basis/basis_transcoder.js?url";
import basisWasm from "three/addons/libs/basis/basis_transcoder.wasm?url";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";

// The visitor's own VRM avatar, driven by the procedural pose in character.js:
// the character still computes hands, feet, lean and twist every frame, and
// this rig reaches the avatar's limbs toward them with two-bone IK.

const HEIGHT = 1.75;

export async function loadVRM(url, renderer) {
    const manager = new THREE.LoadingManager();
    manager.setURLModifier((resource) => {
        if (resource.endsWith("basis_transcoder.js")) return basisScript;
        if (resource.endsWith("basis_transcoder.wasm")) return basisWasm;
        return resource;
    });
    const loader = new GLTFLoader(manager);
    loader.setCrossOrigin("anonymous");
    loader.setMeshoptDecoder(MeshoptDecoder);
    const ktx = new KTX2Loader(manager)
        .setTranscoderPath("/")
        .setWorkerLimit(1);
    ktx.detectSupport(renderer);
    loader.setKTX2Loader(ktx);
    loader.register((parser) => new VRMLoaderPlugin(parser));
    try {
        const gltf = await loader.loadAsync(url);
        const vrm = gltf.userData.vrm;
        if (!vrm?.humanoid?.getNormalizedBoneNode("hips")) {
            VRMUtils.deepDispose(gltf.scene);
            throw new Error("Avatar has no VRM humanoid");
        }
        VRMUtils.removeUnnecessaryVertices(gltf.scene);
        VRMUtils.rotateVRM0(vrm);
        vrm.scene.traverse((o) => {
            if (!o.isMesh) return;
            o.castShadow = true;
            o.frustumCulled = false;
        });
        return vrm;
    } finally {
        ktx.dispose();
    }
}

const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const v3 = new THREE.Vector3();
const q1 = new THREE.Quaternion();
const q2 = new THREE.Quaternion();
const e1 = new THREE.Euler();

/** Rotate `bone` so the direction toward `childWorld` points at `targetWorld`. */
function aim(bone, childWorld, targetWorld) {
    const from = v1.copy(childWorld).sub(bone.getWorldPosition(v3));
    const to = v2.copy(targetWorld).sub(v3);
    if (from.lengthSq() < 1e-8 || to.lengthSq() < 1e-8) return;
    q1.setFromUnitVectors(from.normalize(), to.normalize());
    bone.getWorldQuaternion(q2);
    q2.premultiply(q1);
    bone.parent.getWorldQuaternion(q1).invert();
    bone.quaternion.copy(q1.multiply(q2));
    bone.updateMatrixWorld(true);
}

const U = new THREE.Vector3();
const L = new THREE.Vector3();
const E = new THREE.Vector3();
const T = new THREE.Vector3();
const P = new THREE.Vector3();
const elbow = new THREE.Vector3();

/** Classic two-bone IK in world space with a pole hint for the middle joint. */
function twoBone(upper, lower, end, targetWorld, poleWorld) {
    upper.getWorldPosition(U);
    lower.getWorldPosition(L);
    end.getWorldPosition(E);
    const a = U.distanceTo(L);
    const b = L.distanceTo(E);
    T.copy(targetWorld);
    const dir = v1.copy(T).sub(U);
    let d = dir.length();
    if (d < 1e-5) return;
    dir.divideScalar(d);
    d = Math.min(d, (a + b) * 0.999);
    d = Math.max(d, Math.abs(a - b) * 1.01 + 1e-4);
    T.copy(U).addScaledVector(dir, d);
    const cosA = Math.max(
        -1,
        Math.min(1, (a * a + d * d - b * b) / (2 * a * d))
    );
    const sinA = Math.sqrt(1 - cosA * cosA);
    const perp = v2.copy(poleWorld).sub(U);
    perp.addScaledVector(dir, -perp.dot(dir));
    if (perp.lengthSq() < 1e-8) perp.set(0, -1, 0);
    perp.normalize();
    elbow
        .copy(U)
        .addScaledVector(dir, a * cosA)
        .addScaledVector(perp, a * sinA);
    const target = P.copy(T);
    aim(upper, L, elbow);
    lower.getWorldPosition(L);
    end.getWorldPosition(E);
    aim(lower, E, target);
}

const EXPRESSIONS = ["happy", "sad", "angry", "surprised", "aa", "blink"];
const FACE = {
    happy: { happy: 1 },
    sad: { sad: 0.9 },
    shout: { aa: 0.7, angry: 0.35 },
    focus: { angry: 0.3 },
    blink: { blink: 1 },
    neutral: {},
};

/** Swap the procedural body of `ch` for a VRM. Returns the rig. */
export function attachVRM(ch, vrm) {
    const holder = new THREE.Group();
    holder.name = "vrm";
    // Faces +z after rotateVRM0; the character's forward is -z.
    holder.rotation.y = Math.PI;
    holder.add(vrm.scene);
    ch.root.add(holder);
    vrm.scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(vrm.scene);
    const h = box.max.y - box.min.y;
    const scale = Math.max(0.4, Math.min(3, HEIGHT / (h || HEIGHT)));
    holder.scale.setScalar(scale);
    holder.position.y = -box.min.y * scale;

    const bone = (name) => vrm.humanoid.getNormalizedBoneNode(name);
    const bones = {
        hips: bone("hips"),
        spine: bone("spine"),
        chest: bone("chest") || bone("upperChest"),
        neck: bone("neck"),
        head: bone("head"),
    };
    const limbs = {};
    for (const side of ["left", "right"]) {
        limbs[side] = {
            upperArm: bone(`${side}UpperArm`),
            lowerArm: bone(`${side}LowerArm`),
            hand: bone(`${side}Hand`),
            upperLeg: bone(`${side}UpperLeg`),
            lowerLeg: bone(`${side}LowerLeg`),
            foot: bone(`${side}Foot`),
        };
    }
    const hipsRest = bones.hips.position.clone();
    ch.root.updateMatrixWorld(true);
    const ankle =
        limbs.left.foot.getWorldPosition(new THREE.Vector3()).y -
        ch.root.position.y;

    // Hide the toy body; the racket stays.
    ch.body.visible = false;
    for (const part of Object.values(ch.parts)) part.visible = false;

    const rig = { vrm, holder, bones, limbs, hipsRest, ankle, scale };
    ch.rig = rig;
    return rig;
}

const local = new THREE.Vector3();
const world = new THREE.Vector3();
const pole = new THREE.Vector3();

function toWorld(root, x, y, z, out) {
    return root.localToWorld(out.set(x, y, z));
}

/** Pose the VRM from the character's procedural state. Called after poseCharacter. */
export function driveVRM(ch, dt) {
    const rig = ch.rig;
    if (!rig) return;
    const { vrm, bones, limbs, scale } = rig;
    const root = ch.root;
    for (const b of Object.values(bones)) if (b) b.quaternion.identity();
    for (const limb of Object.values(limbs))
        for (const b of Object.values(limb)) if (b) b.quaternion.identity();

    // Body: bob/crouch/hop lift the hips; the legs bend to keep feet planted.
    // Holder space is the character's frame turned half a turn, so x/z flip.
    const lift = ch.body.position.y + 0.06;
    bones.hips.position.copy(rig.hipsRest);
    bones.hips.position.y += lift / scale;
    const lean = ch.body.rotation;
    const twist = ch.body.rotation.y;
    bones.hips.quaternion.setFromEuler(e1.set(0, twist * 0.25, 0));
    bones.spine?.quaternion.setFromEuler(
        e1.set(-lean.x * 0.7, twist * 0.4, -lean.z * 0.7)
    );
    bones.chest?.quaternion.setFromEuler(
        e1.set(-lean.x * 0.5, twist * 0.35, -lean.z * 0.5)
    );
    const headYaw = ch.head.rotation.y;
    const headPitch = ch.head.rotation.x;
    bones.neck?.quaternion.setFromEuler(
        e1.set(-headPitch * 0.4, headYaw * 0.4, 0)
    );
    bones.head?.quaternion.setFromEuler(
        e1.set(-headPitch * 0.6, headYaw * 0.6, 0)
    );
    rig.holder.updateMatrixWorld(true);

    // Arms reach for the procedural hand targets, elbows down and back.
    for (const [side, target, s] of [
        ["right", ch.handR, 1],
        ["left", ch.handL, -1],
    ]) {
        const limb = limbs[side];
        if (!limb.upperArm || !limb.lowerArm || !limb.hand) continue;
        toWorld(root, target.x, target.y, target.z, world);
        limb.upperArm.getWorldPosition(local);
        root.worldToLocal(local);
        toWorld(root, local.x + s * 0.4, local.y - 0.7, local.z + 0.35, pole);
        twoBone(limb.upperArm, limb.lowerArm, limb.hand, world, pole);
    }
    // Legs reach for the stepping feet, knees forward.
    for (const [side, foot, s] of [
        ["right", ch.parts.footR, 1],
        ["left", ch.parts.footL, -1],
    ]) {
        const limb = limbs[side];
        if (!limb.upperLeg || !limb.lowerLeg || !limb.foot) continue;
        const f = foot.position;
        toWorld(root, f.x, f.y + rig.ankle, f.z - 0.04, world);
        limb.upperLeg.getWorldPosition(local);
        root.worldToLocal(local);
        toWorld(root, local.x + s * 0.08, local.y - 0.3, local.z - 0.9, pole);
        twoBone(limb.upperLeg, limb.lowerLeg, limb.foot, world, pole);
    }

    // Face.
    const em = vrm.expressionManager;
    if (em) {
        const want = FACE[ch.expression] || FACE.neutral;
        for (const name of EXPRESSIONS) {
            if (!em.getExpression(name)) continue;
            const cur = em.getValue(name) || 0;
            const goal = want[name] || 0;
            em.setValue(
                name,
                name === "blink"
                    ? goal
                    : cur + (goal - cur) * Math.min(1, dt * 14)
            );
        }
    }
    vrm.update(dt);

    // The racket follows the avatar's actual hand.
    limbs.right.hand.getWorldPosition(world);
    ch.racket.position.copy(root.worldToLocal(world));
}

export function disposeVRM(ch) {
    const rig = ch.rig;
    if (!rig) return;
    rig.holder.parent?.remove(rig.holder);
    VRMUtils.deepDispose(rig.vrm.scene);
    ch.body.visible = true;
    for (const part of Object.values(ch.parts)) part.visible = true;
    ch.rig = null;
}
