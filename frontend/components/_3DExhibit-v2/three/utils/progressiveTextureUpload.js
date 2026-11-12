import {
    Texture,
    DataTexture,
    Vector2,
    RGBAFormat,
    UnsignedByteType,
    LinearFilter,
    NearestFilter,
    SRGBColorSpace,
    LinearSRGBColorSpace,
    NoColorSpace,
} from "three";
import TextureWorker from "./progressiveTextureUpload.worker.js";
import {
    cappedTextureSize,
    estimateStorageBytes,
} from "./progressiveTextureUpload.pixels";
export {
    cappedTextureSize,
    estimateStorageBytes,
} from "./progressiveTextureUpload.pixels";

const cancelled = () =>
    new DOMException("Texture upload cancelled", "AbortError");
const unsupported = () =>
    Object.assign(
        new Error(
            "Progressive texture upload is unsupported for this texture or renderer"
        ),
        { code: "PROGRESSIVE_TEXTURE_UNSUPPORTED" }
    );
const check = (signal, renderer) => {
    if (signal?.aborted) throw cancelled();
    if (renderer._isDeviceLost === true)
        throw Object.assign(
            new Error("GPU device lost during texture upload"),
            { code: "WEBGL_CONTEXT_LOST" }
        );
};

function cloneBitmap(image, signal) {
    return new Promise((resolve, reject) => {
        const cancel = () => reject(cancelled());
        signal?.addEventListener("abort", cancel, { once: true });
        if (signal?.aborted) cancel();
        Promise.resolve()
            .then(() =>
                createImageBitmap(image, {
                    premultiplyAlpha: "none",
                    colorSpaceConversion: "none",
                    imageOrientation: "none",
                })
            )
            .then(
                (bitmap) => {
                    signal?.removeEventListener("abort", cancel);
                    if (signal?.aborted) bitmap.close();
                    else resolve(bitmap);
                },
                (error) => {
                    signal?.removeEventListener("abort", cancel);
                    reject(error);
                }
            );
    });
}

/** Uploads a detached room texture through bounded tile copies
 * (copyTextureToTexture from a short-lived DataTexture per tile). Returns a
 * complete GPU-only texture; caller must restore its low map on device loss.
 * No compressed fallback: retaining the low image is preferable to a hitch. */
export async function uploadRoomTexture(
    source,
    {
        renderer,
        signal,
        waitForSlot,
        onUpload,
        onProgress,
        tileSize = 128,
        maxDimension = 2048,
    } = {}
) {
    const image = source?.source?.data || source?.image;
    const width = image?.width,
        height = image?.height;
    if (
        !renderer?.capabilities?.isWebGL2 ||
        typeof renderer.copyTextureToTexture !== "function" ||
        typeof waitForSlot !== "function" ||
        typeof Worker === "undefined" ||
        typeof OffscreenCanvas === "undefined" ||
        typeof createImageBitmap !== "function" ||
        source?.isCompressedTexture ||
        source?.isDataTexture ||
        source?.isCubeTexture ||
        source?.isVideoTexture ||
        source?.isData3DTexture ||
        source?.isDataArrayTexture ||
        source?.mipmaps?.length ||
        source?.format !== RGBAFormat ||
        source?.type !== UnsignedByteType ||
        ![SRGBColorSpace, LinearSRGBColorSpace, NoColorSpace].includes(
            source.colorSpace
        ) ||
        !Number.isInteger(width) ||
        !Number.isInteger(height) ||
        width < 1 ||
        height < 1
    )
        throw unsupported();
    check(signal, renderer);
    maxDimension = Math.max(
        1,
        Math.min(
            renderer.capabilities.maxTextureSize,
            Math.floor(maxDimension) || 2048
        )
    );
    const targetSize = cappedTextureSize(width, height, maxDimension);
    const minimum = source.userData?.roomTextureUpgradeLowSize;
    if (
        minimum &&
        targetSize.width <= minimum[0] &&
        targetSize.height <= minimum[1]
    )
        return null;
    tileSize = Math.max(16, Math.min(128, Math.floor(tileSize) || 128));
    const mipmaps =
        source.minFilter !== LinearFilter && source.minFilter !== NearestFilter;
    const encodedBlob = image.encodedBlob;
    let bitmap,
        worker,
        target,
        pending,
        transferred = false,
        complete = false;
    const abort = () => {
        pending?.reject(cancelled());
        pending = null;
        worker?.terminate();
    };
    const request = (message, transfer = []) =>
        new Promise((resolve, reject) => {
            pending = { resolve, reject };
            try {
                worker.postMessage(message, transfer);
                if (transfer.length) transferred = true;
            } catch (error) {
                pending = null;
                reject(error);
            }
        });
    const gpu = async (kind, work, details = {}) => {
        await waitForSlot();
        check(signal, renderer);
        const start = performance.now();
        work();
        try {
            onUpload?.(performance.now() - start, { kind, ...details });
        } catch {}
        check(signal, renderer);
    };
    try {
        if (!encodedBlob) bitmap = await cloneBitmap(image, signal);
        check(signal, renderer);
        worker = new TextureWorker();
        worker.onmessage = ({ data }) => {
            const operation = pending;
            pending = null;
            if (data.type === "error")
                operation?.reject(new Error(data.message));
            else operation?.resolve(data);
        };
        worker.onerror = () => {
            pending?.reject(new Error("Texture preparation worker failed"));
            pending = null;
        };
        signal?.addEventListener("abort", abort, { once: true });
        check(signal, renderer);
        const ready = request(
            {
                type: "init",
                bitmap,
                encodedBlob,
                width,
                height,
                tileSize,
                mipmaps,
                maxDimension,
                srgb: source.colorSpace === SRGBColorSpace,
                // r180 honours flipY/premultiplyAlpha for ImageBitmap sources too
                // (WebGPU copyExternalImageToTexture), so bake them for every source.
                flipY: !!source.flipY,
                premultiplyAlpha: !!source.premultiplyAlpha,
            },
            bitmap ? [bitmap] : []
        );
        const { total } = await ready;
        check(signal, renderer);
        // Storage-only texture: a plain Texture (not a FramebufferTexture, which the
        // WebGL2 backend samples flipped) whose data is never uploaded by the
        // renderer. `mipmaps` only sizes the mip chain; tiles fill every level.
        target = new Texture({
            width: targetSize.width,
            height: targetSize.height,
        });
        target.name = source.name;
        for (const key of [
            "mapping",
            "channel",
            "wrapS",
            "wrapT",
            "magFilter",
            "minFilter",
            "anisotropy",
            "rotation",
            "matrixAutoUpdate",
            "colorSpace",
            "format",
            "type",
            "internalFormat",
        ])
            if (key in source) target[key] = source[key];
        for (const key of ["offset", "repeat", "center", "matrix"])
            target[key].copy(source[key]);
        // Pixel rows are prepared explicitly; no GL-wide conversion is needed.
        target.flipY = false;
        target.premultiplyAlpha = false;
        target.unpackAlignment = 1;
        target.generateMipmaps = false;
        target.mipmaps = [];
        for (
            let w = targetSize.width, h = targetSize.height;
            ;
            w = Math.max(1, w >> 1), h = Math.max(1, h >> 1)
        ) {
            target.mipmaps.push({ data: null, width: w, height: h });
            if (!mipmaps || (w === 1 && h === 1)) break;
        }
        target.source.dataReady = false;
        target.needsUpdate = true;
        target.userData.progressiveRoomTexture = {
            ...targetSize,
            bytes: estimateStorageBytes(
                targetSize.width,
                targetSize.height,
                mipmaps
            ),
            capped: targetSize.width !== width || targetSize.height !== height,
        };
        await gpu("allocate", () => renderer.initTexture(target), {
            ...targetSize,
        });
        const position = new Vector2();
        let uploaded = 0;
        while (true) {
            check(signal, renderer);
            const tile = await request({ type: "next" });
            if (tile.type === "done") break;
            // Tiles differ in size, so each gets its own short-lived source texture.
            const patch = new DataTexture(
                new Uint8Array(tile.data),
                tile.width,
                tile.height,
                RGBAFormat,
                UnsignedByteType
            );
            patch.colorSpace = target.colorSpace;
            patch.needsUpdate = true;
            position.set(tile.x, tile.y);
            try {
                await gpu(
                    "tile",
                    () =>
                        renderer.copyTextureToTexture(
                            patch,
                            target,
                            null,
                            position,
                            0,
                            tile.level
                        ),
                    {
                        level: tile.level,
                        width: tile.width,
                        height: tile.height,
                    }
                );
            } finally {
                patch.dispose();
                patch.image.data = null;
            }
            uploaded++;
            try {
                onProgress?.({ uploaded, total, level: tile.level });
            } catch {}
        }
        check(signal, renderer);
        complete = true;
        return target;
    } finally {
        signal?.removeEventListener("abort", abort);
        worker?.terminate();
        if (bitmap && !transferred) bitmap.close();
        if (!complete) target?.dispose();
    }
}
