/** @jest-environment node */
import { createHash } from "crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { Readable, Writable } from "stream";

jest.mock("@utils/firebaseAdmin", () =>
    require("./memoryFirestore.jest").memoryFirebaseAdmin()
);
jest.mock("./pinnedGateway");

import jwt from "jsonwebtoken";
import { memoryDocs } from "./memoryFirestore.jest";
import { gatewayGet } from "./pinnedGateway";
import { pinataSigner, pinnedUploadsConfig } from "./pinnedUploads";
import {
    PUBLISH_MAX_GAMES,
    PUBLISH_MAX_RELEASES_PER_DAY,
    PUBLISH_THUMBNAIL_MAX,
    PUBLISH_UPLOAD_TTL_MS,
    publishBeginSchema,
    releaseIdOf,
} from "./publishedGames";
import {
    acceptUploadedFile,
    beginPublish,
    finishPublish,
    forgetPendingUploads,
    forgetPublishedGames,
    loadRegisteredGame,
    minePublished,
    unpublishGame,
} from "./publishedGamesServer";
import GamePublishService from "../../pages/api/_v2/gamePublish/index";
import uploadRoute, {
    config as uploadConfig,
} from "../../pages/api/games/uploads/[...path]";
import releasesRoute, {
    forgetPinnedPolicies,
} from "../../pages/api/games/releases/[...path]";
import { getServerSideProps } from "../../pages/games/[game]";

// The page's components are not under test; its server half is.
jest.mock("./GamePage", () => () => null);
jest.mock("./GameDeviceGate", () => () => null);
jest.mock("./GamePauseGate", () => () => null);

const get = gatewayGet as jest.MockedFunction<typeof gatewayGet>;
const CID = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
const GATEWAY = "https://gateway.example";
const SANDBOX = "sandbox allow-scripts allow-pointer-lock";
const NOW = new Date("2026-11-17T10:00:00.000Z");
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const SECRET = "test-session-key";

const sha256 = (bytes: any) => createHash("sha256").update(bytes).digest("hex");
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
const listOf = (build: Record<string, string>) =>
    Object.entries(build).map(([path, text]) => ({
        path,
        bytes: Buffer.byteLength(text),
        sha256: sha256(text),
    }));
const inputFor = (id: string, build = BUILD) => {
    const files = listOf(build);
    return publishBeginSchema.parse({
        id,
        manifest: { name: "My Game" },
        entry: {
            title: "My Game",
            tagline: "a small game",
            description: "A small game about walking around a quiet courtyard.",
            players: { min: 1, max: 4 },
            partySizes: [2, 3, 4],
            devices: ["desktop"],
            tags: ["arcade"],
            crowdLabel: "in the yard",
            room: "oncyber-bloom-garden-v1",
            relay: true,
        },
        files,
        check: {
            status: "passed",
            checkedAt: NOW.toISOString(),
            release: releaseIdOf(files),
        },
    });
};

const env = { ...process.env };
let root: string;
beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "published-games-"));
    process.env = {
        ...env,
        NODE_ENV: "production",
        GAMES_PREVIEW: "1",
        GAMES_PUBLISHING: "open",
        GAMES_RELEASES_DIR: root,
        SECRET_JWT_KEY: SECRET,
    } as any;
    delete process.env.GAMES_DISABLED;
    delete process.env.GAMES_PUBLISHING_PINATA;
    // No bucket here: mode `storage` has its own tests.
    delete process.env.GAMES_STORAGE_BUCKET;
    delete process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    memoryDocs.clear();
    forgetPublishedGames();
    forgetPendingUploads();
    forgetPinnedPolicies();
    get.mockReset();
});
afterEach(() => rmSync(root, { recursive: true, force: true }));
afterAll(() => {
    process.env = env;
});

const send = (
    owner: string,
    uploadId: string,
    path: string,
    bytes: any,
    more: { length?: number; now?: number } = {}
) =>
    acceptUploadedFile({
        owner,
        uploadId,
        path,
        body: Readable.from([Buffer.from(bytes)]),
        now: NOW.getTime(),
        ...more,
    });

/** begin, every file, finish: as the command does. */
async function publish(owner: string, id: string, build = BUILD, now = NOW) {
    const begun = await beginPublish(owner, inputFor(id, build), { now });
    for (const [path, text] of Object.entries(build))
        expect(
            (
                await send(owner, begun.uploadId, path, text, {
                    now: now.getTime(),
                })
            ).status
        ).toBe(200);
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
const page = (id: string) =>
    getServerSideProps({
        params: { game: id },
        query: {},
    } as any) as Promise<any>;

describe("mode site, end to end", () => {
    test("begin, upload, finish: the release is stored whole and the game registered", async () => {
        const begun = await beginPublish("user-a", inputFor("my-game"), {
            now: NOW,
        });
        const release = releaseIdOf(listOf(BUILD));
        expect(begun).toEqual({
            uploadId: expect.stringMatching(/^[A-Za-z0-9_-]{24}$/),
            release,
            stored: false,
            upload: {
                mode: "site",
                url: `/api/games/uploads/${begun.uploadId}/`,
            },
        });
        // Nothing is registered, or served, before finish.
        expect(memoryDocs.has("publishedGames/my-game")).toBe(false);
        for (const [path, text] of Object.entries(BUILD))
            expect(await send("user-a", begun.uploadId, path, text)).toEqual({
                status: 200,
                path,
                bytes: Buffer.byteLength(text),
                sha256: sha256(text),
            });
        expect(existsSync(join(root, "my-game"))).toBe(false);
        expect(
            (await fetchRelease(["my-game", release, "index.html"])).status
        ).toBe(404);
        forgetPublishedGames();

        expect(
            await send("user-a", begun.uploadId, "thumbnail.jpg", JPEG)
        ).toMatchObject({ status: 200 });
        expect(
            await finishPublish(
                "user-a",
                { uploadId: begun.uploadId },
                { now: NOW }
            )
        ).toEqual({
            id: "my-game",
            release,
            url: "/games/my-game",
            status: "unlisted",
        });

        const folder = join(root, "my-game", release);
        for (const [path, text] of Object.entries(BUILD)) {
            expect(readFileSync(join(folder, path), "utf8")).toBe(text);
            // A release never changes.
            expect(statSync(join(folder, path)).mode & 0o222).toBe(0);
        }
        expect(
            JSON.parse(
                readFileSync(join(folder, "oncyber-release.json"), "utf8")
            )
        ).toEqual({
            version: 1,
            game: "my-game",
            release,
            files: listOf(BUILD),
        });
        expect(existsSync(join(root, ".uploads", begun.uploadId))).toBe(false);
        expect(memoryDocs.has(`gameUploads/${begun.uploadId}`)).toBe(false);
        expect(memoryDocs.get("publishedGames/my-game")).toEqual({
            id: "my-game",
            owner: "user-a",
            status: "unlisted",
            entry: {
                title: "My Game",
                tagline: "a small game",
                description:
                    "A small game about walking around a quiet courtyard.",
                players: { min: 1, max: 4 },
                partySizes: [2, 3, 4],
                devices: ["desktop"],
                tags: ["arcade"],
                crowdLabel: "in the yard",
            },
            current: release,
            releases: [
                {
                    release,
                    backend: "local",
                    publishedAt: NOW.toISOString(),
                    files: 4,
                    bytes: listOf(BUILD).reduce((sum, f) => sum + f.bytes, 0),
                    check: "self-reported",
                    thumbnail: true,
                },
            ],
            createdAt: NOW.toISOString(),
            updatedAt: NOW.toISOString(),
        });
        expect(await minePublished("user-a", NOW)).toEqual([
            {
                id: "my-game",
                title: "My Game",
                status: "unlisted",
                release,
                publishedAt: NOW.toISOString(),
                url: "/games/my-game",
            },
        ]);
        expect(await minePublished("user-b", NOW)).toEqual([]);
        // The upload is used up.
        await expect(
            finishPublish("user-a", { uploadId: begun.uploadId }, { now: NOW })
        ).rejects.toThrow(/No such upload/);
    });

    test("the same release again needs no upload; a new one becomes current", async () => {
        const first = await publish("user-a", "my-game");
        const again = await beginPublish("user-a", inputFor("my-game"), {
            now: NOW,
        });
        expect(again.stored).toBe(true);
        expect(
            await finishPublish(
                "user-a",
                { uploadId: again.uploadId },
                { now: NOW }
            )
        ).toMatchObject({ release: first.release });
        const changed = { ...BUILD, "assets/a.js": "export default 2" };
        const second = await publish("user-a", "my-game", changed);
        expect(second.release).not.toBe(first.release);
        const record = memoryDocs.get("publishedGames/my-game");
        expect(record.current).toBe(second.release);
        expect(record.releases.map((r: any) => r.release)).toEqual([
            first.release,
            second.release,
        ]);
        expect(memoryDocs.get("gamePublishers/user-a")).toMatchObject({
            games: ["my-game"],
            releases: 2,
            uploads: 3,
        });
    });

    test("a release folder holding other bytes is never taken for this release", async () => {
        const { release } = await publish("user-a", "my-game");
        const file = join(root, "my-game", release, "assets/a.js");
        rmSync(file, { force: true });
        require("fs").writeFileSync(file, "export default 9");
        const begun = await beginPublish("user-a", inputFor("my-game"), {
            now: NOW,
        });
        // Same sizes, so begin cannot tell; finish hashes every file.
        await expect(
            finishPublish("user-a", { uploadId: begun.uploadId }, { now: NOW })
        ).rejects.toThrow(/wrong contents/);
    });
});

describe("what an upload refuses", () => {
    let uploadId: string;
    beforeEach(async () => {
        ({ uploadId } = await beginPublish("user-a", inputFor("my-game"), {
            now: NOW,
        }));
    });
    const staged = () => join(root, ".uploads", uploadId);

    test("another account's upload, or none", async () => {
        expect(
            await send("user-b", uploadId, "index.html", BUILD["index.html"])
        ).toMatchObject({ status: 404 });
        expect(
            await send("user-a", "x".repeat(24), "index.html", "x")
        ).toMatchObject({ status: 404 });
        expect(
            await send("user-a", "../../etc", "index.html", "x")
        ).toMatchObject({ status: 404 });
        expect(existsSync(staged())).toBe(false);
    });

    test.each([
        "evil.js",
        "../index.html",
        "../../../my-game/x/index.html",
        "assets/../index.html",
        "/etc/passwd",
        "assets/a.js/",
        "ASSETS/a.js",
        "index.html\u0000.js",
        "oncyber-release.json",
        "release.json",
        "",
    ])("a path that was not listed: %j", async (path) => {
        expect(await send("user-a", uploadId, path, "x")).toMatchObject({
            status: 404,
        });
        expect(existsSync(staged())).toBe(false);
    });

    test("other bytes, more bytes or fewer bytes than were listed", async () => {
        const text = BUILD["assets/a.js"];
        const same = "x".repeat(text.length);
        expect(
            await send("user-a", uploadId, "assets/a.js", same)
        ).toMatchObject({ status: 422 });
        expect(
            await send("user-a", uploadId, "assets/a.js", text + "!")
        ).toMatchObject({ status: 413 });
        expect(
            await send("user-a", uploadId, "assets/a.js", text.slice(1))
        ).toMatchObject({ status: 422 });
        // A Content-Length that is not the listed size is refused unread.
        let read = false;
        const body = new Readable({
            read() {
                read = true;
                this.push(null);
            },
        });
        expect(
            await acceptUploadedFile({
                owner: "user-a",
                uploadId,
                path: "assets/a.js",
                body,
                length: text.length + 1,
                now: NOW.getTime(),
            })
        ).toMatchObject({ status: 413 });
        expect(read).toBe(false);
        // Nothing refused is left behind.
        expect(existsSync(join(staged(), "files", "assets", "a.js"))).toBe(
            false
        );
        expect(
            require("fs")
                .readdirSync(staged())
                .filter((name: string) => name.startsWith(".part-"))
        ).toEqual([]);
    });

    test("a body that never ends is cut off at the listed size", async () => {
        let sent = 0;
        const endless = new Readable({
            read() {
                sent += 1024;
                this.push(Buffer.alloc(1024, 1));
            },
        });
        expect(
            await acceptUploadedFile({
                owner: "user-a",
                uploadId,
                path: "index.html",
                body: endless,
                now: NOW.getTime(),
            })
        ).toMatchObject({ status: 413 });
        expect(sent).toBeLessThan(64 * 1024 * 4);
        expect(endless.destroyed).toBe(true);
    });

    test("a thumbnail that is not a JPEG, or is too large", async () => {
        expect(
            await send(
                "user-a",
                uploadId,
                "thumbnail.jpg",
                "<svg onload=alert(1)>"
            )
        ).toMatchObject({ status: 422 });
        expect(
            await send(
                "user-a",
                uploadId,
                "thumbnail.jpg",
                Buffer.concat([
                    JPEG,
                    Buffer.alloc(PUBLISH_THUMBNAIL_MAX),
                ] as any)
            )
        ).toMatchObject({ status: 413 });
        expect(existsSync(join(staged(), "thumbnail.jpg"))).toBe(false);
    });

    test("an upload past its half hour", async () => {
        const late = NOW.getTime() + PUBLISH_UPLOAD_TTL_MS + 1;
        expect(
            await send("user-a", uploadId, "index.html", BUILD["index.html"], {
                now: late,
            })
        ).toMatchObject({ status: 410 });
        await expect(
            finishPublish("user-a", { uploadId }, { now: new Date(late) })
        ).rejects.toThrow(/expired/);
    });

    test("a server with no releases folder", async () => {
        delete process.env.GAMES_RELEASES_DIR;
        expect(
            await send("user-a", uploadId, "index.html", BUILD["index.html"])
        ).toMatchObject({ status: 409 });
        await expect(
            beginPublish("user-a", inputFor("other-game"), { now: NOW })
        ).rejects.toThrow(/not available on this server/);
    });

    test("finish with files missing registers nothing", async () => {
        await send("user-a", uploadId, "index.html", BUILD["index.html"]);
        await expect(
            finishPublish("user-a", { uploadId }, { now: NOW })
        ).rejects.toThrow(/not complete: assets\/a\.js was not uploaded/);
        await expect(
            finishPublish("user-b", { uploadId }, { now: NOW })
        ).rejects.toThrow(/No such upload/);
        expect(memoryDocs.has("publishedGames/my-game")).toBe(false);
        expect(existsSync(join(root, "my-game"))).toBe(false);
    });
});

describe("ids, ownership and limits", () => {
    test("an id of the catalog, or a build that is not a release", async () => {
        await expect(
            beginPublish(
                "user-a",
                { ...inputFor("my-game"), id: "ace" },
                { now: NOW }
            )
        ).rejects.toThrow(/catalog/);
        const input = inputFor("my-game");
        await expect(
            beginPublish(
                "user-a",
                {
                    ...input,
                    files: [
                        ...input.files,
                        { path: "../x.js", bytes: 1, sha256: "a".repeat(64) },
                    ],
                },
                { now: NOW }
            )
        ).rejects.toThrow(/plain relative path/);
        // A check of other files than the ones listed.
        await expect(
            beginPublish(
                "user-a",
                {
                    ...input,
                    check: { ...input.check, release: "0".repeat(16) },
                },
                { now: NOW }
            )
        ).rejects.toThrow(/check result is for other files/);
        expect(memoryDocs.size).toBe(0);
    });

    test("an id is its first publisher's, also after unpublish, and also mid-upload", async () => {
        // Two accounts begin for a free id; the first to finish holds it.
        const racing = await beginPublish("user-b", inputFor("my-game"), {
            now: NOW,
        });
        for (const [path, text] of Object.entries(BUILD))
            await send("user-b", racing.uploadId, path, text);
        const { release } = await publish("user-a", "my-game");
        await expect(
            finishPublish("user-b", { uploadId: racing.uploadId }, { now: NOW })
        ).rejects.toThrow(/another account's game/);
        await expect(
            beginPublish("user-b", inputFor("my-game"), { now: NOW })
        ).rejects.toThrow(/another account's game/);
        await expect(unpublishGame("user-b", "my-game", NOW)).rejects.toThrow(
            /not a game of this account/
        );
        expect(await unpublishGame("user-a", "my-game", NOW)).toEqual({
            id: "my-game",
            status: "unpublished",
        });
        await expect(
            beginPublish("user-b", inputFor("my-game"), { now: NOW })
        ).rejects.toThrow(/another account's game/);
        expect(memoryDocs.get("publishedGames/my-game")).toMatchObject({
            owner: "user-a",
            status: "unpublished",
            current: release,
        });
        // The owner publishes again and it is back.
        expect((await publish("user-a", "my-game")).status).toBe("unlisted");
    });

    test("a record that cannot be read is nobody's to take", async () => {
        memoryDocs.set("publishedGames/my-game", { owner: "user-a" });
        await expect(
            beginPublish("user-b", inputFor("my-game"), { now: NOW })
        ).rejects.toThrow(/cannot be published to/);
    });

    test("ten games an account", async () => {
        for (let i = 0; i < PUBLISH_MAX_GAMES; i++)
            await publish("user-a", `game-${i}x`, {
                ...BUILD,
                "assets/a.js": `export default ${i}`,
            });
        await expect(
            beginPublish("user-a", inputFor("one-more"), { now: NOW })
        ).rejects.toThrow(/at most 10 games/);
        // Another release of one it holds is fine, and so is another account.
        await publish("user-a", "game-0x", { ...BUILD, "credits.json": "[]" });
        await publish("user-b", "one-more");
        expect((await minePublished("user-a", NOW)).length).toBe(10);
    });

    test("twenty releases a day", async () => {
        memoryDocs.set("gamePublishers/user-a", {
            games: ["my-game"],
            day: "2026-11-17",
            releases: PUBLISH_MAX_RELEASES_PER_DAY - 1,
            uploads: 0,
        });
        await publish("user-a", "my-game");
        await expect(
            beginPublish("user-a", inputFor("my-game"), { now: NOW })
        ).rejects.toThrow(/20 releases a day/);
        const tomorrow = new Date("2026-11-18T10:00:00.000Z");
        await publish(
            "user-a",
            "my-game",
            { ...BUILD, "credits.json": "[]" },
            tomorrow
        );
        expect(memoryDocs.get("gamePublishers/user-a")).toMatchObject({
            day: "2026-11-18",
            releases: 1,
        });
    });

    test("uploads nobody finished are cleared away", async () => {
        const old = await beginPublish("user-a", inputFor("my-game"), {
            now: NOW,
        });
        await send("user-a", old.uploadId, "index.html", BUILD["index.html"]);
        expect(existsSync(join(root, ".uploads", old.uploadId))).toBe(true);
        // Real time decides: the folder was written just now.
        await beginPublish("user-a", inputFor("my-game"), {
            now: new Date(Date.now() + PUBLISH_UPLOAD_TTL_MS * 2 + 60_000),
        });
        expect(existsSync(join(root, ".uploads", old.uploadId))).toBe(false);
    });
});

describe("the procedures", () => {
    const call = (name: string, userId: string | undefined, input?: unknown) =>
        (GamePublishService as any)[name].call({ userId }, input);
    const opts = (name: string) => (GamePublishService as any)[name]._RPC_OPTS;

    test("every procedure needs a session", () => {
        for (const name of ["begin", "finish", "mine", "unpublish"])
            expect(opts(name).auth).toBe(true);
        expect((GamePublishService as any).auth).toBe(true);
        expect((GamePublishService as any).cors).toBe(false);
    });

    test("schemas refuse what the rules refuse", () => {
        const input = inputFor("my-game");
        expect(opts("begin").schema.safeParse(input).success).toBe(true);
        expect(
            opts("begin").schema.safeParse({
                ...input,
                check: { ...input.check, status: "failed" },
            }).success
        ).toBe(false);
        expect(
            opts("finish").schema.safeParse({ uploadId: "../x" }).success
        ).toBe(false);
        expect(opts("finish").schema.safeParse({}).success).toBe(false);
        expect(opts("unpublish").schema.safeParse({ id: "../x" }).success).toBe(
            false
        );
        expect(opts("mine").schema.safeParse(undefined).success).toBe(true);
    });

    test("publishing off: nothing answers", async () => {
        delete process.env.GAMES_PUBLISHING;
        for (const [name, input] of [
            ["begin", inputFor("my-game")],
            ["finish", { uploadId: "x".repeat(24) }],
            ["mine", undefined],
            ["unpublish", { id: "my-game" }],
        ] as const)
            await expect(call(name, "user-a", input)).rejects.toThrow(
                "Not found"
            );
        // And where game pages are hidden.
        process.env.GAMES_PUBLISHING = "open";
        delete process.env.GAMES_PREVIEW;
        await expect(call("mine", "user-a")).rejects.toThrow("Not found");
        expect(memoryDocs.size).toBe(0);
    });

    test("a list of accounts: only they publish", async () => {
        process.env.GAMES_PUBLISHING = "user-a";
        await expect(
            call("begin", "user-b", inputFor("my-game"))
        ).rejects.toThrow(/may not publish/);
        await expect(call("mine", undefined)).rejects.toThrow("Unauthorized");
        const begun = await call("begin", "user-a", inputFor("my-game"));
        expect(begun.upload.mode).toBe("site");
        expect(await call("mine", "user-a")).toEqual([]);
    });
});

describe("the upload route", () => {
    const token = (user: string) => jwt.sign({ user }, SECRET);
    async function put(
        path: string[],
        bytes: string,
        headers: Record<string, string> = {},
        more: object = {}
    ) {
        const req: any = Readable.from([Buffer.from(bytes)]);
        req.method = "PUT";
        req.query = { path };
        req.headers = headers;
        Object.assign(req, more);
        let status = 0;
        let body: any;
        const sent: Record<string, unknown> = {};
        const res: any = {
            setHeader: (name: string, value: unknown) =>
                void (sent[name.toLowerCase()] = value),
            status: (code: number) => ((status = code), res),
            json: (value: unknown) => void (body = value),
            end: () => {},
        };
        await uploadRoute(req, res);
        return { status, body, headers: sent };
    }
    let uploadId: string;
    beforeEach(async () => {
        ({ uploadId } = await beginPublish("user-a", inputFor("my-game"), {
            now: new Date(),
        }));
    });
    const bearer = (user: string) => ({
        authorization: `Bearer ${token(user)}`,
    });

    test("the body is never parsed", () => {
        expect(uploadConfig).toEqual({ api: { bodyParser: false } });
    });

    test("a file with the owner's token is stored for the upload", async () => {
        const text = BUILD["index.html"];
        const answer = await put([uploadId, "index.html"], text, {
            ...bearer("user-a"),
            "content-length": String(text.length),
        });
        expect(answer).toEqual({
            status: 200,
            body: {
                path: "index.html",
                bytes: text.length,
                sha256: sha256(text),
            },
            headers: { "cache-control": "no-store" },
        });
        expect(
            readFileSync(
                join(root, ".uploads", uploadId, "files", "index.html"),
                "utf8"
            )
        ).toBe(text);
        // A path in folders arrives as segments.
        expect(
            (
                await put(
                    [uploadId, "assets", "a.js"],
                    BUILD["assets/a.js"],
                    bearer("user-a")
                )
            ).status
        ).toBe(200);
    });

    test("the token comes in the Authorization header, never a cookie, query or body", async () => {
        const text = BUILD["index.html"];
        const good = token("user-a");
        expect((await put([uploadId, "index.html"], text)).status).toBe(401);
        expect(
            (await put([uploadId, "index.html"], text, { authorization: good }))
                .status
        ).toBe(401);
        expect(
            (
                await put([uploadId, "index.html"], text, {
                    authorization: "Bearer nope",
                })
            ).status
        ).toBe(401);
        expect(
            (
                await put(
                    [uploadId, "index.html"],
                    text,
                    {},
                    {
                        cookies: { _CCA: "user-a", "user-a": good },
                        query: { path: [uploadId, "index.html"], token: good },
                        body: { token: good },
                    }
                )
            ).status
        ).toBe(401);
        expect(
            (
                await put([uploadId, "index.html"], text, {
                    authorization: `Bearer ${jwt.sign(
                        { user: "user-a" },
                        "another-key"
                    )}`,
                })
            ).status
        ).toBe(401);
    });

    test("what it refuses", async () => {
        const text = BUILD["index.html"];
        expect(
            (await put([uploadId, "index.html"], text, bearer("user-b"))).status
        ).toBe(404);
        expect(
            (
                await put(
                    [uploadId, "..", "..", "pointers.json"],
                    text,
                    bearer("user-a")
                )
            ).status
        ).toBe(404);
        expect(
            (await put([uploadId, "../index.html"], text, bearer("user-a")))
                .status
        ).toBe(404);
        expect((await put([uploadId], text, bearer("user-a"))).status).toBe(
            404
        );
        expect(
            (await put(["nope", "index.html"], text, bearer("user-a"))).status
        ).toBe(404);
        expect(
            (
                await put(
                    [uploadId, "index.html"],
                    "other bytes",
                    bearer("user-a")
                )
            ).status
        ).toBe(422);
        expect(
            (
                await put([uploadId, "index.html"], text, bearer("user-a"), {
                    method: "POST",
                })
            ).status
        ).toBe(405);
        process.env.GAMES_PUBLISHING = "user-b";
        expect(
            (await put([uploadId, "index.html"], text, bearer("user-a"))).status
        ).toBe(403);
        delete process.env.GAMES_PUBLISHING;
        expect(
            (await put([uploadId, "index.html"], text, bearer("user-a"))).status
        ).toBe(404);
    });
});

describe("the page and the releases route", () => {
    test("a published game has a page, with the site's rooms and its release's frame", async () => {
        const { release } = await publish("user-a", "my-game");
        expect(await page("my-game")).toEqual({
            props: {
                // Nobody is signed in here: the page starts as a guest's.
                authenticated: false,
                game: {
                    id: "my-game",
                    title: "My Game",
                    tagline: "a small game",
                    description:
                        "A small game about walking around a quiet courtyard.",
                    thumbnail: "",
                    players: { min: 1, max: 4 },
                    partySizes: [2, 3, 4],
                    devices: ["desktop"],
                    tags: ["arcade"],
                    room: null,
                    relay: false,
                    socialRoom: "oncyber-my-game-social-v1",
                    crowdLabel: "in the yard",
                    registered: true,
                },
                frame: {
                    src: `/api/games/releases/my-game/${release}/index.html`,
                    release,
                    source: "hosted",
                },
                pause: { paused: false, releases: [] },
                lobbyWorld: true,
            },
        });
        expect(await page("nobody-published-this")).toEqual({ notFound: true });
        // A catalogued game is still the catalog's.
        expect(
            (await page("lantern-tag")).props.game.registered
        ).toBeUndefined();
    });

    test("its release is served with the release headers, from the local folder", async () => {
        const { release } = await publish("user-a", "my-game");
        const index = await fetchRelease(["my-game", release, "index.html"]);
        expect(index.status).toBe(200);
        expect(index.body).toBe(BUILD["index.html"]);
        expect(index.headers).toMatchObject({
            "content-type": "text/html; charset=utf-8",
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
        expect(
            (await fetchRelease(["my-game", release, "assets", "a.js"]))
                .headers["content-type"]
        ).toBe("text/javascript");
        // Not a release its record lists; not the staging folder.
        for (const path of [
            ["my-game", "0".repeat(16), "index.html"],
            ["my-game", release, "..", "..", "pointers.json"],
            [".uploads", release, "index.html"],
            ["my-game", release, "missing.js"],
        ]) {
            const answer = await fetchRelease(path);
            expect([path, answer.status]).toEqual([path, 404]);
            expect(get).not.toHaveBeenCalled();
        }
    });

    test("files in the folder under an id nobody registered are not served", async () => {
        const { release } = await publish("user-a", "my-game");
        require("fs").cpSync(join(root, "my-game"), join(root, "squatter"), {
            recursive: true,
        });
        expect(
            (await fetchRelease(["squatter", release, "index.html"])).status
        ).toBe(404);
    });

    test("unpublish: the page is gone and the release stops being served", async () => {
        const { release } = await publish("user-a", "my-game");
        expect(
            (await fetchRelease(["my-game", release, "index.html"])).status
        ).toBe(200);
        await unpublishGame("user-a", "my-game", NOW);
        expect(await page("my-game")).toEqual({ notFound: true });
        const gone = await fetchRelease(["my-game", release, "index.html"]);
        expect(gone.status).toBe(404);
        expect(gone.headers["cache-control"]).toBe("no-store");
        expect(await loadRegisteredGame("my-game")).toBeNull();
    });

    test("the kill switch stops a registered game: the page pauses and the route refuses", async () => {
        const { release } = await publish("user-a", "my-game");
        process.env.GAMES_DISABLED = "my-game";
        expect((await page("my-game")).props.pause).toEqual({
            paused: true,
            releases: [],
        });
        expect(
            (await fetchRelease(["my-game", release, "index.html"])).status
        ).toBe(404);
        // One release of it.
        process.env.GAMES_DISABLED = `ace, my-game@${release}`;
        expect((await page("my-game")).props.pause.paused).toBe(true);
        expect(
            (await fetchRelease(["my-game", release, "index.html"])).status
        ).toBe(404);
        process.env.GAMES_DISABLED = `my-game@${"0".repeat(16)}`;
        expect((await page("my-game")).props.pause.paused).toBe(false);
        expect(
            (await fetchRelease(["my-game", release, "index.html"])).status
        ).toBe(200);
    });

    test("publishing off, or game pages hidden: registered games are not served", async () => {
        const { release } = await publish("user-a", "my-game");
        delete process.env.GAMES_PUBLISHING;
        forgetPublishedGames();
        expect(await page("my-game")).toEqual({ notFound: true });
        expect(
            (await fetchRelease(["my-game", release, "index.html"])).status
        ).toBe(404);
        process.env.GAMES_PUBLISHING = "open";
        delete process.env.GAMES_PREVIEW;
        expect(await page("my-game")).toEqual({ notFound: true });
        expect(
            (await fetchRelease(["my-game", release, "index.html"])).status
        ).toBe(404);
    });

    test("the registry is asked once per game for a while, not once per file", async () => {
        const { release } = await publish("user-a", "my-game");
        const admin = require("@utils/firebaseAdmin");
        const collection = jest.spyOn(admin.db, "collection");
        for (const path of ["index.html", "assets/a.js", "credits.json"])
            await fetchRelease(["my-game", release, ...path.split("/")]);
        expect(collection).toHaveBeenCalledTimes(1);
        collection.mockRestore();
    });
});

describe("mode pinata, against a stand-in", () => {
    const base = `${GATEWAY}/ipfs/${CID}/`;
    const signer = {
        sign: jest.fn(async () => "https://uploads.example/signed?x=1"),
    };
    const pinned = { signer, gateway: GATEWAY };
    /** What the stand-in gateway holds, by URL. */
    let held: Record<string, string>;
    beforeEach(() => {
        delete process.env.GAMES_RELEASES_DIR;
        signer.sign.mockClear();
        held = Object.fromEntries(
            Object.entries(BUILD).map(([path, text]) => [
                `${base}${path}`,
                text,
            ])
        );
        get.mockImplementation(async (url) => ({
            status: held[url.href] === undefined ? 404 : 200,
            headers: {},
            body: Readable.from([Buffer.from(held[url.href] ?? "not found")]),
        }));
    });

    test("off unless a person switched it on, whatever keys are set", () => {
        const keys = {
            PINATA_JWT_KEY: "key",
            GAMES_RELEASES_GATEWAY: `${GATEWAY}/`,
        };
        expect(pinnedUploadsConfig(keys)).toBeNull();
        expect(
            pinnedUploadsConfig({ ...keys, GAMES_PUBLISHING_PINATA: "car" })
                ?.gateway
        ).toBe(GATEWAY);
        expect(
            pinnedUploadsConfig({
                GAMES_PUBLISHING_PINATA: "car",
                GAMES_RELEASES_GATEWAY: GATEWAY,
            })
        ).toBeNull();
        expect(
            pinnedUploadsConfig({
                ...keys,
                GAMES_PUBLISHING_PINATA: "car",
                GAMES_RELEASES_GATEWAY: "http://gateway.example",
            })
        ).toBeNull();
    });

    test("without it, begin says the mode is not available here", async () => {
        process.env.PINATA_JWT_KEY = "key";
        process.env.GAMES_RELEASES_GATEWAY = GATEWAY;
        await expect(
            beginPublish("user-a", inputFor("my-game"), { now: NOW })
        ).rejects.toThrow(/not available on this server/);
        delete process.env.PINATA_JWT_KEY;
        delete process.env.GAMES_RELEASES_GATEWAY;
    });

    test("the signer asks the storage for one short-lived address and sends no key on", async () => {
        const fetcher = jest.fn(async () => ({
            ok: true,
            json: async () => ({ data: "https://uploads.example/signed?x=1" }),
        }));
        const url = await pinataSigner({
            jwt: "key",
            fetch: fetcher as any,
        }).sign({
            name: "game-my-game-1",
            maxBytes: 100,
            expiresSeconds: 1800,
        });
        expect(url).toBe("https://uploads.example/signed?x=1");
        expect(url).not.toContain("key");
        expect(fetcher).toHaveBeenCalledTimes(1);
        const [asked, init] = fetcher.mock.calls[0] as any;
        expect(asked).toBe("https://uploads.pinata.cloud/v3/files/sign");
        expect(init.headers.Authorization).toBe("Bearer key");
        expect(JSON.parse(init.body)).toEqual({
            network: "public",
            expires: 1800,
            filename: "game-my-game-1",
            max_file_size: 100,
        });
        for (const answer of [
            { ok: false, status: 401, json: async () => ({}) },
            { ok: true, json: async () => ({}) },
            {
                ok: true,
                json: async () => ({ data: "http://plain.example/x" }),
            },
            { ok: true, json: async () => ({ data: { url: "x" } }) },
        ])
            await expect(
                pinataSigner({
                    jwt: "key",
                    fetch: (async () => answer) as any,
                }).sign({
                    name: "x",
                    maxBytes: 1,
                    expiresSeconds: 1,
                })
            ).rejects.toThrow();
    });

    test("begin hands out the address; finish reads every file back before it registers", async () => {
        const begun = await beginPublish("user-a", inputFor("my-game"), {
            now: NOW,
            pinned,
        });
        expect(begun).toMatchObject({
            stored: false,
            upload: {
                mode: "pinata",
                url: "https://uploads.example/signed?x=1",
                expires: 1800,
                as: "car",
            },
        });
        expect(signer.sign).toHaveBeenCalledWith({
            name: `game-my-game-${begun.release}`,
            maxBytes: 32 * 1024 * 1024,
            expiresSeconds: 1800,
        });
        // The site route takes nothing for this upload.
        process.env.GAMES_RELEASES_DIR = root;
        expect(
            await send(
                "user-a",
                begun.uploadId,
                "index.html",
                BUILD["index.html"]
            )
        ).toMatchObject({ status: 409 });
        delete process.env.GAMES_RELEASES_DIR;

        const finish = (address?: string) =>
            finishPublish(
                "user-a",
                { uploadId: begun.uploadId, address },
                { now: NOW, pinned }
            );
        await expect(finish()).rejects.toThrow(/needs the address/);
        await expect(finish("not-a-cid")).rejects.toThrow(/needs the address/);
        await expect(finish("../../x")).rejects.toThrow(/needs the address/);
        expect(get).not.toHaveBeenCalled();

        // Other bytes, a missing file, a longer file: nothing is registered.
        held[`${base}assets/a.js`] = "export default 2";
        await expect(finish(CID)).rejects.toThrow(
            /not the one that was checked: assets\/a\.js \(SHA-256 differs\)/
        );
        delete held[`${base}assets/a.js`];
        await expect(finish(CID)).rejects.toThrow(/gateway answered 404/);
        held[`${base}assets/a.js`] = BUILD["assets/a.js"] + "x".repeat(1000);
        await expect(finish(CID)).rejects.toThrow(/longer than/);
        expect(memoryDocs.has("publishedGames/my-game")).toBe(false);

        held[`${base}assets/a.js`] = BUILD["assets/a.js"];
        get.mockClear();
        expect(await finish(CID)).toMatchObject({
            id: "my-game",
            status: "unlisted",
        });
        expect(get.mock.calls.map(([url]) => url.href).sort()).toEqual(
            Object.keys(BUILD)
                .map((path) => `${base}${path}`)
                .sort()
        );
        expect(memoryDocs.get("publishedGames/my-game").releases).toEqual([
            {
                release: begun.release,
                backend: "pinata",
                address: CID,
                base,
                publishedAt: NOW.toISOString(),
                files: 4,
                bytes: expect.any(Number),
                check: "self-reported",
            },
        ]);

        // The releases route serves it from the record's gateway folder.
        forgetPublishedGames();
        const index = await fetchRelease([
            "my-game",
            begun.release,
            "index.html",
        ]);
        expect(index.status).toBe(200);
        expect(index.body).toBe(BUILD["index.html"]);
        expect(index.headers["content-security-policy"]).toMatch(
            /https:\/\/cyber\.mypinata\.cloud.*; sandbox allow-scripts allow-pointer-lock$/
        );
        expect(index.headers["access-control-allow-origin"]).toBe("*");
        // A record whose base was changed by hand is not fetched from.
        const record = memoryDocs.get("publishedGames/my-game");
        record.releases[0].base = "https://169.254.169.254/ipfs/x/";
        forgetPublishedGames();
        get.mockClear();
        expect(
            (await fetchRelease(["my-game", begun.release, "index.html"]))
                .status
        ).toBe(404);
        expect(get).not.toHaveBeenCalled();
    });
});
