import * as THREE from "three";
import { crouchPose } from "./arrival.ts";
import { clipRate, clipWeights, type Motion } from "./motion.ts";
import { drawProbe } from "./probe.js";

/** What the kit needs from a loaded avatar; @pixiv/three-vrm's VRM fits, and so does a game's own reader. */
export interface VrmLike {
    scene: THREE.Object3D;
    /** A separate normalized rig, when the reader keeps one outside `scene`. */
    proxyRoot?: THREE.Object3D;
    humanoid: {
        /** Bones with an identity rest pose, facing +z in a T-pose. */
        getNormalizedBoneNode(name: string): THREE.Object3D | null;
        getRawBoneNode?(name: string): THREE.Object3D | null;
    };
    meta?: { metaVersion?: string };
    expressionManager?: any;
    update(seconds: number): void;
    dispose?(): void;
}

// The lobby's clips are authored on this skeleton.
const SOURCE_BONES: Record<string, string> = {
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
export const HUMAN_BONES = Object.values(SOURCE_BONES);

export interface ClipData {
    name: string;
    duration: number;
    tracks: Array<{ name: string; times: number[]; values: number[] }>;
}

function sourceHipsHeight(clip: ClipData | undefined) {
    const track = clip?.tracks.find((t) => t.name === "mixamorigHips.position");
    return track ? Math.abs(track.values[1]) || 1 : 1;
}

/** A lobby clip on this avatar's normalized bones. The hips keep their place and only bob. */
export function retargetClip(
    data: ClipData,
    vrm: VrmLike,
    ref: { x: number; z: number; height: number },
    sourceHeight: number
): THREE.AnimationClip {
    const tracks: THREE.KeyframeTrack[] = [];
    const vrm0 = vrm.meta?.metaVersion === "0";
    for (const track of data.tracks) {
        const [bone, property] = track.name.split(".");
        const node = vrm.humanoid.getNormalizedBoneNode(SOURCE_BONES[bone]);
        if (!node) continue;
        const values = Float32Array.from(track.values);
        if (property === "quaternion") {
            // A VRM 0 avatar is turned half a turn to face +z.
            if (vrm0)
                for (let i = 0; i < values.length; i += 4) {
                    values[i] *= -1;
                    values[i + 2] *= -1;
                }
            tracks.push(
                new THREE.QuaternionKeyframeTrack(
                    `${node.uuid}.quaternion`,
                    track.times,
                    values
                )
            );
        } else if (property === "position" && bone === "mixamorigHips") {
            for (let i = 0; i < values.length; i += 3) {
                values[i] = ref.x;
                values[i + 1] *= ref.height / sourceHeight;
                values[i + 2] = ref.z;
            }
            tracks.push(
                new THREE.VectorKeyframeTrack(
                    `${node.uuid}.position`,
                    track.times,
                    values
                )
            );
        }
    }
    return new THREE.AnimationClip(data.name, data.duration, tracks);
}

/** A plain figure for while an avatar loads, or when a player has none. */
function standInBody(height: number, color: number) {
    const group = new THREE.Group();
    group.name = "stand-in";
    const k = height / 1.75;
    const part = (
        geometry: THREE.BufferGeometry,
        tint: number,
        y: number,
        x = 0
    ) => {
        const mesh = new THREE.Mesh(
            geometry,
            new THREE.MeshLambertMaterial({ color: tint })
        );
        mesh.position.set(x * k, y * k, 0);
        mesh.castShadow = true;
        group.add(mesh);
    };
    part(new THREE.CapsuleGeometry(0.24 * k, 0.5 * k, 6, 12), color, 1.05);
    part(new THREE.SphereGeometry(0.2 * k, 16, 12), 0xf1d2b6, 1.58);
    for (const side of [-1, 1])
        part(
            new THREE.CapsuleGeometry(0.085 * k, 0.5 * k, 4, 8),
            0x2a2f45,
            0.34,
            side * 0.12
        );
    return group;
}

interface Clip {
    action: THREE.AnimationAction;
    weight: number;
}
interface Rig {
    vrm: VrmLike;
    holder: THREE.Group;
    scale: number;
    vrm0: boolean;
    bones: Record<string, THREE.Object3D | null>;
    hipsRest: THREE.Vector3;
    ref: { x: number; z: number; height: number };
    upperLeg: number;
    lowerLeg: number;
    mixer: THREE.AnimationMixer;
    clips: Map<string, Clip>;
    sourceHeight: number;
}

export interface Avatar {
    /** Position and turn this. The body faces +z. */
    readonly root: THREE.Group;
    readonly height: number;
    readonly kind: "vrm" | "stand-in" | "none";
    readonly vrm: VrmLike | null;
    /** The scaled group the VRM sits in, for a game that poses the rig itself. */
    readonly holder: THREE.Group | null;
    /** What the body is doing; `drive` reads it. */
    motion: Motion;
    /** True while the game poses the bones itself; `drive` then leaves them alone. */
    manual: boolean;
    /** The clip that carries the most weight right now. */
    readonly playing: string;
    /** Swap the stand-in for a loaded avatar. */
    attach(vrm: VrmLike): void;
    /** Add lobby clips (`{ IDLE: {...}, ... }`). Safe before `attach`. */
    addClips(data: Record<string, ClipData> | null | undefined): void;
    hasClip(name: string): boolean;
    /** One frame: blend clips for `motion`, then the crouch (0 standing, 1 crouched). */
    drive(seconds: number, crouch?: number): void;
    /** Put every bone back to its rest pose, e.g. before the game poses the rig itself. */
    rest(): void;
    /** True when a mesh of this avatar was submitted to the renderer since the last call. */
    takeDrawn(): boolean;
    dispose(): void;
}

const approach = (
    current: number,
    target: number,
    rate: number,
    seconds: number
) => current + (target - current) * Math.min(1, rate * seconds);
const q = new THREE.Quaternion();
const euler = new THREE.Euler();
const box = new THREE.Box3();
const v = new THREE.Vector3();
const w = new THREE.Vector3();

export function createAvatar(
    options: { height?: number; standIn?: boolean; color?: number } = {}
): Avatar {
    const height = options.height ?? 1.75;
    const root = new THREE.Group();
    root.name = "avatar";
    const probe = drawProbe();
    const watch = (object: THREE.Object3D) => probe.watch(object);
    let standIn: THREE.Group | null =
        options.standIn === false
            ? null
            : standInBody(height, options.color ?? 0x2f7bff);
    if (standIn) {
        root.add(standIn);
        watch(standIn);
    }
    let rig: Rig | null = null;
    const pending: Array<Record<string, ClipData>> = [];
    let emote = "",
        wasAir = false,
        bob = 0,
        playing = "";

    const addTo = (r: Rig, data: Record<string, ClipData>) => {
        if (data.IDLE && r.clips.size === 0)
            r.sourceHeight = sourceHipsHeight(data.IDLE);
        for (const [name, clip] of Object.entries(data)) {
            if (!clip?.tracks || r.clips.has(name)) continue;
            const action = r.mixer.clipAction(
                retargetClip(clip, r.vrm, r.ref, r.sourceHeight)
            );
            action.play();
            const weight = name === "IDLE" && r.clips.size === 0 ? 1 : 0;
            action.setEffectiveWeight(weight);
            r.clips.set(name, { action, weight });
        }
    };

    // The crouch sits on top of whatever the clips did this frame.
    const applyCrouch = (r: Rig, amount: number) => {
        const pose = crouchPose(amount, r.upperLeg, r.lowerLeg);
        const flip = r.vrm0 ? -1 : 1;
        const blend = (
            bone: THREE.Object3D | null,
            x: number,
            y: number,
            z: number,
            weight: number
        ) => {
            if (!bone) return;
            q.setFromEuler(euler.set(x, y, z, "YZX"));
            q.x *= flip;
            q.z *= flip;
            bone.quaternion.slerp(q, weight);
        };
        // Legs take the exact knee bend at once so the feet stay planted.
        const legs = Math.min(1, amount * 4);
        for (const side of ["left", "right"]) {
            blend(r.bones[`${side}UpperLeg`], pose.upperLeg, 0, 0, legs);
            blend(r.bones[`${side}LowerLeg`], pose.lowerLeg, 0, 0, legs);
            blend(r.bones[`${side}Foot`], pose.foot, 0, 0, legs);
        }
        const full = crouchPose(1, r.upperLeg, r.lowerLeg);
        blend(r.bones.spine, full.spine, 0, 0, amount);
        blend(r.bones.head, full.head, 0, 0, amount);
        blend(r.bones.leftUpperArm, 0, -full.armForward, full.armDown, amount);
        blend(r.bones.rightUpperArm, 0, full.armForward, -full.armDown, amount);
        blend(r.bones.leftLowerArm, 0, -full.elbow, 0, amount);
        blend(r.bones.rightLowerArm, 0, full.elbow, 0, amount);
        if (r.bones.hips) {
            r.bones.hips.position.x +=
                (r.hipsRest.x - r.bones.hips.position.x) * legs;
            r.bones.hips.position.z +=
                (r.hipsRest.z - r.bones.hips.position.z) * legs;
            r.bones.hips.position.y -= pose.drop;
        }
    };

    const avatar: Avatar = {
        root,
        height,
        motion: {},
        manual: false,
        get kind() {
            return rig ? "vrm" : standIn ? "stand-in" : "none";
        },
        get vrm() {
            return rig?.vrm ?? null;
        },
        get holder() {
            return rig?.holder ?? null;
        },
        get playing() {
            return playing;
        },
        attach(vrm) {
            if (rig) throw new Error("AVATAR_ATTACHED");
            const holder = new THREE.Group();
            holder.name = "vrm";
            holder.add(vrm.scene);
            root.add(holder);
            if (vrm.proxyRoot) root.add(vrm.proxyRoot);
            root.updateMatrixWorld(true);
            box.setFromObject(vrm.scene);
            const size = box.max.y - box.min.y;
            const scale = Math.max(0.3, Math.min(3, height / (size || height)));
            holder.scale.setScalar(scale);
            holder.position.y = -box.min.y * scale;
            root.updateMatrixWorld(true);
            const bones: Rig["bones"] = {};
            for (const name of HUMAN_BONES)
                bones[name] = vrm.humanoid.getNormalizedBoneNode(name);
            const hips = bones.hips!;
            const raw = vrm.humanoid.getRawBoneNode?.("hips") ?? hips;
            const hipsLocal = vrm.scene.worldToLocal(raw.getWorldPosition(v));
            // Leg lengths in the rig's own units, measured on the real bones.
            const worldScale = vrm.scene.getWorldScale(w).y || 1;
            const joint = (name: string) =>
                (
                    vrm.humanoid.getRawBoneNode?.(name) ?? bones[name]
                )?.getWorldPosition(new THREE.Vector3());
            const length = (a: string, b: string) => {
                const p = joint(a),
                    n = joint(b);
                return p && n ? p.distanceTo(n) / worldScale : 0;
            };
            rig = {
                vrm,
                holder,
                scale,
                bones,
                vrm0: vrm.meta?.metaVersion === "0",
                hipsRest: hips.position.clone(),
                ref: {
                    x: hips.position.x,
                    z: hips.position.z,
                    height: Math.abs(hipsLocal.y) || hips.position.y || 1,
                },
                upperLeg: length("leftUpperLeg", "leftLowerLeg"),
                lowerLeg: length("leftLowerLeg", "leftFoot"),
                mixer: new THREE.AnimationMixer(vrm.proxyRoot ?? vrm.scene),
                clips: new Map(),
                sourceHeight: 1,
            };
            for (const data of pending.splice(0)) addTo(rig, data);
            if (standIn) {
                root.remove(standIn);
                disposeMeshes(standIn);
                standIn = null;
            }
            watch(vrm.scene);
        },
        addClips(data) {
            if (!data || typeof data !== "object") return;
            if (rig) addTo(rig, data);
            else pending.push(data);
        },
        hasClip(name) {
            return rig
                ? rig.clips.has(name)
                : pending.some((data) => name in data);
        },
        drive(seconds, crouch = 0) {
            const motion = avatar.motion;
            if (!rig) {
                // The stand-in bobs when it moves and sinks when it crouches.
                if (!standIn) return;
                bob += seconds * (4 + (motion.speed ?? 0) * 2);
                standIn.position.y =
                    ((motion.speed ?? 0) > 0.3
                        ? Math.abs(Math.sin(bob)) * 0.05
                        : 0) -
                    crouch * 0.42 * height * 0.5;
                standIn.scale.y = 1 - crouch * 0.25;
                playing = Object.entries(clipWeights(motion)).sort(
                    (a, b) => b[1] - a[1]
                )[0][0];
                return;
            }
            if (avatar.manual) return;
            const r = rig;
            const want = clipWeights(
                motion,
                Boolean(motion.emote && r.clips.has(motion.emote))
            );
            const speed = motion.speed ?? 0;
            let top = 0;
            for (const [name, clip] of r.clips) {
                clip.weight = approach(
                    clip.weight,
                    want[name] ?? 0,
                    name === "JUMP" ? 14 : 9,
                    seconds
                );
                clip.action.setEffectiveWeight(clip.weight);
                clip.action.timeScale = clipRate(name, speed);
                if (clip.weight > top) {
                    top = clip.weight;
                    playing = name;
                }
            }
            // An emote and a jump start from their beginning each time.
            const nextEmote =
                motion.emote && r.clips.has(motion.emote) ? motion.emote : "";
            if (nextEmote && nextEmote !== emote)
                r.clips.get(nextEmote)!.action.time = 0;
            emote = nextEmote;
            const air = Boolean(motion.air);
            if (air && !wasAir && r.clips.has("JUMP"))
                r.clips.get("JUMP")!.action.time = 0.35;
            wasAir = air;
            if (r.clips.size) r.mixer.update(seconds);
            else
                for (const bone of Object.values(r.bones))
                    bone?.quaternion.identity();
            if (!r.clips.size) r.bones.hips?.position.copy(r.hipsRest);
            if (crouch > 0) applyCrouch(r, crouch);
            r.vrm.update(seconds);
        },
        rest() {
            if (!rig) return;
            for (const bone of Object.values(rig.bones))
                bone?.quaternion.identity();
            rig.bones.hips?.position.copy(rig.hipsRest);
        },
        takeDrawn() {
            return probe.take();
        },
        dispose() {
            root.parent?.remove(root);
            if (standIn) disposeMeshes(standIn);
            if (rig) {
                rig.mixer.stopAllAction();
                if (rig.vrm.dispose) rig.vrm.dispose();
                else disposeMeshes(rig.vrm.scene);
                rig = null;
            }
        },
    };
    return avatar;
}

function disposeMeshes(object: THREE.Object3D) {
    object.traverse((o: any) => {
        if (!o.isMesh) return;
        o.geometry?.dispose();
        for (const material of [].concat(o.material)) {
            (material as any)?.map?.dispose();
            (material as any)?.dispose();
        }
    });
}
