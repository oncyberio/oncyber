import assert from "node:assert/strict";
import test from "node:test";
import {
    chmodSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
    currentRelease,
    HISTORY,
    pointTo,
    readPointers,
    rollback,
    unpoint,
    writePointers,
} from "../pointer.mjs";
import { publishRelease, releaseTarget } from "../publish.mjs";
import { serveReleases } from "../serve.mjs";
import { hostedReleaseStage } from "../stage.mjs";
import {
    listBuild,
    localFolderStorage,
    pinataStorage,
    RELEASE_MANIFEST,
    releaseId,
    sha256,
    verifyRelease,
} from "../storage.mjs";
// The page's own reader: what the scripts write, the page must accept.
import { resolveGameFrame } from "../../../../frontend/features/games/gameRelease.ts";

const scratch = (t) => {
    const dir = mkdtempSync(join(tmpdir(), "releases-test-"));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    return dir;
};
function build(dir, files) {
    for (const [path, text] of Object.entries(files)) {
        mkdirSync(dirname(join(dir, path)), { recursive: true });
        writeFileSync(join(dir, path), text);
    }
    return listBuild(dir);
}
const GAME = {
    "index.html": "<script type=module src=./assets/a.js></script>",
    "assets/a.js": "export default 1",
    "check.json": "{}",
    "release.json": "{}",
};

test("a release id is a hash of the files, whatever their order", (t) => {
    const files = build(join(scratch(t), "v1"), GAME);
    assert.deepEqual(
        files.map((f) => f.path),
        ["assets/a.js", "index.html"],
        "reports are not part of a release"
    );
    assert.match(releaseId(files), /^[0-9a-f]{16}$/);
    assert.equal(releaseId([...files].reverse()), releaseId(files));
    assert.notEqual(
        releaseId(
            build(join(scratch(t), "v2"), {
                ...GAME,
                "assets/a.js": "export default 2",
            })
        ),
        releaseId(files)
    );
});

test("local storage: stores once, verifies, and never changes a release", async (t) => {
    const root = scratch(t),
        dir = join(root, "build");
    const files = build(dir, GAME),
        release = releaseId(files);
    const storage = localFolderStorage({ root: join(root, "store") });
    const stored = await storage.put({ game: "ace", release, dir, files });
    assert.equal(stored.base, `/api/games/releases/ace/${release}/`);
    assert.deepEqual(
        await verifyRelease(storage, { game: "ace", release }, files),
        { files: 2, problems: [] }
    );
    assert.equal(
        JSON.parse(
            await storage.read({ game: "ace", release }, RELEASE_MANIFEST)
        ).release,
        release
    );

    // Same files again: accepted, nothing rewritten.
    assert.equal(
        (await storage.put({ game: "ace", release, dir, files })).existed,
        true
    );
    // Other bytes under the same id: refused.
    const forged = files.map((f) =>
        f.path === "index.html" ? { ...f, sha256: sha256("other") } : f
    );
    await assert.rejects(
        storage.put({ game: "ace", release, dir, files: forged }),
        /not the hash of its files/
    );
    // A build that changed after it was hashed is not stored.
    writeFileSync(join(dir, "assets/a.js"), "export default 3");
    const store2 = localFolderStorage({ root: join(root, "store2") });
    await assert.rejects(
        store2.put({ game: "ace", release, dir, files }),
        /changed after it was checked/
    );
    await assert.rejects(
        store2.read({ game: "ace", release }, "index.html"),
        /ENOENT/,
        "a failed put leaves no release behind"
    );

    // Damage in storage is found, file by file.
    const at = join(root, "store/ace", release, "index.html");
    chmodSync(at, 0o644);
    writeFileSync(at, "tampered");
    const damaged = await verifyRelease(storage, { game: "ace", release });
    assert.deepEqual(
        damaged.problems.map((p) => p.path),
        ["index.html"]
    );
    await assert.rejects(
        storage.put({
            game: "ace",
            release,
            dir: join(root, "nowhere"),
            files,
        }),
        /already stored with different contents/
    );
    await assert.rejects(
        storage.read({ game: "ace", release }, "../../pointers.json"),
        /bad file path/
    );
});

test("storage refuses bad releases", async (t) => {
    const root = scratch(t);
    const storage = localFolderStorage({ root: join(root, "store") });
    const put = (files, game = "ace") =>
        storage.put({ game, release: releaseId(files), dir: root, files });
    const file = (path) => ({ path, bytes: 1, sha256: sha256(path) });
    await assert.rejects(
        put([file("index.html"), file("../x")]),
        /bad file path/
    );
    await assert.rejects(
        put([file("index.html"), file(RELEASE_MANIFEST)]),
        /reserved/
    );
    await assert.rejects(put([file("a.js")]), /needs index.html/);
    await assert.rejects(put([file("index.html")], "../ace"), /bad game id/);
});

test("pointer: publish, rollback, history, unpoint", (t) => {
    const file = join(scratch(t), "deep/pointers.json");
    assert.deepEqual(readPointers(file), { version: 1, games: {} });
    const entry = (n) => ({
        release: String(n).padStart(16, "0"),
        base: `https://gateway.example/ipfs/cid${n}/`,
        backend: "pinata",
        address: `cid${n}`,
        publishedAt: "2026-01-01T00:00:00.000Z",
        files: 2,
        bytes: 10,
    });
    let pointers = readPointers(file);
    for (const n of [1, 2, 3]) pointers = pointTo(pointers, "ace", entry(n));
    writePointers(file, pointers);
    pointers = readPointers(file);
    assert.equal(currentRelease(pointers, "ace").address, "cid3");
    assert.equal(currentRelease(pointers, "garden"), null);

    // Back one, back one more, then forward by name. Releases stay listed.
    pointers = rollback(pointers, "ace");
    assert.equal(currentRelease(pointers, "ace").address, "cid2");
    pointers = rollback(pointers, "ace");
    assert.equal(currentRelease(pointers, "ace").address, "cid1");
    assert.throws(() => rollback(pointers, "ace"), /no release before/);
    pointers = rollback(pointers, "ace", entry(3).release);
    assert.equal(currentRelease(pointers, "ace").address, "cid3");
    assert.equal(pointers.games.ace.releases.length, 3);
    assert.throws(
        () => rollback(pointers, "ace", "f".repeat(16)),
        /no release f+/
    );
    assert.throws(() => rollback(pointers, "garden"), /no hosted release/);

    // Publishing an earlier release again moves it to the front, once.
    pointers = pointTo(pointers, "ace", entry(1));
    assert.deepEqual(
        pointers.games.ace.releases.map((r) => r.address),
        ["cid1", "cid3", "cid2"]
    );
    for (let n = 10; n < 10 + HISTORY + 5; n++)
        pointers = pointTo(pointers, "ace", entry(n));
    assert.equal(pointers.games.ace.releases.length, HISTORY);
    assert.throws(
        () =>
            pointTo(pointers, "ace", {
                ...entry(1),
                base: "https://gateway.example/x",
            }),
        /ends in/
    );

    // The page reads exactly this file.
    assert.equal(
        resolveGameFrame("ace", [pointers]).src,
        `${entry(10 + HISTORY + 4).base}index.html`
    );
    assert.equal(
        resolveGameFrame("ace", [unpoint(pointers, "ace")]).source,
        "committed"
    );
});

test("publish: the pointer moves only after the stored copy verifies", async (t) => {
    const root = scratch(t),
        pointers = join(root, "store/pointers.json");
    const storage = localFolderStorage({ root: join(root, "store") });
    const v1 = build(join(root, "v1"), GAME);
    const v2 = build(join(root, "v2"), {
        ...GAME,
        "assets/a.js": "export default 2",
    });
    const first = await publishRelease({
        game: "ace",
        dir: join(root, "v1"),
        files: v1,
        storage,
        pointers,
    });
    assert.equal(first.previous, null);
    const second = await publishRelease({
        game: "ace",
        dir: join(root, "v2"),
        files: v2,
        storage,
        pointers,
    });
    assert.equal(second.previous.release, first.entry.release);
    assert.equal(
        resolveGameFrame("ace", [readPointers(pointers)]).src,
        `/api/games/releases/ace/${second.entry.release}/index.html`
    );

    // Roll back, and the first release is still there, byte for byte.
    writePointers(pointers, rollback(readPointers(pointers), "ace"));
    const back = currentRelease(readPointers(pointers), "ace");
    assert.equal(back.release, first.entry.release);
    assert.deepEqual(
        (await verifyRelease(storage, { game: "ace", ...back }, v1)).problems,
        []
    );

    // A backend that stores the wrong bytes: publish fails, pointer stays.
    const lossy = {
        name: "lossy",
        put: async () => ({ base: "https://x.example/", address: "x" }),
        read: async () => Buffer.from("wrong"),
    };
    await assert.rejects(
        publishRelease({
            game: "ace",
            dir: join(root, "v2"),
            files: v2,
            storage: lossy,
            pointers,
        }),
        /does not match the checked build/
    );
    assert.equal(
        currentRelease(readPointers(pointers), "ace").release,
        first.entry.release
    );
});

test("pinata storage: one pinned directory, read back through the gateway", async (t) => {
    const root = scratch(t),
        dir = join(root, "build");
    const files = build(dir, GAME),
        release = releaseId(files);
    const cid = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
    const pinned = new Map();
    let upload;
    const fetch = async (url, init = {}) => {
        url = String(url);
        if (url === "https://api.pinata.cloud/pinning/pinFileToIPFS") {
            upload = {
                auth: init.headers.Authorization,
                options: JSON.parse(init.body.get("pinataOptions")),
                metadata: JSON.parse(init.body.get("pinataMetadata")),
            };
            for (const part of init.body.getAll("file"))
                pinned.set(
                    part.name.split("/").slice(1).join("/"),
                    Buffer.from(await part.arrayBuffer())
                );
            assert.ok(
                init.body
                    .getAll("file")
                    .every((part) => part.name.startsWith(`ace-${release}/`)),
                "one top folder"
            );
            return Response.json({ IpfsHash: cid });
        }
        const path = url.replace(`https://games.example/ipfs/${cid}/`, "");
        return pinned.has(path)
            ? new Response(pinned.get(path))
            : new Response("", { status: 404 });
    };
    const storage = pinataStorage({
        jwt: "test-key",
        gateway: "https://games.example/ipfs/",
        fetch,
    });
    const pointers = join(root, "pointers.json");
    const { entry } = await publishRelease({
        game: "ace",
        dir,
        files,
        storage,
        pointers,
    });
    assert.equal(upload.auth, "Bearer test-key");
    assert.equal(upload.options.cidVersion, 1);
    assert.deepEqual(upload.metadata.keyvalues, { game: "ace", release });
    assert.deepEqual([...pinned.keys()].sort(), [
        "assets/a.js",
        "index.html",
        RELEASE_MANIFEST,
    ]);
    assert.deepEqual(
        { base: entry.base, address: entry.address, backend: entry.backend },
        {
            base: `https://games.example/ipfs/${cid}/`,
            address: cid,
            backend: "pinata",
        }
    );
    assert.equal(
        resolveGameFrame("ace", [readPointers(pointers)]).src,
        `https://games.example/ipfs/${cid}/index.html`
    );
    assert.ok(!readFileSync(pointers, "utf8").includes("test-key"));

    // A gateway that serves other bytes fails verification.
    pinned.set("index.html", Buffer.from("swapped"));
    assert.deepEqual(
        (await verifyRelease(storage, { game: "ace", ...entry })).problems.map(
            (p) => p.path
        ),
        ["index.html"]
    );

    assert.throws(
        () => pinataStorage({ jwt: "", gateway: "https://games.example" }),
        /PINATA_JWT_KEY/
    );
    assert.throws(
        () => pinataStorage({ jwt: "k", gateway: "games.example" }),
        /GAMES_RELEASES_GATEWAY/
    );
    const failing = pinataStorage({
        jwt: "k",
        gateway: "https://games.example",
        fetch: async () => new Response("nope", { status: 401 }),
    });
    await assert.rejects(
        failing.put({ game: "ace", release, dir, files }),
        /Pinata upload failed \(401\)/
    );
});

test("the environment selects storage and pointer file", () => {
    const local = releaseTarget({ GAMES_RELEASES_DIR: "/tmp/r" });
    assert.equal(local.storage.name, "local");
    assert.equal(local.pointers, "/tmp/r/pointers.json");
    const pinata = releaseTarget({
        GAMES_RELEASES_BACKEND: "pinata",
        PINATA_JWT_KEY: "k",
        GAMES_RELEASES_GATEWAY: "https://games.example",
    });
    assert.equal(pinata.storage.name, "pinata");
    assert.match(pinata.pointers, /frontend\/features\/games\/releases\.json$/);
    assert.throws(
        () => releaseTarget({ GAMES_RELEASES_BACKEND: "pinata" }),
        /PINATA_JWT_KEY/
    );
    assert.throws(
        () => releaseTarget({ GAMES_RELEASES_BACKEND: "s3" }),
        /local or pinata/
    );
});

test("release server: CORS, immutable caching, and nothing outside the folder", async (t) => {
    const root = scratch(t);
    build(join(root, "ace/0000000000000001"), { "index.html": "hi" });
    writeFileSync(join(root, "pointers.json"), "{}");
    const server = await serveReleases({ root });
    t.after(() => server.close());
    const origin = `http://127.0.0.1:${server.address().port}`;
    const ok = await fetch(
        `${origin}/api/games/releases/ace/0000000000000001/index.html`
    );
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get("access-control-allow-origin"), "*");
    assert.match(ok.headers.get("cache-control"), /immutable/);
    assert.match(ok.headers.get("content-security-policy"), /^sandbox /);
    for (const path of [
        "/api/games/releases/ace/0000000000000001/",
        "/api/games/releases/%2e%2e/%2e%2e/etc/passwd",
        "/api/games/releases/ace/missing.js",
        "/pointers.json",
    ])
        assert.equal((await fetch(origin + path)).status, 404, path);
});

test("hosted stage: passes a sound build, names what is wrong with a bad one", async (t) => {
    const root = scratch(t);
    const good = build(join(root, "good"), GAME);
    const passed = await hostedReleaseStage({
        id: "ace",
        out: join(root, "good"),
        files: good,
    });
    assert.deepEqual(passed.findings, []);
    assert.deepEqual(
        {
            status: passed.summary.status,
            release: passed.summary.release,
            verified: passed.summary.verified,
        },
        { status: "passed", release: releaseId(good), verified: 2 }
    );

    // The build changed between hashing and publishing.
    writeFileSync(join(root, "good/assets/a.js"), "export default 9");
    const stale = await hostedReleaseStage({
        id: "ace",
        out: join(root, "good"),
        files: good,
    });
    assert.equal(stale.summary.status, "failed");
    assert.deepEqual(
        stale.findings.map((f) => f.code),
        ["RELEASE_PUBLISH"]
    );
});
