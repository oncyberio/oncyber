/**
 * Baked avatars kept in IndexedDB, so a returning visitor does not bake the
 * same avatar again. Used by the bake workers (baker.worker.js, bakeJob.js):
 * reads and writes happen there, off the main thread.
 *
 * A bake is keyed by everything that shapes it:
 * - BAKE_VERSION, bumped whenever the baker's code or its other inputs
 *   change (bakeCache.test.js fails until you do; see BAKE_INPUTS there);
 * - the clips' version (the sha256 of compute2.json in compute2.bin);
 * - the SHA-256 of the avatar file's bytes the worker parses, and its URL.
 * Two avatars share an entry only if their files are byte for byte the same,
 * so no visitor ever gets another avatar's bake.
 *
 * The cache holds at most BAKE_CACHE_LIMITS (entries and bytes) and drops
 * the least recently used bakes first. Entries from another BAKE_VERSION or
 * clip set are deleted when a worker first opens the cache. Every failure
 * (no IndexedDB, private browsing, quota, a blocked or slow database) means
 * "not cached": the avatar is baked as before.
 */

/** Bump to discard every cached bake (any change to how bakes are made). */
export const BAKE_VERSION = 1;

export const BAKE_CACHE_LIMITS = {
    // A bake is mostly its float animation texture: 15 to 40 MB.
    maxBytes: 256 * 1024 * 1024,
    maxEntries: 24,
    maxEntryBytes: 96 * 1024 * 1024,
};

/** Waits this long for IndexedDB to open or answer, then bakes instead. */
export const BAKE_CACHE_TIMEOUT_MS = 3000;

const DB_NAME = "avatar-bakes";
const DB_SCHEMA = 1;
const META = "meta";
const BAKES = "bakes";

/** The cache key, or null when something it needs is missing. */
export function bakeCacheKey({ url, sha256, clips, version = BAKE_VERSION }) {
    if (!url || !sha256 || !clips) return null;
    return `v${version}|${clips}|${sha256}|${url}`;
}

/** Hex SHA-256 of `bytes`, or null without Web Crypto (insecure origins). */
export async function sha256Hex(bytes, subtle = globalThis.crypto?.subtle) {
    if (!subtle || !bytes) return null;
    const digest = new Uint8Array(await subtle.digest("SHA-256", bytes));
    let hex = "";
    for (const byte of digest) hex += byte.toString(16).padStart(2, "0");
    return hex;
}

/** Bytes a bake takes up: its typed arrays (the texture and metadata). */
export function bakeByteLength(bake) {
    const arrays = [
        bake?.texture?.source?.data?.data,
        bake?.metadata?.image?.source?.data?.data,
        bake?.additionalMeta?.image?.source?.data?.data,
        bake?.metaDataArray,
    ];
    return arrays.reduce((sum, array) => sum + (array?.byteLength || 0), 0);
}

const withTimeout = (promise, ms) =>
    new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve(null), ms);
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (error) => {
                clearTimeout(timer);
                reject(error);
            }
        );
    });

const request = (req) =>
    new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });

const finished = (tx) =>
    new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = tx.onabort = () =>
            reject(tx.error || new Error("Transaction aborted"));
    });

/**
 * The IndexedDB store behind the cache: two object stores, `meta` (small
 * records for eviction) and `bakes`, both keyed by the cache key. `put`
 * issues its writes before it returns, so IndexedDB copies the bake then.
 */
export function openIndexedDbBakeStore(idb = globalThis.indexedDB) {
    if (!idb) return Promise.resolve(null);
    return new Promise((resolve, reject) => {
        const open = idb.open(DB_NAME, DB_SCHEMA);
        open.onupgradeneeded = () => {
            const db = open.result;
            for (const name of [META, BAKES])
                if (!db.objectStoreNames.contains(name))
                    db.createObjectStore(name);
        };
        open.onblocked = () => reject(new Error("Bake cache is blocked"));
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
            const db = open.result;
            // Another tab upgrading the schema: let it, this one bakes.
            db.onversionchange = () => db.close();
            resolve({
                getAllMeta: () =>
                    request(db.transaction(META).objectStore(META).getAll()),
                getBake: (key) =>
                    request(db.transaction(BAKES).objectStore(BAKES).get(key)),
                put(meta, bake) {
                    const tx = db.transaction([META, BAKES], "readwrite");
                    tx.objectStore(BAKES).put(bake, meta.key);
                    tx.objectStore(META).put(meta, meta.key);
                    return finished(tx);
                },
                touch(key, lastUsed) {
                    const tx = db.transaction(META, "readwrite");
                    const store = tx.objectStore(META);
                    const read = store.get(key);
                    read.onsuccess = () => {
                        if (read.result)
                            store.put({ ...read.result, lastUsed }, key);
                    };
                    return finished(tx);
                },
                remove(keys) {
                    const tx = db.transaction([META, BAKES], "readwrite");
                    for (const key of keys) {
                        tx.objectStore(META).delete(key);
                        tx.objectStore(BAKES).delete(key);
                    }
                    return finished(tx);
                },
            });
        };
    });
}

/**
 * One worker's view of the cache. `open()` resolves to a handle with
 * `get(key)` (a bake or null) and `put(key, bake)`, or to null when there is
 * no usable cache. Neither ever throws.
 */
export function createBakeCache({
    clips,
    openStore = openIndexedDbBakeStore,
    limits = BAKE_CACHE_LIMITS,
    timeoutMs = BAKE_CACHE_TIMEOUT_MS,
    now = Date.now,
    version = BAKE_VERSION,
} = {}) {
    let opening = null;

    const evict = async (store) => {
        const entries = (await store.getAllMeta()).sort(
            (a, b) => a.lastUsed - b.lastUsed
        );
        let bytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);
        const drop = [];
        while (
            entries.length &&
            (entries.length > limits.maxEntries || bytes > limits.maxBytes)
        ) {
            const entry = entries.shift();
            bytes -= entry.bytes;
            drop.push(entry.key);
        }
        if (drop.length) await store.remove(drop);
    };

    const handle = (store) => ({
        async get(key) {
            if (!key) return null;
            try {
                const bake = await withTimeout(store.getBake(key), timeoutMs);
                if (!bake) return null;
                try {
                    store.touch(key, now()).catch(() => {});
                } catch (_) {
                    // Only the eviction order suffers.
                }
                return bake;
            } catch (_) {
                return null;
            }
        },
        /** Starts the write (the bake is copied now); resolves when stored. */
        put(key, bake) {
            try {
                const bytes = bakeByteLength(bake);
                if (!key || !bytes || bytes > limits.maxEntryBytes)
                    return Promise.resolve(false);
                return store
                    .put({ key, bytes, lastUsed: now(), version, clips }, bake)
                    .then(() => evict(store))
                    .then(
                        () => true,
                        () => false
                    );
            } catch (_) {
                return Promise.resolve(false);
            }
        },
    });

    return {
        open() {
            if (!clips) return Promise.resolve(null);
            opening ||= (async () => {
                const store = await withTimeout(openStore(), timeoutMs);
                if (!store) return null;
                // Bakes from another version or clip set can never be read.
                const stale = (await store.getAllMeta())
                    .filter(
                        (entry) =>
                            entry.version !== version || entry.clips !== clips
                    )
                    .map((entry) => entry.key);
                if (stale.length) await store.remove(stale);
                return handle(store);
            })().catch(() => null);
            return opening;
        },
    };
}
