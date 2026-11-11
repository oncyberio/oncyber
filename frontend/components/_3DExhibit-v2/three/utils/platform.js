import { getGPUTier } from "detect-gpu";
import { LANDSCAPE, PORTRAIT } from "@3constants";

import {
    DETECT_GPU_VERSION,
    GPU_BENCHMARKS_URL,
    GPU_TIER_STORAGE_KEY,
    gpuTierPath,
    readRememberedGpuTier,
    rememberGpuTier,
} from "./gpuTierMemory";

export {
    DETECT_GPU_VERSION,
    GPU_BENCHMARKS_URL,
    GPU_TIER_STORAGE_KEY,
    readRememberedGpuTier,
    rememberGpuTier,
};

let gpuTierResult;
let gpuTierPending;

/** detect-gpu's answer: remembered, or looked up once per page. */
function lookupGpuTier() {
    if (gpuTierResult) return Promise.resolve(gpuTierResult);
    if (!gpuTierPending) {
        const remembered = readRememberedGpuTier();
        gpuTierPending = remembered
            ? Promise.resolve(remembered)
            : getGPUTier({ benchmarksURL: GPU_BENCHMARKS_URL }).then(
                  (result) => {
                      rememberGpuTier(result);
                      return result;
                  }
              );
        gpuTierPending.then(
            (result) => (gpuTierResult = result),
            () => (gpuTierPending = null)
        );
    }
    return gpuTierPending;
}

export async function getGPU() {
    const result = await lookupGpuTier();

    // Unknown GPUs (not in the benchmark tables) count as mid.
    const gpuTier = { ...result, path: gpuTierPath(result) };

    return gpuTier;
}

export function openFullscreen(domElement) {
    if (domElement !== null && domElement.requestFullscreen) {
        return domElement.requestFullscreen();
    } else {
        let element = domElement; //srsly!
        var requestMethod =
            element.webkitRequestFullscreen ||
            element.webkitRequestFullScreen ||
            element.mozRequestFullScreen ||
            element.msRequestFullscreen ||
            element.webkitEnterFullscreen;

        if (requestMethod) {
            return requestMethod.call(domElement);
        }
    }
}

export function fullscreenelElement() {
    if (typeof document.fullscreenElement !== "undefined") {
        return document.fullscreenElement;
    } else if (typeof document.mozFullScreenElement !== "undefined") {
        return document.mozFullScreenElement;
    } else if (typeof document.msFullscreenElement !== "undefined") {
        return document.msFullscreenElement;
    } else if (typeof document.webkitCurrentFullScreenElement !== "undefined") {
        return document.webkitCurrentFullScreenElement;
    } else {
        return null;
    }
}

export function isLandscape() {
    return window.matchMedia("(orientation: landscape)").matches;
}

export function deviceOrientation() {
    return isLandscape() ? LANDSCAPE : PORTRAIT;
}

export function onOrientationChange(handler) {
    if (typeof screen.orientation != "undefined") {
        screen.orientation.onchange = handler;

        return () => {
            screen.orientation.onchange = null;
        };
    } else if (typeof window.onorientationchange != "undefined") {
        window.addEventListener("orientationchange", handler);

        return () => {
            window.remove("orientationchange", handler);
        };
    }
}

export function isMacMobile() {
    return (
        [
            "iPad Simulator",
            "iPhone Simulator",
            "iPod Simulator",
            "iPad",
            "iPhone",
            "iPod",
        ].includes(navigator.platform) ||
        // iPad on iOS 13 detection
        (navigator.userAgent.includes("Mac") && "ontouchend" in document)
    );
}

export function isIOS() {
    return [
        "iPad Simulator",
        "iPhone Simulator",
        "iPod Simulator",
        "iPad",
        "iPhone",
        "iPod",
    ].includes(navigator.platform);
}

export async function isVRSupported() {
    try {
        return (
            navigator &&
            navigator.xr &&
            (await navigator.xr.isSessionSupported("immersive-vr"))
        );
    } catch (error) {
        return false;
    }
}


export function isWebmSupported() {

    const testEl = document.createElement("video")

    return testEl.canPlayType( 'video/webm; codecs="vp8"' ) != ""
}

export function isOculusBrowser () {
    return /(OculusBrowser)/i.test(navigator.userAgent);
}

export function isFirefoxReality () {
    return /(Mobile VR)/i.test(navigator.userAgent);
}

export function isStandaloneVR() {
    //
    return isOculusBrowser() || isFirefoxReality()
}




