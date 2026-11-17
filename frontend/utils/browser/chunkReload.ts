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
        // Left out, sessionStorage is used. Reading it can itself throw
        // when the browser denies storage, so that happens inside the
        // guarded block below.
        storage = undefined as
            | Pick<Storage, "getItem" | "setItem">
            | null
            | undefined,
        reload = () => window.location.reload(),
        now = Date.now(),
    } = {}
): boolean {
    if (!isChunkLoadError(reason)) return false;
    try {
        const store =
            storage !== undefined
                ? storage
                : typeof sessionStorage !== "undefined"
                ? sessionStorage
                : null;
        const last = Number(store?.getItem(KEY) || 0);
        if (now - last < QUIET_MS) return false;
        store?.setItem(KEY, String(now));
    } catch {
        // Storage unavailable: reloading could loop, so don't.
        return false;
    }
    reload();
    return true;
}

/**
 * Wraps a `next/dynamic` loader. Next handles a failed loader itself, so the
 * failure never reaches the window listeners below; this reports it first.
 */
export function withChunkReload<T>(
    loader: () => Promise<T>,
    report: (reason: unknown) => unknown = reloadForChunkError
): () => Promise<T> {
    return () =>
        loader().catch((error) => {
            report(error);
            throw error;
        });
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
