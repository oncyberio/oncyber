/**
 * A script chunk that fails to load (a network blip, or a deploy that
 * replaced the chunk while the page was open) leaves the page blank. Reload
 * once to fetch the current build; never loop.
 */

const KEY = "oncyber:chunk-reload";
/** A second failure this soon after reloading is not fixed by another one. */
const QUIET_MS = 60_000;

export function isChunkLoadError(reason: unknown): boolean {
    const error = reason as { name?: string; message?: string } | null;
    return (
        error?.name === "ChunkLoadError" ||
        /Loading (CSS )?chunk [\w-]+ failed|Failed to fetch dynamically imported module/i.test(
            error?.message || ""
        )
    );
}

/** Reloads the page for a chunk failure, at most once a minute. */
export function reloadForChunkError(
    reason: unknown,
    {
        storage = typeof sessionStorage !== "undefined" ? sessionStorage : null,
        reload = () => window.location.reload(),
        now = Date.now(),
    } = {}
): boolean {
    if (!isChunkLoadError(reason)) return false;
    try {
        const last = Number(storage?.getItem(KEY) || 0);
        if (now - last < QUIET_MS) return false;
        storage?.setItem(KEY, String(now));
    } catch {
        // Storage unavailable: reloading could loop, so don't.
        return false;
    }
    reload();
    return true;
}

/** Watches for chunk failures; returns the cleanup. */
export function watchChunkErrors(target: Window = window): () => void {
    const onError = (event: ErrorEvent) => reloadForChunkError(event.error);
    const onRejection = (event: PromiseRejectionEvent) =>
        reloadForChunkError(event.reason);
    target.addEventListener("error", onError);
    target.addEventListener("unhandledrejection", onRejection);
    return () => {
        target.removeEventListener("error", onError);
        target.removeEventListener("unhandledrejection", onRejection);
    };
}
