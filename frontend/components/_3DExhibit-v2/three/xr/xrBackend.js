// @ts-check

/**
 * Which renderer backend a VR visit can use, and the session it asks for.
 * Kept pure (no renderer, no navigator) so it can be tested.
 *
 * three's XRManager draws a WebGPU-backed session only when the browser has
 * the WebXR/WebGPU binding (`XRGPUBinding`) and the session was started with
 * the `webgpu` feature; otherwise `setSession` throws. Headset browsers that
 * have WebGPU but not the binding would pick WebGPU at load and then fail
 * at "enter VR", so they render on the WebGL2 backend from the start, as the
 * old build did.
 */

/** Headset browsers, where a visit is meant to end up in VR. */
const HEADSET_BROWSER = /OculusBrowser|Mobile VR|Pico|Wolvic/i;

/**
 * @param {{ userAgent?: string, hasGPUBinding?: boolean }} options
 * @returns {boolean} whether the renderer should start on WebGL2
 */
export function forceWebGLForXR({ userAgent = "", hasGPUBinding = false } = {}) {
    return HEADSET_BROWSER.test(userAgent) && !hasGPUBinding;
}

/**
 * Whether an immersive session can be drawn by this backend.
 *
 * @param {{ isWebGPUBackend?: boolean, hasGPUBinding?: boolean }} options
 */
export function canPresentXR({ isWebGPUBackend = false, hasGPUBinding = false } = {}) {
    return !isWebGPUBackend || hasGPUBinding;
}

/**
 * The `requestSession('immersive-vr', ...)` options for this backend.
 *
 * @param {{ isWebGPUBackend?: boolean }} options
 * @returns {XRSessionInit}
 */
export function xrSessionInit({ isWebGPUBackend = false } = {}) {
    /** @type {XRSessionInit} */
    const init = {
        optionalFeatures: ["local-floor", "bounded-floor", "hand-tracking", "layers"],
    };
    if (isWebGPUBackend) init.requiredFeatures = ["webgpu"];
    return init;
}
