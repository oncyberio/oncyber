// Local upload URLs are cache keys, not remotely hosted files.
let pending: Promise<void> | undefined;

export function ensureLocalUploads(): Promise<void> {
    if (pending) return pending;
    pending = (async () => {
        if (!("serviceWorker" in navigator)) {
            throw new Error("Local uploads require service worker support");
        }
        await navigator.serviceWorker.register("/anon-service-worker.js");
        await navigator.serviceWorker.ready;
        if (navigator.serviceWorker.controller) return;
        await new Promise<void>((resolve, reject) => {
            const cleanup = () => {
                clearTimeout(timer);
                navigator.serviceWorker.removeEventListener(
                    "controllerchange",
                    onChange
                );
            };
            const onChange = () => {
                if (!navigator.serviceWorker.controller) return;
                cleanup();
                resolve();
            };
            const timer = setTimeout(() => {
                cleanup();
                reject(
                    new Error(
                        "Local upload storage did not become ready. Please reload Studio."
                    )
                );
            }, 10000);
            navigator.serviceWorker.addEventListener(
                "controllerchange",
                onChange
            );
            onChange();
        });
    })().catch((error) => {
        pending = undefined;
        throw error;
    });
    return pending;
}
