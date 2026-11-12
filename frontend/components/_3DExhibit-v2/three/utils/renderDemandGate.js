import { BufferAttribute, InterleavedBuffer, Material, Texture } from "three";

/**
 * The engine side of render on demand (renderDemand.js decides). It tells
 * the decision what changed, from vantage points that need no change in the
 * hundreds of places that animate something:
 *
 * - before skipping a frame (confirm): the camera (matrices, projection,
 *   canvas size), the scene graph (every visible object's world matrix and
 *   material, objects added, removed, shown or hidden), the per-frame
 *   listeners (an animation that starts usually subscribes to the frame
 *   events), gsap tweens in progress, and buffers marked for upload whose
 *   content the GPU does not have;
 * - at any time (invalidate): a texture or material marked for upload
 *   (video frames, canvas textures, loading, sharpening), pointer, touch,
 *   wheel and key input, the tab becoming visible;
 * - continuously: a playing video (a video texture's element, or any
 *   <video> in the page);
 * - after a drawn frame (end): whether the GPU received anything new for it
 *   (uniform buffers, attributes, textures, or a different number of draw
 *   calls). Uniforms changed in place by an animation show up here, so the
 *   world keeps drawing while they move; the probe frame catches them when
 *   they start while the world is idle.
 *
 * @param {{
 *   demand: ReturnType<typeof import("./renderDemand").createRenderDemand>,
 *   renderer?: any,
 *   emitter?: any,
 *   frameEvents?: string[],
 *   gsap?: any,
 *   classes?: {
 *     Texture?: any,
 *     BufferAttribute?: any,
 *     InterleavedBuffer?: any,
 *     Material?: any,
 *   },
 *   now?: () => number,
 *   win?: any,
 *   doc?: any,
 * }} options
 */
export function createRenderGate({
    demand,
    renderer = null,
    emitter = null,
    frameEvents = [],
    gsap = null,
    classes = { Texture, BufferAttribute, InterleavedBuffer, Material },
    now = () => performance.now(),
    win = typeof window !== "undefined" ? window : null,
    doc = typeof document !== "undefined" ? document : null,
}) {
    const restores = [];
    /** @type {Set<any>} */
    const videoTextures = new Set();
    const writes = { count: 0 };
    let installed = false;
    let frameStartWrites = 0;
    let lastDrawCalls = -1;
    let drawing = false;
    let frameTime = 0;

    const invalidate = () => demand.invalidate();

    function hookNeedsUpdate(proto, onSet) {
        if (!proto) return;
        const descriptor = Object.getOwnPropertyDescriptor(
            proto,
            "needsUpdate"
        );
        if (!descriptor || typeof descriptor.set !== "function") return;
        const { set } = descriptor;
        Object.defineProperty(proto, "needsUpdate", {
            ...descriptor,
            set(value) {
                set.call(this, value);
                if (value === true) onSet(this);
            },
        });
        restores.push(() =>
            Object.defineProperty(proto, "needsUpdate", descriptor)
        );
    }

    function isVideo(element) {
        return (
            element != null &&
            typeof element === "object" &&
            typeof element.paused === "boolean" &&
            typeof element.readyState === "number" &&
            (element.tagName === "VIDEO" ||
                typeof element.videoWidth === "number")
        );
    }

    function playing(video) {
        return !video.paused && !video.ended && video.readyState >= 2;
    }

    // Buffers marked or re-uploaded with the same content are not a change:
    // DynamicDrawUsage attributes go up every frame, and the instanced
    // artwork frames and name tags re-sort and re-mark themselves on every
    // frame while shadows auto-update (abstract/instancedgeometry.js). A copy
    // of each buffer is kept from its first re-upload on (first uploads,
    // createAttribute, never come here); it holds what the GPU has.
    const attributeCopies = new WeakMap();
    /** @type {Set<any>} buffers marked for upload since the last frame */
    const markedBuffers = new Set();

    /** Whether `attribute` differs from what the GPU has; `keep` records it. */
    function attributeChanged(attribute, keep = true) {
        const array = attribute?.array;
        if (!array || typeof array.length !== "number") return true;
        const copy = attributeCopies.get(attribute);
        if (
            !copy ||
            copy.length !== array.length ||
            copy.constructor !== array.constructor
        ) {
            if (keep) attributeCopies.set(attribute, array.slice());
            return true;
        }
        let changed = false;
        const compare = (start, count) => {
            const end = Math.min(array.length, start + count);
            for (let i = Math.max(0, start); i < end; i++) {
                const value = array[i];
                // NaN stays NaN: not a change
                if (
                    copy[i] !== value &&
                    (value === value || copy[i] === copy[i])
                ) {
                    if (!keep) return true;
                    copy[i] = value;
                    changed = true;
                }
            }
            return false;
        };
        const ranges = attribute.updateRanges;
        if (ranges && ranges.length > 0) {
            for (const range of ranges)
                if (compare(range.start, range.count)) return true;
        } else if (compare(0, array.length)) return true;
        return changed;
    }

    /** Marked buffers whose content the GPU does not have yet. */
    function buffersChanged() {
        let changed = false;
        for (const buffer of markedBuffers) {
            if (attributeChanged(buffer, false)) {
                changed = true;
                break;
            }
        }
        markedBuffers.clear();
        return changed;
    }

    function meter(backend, name, isChange = null) {
        if (!backend || typeof backend[name] !== "function") return;
        const original = backend[name];
        backend[name] = function (value) {
            if (!isChange || isChange(value)) writes.count++;
            return original.apply(this, arguments);
        };
        restores.push(() => {
            backend[name] = original;
        });
    }

    function listen(target, type) {
        if (!target?.addEventListener) return;
        const options = { capture: true, passive: true };
        target.addEventListener(type, invalidate, options);
        restores.push(() =>
            target.removeEventListener(type, invalidate, options)
        );
    }

    // --- detectors run before a skip -------------------------------------

    const cameraState = new Float64Array(34);
    let lastCamera = null;

    function cameraChanged(camera) {
        if (!camera) return true;
        let changed = camera !== lastCamera;
        lastCamera = camera;
        const world = camera.matrixWorld?.elements || [];
        const projection = camera.projectionMatrix?.elements || [];
        for (let i = 0; i < 16; i++) {
            const a = world[i];
            if (cameraState[i] !== a) {
                cameraState[i] = a;
                changed = true;
            }
            const b = projection[i];
            if (cameraState[16 + i] !== b) {
                cameraState[16 + i] = b;
                changed = true;
            }
        }
        const canvas = renderer?.domElement;
        const width = canvas?.width || 0;
        const height = canvas?.height || 0;
        if (cameraState[32] !== width || cameraState[33] !== height) {
            cameraState[32] = width;
            cameraState[33] = height;
            changed = true;
        }
        return changed;
    }

    let sceneObjects = [];
    let sceneMaterials = [];
    let sceneMatrices = new Float64Array(16 * 256);
    let sceneCount = 0;
    let sceneRoot = null;
    let sceneBackground = null;
    let sceneEnvironment = null;

    function sceneChanged(scene) {
        if (!scene?.traverseVisible) return true;
        let changed = scene !== sceneRoot;
        sceneRoot = scene;
        if (scene.background !== sceneBackground) {
            sceneBackground = scene.background;
            changed = true;
        }
        if (scene.environment !== sceneEnvironment) {
            sceneEnvironment = scene.environment;
            changed = true;
        }
        let i = 0;
        scene.traverseVisible((object) => {
            if (sceneObjects[i] !== object) {
                sceneObjects[i] = object;
                changed = true;
            }
            if (sceneMaterials[i] !== object.material) {
                sceneMaterials[i] = object.material;
                changed = true;
            }
            const base = i * 16;
            if (base + 16 > sceneMatrices.length) {
                const grown = new Float64Array(sceneMatrices.length * 2);
                grown.set(sceneMatrices);
                sceneMatrices = grown;
            }
            const elements = object.matrixWorld?.elements;
            if (elements) {
                for (let k = 0; k < 16; k++) {
                    if (sceneMatrices[base + k] !== elements[k]) {
                        sceneMatrices[base + k] = elements[k];
                        changed = true;
                    }
                }
            }
            i++;
        });
        if (i !== sceneCount) {
            changed = true;
            sceneCount = i;
            sceneObjects.length = i;
            sceneMaterials.length = i;
        }
        return changed;
    }

    /** @type {Map<string, any[]>} */
    const listenerState = new Map();

    function listenersChanged() {
        if (!emitter) return false;
        let changed = false;
        for (const name of frameEvents) {
            const raw = emitter._events
                ? emitter._events[name]
                : emitter.listeners?.(name);
            const list = raw == null ? [] : Array.isArray(raw) ? raw : [raw];
            const seen = listenerState.get(name);
            if (
                !seen ||
                seen.length !== list.length ||
                list.some((listener, i) => seen[i] !== listener)
            ) {
                listenerState.set(name, list.slice());
                changed = true;
            }
        }
        return changed;
    }

    function tweening() {
        const timeline = gsap?.globalTimeline;
        if (!timeline?.getChildren) return false;
        return timeline
            .getChildren(true, true, false)
            .some((tween) => tween.isActive?.() && !tween.paused?.());
    }

    function videoPlaying() {
        for (const texture of videoTextures) {
            const video = texture.image;
            if (
                !video ||
                texture.wasDisposed ||
                texture._videoTextureDisposed ||
                !playing(video)
            ) {
                // re-added on its next frame if it plays again
                videoTextures.delete(texture);
                continue;
            }
            return true;
        }
        const pageVideos = doc?.getElementsByTagName?.("video");
        if (pageVideos) {
            for (let i = 0; i < pageVideos.length; i++) {
                if (playing(pageVideos[i])) return true;
            }
        }
        return false;
    }

    function startDraw() {
        drawing = true;
        frameStartWrites = writes.count;
    }

    return {
        writes,
        /** Hooks the uploads, the input and the GPU write meter. Once. */
        install() {
            if (installed) return;
            installed = true;
            hookNeedsUpdate(classes.Texture?.prototype, (texture) => {
                invalidate();
                if (texture.isVideoTexture || isVideo(texture.image))
                    videoTextures.add(texture);
            });
            // A marked buffer is compared before the next skip (confirm):
            // one whose content the GPU already has does not wake.
            const bufferMarked = (buffer) => {
                markedBuffers.add(buffer);
            };
            hookNeedsUpdate(classes.BufferAttribute?.prototype, bufferMarked);
            hookNeedsUpdate(classes.InterleavedBuffer?.prototype, bufferMarked);
            hookNeedsUpdate(classes.Material?.prototype, invalidate);
            const backend = renderer?.backend;
            meter(backend, "updateBinding");
            meter(backend, "updateAttribute", attributeChanged);
            meter(backend, "updateTexture");
            for (const type of [
                "pointerdown",
                "pointermove",
                "pointerup",
                "wheel",
                "keydown",
                "keyup",
                "touchstart",
                "touchmove",
                "touchend",
                "focus",
            ])
                listen(win, type);
            listen(doc, "visibilitychange");
        },
        dispose() {
            while (restores.length) restores.pop()();
            installed = false;
            videoTextures.clear();
        },
        invalidate,
        /**
         * First half of a frame: whether to draw. When it returns false the
         * caller updates the scene's matrices, then asks confirm().
         * @param {boolean} eligible
         */
        begin(eligible) {
            frameTime = now();
            demand.setContinuous("video", eligible && videoPlaying());
            const { draw } = demand.decide(frameTime, { eligible });
            if (draw) startDraw();
            else drawing = false;
            return draw;
        },
        /**
         * Second half of a frame begin() would skip: draws after all if the
         * camera, the scene graph, the frame listeners or a tween changed.
         * Every detector runs, so each keeps its baseline current.
         */
        confirm(scene, camera) {
            let changed = cameraChanged(camera);
            changed = sceneChanged(scene) || changed;
            changed = listenersChanged() || changed;
            changed = buffersChanged() || changed;
            changed = tweening() || changed;
            if (!changed) return false;
            demand.wake(frameTime);
            startDraw();
            return true;
        },
        /** After the frame: what the GPU received decides the next ones. */
        end() {
            if (!drawing) return;
            drawing = false;
            const info = renderer?.info?.render;
            const drawCalls = info ? info.drawCalls : 0;
            const changed =
                writes.count !== frameStartWrites ||
                drawCalls !== lastDrawCalls;
            lastDrawCalls = drawCalls;
            demand.drawn(frameTime, { changed });
        },
    };
}
