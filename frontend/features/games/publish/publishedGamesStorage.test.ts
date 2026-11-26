/** @jest-environment node */
import { createHash } from "crypto";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { Readable, Writable } from "stream";

jest.mock("@utils/firebaseAdmin", () =>
    require("./memoryFirestore.jest").memoryFirebaseAdmin()
);
jest.mock("./releaseBucket", () => ({
    ...jest.requireActual("./releaseBucket"),
    releaseBucket: jest.fn(),
}));

import { memoryDocs } from "./memoryFirestore.jest";
import {
    PUBLISH_MAX_RELEASES_PER_DAY,
    PUBLISH_THUMBNAIL_MAX,
    PUBLISH_UPLOAD_TTL_MS,
    publishBeginSchema,
    releaseIdOf,
    releaseManifestText,
} from "./publishedGames";
import {
    beginPublish,
    finishPublish,
    forgetPendingUploads,
    forgetPublishedGames,
    minePublished,
    unpublishGame,
} from "./publishedGamesServer";
import {
    releaseBucket,
    releaseBucketConfig,
    releaseObject,
    stagedObject,
    type ReleaseBucket,
} from "./releaseBucket";
import releasesRoute, {
    forgetStoredPolicies,
} from "../../../pages/api/games/releases/[...path]";
import { getServerSideProps } from "../../../pages/games/[game]";

// The page's components are not under test; its server half is.
jest.mock("../GamePage", () => () => null);
jest.mock("../interface/GameDeviceGate", () => () => null);
jest.mock("../health/GameKillSwitchGate", () => () => null);

const NOW = new Date("2026-11-17T10:00:00.000Z");
const SANDBOX = "sandbox allow-scripts allow-pointer-lock";
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const UPLOAD = "A".repeat(24);

const digest = (algorithm: string, bytes: any, encoding: any = "hex") =>
    createHash(algorithm).update(bytes).digest(encoding);
const sha256 = (bytes: any) => digest("sha256", bytes);

/** A small build: path -> contents. */
const BUILD: Record<string, string> = {
    "index.html": "<!doctype html><script src=./assets/a.js></script>",
    "assets/a.js": "export default 1",
    "network.json": JSON.stringify({
        version: 1,
        hosts: ["cyber.mypinata.cloud"],
        inlineScripts: [],
    }),
    "credits.json": "{}",
};
const listOf = (build: Record<string, string>, md5 = true) =>
    Object.entries(build).map(([path, text]) => ({
        path,
        bytes: Buffer.byteLength(text),
        sha256: sha256(text),
        ...(md5 ? { md5: digest("md5", text) } : {}),
    }));
const inputFor = (id: string, build = BUILD, md5 = true) => {
    const files = listOf(build, md5);
    return publishBeginSchema.parse({
        id,
        manifest: { name: "My Game" },
        entry: {
            title: "My Game",
            tagline: "a small game",
            description: "A small game about walking around a quiet courtyard.",
            players: { min: 1, max: 4 },
            devices: ["desktop"],
            tags: ["arcade"],
        },
        files,
        check: {
            status: "passed",
            checkedAt: NOW.toISOString(),
            release: releaseIdOf(files),
        },
    });
};

/**
 * A stand-in bucket. `put` is what the store does with a request to a
 * signed address: it holds it to what was signed, as Cloud Storage is
 * documented to. `loose` makes it the emulator instead, which enforces
 * nothing and lets an object be replaced.
 */
function memoryBucket({ loose = false } = {}) {
    type Held = { bytes: Buffer; generation: string; encoding: string | null };
    const objects = new Map<string, Held>();
    const signed = new Map<string, any>();
    const calls: string[] = [];
    let generation = 100;
    let failing = false;
    /** Runs once, after the next read of an object ends. */
    let afterRead: (() => void) | null = null;
    const gone = (object: string) =>
        Object.assign(new Error(`No such object: secret-bucket/${object}`), {
            code: 404,
        });
    const check = (call: string) => {
        calls.push(call);
        if (failing)
            throw Object.assign(new Error("secret-bucket is on fire"), {
                code: 503,
            });
    };
    const set = (object: string, bytes: any, encoding: string | null = null) =>
        objects.set(object, {
            bytes: Buffer.from(bytes),
            generation: String(generation++),
            encoding,
        });
    const bucket: ReleaseBucket = {
        async signUpload(request) {
            check(`sign ${request.object}`);
            const url = `https://storage.example/secret-bucket/${
                request.object
            }?signature=${signed.size + 1}`;
            const headers: Record<string, string> = {
                "Content-Type": "application/octet-stream",
                "x-goog-content-length-range": `${
                    request.exact ? request.bytes : 0
                },${request.bytes}`,
                "x-goog-if-generation-match": "0",
                ...(request.md5 ? { "Content-MD5": request.md5 } : {}),
            };
            signed.set(url, { ...request, headers });
            return { url, headers };
        },
        async stat(object) {
            check(`stat ${object}`);
            const held = objects.get(object);
            return held
                ? {
                      bytes: held.bytes.length,
                      generation: held.generation,
                      md5: digest("md5", held.bytes, "base64"),
                      encoding: held.encoding,
                  }
                : null;
        },
        read(object, version) {
            calls.push(`read ${object}`);
            const held = objects.get(object);
            const error = failing
                ? Object.assign(new Error("secret-bucket is on fire"), {
                      code: 503,
                  })
                : !held || (version && version !== held.generation)
                ? gone(object)
                : null;
            if (error)
                return new Readable({
                    read() {
                        this.destroy(error);
                    },
                });
            const body = Readable.from([
                held.bytes.subarray(0, 7),
                held.bytes.subarray(7),
            ]);
            body.on("end", () => {
                const then = afterRead;
                afterRead = null;
                then?.();
            });
            return body;
        },
        async copy(from, version, to) {
            check(`copy ${from} ${to}`);
            const held = objects.get(from);
            if (!held || held.generation !== version) throw gone(from);
            if (objects.has(to)) return false;
            set(to, held.bytes);
            return true;
        },
        async create(object, bytes) {
            check(`create ${object}`);
            if (objects.has(object)) return false;
            set(object, bytes);
            return true;
        },
        async list(prefix) {
            check(`list ${prefix}`);
            return [...objects]
                .filter(([object]) => object.startsWith(prefix))
                .map(([object, held]) => ({
                    object,
                    bytes: held.bytes.length,
                }));
        },
        async remove(object) {
            check(`remove ${object}`);
            objects.delete(object);
        },
        async removeAll(prefix) {
            check(`removeAll ${prefix}`);
            for (const object of [...objects.keys()])
                if (object.startsWith(prefix)) objects.delete(object);
        },
    };
    return {
        bucket,
        objects,
        calls,
        set,
        fail: (on: boolean) => void (failing = on),
        afterNextRead: (then: () => void) => void (afterRead = then),
        text: (object: string) => objects.get(object)?.bytes.toString("utf8"),
        under: (prefix: string) =>
            [...objects.keys()].filter((object) => object.startsWith(prefix)),
        /** A `PUT` to a signed address: the status the store answers. */
        put(
            url: string,
            headers: Record<string, string>,
            body: any,
            { now = NOW.getTime(), encoding = null as string | null } = {}
        ): number {
            const request = signed.get(url);
            if (!request || now > request.expiresAt) return 403;
            const bytes = Buffer.from(body);
            if (!loose) {
                // Every signed header, exactly as it was signed.
                for (const [name, value] of Object.entries(request.headers))
                    if (headers[name] !== value) return 403;
                const least = request.exact ? request.bytes : 0;
                if (bytes.length < least || bytes.length > request.bytes)
                    return 400;
                if (
                    request.md5 &&
                    request.md5 !== digest("md5", bytes, "base64")
                )
                    return 400;
                if (objects.has(request.object)) return 412;
            }
            set(request.object, bytes, encoding);
            return 200;
        },
    };
}

const env = { ...process.env };
let store: ReturnType<typeof memoryBucket>;
let root: string;
beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "published-storage-"));
    process.env = {
        ...env,
        NODE_ENV: "production",
        GAMES_PREVIEW: "1",
        GAMES_PUBLISHING: "open",
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "secret-bucket",
    } as any;
    for (const name of [
        "GAMES_DISABLED",
        "GAMES_PUBLISHING_PINATA",
        "GAMES_PUBLISHING_STORAGE",
        "GAMES_RELEASES_DIR",
        "GAMES_STORAGE_BUCKET",
        "FIREBASE_STORAGE_EMULATOR_HOST",
        "STORAGE_EMULATOR_HOST",
    ])
        delete process.env[name];
    memoryDocs.clear();
    forgetPublishedGames();
    forgetPendingUploads();
    forgetStoredPolicies();
    store = memoryBucket();
    (releaseBucket as jest.Mock).mockImplementation((from = process.env) =>
        releaseBucketConfig(from) ? store.bucket : null
    );
});
afterEach(() => rmSync(root, { recursive: true, force: true }));
// What the server logs of a failing store is not for the creator to see.
let logged: jest.SpyInstance;
beforeEach(() => {
    logged = jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => logged.mockRestore());
afterAll(() => {
    process.env = env;
});

type Begun = Awaited<ReturnType<typeof beginPublish>>;
const addresses = (begun: Begun) => {
    if (begun.upload.mode !== "storage") throw new Error(begun.upload.mode);
    return begun.upload.files;
};
/** Every file of a build, each to its own address: as the command does. */
function sendAll(begun: Begun, build = BUILD) {
    for (const { path, url, headers } of addresses(begun))
        if (path in build)
            expect([path, store.put(url, headers, build[path])]).toEqual([
                path,
                200,
            ]);
}
async function publish(owner: string, id: string, build = BUILD, now = NOW) {
    const begun = await beginPublish(owner, inputFor(id, build), { now });
    sendAll(begun, build);
    return finishPublish(owner, { uploadId: begun.uploadId }, { now });
}

async function fetchRelease(path: string[], method = "GET") {
    const headers: Record<string, unknown> = {};
    const chunks: any[] = [];
    let status = 0;
    const res: any = new Writable({
        write(chunk, _encoding, done) {
            chunks.push(Buffer.from(chunk));
            done();
        },
    });
    res.setHeader = (name: string, value: unknown) =>
        void (headers[name.toLowerCase()] = value);
    res.status = (code: number) => ((status = code), res);
    const ended = new Promise((done) => res.on("finish", done));
    await releasesRoute({ method, query: { path } } as any, res);
    if (!res.writableEnded) await ended;
    return { status, headers, body: Buffer.concat(chunks).toString("utf8") };
}
const record = (id: string) => memoryDocs.get(`publishedGames/${id}`) as any;

describe("which mode a server answers with", () => {
    const modeOf = async () =>
        (await beginPublish("user-a", inputFor("my-game"), { now: NOW })).upload
            .mode;

    test("the bucket's name, and the switch", () => {
        const name = "project.appspot.com";
        expect(releaseBucketConfig({})).toBeNull();
        expect(
            releaseBucketConfig({ NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: name })
        ).toEqual({ name, forced: false, emulated: false });
        // A bucket of its own wins over the project's.
        expect(
            releaseBucketConfig({
                NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: name,
                GAMES_STORAGE_BUCKET: "gs://games-of-ours/",
                GAMES_PUBLISHING_STORAGE: "on",
                FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
            })
        ).toEqual({ name: "games-of-ours", forced: true, emulated: true });
        expect(
            releaseBucketConfig({
                NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: name,
                GAMES_PUBLISHING_STORAGE: "off",
            })
        ).toBeNull();
        for (const bad of ["Not A Bucket", "a/b", "../etc", "x"])
            expect(
                releaseBucketConfig({ GAMES_STORAGE_BUCKET: bad })
            ).toBeNull();
    });

    test("a server with no folder and a bucket: storage", async () => {
        expect(await modeOf()).toBe("storage");
    });

    test("a releases folder comes first, unless the switch says storage", async () => {
        process.env.GAMES_RELEASES_DIR = root;
        expect(await modeOf()).toBe("site");
        process.env.GAMES_PUBLISHING_STORAGE = "on";
        expect(await modeOf()).toBe("storage");
    });

    test("switched off, or no bucket: publishing is not available", async () => {
        process.env.GAMES_PUBLISHING_STORAGE = "off";
        await expect(modeOf()).rejects.toThrow(/not available on this server/);
        delete process.env.GAMES_PUBLISHING_STORAGE;
        delete process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
        await expect(modeOf()).rejects.toThrow(/not available on this server/);
    });
});

describe("object names", () => {
    const release = "0123456789abcdef";
    test("come from ids and plain paths, and nothing else", () => {
        expect(stagedObject(UPLOAD, "assets/a.js")).toBe(
            `games-staging/${UPLOAD}/assets/a.js`
        );
        expect(stagedObject(UPLOAD, "thumbnail.jpg")).toBe(
            `games-staging/${UPLOAD}/thumbnail.jpg`
        );
        expect(releaseObject("my-game", release, "assets/a.js")).toBe(
            `games/my-game/${release}/assets/a.js`
        );
        expect(releaseObject("my-game", release, "oncyber-release.json")).toBe(
            `games/my-game/${release}/oncyber-release.json`
        );
        for (const path of [
            "../other/index.html",
            "assets/../../x",
            "/index.html",
            "assets//a.js",
            "assets/",
            ".env",
            "a b.js",
            "a%2f..%2fb",
            "a\\b",
            "",
        ]) {
            expect([path, stagedObject(UPLOAD, path)]).toEqual([path, null]);
            expect([path, releaseObject("my-game", release, path)]).toEqual([
                path,
                null,
            ]);
        }
        expect(stagedObject("../games", "index.html")).toBeNull();
        expect(releaseObject("../x", release, "index.html")).toBeNull();
        expect(releaseObject("my-game", "..", "index.html")).toBeNull();
    });
});

describe("mode storage, end to end", () => {
    test("begin signs one address per file; finish verifies, copies and registers", async () => {
        const input = inputFor("my-game");
        const begun = await beginPublish("user-a", input, { now: NOW });
        expect(begun).toMatchObject({
            release: releaseIdOf(input.files),
            stored: false,
            upload: { mode: "storage", expires: PUBLISH_UPLOAD_TTL_MS / 1000 },
        });
        const files = addresses(begun);
        expect(files.map((file) => file.path)).toEqual([
            ...Object.keys(BUILD),
            "thumbnail.jpg",
        ]);
        // Each address names its own staged object, the exact size and the
        // MD5 the command sent, and can only create.
        const script = files.find((file) => file.path === "assets/a.js");
        expect(script.url).toContain(
            `/games-staging/${begun.uploadId}/assets/a.js?`
        );
        expect(script.headers).toEqual({
            "Content-Type": "application/octet-stream",
            "Content-MD5": digest("md5", BUILD["assets/a.js"], "base64"),
            "x-goog-content-length-range": "16,16",
            "x-goog-if-generation-match": "0",
        });
        expect(
            files.find((file) => file.path === "thumbnail.jpg").headers
        ).toEqual({
            "Content-Type": "application/octet-stream",
            "x-goog-content-length-range": `0,${PUBLISH_THUMBNAIL_MAX}`,
            "x-goog-if-generation-match": "0",
        });
        expect(store.calls.filter((call) => /^sign /.test(call))).toHaveLength(
            5
        );
        // Nothing is registered, or stored where releases are, by `begin`.
        expect(record("my-game")).toBeUndefined();
        expect(store.under("games/")).toEqual([]);

        sendAll(begun);
        const thumbnail = files.find((file) => file.path === "thumbnail.jpg");
        expect(store.put(thumbnail.url, thumbnail.headers, JPEG)).toBe(200);
        const finished = await finishPublish(
            "user-a",
            { uploadId: begun.uploadId },
            { now: NOW }
        );
        expect(finished).toEqual({
            id: "my-game",
            release: begun.release,
            url: "/games/my-game",
            status: "unlisted",
        });
        const prefix = `games/my-game/${begun.release}/`;
        expect(store.under("games/").sort()).toEqual(
            [...Object.keys(BUILD), "oncyber-release.json", "thumbnail.jpg"]
                .map((path) => `${prefix}${path}`)
                .sort()
        );
        expect(store.text(`${prefix}oncyber-release.json`)).toBe(
            releaseManifestText(
                "my-game",
                begun.release,
                input.files.map(({ path, bytes, sha256 }) => ({
                    path,
                    bytes,
                    sha256,
                }))
            )
        );
        // Staging is cleared, and the record says where, by backend alone.
        expect(store.under("games-staging/")).toEqual([]);
        expect(record("my-game")).toMatchObject({
            owner: "user-a",
            status: "unlisted",
            current: begun.release,
            releases: [
                {
                    release: begun.release,
                    backend: "storage",
                    files: 4,
                    check: "self-reported",
                    thumbnail: true,
                },
            ],
        });
        expect(JSON.stringify(record("my-game"))).not.toMatch(
            /secret-bucket|games-staging|storage\.example/
        );
        expect(await minePublished("user-a", NOW)).toMatchObject([
            { id: "my-game", status: "unlisted", release: begun.release },
        ]);
        // An upload finishes once.
        await expect(
            finishPublish("user-a", { uploadId: begun.uploadId }, { now: NOW })
        ).rejects.toThrow("No such upload.");
    });

    test("a command that sends no MD5 still gets exact sizes", async () => {
        const begun = await beginPublish(
            "user-a",
            inputFor("my-game", BUILD, false),
            { now: NOW }
        );
        expect(addresses(begun)[0].headers).toEqual({
            "Content-Type": "application/octet-stream",
            "x-goog-content-length-range": "50,50",
            "x-goog-if-generation-match": "0",
        });
    });

    test("the same release again needs no upload and signs nothing", async () => {
        const first = await publish("user-a", "my-game");
        const second = await publish("user-a", "my-game", {
            ...BUILD,
            "assets/a.js": "export default 2",
        });
        expect(record("my-game").current).toBe(second.release);
        store.calls.length = 0;
        const again = await beginPublish("user-a", inputFor("my-game"), {
            now: NOW,
        });
        expect(again).toMatchObject({
            release: first.release,
            stored: true,
            upload: { mode: "storage", files: [] },
        });
        expect(store.calls.filter((call) => /^sign /.test(call))).toEqual([]);
        await finishPublish(
            "user-a",
            { uploadId: again.uploadId },
            { now: NOW }
        );
        expect(record("my-game").current).toBe(first.release);
        expect(record("my-game").releases).toHaveLength(2);
        // The first release's objects are the ones first stored.
        expect(store.text(`games/my-game/${first.release}/assets/a.js`)).toBe(
            "export default 1"
        );
    });
});

describe("what the store and finish refuse", () => {
    test("an address takes its own object, the listed size and bytes, once", async () => {
        const begun = await beginPublish("user-a", inputFor("my-game"), {
            now: NOW,
        });
        const { url, headers } = addresses(begun).find(
            (file) => file.path === "assets/a.js"
        );
        const bytes = BUILD["assets/a.js"];
        // Larger, smaller, other bytes of the same size, other headers.
        expect(store.put(url, headers, `${bytes}!`)).toBe(400);
        expect(store.put(url, headers, bytes.slice(1))).toBe(400);
        expect(store.put(url, headers, "export default 2")).toBe(400);
        expect(
            store.put(
                url,
                { ...headers, "x-goog-content-length-range": "0,99999999" },
                `${bytes}!`
            )
        ).toBe(403);
        // Past the upload's half hour.
        expect(
            store.put(url, headers, bytes, {
                now: NOW.getTime() + PUBLISH_UPLOAD_TTL_MS + 1,
            })
        ).toBe(403);
        expect(store.put(url, headers, bytes)).toBe(200);
        expect(store.put(url, headers, bytes)).toBe(412);
        // An address for another object is another address.
        expect(store.put(url.replace("a.js", "b.js"), headers, bytes)).toBe(
            403
        );
        expect(store.under("games-staging/")).toEqual([
            `games-staging/${begun.uploadId}/assets/a.js`,
        ]);
    });

    test("files missing: nothing is copied or registered, and finish may be called again", async () => {
        const begun = await beginPublish("user-a", inputFor("my-game"), {
            now: NOW,
        });
        const [first, ...rest] = addresses(begun);
        expect(store.put(first.url, first.headers, BUILD[first.path])).toBe(
            200
        );
        await expect(
            finishPublish("user-a", { uploadId: begun.uploadId }, { now: NOW })
        ).rejects.toThrow(/not complete: .*assets\/a\.js was not uploaded/);
        expect(store.under("games/")).toEqual([]);
        expect(record("my-game")).toBeUndefined();
        for (const { path, url, headers } of rest)
            if (path in BUILD) store.put(url, headers, BUILD[path]);
        await finishPublish(
            "user-a",
            { uploadId: begun.uploadId },
            { now: NOW }
        );
        expect(record("my-game").current).toBe(begun.release);
    });

    test("bytes that are not the listed ones are found by reading them, and removed", async () => {
        // The emulator's way: nothing is enforced as a file arrives.
        store = memoryBucket({ loose: true });
        const begun = await beginPublish("user-a", inputFor("my-game"), {
            now: NOW,
        });
        sendAll(begun);
        const staged = (path: string) =>
            `games-staging/${begun.uploadId}/${path}`;
        const finish = () =>
            finishPublish("user-a", { uploadId: begun.uploadId }, { now: NOW });
        // The same size, other bytes: only the SHA-256 tells.
        store.set(staged("assets/a.js"), "export default 2");
        await expect(finish()).rejects.toThrow(
            /assets\/a\.js has the wrong contents/
        );
        expect(store.objects.has(staged("assets/a.js"))).toBe(false);
        store.set(staged("assets/a.js"), `${BUILD["assets/a.js"]} `);
        await expect(finish()).rejects.toThrow(
            /assets\/a\.js has the wrong size/
        );
        // Bytes the store would hand a reader decoded are not taken.
        store.set(staged("assets/a.js"), BUILD["assets/a.js"], "gzip");
        await expect(finish()).rejects.toThrow(/Content-Encoding/);
        expect(store.under("games/")).toEqual([]);
        expect(record("my-game")).toBeUndefined();
        store.set(staged("assets/a.js"), BUILD["assets/a.js"]);
        await finish();
        expect(record("my-game").current).toBe(begun.release);
    });

    test("an upload racing finish: the version that was read is the one copied, or nothing is", async () => {
        store = memoryBucket({ loose: true });
        const begun = await beginPublish("user-a", inputFor("my-game"), {
            now: NOW,
        });
        sendAll(begun);
        const staged = `games-staging/${begun.uploadId}/index.html`;
        // The staged file is replaced after finish has read and hashed it.
        store.afterNextRead(() =>
            store.set(
                staged,
                "<script>location='https://evil.example'</script>"
            )
        );
        await expect(
            finishPublish("user-a", { uploadId: begun.uploadId }, { now: NOW })
        ).rejects.toThrow(/storage did not answer/);
        expect(record("my-game")).toBeUndefined();
        // What this call had copied is taken away again.
        expect(store.under("games/")).toEqual([]);
    });

    test("an address that outlives finish cannot change what is served", async () => {
        const begun = await beginPublish("user-a", inputFor("my-game"), {
            now: NOW,
        });
        sendAll(begun);
        const { release } = await finishPublish(
            "user-a",
            { uploadId: begun.uploadId },
            { now: NOW }
        );
        const { url, headers } = addresses(begun)[0];
        // Still valid, and staging was cleared: the store takes the bytes
        // again, in staging, where nothing is served from.
        expect(store.put(url, headers, BUILD["index.html"])).toBe(200);
        expect(store.under("games-staging/")).toHaveLength(1);
        expect(store.text(`games/my-game/${release}/index.html`)).toBe(
            BUILD["index.html"]
        );
        expect(
            (await fetchRelease(["my-game", release, "index.html"])).body
        ).toBe(BUILD["index.html"]);
        expect(
            (
                await fetchRelease([
                    "games-staging",
                    begun.uploadId,
                    "index.html",
                ])
            ).status
        ).toBe(404);
    });

    test("a release stored with other contents is never taken for this one", async () => {
        const input = inputFor("my-game");
        const release = releaseIdOf(input.files);
        store.set(`games/my-game/${release}/oncyber-release.json`, "{}");
        const begun = await beginPublish("user-a", input, { now: NOW });
        expect(begun.stored).toBe(false);
        sendAll(begun);
        await expect(
            finishPublish("user-a", { uploadId: begun.uploadId }, { now: NOW })
        ).rejects.toThrow(/already stored with different contents/);
        expect(record("my-game")).toBeUndefined();
    });

    test("files left by a finish that stopped part way are these bytes, or the release is refused", async () => {
        const input = inputFor("my-game");
        const release = releaseIdOf(input.files);
        store.set(`games/my-game/${release}/credits.json`, "{}");
        store.set(`games/my-game/${release}/assets/a.js`, "export default 9");
        const begun = await beginPublish("user-a", input, { now: NOW });
        sendAll(begun);
        await expect(
            finishPublish("user-a", { uploadId: begun.uploadId }, { now: NOW })
        ).rejects.toThrow(/already stored with different contents/);
        // What was there stays; what this call added is gone.
        expect(store.under("games/").sort()).toEqual([
            `games/my-game/${release}/assets/a.js`,
            `games/my-game/${release}/credits.json`,
        ]);
        store.set(`games/my-game/${release}/assets/a.js`, BUILD["assets/a.js"]);
        await finishPublish(
            "user-a",
            { uploadId: begun.uploadId },
            { now: NOW }
        );
        expect(record("my-game").current).toBe(release);
    });

    test("another account's upload, an expired one, and a release past the day's count", async () => {
        const begun = await beginPublish("user-a", inputFor("my-game"), {
            now: NOW,
        });
        sendAll(begun);
        await expect(
            finishPublish("user-b", { uploadId: begun.uploadId }, { now: NOW })
        ).rejects.toThrow("No such upload.");
        await expect(
            finishPublish(
                "user-a",
                { uploadId: begun.uploadId },
                { now: new Date(NOW.getTime() + PUBLISH_UPLOAD_TTL_MS + 1) }
            )
        ).rejects.toThrow(/expired/);
        // What an expired upload staged is cleared away.
        expect(store.under("games-staging/")).toEqual([]);

        memoryDocs.set("gamePublishers/user-c", {
            games: [],
            day: NOW.toISOString().slice(0, 10),
            releases: PUBLISH_MAX_RELEASES_PER_DAY,
            uploads: 1,
        });
        // The count is reached between begin and finish.
        memoryDocs.set("gamePublishers/user-c", {
            ...(memoryDocs.get("gamePublishers/user-c") as object),
            releases: 0,
        });
        const late = await beginPublish("user-c", inputFor("late-game"), {
            now: NOW,
        });
        sendAll(late);
        memoryDocs.set("gamePublishers/user-c", {
            ...(memoryDocs.get("gamePublishers/user-c") as object),
            releases: PUBLISH_MAX_RELEASES_PER_DAY,
        });
        store.calls.length = 0;
        await expect(
            finishPublish("user-c", { uploadId: late.uploadId }, { now: NOW })
        ).rejects.toThrow(/releases a day/);
        // Refused before anything was read or copied.
        expect(store.calls).toEqual([]);
        expect(store.under("games/")).toEqual([]);
    });

    test("a picture that is not a JPEG is left behind; the game is still published", async () => {
        const begun = await beginPublish("user-a", inputFor("my-game"), {
            now: NOW,
        });
        sendAll(begun);
        const { url, headers } = addresses(begun).find(
            (file) => file.path === "thumbnail.jpg"
        );
        expect(store.put(url, headers, "<svg onload=alert(1)>")).toBe(200);
        const { release } = await finishPublish(
            "user-a",
            { uploadId: begun.uploadId },
            { now: NOW }
        );
        expect(record("my-game").releases[0].thumbnail).toBeUndefined();
        expect(
            store.objects.has(`games/my-game/${release}/thumbnail.jpg`)
        ).toBe(false);
    });

    test("a store that fails says nothing of itself", async () => {
        store.fail(true);
        const failed = await beginPublish("user-a", inputFor("my-game"), {
            now: NOW,
        }).catch((error) => error);
        expect(failed.message).toMatch(/storage did not answer/);
        expect(failed.message).not.toMatch(/secret-bucket|on fire/);
        store.fail(false);
        const begun = await beginPublish("user-a", inputFor("my-game"), {
            now: NOW,
        });
        sendAll(begun);
        store.fail(true);
        const unfinished = await finishPublish(
            "user-a",
            { uploadId: begun.uploadId },
            { now: NOW }
        ).catch((error) => error);
        expect(unfinished.message).toMatch(/storage did not answer/);
        expect(unfinished.message).not.toMatch(/secret-bucket|on fire/);
        expect(record("my-game")).toBeUndefined();
        // The server's own log has what the store said.
        expect(logged).toHaveBeenCalledTimes(2);
    });
});

describe("the page and the releases route", () => {
    test("a release in the bucket is served with the release headers", async () => {
        const { release } = await publish("user-a", "my-game");
        const page: any = await getServerSideProps({
            params: { game: "my-game" },
            query: {},
        } as any);
        expect(page.props.frame).toEqual({
            src: `/api/games/releases/my-game/${release}/index.html`,
            release,
            source: "hosted",
        });
        store.calls.length = 0;
        const index = await fetchRelease(["my-game", release, "index.html"]);
        expect(index.status).toBe(200);
        expect(index.body).toBe(BUILD["index.html"]);
        expect(index.headers).toMatchObject({
            "content-type": "text/html; charset=utf-8",
            "content-length": Buffer.byteLength(BUILD["index.html"]),
            "access-control-allow-origin": "*",
            "cache-control": "public, max-age=31536000, immutable",
            "x-content-type-options": "nosniff",
        });
        // The game's policy, from the network.json it uploaded.
        expect(index.headers["content-security-policy"]).toContain(
            "https://cyber.mypinata.cloud"
        );
        expect(index.headers["content-security-policy"]).toMatch(
            new RegExp(`; ${SANDBOX}$`)
        );
        // No redirect, and no address in the bucket.
        expect(index.headers.location).toBeUndefined();
        expect(JSON.stringify(index.headers)).not.toMatch(/secret-bucket/);

        const script = await fetchRelease([
            "my-game",
            release,
            "assets",
            "a.js",
        ]);
        expect(script.headers["content-type"]).toBe("text/javascript");
        expect(script.body).toBe(BUILD["assets/a.js"]);
        // The policy was read once for the release, not once per file.
        expect(
            store.calls.filter((call) => /^read .*network\.json$/.test(call))
        ).toHaveLength(1);

        const head = await fetchRelease(
            ["my-game", release, "index.html"],
            "HEAD"
        );
        expect(head.status).toBe(200);
        expect(head.body).toBe("");
        expect(head.headers["content-length"]).toBe(
            Buffer.byteLength(BUILD["index.html"])
        );
        expect(head.headers["content-security-policy"]).toBe(
            index.headers["content-security-policy"]
        );
    });

    test("what is not this release's is a 404, and the bucket is not asked for it", async () => {
        const { release } = await publish("user-a", "my-game");
        await fetchRelease(["my-game", release, "index.html"]);
        store.set("games/squatter/0123456789abcdef/index.html", "hello");
        store.set(`games/my-game/${"0".repeat(16)}/index.html`, "hello");
        store.calls.length = 0;
        for (const path of [
            // Not a release its record lists; nobody's game.
            ["my-game", "0".repeat(16), "index.html"],
            ["squatter", "0123456789abcdef", "index.html"],
            // Not a path of a release.
            ["my-game", release, "..", "..", "squatter", "x"],
            ["my-game", release, "%2e%2e", "index.html"],
            ["my-game", release, ".hidden"],
            ["my-game", release, "a b.js"],
            ["my-game", release, "assets", ""],
            ["games-staging", release, "index.html"],
        ]) {
            const answer = await fetchRelease(path);
            expect([path, answer.status]).toEqual([path, 404]);
        }
        expect(store.calls).toEqual([]);
        // A file the release does not hold: asked for, and not there.
        const missing = await fetchRelease(["my-game", release, "missing.js"]);
        expect(missing.status).toBe(404);
        expect(missing.headers["cache-control"]).toBe("no-store");
        expect(missing.body).toBe("");
    });

    test("a failing bucket is a 502 with nothing of the bucket's in it, and is asked again", async () => {
        const { release } = await publish("user-a", "my-game");
        store.fail(true);
        const failed = await fetchRelease(["my-game", release, "index.html"]);
        expect(failed.status).toBe(502);
        expect(failed.body).toBe("");
        expect(failed.headers["cache-control"]).toBe("no-store");
        // No file is sent under a policy that was never read.
        expect(failed.headers["content-security-policy"]).toBeUndefined();
        store.fail(false);
        const index = await fetchRelease(["my-game", release, "index.html"]);
        expect(index.status).toBe(200);
        expect(index.headers["content-security-policy"]).toContain(
            "https://cyber.mypinata.cloud"
        );
    });

    test("a release with no declaration, or a malformed one, reaches only its own files", async () => {
        const { ["network.json"]: _dropped, ...bare } = BUILD;
        const none = await publish("user-a", "bare-game", bare);
        const broken = await publish("user-a", "broken-game", {
            ...BUILD,
            "network.json": "{ not json",
        });
        for (const [id, release] of [
            ["bare-game", none.release],
            ["broken-game", broken.release],
        ]) {
            const index = await fetchRelease([id, release, "index.html"]);
            expect(index.status).toBe(200);
            expect(index.headers["content-security-policy"]).toMatch(
                new RegExp(`; ${SANDBOX}$`)
            );
            expect(index.headers["content-security-policy"]).not.toContain(
                "mypinata"
            );
        }
    });

    test("the local folder comes first for a file it holds", async () => {
        const { release } = await publish("user-a", "my-game");
        process.env.GAMES_RELEASES_DIR = root;
        const folder = join(root, "my-game", release);
        require("fs").mkdirSync(folder, { recursive: true });
        require("fs").writeFileSync(join(folder, "index.html"), "from disk");
        expect(
            (await fetchRelease(["my-game", release, "index.html"])).body
        ).toBe("from disk");
        expect(
            (await fetchRelease(["my-game", release, "assets", "a.js"])).body
        ).toBe(BUILD["assets/a.js"]);
    });

    test("unpublish: nothing is served, the objects stay, and publishing again brings it back", async () => {
        const { release } = await publish("user-a", "my-game");
        expect(
            (await fetchRelease(["my-game", release, "index.html"])).status
        ).toBe(200);
        const held = store.under("games/").length;
        await unpublishGame("user-a", "my-game", NOW);
        store.calls.length = 0;
        expect(
            (await fetchRelease(["my-game", release, "index.html"])).status
        ).toBe(404);
        expect(store.calls).toEqual([]);
        expect(store.under("games/")).toHaveLength(held);
        // The id is still its owner's, and the release still stored.
        await expect(
            beginPublish("user-b", inputFor("my-game"), { now: NOW })
        ).rejects.toThrow(/another account's game/);
        const again = await beginPublish("user-a", inputFor("my-game"), {
            now: NOW,
        });
        expect(again.stored).toBe(true);
        await finishPublish(
            "user-a",
            { uploadId: again.uploadId },
            { now: NOW }
        );
        expect(
            (await fetchRelease(["my-game", release, "index.html"])).status
        ).toBe(200);
    });

    test("the kill switch, publishing off, or no bucket any more: not served", async () => {
        const { release } = await publish("user-a", "my-game");
        const status = async () =>
            (await fetchRelease(["my-game", release, "index.html"])).status;
        process.env.GAMES_DISABLED = `my-game@${release}`;
        expect(await status()).toBe(404);
        delete process.env.GAMES_DISABLED;
        process.env.GAMES_PUBLISHING = "off";
        expect(await status()).toBe(404);
        process.env.GAMES_PUBLISHING = "open";
        process.env.GAMES_PUBLISHING_STORAGE = "off";
        expect(await status()).toBe(404);
        delete process.env.GAMES_PUBLISHING_STORAGE;
        expect(await status()).toBe(200);
    });
});
