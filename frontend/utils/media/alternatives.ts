import { withMediaTimeout } from "./timeout";

/** Give each source a turn; a stalled primary must not consume the whole budget. */
export async function loadMediaAlternatives<T>(
    urls: string[],
    load: (url: string, signal: AbortSignal) => Promise<T>,
    parent?: AbortSignal,
    attemptTimeout = 8000,
    totalTimeout = 30000
): Promise<T> {
    return withMediaTimeout(
        async (signal) => {
            let failure: unknown = new Error("No usable artwork media URL");
            for (const url of new Set(urls.filter(Boolean))) {
                if (signal.aborted) throw failure;
                try {
                    return await withMediaTimeout(
                        (attempt) => load(url, attempt),
                        signal,
                        attemptTimeout
                    );
                } catch (error) {
                    if (signal.aborted || error?.name === "AbortError")
                        throw error;
                    failure = error;
                }
            }
            throw failure;
        },
        parent,
        totalTimeout
    );
}
