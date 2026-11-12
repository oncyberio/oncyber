import manifest from "../../public/lobby/travel/manifest.json";
import type { CC0LocomotionPack } from "./cc0LocomotionPack";
import type { LOBBY_IDLE_CLIPS } from "./idleVariants";

export const TRAVEL_ANIMATION_NAMES = [
    "TRAVEL_ATTACK",
    "TRAVEL_CROUCH_DOWN",
    "TRAVEL_CROUCH_IDLE",
    "TRAVEL_STAND_UP",
] as const;
export type TravelAnimationName = (typeof TRAVEL_ANIMATION_NAMES)[number];
export type TravelPoseName =
    | TravelAnimationName
    | (typeof LOBBY_IDLE_CLIPS)[number];
export interface TravelAnimationPose {
    name: TravelPoseName;
    /** Authored seconds, independently of renderer frame rate. */
    time: number;
    previous?: { name: TravelPoseName; time: number };
    /** Weight of the new sample, when a previous sample is provided. */
    blend?: number;
}
export type TravelPoseSample = TravelAnimationPose;
export const isTravelAnimation = (name: string): name is TravelAnimationName =>
    (TRAVEL_ANIMATION_NAMES as readonly string[]).includes(name);
export const travelAnimationLoops = (name: TravelAnimationName) =>
    name === "TRAVEL_CROUCH_IDLE";

const pack = manifest.packs[0];
export const TRAVEL_PACK_URL = `/lobby/travel/${pack.file}`;
/** Pure timing metadata is available without fetching or decoding animation keys. */
export const TRAVEL_ANIMATION_DURATION_MS = Object.fromEntries(
    TRAVEL_ANIMATION_NAMES.map((name) => [
        name,
        pack.clips[name].duration * 1000,
    ])
) as Record<TravelAnimationName, number>;
/** Trips play the jump and the stand-up faster than authored, so the visitor
 * leaves and arrives sooner. Poses still sample authored clip time. */
export const TRAVEL_ANIMATION_SPEED: Record<TravelAnimationName, number> = {
    TRAVEL_ATTACK: 1.55,
    TRAVEL_CROUCH_DOWN: 1.55,
    TRAVEL_CROUCH_IDLE: 1,
    TRAVEL_STAND_UP: 1.6,
};
/** Wall-clock length of each clip at its trip speed. */
export const TRAVEL_ANIMATION_PLAY_MS = Object.fromEntries(
    TRAVEL_ANIMATION_NAMES.map((name) => [
        name,
        TRAVEL_ANIMATION_DURATION_MS[name] / TRAVEL_ANIMATION_SPEED[name],
    ])
) as Record<TravelAnimationName, number>;

async function fetchTravelAsset(url: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok)
            throw new Error(
                `Could not load travel animations (${response.status})`
            );
        return await response.arrayBuffer();
    } finally {
        clearTimeout(timeout);
    }
}

let pending: Promise<CC0LocomotionPack> | undefined;
/** Animation keys are decoded once; each avatar owns its retargeted mixer actions.
 * The pack already removes horizontal root travel and preserves authored hip Y,
 * including the crouch. Never apply locomotion height corrections to these clips.
 */
export function loadTravelAnimationPack(
    fetchAsset: (url: string) => Promise<ArrayBuffer> = fetchTravelAsset
): Promise<CC0LocomotionPack> {
    return (pending ||= Promise.all([
        import("./cc0LocomotionPack"),
        fetchAsset(TRAVEL_PACK_URL),
    ])
        .then(([{ decodeCC0LocomotionPack }, bytes]) => {
            const decoded = decodeCC0LocomotionPack(bytes);
            for (const name of TRAVEL_ANIMATION_NAMES) {
                const clip = decoded.clips[name];
                const metadata = decoded.metadata[name];
                if (
                    !clip ||
                    !metadata ||
                    metadata.loop !== travelAnimationLoops(name) ||
                    Math.abs(
                        metadata.duration * 1000 -
                            TRAVEL_ANIMATION_DURATION_MS[name]
                    ) > 0.001
                )
                    throw new Error(`Invalid travel animation: ${name}`);
            }
            return decoded;
        })
        .catch((error) => {
            pending = undefined;
            throw error;
        }));
}
