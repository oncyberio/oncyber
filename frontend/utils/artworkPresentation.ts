/** Room geometry and avatars never wait on artwork. During a travel animation,
 * let in-flight downloads finish but defer new artwork construction/attachment. */
let holds = 0;
const waiters = new Set<() => void>();
export function holdArtworkPresentation() {
    holds++;
    let released = false;
    return () => {
        if (released) return;
        released = true;
        if (--holds === 0) for (const resume of [...waiters]) resume();
    };
}
export function waitForArtworkPresentation(
    signal?: AbortSignal
): Promise<void> {
    if (signal?.aborted)
        return Promise.reject(
            new DOMException("Artwork cancelled", "AbortError")
        );
    if (!holds) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const resume = () => {
            waiters.delete(resume);
            signal?.removeEventListener("abort", resume);
            if (signal?.aborted)
                reject(new DOMException("Artwork cancelled", "AbortError"));
            else resolve();
        };
        waiters.add(resume);
        signal?.addEventListener("abort", resume, { once: true });
    });
}
