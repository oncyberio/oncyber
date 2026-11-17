import { isChunkLoadError, reloadForChunkError } from "./chunkReload";

const chunkError = Object.assign(
    new Error(
        "Loading chunk 6320 failed. (timeout: /_next/static/chunks/6320.js)"
    ),
    {
        name: "ChunkLoadError",
    }
);

function memoryStorage() {
    const data = new Map<string, string>();
    return {
        getItem: (k: string) => data.get(k) ?? null,
        setItem: (k: string, v: string) => void data.set(k, v),
    } as any;
}

test("recognises chunk failures only", () => {
    expect(isChunkLoadError(chunkError)).toBe(true);
    expect(isChunkLoadError(new Error("Loading CSS chunk 12 failed"))).toBe(
        true
    );
    expect(
        isChunkLoadError(
            new TypeError("Failed to fetch dynamically imported module: /x.js")
        )
    ).toBe(true);
    expect(isChunkLoadError(new Error("Cannot read properties of null"))).toBe(
        false
    );
    expect(isChunkLoadError(undefined)).toBe(false);
});

test("reloads once, not again within a minute", () => {
    const storage = memoryStorage();
    const reload = jest.fn();
    expect(
        reloadForChunkError(chunkError, { storage, reload, now: 1_000_000 })
    ).toBe(true);
    expect(
        reloadForChunkError(chunkError, { storage, reload, now: 1_030_000 })
    ).toBe(false);
    expect(
        reloadForChunkError(chunkError, { storage, reload, now: 1_070_000 })
    ).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
});

test("other errors never reload", () => {
    const reload = jest.fn();
    reloadForChunkError(new Error("boom"), {
        storage: memoryStorage(),
        reload,
    });
    expect(reload).not.toHaveBeenCalled();
});

test("without storage it doesn't risk a loop", () => {
    const reload = jest.fn();
    const storage = {
        getItem: () => {
            throw new Error("blocked");
        },
        setItem: jest.fn(),
    } as any;
    expect(reloadForChunkError(chunkError, { storage, reload })).toBe(false);
    expect(reload).not.toHaveBeenCalled();
});
