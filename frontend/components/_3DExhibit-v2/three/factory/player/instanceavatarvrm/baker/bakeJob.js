import { bakeCacheKey, sha256Hex } from "./bakeCache.js";

/**
 * One bake request in a bake worker: the cached bake when this exact avatar
 * file was baked before, otherwise a bake (stored for next time). Resolves
 * to the message for the page and the buffers to transfer with it.
 *
 * @param {{ url: string, bytes?: ArrayBuffer }} data the page's request
 * @param {object} deps
 * @param {(data) => Promise<object>} deps.parse loads the glTF
 * @param {(vrm) => Promise<object>} deps.bake bakes it (Baker.prepare)
 * @param {{ open(): Promise<object|null> } | null} deps.cache
 * @param {string | null} deps.clips the clips' version, null if unknown
 * @param {(bytes) => Promise<string|null>} [deps.hash]
 */
export async function runBakeJob(
    data,
    { parse, bake, cache, clips, hash = sha256Hex }
) {
    // Only the bytes this worker parses identify the bake; without them (the
    // worker fetches the URL itself) nothing is read from or written to the
    // cache.
    let key = null;
    let store = null;
    if (cache && clips && data.bytes instanceof ArrayBuffer) {
        const sha256 = await hash(data.bytes).catch(() => null);
        key = bakeCacheKey({ url: data.url, sha256, clips });
        store = key ? await cache.open() : null;
    }

    const cached = store ? await store.get(key) : null;
    if (cached) {
        return {
            message: { done: true, cached: true, data: cached },
            transfer: transferable(cached),
        };
    }

    const gltf = await parse(data);
    const result = await bake(gltf.userData.vrm);
    // A bake made while the lobby motion could not load is incomplete:
    // never keep it.
    if (store && !result.lobbyMotionFailed) void store.put(key, result);
    return {
        message: { done: true, data: result },
        transfer: transferable(result),
    };
}

const transferable = (bake) => {
    const buffer = bake?.texture?.source?.data?.data?.buffer;
    return buffer ? [buffer] : [];
};
