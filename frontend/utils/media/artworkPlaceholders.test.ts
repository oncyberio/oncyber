import { createArtworkPlaceholders } from "./artworkPlaceholders";
import { runArtworkTasks } from "./tasks";

test("every queued artwork has a placeholder before slow metadata or video work can finish", async () => {
    const visible = new Set<number>();
    const disposed = jest.fn((value: number) => visible.delete(value));
    const placeholders = createArtworkPlaceholders([1, 2, 3, 4, 5], {
        create: (value) => value,
        attach: (value) => visible.add(value),
        dispose: disposed,
    });
    let finish: () => void;
    const queue = runArtworkTasks(
        [1, 2, 3, 4, 5],
        async (item) => {
            if (item === 1)
                await new Promise<void>((resolve) => {
                    finish = resolve;
                });
            placeholders.release(item);
        },
        { concurrency: 1, onError: jest.fn() }
    );
    expect([...visible]).toEqual([1, 2, 3, 4, 5]);
    finish();
    await queue;
    expect(visible.size).toBe(0);
    placeholders.release(1);
    placeholders.dispose();
    expect(disposed).toHaveBeenCalledTimes(5);
});

test("leaving disposes pending placeholders once and a late load cannot double-dispose them", () => {
    const signal = new AbortController();
    const dispose = jest.fn();
    const placeholders = createArtworkPlaceholders([1, 2], {
        create: (item) => ({ item }),
        attach: jest.fn(),
        dispose,
        signal: signal.signal,
    });
    placeholders.release(1);
    signal.abort();
    placeholders.release(2);
    placeholders.dispose();
    expect(dispose).toHaveBeenCalledTimes(2);
    expect(placeholders.get(2)).toBeUndefined();
});

test("existing previews and malformed items do not block other local placeholders", () => {
    const attach = jest.fn(),
        onError = jest.fn();
    const placeholders = createArtworkPlaceholders([1, 2, 3], {
        create: (item) => {
            if (item === 1) return null;
            if (item === 2) throw new Error("invalid dimensions");
            return { item };
        },
        attach,
        dispose: jest.fn(),
        onError,
    });
    expect(attach).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(placeholders.get(3)).toEqual({ item: 3 });
    placeholders.dispose();
});
