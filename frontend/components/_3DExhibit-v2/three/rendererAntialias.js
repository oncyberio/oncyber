import { QUALITY_RESOLUTION_MULTIPLIER } from "./utils/frameBudget";

/**
 * How many MSAA samples the world renders with, for the quality in force.
 * Kept pure so the table can be tested without a renderer; renderer.js
 * applies it (syncAntialias) whenever the canvas is resized, which every
 * quality change does.
 *
 * - high: full MSAA, as before.
 * - medium: resizer.js draws 0.8 of each axis (0.64 of the pixels). Where
 *   that still leaves at least `MEDIUM_MSAA_MAX_PIXEL_RATIO` rendered pixels
 *   per CSS pixel (phones and other dense screens: devicePixelRatio 2 and
 *   up gives 1.6), a stair step is under two thirds of a CSS pixel and MSAA
 *   is dropped. On ordinary screens (ratio 1 to 1.5 gives 0.8 to 1.2) edges
 *   would show, so MSAA stays.
 * - low: no MSAA; LOW is the floor the resolution governor stops at.
 * - VR: full MSAA, as before, whatever the quality.
 * - anything else (an unknown quality): full MSAA, as before.
 */
export const MEDIUM_MSAA_MAX_PIXEL_RATIO = 1.5;

/**
 * @param {{ quality?: string, dpi?: number, isVR?: boolean, fullSamples?: number }} options
 * @returns {number}
 */
export function antialiasSamples({
    quality,
    dpi,
    isVR = false,
    fullSamples = 4,
} = {}) {
    if (isVR) return fullSamples;
    if (quality === "low") return 0;
    if (quality === "medium") {
        const ratio =
            (dpi > 0 ? dpi : 1) * QUALITY_RESOLUTION_MULTIPLIER.medium;
        return ratio < MEDIUM_MSAA_MAX_PIXEL_RATIO ? fullSamples : 0;
    }
    return fullSamples;
}

/**
 * Changes a WebGPURenderer's MSAA sample count after creation. The scene is
 * drawn into the renderer's internal frame buffer target (the sRGB output
 * pass), which takes its count when it is created, and three has no setter:
 * so this sets the count and drops those targets, and the next frame builds
 * them with the new one. If three's internals are not what this expects,
 * it changes nothing.
 *
 * @param {any} renderer
 * @param {number} samples
 * @returns {boolean} whether the count changed
 */
export function setRendererSamples(renderer, samples) {
    const targets = renderer?._frameBufferTargets;
    if (typeof renderer?._samples !== "number") return false;
    if (!(targets instanceof Map)) return false;
    if (renderer._samples === samples) return false;
    renderer._samples = samples;
    const quads = renderer._quadCache;
    targets.forEach((frameBufferTarget) => {
        frameBufferTarget.dispose();
        const quadData = quads instanceof Map && quads.get(frameBufferTarget);
        if (quadData) {
            quadData.quad?.material?.dispose();
            quads.delete(frameBufferTarget);
        }
    });
    targets.clear();
    return true;
}
