/** @jest-environment jsdom */
import { Texture, SRGBColorSpace } from "three";
import {
    uploadRoomTexture,
    estimateStorageBytes,
} from "./progressiveTextureUpload";
const mockWorkers = [];
let mockWorkerError = false;
jest.mock("./progressiveTextureUpload.worker.js", () => ({
    __esModule: true,
    default: class {
        constructor() {
            this.terminate = jest.fn();
            mockWorkers.push(this);
        }
        postMessage(message) {
            if (mockWorkerError) {
                this.onerror();
                return;
            }
            const {
                preparePixelRows,
                textureTiles,
                countTextureTiles,
                downsamplePixels,
            } = require("./progressiveTextureUpload.pixels");
            if (message.type === "init") {
                this.init = message;
                let pixels = preparePixelRows(
                    (message.bitmap || message.encodedBlob).pixels,
                    message.width,
                    message.height,
                    message.flipY,
                    message.premultiplyAlpha
                );
                let width = message.width,
                    height = message.height;
                while (Math.max(width, height) > message.maxDimension) {
                    const next = downsamplePixels(
                        pixels,
                        width,
                        height,
                        message.srgb
                    );
                    pixels = next.data;
                    width = next.width;
                    height = next.height;
                }
                this.tiles = textureTiles(pixels, width, height, message);
                message.bitmap?.close();
                this.onmessage({
                    data: {
                        type: "ready",
                        total: countTextureTiles(
                            width,
                            height,
                            message.tileSize,
                            message.mipmaps
                        ),
                    },
                });
            } else {
                const next = this.tiles.next();
                this.onmessage({
                    data: next.done
                        ? { type: "done" }
                        : {
                              type: "tile",
                              ...next.value,
                              data: next.value.data.buffer,
                          },
                });
            }
        }
    },
}));
const originals = {
    ImageBitmap: global.ImageBitmap,
    Worker: global.Worker,
    OffscreenCanvas: global.OffscreenCanvas,
    createImageBitmap: global.createImageBitmap,
};
let renderer, waitForSlot, signal;
function source(width = 256, height = 128) {
    const texture = new Texture({
        width,
        height,
        pixels: new Uint8Array(width * height * 4).fill(128),
        close: jest.fn(),
    });
    texture.flipY = false;
    texture.name = "room map";
    texture.colorSpace = SRGBColorSpace;
    return texture;
}
beforeEach(() => {
    mockWorkers.length = 0;
    mockWorkerError = false;
    global.Worker = function () {};
    global.OffscreenCanvas = function () {};
    global.createImageBitmap = jest.fn(async (image) => ({
        ...image,
        close: jest.fn(),
    }));
    renderer = {
        capabilities: { isWebGL2: true, maxTextureSize: 8192 },
        initTexture: jest.fn(),
        copyTextureToTexture: jest.fn(),
        _isDeviceLost: false,
    };
    waitForSlot = jest.fn(async () => {});
    signal = new AbortController().signal;
});
afterEach(() => Object.assign(global, originals));

test("allocates empty storage then copies only bounded tiles across every mip, without uploading the source image", async () => {
    const image = source(),
        onUpload = jest.fn(),
        onProgress = jest.fn();
    const calls = [];
    renderer.copyTextureToTexture.mockImplementation(
        (patch, target, region, position, srcLevel, level) =>
            calls.push({
                x: position.x,
                y: position.y,
                width: patch.image.width,
                height: patch.image.height,
                bytes: patch.image.data.byteLength,
                level,
                srcLevel,
                region,
                patchTarget: target,
                colorSpace: patch.colorSpace,
                isDataTexture: patch.isDataTexture,
            })
    );
    const texture = await uploadRoomTexture(image, {
        renderer,
        signal,
        waitForSlot,
        onUpload,
        onProgress,
    });
    expect(texture).not.toBe(image);
    expect(texture.isTexture).toBe(true);
    expect(texture.isFramebufferTexture).toBeFalsy();
    expect(texture.source.dataReady).toBe(false);
    expect(texture.mipmaps).toHaveLength(9);
    expect(texture.source).not.toBe(image.source);
    expect(texture.image).toEqual({ width: 256, height: 128 });
    expect(texture.generateMipmaps).toBe(false);
    expect(renderer.initTexture).toHaveBeenCalledTimes(1);
    expect(renderer.initTexture).toHaveBeenCalledWith(texture);
    expect(waitForSlot).toHaveBeenCalledTimes(calls.length + 1);
    expect(onUpload).toHaveBeenCalledTimes(calls.length + 1);
    expect(
        calls.every(
            (call) =>
                call.width <= 128 && call.height <= 128 && call.bytes <= 65536
        )
    ).toBe(true);
    expect(
        calls.every(
            (call) =>
                call.patchTarget === texture &&
                call.isDataTexture &&
                call.region === null &&
                call.srcLevel === 0 &&
                call.colorSpace === texture.colorSpace
        )
    ).toBe(true);
    expect(calls[calls.length - 1]).toMatchObject({
        width: 1,
        height: 1,
        level: 8,
    });
    expect(image.image.close).not.toHaveBeenCalled();
    expect(mockWorkers[0].terminate).toHaveBeenCalled();
    expect(texture.userData.progressiveRoomTexture.bytes).toBe(
        estimateStorageBytes(256, 128)
    );
    texture.dispose();
});

test("preserves UV/sampler/color settings and bakes orientation before tiled transfers", async () => {
    const image = source(1, 2);
    image.image.pixels = Uint8Array.from([200, 100, 50, 128, 20, 40, 60, 255]);
    image.flipY = true;
    image.premultiplyAlpha = true;
    image.offset.set(0.2, 0.3);
    image.repeat.set(2, 3);
    image.rotation = 0.4;
    image.anisotropy = 8;
    let first;
    renderer.copyTextureToTexture.mockImplementation((patch) => {
        first ||= [...patch.image.data];
    });
    const texture = await uploadRoomTexture(image, {
        renderer,
        signal,
        waitForSlot,
    });
    expect(first).toEqual([20, 40, 60, 255, 100, 50, 25, 128]);
    expect(texture.offset.toArray()).toEqual([0.2, 0.3]);
    expect(texture.repeat.toArray()).toEqual([2, 3]);
    expect(texture.rotation).toBe(0.4);
    expect(texture.anisotropy).toBe(8);
    expect(texture.colorSpace).toBe(image.colorSpace);
    expect(texture.minFilter).toBe(image.minFilter);
    expect(texture.magFilter).toBe(image.magFilter);
    expect(texture.flipY).toBe(false);
    expect(texture.premultiplyAlpha).toBe(false);
    texture.dispose();
});

test("dimension cap is prepared off-thread and a cap no better than the low image allocates nothing", async () => {
    const image = source();
    image.userData.roomTextureUpgradeLowSize = [64, 32];
    const texture = await uploadRoomTexture(image, {
        renderer,
        signal,
        waitForSlot,
        maxDimension: 128,
    });
    expect(texture.image).toEqual({ width: 128, height: 64 });
    expect(texture.userData.progressiveRoomTexture.capped).toBe(true);
    texture.dispose();
    renderer.initTexture.mockClear();
    global.createImageBitmap.mockClear();
    image.userData.roomTextureUpgradeLowSize = [128, 64];
    expect(
        await uploadRoomTexture(image, {
            renderer,
            signal,
            waitForSlot,
            maxDimension: 128,
        })
    ).toBeNull();
    expect(renderer.initTexture).not.toHaveBeenCalled();
    expect(global.createImageBitmap).not.toHaveBeenCalled();
});

test("cancellation between chunks disposes the detached GPU texture without installing or uploading more tiles", async () => {
    const controller = new AbortController();
    let target,
        disposed = jest.fn();
    renderer.initTexture.mockImplementation((texture) => {
        target = texture;
        target.addEventListener("dispose", disposed);
    });
    renderer.copyTextureToTexture.mockImplementation(() => controller.abort());
    await expect(
        uploadRoomTexture(source(), {
            renderer,
            signal: controller.signal,
            waitForSlot,
        })
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(renderer.copyTextureToTexture).toHaveBeenCalledTimes(1);
    expect(disposed).toHaveBeenCalledTimes(1);
    expect(mockWorkers[0].terminate).toHaveBeenCalled();
});

test("late bitmap preparation after cancellation closes the clone and never starts a worker", async () => {
    let resolve;
    global.createImageBitmap.mockImplementation(
        () =>
            new Promise((done) => {
                resolve = done;
            })
    );
    const controller = new AbortController();
    const pending = uploadRoomTexture(source(), {
        renderer,
        signal: controller.signal,
        waitForSlot,
    });
    await Promise.resolve();
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    const bitmap = { close: jest.fn() };
    resolve(bitmap);
    for (let index = 0; index < 8; index++) await Promise.resolve();
    expect(bitmap.close).toHaveBeenCalledTimes(1);
    expect(mockWorkers).toHaveLength(0);
    expect(renderer.initTexture).not.toHaveBeenCalled();
});

test("unsupported hardware or texture formats never fall back to a monolithic upload", async () => {
    renderer.capabilities.isWebGL2 = false;
    await expect(
        uploadRoomTexture(source(), { renderer, signal, waitForSlot })
    ).rejects.toMatchObject({ code: "PROGRESSIVE_TEXTURE_UNSUPPORTED" });
    renderer.capabilities.isWebGL2 = true;
    const compressed = source();
    compressed.isCompressedTexture = true;
    await expect(
        uploadRoomTexture(compressed, { renderer, signal, waitForSlot })
    ).rejects.toMatchObject({ code: "PROGRESSIVE_TEXTURE_UNSUPPORTED" });
    expect(renderer.initTexture).not.toHaveBeenCalled();
    expect(renderer.copyTextureToTexture).not.toHaveBeenCalled();
});

test("worker failure keeps the low texture usable and never allocates GPU storage", async () => {
    mockWorkerError = true;
    const image = source();
    await expect(
        uploadRoomTexture(image, { renderer, signal, waitForSlot })
    ).rejects.toThrow("worker failed");
    expect(renderer.initTexture).not.toHaveBeenCalled();
    expect(image.image.close).not.toHaveBeenCalled();
    expect(mockWorkers[0].terminate).toHaveBeenCalled();
});

test("encoded GLTF images are sent to the worker without decoding on the rendering thread", async () => {
    const image = source();
    const encodedBlob = new Blob(["encoded image"], { type: "image/png" });
    encodedBlob.pixels = image.image.pixels;
    image.image = { width: 256, height: 128, encodedBlob };
    const texture = await uploadRoomTexture(image, {
        renderer,
        signal,
        waitForSlot,
    });
    expect(global.createImageBitmap).not.toHaveBeenCalled();
    expect(mockWorkers[0].init.encodedBlob).toBe(encodedBlob);
    expect(mockWorkers[0].init.bitmap).toBeUndefined();
    expect(texture.image).toEqual({ width: 256, height: 128 });
    texture.dispose();
});

test("bitmap sources bake unpack flags like r180 does for ImageBitmap textures", async () => {
    global.ImageBitmap = class {};
    const image = source(1, 2);
    const bitmap = new global.ImageBitmap();
    Object.assign(bitmap, image.image);
    image.image = bitmap;
    image.flipY = true;
    image.premultiplyAlpha = true;
    const texture = await uploadRoomTexture(image, {
        renderer,
        signal,
        waitForSlot,
    });
    expect(mockWorkers[0].init.flipY).toBe(true);
    expect(mockWorkers[0].init.premultiplyAlpha).toBe(true);
    expect(bitmap.close).not.toHaveBeenCalled();
    texture.dispose();
});

test("device loss during a queued upload releases detached texture without another GPU call", async () => {
    let lost = false;
    const disposed = jest.fn();
    Object.defineProperty(renderer, "_isDeviceLost", { get: () => lost });
    renderer.initTexture.mockImplementation((texture) =>
        texture.addEventListener("dispose", disposed)
    );
    waitForSlot.mockImplementation(async () => {
        if (renderer.initTexture.mock.calls.length) lost = true;
    });
    await expect(
        uploadRoomTexture(source(), { renderer, signal, waitForSlot })
    ).rejects.toMatchObject({ code: "WEBGL_CONTEXT_LOST" });
    expect(renderer.initTexture).toHaveBeenCalledTimes(1);
    expect(renderer.copyTextureToTexture).not.toHaveBeenCalled();
    expect(disposed).toHaveBeenCalledTimes(1);
    expect(mockWorkers[0].terminate).toHaveBeenCalled();
});
