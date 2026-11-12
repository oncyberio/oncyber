import { Texture } from "three";
import DonorWorker from "./roomTextureDonor.worker.js";
import { cacheStorages } from "./cachestorage";

const MAX_DONOR_BYTES = 128 * 1024 * 1024;
const aborted = () =>
    Object.assign(new Error("Room texture refinement cancelled"), {
        name: "AbortError",
    });
const unsupported = () =>
    Object.assign(
        new Error("Room texture donor could not be prepared safely"),
        {
            code: "ROOM_TEXTURE_DONOR_UNSUPPORTED",
        }
    );
const check = (signal) => {
    if (signal?.aborted) throw aborted();
};
const scalars = [
    "name",
    "mapping",
    "channel",
    "wrapS",
    "wrapT",
    "magFilter",
    "minFilter",
    "anisotropy",
    "rotation",
    "matrixAutoUpdate",
    "premultiplyAlpha",
    "flipY",
    "unpackAlignment",
    "colorSpace",
    "format",
    "type",
    "internalFormat",
    "generateMipmaps",
];

/** Rehydrate small descriptors, never geometry or decoded high-resolution pixels. */
export function rehydrateRoomTextureDonor(result) {
    const textures = [];
    try {
        for (const descriptor of result.textures) {
            const { image, state } = descriptor;
            if (
                !image?.encodedBlob ||
                !Number.isInteger(image.width) ||
                !Number.isInteger(image.height)
            )
                throw unsupported();
            const texture = new Texture(image);
            textures.push(texture);
            for (const key of scalars)
                if (state[key] !== undefined) texture[key] = state[key];
            for (const key of ["offset", "repeat", "center", "matrix"])
                texture[key].fromArray(state[key]);
        }
        const roomTextureRecords = result.records.map(
            ({ textureId, ...record }) => {
                if (!Number.isInteger(textureId) || !textures[textureId])
                    throw unsupported();
                return { ...record, texture: textures[textureId] };
            }
        );
        return { roomTextureRecords, textures };
    } catch (error) {
        for (const texture of textures) texture.dispose();
        throw error;
    }
}

/** Fetch through the room cache, then transfer ownership of encoded bytes. No
 * main-thread GLTF/decode fallback: unsupported exports retain their low maps. */
export async function loadRoomTextureDonor(url, { signal } = {}) {
    check(signal);
    if (typeof Worker === "undefined") throw unsupported();
    const response = await cacheStorages.room.fetch(url, { signal });
    check(signal);
    if (
        !response.ok ||
        Number(response.headers?.get("content-length")) > MAX_DONOR_BYTES
    )
        throw unsupported();
    const buffer = await response.arrayBuffer();
    check(signal);
    if (buffer.byteLength > MAX_DONOR_BYTES) throw unsupported();
    return new Promise((resolve, reject) => {
        let worker,
            settled = false;
        const finish = (error, result) => {
            if (settled) return;
            settled = true;
            signal?.removeEventListener("abort", cancel);
            if (worker) {
                worker.onmessage = null;
                worker.onerror = null;
                worker.onmessageerror = null;
                worker.terminate();
            }
            if (error) reject(error);
            else resolve(result);
        };
        const cancel = () => finish(aborted());
        try {
            worker = new DonorWorker();
            signal?.addEventListener("abort", cancel, { once: true });
            if (signal?.aborted) return cancel();
            worker.onerror = () => finish(unsupported());
            worker.onmessageerror = () => finish(unsupported());
            worker.onmessage = ({ data }) => {
                if (settled) return;
                if (signal?.aborted) return cancel();
                try {
                    if (data.type !== "ready") throw unsupported();
                    finish(null, rehydrateRoomTextureDonor(data));
                } catch (error) {
                    finish(error);
                }
            };
            worker.postMessage({ buffer }, [buffer]);
        } catch (error) {
            finish(error);
        }
    });
}
