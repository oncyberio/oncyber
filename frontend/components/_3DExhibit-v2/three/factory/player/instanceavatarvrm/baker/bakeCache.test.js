import fs from "fs";
import path from "path";
import v8 from "v8";
import { createHash, webcrypto } from "crypto";
import {
    BAKE_CACHE_LIMITS,
    BAKE_VERSION,
    bakeByteLength,
    bakeCacheKey,
    createBakeCache,
    openIndexedDbBakeStore,
    sha256Hex,
} from "./bakeCache";

/**
 * What every bake depends on, besides the clips (versioned on their own) and
 * the avatar file (hashed into the key): the worker's code and everything it
 * imports, found by following imports from baker.worker.js, and the versions
 * of the packages it uses. When this test fails, a bake input changed:
 * bump BAKE_VERSION in bakeCache.js and record the new fingerprint here
 * under the new version, so visitors do not keep bakes from the old code.
 */
const BAKE_INPUT_FINGERPRINTS = {
    1: "b7299ea824e0c27ca96a169affcb2a807f3e97fc051b0bfb3c85283fb2d2025d",
};
// Cache plumbing and the clip codec do not change what a bake contains (the
// codec is pinned to the JSON by clipCodec.test.js).
const NOT_BAKE_INPUTS = ["bakeCache.js", "bakeJob.js", "clipCodec.js"];

const ROOT = process.cwd();
const clone = (value) => v8.deserialize(v8.serialize(value));

function bakeInputs() {
    const aliases = require(path.join(ROOT, "tsconfig.json")).compilerOptions
        .paths;
    const imports =
        /(?:^|[\s;])(?:import|export)\s+(?!type\b)(?:[^'"]*?\sfrom\s*)?["']([^"']+)["']|import\(\s*(?:\/\*.*?\*\/\s*)?["']([^"']+)["']\s*\)/gms;
    const alias = (spec) => {
        for (const [from, [to]] of Object.entries(aliases)) {
            if (from.endsWith("/*") && spec.startsWith(from.slice(0, -1)))
                return path.join(
                    ROOT,
                    to.slice(0, -1) + spec.slice(from.length - 1)
                );
            if (from === spec) return path.join(ROOT, to);
        }
        return null;
    };
    const existing = (base) =>
        [
            base,
            `${base}.js`,
            `${base}.ts`,
            `${base}.tsx`,
            `${base}/index.js`,
        ].find((file) => fs.existsSync(file) && fs.statSync(file).isFile());
    const files = new Set();
    const packages = new Set();
    const queue = [path.join(__dirname, "baker.worker.js")];
    while (queue.length) {
        const file = queue.pop();
        if (files.has(file) || NOT_BAKE_INPUTS.includes(path.basename(file)))
            continue;
        files.add(file);
        if (!/\.(js|ts|tsx)$/.test(file)) continue;
        const source = fs
            .readFileSync(file, "utf8")
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/(^|[^:])\/\/.*$/gm, "$1");
        for (const match of source.matchAll(imports)) {
            const spec = match[1] || match[2];
            const target = spec.startsWith(".")
                ? path.resolve(path.dirname(file), spec)
                : alias(spec);
            if (!target) {
                packages.add(
                    spec.startsWith("@")
                        ? spec.split("/").slice(0, 2).join("/")
                        : spec.split("/")[0]
                );
                continue;
            }
            const resolved = existing(target);
            if (!resolved) throw new Error(`Cannot resolve ${spec} in ${file}`);
            queue.push(resolved);
        }
    }
    return { files: [...files].sort(), packages: [...packages].sort() };
}

function fingerprint() {
    const { files, packages } = bakeInputs();
    const hash = createHash("sha256");
    for (const file of files) {
        hash.update(path.relative(ROOT, file) + "\0");
        hash.update(fs.readFileSync(file));
        hash.update("\0");
    }
    for (const name of packages)
        hash.update(`${name}@${require(`${name}/package.json`).version}\0`);
    return hash.digest("hex");
}

/** An in-memory stand-in for the IndexedDB store, copying like it does. */
function memoryStore() {
    const meta = new Map();
    const bakes = new Map();
    return {
        meta,
        bakes,
        getAllMeta: async () => [...meta.values()].map(clone),
        getBake: async (key) =>
            bakes.has(key) ? clone(bakes.get(key)) : undefined,
        put(entry, bake) {
            // IndexedDB copies the value when put() is called.
            const copy = clone(bake);
            const record = clone(entry);
            return Promise.resolve().then(() => {
                bakes.set(entry.key, copy);
                meta.set(entry.key, record);
            });
        },
        touch: async (key, lastUsed) => {
            if (meta.has(key)) meta.set(key, { ...meta.get(key), lastUsed });
        },
        remove: async (keys) =>
            keys.forEach((key) => {
                meta.delete(key);
                bakes.delete(key);
            }),
    };
}

const bake = (bytes = 1024, fill = 1) => ({
    texture: {
        source: {
            data: {
                data: new Float32Array(bytes / 4).fill(fill),
                width: bytes / 16,
                height: 1,
            },
        },
    },
    ids: ["IDLE"],
    boneMap: new Map([["hips", 0]]),
    extras: {},
});
const texture = (entry) => [...entry.texture.source.data.data];

const flush = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
};

test("BAKE_VERSION is bumped whenever what goes into a bake changes", () => {
    const { files } = bakeInputs();
    expect(files.map((file) => path.relative(ROOT, file))).toEqual(
        expect.arrayContaining([
            "components/_3DExhibit-v2/three/factory/player/instanceavatarvrm/baker/indexworker.js",
            "components/_3DExhibit-v2/three/factory/player/instanceavatarvrm/lobbyMotionClips.ts",
            "features/lobby/optionalMotionPack.ts",
        ])
    );
    expect({ version: BAKE_VERSION, fingerprint: fingerprint() }).toEqual({
        version: BAKE_VERSION,
        fingerprint: BAKE_INPUT_FINGERPRINTS[BAKE_VERSION],
    });
});

test("the key holds the version, the clips, the file's hash and its URL", () => {
    const parts = { url: "https://a.test/me.vrm", sha256: "abc", clips: "c1" };
    expect(bakeCacheKey(parts)).toBe(
        `v${BAKE_VERSION}|c1|abc|https://a.test/me.vrm`
    );
    const keys = new Set([
        bakeCacheKey(parts),
        bakeCacheKey({ ...parts, url: "https://a.test/you.vrm" }),
        bakeCacheKey({ ...parts, sha256: "abd" }),
        bakeCacheKey({ ...parts, clips: "c2" }),
        bakeCacheKey({ ...parts, version: BAKE_VERSION + 1 }),
    ]);
    expect(keys.size).toBe(5);
    for (const missing of ["url", "sha256", "clips"])
        expect(bakeCacheKey({ ...parts, [missing]: null })).toBeNull();
});

test("the file hash is SHA-256, and absent without Web Crypto", async () => {
    const bytes = new TextEncoder().encode("abc").buffer;
    expect(await sha256Hex(bytes, webcrypto.subtle)).toBe(
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
    expect(await sha256Hex(bytes, undefined)).toBeNull();
});

test("a stored bake comes back as it was, and a missing one is null", async () => {
    const store = memoryStore();
    const cache = await createBakeCache({
        clips: "c1",
        openStore: async () => store,
    }).open();
    const original = bake(64, 0.5);
    const write = cache.put("k1", original);
    original.texture.source.data.data.fill(9); // changes after put do not count
    expect(await write).toBe(true);
    const hit = await cache.get("k1");
    expect(texture(hit)).toEqual(new Array(16).fill(0.5));
    expect(hit.boneMap.get("hips")).toBe(0);
    expect(await cache.get("other")).toBeNull();
    expect(store.meta.get("k1")).toEqual({
        key: "k1",
        bytes: 64,
        lastUsed: expect.any(Number),
        version: BAKE_VERSION,
        clips: "c1",
    });
});

test("a version bump or new clips discard the old bakes", async () => {
    const store = memoryStore();
    const openStore = async () => store;
    const v1 = await createBakeCache({
        clips: "c1",
        openStore,
        version: 1,
    }).open();
    await v1.put(
        bakeCacheKey({ url: "u", sha256: "s", clips: "c1", version: 1 }),
        bake()
    );
    await v1.put("other-clips", bake());
    store.meta.set("other-clips", {
        ...store.meta.get("other-clips"),
        clips: "c0",
    });
    expect(store.bakes.size).toBe(2);

    const v2 = await createBakeCache({
        clips: "c1",
        openStore,
        version: 2,
    }).open();
    expect(store.bakes.size).toBe(0);
    expect(
        await v2.get(
            bakeCacheKey({ url: "u", sha256: "s", clips: "c1", version: 1 })
        )
    ).toBeNull();
});

test("the least recently used bakes go first, by count and by bytes", async () => {
    let time = 0;
    const store = memoryStore();
    const cache = await createBakeCache({
        clips: "c1",
        openStore: async () => store,
        now: () => ++time,
        limits: { maxEntries: 2, maxBytes: 4096, maxEntryBytes: 3000 },
    }).open();
    await cache.put("a", bake(1024));
    await cache.put("b", bake(1024));
    await cache.get("a"); // a is now more recent than b
    await flush();
    await cache.put("c", bake(1024));
    expect([...store.bakes.keys()].sort()).toEqual(["a", "c"]);

    await cache.put("d", bake(2048)); // 1024 + 1024 + 2048 > 4096 bytes...
    expect([...store.bakes.keys()].sort()).toEqual(["c", "d"]); // ...and > 2
    expect(await cache.put("huge", bake(4096))).toBe(false);
    expect(store.bakes.has("huge")).toBe(false);
});

test("the default limits keep several typical bakes", () => {
    const typical = 20 * 1024 * 1024;
    expect(BAKE_CACHE_LIMITS.maxBytes / typical).toBeGreaterThanOrEqual(8);
    expect(BAKE_CACHE_LIMITS.maxEntryBytes).toBeGreaterThan(64 * 1024 * 1024);
    expect(bakeByteLength(bake(1024))).toBe(1024);
});

describe("any failure means no cache, never an error", () => {
    test.each([
        [
            "no IndexedDB (or it is blocked)",
            () => openIndexedDbBakeStore(undefined),
        ],
        [
            "opening fails (private browsing)",
            async () =>
                Promise.reject(new DOMException("denied", "InvalidStateError")),
        ],
        ["opening never answers", () => new Promise(() => {})],
        [
            "the store throws on first read",
            async () => ({
                ...memoryStore(),
                getAllMeta: () => {
                    throw new Error("closed");
                },
            }),
        ],
    ])("%s", async (_, openStore) => {
        const cache = createBakeCache({
            clips: "c1",
            openStore,
            timeoutMs: 20,
        });
        expect(await cache.open()).toBeNull();
    });

    test("without a clip version there is no cache", async () => {
        const openStore = jest.fn(async () => memoryStore());
        expect(
            await createBakeCache({ clips: null, openStore }).open()
        ).toBeNull();
        expect(openStore).not.toHaveBeenCalled();
    });

    test("reads and writes that fail or hang", async () => {
        const store = {
            ...memoryStore(),
            getBake: () => new Promise(() => {}),
            put: () =>
                Promise.reject(new DOMException("full", "QuotaExceededError")),
        };
        const cache = await createBakeCache({
            clips: "c1",
            openStore: async () => store,
            timeoutMs: 20,
        }).open();
        expect(await cache.get("k")).toBeNull();
        expect(await cache.put("k", bake())).toBe(false);
        store.getBake = () => {
            throw new Error("closed");
        };
        store.put = () => {
            throw new Error("closed");
        };
        expect(await cache.get("k")).toBeNull();
        expect(await cache.put("k", bake())).toBe(false);
    });
});
