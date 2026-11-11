import {
    FLASH_ANIMATION_NAME,
    FLASH_HOLD_TIME_MS,
    loadFlashAnimationPack,
} from "../flashAnimationPack";
import {
    isTravelAnimation,
    loadTravelAnimationPack,
    travelAnimationLoops,
    type TravelPoseSample,
} from "../travelAnimationPack";
import { authorMovingTurns } from "../authorMovingTurns";
import { LOBBY_GUEST_PORTRAIT } from "../lobbyIdentity";
import {
    LOBBY_TURN_CLIPS,
    LOBBY_MOTION_CLIPS,
    isMotionOneShot,
} from "../motionNames";
import {
    useCC0MotionPreview,
    loadCC0MotionPreview,
    loadDefaultMotion,
} from "../optionalMotionPack";
import {
    authorLobbyTransitions,
    calibrateLobbyContacts,
    LOBBY_TRANSITIONS,
} from "../advancedMotion";
import { createMotionInertia } from "../motionInertia";
import { createProceduralRig } from "../proceduralRig";
import * as THREE from "three/webgpu";
import { VRMLoaderPlugin } from "@pixiv/three-vrm";
import { disposeAvatarGraph } from "./avatarResources";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshBasicNodeMaterial } from "three/webgpu";
import mixamoRigMap from "@components/_3DExhibit-v2/three/factory/player/instanceavatarvrm/baker/rigmap";
import mixamoRig from "@components/_3DExhibit-v2/three/factory/player/instanceavatarvrm/baker/baserig.json";
import {
    EMOTES,
    POSSIBLE_ACTIONS,
} from "@components/_3DExhibit-v2/three/factory/player/instanceavatarvrm/constants";
import { defaultAvatarId, pfpAvatarId } from "@utils/defaultAvatar";
import catalogue from "@components/_3DExhibit-v2/three/factory/player/vrms.json";
import {
    applyNativeAvatarMaterials,
    supportsNativeAvatarMaterial,
} from "./avatarMaterials";

export interface LobbyAvatarIdentity {
    settings?: { vrm?: string; default_vrm_scale?: number };
    avatarContractAddress?: string;
    walletId?: string;
    vrmUrl?: string;
    VRM?: string;
}

export interface LobbyAvatarSource {
    id: string;
    name: string;
    url: string;
    scale?: number;
}

import {
    createLobbyLocomotion,
    sanitizeLobbyAnimation,
    type LobbyMotionInput,
    type LobbyClipMetadata,
    type LobbyLocomotionPose,
} from "../locomotion";

/** Geometry stays owned by the source avatar until its crowd batch is released. */
export interface LobbyAvatarBakePart {
    geometry: THREE.BufferGeometry;
    material: THREE.Material;
    boneCount: number;
    isPfp: boolean;
}

export interface LobbyBakedClip {
    name: string;
    duration: number;
    frameCount: number;
    fps: number;
    loop: boolean;
    timeScale: number;
    /** One frame-major array per part: frame × bone × 16 matrix elements. */
    parts: Float32Array[];
}

export interface LobbyAvatar {
    root: THREE.Group;
    height: number;
    sourceUrl: string;
    update: (
        dt: number,
        animation?: string | number,
        motion?: LobbyMotionInput
    ) => void;
    /** Load and retarget the small transition pack before starting its clock. */
    prepareTravel?: () => Promise<void>;
    /** Prepare the supplied pointing gesture without interrupting current motion. */
    prepareFlash?: () => Promise<void>;
    /** Play its opening once, then hold the pointing pose until dismissed. */
    playFlash?: (options?: { reducedMotion?: boolean }) => Promise<void>;
    /** Also invalidates a pending play; movement/emotes/travel take over smoothly. */
    stopFlash?: () => void;
    /** Finish the authored take (arms lowering) from the hold, then idle. */
    endFlash?: () => void;
    /** Deterministic authored clip sample; false until prepareTravel completes. */
    sampleTravelPose?: (pose: TravelPoseSample) => boolean;
    motionClips?: Record<string, LobbyClipMetadata>;
    playEmote: (name: string | number) => Promise<void>;
    /** Crowd instances draw their own arrival build-up (0 hidden, 1 whole). */
    setReveal?: (amount: number) => void;
    dispose: () => void;
    /** Missing for avatars requiring unsupported materials, morphs or spring physics. */
    bakeParts?: LobbyAvatarBakePart[];
    /** Release CPU samples once a renderer has packed its own GPU atlas. */
    releaseBakedClip?: (animation: string | number, fps?: number) => void;
    bakeClip?: (
        animation: string | number,
        fps?: number
    ) => Promise<LobbyBakedClip>;
}

export interface AvatarOptions {
    signal?: AbortSignal;
    scale?: number;
    profilePhoto?: string;
}

// The installed VRM/addon declarations import bare `three`, which remains
// legacy for the rest of this app. Runtime imports are isolated by the WebGPU
// webpack layer; keep that compatibility cast at the loader boundary only.
interface ModernVRM {
    scene: THREE.Group;
    humanoid: {
        getNormalizedBoneNode(name: string): THREE.Object3D | null;
        getNormalizedPose(): unknown;
        resetNormalizedPose(): void;
        setNormalizedPose(pose: unknown): void;
    };
    meta?: { metaVersion: string };
    springBoneManager?: { joints?: { size: number } };
    update(delta: number): void;
}
interface ModernAvatarLoader {
    setCrossOrigin(value: string): ModernAvatarLoader;
    setDRACOLoader(loader: DRACOLoader): ModernAvatarLoader;
    register(
        factory: (
            parser: ConstructorParameters<typeof VRMLoaderPlugin>[0]
        ) => VRMLoaderPlugin
    ): ModernAvatarLoader;
    parseAsync(
        data: ArrayBuffer,
        path: string
    ): Promise<{
        scene: THREE.Group;
        userData: { vrm?: ModernVRM };
    }>;
}

type RawClip = Parameters<typeof THREE.AnimationClip.parse>[0];
type ClipLibrary = Record<string, RawClip>;

/** Use the current native Square; the bundled OCman is an offline fallback. */
export const DEFAULT_LOBBY_AVATAR_URL = catalogue.square.url;
const LOCAL_FALLBACK_AVATAR_URL = "/models/pfp.vrm";
// Seconds per breath, and how far (s) the hold sways back along the gesture.
const FLASH_BREATH_PERIOD = 3.6;
const EMOTE_RETURN = 0.18;
/** Interrupted hold (walk or jump away) and the tail of a finished gesture. */
const FLASH_INTERRUPT_RETURN = 0.32;
const FLASH_END_RETURN = 0.45;
const FLASH_BREATH_SWAY = 0.008;
export const LOBBY_EMOTES = EMOTES.map((emote, index) => ({
    index,
    name: emote.name,
}));

const fallback: LobbyAvatarSource = {
    id: "square",
    name: "Square",
    url: DEFAULT_LOBBY_AVATAR_URL,
};
const bytes = new Map<string, Promise<ArrayBuffer>>();
const prepared = new Map<string, Promise<LobbyAvatar>>();
let motionClips: Promise<ClipLibrary> | undefined;
let emoteClips: Promise<ClipLibrary> | undefined;

function validScale(scale?: number) {
    return Number.isFinite(scale) && scale > 0
        ? Math.min(4, Math.max(0.2, scale))
        : 1;
}

/** Pure builtin/direct-URL selection; custom metadata belongs to avatarSelection.ts. */
export async function resolveLobbyAvatar(
    identity?: LobbyAvatarIdentity
): Promise<LobbyAvatarSource> {
    const scale = validScale(identity?.settings?.default_vrm_scale);
    const directUrl = identity?.vrmUrl || identity?.VRM;
    if (directUrl)
        return { id: directUrl, name: "Avatar", url: directUrl, scale };

    let id = identity?.settings?.vrm;
    if (!id) id = defaultAvatarId(identity);
    else if (id === "square" || id === "check") id = pfpAvatarId(identity);
    if (id === "square") return { ...fallback, scale };
    const builtin = Object.values(catalogue).find((avatar) => avatar.id === id);
    if (builtin)
        return { id: builtin.id, name: builtin.name, url: builtin.url, scale };

    // Custom metadata is resolved by avatarSelection.ts outside this renderer's
    // dependency layer. Callers pass that source URL into preloading/creation.
    return { ...fallback, scale };
}

async function fetchAsset(url: string) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok)
            throw new Error(`Could not load avatar asset (${response.status})`);
        const data = await response.arrayBuffer();
        if (data.byteLength > 32 * 1024 * 1024)
            throw new Error("Avatar asset is too large");
        return data;
    } finally {
        window.clearTimeout(timeout);
    }
}

function avatarBytes(url: string) {
    let cached = bytes.get(url);
    if (!cached) {
        cached = fetchAsset(url).catch((error) => {
            bytes.delete(url);
            throw error;
        });
        bytes.set(url, cached);
        // Re-parsing cached bytes gives each visitor independent bones and materials.
        while (bytes.size > 4) bytes.delete(bytes.keys().next().value);
    }
    return cached;
}

async function loadClipLibrary(kind: "motion" | "emotes") {
    const data = await fetchAsset(`/lobby/native-avatar-${kind}.json`);
    return JSON.parse(new TextDecoder().decode(data)) as ClipLibrary;
}

function getMotionClips() {
    return (motionClips ||= (
        useCC0MotionPreview()
            ? loadCC0MotionPreview(fetchAsset)
            : loadDefaultMotion(fetchAsset)
    ).catch((error) => {
        motionClips = undefined;
        throw error;
    }));
}

function getEmoteClips() {
    return (emoteClips ||= loadClipLibrary("emotes").catch((error) => {
        emoteClips = undefined;
        throw error;
    }));
}

// Legacy emote timeScale controls blend duration, not clip playback speed.
function playbackSpeed(name: string) {
    if (EMOTES.some((emote) => emote.name === name)) return 1;
    return (
        POSSIBLE_ACTIONS.find((action) => action.name === name)?.timeScale || 1
    );
}

function animationName(value: string | number) {
    if (typeof value === "number") return EMOTES[value]?.name || "IDLE";
    const upper = value.toUpperCase();
    return upper === FLASH_ANIMATION_NAME ||
        isTravelAnimation(upper) ||
        (LOBBY_TRANSITIONS as readonly string[]).includes(upper) ||
        LOBBY_MOTION_CLIPS.includes(upper) ||
        LOBBY_TURN_CLIPS.includes(upper) ||
        POSSIBLE_ACTIONS.some((action) => action.name === upper)
        ? upper
        : "IDLE";
}

let referenceRig: THREE.Object3D | undefined;

/** Same native Mixamo retargeting, using only the modern Three constructors. */
function retargetAnimation(
    _scene: THREE.Object3D,
    vrm: ModernVRM,
    raw: RawClip
) {
    referenceRig ||= new THREE.ObjectLoader().parse(mixamoRig);
    referenceRig.updateMatrixWorld(true);
    const vector = new THREE.Vector3();
    const referenceHeight = referenceRig
        .getObjectByName("mixamorigHips")
        .getWorldPosition(vector).y;
    const hipsHeight = vrm.humanoid
        .getNormalizedBoneNode("hips")
        .getWorldPosition(vector).y;
    const rootHeight = vrm.scene.getWorldPosition(vector).y;
    const hipsScale = Math.abs(hipsHeight - rootHeight) / referenceHeight;
    const clip = THREE.AnimationClip.parse(raw);
    const tracks: THREE.KeyframeTrack[] = [];
    for (const track of clip.tracks) {
        const [source, property] = track.name.split(".");
        const boneName = mixamoRigMap[source];
        if (!boneName) continue;
        const bone = vrm.humanoid.getNormalizedBoneNode(boneName);
        if (!bone) continue;
        if (track instanceof THREE.QuaternionKeyframeTrack) {
            tracks.push(
                new THREE.QuaternionKeyframeTrack(
                    `${bone.name}.${property}`,
                    track.times,
                    track.values.map((value, index) =>
                        vrm.meta?.metaVersion === "0" && index % 2 === 0
                            ? -value
                            : value
                    )
                )
            );
        } else if (track instanceof THREE.VectorKeyframeTrack) {
            tracks.push(
                new THREE.VectorKeyframeTrack(
                    `${bone.name}.${property}`,
                    track.times,
                    track.values.map(
                        (value, index) =>
                            (vrm.meta?.metaVersion === "0" && index % 3 !== 1
                                ? -value
                                : value) * hipsScale
                    )
                )
            );
        }
    }
    return new THREE.AnimationClip("vrmAnimation", clip.duration, tracks);
}

async function parseAvatar(url: string): Promise<LobbyAvatar> {
    const [data, basics] = await Promise.all([
        avatarBytes(url),
        getMotionClips(),
    ]);
    const draco = new DRACOLoader().setDecoderPath("/draco/");
    const loader = (new GLTFLoader() as unknown as ModernAvatarLoader)
        .setCrossOrigin("anonymous")
        .setDRACOLoader(draco);
    loader.register((parser) => {
        const plugin = new VRMLoaderPlugin(parser, {
            autoUpdateHumanBones: true,
        });
        // Matches Oncyber's loader: retain native GLTF materials instead of MToon.
        plugin.mtoonMaterialPlugin.getMaterialType = () => null;
        plugin.mtoonMaterialPlugin.extendMaterialParams = async () => {};
        return plugin;
    });
    let vrm: ModernVRM;
    try {
        const base = new URL(".", new URL(url, window.location.href)).href;
        const gltf = await loader.parseAsync(data.slice(0), base);
        vrm = gltf.userData.vrm;
        if (!vrm?.humanoid?.getNormalizedBoneNode("hips")) {
            disposeAvatarGraph(gltf.scene);
            throw new Error("This model has no supported VRM humanoid");
        }
    } finally {
        draco.dispose();
    }

    const root = new THREE.Group();
    root.name = "oncyber-lobby-avatar";
    root.add(vrm.scene);
    vrm.scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(vrm.scene);
    const rawHeight = bounds.max.y - bounds.min.y;
    if (!Number.isFinite(rawHeight) || rawHeight <= 0) {
        disposeAvatarGraph(root);
        throw new Error("This avatar has invalid bounds");
    }

    // Share avatar-only lighting with native spaces; preserve authored unlit surfaces.
    // Convert before both live meshes and crowd bake parts capture materials.
    applyNativeAvatarMaterials(vrm.scene);

    const mixer = new THREE.AnimationMixer(vrm.scene);
    const actions = new Map<string, THREE.AnimationAction>();
    const motionClips: Record<string, LobbyClipMetadata> = {};
    const locomotion = createLobbyLocomotion(motionClips, Math.random());
    let locomotionMode = false;
    let samplingTravel = false;
    let travelPreparation: Promise<void> | undefined;
    let procedural: ReturnType<typeof createProceduralRig>;
    let inertia: ReturnType<typeof createMotionInertia>;
    let sampledPose: LobbyLocomotionPose | undefined;
    const nativeMotion: LobbyMotionInput = {
        speed: 0,
        grounded: true,
        warping: true,
    };
    const lookup = (name: string) =>
        vrm.humanoid.getNormalizedBoneNode(
            name as Parameters<typeof vrm.humanoid.getNormalizedBoneNode>[0]
        );
    let returningEmote: THREE.AnimationAction | undefined;
    let returnElapsed = 0;
    // Leaving the raised Flash arm needs a longer, still-moving handoff than
    // an emote; a frozen 0.18s fade reads as the arm snapping down.
    let returnDuration = EMOTE_RETURN;
    let returnAdvances = false;
    let current: THREE.AnimationAction | undefined;
    let requested = "IDLE";
    let disposed = false;
    let flashPreparation: Promise<void> | undefined;
    let flashGeneration = 0;
    let flashPending = false;
    let flashActive = false;
    let flashEnding = false;
    let flashTime = 0;
    let flashHold = 0;
    let flashSample = 0;
    let flashStill = false;
    let pendingName: string | undefined;
    let failedEmoteLoad = false;
    let allClips = basics;
    let baking = false;
    let bakeQueue: Promise<unknown> = Promise.resolve();
    const bakedClips = new Map<string, Promise<LobbyBakedClip>>();

    function addAction(name: string) {
        if (actions.has(name) || !allClips[name]) return;
        const clip = retargetAnimation(
            vrm.scene,
            vrm,
            isTravelAnimation(name) || name === FLASH_ANIMATION_NAME
                ? allClips[name]
                : sanitizeLobbyAnimation(
                      allClips[name],
                      name,
                      basics.IDLE?.tracks?.find(
                          (track) => track.name === "mixamorigHips.position"
                      )?.values
                  )
        ) as unknown as THREE.AnimationClip;
        clip.name = name;
        const action = mixer.clipAction(clip);
        const native = POSSIBLE_ACTIONS.find((item) => item.name === name);
        action.setEffectiveTimeScale(playbackSpeed(name));
        const loop =
            name === FLASH_ANIMATION_NAME
                ? false
                : isTravelAnimation(name)
                ? travelAnimationLoops(name)
                : native?.loop !== false && !isMotionOneShot(name);
        action.setLoop(
            loop ? THREE.LoopRepeat : THREE.LoopOnce,
            loop ? Infinity : 1
        );
        action.clampWhenFinished = !loop;
        actions.set(name, action);
        motionClips[name] = {
            duration: clip.duration,
            loop,
        };
    }

    // Retarget before applying display scale, so hips translations are scaled once.
    Object.keys(basics).forEach(addAction);
    for (const { clip, metadata } of authorLobbyTransitions(
        THREE as unknown as Parameters<typeof authorLobbyTransitions>[0],
        actions.get("IDLE")?.getClip() as unknown as Parameters<
            typeof authorLobbyTransitions
        >[1],
        actions.get("WALK")?.getClip() as unknown as Parameters<
            typeof authorLobbyTransitions
        >[2],
        lookup as unknown as Parameters<typeof createProceduralRig>[2]
    )) {
        const action = mixer.clipAction(clip as unknown as THREE.AnimationClip);
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
        actions.set(clip.name, action);
        motionClips[clip.name] = metadata;
    }
    vrm.scene.position.y -= bounds.min.y;
    root.scale.setScalar(1.8 / rawHeight);
    await calibrateLobbyContacts(
        THREE as unknown as Parameters<typeof authorLobbyTransitions>[0],
        root as unknown as Parameters<typeof createProceduralRig>[1],
        Array.from(actions.values(), (action) =>
            action.getClip()
        ) as unknown as Parameters<typeof calibrateLobbyContacts>[2],
        motionClips,
        lookup as unknown as Parameters<typeof createProceduralRig>[2]
    );
    const turns = await authorMovingTurns(
        THREE as unknown as Parameters<typeof authorMovingTurns>[0],
        root as unknown as Parameters<typeof authorMovingTurns>[1],
        Array.from(actions.values(), (action) =>
            action.getClip()
        ) as unknown as Parameters<typeof authorMovingTurns>[2],
        motionClips,
        lookup as unknown as Parameters<typeof authorMovingTurns>[4]
    );
    for (const { clip, metadata } of turns) {
        const action = mixer.clipAction(clip as unknown as THREE.AnimationClip);
        action.setLoop(
            metadata.loop ? THREE.LoopRepeat : THREE.LoopOnce,
            metadata.loop ? Infinity : 1
        );
        action.clampWhenFinished = !metadata.loop;
        actions.set(clip.name, action);
        motionClips[clip.name] = metadata;
    }
    await calibrateLobbyContacts(
        THREE as unknown as Parameters<typeof calibrateLobbyContacts>[0],
        root as unknown as Parameters<typeof authorMovingTurns>[1],
        turns.map((t) => t.clip),
        motionClips,
        lookup as unknown as Parameters<typeof authorMovingTurns>[4]
    );
    vrm.scene.traverse((object) => {
        if ((object as THREE.Mesh).isMesh) object.frustumCulled = false;
    });

    // The crowd shares geometry and sampled motion, never this avatar's live bones.
    // Keep a complete rest transform snapshot: clips may not key every bone.
    const restTransforms: Array<{
        object: THREE.Object3D;
        position: THREE.Vector3;
        quaternion: THREE.Quaternion;
        scale: THREE.Vector3;
    }> = [];
    const bakeMeshes: THREE.Mesh[] = [];
    let bakeSupported = !vrm.springBoneManager?.joints?.size;
    vrm.scene.traverse((object) => {
        restTransforms.push({
            object,
            position: object.position.clone(),
            quaternion: object.quaternion.clone(),
            scale: object.scale.clone(),
        });
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        const material = mesh.material as THREE.Material;
        const skinned = mesh as THREE.SkinnedMesh;
        if (
            Array.isArray(mesh.material) ||
            !supportsNativeAvatarMaterial(material) ||
            Object.values(mesh.geometry.morphAttributes).some(
                (targets) => targets.length
            ) ||
            !mesh.geometry.getAttribute("position") ||
            (skinned.isSkinnedMesh &&
                (!mesh.geometry.getAttribute("skinIndex") ||
                    !mesh.geometry.getAttribute("skinWeight") ||
                    !skinned.skeleton?.bones.length ||
                    skinned.skeleton.bones.length > 256 ||
                    skinned.skeleton.boneInverses.length !==
                        skinned.skeleton.bones.length))
        )
            bakeSupported = false;
        bakeMeshes.push(mesh);
    });
    if (!bakeMeshes.length || bakeMeshes.length > 32) bakeSupported = false;
    const bakeParts: LobbyAvatarBakePart[] | undefined = bakeSupported
        ? bakeMeshes.map((mesh) => ({
              geometry: mesh.geometry,
              material: mesh.material as THREE.Material,
              boneCount: (mesh as THREE.SkinnedMesh).isSkinnedMesh
                  ? (mesh as THREE.SkinnedMesh).skeleton.bones.length
                  : 1,
              isPfp: mesh.name.toLowerCase().endsWith("_pfp"),
          }))
        : undefined;

    function activate(name: string) {
        const action = actions.get(name);
        if (
            !action ||
            (current === action && !locomotionMode && !samplingTravel) ||
            disposed
        )
            return;
        if (locomotionMode || samplingTravel) {
            locomotionMode = false;
            samplingTravel = false;
            returningEmote = undefined;
            for (const [key, other] of actions) {
                other.stopFading().stopWarping();
                other.setEffectiveTimeScale(playbackSpeed(key));
                if (other !== current) other.stop();
            }
            current?.setEffectiveWeight(1);
        }
        const previous = current;
        current = action;
        action.reset().setEffectiveWeight(1).play();
        if (previous) {
            previous.fadeOut(0.18);
            action.fadeIn(0.18);
        }
    }

    function applyLocomotion(step: number, motion: LobbyMotionInput) {
        const pose = (sampledPose = locomotion.update(step, motion));
        if (!locomotionMode) {
            returningEmote =
                current && !LOBBY_MOTION_CLIPS.includes(current.getClip().name)
                    ? current
                    : undefined;
            returnElapsed = 0;
            if (returningEmote?.getClip().name !== FLASH_ANIMATION_NAME) {
                returnDuration = EMOTE_RETURN;
                returnAdvances = false;
            }
        }
        locomotionMode = true;
        samplingTravel = false;
        // Invalidates pending emotes without requesting an unknown asset.
        requested = "@locomotion";
        for (const action of actions.values()) {
            action.stopFading().stopWarping().setEffectiveWeight(0);
            action.setEffectiveTimeScale(0);
        }
        const sample = (name: string, time: number, weight: number) => {
            const action = actions.get(name);
            if (!action || weight <= 0) return;
            action.enabled = true;
            action.paused = false;
            if (!action.isScheduled()) action.play();
            action.time = time;
            action.setEffectiveWeight(weight);
        };
        const dominant = pose.blend < 0.5 ? pose.primary : pose.secondary;
        if (returningEmote) {
            returnElapsed = Math.min(returnDuration, returnElapsed + step);
            const linear = returnElapsed / returnDuration;
            const mix = linear * linear * (3 - 2 * linear);
            if (returnAdvances)
                returningEmote.time = Math.min(
                    returningEmote.getClip().duration,
                    returningEmote.time + step
                );
            sample(returningEmote.getClip().name, returningEmote.time, 1 - mix);
            sample(dominant.name, dominant.time, mix);
            if (linear >= 1) {
                returningEmote = undefined;
                returnDuration = EMOTE_RETURN;
                returnAdvances = false;
            }
        } else {
            sample(pose.primary.name, pose.primary.time, 1 - pose.blend);
            sample(pose.secondary.name, pose.secondary.time, pose.blend);
        }
        current = actions.get(dominant.name);
        mixer.update(0);
    }

    async function ensureAction(name: string) {
        if (actions.has(name)) return;
        const extra =
            name === FLASH_ANIMATION_NAME
                ? (await loadFlashAnimationPack(fetchAsset)).clips
                : isTravelAnimation(name)
                ? (await loadTravelAnimationPack(fetchAsset)).clips
                : name === "WAVING"
                ? await loadClipLibrary("motion")
                : await getEmoteClips();
        if (disposed) return;
        procedural?.restore();
        inertia?.restore();
        inertia?.reset();
        // The native retargeter's height calculation must use unscaled bones.
        const scale = root.scale.clone();
        const pose = vrm.humanoid.getNormalizedPose();
        vrm.humanoid.resetNormalizedPose();
        root.scale.setScalar(1);
        root.updateMatrixWorld(true);
        allClips = { ...basics, ...extra };
        Object.keys(extra).forEach(addAction);
        root.scale.copy(scale);
        vrm.humanoid.setNormalizedPose(pose);
        root.updateMatrixWorld(true);
    }

    function prepareTravel() {
        return (travelPreparation ||= bakeQueue
            .catch(() => undefined)
            .then(() => ensureAction("TRAVEL_ATTACK"))
            .catch((error) => {
                travelPreparation = undefined;
                throw error;
            }));
    }

    function prepareFlash() {
        if (disposed)
            return Promise.reject(
                new DOMException("Avatar disposed", "AbortError")
            );
        if (!flashPreparation) {
            flashPreparation = bakeQueue
                .catch(() => undefined)
                .then(() => ensureAction(FLASH_ANIMATION_NAME))
                .catch((error) => {
                    flashPreparation = undefined;
                    throw error;
                });
            // Baking and lazy retargeting both temporarily touch the skeleton.
            bakeQueue = flashPreparation.then(
                () => undefined,
                () => undefined
            );
        }
        return flashPreparation;
    }

    function stopFlash() {
        if (flashActive) {
            // Keep lowering the arm from the hold while locomotion fades in.
            returnDuration = FLASH_INTERRUPT_RETURN;
            returnAdvances = true;
        }
        flashGeneration++;
        flashPending = flashActive = flashEnding = false;
        if (requested === FLASH_ANIMATION_NAME) requested = "IDLE";
    }

    function endFlash() {
        if (!flashActive) return stopFlash();
        if (flashEnding) return;
        flashEnding = true;
        // Lower the arms from wherever the breathing hold currently is.
        flashTime = flashSample;
    }

    // While holding, the pose breathes: the chest rises and the arms drift
    // slightly back along the gesture, so the hold never reads as a freeze.
    // Spine and chest lift; the neck counters so the head stays level.
    const breathBones = (
        [
            ["spine", 0.018],
            ["chest", 0.026],
            ["neck", -0.03],
        ] as const
    )
        .map(([name, bend]) => ({ bone: lookup(name), bend }))
        .filter(({ bone }) => bone);
    const breathRest = breathBones.map(() => new THREE.Quaternion());
    const breathTurn = new THREE.Quaternion();
    const breathAxis = new THREE.Vector3(1, 0, 0);
    function breathe(weight: number) {
        if (weight <= 0 || !breathBones.length) return false;
        const phase = Math.sin((flashHold / FLASH_BREATH_PERIOD) * Math.PI * 2);
        breathBones.forEach(({ bone, bend }, index) => {
            breathRest[index].copy(bone.quaternion);
            breathTurn.setFromAxisAngle(breathAxis, -bend * phase * weight);
            bone.quaternion.multiply(breathTurn);
        });
        return true;
    }
    function settleBreath() {
        breathBones.forEach(({ bone }, index) =>
            bone.quaternion.copy(breathRest[index])
        );
    }

    async function playFlash(options: { reducedMotion?: boolean } = {}) {
        const generation = ++flashGeneration;
        flashPending = true;
        try {
            await prepareFlash();
            if (disposed || generation !== flashGeneration) return;
            flashPending = false;
            flashActive = true;
            flashEnding = false;
            flashHold = 0;
            flashStill = !!options.reducedMotion;
            flashTime = options.reducedMotion ? FLASH_HOLD_TIME_MS / 1000 : 0;
            flashSample = flashTime;
            procedural.restore();
            inertia.restore();
            inertia.reset();
            requested = FLASH_ANIMATION_NAME;
            const action = actions.get(FLASH_ANIMATION_NAME);
            action.reset();
            activate(FLASH_ANIMATION_NAME);
            action.play().setEffectiveTimeScale(0);
            action.time = flashTime;
            if (options.reducedMotion) {
                for (const other of actions.values())
                    if (other !== action) other.stop();
                action.stopFading().setEffectiveWeight(1);
            }
            mixer.update(0);
            vrm.update(0);
        } catch (error) {
            if (generation === flashGeneration) flashPending = false;
            throw error;
        }
    }

    function sampleTravelPose(pose: TravelPoseSample) {
        if (flashPending || flashActive) stopFlash();
        if (disposed || baking) return false;
        const resolve = (name: TravelPoseSample["name"]) =>
            actions.get(name) ||
            (name.startsWith("IDLE") ? actions.get("IDLE") : undefined);
        const target = resolve(pose.name);
        const previous = pose.previous && resolve(pose.previous.name);
        if (!target || (pose.previous && !previous)) return false;
        procedural.restore();
        inertia.restore();
        inertia.reset();
        requested = pose.name;
        locomotionMode = false;
        samplingTravel = true;
        returningEmote = undefined;
        for (const action of actions.values()) {
            action.stopFading().stopWarping().setEffectiveWeight(0);
            action.setEffectiveTimeScale(0);
        }
        const sample = (
            action: THREE.AnimationAction,
            time: number,
            weight: number
        ) => {
            if (weight <= 0) return;
            action.enabled = true;
            action.paused = false;
            if (!action.isScheduled()) action.play();
            const duration = action.getClip().duration;
            const seconds = Number.isFinite(time) ? Math.max(0, time) : 0;
            action.time =
                action.loop === THREE.LoopOnce
                    ? Math.min(duration, seconds)
                    : seconds % duration;
            action.setEffectiveWeight(weight);
        };
        const blend =
            previous && Number.isFinite(pose.blend)
                ? Math.max(0, Math.min(1, pose.blend))
                : 1;
        if (previous && previous !== target)
            sample(previous, pose.previous.time, 1 - blend);
        sample(target, pose.time, previous === target ? 1 : blend);
        current = previous && blend < 0.5 ? previous : target;
        mixer.update(0);
        vrm.update(0);
        return true;
    }

    function requestAnimation(name: string) {
        requested = name;
        if (actions.has(name)) {
            activate(name);
        } else if (pendingName !== name && !failedEmoteLoad) {
            pendingName = name;
            void ensureAction(name)
                .then(() => {
                    if (!disposed && requested === name) activate(name);
                })
                .catch(() => {
                    failedEmoteLoad = true;
                })
                .finally(() => {
                    if (pendingName === name) pendingName = undefined;
                });
        }
    }

    async function sampleClip(
        name: string,
        targetFps: number
    ): Promise<LobbyBakedClip> {
        if (disposed) throw new DOMException("Avatar disposed", "AbortError");
        await ensureAction(name);
        if (disposed) throw new DOMException("Avatar disposed", "AbortError");
        const clip = actions.get(name)?.getClip();
        if (!clip || !bakeParts)
            throw new Error("Avatar animation cannot be baked");
        const duration = clip.duration;
        const frameCount = Math.ceil(duration * targetFps) + 1;
        const matrixCount = bakeParts.reduce(
            (sum, part) => sum + part.boneCount,
            0
        );
        if (
            !Number.isFinite(duration) ||
            duration <= 0 ||
            frameCount > 4096 ||
            frameCount * matrixCount * 16 * 4 > 32 * 1024 * 1024
        ) {
            throw new Error("Avatar animation exceeds the crowd bake budget");
        }
        const native = POSSIBLE_ACTIONS.find((item) => item.name === name);
        const result: LobbyBakedClip = {
            name,
            duration,
            frameCount,
            fps: (frameCount - 1) / duration,
            loop: motionClips[name]?.loop !== false && native?.loop !== false,
            timeScale: playbackSpeed(name),
            parts: bakeParts.map(
                (part) => new Float32Array(frameCount * part.boneCount * 16)
            ),
        };
        procedural?.restore();
        inertia?.restore();
        inertia?.reset();
        procedural?.reset();
        const previousTransforms = restTransforms.map(({ object }) => ({
            object,
            position: object.position.clone(),
            quaternion: object.quaternion.clone(),
            scale: object.scale.clone(),
        }));
        const previousRequest = requested;
        const sampleMixer = new THREE.AnimationMixer(vrm.scene);
        const inverseRoot = new THREE.Matrix4();
        const meshToRoot = new THREE.Matrix4();
        const matrix = new THREE.Matrix4();
        baking = true;
        try {
            vrm.humanoid.resetNormalizedPose();
            for (const pose of restTransforms) {
                pose.object.position.copy(pose.position);
                pose.object.quaternion.copy(pose.quaternion);
                pose.object.scale.copy(pose.scale);
            }
            // A private mixer preserves the live mixer's crossfades and action times.
            // LoopOnce lets the last sample reach the terminal pose instead of wrapping.
            sampleMixer.stopAllAction();
            sampleMixer.time = 0;
            const action = sampleMixer.clipAction(clip);
            action.setLoop(THREE.LoopOnce, 1).setEffectiveTimeScale(1);
            action.clampWhenFinished = true;
            action.reset().play();
            for (let frame = 0; frame < frameCount; frame++) {
                if (disposed)
                    throw new DOMException("Avatar disposed", "AbortError");
                sampleMixer.setTime((duration * frame) / (frameCount - 1));
                vrm.update(0);
                root.updateMatrixWorld(true);
                inverseRoot.copy(root.matrixWorld).invert();
                bakeMeshes.forEach((mesh, partIndex) => {
                    const skinned = mesh as THREE.SkinnedMesh;
                    meshToRoot.multiplyMatrices(inverseRoot, mesh.matrixWorld);
                    const offset = frame * bakeParts[partIndex].boneCount * 16;
                    if (skinned.isSkinnedMesh) {
                        meshToRoot.multiply(skinned.bindMatrixInverse);
                        skinned.skeleton.bones.forEach((bone, boneIndex) => {
                            matrix
                                .copy(meshToRoot)
                                .multiply(bone.matrixWorld)
                                .multiply(
                                    skinned.skeleton.boneInverses[boneIndex]
                                )
                                .multiply(skinned.bindMatrix);
                            matrix.toArray(
                                result.parts[partIndex],
                                offset + boneIndex * 16
                            );
                        });
                    } else {
                        meshToRoot.toArray(result.parts[partIndex], offset);
                    }
                });
                // Yield while warming a model; do not block landing input for a whole clip.
                if (frame % 8 === 7 && frame < frameCount - 1)
                    await new Promise<void>((resolve) =>
                        setTimeout(resolve, 0)
                    );
            }
            return result;
        } finally {
            sampleMixer.stopAllAction();
            sampleMixer.uncacheRoot(vrm.scene);
            baking = false;
            if (!disposed) {
                for (const pose of previousTransforms) {
                    pose.object.position.copy(pose.position);
                    pose.object.quaternion.copy(pose.quaternion);
                    pose.object.scale.copy(pose.scale);
                }
                root.updateMatrixWorld(true);
                if (
                    previousRequest !== requested &&
                    requested !== "@locomotion"
                )
                    requestAnimation(requested);
            }
        }
    }

    function bakeClip(animation: string | number, fps = 30) {
        const name = animationName(animation);
        const targetFps = Number.isFinite(fps)
            ? Math.min(60, Math.max(1, fps))
            : 30;
        const key = `${name}:${targetFps}`;
        let promise = bakedClips.get(key);
        if (!promise) {
            // Retargeting and sampling both touch the skeleton, so concurrent clips queue.
            promise = bakeQueue
                .catch(() => undefined)
                .then(() => sampleClip(name, targetFps));
            bakeQueue = promise.then(
                () => undefined,
                () => undefined
            );
            bakedClips.set(key, promise);
            promise.catch(() => {
                if (bakedClips.get(key) === promise) bakedClips.delete(key);
            });
        }
        return promise;
    }

    activate("IDLE");
    mixer.update(0);
    vrm.update(0);
    procedural = createProceduralRig(
        THREE as unknown as Parameters<typeof authorLobbyTransitions>[0],
        root as unknown as Parameters<typeof createProceduralRig>[1],
        lookup as unknown as Parameters<typeof createProceduralRig>[2],
        motionClips
    );
    const normalizedNodes = new Set<THREE.Object3D>();
    for (const action of actions.values())
        for (const track of action.getClip().tracks) {
            const node = vrm.scene.getObjectByName(
                track.name.slice(0, track.name.lastIndexOf("."))
            );
            if (node) normalizedNodes.add(node);
        }
    inertia = createMotionInertia(
        THREE as unknown as Parameters<typeof authorLobbyTransitions>[0],
        Array.from(normalizedNodes) as unknown as Parameters<
            typeof createMotionInertia
        >[1],
        lookup("hips") as unknown as Parameters<typeof createMotionInertia>[2]
    );
    const avatar: LobbyAvatar = {
        root,
        height: 1.8,
        sourceUrl: url,
        bakeParts,
        bakeClip: bakeSupported ? bakeClip : undefined,
        releaseBakedClip(animation, fps = 30) {
            const targetFps = Number.isFinite(fps)
                ? Math.min(60, Math.max(1, fps))
                : 30;
            bakedClips.delete(`${animationName(animation)}:${targetFps}`);
        },
        motionClips,
        prepareTravel,
        prepareFlash,
        playFlash,
        stopFlash,
        endFlash,
        sampleTravelPose,
        update(dt, animation, motion) {
            if (disposed) return;
            const semantic = motion && animation === undefined;
            if (
                (flashPending || flashActive) &&
                ((motion && (motion.speed > 0.08 || !motion.grounded)) ||
                    (animation !== undefined &&
                        animationName(animation) !== "IDLE" &&
                        animationName(animation) !== FLASH_ANIMATION_NAME))
            )
                stopFlash();
            if (baking) {
                if (semantic) requested = "@locomotion";
                else if (animation !== undefined)
                    requested = animationName(animation);
                return;
            }
            const step = Math.max(
                0,
                Math.min(Number.isFinite(dt) ? dt : 0, 0.1)
            );
            procedural.restore();
            inertia.restore();
            if (flashActive) {
                const action = actions.get(FLASH_ANIMATION_NAME);
                const hold = FLASH_HOLD_TIME_MS / 1000;
                const duration = action.getClip().duration;
                let sample: number;
                let breath = 0;
                if (flashEnding) {
                    // The authored take lowers the arms back toward idle.
                    flashTime = Math.min(duration, flashTime + step);
                    sample = flashTime;
                    breath = flashStill
                        ? 0
                        : Math.max(0, 1 - (flashTime - hold) / 0.3);
                } else {
                    flashTime = Math.min(hold, flashTime + step);
                    if (flashTime >= hold) flashHold += step;
                    breath = flashStill ? 0 : Math.min(1, flashHold / 0.8);
                    // Ease a few frames back and forth along the gesture.
                    sample =
                        flashTime -
                        FLASH_BREATH_SWAY *
                            breath *
                            (0.5 -
                                0.5 *
                                    Math.cos(
                                        (flashHold / FLASH_BREATH_PERIOD) *
                                            Math.PI *
                                            2
                                    ));
                }
                flashSample = sample;
                action.setEffectiveTimeScale(0);
                action.time = Math.min(duration, sample);
                // Advance mixer fades; the sample itself is driven here.
                mixer.update(step);
                inertia.reset();
                const breathing = breathe(breath);
                vrm.update(step);
                if (breathing) settleBreath();
                // The authored take settles into its own idle, not ours.
                // Hand its tail to locomotion so the arms land in our idle.
                if (
                    flashEnding &&
                    flashTime >= Math.max(hold, duration - FLASH_END_RETURN)
                ) {
                    returnDuration = FLASH_END_RETURN;
                    returnAdvances = true;
                    flashActive = flashEnding = false;
                    flashGeneration++;
                    if (requested === FLASH_ANIMATION_NAME) requested = "IDLE";
                }
                return;
            }
            if (semantic) {
                Object.assign(nativeMotion, motion, { warping: true });
                applyLocomotion(step, nativeMotion);
            } else {
                if (animation !== undefined)
                    requestAnimation(animationName(animation));
                mixer.update(step);
            }
            if (!semantic && isTravelAnimation(requested)) {
                inertia.reset();
                vrm.update(step);
                return;
            }
            const detailed =
                semantic &&
                !returningEmote &&
                motion.procedural !== false &&
                motion.quality !== "crowd";
            inertia.update(
                step,
                detailed
                    ? `${sampledPose.primary.name}:${sampledPose.secondary.name}`
                    : undefined
            );
            procedural.update(
                step,
                semantic && !returningEmote ? nativeMotion : undefined,
                sampledPose
            );
            vrm.update(step);
        },
        async playEmote(name) {
            stopFlash();
            const next = animationName(name);
            requested = next;
            await bakeQueue.catch(() => undefined);
            await ensureAction(next);
            if (!disposed && requested === next) activate(next);
        },
        dispose() {
            if (disposed) return;
            stopFlash();
            disposed = true;
            mixer.stopAllAction();
            mixer.uncacheRoot(vrm.scene);
            root.removeFromParent();
            disposeAvatarGraph(root);
            actions.clear();
            bakedClips.clear();
        },
    };
    return avatar;
}

async function parseWithFallback(url: string) {
    try {
        return await parseAvatar(url);
    } catch (error) {
        if (url === LOCAL_FALLBACK_AVATAR_URL) throw error;
        return parseAvatar(LOCAL_FALLBACK_AVATAR_URL);
    }
}

/** Prepare bones and native motion clips during landing idle; creates no renderer. */
export async function preloadLobbyAvatar(
    identityOrUrl?: LobbyAvatarIdentity | string
): Promise<LobbyAvatarSource> {
    const source =
        typeof identityOrUrl === "string"
            ? { id: identityOrUrl, name: "Avatar", url: identityOrUrl }
            : await resolveLobbyAvatar(identityOrUrl);
    let warm = prepared.get(source.url);
    if (!warm) {
        warm = parseWithFallback(source.url);
        prepared.set(source.url, warm);
        warm.catch(() => {
            if (prepared.get(source.url) === warm) prepared.delete(source.url);
        });
        while (prepared.size > 2) {
            const oldest = prepared.keys().next().value;
            const unused = prepared.get(oldest);
            prepared.delete(oldest);
            void unused
                .then((avatar) => avatar.dispose())
                .catch(() => undefined);
        }
    }
    const avatar = await warm;
    return source;
}

async function applyProfilePhoto(avatar: LobbyAvatar, url: string) {
    const pfpMeshes: THREE.Mesh[] = [];
    avatar.root.traverse((object) => {
        if (
            (object as THREE.Mesh).isMesh &&
            object.name.toLowerCase().endsWith("_pfp")
        ) {
            pfpMeshes.push(object as THREE.Mesh);
        }
    });
    if (!pfpMeshes.length) return;
    const loader = new THREE.TextureLoader().setCrossOrigin("anonymous");
    // A dead or blocked picture shows the guest portrait, as spaces do,
    // rather than leaving the head screen blank.
    const texture = await loader
        .loadAsync(url)
        .catch((error) =>
            url === LOBBY_GUEST_PORTRAIT
                ? Promise.reject(error)
                : loader.loadAsync(LOBBY_GUEST_PORTRAIT)
        );
    // A disposed avatar is detached and cleared by createAvatar's cancellation wrapper.
    if (avatar.root.userData.lobbyDisposed) {
        texture.dispose();
        return;
    }
    texture.flipY = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    pfpMeshes.forEach((mesh) => {
        const previous = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];
        mesh.material = new MeshBasicNodeMaterial({
            map: texture,
            side: THREE.DoubleSide,
        });
        const retired = (avatar.root.userData.lobbyRetiredMaterials ||=
            new Set<THREE.Material>()) as Set<THREE.Material>;
        previous.forEach((material) => retired.add(material));
    });
}

/** Each caller owns the returned skeleton, animation mixer and GPU resources. */
export async function createAvatar(
    url = DEFAULT_LOBBY_AVATAR_URL,
    options: AvatarOptions = {}
): Promise<LobbyAvatar> {
    if (options.signal?.aborted)
        throw new DOMException("Avatar loading cancelled", "AbortError");
    const warm = prepared.get(url);
    if (warm) prepared.delete(url);
    const avatar = await (warm || parseWithFallback(url));
    if (options.signal?.aborted) {
        avatar.dispose();
        throw new DOMException("Avatar loading cancelled", "AbortError");
    }
    const scale = validScale(options.scale);
    avatar.root.scale.multiplyScalar(scale);
    avatar.height *= scale;
    const dispose = avatar.dispose;
    avatar.dispose = () => {
        if (avatar.root.userData.lobbyDisposed) return;
        avatar.root.userData.lobbyDisposed = true;
        dispose();
    };
    if (options.profilePhoto) {
        void applyProfilePhoto(avatar, options.profilePhoto).catch(
            () => undefined
        );
    }
    return avatar;
}
