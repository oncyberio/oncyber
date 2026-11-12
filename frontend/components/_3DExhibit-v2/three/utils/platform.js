import { getGPUTier } from "detect-gpu";
import { LANDSCAPE, PORTRAIT } from "@3constants";

const paths = ["low", "mid", "high"];

/**
 * detect-gpu's benchmark tables, copied from
 * node_modules/detect-gpu/dist/benchmarks into public/ so the tier lookup
 * does not depend on unpkg.com. The folder is named after the installed
 * version; platform.test.js fails when the package and the copy differ.
 */
export const DETECT_GPU_VERSION = "3.1.30";
export const GPU_BENCHMARKS_URL = `/detect-gpu/${DETECT_GPU_VERSION}`;

/** A remembered tier is reused for a week on the same browser. */
export const GPU_TIER_STORAGE_KEY = "oncyber.gpuTier";
const GPU_TIER_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Only answers from the benchmark tables are worth remembering. */
const rememberable = (result) =>
    result?.type === "BENCHMARK" || result?.type === "BLOCKLISTED";

export function readRememberedGpuTier(
    storage = safeLocalStorage(),
    now = Date.now(),
    userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent
) {
    try {
        const saved = JSON.parse(storage?.getItem(GPU_TIER_STORAGE_KEY));
        if (
            !saved ||
            saved.version !== DETECT_GPU_VERSION ||
            saved.userAgent !== userAgent ||
            !(now - saved.savedAt < GPU_TIER_MAX_AGE_MS) ||
            !rememberable(saved.result)
        )
            return null;
        return saved.result;
    } catch {
        return null;
    }
}

export function rememberGpuTier(
    result,
    storage = safeLocalStorage(),
    now = Date.now(),
    userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent
) {
    if (!rememberable(result)) return;
    try {
        storage?.setItem(
            GPU_TIER_STORAGE_KEY,
            JSON.stringify({
                version: DETECT_GPU_VERSION,
                userAgent,
                savedAt: now,
                result,
            })
        );
    } catch {
        // Private windows and full storage only lose the shortcut.
    }
}

function safeLocalStorage() {
    try {
        return typeof window === "undefined" ? null : window.localStorage;
    } catch {
        return null;
    }
}

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

    const gpuTier = { ...result, path: "mid" };

    // We only set the path if the GPU model is known in the benchmark
    if (gpuTier.isMobile) {
        gpuTier.path = "low";
    } else if (gpuTier.type === "BENCHMARK") {
        gpuTier.path = paths[gpuTier.tier - 1];
    }

    // Otherwise we just ignore the returned result
    gpuTier.path = gpuTier.path || "mid";

    //console.log("gpuTier", gpuTier);
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




