import {
    preparePixelRows,
    textureTiles,
    countTextureTiles,
    downsamplePixels,
} from "./progressiveTextureUpload.pixels";

let tiles;
self.onmessage = async ({ data }) => {
    try {
        if (data.type === "init") {
            const {
                encodedBlob,
                width,
                height,
                tileSize,
                srgb,
                mipmaps,
                flipY,
                premultiplyAlpha,
                maxDimension,
            } = data;
            let pixels;
            const bitmap = encodedBlob
                ? await createImageBitmap(encodedBlob, {
                      premultiplyAlpha: "none",
                      colorSpaceConversion: "none",
                      imageOrientation: "none",
                  })
                : data.bitmap;
            try {
                if (bitmap.width !== width || bitmap.height !== height)
                    throw new Error(
                        "Texture image dimensions differ from metadata"
                    );
                const canvas = new OffscreenCanvas(width, height);
                // CPU-backed extraction keeps canvas readback work off the rendering thread.
                const context = canvas.getContext("2d", {
                    willReadFrequently: true,
                    colorSpace: "srgb",
                });
                if (!context) throw new Error("Worker canvas unavailable");
                context.drawImage(bitmap, 0, 0);
                pixels = context.getImageData(0, 0, width, height).data;
                canvas.width = 1;
                canvas.height = 1;
            } finally {
                bitmap.close();
            }
            pixels = preparePixelRows(
                pixels,
                width,
                height,
                flipY,
                premultiplyAlpha
            );
            let targetWidth = width,
                targetHeight = height;
            while (Math.max(targetWidth, targetHeight) > maxDimension) {
                const next = downsamplePixels(
                    pixels,
                    targetWidth,
                    targetHeight,
                    srgb
                );
                pixels = next.data;
                targetWidth = next.width;
                targetHeight = next.height;
            }
            tiles = textureTiles(pixels, targetWidth, targetHeight, {
                tileSize,
                srgb,
                mipmaps,
            });
            self.postMessage({
                type: "ready",
                total: countTextureTiles(
                    targetWidth,
                    targetHeight,
                    tileSize,
                    mipmaps
                ),
            });
        } else if (data.type === "next") {
            if (!tiles) throw new Error("Texture worker is not initialised");
            const next = tiles.next();
            if (next.done) {
                tiles = null;
                self.postMessage({ type: "done" });
            } else
                self.postMessage(
                    {
                        type: "tile",
                        ...next.value,
                        data: next.value.data.buffer,
                    },
                    [next.value.data.buffer]
                );
        }
    } catch (error) {
        tiles = null;
        self.postMessage({
            type: "error",
            message: error?.message || "Texture preparation failed",
        });
    }
};
