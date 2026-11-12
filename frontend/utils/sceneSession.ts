/** One legacy engine shell, with exclusive ownership of its live scene. */
export function createSceneSessionOwner() {
    let tail: Promise<void> = Promise.resolve();
    return {
        acquire(
            start: (signal: AbortSignal) => Promise<void>,
            teardown: () => Promise<void>
        ) {
            const controller = new AbortController();
            let finish: () => void;
            const released = new Promise<void>((resolve) => {
                finish = resolve;
            });
            const done = tail.then(async () => {
                if (controller.signal.aborted) return;
                try {
                    await start(controller.signal);
                    await released;
                } finally {
                    controller.abort();
                    await teardown();
                }
            });
            // A failed session must not prevent subsequent visits.
            tail = done.catch(() => {});
            return {
                signal: controller.signal,
                done,
                release() {
                    controller.abort();
                    finish();
                    return done;
                },
            };
        },
    };
}
export const legacySceneSessions = createSceneSessionOwner();
