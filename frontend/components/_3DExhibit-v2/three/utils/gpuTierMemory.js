/**
 * The GPU tier remembered from an earlier visit, kept apart from platform.js
 * (which imports detect-gpu) so light pages like the landing can read it to
 * guess which room file a space will download.
 */

export const GPU_TIER_PATHS = ["low", "mid", "high"];

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

/**
 * The room quality path a detect-gpu result maps to (see getGPU): phones are
 * "low", benchmarked GPUs follow their tier, anything else is "mid".
 * @param {any} result
 * @returns {"low" | "mid" | "high"}
 */
export function gpuTierPath(result) {
    if (result?.isMobile) return "low";
    if (result?.type === "BENCHMARK")
        return GPU_TIER_PATHS[result.tier - 1] || "mid";
    return "mid";
}

/**
 * The room quality path the last space on this browser used, whatever
 * detect-gpu answered (GPUs newer than its tables, like recent Apple chips,
 * are never remembered above but still get a path).
 */
export const GPU_TIER_PATH_STORAGE_KEY = "oncyber.gpuTierPath";

export function rememberGpuTierPath(
    path,
    storage = safeLocalStorage(),
    userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent
) {
    if (!GPU_TIER_PATHS.includes(path)) return;
    try {
        storage?.setItem(
            GPU_TIER_PATH_STORAGE_KEY,
            JSON.stringify({ path, userAgent })
        );
    } catch {}
}

/** @returns {"low" | "mid" | "high" | null} */
export function readGpuTierPath(
    storage = safeLocalStorage(),
    userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent
) {
    try {
        const saved = JSON.parse(storage?.getItem(GPU_TIER_PATH_STORAGE_KEY));
        return saved?.userAgent === userAgent &&
            GPU_TIER_PATHS.includes(saved.path)
            ? saved.path
            : null;
    } catch {
        return null;
    }
}
