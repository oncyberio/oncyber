/**
 * Pure parts of the lobby's destination warmup (see destinationWarmup.ts):
 * which URL holds a destination's server data, and which room model its
 * lobby-prepared frame will download. Free of DOM and Next imports, so the
 * warmup worker can use it.
 */
import {
    classicRoomModelOptions,
    selectRoomModelSource,
} from "@components/_3DExhibit-v2/three/utils/roomModelSource";
import {
    isGlbUrl,
    isManagedModelUrl,
} from "@components/_3DExhibit-v2/three/utils/assetUrl";

/** The engine's room cache (cacheStorages.room in three/utils/cachestorage). */
export const ROOM_CACHE_ID = "room-v1";
/** A destination warmed this recently is not warmed again. */
export const WARM_AGAIN_AFTER_MS = 5 * 60 * 1000;
/** A card the pointer rests on this long starts warming. */
export const CARD_WARM_DWELL_MS = 250;

const DESTINATION_PATH = /^\/(?:spaces\/|mints\/)?[a-z0-9@_-]+$/i;

/** The getServerSideProps data URL of a lobby destination, or null. */
export function destinationDataUrl(
    href: string,
    origin: string,
    buildId: string,
    locale?: string
) {
    if (!href || !buildId) return null;
    try {
        const url = new URL(href, origin);
        if (url.origin !== origin) return null;
        const path = url.pathname.replace(/\/$/, "");
        if (!DESTINATION_PATH.test(path)) return null;
        const prefix = locale ? `/${encodeURIComponent(locale)}` : "";
        return `${origin}/_next/data/${encodeURIComponent(
            buildId
        )}${prefix}${path}.json`;
    } catch {
        return null;
    }
}

/** Same normalisation as loader.js normalizeModelUrl (the cache key). */
export function roomCacheKey(url: string) {
    return url
        .trim()
        .replace("http://", "https://")
        .replace("https://polar-mountain-96590.herokuapp.com/", "");
}

const fetchedAsBytes = (url: string) =>
    isGlbUrl(url) || isManagedModelUrl(url) || /\.vrm(?:[?#]|$)/i.test(url);

/**
 * The room model a lobby-prepared frame of this page will download, for each
 * answer to "does the GPU take compressed textures". Null where Scene3D would
 * not start from these props (it fetches the room itself, or the room is a
 * kitbash/upload model that does not go through the room cache).
 */
export function warmRoomModels(pageProps: any): {
    plain: string | null;
    compressed: string | null;
} | null {
    const experience = pageProps?.experience;
    let room = pageProps?.dest;
    const roomId = experience?.info?.room;
    if (!experience || !room || !roomId) return null;
    // Scene3D: getDestination(info.room, dest) reuses dest only on a match.
    if (roomId !== room.path && roomId !== room.slug) return null;
    if (experience.params) room = { ...room, ...experience.params };
    if (room.isFuture) return null;
    const pick = (compressedSupport: boolean) => {
        const source = selectRoomModelSource(
            room,
            // A frame prepared in the lobby always prefers low resolution
            // (Scene3D: preferLowResolution: isLobbyDestinationPreparing()),
            // which makes GPU tier and the mid-first order irrelevant.
            classicRoomModelOptions({
                preferLowResolution: true,
                compressedSupport,
                skin: experience.info?.currentSkin,
            })
        );
        if (!source?.url || source.source === "upload") return null;
        const url = roomCacheKey(source.url);
        return fetchedAsBytes(url) ? url : null;
    };
    const plain = pick(false);
    const compressed = pick(true);
    if (!plain && !compressed) return null;
    return { plain, compressed };
}

export type WarmRequest = {
    type: "warm";
    dataUrl: string;
    origin: string;
    buildId: string;
    locale?: string;
};
export type WarmResult = {
    type: "warmed";
    dataUrl: string;
    room: "cached" | "downloaded" | "none" | "failed";
    ms: number;
};

/** Mirrors the engine cache's rule: a 204 or zero-length answer is no file. */
export function isEmptyResponse(response: {
    status: number;
    headers?: { get(name: string): string | null };
}) {
    return (
        response.status === 204 ||
        response.headers?.get?.("content-length") === "0"
    );
}
