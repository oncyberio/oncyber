/**
 * The avatar motion clips, a download of their own instead of part of the
 * world's code. GLTF.prepareBaking starts it when the engine is ready and
 * GLTF.load awaits it before an avatar is stored, so the synchronous users
 * (Baker, VRMMesh) always find it loaded.
 *
 * They come as animations/compute2.bin: the container from clipCodec.js,
 * gzip compressed (228 KB instead of the 3.16 MB JSON), inflated here with
 * DecompressionStream and decoded once. The bake workers each get a copy of
 * the inflated container (bakerworker.js) instead of a structured clone of
 * the decoded clips. Without DecompressionStream, or when the file cannot be
 * fetched or read, the clips come from animations/compute2.json as before.
 */
import { decodeAvatarClips, isAvatarClipContainer } from "./clipCodec.js";

let source = null; // { bytes: ArrayBuffer | null, clips: Array }
let pending = null;

const isGzip = (bytes) => {
    const head = new Uint8Array(bytes, 0, Math.min(2, bytes.byteLength));
    return head[0] === 0x1f && head[1] === 0x8b;
};

async function gunzip(bytes) {
    const inflater = new DecompressionStream("gzip");
    const writer = inflater.writable.getWriter();
    // Not awaited: the readable side must drain for the writes to finish.
    // A damaged file rejects reader.read() below.
    writer.write(new Uint8Array(bytes)).catch(() => {});
    writer.close().catch(() => {});
    const reader = inflater.readable.getReader();
    const chunks = [];
    let length = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        length += value.byteLength;
    }
    const out = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
        out.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return out.buffer;
}

async function loadPackedClips() {
    if (typeof DecompressionStream === "undefined")
        throw new Error("DecompressionStream is not available");
    const { default: url } = await import(
        /* webpackMode: "eager" */ "./clipAsset.js"
    );
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Avatar clips: HTTP ${response.status}`);
    let bytes = await response.arrayBuffer();
    // The file is gzip data; a host that decoded it on the way leaves the
    // container itself, which is fine too.
    if (isGzip(bytes)) bytes = await gunzip(bytes);
    if (!isAvatarClipContainer(bytes))
        throw new Error("Avatar clips: not a clip container");
    // Decoded now, so a damaged file falls back here instead of failing a bake.
    return { bytes, clips: decodeAvatarClips(bytes) };
}

function loadJsonClips() {
    return import("./animations/compute2.json").then((module) => ({
        bytes: null,
        clips: module.default || module,
    }));
}

/**
 * Loads the clips once. Resolves to `{ bytes, clips }`: the inflated
 * container for the bake workers (null when the JSON copy was used) and the
 * decoded clips.
 */
export function loadBakerClipSource() {
    if (source) return Promise.resolve(source);
    if (!pending) {
        pending = loadPackedClips()
            .catch((error) => {
                console.warn("Avatar clips: using the JSON copy", error);
                return loadJsonClips();
            })
            .then(
                (loaded) => (source = loaded),
                (error) => {
                    pending = null;
                    throw error;
                }
            );
    }
    return pending;
}

export function loadBakerAnimations() {
    return loadBakerClipSource().then((loaded) => loaded.clips);
}

/** The loaded clips; only valid after loadBakerAnimations() resolved. */
export function bakerAnimations() {
    if (!source)
        throw new Error(
            "Avatar animations are not loaded: await loadBakerAnimations() first"
        );
    return source.clips;
}
