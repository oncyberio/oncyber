/** @jest-environment jsdom */
jest.mock("../constants", () => ({ OLD_ALTS_MAPPING: {} }));
const entries = new Map();
const cache = {
    match: jest.fn(async (key) => entries.get(key)),
    put: jest.fn(async (key, value) => entries.set(key, value)),
    delete: jest.fn(async (key) => entries.delete(key)),
};
Object.defineProperty(window, "caches", {
    value: { open: jest.fn(async () => cache) },
    configurable: true,
});
const { CacheStorage } = require("./cachestorage");
const { isGlbUrl } = require("./assetUrl");
beforeEach(() => {
    entries.clear();
    jest.clearAllMocks();
    global.fetch = jest.fn(async () => ({
        ok: true,
        clone() {
            return this;
        },
    }));
});
test("revisits reuse full URL cache keys and versions remain distinct", async () => {
    const storage = new CacheStorage("room-v1");
    await storage.fetch("https://assets.test/room.glb?v=1");
    await storage.fetch("https://assets.test/room.glb?v=1");
    await storage.fetch("https://assets.test/room.glb?v=2");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(isGlbUrl("/room.GLB?v=2#test")).toBe(true);
    expect(isGlbUrl("/room.gltf?v=.glb")).toBe(false);
});
test("read and quota failures fall back to ordinary fetching", async () => {
    const storage = new CacheStorage("room-v1");
    cache.match.mockRejectedValueOnce(Error("private"));
    cache.put.mockRejectedValueOnce(Error("quota"));
    await expect(storage.fetch("/room.glb")).resolves.toMatchObject({
        ok: true,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
});
test("aborted sessions do not begin downloads", async () => {
    const c = new AbortController();
    c.abort();
    await expect(
        new CacheStorage("room").fetch("/room.glb", { signal: c.signal })
    ).rejects.toBeDefined();
    expect(fetch).not.toHaveBeenCalled();
});

const settle = async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
};
test("parsing can start before a slow cache write finishes", async () => {
    const storage = new CacheStorage("room-v1");
    let finishWrite;
    cache.put.mockImplementationOnce(
        (key, value) =>
            new Promise((resolve) => {
                finishWrite = () => {
                    entries.set(key, value);
                    resolve();
                };
            })
    );
    let response;
    const download = storage.fetch("/large-room.glb").then((value) => {
        response = value;
    });
    await settle();
    expect(response?.ok).toBe(true);
    expect(storage.pendingWrites.size).toBe(1);
    finishWrite();
    await download;
    await settle();
    expect(storage.pendingWrites.size).toBe(0);
});
test("an immediate revisit shares a pending cache write without a second download", async () => {
    const storage = new CacheStorage("room-v1");
    let finishWrite;
    cache.put.mockImplementationOnce(
        (key, value) =>
            new Promise((resolve) => {
                finishWrite = () => {
                    entries.set(key, value);
                    resolve();
                };
            })
    );
    const first = await storage.fetch("/room.glb?v=2");
    let revisited = false;
    const revisit = storage.fetch("/room.glb?v=2").then((response) => {
        revisited = true;
        return response;
    });
    await settle();
    expect(revisited).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
    finishWrite();
    expect(await revisit).toBe(first);
    expect(fetch).toHaveBeenCalledTimes(1);
});
test("cancelling a revisit does not wait for or cancel another reader's cache write", async () => {
    const storage = new CacheStorage("room-v1");
    let finishWrite;
    cache.put.mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                finishWrite = resolve;
            })
    );
    await storage.fetch("/room.glb");
    const controller = new AbortController();
    // This older jsdom lacks the modern browser API used by CacheStorage.fetch.
    controller.signal.throwIfAborted = () => {
        if (controller.signal.aborted)
            throw new DOMException("Aborted", "AbortError");
    };
    const revisit = storage.fetch("/room.glb", { signal: controller.signal });
    controller.abort();
    await expect(revisit).rejects.toMatchObject({ name: "AbortError" });
    expect(storage.pendingWrites.size).toBe(1);
    expect(fetch).toHaveBeenCalledTimes(1);
    finishWrite();
    await settle();
    expect(storage.pendingWrites.size).toBe(0);
});
test("a failed background cache write does not reject an already usable download", async () => {
    const storage = new CacheStorage("room-v1");
    let failWrite;
    cache.put.mockImplementationOnce(
        () =>
            new Promise((_, reject) => {
                failWrite = reject;
            })
    );
    expect(await storage.fetch("/room.glb")).toMatchObject({ ok: true });
    failWrite(Error("quota"));
    await settle();
    expect(storage.pendingWrites.size).toBe(0);
    expect(await storage.fetch("/room.glb")).toMatchObject({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(2);
});

test("Pinata model requests keep filename, versions and signed query data in cache keys", async () => {
    const storage = new CacheStorage("room-v1");
    const base =
        "https://cyber.mypinata.cloud/ipfs/QmQ3Qpv3qPVT5dXPbNmDsF63AFtC1GvQKy6ggVwDTGeCKj";
    const first = base + "?filename=room%20low.glb&signature=abc%2Fdef";
    const second = base + "?filename=room%20low.glb&signature=xyz%2Fdef";
    await storage.fetch(first);
    await storage.fetch(first);
    await storage.fetch(second);
    expect(fetch.mock.calls.map((call) => call[0])).toEqual([first, second]);
    expect([...entries.keys()]).toEqual([first, second]);
});

test("an empty answer is never stored, and one stored earlier is dropped", async () => {
    const storage = new CacheStorage("room-v1");
    const empty = {
        ok: true,
        status: 204,
        headers: new Map(),
        clone() {
            return this;
        },
    };
    fetch.mockResolvedValueOnce(empty);
    await expect(storage.fetch("/room.glb")).rejects.toThrow(/empty/);
    expect(cache.put).not.toHaveBeenCalled();
    // An entry cached by an older build is ignored and removed.
    entries.set("/room.glb", empty);
    await expect(storage.fetch("/room.glb")).resolves.toMatchObject({
        ok: true,
    });
    expect(cache.delete).toHaveBeenCalledWith("/room.glb");
    expect(fetch).toHaveBeenCalledTimes(2);
});
