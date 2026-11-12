//@ts-check
import { OLD_ALTS_MAPPING } from "../constants";
export const supportsCache =
    typeof window !== "undefined" && "caches" in window;

/** A successful status with no file in it: 204, or a declared length of 0. */
export function isEmptyResponse(response) {
    return (
        response.status === 204 ||
        response.headers?.get?.("content-length") === "0"
    );
}

export class CacheStorage {
    constructor(id) {
        this.id = id;
        this.cache = null;
        this.pendingWrites = new Map();
    }
    async get(request) {
        try {
            if (!supportsCache) return null;
            this.cache ||= await caches.open(this.id);
            return await this.cache.match(request);
        } catch (_) {
            this.cache = null;
            return null;
        }
    }
    async delete(request) {
        try {
            if (!supportsCache) return false;
            this.cache ||= await caches.open(this.id);
            return await this.cache.delete(request);
        } catch (_) {
            this.cache = null;
            return false;
        }
    }
    async put(request, response) {
        try {
            if (!supportsCache) return false;
            this.cache ||= await caches.open(this.id);
            await this.cache.put(request, response);
            return true;
        } catch (_) {
            this.cache = null;
            return false;
        }
    }
    async fetch(request, options = {}) {
        request = OLD_ALTS_MAPPING[request] || request;
        options.signal?.throwIfAborted();
        // A second reader arriving during a write should reuse it, without
        // delaying the first reader's fetch/decode on disk persistence.
        const writing = this.pendingWrites.get(request);
        if (writing) {
            let onAbort;
            const aborted =
                options.signal &&
                new Promise((_, reject) => {
                    onAbort = () =>
                        reject(
                            options.signal.reason ||
                                new DOMException("Aborted", "AbortError")
                        );
                    options.signal.addEventListener("abort", onAbort, {
                        once: true,
                    });
                    if (options.signal.aborted) onAbort();
                });
            try {
                await (aborted ? Promise.race([writing, aborted]) : writing);
            } finally {
                options.signal?.removeEventListener("abort", onAbort);
            }
        }
        let cached = await this.get(request);
        options.signal?.throwIfAborted();
        // An empty answer (Pinata sometimes sends 204) was once stored as if
        // it were the file. Drop it so the next read downloads again.
        if (cached && isEmptyResponse(cached)) {
            void this.delete(request);
            cached = null;
        }
        if (cached) {
            if (process.env.NODE_ENV === "development")
                console.info("[Asset cache] hit " + this.id);
            return cached;
        }
        const response = await fetch(request, options);
        if (!response.ok || isEmptyResponse(response))
            throw new Error(
                `Error loading ${request} (HTTP ${response.status}${
                    response.ok ? ", empty" : ""
                })`
            );
        // Quota/private browsing/cache errors never prevent ordinary loading.
        options.signal?.throwIfAborted();
        const write = this.put(request, response.clone());
        this.pendingWrites.set(request, write);
        void write.finally(() => {
            if (this.pendingWrites.get(request) === write)
                this.pendingWrites.delete(request);
        });
        return response;
    }
}
export const cacheStorages = {
    room: new CacheStorage("room-v1"),
    hdr: new CacheStorage("hdr_v1"),
    octrees: new CacheStorage("octree_v1"),
    octreeMeshes: new CacheStorage("octree_meshes_v1"),
};
