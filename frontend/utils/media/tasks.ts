import { withMediaTimeout } from "./timeout";

/** Complete the first pass before retrying failures, with bounded concurrency. */
export async function runArtworkTasks<T>(
    items: T[],
    load: (item: T, attempt: number, signal?: AbortSignal) => Promise<void>,
    options: {
        signal?: AbortSignal;
        concurrency: number;
        attempts?: number;
        initialTimeout?: number;
        retryTimeout?: number;
        onError: (error: unknown, item: T) => void;
    }
) {
    const attempts = Math.max(1, options.attempts || 1);
    let queue = items;
    for (let attempt = 0; attempt < attempts && queue.length; attempt++) {
        let cursor = 0;
        const retry: T[] = [];
        await Promise.all(
            Array.from(
                {
                    length: Math.min(
                        queue.length,
                        Math.max(1, attempt ? 1 : options.concurrency)
                    ),
                },
                async () => {
                    while (!options.signal?.aborted && cursor < queue.length) {
                        const item = queue[cursor++];
                        try {
                            const timeout = attempt ? options.retryTimeout : options.initialTimeout;
                            if (timeout) await withMediaTimeout(
                                (signal) => load(item, attempt, signal),
                                options.signal, timeout
                            );
                            else await load(item, attempt, options.signal);
                        } catch (error) {
                            if (options.signal?.aborted) return;
                            if (attempt + 1 < attempts) retry.push(item);
                            else options.onError(error, item);
                        }
                    }
                }
            )
        );
        queue = retry;
    }
}
