/** Install lightweight local loaders before bounded media/network work begins. */
export function createArtworkPlaceholders<Item, Placeholder>(
    items: Item[],
    options: {
        create: (item: Item) => Placeholder | null | undefined;
        attach: (placeholder: Placeholder) => void;
        dispose: (placeholder: Placeholder) => void;
        signal?: AbortSignal;
        onError?: (error: unknown, item: Item) => void;
    }
) {
    const placeholders = new Map<Item, Placeholder>();
    const release = (item: Item) => {
        const placeholder = placeholders.get(item);
        if (!placeholder) return;
        placeholders.delete(item);
        options.dispose(placeholder);
    };
    const dispose = () => {
        options.signal?.removeEventListener("abort", dispose);
        for (const item of placeholders.keys()) release(item);
    };
    if (!options.signal?.aborted) {
        for (const item of items) {
            try {
                const placeholder = options.create(item);
                if (!placeholder) continue;
                placeholders.set(item, placeholder);
                options.attach(placeholder);
            } catch (error) {
                release(item);
                options.onError?.(error, item);
            }
        }
        options.signal?.addEventListener("abort", dispose, { once: true });
    }
    return { get: (item: Item) => placeholders.get(item), release, dispose };
}
