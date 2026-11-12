import manifest from "../../public/lobby/flash/manifest.json";
import type { CC0LocomotionPack } from "./cc0LocomotionPack";

export const FLASH_ANIMATION_NAME = "FLASH_POINT";
const pack = manifest.packs[0];
const metadata = pack.clips.FLASH_POINT;
export const FLASH_PACK_URL = `/lobby/flash/${pack.file}`;
export const FLASH_ANIMATION_DURATION_MS = metadata.duration * 1000;
export const FLASH_HOLD_TIME_MS = metadata.holdTime * 1000;

async function fetchFlashAsset(url: string) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok)
            throw new Error(
                `Could not load pointing animation (${response.status})`
            );
        return await response.arrayBuffer();
    } finally {
        clearTimeout(timer);
    }
}

let pending: Promise<CC0LocomotionPack> | undefined;
/** Decode the animation-only pack once; avatar mixers own their retargeted actions. */
export function loadFlashAnimationPack(
    fetchAsset: (url: string) => Promise<ArrayBuffer> = fetchFlashAsset
): Promise<CC0LocomotionPack> {
    return (pending ||= Promise.all([
        import("./cc0LocomotionPack"),
        fetchAsset(FLASH_PACK_URL),
    ])
        .then(([{ decodeCC0LocomotionPack }, bytes]) => {
            const decoded = decodeCC0LocomotionPack(bytes);
            const clip = decoded.clips.FLASH_POINT;
            if (
                !clip ||
                decoded.metadata.FLASH_POINT?.loop !== false ||
                Math.abs(clip.duration - metadata.duration) > 0.000001 ||
                metadata.holdTime <= 0 ||
                metadata.holdTime >= clip.duration
            )
                throw new Error("Invalid Flash pointing animation");
            return decoded;
        })
        .catch((error) => {
            pending = undefined;
            throw error;
        }));
}
