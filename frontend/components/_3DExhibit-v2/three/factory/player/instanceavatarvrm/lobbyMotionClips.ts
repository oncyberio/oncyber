import * as THREE from "three";
import { loadDefaultMotion } from "@features/lobby/optionalMotionPack";
import {
    sanitizeLobbyAnimation,
    type LobbyClipMetadata,
} from "@features/lobby/locomotion";
import {
    authorLobbyTransitions,
    calibrateLobbyContacts,
} from "@features/lobby/advancedMotion";
import { authorMovingTurns } from "@features/lobby/authorMovingTurns";
import { isMotionOneShot } from "@features/lobby/motionNames";
import retarget from "./baker/loadmixamoanimation";

export const LOBBY_CLIP_PREFIX = "@lobby/";
let library: ReturnType<typeof loadDefaultMotion> | undefined;
const prepared = new WeakMap<object, Promise<NativeLobbyClips | undefined>>();
export type NativeLobbyClips = {
    clips: THREE.AnimationClip[];
    metadata: Record<string, LobbyClipMetadata>;
};

/** Separate names and appended atlas entries preserve legacy/custom action IDs.
 * Preparation runs before display, once per rig, in the existing baker worker.
 * A failed optional pack leaves the original animations fully usable. */
export function prepareNativeLobbyClips(vrm: any) {
    if (prepared.has(vrm)) return prepared.get(vrm);
    const pending = prepare(vrm).catch((error) => {
        console.warn(
            "Lobby motion unavailable; retaining space animations",
            error
        );
        return undefined;
    });
    prepared.set(vrm, pending);
    return pending;
}
async function prepare(vrm: any): Promise<NativeLobbyClips> {
    library ||= loadDefaultMotion(async (url) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        try {
            const response = await fetch(
                new URL(url, globalThis.location.origin).href,
                { signal: controller.signal }
            );
            if (!response.ok)
                throw new Error(`Animation pack: ${response.status}`);
            return await response.arrayBuffer();
        } finally {
            clearTimeout(timeout);
        }
    }).catch((error) => {
        library = undefined;
        throw error;
    });
    const raw = await library;
    const metadata: Record<string, LobbyClipMetadata> = {};
    const restingHips = raw.IDLE.tracks.find(
        (track) => track.name === "mixamorigHips.position"
    )?.values;
    const clips = Object.entries(raw).map(([name, source]) => {
        const clip = retarget(
            vrm.scene,
            vrm,
            sanitizeLobbyAnimation(source, name, restingHips)
        );
        clip.name = name;
        metadata[name] = {
            duration: clip.duration,
            loop: !isMotionOneShot(name),
        };
        return clip;
    });
    const bone = (name: string) => vrm.humanoid.getNormalizedBoneNode(name);
    for (const derived of authorLobbyTransitions(
        THREE,
        clips.find((c) => c.name === "IDLE"),
        clips.find((c) => c.name === "WALK"),
        bone
    )) {
        clips.push(derived.clip);
        metadata[derived.clip.name] = derived.metadata;
    }
    // Match the lobby's calibration scale, without changing native player size.
    const scene = vrm.scene;
    scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(scene);
    const height = bounds.max.y - bounds.min.y;
    const scale = scene.scale.clone();
    const parent = scene.parent;
    const root = new THREE.Group();
    root.add(scene);
    root.scale.setScalar(
        Number.isFinite(height) && height > 0 ? 1.8 / height : 1
    );
    try {
        await calibrateLobbyContacts(THREE, root, clips, metadata, bone);
        const turns = await authorMovingTurns(
            THREE,
            root,
            clips,
            metadata,
            bone
        );
        for (const derived of turns) {
            clips.push(derived.clip);
            metadata[derived.clip.name] = derived.metadata;
        }
        await calibrateLobbyContacts(
            THREE,
            root,
            turns.map((t) => t.clip),
            metadata,
            bone
        );
    } finally {
        root.remove(scene);
        parent?.add(scene);
        scene.scale.copy(scale);
        scene.updateMatrixWorld(true);
    }
    for (const clip of clips) {
        (clip as any).loop = metadata[clip.name].loop !== false;
        clip.name = LOBBY_CLIP_PREFIX + clip.name;
    }
    return { clips, metadata };
}
