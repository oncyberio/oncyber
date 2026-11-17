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

/**
 * Sets the per-frame callback, also while a VR session is presenting.
 *
 * During a session three's XRManager owns the renderer's animation loop: it
 * updates the head pose and the per-eye cameras, then calls the app's loop.
 * `renderer.setAnimationLoop()` called after the session started replaces
 * that frame handler, so the eye cameras are never set up, nothing but the
 * clear color is drawn, and the headset shows black. While presenting, the
 * callback goes to the XRManager instead, which calls it after its own work.
 *
 * @param {any} renderer
 * @param {null | ((time?: number, frame?: any) => void)} callback
 */
export function setRenderLoop(renderer, callback) {
    const xr = renderer?.xr;
    if (xr?.isPresenting === true && "_currentAnimationLoop" in xr) {
        xr._currentAnimationLoop = callback;
        return;
    }
    renderer.setAnimationLoop(callback);
}
