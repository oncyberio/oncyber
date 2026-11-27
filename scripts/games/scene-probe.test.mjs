// node --test scripts/games/scene-probe.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { SCENE_PROBE, installSceneProbe } from "./scene-probe.mjs";

/** A window with stand-in graphics classes whose calls do nothing. */
function fakeWindow() {
    const queue = [];
    const methods = (names) =>
        Object.fromEntries(names.map((name) => [name, function () {}]));
    class WebGLRenderingContext {}
    class WebGL2RenderingContext {
        constructor(canvas) {
            this.canvas = canvas;
        }
    }
    Object.assign(
        WebGL2RenderingContext.prototype,
        methods([
            "drawArrays",
            "drawElements",
            "drawArraysInstanced",
            "drawElementsInstanced",
            "drawRangeElements",
            "bindFramebuffer",
            "framebufferTexture2D",
            "framebufferTextureLayer",
            "activeTexture",
            "bindTexture",
            "texImage2D",
            "texStorage2D",
            "texImage3D",
            "texStorage3D",
            "compressedTexImage2D",
            "generateMipmap",
            "deleteTexture",
        ])
    );
    class GPUTexture {
        createView() {
            return {};
        }
        destroy() {}
    }
    class GPUDevice {
        createRenderPipeline() {
            return {};
        }
        createTexture() {
            return new GPUTexture();
        }
    }
    class GPUCanvasContext {
        constructor(canvas) {
            this.canvas = canvas;
        }
        getCurrentTexture() {
            return (this.texture ??= new GPUTexture());
        }
    }
    class GPURenderPassEncoder {}
    Object.assign(
        GPURenderPassEncoder.prototype,
        methods(["setPipeline", "draw", "drawIndexed", "drawIndirect"])
    );
    class GPUCommandEncoder {
        beginRenderPass() {
            return new GPURenderPassEncoder();
        }
    }
    const win = {
        WebGLRenderingContext,
        WebGL2RenderingContext,
        GPUTexture,
        GPUDevice,
        GPUCanvasContext,
        GPURenderPassEncoder,
        GPUCommandEncoder,
        devicePixelRatio: 3,
        performance: { now: () => 1234, timeOrigin: 1000 },
        requestAnimationFrame: (callback) => queue.push(callback),
        /** Ends the frame: runs what was asked for the next one. */
        nextFrame() {
            for (const callback of queue.splice(0)) callback(0);
        },
    };
    return win;
}

const TRIANGLES = 4,
    STRIP = 5,
    LINES = 1,
    FRAMEBUFFER = 0x8d40,
    TEXTURE_2D = 0x0de1,
    RGBA8 = 0x8058;

test("counts a frame's triangles and draw calls, by where they land", () => {
    const win = fakeWindow();
    installSceneProbe(win);
    const gl = new win.WebGL2RenderingContext({
        width: 1280,
        height: 720,
        clientWidth: 1280,
        clientHeight: 720,
    });
    // A shadow map, then the screen.
    gl.bindFramebuffer(FRAMEBUFFER, {});
    gl.drawElements(TRIANGLES, 3000, 0, 0);
    gl.bindFramebuffer(FRAMEBUFFER, null);
    gl.drawElements(TRIANGLES, 3000, 0, 0);
    gl.drawArrays(STRIP, 0, 4);
    gl.drawArrays(LINES, 0, 10);
    gl.drawElementsInstanced(TRIANGLES, 30, 0, 0, 5);
    win.nextFrame();

    const read = win.__oncyberScene.read();
    assert.deepEqual(read.apis, ["webgl2"]);
    assert.equal(read.frames, 1);
    assert.equal(read.triangles.usual, 1000 + 1000 + 2 + 0 + 50);
    assert.equal(read.calls.usual, 5);
    assert.deepEqual(read.passes, [
        { screen: false, triangles: 1000, calls: 1 },
        { screen: true, triangles: 1052, calls: 4 },
    ]);
    assert.deepEqual(read.canvas, {
        width: 1280,
        height: 720,
        layoutWidth: 1280,
        layoutHeight: 720,
    });
    assert.equal(read.pixelRatio, 3);
    assert.equal(read.firstDrawAt, 1234);
});

test("a frame that draws nothing is not counted, and the heavy frame is the 95th percentile", () => {
    const win = fakeWindow();
    installSceneProbe(win);
    const gl = new win.WebGL2RenderingContext({});
    win.nextFrame();
    for (let i = 1; i <= 100; i++) {
        gl.drawArrays(TRIANGLES, 0, i * 3);
        win.nextFrame();
    }
    const read = win.__oncyberScene.read();
    assert.equal(read.frames, 100);
    assert.deepEqual(read.triangles, { usual: 51, heavy: 96, peak: 100 });
    // The passes are a heavy frame's, not the one moment that drew most.
    assert.deepEqual(read.passes, [{ screen: true, triangles: 96, calls: 1 }]);
});

test("two frames drawn in one are not what the passes describe", () => {
    const win = fakeWindow();
    installSceneProbe(win);
    const gl = new win.WebGL2RenderingContext({});
    const render = () => {
        gl.bindFramebuffer(FRAMEBUFFER, {});
        gl.drawArrays(TRIANGLES, 0, 3000);
        gl.bindFramebuffer(FRAMEBUFFER, null);
        gl.drawArrays(TRIANGLES, 0, 30000);
    };
    for (let i = 0; i < 100; i++) {
        render();
        // Now and then the game draws twice before the next frame.
        if (i % 50 === 0) render();
        win.nextFrame();
    }
    const read = win.__oncyberScene.read();
    assert.equal(read.triangles.peak, 22000);
    assert.equal(read.triangles.heavy, 11000);
    assert.deepEqual(read.passes, [
        { screen: false, triangles: 1000, calls: 1 },
        { screen: true, triangles: 10000, calls: 1 },
    ]);
});

test("the same framebuffer with another target is another pass", () => {
    const win = fakeWindow();
    installSceneProbe(win);
    const gl = new win.WebGL2RenderingContext({});
    gl.bindFramebuffer(FRAMEBUFFER, {});
    for (let face = 0; face < 6; face++) {
        gl.framebufferTexture2D(FRAMEBUFFER, 0, 0x8515 + face, {}, 0);
        gl.drawArrays(TRIANGLES, 0, 300);
    }
    win.nextFrame();
    assert.equal(win.__oncyberScene.read().passes.length, 6);
});

test("textures: size on the card, per unit, until they are deleted", () => {
    const win = fakeWindow();
    installSceneProbe(win);
    const gl = new win.WebGL2RenderingContext({});
    const a = {},
        b = {},
        cube = {};
    gl.activeTexture(0x84c0);
    gl.bindTexture(TEXTURE_2D, a);
    gl.activeTexture(0x84c1);
    gl.bindTexture(TEXTURE_2D, b);
    // Unit 1: 1024 x 1024 from an image, with mipmaps.
    gl.texImage2D(TEXTURE_2D, 0, RGBA8, 0x1908, 0x1401, {
        naturalWidth: 1024,
        naturalHeight: 1024,
    });
    gl.generateMipmap(TEXTURE_2D);
    // Unit 0: 256 x 256 from bytes; a smaller level changes nothing.
    gl.activeTexture(0x84c0);
    gl.texImage2D(TEXTURE_2D, 0, RGBA8, 256, 256, 0, 0x1908, 0x1401, null);
    gl.texImage2D(TEXTURE_2D, 1, RGBA8, 128, 128, 0, 0x1908, 0x1401, null);
    // A compressed cube map: one byte a pixel, six faces.
    gl.bindTexture(0x8513, cube);
    gl.texStorage2D(0x8513, 1, 0x93b0, 512, 512);

    let read = win.__oncyberScene.read();
    assert.equal(read.textures.count, 3);
    assert.equal(
        read.textures.bytes,
        Math.round((1024 * 1024 * 4 * 4) / 3) + 256 * 256 * 4 + 512 * 512 * 6
    );
    assert.deepEqual(read.textures.largest, { width: 1024, height: 1024 });

    gl.deleteTexture(b);
    read = win.__oncyberScene.read();
    assert.equal(read.textures.count, 2);
    assert.deepEqual(read.textures.largest, { width: 512, height: 512 });
});

test("WebGPU: passes, topology, the screen, textures and draws it cannot size", () => {
    const win = fakeWindow();
    installSceneProbe(win);
    const device = new win.GPUDevice();
    const context = new win.GPUCanvasContext({
        width: 780,
        height: 1688,
        clientWidth: 390,
        clientHeight: 844,
    });
    const list = device.createRenderPipeline({});
    const strip = device.createRenderPipeline({
        primitive: { topology: "triangle-strip" },
    });
    const lines = device.createRenderPipeline({
        primitive: { topology: "line-list" },
    });
    const shadow = device.createTexture({
        size: [2048, 2048],
        format: "depth32float",
    });
    const hdr = device.createTexture({
        size: { width: 512, height: 512 },
        format: "rgba16float",
        mipLevelCount: 4,
    });
    const encoder = new win.GPUCommandEncoder();

    const first = encoder.beginRenderPass({
        colorAttachments: [],
        depthStencilAttachment: { view: shadow.createView() },
    });
    first.setPipeline(list);
    first.drawIndexed(6000, 1);
    const second = encoder.beginRenderPass({
        colorAttachments: [{ view: context.getCurrentTexture().createView() }],
    });
    second.setPipeline(list);
    second.drawIndexed(6000);
    second.setPipeline(strip);
    second.draw(4, 10);
    second.setPipeline(lines);
    second.draw(100);
    second.drawIndirect({}, 0);
    win.nextFrame();

    let read = win.__oncyberScene.read();
    assert.deepEqual(read.apis, ["webgpu"]);
    assert.deepEqual(read.passes, [
        { screen: false, triangles: 2000, calls: 1 },
        { screen: true, triangles: 2020, calls: 4 },
    ]);
    assert.equal(read.unsized, 1);
    assert.equal(read.canvas.width, 780);
    assert.equal(
        read.textures.bytes,
        2048 * 2048 * 4 + Math.round((512 * 512 * 8 * 4) / 3)
    );

    hdr.destroy();
    read = win.__oncyberScene.read();
    assert.equal(read.textures.count, 1);
});

test("every call still reaches the graphics card, with what it returned", () => {
    const win = fakeWindow();
    const seen = [];
    win.WebGL2RenderingContext.prototype.drawArrays = function (...args) {
        seen.push(args);
        return "drawn";
    };
    installSceneProbe(win);
    const gl = new win.WebGL2RenderingContext({});
    assert.equal(gl.drawArrays(TRIANGLES, 0, 3), "drawn");
    assert.deepEqual(seen, [[TRIANGLES, 0, 3]]);
    const pipeline = new win.GPUDevice().createRenderPipeline({});
    assert.ok(pipeline);
});

test("installs once, and where there is no WebGL or WebGPU at all", () => {
    const win = fakeWindow();
    installSceneProbe(win);
    const scene = win.__oncyberScene;
    installSceneProbe(win);
    assert.equal(win.__oncyberScene, scene);

    const bare = { requestAnimationFrame() {} };
    installSceneProbe(bare);
    const read = bare.__oncyberScene.read();
    assert.equal(read.frames, 0);
    assert.deepEqual(read.triangles, { usual: 0, heavy: 0, peak: 0 });
    assert.equal(read.canvas, null);
});

test("as a script: runs with nothing but the window", () => {
    const win = fakeWindow();
    win.window = win;
    vm.runInNewContext(SCENE_PROBE, win);
    const gl = new win.WebGL2RenderingContext({});
    gl.drawArrays(TRIANGLES, 0, 9);
    win.nextFrame();
    assert.equal(win.__oncyberScene.read().triangles.usual, 3);
});
