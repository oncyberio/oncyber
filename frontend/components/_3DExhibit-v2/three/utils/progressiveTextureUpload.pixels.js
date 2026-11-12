/** Worker-side pixel preparation. No DOM, renderer, or GPU operations. */
let linear, encoded;
function prepareColorTables() {
    if (linear) return;
    linear = Float32Array.from({ length: 256 }, (_, value) => {
        const channel = value / 255;
        return channel <= 0.04045
            ? channel / 12.92
            : ((channel + 0.055) / 1.055) ** 2.4;
    });
    encoded = Uint8Array.from({ length: 65536 }, (_, value) => {
        const channel = value / 65535;
        return Math.round(
            255 *
                (channel <= 0.0031308
                    ? channel * 12.92
                    : 1.055 * channel ** (1 / 2.4) - 0.055)
        );
    });
}

export function preparePixelRows(
    input,
    width,
    height,
    flipY = false,
    premultiplyAlpha = false
) {
    if (!flipY && !premultiplyAlpha) return input;
    const output = new Uint8Array(input.length);
    for (let y = 0; y < height; y++) {
        const source = (flipY ? height - y - 1 : y) * width * 4;
        for (let x = 0; x < width; x++) {
            const a = source + x * 4,
                b = (y * width + x) * 4;
            const scale = premultiplyAlpha ? input[a + 3] / 255 : 1;
            output[b] = Math.round(input[a] * scale);
            output[b + 1] = Math.round(input[a + 1] * scale);
            output[b + 2] = Math.round(input[a + 2] * scale);
            output[b + 3] = input[a + 3];
        }
    }
    return output;
}

export function downsamplePixels(input, width, height, srgb) {
    if (srgb) prepareColorTables();
    const nextWidth = Math.max(1, Math.floor(width / 2));
    const nextHeight = Math.max(1, Math.floor(height / 2));
    const output = new Uint8Array(nextWidth * nextHeight * 4);
    const scaleX = width / nextWidth,
        scaleY = height / nextHeight;
    for (let y = 0; y < nextHeight; y++)
        for (let x = 0; x < nextWidth; x++) {
            const x0 = x * scaleX,
                x1 = (x + 1) * scaleX;
            const y0 = y * scaleY,
                y1 = (y + 1) * scaleY;
            const channels = [0, 0, 0, 0];
            for (let sy = Math.floor(y0); sy < Math.ceil(y1); sy++) {
                const yWeight = Math.min(y1, sy + 1) - Math.max(y0, sy);
                for (let sx = Math.floor(x0); sx < Math.ceil(x1); sx++) {
                    const weight =
                        yWeight * (Math.min(x1, sx + 1) - Math.max(x0, sx));
                    const offset =
                        (Math.min(sy, height - 1) * width +
                            Math.min(sx, width - 1)) *
                        4;
                    for (let c = 0; c < 4; c++)
                        channels[c] +=
                            weight *
                            (srgb && c < 3
                                ? linear[input[offset + c]]
                                : input[offset + c]);
                }
            }
            const area = scaleX * scaleY,
                target = (y * nextWidth + x) * 4;
            for (let c = 0; c < 4; c++) {
                const average = channels[c] / area;
                output[target + c] =
                    srgb && c < 3
                        ? encoded[
                              Math.max(
                                  0,
                                  Math.min(65535, Math.round(average * 65535))
                              )
                          ]
                        : Math.round(average);
            }
        }
    return { data: output, width: nextWidth, height: nextHeight };
}

export function countTextureTiles(width, height, tileSize, mipmaps) {
    let count = 0;
    do {
        count += Math.ceil(width / tileSize) * Math.ceil(height / tileSize);
        if (!mipmaps || (width === 1 && height === 1)) break;
        width = Math.max(1, Math.floor(width / 2));
        height = Math.max(1, Math.floor(height / 2));
    } while (true);
    return count;
}

/** Produces only one transferable tile at a time; old mip buffers can be freed. */
export function* textureTiles(
    pixels,
    width,
    height,
    { tileSize = 128, srgb = false, mipmaps = true } = {}
) {
    let level = 0;
    do {
        for (let y = 0; y < height; y += tileSize)
            for (let x = 0; x < width; x += tileSize) {
                const w = Math.min(tileSize, width - x),
                    h = Math.min(tileSize, height - y);
                const data = new Uint8Array(w * h * 4);
                for (let row = 0; row < h; row++)
                    data.set(
                        pixels.subarray(
                            ((y + row) * width + x) * 4,
                            ((y + row) * width + x + w) * 4
                        ),
                        row * w * 4
                    );
                yield { data, x, y, width: w, height: h, level };
            }
        if (!mipmaps || (width === 1 && height === 1)) break;
        const next = downsamplePixels(pixels, width, height, srgb);
        pixels = next.data;
        width = next.width;
        height = next.height;
        level++;
    } while (true);
}

export function cappedTextureSize(width, height, maxDimension = 2048) {
    while (Math.max(width, height) > maxDimension) {
        width = Math.max(1, Math.floor(width / 2));
        height = Math.max(1, Math.floor(height / 2));
    }
    return { width, height };
}

export function estimateStorageBytes(width, height, mipmaps = true) {
    if (![width, height].every((size) => Number.isInteger(size) && size > 0))
        return 0;
    let bytes = 0;
    do {
        bytes += width * height * 4;
        if (!mipmaps || (width === 1 && height === 1)) return bytes;
        width = Math.max(1, Math.floor(width / 2));
        height = Math.max(1, Math.floor(height / 2));
    } while (true);
}
