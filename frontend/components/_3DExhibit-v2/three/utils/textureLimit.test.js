/** @jest-environment jsdom */
import { capDecodedImage, fitDecodeLimit } from "./textureLimit";

class FakeBitmap {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.close = jest.fn();
    }
}

beforeEach(() => {
    global.ImageBitmap = FakeBitmap;
    global.createImageBitmap = jest.fn(
        async (_source, { resizeWidth, resizeHeight }) =>
            new FakeBitmap(resizeWidth, resizeHeight)
    );
});

afterEach(() => {
    delete global.ImageBitmap;
    delete global.createImageBitmap;
});

test("the cap keeps the aspect ratio and leaves fitting images alone", () => {
    expect(fitDecodeLimit(4000, 3000, { width: 512, height: 512 })).toEqual({
        width: 512,
        height: 384,
    });
    expect(fitDecodeLimit(1000, 4000, { width: 1024, height: 1024 })).toEqual({
        width: 256,
        height: 1024,
    });
    expect(fitDecodeLimit(512, 300, { width: 512, height: 512 })).toBeNull();
    // seadn returns width-bounded portraits: only the width is capped.
    expect(fitDecodeLimit(512, 1400, { width: 512, height: null })).toBeNull();
    expect(fitDecodeLimit(2048, 4096, { width: 512, height: null })).toEqual({
        width: 512,
        height: 1024,
    });
});

test("a 4000 px bitmap is resized at decode size and the original released", async () => {
    const original = new FakeBitmap(4000, 3000);
    const capped = await capDecodedImage(original, { width: 512, height: 512 });
    expect(createImageBitmap).toHaveBeenCalledWith(original, {
        resizeWidth: 512,
        resizeHeight: 384,
        resizeQuality: "high",
    });
    expect(original.close).toHaveBeenCalled();
    expect(capped).toMatchObject({
        width: 512,
        height: 384,
        naturalWidth: 512,
        naturalHeight: 384,
    });
    // GPU memory with mipmaps (RGBA, x4/3): 64 MB before, 1 MB after.
    const gpuBytes = (w, h) => Math.round((w * h * 4 * 4) / 3);
    expect(gpuBytes(4000, 3000)).toBeGreaterThan(60e6);
    expect(gpuBytes(capped.width, capped.height)).toBeLessThan(1.1e6);
});

test("images that fit, or loads without a limit, are untouched", async () => {
    const small = new FakeBitmap(300, 200);
    expect(await capDecodedImage(small, { width: 512, height: 512 })).toBe(
        small
    );
    const big = new FakeBitmap(4000, 3000);
    expect(await capDecodedImage(big, undefined)).toBe(big);
    expect(createImageBitmap).not.toHaveBeenCalled();
    expect(big.close).not.toHaveBeenCalled();
});

test("an image element becomes a canvas of the capped size", async () => {
    const drawImage = jest.fn();
    jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
        drawImage,
    });
    const image = { naturalWidth: 3000, naturalHeight: 3000, width: 3000 };
    const capped = await capDecodedImage(image, { width: 1024, height: 1024 });
    expect(capped).toBeInstanceOf(HTMLCanvasElement);
    expect(capped).toMatchObject({ width: 1024, height: 1024 });
    expect(drawImage).toHaveBeenCalledWith(image, 0, 0, 1024, 1024);
});
