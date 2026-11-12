import {
    preparePixelRows,
    downsamplePixels,
    textureTiles,
    countTextureTiles,
    cappedTextureSize,
    estimateStorageBytes,
} from "./progressiveTextureUpload.pixels";

test("sRGB mipmaps average in linear light while alpha and linear data average numerically", () => {
    const pixels = Uint8Array.from([
        0, 0, 0, 0, 255, 255, 255, 255, 0, 0, 0, 0, 255, 255, 255, 255,
    ]);
    expect([...downsamplePixels(pixels, 2, 2, true).data]).toEqual([
        188, 188, 188, 128,
    ]);
    expect([...downsamplePixels(pixels, 2, 2, false).data]).toEqual([
        128, 128, 128, 128,
    ]);
});

test("row orientation and explicit alpha premultiplication happen once before tiling", () => {
    const pixels = Uint8Array.from([200, 100, 50, 128, 20, 40, 60, 255]);
    expect([...preparePixelRows(pixels, 1, 2, true, true)]).toEqual([
        20, 40, 60, 255, 100, 50, 25, 128,
    ]);
    expect(preparePixelRows(pixels, 1, 2)).toBe(pixels);
});

test("all non-power-of-two mip levels are covered once by bounded tiles", () => {
    const width = 257,
        height = 129;
    const pixels = new Uint8Array(width * height * 4).fill(128);
    const tiles = [...textureTiles(pixels, width, height, { tileSize: 128 })];
    expect(tiles).toHaveLength(countTextureTiles(width, height, 128, true));
    const coverage = new Map();
    for (const tile of tiles) {
        expect(tile.width).toBeLessThanOrEqual(128);
        expect(tile.height).toBeLessThanOrEqual(128);
        expect(tile.data.byteLength).toBeLessThanOrEqual(65536);
        coverage.set(
            tile.level,
            (coverage.get(tile.level) || 0) + tile.width * tile.height
        );
        expect(tile.data.every((byte) => byte === 128)).toBe(true);
    }
    for (const [level, pixels] of coverage)
        expect(pixels).toBe(
            Math.max(1, width >> level) * Math.max(1, height >> level)
        );
    expect(tiles[tiles.length - 1]).toMatchObject({
        width: 1,
        height: 1,
        level: 8,
    });
});

test("odd mip sizes include edge pixels instead of discarding an atlas border", () => {
    const pixels = Uint8Array.from([
        0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255, 255,
    ]);
    expect([...downsamplePixels(pixels, 3, 1, false).data]).toEqual([
        85, 85, 85, 255,
    ]);
});

test("storage estimates include exact mip allocations and caps select existing mip sizes", () => {
    expect(cappedTextureSize(4096, 2048, 2048)).toEqual({
        width: 2048,
        height: 1024,
    });
    expect(cappedTextureSize(3444, 1080, 2048)).toEqual({
        width: 1722,
        height: 540,
    });
    expect(estimateStorageBytes(2, 2)).toBe(20);
    expect(estimateStorageBytes(2, 2, false)).toBe(16);
    expect(estimateStorageBytes(2048, 2048)).toBe(22369620);
    expect(estimateStorageBytes(0, 1)).toBe(0);
});
