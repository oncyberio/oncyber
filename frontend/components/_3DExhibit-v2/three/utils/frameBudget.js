/**
 * Decisions taken from measured frame times, kept pure so they can be tested
 * without a renderer. The engine feeds each one the milliseconds between two
 * rendered frames (api.js, from the update loop).
 *
 * Gaps longer than `maxGapMs` are not frames: the loop was paused, the tab
 * was hidden or the main thread was busy loading. They are ignored rather
 * than counted as slow frames.
 */

/** A frame time this long is a pause or a stall, not a rendered frame. */
export const MAX_FRAME_GAP_MS = 250;

/**
 * Whether the device renders this world smoothly enough to sharpen its room
 * textures (mid file to high file). Waits `settleMs` of rendered frames after
 * arrival (shaders compile, artworks stream in), then judges `windowMs` of
 * frames once: "good" when the average stays within `goodFrameMs` (50 fps)
 * and few frames are long.
 *
 * observe(frameMs) returns "wait" until it has decided, then "good" or
 * "poor" (and keeps returning that answer).
 */
export function createSharpenGate({
    settleMs = 3000,
    windowMs = 4000,
    goodFrameMs = 20,
    longFrameMs = 50,
    maxLongFrameShare = 0.05,
    maxGapMs = MAX_FRAME_GAP_MS,
} = {}) {
    let settled = 0;
    let measured = 0;
    let frames = 0;
    let longFrames = 0;
    let verdict = "wait";
    return {
        observe(frameMs) {
            if (verdict !== "wait") return verdict;
            if (!(frameMs > 0) || frameMs > maxGapMs) return verdict;
            if (settled < settleMs) {
                settled += frameMs;
                return verdict;
            }
            measured += frameMs;
            frames++;
            if (frameMs > longFrameMs) longFrames++;
            if (measured >= windowMs) {
                const average = measured / frames;
                verdict =
                    average <= goodFrameMs &&
                    longFrames / frames <= maxLongFrameShare
                        ? "good"
                        : "poor";
            }
            return verdict;
        },
        get verdict() {
            return verdict;
        },
    };
}

/** resizer.js multiplies each axis by this at LOW quality; nothing goes lower. */
export const LOW_RESOLUTION_MULTIPLIER = 0.6;

/** resizer.js's per-axis multiplier for each quality. */
export const QUALITY_RESOLUTION_MULTIPLIER = {
    high: 1,
    medium: 0.8,
    low: LOW_RESOLUTION_MULTIPLIER,
};

/**
 * Lowers the render resolution in steps when frames stay slow, so a phone
 * or weak GPU keeps a usable frame rate instead of stuttering.
 *
 * The governor owns a scale that resizer.js applies on top of the quality's
 * own multiplier. It starts at 1 and never takes the result below LOW's
 * multiplier. Hysteresis keeps it from oscillating:
 * - it steps down only after `slowWindows` consecutive windows of
 *   `windowMs` whose average frame time is above `budgetMs` (40 fps);
 * - after any step it ignores one window, so the new size is measured;
 * - it steps back up only after `fastWindows` windows averaging under
 *   `recoverMs` (83 fps). On a 60 Hz display frames never get that short,
 *   so there it only ever steps down; a 120 Hz display can recover.
 *
 * observe(frameMs) returns the new scale when it changes, otherwise null.
 */
export function createResolutionGovernor({
    quality = "high",
    budgetMs = 25,
    recoverMs = 12,
    windowMs = 2000,
    slowWindows = 2,
    fastWindows = 5,
    step = 0.1,
    maxGapMs = MAX_FRAME_GAP_MS,
} = {}) {
    const qualityMultiplier = QUALITY_RESOLUTION_MULTIPLIER[quality] || 1;
    // Rounded up, so float error cannot dip below LOW (resizer clamps too).
    const minScale = Math.min(
        1,
        Math.ceil((LOW_RESOLUTION_MULTIPLIER / qualityMultiplier) * 1000) / 1000
    );
    let scale = 1;
    let measured = 0;
    let frames = 0;
    let slow = 0;
    let fast = 0;
    let settling = false;
    const round = (value) => Math.round(value * 100) / 100;
    return {
        get scale() {
            return scale;
        },
        get minScale() {
            return minScale;
        },
        observe(frameMs) {
            if (!(frameMs > 0) || frameMs > maxGapMs) return null;
            measured += frameMs;
            frames++;
            if (measured < windowMs) return null;
            const average = measured / frames;
            measured = 0;
            frames = 0;
            if (settling) {
                settling = false;
                return null;
            }
            slow = average > budgetMs ? slow + 1 : 0;
            fast = average < recoverMs ? fast + 1 : 0;
            let next = scale;
            if (slow >= slowWindows && scale > minScale)
                next = Math.max(minScale, round(scale - step));
            else if (fast >= fastWindows && scale < 1)
                next = Math.min(1, round(scale + step));
            if (next === scale) return null;
            scale = next;
            slow = 0;
            fast = 0;
            settling = true;
            return scale;
        },
    };
}

/**
 * The quality a world starts at when the visitor has not chosen one: phones
 * and weak GPUs (detect-gpu tier "low", which every phone reports) start at
 * medium, everything else at high.
 *
 * @param {{ isMobile?: boolean, gpuTier?: string }} [options]
 */
export function defaultQuality({ isMobile = false, gpuTier } = {}) {
    return isMobile || gpuTier === "low" ? "medium" : "high";
}
