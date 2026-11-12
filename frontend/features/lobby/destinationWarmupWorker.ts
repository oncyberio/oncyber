/// <reference lib="webworker" />
/**
 * Off-main-thread half of the lobby's destination warmup. For each request it
 * reads the page's server data, picks the room model the destination frame
 * will load, and stores that file in the engine's room cache. Work runs one
 * destination at a time, newest first, so a visitor browsing cards never
 * queues more than a couple of downloads.
 */
import {
    destinationDataUrl,
    isEmptyResponse,
    ROOM_CACHE_ID,
    warmRoomModels,
    type WarmRequest,
    type WarmResult,
} from "./destinationWarmupSource";

declare const self: DedicatedWorkerGlobalScope;

const MAX_PENDING = 2;
const pending: WarmRequest[] = [];
let running = false;
let compressedSupport: Promise<boolean> | undefined;

/** Mirrors KTX2Loader.detectSupport: any GPU compressed format counts. */
async function detectCompressedSupport() {
    try {
        const gpu = (navigator as any).gpu;
        const adapter = gpu && (await gpu.requestAdapter());
        if (adapter)
            return [
                "texture-compression-bc",
                "texture-compression-astc",
                "texture-compression-etc2",
            ].some((feature) => adapter.features.has(feature));
    } catch {}
    try {
        const gl = new OffscreenCanvas(1, 1).getContext("webgl2");
        if (gl) {
            const supported = [
                "WEBGL_compressed_texture_astc",
                "WEBGL_compressed_texture_etc",
                "WEBGL_compressed_texture_etc1",
                "WEBGL_compressed_texture_s3tc",
                "EXT_texture_compression_bptc",
                "WEBGL_compressed_texture_pvrtc",
            ].some((name) => !!gl.getExtension(name));
            gl.getExtension("WEBGL_lose_context")?.loseContext();
            return supported;
        }
    } catch {}
    return false;
}

async function readJson(url: string) {
    const response = await fetch(url, { credentials: "same-origin" });
    return response.ok ? response.json() : null;
}

async function readPageProps(request: WarmRequest) {
    const { dataUrl, origin, buildId, locale } = request;
    let data = await readJson(dataUrl);
    // /spaces/<id> redirects to the space's custom link; follow it once.
    const redirect = data?.pageProps?.__N_REDIRECT;
    if (typeof redirect === "string") {
        const next = destinationDataUrl(redirect, origin, buildId, locale);
        data = next ? await readJson(next) : null;
    }
    return data?.pageProps ?? null;
}

async function warmRoom(url: string): Promise<WarmResult["room"]> {
    const cache = await caches.open(ROOM_CACHE_ID);
    const cached = await cache.match(url);
    if (cached && !isEmptyResponse(cached)) return "cached";
    const response = await fetch(url);
    // Never store an empty answer (Pinata sometimes sends 204) as the file.
    if (!response.ok || isEmptyResponse(response)) {
        if (cached) await cache.delete(url);
        return "failed";
    }
    await cache.put(url, response);
    return "downloaded";
}

async function warm(request: WarmRequest): Promise<WarmResult> {
    const started = performance.now();
    let room: WarmResult["room"] = "none";
    try {
        const models = warmRoomModels(await readPageProps(request));
        if (models) {
            let url = models.plain;
            if (models.compressed !== models.plain) {
                compressedSupport ||= detectCompressedSupport();
                if (await compressedSupport) url = models.compressed;
            }
            if (url) room = await warmRoom(url);
        }
    } catch {
        room = "failed";
    }
    return {
        type: "warmed",
        dataUrl: request.dataUrl,
        room,
        ms: Math.round(performance.now() - started),
    };
}

async function drain() {
    if (running) return;
    running = true;
    try {
        while (pending.length) {
            self.postMessage(await warm(pending.shift()));
        }
    } finally {
        running = false;
    }
}

self.onmessage = (event: MessageEvent<WarmRequest>) => {
    const request = event.data;
    if (request?.type !== "warm" || !request.dataUrl) return;
    const existing = pending.findIndex(
        (queued) => queued.dataUrl === request.dataUrl
    );
    if (existing >= 0) pending.splice(existing, 1);
    pending.unshift(request);
    pending.length = Math.min(pending.length, MAX_PENDING);
    void drain();
};
