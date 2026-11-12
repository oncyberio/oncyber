// Every WebGPU device supports at least this, so smaller images never need
// the renderer (whose import builds it; tests import the loader without one).
const GUARANTEED_MAX = 8192;

// Canvas fallback stays under iOS Safari's ~16.7M pixel canvas cap.
const CANVAS_MAX = 4096;

/** Largest side that fits `max`, keeping the aspect ratio. */
export function fitTextureSize(width, height, max) {

    if (width <= max && height <= max) return null;

    const scale = max / Math.max(width, height);

    return {
        width: Math.max(1, Math.floor(width * scale)),
        height: Math.max(1, Math.floor(height * scale)),
    };
}

/**
 * Size that fits `limit` (a null height bounds the width only), keeping the
 * aspect ratio; null when the image already fits.
 *
 * @param { number } width
 * @param { number } height
 * @param { { width: number, height?: number | null } } limit
 */
export function fitDecodeLimit(width, height, limit) {

    const maxWidth = limit?.width || Infinity;

    const maxHeight = limit?.height || Infinity;

    if (width <= maxWidth && height <= maxHeight) return null;

    const scale = Math.min(maxWidth / width, maxHeight / height);

    return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
    };
}

/**
 * Shrinks a decoded artwork image to the size its level of detail uses, so
 * an original from a host that cannot resize does not become a texture many
 * times larger than the resized ones. An ImageBitmap stays a bitmap
 * (createImageBitmap resize, same orientation); an image element becomes a
 * canvas, as fitImageToTextureLimit does. Images that fit come back as is.
 *
 * @template { HTMLImageElement | ImageBitmap | HTMLCanvasElement } T
 * @param { T } image
 * @param { { width: number, height?: number | null } } [limit]
 * @returns { Promise<T | ImageBitmap | HTMLCanvasElement> }
 */
export async function capDecodedImage(image, limit) {

    if (image == null || !limit?.width) return image;

    const width = /** @type {any} */ (image).naturalWidth || image.width;

    const height = /** @type {any} */ (image).naturalHeight || image.height;

    if (!width || !height) return image;

    const size = fitDecodeLimit(width, height, limit);

    if (!size) return image;

    if (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap) {

        const resized = await createImageBitmap(image, {
            resizeWidth: size.width,
            resizeHeight: size.height,
            resizeQuality: "high",
        });

        image.close();

        /** @type {any} */ (resized).naturalWidth = size.width;

        /** @type {any} */ (resized).naturalHeight = size.height;

        return resized;
    }

    if (typeof document === "undefined") return image;

    const canvas = document.createElement("canvas");

    canvas.width = size.width;

    canvas.height = size.height;

    const context = canvas.getContext("2d");

    if (!context) return image;

    const source = /** @type {any} */ (image);

    context.drawImage(source, 0, 0, size.width, size.height);

    /** @type {any} */ (canvas).naturalWidth = size.width;

    /** @type {any} */ (canvas).naturalHeight = size.height;

    return canvas;
}

/**
 * WebGL silently downscaled images over MAX_TEXTURE_SIZE; WebGPU doesn't; the
 * texture fails to create and every frame that draws it is rejected (black
 * screen). Shrink oversized images before they reach a texture.
 *
 * @template { HTMLImageElement | ImageBitmap } T
 * @param { T } image
 * @returns { Promise<T | ImageBitmap | HTMLCanvasElement> }
 */
export async function fitImageToTextureLimit(image) {

    const width = /** @type {any} */ (image).naturalWidth || image.width;

    const height = /** @type {any} */ (image).naturalHeight || image.height;

    if (!width || !height) return image;

    if (width <= GUARANTEED_MAX && height <= GUARANTEED_MAX) return image;

    const { default: renderer } = await import("../renderer");

    const max = renderer.capabilities.maxTextureSize;

    if (!max) return image;

    if (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap) {

        const size = fitTextureSize(width, height, max);

        if (!size) return image;

        // a bitmap source keeps its orientation (no second flip)
        const resized = await createImageBitmap(image, {
            resizeWidth: size.width,
            resizeHeight: size.height,
            resizeQuality: "high",
        });

        image.close();

        /** @type {any} */ (resized).naturalWidth = size.width;

        /** @type {any} */ (resized).naturalHeight = size.height;

        return resized;
    }

    const size = fitTextureSize(width, height, Math.min(max, CANVAS_MAX));

    if (!size || width <= max && height <= max) return image;

    const canvas = document.createElement("canvas");

    canvas.width = size.width;

    canvas.height = size.height;

    canvas.getContext("2d").drawImage(image, 0, 0, size.width, size.height);

    /** @type {any} */ (canvas).naturalWidth = size.width;

    /** @type {any} */ (canvas).naturalHeight = size.height;

    return canvas;
}
