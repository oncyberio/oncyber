import { withMediaTimeout } from "./timeout";

type Task = {
    load: (signal: AbortSignal) => Promise<unknown>;
    signal?: AbortSignal;
    priority: number;
    attempt: number;
    resolve: (value: any) => void;
    reject: (error: unknown) => void;
};

/** Full-resolution images and animations never occupy preview-loader slots. */
export function createMediaUpgradeQueue(concurrency = 2) {
    let active = 0;
    const initial: Task[] = [],
        retries: Task[] = [];
    function drain() {
        while (active < concurrency && (initial.length || retries.length)) {
            initial.sort((a, b) => a.priority - b.priority);
            const task = (initial.length ? initial : retries).shift();
            if (task.signal?.aborted) {
                task.reject(new Error("Artwork disposed"));
                continue;
            }
            active++;
            withMediaTimeout(
                task.load,
                task.signal,
                task.attempt ? 25000 : 8000
            )
                .then(task.resolve, (error) => {
                    if (!task.signal?.aborted && task.attempt < 2) {
                        task.attempt++;
                        retries.push(task);
                    } else task.reject(error);
                })
                .finally(() => {
                    active--;
                    drain();
                });
        }
    }
    return <T>(
        load: (signal: AbortSignal) => Promise<T>,
        signal?: AbortSignal,
        priority = 0
    ): Promise<T> =>
        new Promise((resolve, reject) => {
            initial.push({
                load,
                signal,
                priority,
                attempt: 0,
                resolve,
                reject,
            });
            drain();
        });
}

export const queueMediaUpgrade = createMediaUpgradeQueue();
