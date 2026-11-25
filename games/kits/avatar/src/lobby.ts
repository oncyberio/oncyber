/**
 * The lobby's own motion on a game's avatar: the same clips, the same motion
 * clock (gait blends, starts and stops, moving turns, jumps and landings,
 * idle variations) and the same finishing pass (lean, torso lead, planted
 * feet, inertial clip handoffs). This file only adapts; the motion itself is
 * the lobby's code in frontend/features/lobby, imported, never copied, so a
 * change to the lobby reaches every game that bundles the kit.
 */
import * as THREE from "three";
import {
    createLobbyLocomotion,
    sanitizeLobbyAnimation,
    type LobbyClipMetadata,
    type LobbyLocomotionPose,
    type LobbyMotionInput,
} from "../../../../frontend/features/lobby/locomotion.ts";
import {
    authorLobbyTransitions,
    calibrateLobbyContacts,
} from "../../../../frontend/features/lobby/advancedMotion.ts";
import { authorMovingTurns } from "../../../../frontend/features/lobby/authorMovingTurns.ts";
import { isMotionOneShot } from "../../../../frontend/features/lobby/motionNames.ts";
import { createProceduralRig } from "../../../../frontend/features/lobby/proceduralRig.ts";
import { createMotionInertia } from "../../../../frontend/features/lobby/motionInertia.ts";
import { decodeCC0LocomotionPack } from "../../../../frontend/features/lobby/cc0LocomotionPack.ts";
import type { ClipData, VrmLike } from "./rig.ts";

/** The clips the lobby's clock needs before it can drive an avatar. */
export const LOBBY_CLOCK_CLIPS = ["IDLE", "WALK", "RUN"] as const;

/**
 * The lobby's motion packs (the kit's motion/lobby-*.lcp, the same bytes the
 * lobby loads) as clips for `addClips` or the kit's `motion` option.
 */
export function decodeLobbyMotion(
    packs: ArrayBuffer | Uint8Array | Array<ArrayBuffer | Uint8Array>
): Record<string, ClipData> {
    const list = Array.isArray(packs) ? packs : [packs];
    const out: Record<string, ClipData> = {};
    for (const pack of list)
        Object.assign(
            out,
            decodeCC0LocomotionPack(pack).clips as unknown as Record<
                string,
                ClipData
            >
        );
    return out;
}

/**
 * The kit's `motion` option for the lobby's motion: the basic clips (the
 * kit's motion/locomotion.json, which carries the wave) with the lobby's
 * packs over them (motion/lobby-core.lcp and lobby-air.lcp).
 *
 *     motion: lobbyMotionSource({ basic: locomotionUrl, packs: [coreUrl, airUrl] })
 */
export function lobbyMotionSource(options: {
    basic?: string;
    packs: string[];
    signal?: AbortSignal;
    fetch?: typeof fetch;
}) {
    const get = options.fetch ?? fetch;
    const load = (url: string) =>
        get(url, { signal: options.signal }).then((r) => {
            if (!r.ok) throw new Error(`MOTION_${r.status}`);
            return r;
        });
    return async (): Promise<Record<string, ClipData>> => {
        const [basic, packs] = await Promise.all([
            options.basic
                ? load(options.basic).then((r) => r.json())
                : Promise.resolve({}),
            Promise.all(
                options.packs.map((url) =>
                    load(url).then((r) => r.arrayBuffer())
                )
            ),
        ]);
        return { ...basic, ...decodeLobbyMotion(packs) };
    };
}

/** True when `clips` carries the lobby's clock set, not just the basic clips. */
export function isLobbyMotion(clips: Record<string, unknown>) {
    return (
        LOBBY_CLOCK_CLIPS.every((name) => name in clips) &&
        // The basic set has IDLE/WALK/RUN too; the lobby's adds its jumps.
        "JUMP_IDLE" in clips
    );
}

/** What the game knows about how its avatar moves this frame (lobby metres). */
export interface LobbyMotion {
    speed: number;
    grounded: boolean;
    verticalVelocity?: number;
    jumpCount?: number;
    stopping?: boolean;
    headingError?: number;
    turnIntent?: number;
}

const scratchEuler = new THREE.Euler();
const scratchQuaternion = new THREE.Quaternion();
const finite = (n: unknown) => (Number.isFinite(n) ? (n as number) : 0);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** A lobby clip on the VRM's normalized bones, the way the lobby retargets. */
function retargetLobbyClip(
    data: ClipData,
    vrm: VrmLike,
    hipsScale: number
): THREE.AnimationClip {
    const vrm0 = vrm.meta?.metaVersion === "0";
    const tracks: THREE.KeyframeTrack[] = [];
    for (const track of data.tracks) {
        const [bone, property] = track.name.split(".");
        const node = vrm.humanoid.getNormalizedBoneNode(BONE_NAMES[bone]);
        if (!node) continue;
        const values = Float32Array.from(track.values);
        if (property === "quaternion") {
            if (vrm0)
                for (let i = 0; i < values.length; i += 2) values[i] *= -1;
            tracks.push(
                new THREE.QuaternionKeyframeTrack(
                    `${node.name}.quaternion`,
                    track.times,
                    values
                )
            );
        } else if (property === "position") {
            for (let i = 0; i < values.length; i++)
                values[i] *= (vrm0 && i % 3 !== 1 ? -1 : 1) * hipsScale;
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

/**
 * Drives one VRM with the lobby's clock. `prepare` authors the lobby's
 * derived clips for this rig (a few frames of work); until it resolves,
 * `ready` is false and the kit keeps its basic blend.
 */
export function createLobbyDriver(options: {
    vrm: VrmLike;
    /** The avatar's root: feet at its origin, turned by the game. */
    root: THREE.Object3D;
    mixer: THREE.AnimationMixer;
    clips: Record<string, ClipData>;
    /** The VRM's hips height over the source skeleton's, in the scene's units. */
    hipsScale: number;
    random?: number;
}) {
    const { vrm, root, mixer } = options;
    const bone = (name: string) =>
        vrm.humanoid.getNormalizedBoneNode(name) || null;
    const actions = new Map<string, THREE.AnimationAction>();
    const metadata: Record<string, LobbyClipMetadata> = {};
    let locomotion: ReturnType<typeof createLobbyLocomotion> | undefined;
    let rig: ReturnType<typeof createProceduralRig> | undefined;
    let inertia: ReturnType<typeof createMotionInertia> | undefined;
    let pose: LobbyLocomotionPose | undefined;
    let ready = false,
        disposed = false,
        previousYaw: number | undefined,
        weight = 0;
    const input: LobbyMotionInput = { speed: 0, grounded: true };

    const add = (clip: THREE.AnimationClip, meta: LobbyClipMetadata) => {
        const action = mixer.clipAction(clip);
        const loop = meta.loop !== false;
        action.setLoop(
            loop ? THREE.LoopRepeat : THREE.LoopOnce,
            loop ? Infinity : 1
        );
        action.clampWhenFinished = !loop;
        action.setEffectiveWeight(0);
        actions.set(clip.name, action);
        metadata[clip.name] = meta;
    };

    async function prepare() {
        const resting = options.clips.IDLE?.tracks.find(
            (t) => t.name === "mixamorigHips.position"
        )?.values;
        const clips: THREE.AnimationClip[] = [];
        for (const [name, data] of Object.entries(options.clips)) {
            const clip = retargetLobbyClip(
                sanitizeLobbyAnimation(data, name, resting) as ClipData,
                vrm,
                options.hipsScale
            );
            clip.name = name;
            clips.push(clip);
            metadata[name] = {
                duration: clip.duration,
                loop: !isMotionOneShot(name),
            };
        }
        for (const derived of authorLobbyTransitions(
            THREE as any,
            clips.find((c) => c.name === "IDLE") as any,
            clips.find((c) => c.name === "WALK") as any,
            bone as any
        )) {
            clips.push(derived.clip as any);
            metadata[derived.clip.name] = derived.metadata;
        }
        // Measured on the avatar where it stands: contacts are normalized by
        // leg length, so the game's height needs no 1.8 m stand-in, and the
        // avatar never leaves the scene while this runs between frames.
        const scene = vrm.scene;
        root.updateMatrixWorld(true);
        await calibrateLobbyContacts(
            THREE as any,
            root as any,
            clips as any,
            metadata,
            bone as any
        );
        const turns = await authorMovingTurns(
            THREE as any,
            root as any,
            clips as any,
            metadata,
            bone as any
        );
        for (const t of turns) {
            clips.push(t.clip as any);
            metadata[t.clip.name] = t.metadata;
        }
        await calibrateLobbyContacts(
            THREE as any,
            root as any,
            turns.map((t) => t.clip) as any,
            metadata,
            bone as any
        );
        if (disposed) return false;
        for (const clip of clips) add(clip, metadata[clip.name]);
        locomotion = createLobbyLocomotion(
            metadata,
            options.random ?? Math.random()
        );
        root.updateMatrixWorld(true);
        rig = createProceduralRig(
            THREE as any,
            root as any,
            bone as any,
            metadata
        );
        const nodes = new Set<THREE.Object3D>();
        for (const clip of clips)
            for (const track of clip.tracks) {
                const node = scene.getObjectByName(
                    track.name.slice(0, track.name.lastIndexOf("."))
                );
                if (node) nodes.add(node);
            }
        inertia = createMotionInertia(
            THREE as any,
            Array.from(nodes) as any,
            (bone("hips") || undefined) as any
        );
        ready = true;
        return true;
    }

    const restore = () => {
        rig?.restore();
        inertia?.restore();
    };

    return {
        prepare,
        get ready() {
            return ready;
        },
        get metadata() {
            return metadata;
        },
        /** The lobby clip carrying the most weight, while the clock drives. */
        get playing() {
            if (!pose || weight < 0.5) return "";
            return pose.blend < 0.5 ? pose.primary.name : pose.secondary.name;
        },
        /** Before the mixer: undo last frame's detail. */
        restore,
        /**
         * Sample the clock into the lobby actions. `share` (0..1) is how much
         * of the body the clock owns this frame; the rest is the kit's own
         * clips (an emote, a wave) fading in or out.
         */
        sample(seconds: number, motion: LobbyMotion, share: number) {
            if (!ready || !locomotion) return;
            const step = Math.max(0, Math.min(finite(seconds), 0.1));
            root.updateWorldMatrix(true, false);
            const yaw = scratchEuler.setFromQuaternion(
                root.getWorldQuaternion(scratchQuaternion),
                "YXZ"
            ).y;
            input.turnRate =
                previousYaw === undefined || step === 0
                    ? 0
                    : wrap(yaw - previousYaw) / step;
            previousYaw = yaw;
            input.speed = Math.max(0, finite(motion.speed));
            input.grounded = motion.grounded;
            input.verticalVelocity = finite(motion.verticalVelocity);
            input.jumpCount = motion.jumpCount;
            input.stopping = motion.stopping;
            input.restConfirmed = motion.stopping;
            input.stopDistance = motion.stopping ? input.speed / 28 : undefined;
            input.headingError = motion.headingError;
            input.turnIntent = motion.stopping ? 0 : motion.turnIntent;
            input.warping = true;
            input.procedural = true;
            pose = locomotion.update(step, input);
            weight = share;
            for (const action of actions.values())
                action
                    .stopFading()
                    .setEffectiveWeight(0)
                    .setEffectiveTimeScale(0);
            const put = (name: string, time: number, w: number) => {
                const action = actions.get(name);
                if (!action || w <= 0) return;
                action.enabled = true;
                action.paused = false;
                if (!action.isScheduled()) action.play();
                action.time = time;
                action.setEffectiveWeight(w);
            };
            put(pose.primary.name, pose.primary.time, (1 - pose.blend) * share);
            put(pose.secondary.name, pose.secondary.time, pose.blend * share);
        },
        /** After the mixer, before vrm.update: the lobby's finishing pass. */
        finish(seconds: number) {
            if (!ready || !pose || weight < 0.999) {
                inertia?.reset();
                rig?.reset();
                return;
            }
            const step = Math.max(0, Math.min(finite(seconds), 0.1));
            inertia!.update(
                step,
                `${pose.primary.name}:${pose.secondary.name}`
            );
            rig!.update(step, input, pose);
        },
        dispose() {
            disposed = true;
            restore();
            for (const action of actions.values()) action.stop();
            actions.clear();
        },
    };
}

export type LobbyDriver = ReturnType<typeof createLobbyDriver>;

/**
 * The lobby's motion signals from the locomotion kit's walker
 * (`@oncyber/kit-locomotion`): a walker's state and the frame's input.
 */
export function walkerMotion(
    state: {
        vx: number;
        vz: number;
        vy: number;
        rotation: number;
        jumpCount: number;
        floor: boolean;
    },
    input: { strafe: number; forward: number; yaw: number }
): LobbyMotion & { air: boolean } {
    const moving = Math.abs(input.strafe) + Math.abs(input.forward) > 0.01;
    const speed = Math.hypot(state.vx, state.vz);
    const travel = input.yaw + Math.atan2(-state.vx, -state.vz);
    const wanted = input.yaw + Math.atan2(-input.strafe, -input.forward);
    return {
        speed,
        air: !state.floor,
        grounded: state.floor,
        verticalVelocity: state.vy,
        jumpCount: state.jumpCount,
        stopping: !moving,
        headingError: speed > 0.1 ? wrap(travel - state.rotation) : 0,
        turnIntent: moving ? wrap(wanted - state.rotation) : 0,
    };
}

// The lobby's clips are authored on this skeleton (as rig.ts).
const BONE_NAMES: Record<string, string> = {
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
