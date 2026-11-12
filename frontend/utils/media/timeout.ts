/** Cancel stalled media as well as settling the caller's promise. */
export async function withMediaTimeout<T>(
    load: (signal: AbortSignal) => Promise<T>,
    parent?: AbortSignal,
    milliseconds = 30000
): Promise<T> {
    const controller = new AbortController();
    let rejectAbort: (reason: Error) => void;
    const aborted = new Promise<never>((_, reject) => {
        rejectAbort = reject;
    });
    const cancel = () => {
        const error = new Error("Artwork loading cancelled");
        error.name = "AbortError";
        rejectAbort(error);
        controller.abort();
    };
    const timer = setTimeout(() => {
        rejectAbort(new Error("Artwork media timed out"));
        controller.abort();
    }, milliseconds);
    parent?.addEventListener("abort", cancel, { once: true });
    try {
        if (parent?.aborted) {
            cancel();
            return await aborted;
        }
        return await Promise.race([load(controller.signal), aborted]);
    } finally {
        clearTimeout(timer);
        parent?.removeEventListener("abort", cancel);
    }
}
