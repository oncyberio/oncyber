/** Upload a few textures per frame, yielding early when an upload is expensive. */
export async function uploadTextureBatch<T>(
    textures: readonly T[],
    upload: (texture: T) => void,
    nextFrame: () => Promise<unknown>,
    options: {
        signal?: AbortSignal;
        now?: () => number;
        budgetMs?: number;
        batchSize?: number;
        /** Shared destination budget; may yield before this indivisible upload. */
        beforeUpload?: () => Promise<void>;
    } = {}
) {
    const now = options.now || (() => performance.now());
    const budgetMs = Math.max(1, options.budgetMs ?? 4);
    const batchSize = Math.max(1, options.batchSize ?? 4);
    const unique = Array.from(new Set(textures));
    let batchCpuMs = 0;
    let count = 0;
    for (let i = 0; i < unique.length; i++) {
        options.signal?.throwIfAborted();
        if (options.beforeUpload) await options.beforeUpload();
        options.signal?.throwIfAborted();
        const uploadStart = now();
        upload(unique[i]);
        batchCpuMs += Math.max(0, now() - uploadStart);
        count++;
        if (
            i < unique.length - 1 &&
            (count >= batchSize || batchCpuMs >= budgetMs)
        ) {
            await nextFrame();
            options.signal?.throwIfAborted();
            batchCpuMs = 0;
            count = 0;
        }
    }
}
