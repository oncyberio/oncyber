import v8 from "v8";
import { webcrypto } from "crypto";
import { MessageChannel } from "worker_threads";
import { runBakeJob } from "./bakeJob";
import { createBakeCache, sha256Hex } from "./bakeCache";

const clone = (value) => v8.deserialize(v8.serialize(value));

function memoryStore() {
    const meta = new Map();
    const bakes = new Map();
    return {
        bakes,
        getAllMeta: async () => [...meta.values()].map(clone),
        getBake: async (key) =>
            bakes.has(key) ? clone(bakes.get(key)) : undefined,
        put(entry, bake) {
            const copy = clone(bake); // as IndexedDB: copied on put()
            return Promise.resolve().then(() => {
                bakes.set(entry.key, copy);
                meta.set(entry.key, clone(entry));
            });
        },
        touch: async () => {},
        remove: async (keys) => keys.forEach((key) => bakes.delete(key)),
    };
}

const fileBytes = (text) => new TextEncoder().encode(text).buffer;
const hash = (bytes) => sha256Hex(bytes, webcrypto.subtle);
const flush = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
};

/** Sends the message the way the worker does, detaching the buffers. */
function post({ message, transfer }) {
    const { port1, port2 } = new MessageChannel();
    port1.postMessage(message, transfer);
    port1.close();
    port2.close();
}

let store;
let deps;
beforeEach(() => {
    store = memoryStore();
    let baked = 0;
    deps = {
        cache: createBakeCache({ clips: "c1", openStore: async () => store }),
        clips: "c1",
        hash,
        parse: jest.fn(async (data) => ({
            userData: { vrm: { url: data.url } },
        })),
        bake: jest.fn(async (vrm) => ({
            texture: {
                source: {
                    data: {
                        data: new Float32Array([++baked, 2, 3, 4]),
                        width: 1,
                        height: 1,
                    },
                },
            },
            ids: [vrm.url],
            boneMap: new Map(),
        })),
    };
});

test("a second visit gets the stored bake instead of baking again", async () => {
    const job = { url: "https://a.test/me.vrm", bytes: fileBytes("me") };
    const first = await runBakeJob(job, deps);
    expect(first.message.cached).toBeUndefined();
    expect(first.transfer).toEqual([
        first.message.data.texture.source.data.data.buffer,
    ]);
    post(first); // the bake leaves the worker...
    expect(first.message.data.texture.source.data.data.byteLength).toBe(0);
    await flush();

    const second = await runBakeJob(job, deps); // ...but was copied first
    expect(deps.bake).toHaveBeenCalledTimes(1);
    expect(deps.parse).toHaveBeenCalledTimes(1);
    expect(second.message).toEqual({
        done: true,
        cached: true,
        data: expect.objectContaining({ ids: ["https://a.test/me.vrm"] }),
    });
    expect([...second.message.data.texture.source.data.data]).toEqual([
        1, 2, 3, 4,
    ]);
    expect(second.transfer).toEqual([
        second.message.data.texture.source.data.data.buffer,
    ]);
});

test("another file, even at the same URL, is baked, never served another's bake", async () => {
    await runBakeJob(
        { url: "https://a.test/me.vrm", bytes: fileBytes("me") },
        deps
    );
    await flush();
    const changed = await runBakeJob(
        { url: "https://a.test/me.vrm", bytes: fileBytes("me, edited") },
        deps
    );
    const moved = await runBakeJob(
        { url: "https://a.test/you.vrm", bytes: fileBytes("me") },
        deps
    );
    expect(deps.bake).toHaveBeenCalledTimes(3);
    expect(changed.message.cached).toBeUndefined();
    expect(moved.message.cached).toBeUndefined();
    expect(moved.message.data.ids).toEqual(["https://a.test/you.vrm"]);
});

test("a bake missing the lobby motion is not kept", async () => {
    deps.bake.mockResolvedValueOnce({
        texture: { source: { data: { data: new Float32Array(4) } } },
        lobbyMotionFailed: true,
    });
    const job = { url: "https://a.test/me.vrm", bytes: fileBytes("me") };
    await runBakeJob(job, deps);
    await flush();
    expect(store.bakes.size).toBe(0);
    await runBakeJob(job, deps);
    expect(deps.bake).toHaveBeenCalledTimes(2);
});

test.each([
    ["the worker fetches the file itself", { bytes: undefined }, {}],
    ["the clips' version is unknown (JSON fallback)", {}, { clips: null }],
    ["there is no cache", {}, { cache: null }],
    ["the file cannot be hashed", {}, { hash: async () => null }],
    [
        "hashing fails",
        {},
        { hash: async () => Promise.reject(new Error("no")) },
    ],
    [
        "the cache cannot open",
        {},
        {
            cache: createBakeCache({
                clips: "c1",
                openStore: async () => Promise.reject(new Error("private")),
            }),
        },
    ],
])("bakes as before when %s", async (_, jobChange, depsChange) => {
    const job = {
        url: "https://a.test/me.vrm",
        bytes: fileBytes("me"),
        ...jobChange,
    };
    const options = { ...deps, ...depsChange };
    await runBakeJob(job, options);
    await flush();
    const again = await runBakeJob(job, options);
    expect(deps.bake).toHaveBeenCalledTimes(2);
    expect(again.message).toEqual({ done: true, data: expect.any(Object) });
    expect(deps.parse).toHaveBeenLastCalledWith(job);
});

test("a failed bake rejects, and nothing is stored", async () => {
    deps.bake.mockRejectedValueOnce(new Error("bad rig"));
    await expect(
        runBakeJob(
            { url: "https://a.test/me.vrm", bytes: fileBytes("me") },
            deps
        )
    ).rejects.toThrow("bad rig");
    await flush();
    expect(store.bakes.size).toBe(0);
});
