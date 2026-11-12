interface SceneUpdateEmitter {
    on(event: string, listener: () => void): unknown;
    off(event: string, listener: () => void): unknown;
}

/** Finish after the renderer's event queue, or release the listener when its
 * scene is cancelled before another frame can run. */
export function waitForNextSceneUpdate(
    emitter: SceneUpdateEmitter,
    event: string,
    signal?: AbortSignal
): Promise<void> {
    return new Promise((resolve, reject) => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        let settled = false;
        const cleanup = () => {
            emitter.off(event, onUpdate);
            signal?.removeEventListener("abort", onAbort);
            if (timer !== undefined) clearTimeout(timer);
            timer = undefined;
        };
        const onAbort = () => {
            if (settled) return;
            settled = true;
            cleanup();
            const error = new Error("Scene update cancelled.");
            error.name = "AbortError";
            reject(error);
        };
        const onUpdate = () => {
            if (settled || timer !== undefined) return;
            emitter.off(event, onUpdate);
            timer = setTimeout(() => {
                if (settled) return;
                settled = true;
                cleanup();
                resolve();
            }, 0);
        };
        if (signal?.aborted) {
            onAbort();
            return;
        }
        signal?.addEventListener("abort", onAbort, { once: true });
        emitter.on(event, onUpdate);
    });
}
