// What a game draws, counted where it meets the graphics card.
//
// `pnpm games:check` adds this to every frame of its browser before the
// game loads (Playwright's init script). It wraps the drawing calls of
// WebGL and WebGPU, so it counts any game, whatever library drew it, and
// the game does nothing for it. It only counts: every call goes through
// unchanged, and a failure in here is swallowed.
//
// Read back with `window.__oncyberScene.read()`:
//
//   frames     rendered frames counted (a frame with no draw is skipped)
//   triangles  per frame, over every pass: usual (median), heavy (95th
//              percentile) and peak
//   calls      draw calls per frame, the same three
//   passes     a heavy frame's passes (the frame at the 95th percentile,
//              so not a moment when two frames were drawn at once): where
//              each drew (the screen or a texture), its triangles and calls
//   textures   live textures: how many, their estimated bytes on the card,
//              the largest one's size
//   canvas     the largest canvas drawn to: backing size and layout size
//
// Not seen: a canvas drawn from a worker (init scripts do not run there),
// 2D canvases, and indirect or bundled WebGPU draws, which are counted as
// calls with no triangles (`unsized`).
//
// The function is turned into text (SCENE_PROBE), so it uses nothing from
// outside itself.

/** @param {any} win the frame's window */
export function installSceneProbe(win) {
    if (win.__oncyberScene) return;
    const MAX_FRAMES = 3600;
    const frames = [];
    const apis = new Set();
    const canvases = new Set();
    const textures = new Map();
    const textureIds = new WeakMap();
    let nextTexture = 1,
        unsized = 0,
        firstDrawAt = null;
    const fresh = () => ({ triangles: 0, calls: 0, passes: [] });
    let frame = fresh();
    const forget =
        typeof win.FinalizationRegistry === "function"
            ? new win.FinalizationRegistry((id) => textures.delete(id))
            : null;

    const guard = (run) => {
        try {
            run();
        } catch {
            /* Counting never breaks the game. */
        }
    };
    /** Replace `proto[name]` with one that counts first. */
    const wrap = (proto, name, count) => {
        const original = proto && proto[name];
        if (typeof original !== "function") return;
        proto[name] = function (...args) {
            guard(() => count(this, args));
            return original.apply(this, args);
        };
    };
    /** As `wrap`, but `count` also gets what the call returned. */
    const wrapResult = (proto, name, count) => {
        const original = proto && proto[name];
        if (typeof original !== "function") return;
        proto[name] = function (...args) {
            const result = original.apply(this, args);
            guard(() => count(this, args, result));
            return result;
        };
    };

    const openPass = (screen) => {
        const pass = { screen, triangles: 0, calls: 0 };
        frame.passes.push(pass);
        return pass;
    };
    const drew = (pass, triangles) => {
        const count = Number.isFinite(triangles) ? Math.max(0, triangles) : 0;
        pass.triangles += count;
        pass.calls++;
        frame.triangles += count;
        frame.calls++;
    };
    const remember = (object, info) => {
        const id = nextTexture++;
        textureIds.set(object, id);
        textures.set(id, info);
        forget?.register(object, id);
        return info;
    };

    // ---- WebGL 1 and 2
    const TRIANGLES = 4,
        STRIP = 5,
        FAN = 6;
    const glTriangles = (mode, count, instances = 1) =>
        (mode === TRIANGLES
            ? Math.floor(count / 3)
            : mode === STRIP || mode === FAN
            ? Math.max(0, count - 2)
            : 0) * instances;
    const COMPRESSED = [
        [0x83f0, 0x83f3],
        [0x8c4c, 0x8c4f],
        [0x8d64, 0x8d64],
        [0x9270, 0x9279],
        [0x93b0, 0x93bd],
        [0x93d0, 0x93dd],
        [0x8e8c, 0x8e8f],
        [0x8dbb, 0x8dbe],
        [0x8c00, 0x8c03],
    ];
    const glBytesPerPixel = (format) =>
        COMPRESSED.some(([from, to]) => format >= from && format <= to)
            ? 1
            : format === 0x8814 // RGBA32F
            ? 16
            : format === 0x881a // RGBA16F
            ? 8
            : format === 0x822b // RG8
            ? 2
            : format === 0x8229 || format === 0x1909 || format === 0x1906 // R8, LUMINANCE, ALPHA
            ? 1
            : 4;
    const CUBE = 0x8513;
    const isFace = (target) => target >= 0x8515 && target <= 0x851a;
    const contexts = new WeakMap();
    const glState = (gl) => {
        let state = contexts.get(gl);
        if (!state) {
            state = {
                screen: true,
                changed: true,
                pass: null,
                frame: null,
                unit: 0,
                bound: new Map(),
            };
            contexts.set(gl, state);
            apis.add(
                win.WebGL2RenderingContext &&
                    gl instanceof win.WebGL2RenderingContext
                    ? "webgl2"
                    : "webgl"
            );
            if (gl.canvas) canvases.add(gl.canvas);
        }
        return state;
    };
    const glDraw = (gl, triangles) => {
        const state = glState(gl);
        if (state.changed || !state.pass || state.frame !== frame) {
            state.pass = openPass(state.screen);
            state.frame = frame;
            state.changed = false;
        }
        drew(state.pass, triangles);
    };
    const glTexture = (gl, target) => {
        const state = glState(gl);
        const texture = state.bound.get(
            `${state.unit}:${isFace(target) ? CUBE : target}`
        );
        if (!texture) return null;
        const id = textureIds.get(texture);
        return id
            ? textures.get(id)
            : remember(texture, {
                  width: 0,
                  height: 0,
                  layers: 1,
                  bytesPerPixel: 4,
                  mips: false,
              });
    };
    const sized = (info, target, width, height, format, layers = 1) => {
        if (!info || !(width > 0) || !(height > 0)) return;
        info.width = width;
        info.height = height;
        info.layers = isFace(target) || target === CUBE ? 6 : layers;
        info.bytesPerPixel = glBytesPerPixel(format);
    };
    const sourceSize = (source) => [
        source?.videoWidth || source?.naturalWidth || source?.displayWidth || source?.width || 0, // prettier-ignore
        source?.videoHeight || source?.naturalHeight || source?.displayHeight || source?.height || 0, // prettier-ignore
    ];
    for (const proto of [
        win.WebGLRenderingContext?.prototype,
        win.WebGL2RenderingContext?.prototype,
    ]) {
        if (!proto) continue;
        wrap(proto, "drawArrays", (gl, [mode, , count]) =>
            glDraw(gl, glTriangles(mode, count))
        );
        wrap(proto, "drawElements", (gl, [mode, count]) =>
            glDraw(gl, glTriangles(mode, count))
        );
        wrap(proto, "drawArraysInstanced", (gl, [mode, , count, instances]) =>
            glDraw(gl, glTriangles(mode, count, instances))
        );
        wrap(
            proto,
            "drawElementsInstanced",
            (gl, [mode, count, , , instances]) =>
                glDraw(gl, glTriangles(mode, count, instances))
        );
        wrap(proto, "drawRangeElements", (gl, [mode, , , count]) =>
            glDraw(gl, glTriangles(mode, count))
        );
        wrap(proto, "bindFramebuffer", (gl, [target, framebuffer]) => {
            // FRAMEBUFFER or DRAW_FRAMEBUFFER: where the next draws land.
            if (target !== 0x8d40 && target !== 0x8ca9) return;
            const state = glState(gl);
            state.screen = !framebuffer;
            state.changed = true;
        });
        // The same framebuffer, another target: a cube's faces, a cascade.
        for (const name of ["framebufferTexture2D", "framebufferTextureLayer"])
            wrap(proto, name, (gl) => (glState(gl).changed = true));
        wrap(proto, "activeTexture", (gl, [unit]) => {
            glState(gl).unit = unit;
        });
        wrap(proto, "bindTexture", (gl, [target, texture]) => {
            const state = glState(gl);
            state.bound.set(`${state.unit}:${target}`, texture);
        });
        wrap(proto, "texImage2D", (gl, args) => {
            const [target, level, format] = args;
            if (level !== 0) return;
            const [width, height] =
                args.length >= 9 ? [args[3], args[4]] : sourceSize(args[5]);
            sized(glTexture(gl, target), target, width, height, format);
        });
        wrap(proto, "texStorage2D", (gl, args) => {
            const [target, levels, format, width, height] = args;
            const info = glTexture(gl, target);
            sized(info, target, width, height, format);
            if (info) info.mips = levels > 1;
        });
        wrap(proto, "texImage3D", (gl, args) => {
            const [target, level, format, width, height, depth] = args;
            if (level !== 0) return;
            sized(glTexture(gl, target), target, width, height, format, depth);
        });
        wrap(proto, "texStorage3D", (gl, args) => {
            const [target, levels, format, width, height, depth] = args;
            const info = glTexture(gl, target);
            sized(info, target, width, height, format, depth);
            if (info) info.mips = levels > 1;
        });
        wrap(proto, "compressedTexImage2D", (gl, args) => {
            const [target, level, format, width, height] = args;
            if (level !== 0) return;
            sized(glTexture(gl, target), target, width, height, format);
        });
        wrap(proto, "generateMipmap", (gl, [target]) => {
            const info = glTexture(gl, target);
            if (info) info.mips = true;
        });
        wrap(proto, "deleteTexture", (gl, [texture]) => {
            const id = texture && textureIds.get(texture);
            if (id) textures.delete(id);
        });
    }

    // ---- WebGPU
    const topologies = new WeakMap();
    const passes = new WeakMap();
    const screenTextures = new WeakSet();
    const screenViews = new WeakSet();
    const gpuTriangles = (topology, count, instances = 1) =>
        (topology === "triangle-strip"
            ? Math.max(0, count - 2)
            : topology === "triangle-list" || topology === undefined
            ? Math.floor(count / 3)
            : 0) * instances;
    const gpuBytesPerPixel = (format = "") =>
        /^(bc|etc2|eac|astc)/.test(format)
            ? 1
            : /32float/.test(format)
            ? format.startsWith("rgba")
                ? 16
                : 4
            : /16float/.test(format)
            ? format.startsWith("rgba")
                ? 8
                : 2
            : /^r8/.test(format)
            ? 1
            : /^rg8/.test(format)
            ? 2
            : 4;
    const pipelineMade = (descriptor, pipeline) => {
        if (pipeline)
            topologies.set(
                pipeline,
                descriptor?.primitive?.topology ?? "triangle-list"
            );
    };
    wrapResult(
        win.GPUDevice?.prototype,
        "createRenderPipeline",
        (device, [descriptor], pipeline) => pipelineMade(descriptor, pipeline)
    );
    wrapResult(
        win.GPUDevice?.prototype,
        "createRenderPipelineAsync",
        (device, [descriptor], made) =>
            made?.then?.(
                (pipeline) => guard(() => pipelineMade(descriptor, pipeline)),
                () => {}
            )
    );
    wrapResult(
        win.GPUCanvasContext?.prototype,
        "getCurrentTexture",
        (context, args, texture) => {
            apis.add("webgpu");
            if (context.canvas) canvases.add(context.canvas);
            if (texture) screenTextures.add(texture);
        }
    );
    wrapResult(
        win.GPUTexture?.prototype,
        "createView",
        (texture, args, view) => {
            if (view && screenTextures.has(texture)) screenViews.add(view);
        }
    );
    wrapResult(
        win.GPUDevice?.prototype,
        "createTexture",
        (device, [descriptor], texture) => {
            if (!texture || !descriptor) return;
            const size = descriptor.size ?? [];
            const list = Array.isArray(size) || ArrayBuffer.isView(size);
            const width = list ? size[0] : size.width;
            const height = (list ? size[1] : size.height) ?? 1;
            const layers = (list ? size[2] : size.depthOrArrayLayers) ?? 1;
            if (!(width > 0)) return;
            remember(texture, {
                width,
                height,
                layers: layers * (descriptor.sampleCount ?? 1),
                bytesPerPixel: gpuBytesPerPixel(descriptor.format),
                mips: (descriptor.mipLevelCount ?? 1) > 1,
            });
        }
    );
    wrap(win.GPUTexture?.prototype, "destroy", (texture) => {
        const id = textureIds.get(texture);
        if (id) textures.delete(id);
    });
    wrapResult(
        win.GPUCommandEncoder?.prototype,
        "beginRenderPass",
        (encoder, [descriptor], pass) => {
            if (!pass) return;
            apis.add("webgpu");
            const screen = [...(descriptor?.colorAttachments ?? [])].some(
                (attachment) =>
                    attachment &&
                    (screenViews.has(attachment.view) ||
                        screenViews.has(attachment.resolveTarget))
            );
            passes.set(pass, { pass: openPass(screen), topology: undefined });
        }
    );
    const pass = win.GPURenderPassEncoder?.prototype;
    wrap(pass, "setPipeline", (encoder, [pipeline]) => {
        const state = passes.get(encoder);
        if (state) state.topology = topologies.get(pipeline);
    });
    for (const name of ["draw", "drawIndexed"])
        wrap(pass, name, (encoder, [count, instances]) => {
            const state = passes.get(encoder);
            if (state)
                drew(
                    state.pass,
                    gpuTriangles(state.topology, count, instances ?? 1)
                );
        });
    for (const name of ["drawIndirect", "drawIndexedIndirect", "executeBundles"]) // prettier-ignore
        wrap(pass, name, (encoder) => {
            const state = passes.get(encoder);
            if (!state) return;
            unsized++;
            drew(state.pass, 0);
        });

    // ---- frames
    const tick = () => {
        if (frame.calls) {
            if (firstDrawAt === null)
                firstDrawAt = Math.round(win.performance?.now?.() ?? 0);
            frames.push(frame);
            if (frames.length > MAX_FRAMES) frames.shift();
        }
        frame = fresh();
        win.requestAnimationFrame?.(tick);
    };
    win.requestAnimationFrame?.(tick);

    const at = (sorted, q) =>
        sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
    const spread = (key) => {
        const sorted = frames.map((one) => one[key]).sort((a, b) => a - b);
        if (!sorted.length) return { usual: 0, heavy: 0, peak: 0 };
        return {
            usual: at(sorted, 0.5),
            heavy: at(sorted, 0.95),
            peak: sorted[sorted.length - 1],
        };
    };
    win.__oncyberScene = {
        read() {
            let bytes = 0,
                largest = null;
            for (const info of textures.values()) {
                if (!info.width) continue;
                bytes +=
                    info.width *
                    info.height *
                    info.layers *
                    info.bytesPerPixel *
                    (info.mips ? 4 / 3 : 1);
                if (
                    !largest ||
                    info.width * info.height > largest.width * largest.height
                )
                    largest = { width: info.width, height: info.height };
            }
            const heavy = frames.length
                ? at(
                      [...frames].sort((a, b) => a.triangles - b.triangles),
                      0.95
                  )
                : null;
            let canvas = null;
            for (const one of canvases) {
                if (canvas && one.width * one.height <= canvas.width * canvas.height) continue; // prettier-ignore
                canvas = {
                    width: one.width,
                    height: one.height,
                    layoutWidth: one.clientWidth ?? null,
                    layoutHeight: one.clientHeight ?? null,
                };
            }
            return {
                apis: [...apis],
                frames: frames.length,
                triangles: spread("triangles"),
                calls: spread("calls"),
                passes: (heavy?.passes ?? []).map((one) => ({ ...one })),
                textures: {
                    count: [...textures.values()].filter((t) => t.width).length,
                    bytes: Math.round(bytes),
                    largest,
                },
                canvas,
                pixelRatio: win.devicePixelRatio ?? 1,
                unsized,
                firstDrawAt,
                timeOrigin: win.performance?.timeOrigin ?? null,
            };
        },
    };
}

/** The probe as a script for `page.addInitScript`. */
export const SCENE_PROBE = `(${installSceneProbe.toString()})(window);`;
