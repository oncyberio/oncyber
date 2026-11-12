import { loadRoomTextureDonor } from "./roomTextureDonor";
import Renderer from "../renderer";
import { EDIT_MODE, UPLOADER_MODE, GPU_TIER, IS_MOBILE } from "../constants";
import {
    createRoomTextureUpgradeTask,
    createRoomTextureUpgradeScheduler,
    waitForRoomTextureUpgradeSlot,
} from "@utils/roomTextureUpgradeTask";
import {
    uploadRoomTexture,
    cappedTextureSize,
    estimateStorageBytes,
} from "./progressiveTextureUpload";
import { markNativeStartup } from "@utils/nativeStartupDiagnostics";
import { captureRoomTextureUpgrade } from "./roomTextureUpgrade";
import { selectRoomTextureUpgradeSource } from "./roomModelSource";

function publish(state, quality, applied = 0, total = 0, alreadyFull = 0) {
    if (
        process.env.NODE_ENV !== "development" ||
        typeof document === "undefined"
    )
        return;
    const target = document.documentElement;
    target.setAttribute("data-native-room-texture-state", state);
    target.setAttribute("data-native-room-texture-quality", quality);
    target.setAttribute("data-native-room-texture-applied", String(applied));
    target.setAttribute("data-native-room-texture-total", String(total));
    target.setAttribute(
        "data-native-room-texture-already-full",
        String(alreadyFull)
    );
}

/**
 * Limits for sharpening a direct visit's mid room to its high file, on a
 * desktop whose GPU is not low and whose frame rate was good after arrival:
 * full 4096 px maps, as a direct visit loaded before rooms started at mid,
 * within a budget of new GPU memory. The lobby's low-to-mid refinement keeps
 * its 2048 px and 128 MB.
 */
export const SHARPEN_MAX_DIMENSION = 4096;
export const SHARPEN_MEMORY_BUDGET_MB = { high: 1024, mid: 512 };

/** Capture before pipeline conversion; no extra requests until arrival completes. */
export function prepareRoomTextureUpgrade(opts, initial, rawScene) {
    // Lobby entry refines its low room; a direct visit that started at mid
    // (initial.refine) may sharpen, but only once allow() says the frame
    // rate is good.
    const sharpening = !opts.preferLowResolution && !!initial?.refine;
    if (
        (!opts.preferLowResolution && !sharpening) ||
        EDIT_MODE ||
        UPLOADER_MODE
    )
        return null;
    const target = selectRoomTextureUpgradeSource(
        opts.roomParameters,
        initial,
        {
            skin: opts.exhibit.info?.currentSkin,
            quality: GPU_TIER.path,
            isMobile: IS_MOBILE,
        }
    );
    if (!target) {
        publish("unavailable", initial.quality);
        return null;
    }
    const owner = captureRoomTextureUpgrade(rawScene);
    let roots = [];
    let disposed = false;
    let complete = false;
    let generation = 0;
    let applied = 0;
    let total = 0;
    let alreadyFull = 0;
    let task = null;
    let contextLost = false;
    let extraBytes = 0;
    let capped = 0;
    let keptLow = 0;
    const constrained = IS_MOBILE || GPU_TIER.path === "low";
    const memoryBudget =
        (constrained
            ? 64
            : sharpening
            ? SHARPEN_MEMORY_BUDGET_MB[GPU_TIER.path] ||
              SHARPEN_MEMORY_BUDGET_MB.mid
            : 128) *
        1024 *
        1024;
    const dimensionLimit = constrained
        ? 1024
        : sharpening
        ? Math.min(
              SHARPEN_MAX_DIMENSION,
              Renderer.capabilities?.maxTextureSize || SHARPEN_MAX_DIMENSION
          )
        : 2048;
    // Sharpening waits for allow(); lobby refinement starts on reveal.
    let allowed = !sharpening;
    const scheduler = createRoomTextureUpgradeScheduler();
    const frameStats = { samples: 0, over50ms: 0, maxMs: 0, totalMs: 0 };
    let frameId = 0,
        lastFrame = 0;
    const stopFrameWatch = () => {
        if (frameId) cancelAnimationFrame(frameId);
        frameId = 0;
        lastFrame = 0;
    };
    const startFrameWatch = () => {
        if (
            process.env.NODE_ENV !== "development" ||
            typeof requestAnimationFrame !== "function" ||
            frameId
        )
            return;
        const sample = (timestamp) => {
            if (lastFrame && !document.hidden) {
                const gap = timestamp - lastFrame;
                frameStats.samples++;
                frameStats.totalMs += gap;
                frameStats.maxMs = Math.max(frameStats.maxMs, gap);
                if (gap > 50) frameStats.over50ms++;
            }
            lastFrame = timestamp;
            frameId = requestAnimationFrame(sample);
        };
        frameId = requestAnimationFrame(sample);
    };
    const publishUpload = (progress) => {
        if (
            process.env.NODE_ENV !== "development" ||
            typeof document === "undefined"
        )
            return;
        document.documentElement.setAttribute(
            "data-native-room-texture-upload",
            JSON.stringify({
                ...progress,
                capped,
                keptLow,
                extraBytes,
                memoryBudget,
                ...scheduler.stats,
                frameSamples: frameStats.samples,
                maxFrameMs: Math.round(frameStats.maxMs * 100) / 100,
                averageFrameMs:
                    Math.round(
                        (frameStats.totalMs / Math.max(1, frameStats.samples)) *
                            100
                    ) / 100,
                framesOver50ms: frameStats.over50ms,
            })
        );
    };
    const quality = () =>
        applied + alreadyFull
            ? applied + alreadyFull >= total
                ? capped
                    ? "adaptive"
                    : target.quality
                : "mixed"
            : initial.quality;
    publish("waiting-for-arrival", initial.quality);
    const controller = {
        attach(scene, extras = []) {
            if (disposed) return;
            roots = [scene, ...extras];
            scene.roomTextureUpgrade = this;
        },
        /** True for a direct visit's mid room, which sharpens only when allowed. */
        sharpening,
        /** The frame rate after arrival was good: start() may now run. */
        allow() {
            allowed = true;
        },
        get allowed() {
            return allowed;
        },
        start() {
            if (disposed || contextLost || complete || task || !allowed) return;
            startFrameWatch();
            const attempt = ++generation;
            const current = () => !disposed && generation === attempt;
            const next = createRoomTextureUpgradeTask(
                {
                    async load(signal) {
                        if (current()) {
                            publish(
                                "loading",
                                quality(),
                                applied,
                                total,
                                alreadyFull
                            );
                            markNativeStartup("native-room-textures-start");
                        }
                        // Parse donor geometry/UV signatures off-thread. Encoded
                        // image blobs are decoded one at a time by the upload worker.
                        const donor = await loadRoomTextureDonor(target.url, {
                            signal,
                        });
                        // A cancelled decoder may finish after a retry/disposal. It
                        // still needs a releasable plan, but must not bind or install.
                        if (!signal.aborted && current()) owner.bind(roots);
                        publishUpload({ phase: "donor-ready" });
                        return owner.plan(donor);
                    },
                    *apply(plan, signal) {
                        if (
                            process.env.NODE_ENV === "development" &&
                            typeof document !== "undefined"
                        ) {
                            document.documentElement.setAttribute(
                                "data-native-room-texture-skipped",
                                JSON.stringify(plan.diagnostics || [])
                            );
                        }
                        const previousApplied = applied;
                        total = Math.max(total, plan.stats.total);
                        alreadyFull = plan.stats.alreadyFull || 0;
                        publish(
                            "upgrading",
                            quality(),
                            applied,
                            total,
                            alreadyFull
                        );
                        const upload = async (texture) => {
                            const image = texture.source?.data || texture.image;
                            const low = texture.userData
                                ?.roomTextureUpgradeLowSize || [0, 0];
                            let maxDimension = dimensionLimit;
                            let size = cappedTextureSize(
                                image.width,
                                image.height,
                                maxDimension
                            );
                            let bytes = estimateStorageBytes(
                                size.width,
                                size.height
                            );
                            // Bound peak allocation, not only final residency: the
                            // old GPU texture remains visible until replacement ends.
                            while (
                                extraBytes + bytes > memoryBudget &&
                                maxDimension > 128
                            ) {
                                maxDimension = Math.floor(maxDimension / 2);
                                size = cappedTextureSize(
                                    image.width,
                                    image.height,
                                    maxDimension
                                );
                                bytes = estimateStorageBytes(
                                    size.width,
                                    size.height
                                );
                            }
                            if (size.width <= low[0] && size.height <= low[1]) {
                                keptLow++;
                                publishUpload({ phase: "kept-low" });
                                return null;
                            }
                            let result;
                            try {
                                result = await uploadRoomTexture(texture, {
                                    renderer: Renderer,
                                    signal,
                                    maxDimension,
                                    tileSize: 128,
                                    waitForSlot: () =>
                                        waitForRoomTextureUpgradeSlot(
                                            signal,
                                            scheduler
                                        ),
                                    onUpload: (duration, operation) => {
                                        scheduler.observe(duration);
                                        if (operation.kind === "allocate")
                                            publishUpload({
                                                phase: "allocating",
                                                ...operation,
                                            });
                                    },
                                    onProgress: (progress) => {
                                        if (
                                            progress.uploaded % 16 === 0 ||
                                            progress.uploaded === progress.total
                                        )
                                            publishUpload({
                                                phase: "uploading",
                                                ...progress,
                                            });
                                    },
                                });
                            } catch (error) {
                                if (
                                    error?.code !==
                                    "PROGRESSIVE_TEXTURE_UNSUPPORTED"
                                )
                                    throw error;
                                keptLow++;
                                publishUpload({ phase: "unsupported" });
                                return null;
                            }
                            if (!result) return null;
                            if (!current() || signal.aborted) {
                                result.dispose();
                                return null;
                            }
                            // Count every new allocation conservatively. Three can
                            // share the old GPU image between Texture wrappers, so
                            // retiring one binding does not prove that memory freed.
                            extraBytes +=
                                result.userData.progressiveRoomTexture?.bytes ||
                                bytes;
                            if (result.userData.progressiveRoomTexture?.capped)
                                capped++;
                            return result;
                        };
                        for (const step of plan.steps(upload)) {
                            yield async () => {
                                if (!current()) return;
                                await step();
                                if (!current()) return;
                                applied = previousApplied + plan.stats.applied;
                                publish(
                                    "upgrading",
                                    quality(),
                                    applied,
                                    total,
                                    alreadyFull
                                );
                                publishUpload({ phase: "texture-ready" });
                            };
                        }
                        if (!current()) return;
                        complete = true;
                        publish(
                            applied + alreadyFull
                                ? applied + alreadyFull >= total
                                    ? "complete"
                                    : "partial"
                                : "no-compatible-textures",
                            quality(),
                            applied,
                            total,
                            alreadyFull
                        );
                        if (applied)
                            markNativeStartup("native-room-textures-ready");
                    },
                    release: (plan) => plan.dispose(),
                    onError() {
                        if (current())
                            publish(
                                "failed",
                                quality(),
                                applied,
                                total,
                                alreadyFull
                            );
                    },
                },
                scheduler
            );
            task = next;
            void next.finished.then(() => {
                if (current() && task === next) {
                    task = null;
                    stopFrameWatch();
                    publishUpload({ phase: "settled" });
                }
            });
            next.start();
        },
        stop() {
            if (disposed) return;
            generation++;
            const previous = task;
            task = null;
            previous?.dispose();
            stopFrameWatch();
            if (!complete)
                publish("cancelled", quality(), applied, total, alreadyFull);
        },
        dispose() {
            if (disposed) return;
            this.stop();
            disposed = true;
            Renderer.domElement?.removeEventListener(
                "webglcontextlost",
                onContextLost
            );
            owner.dispose();
            roots = [];
        },
    };
    const onContextLost = () => {
        controller.stop();
        contextLost = true;
        owner.restoreLowTextureBindings();
        applied = 0;
        extraBytes = 0;
        publish(
            "kept-low-after-context-loss",
            initial.quality,
            0,
            total,
            alreadyFull
        );
    };
    Renderer.domElement?.addEventListener("webglcontextlost", onContextLost);
    return controller;
}
