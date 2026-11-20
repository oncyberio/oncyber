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
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { networkStage, REPORT_PATH } from "../../networkCheck.mjs";
import {
    currentRelease,
    HISTORY,
    point,
    pointTo,
    readPointers,
    rollback,
    unpoint,
    writePointers,
} from "../pointer.mjs";
import {
    publishRelease,
    releaseHostProblems,
    releaseTarget,
} from "../publish.mjs";
import { releasePolicy, serveReleases } from "../serve.mjs";
import { hostedReleaseStage } from "../stage.mjs";
import {
    listBuild,
    localFolderStorage,
    pinataStorage,
    RELEASE_MANIFEST,
    releaseId,
    sha256,
    siteRouteProblems,
    verifyRelease,
} from "../storage.mjs";
// The page's own reader: what the scripts write, the page must accept.
import {
    pinnedGatewayBase,
    pinnedRelease,
    resolveGameFrame,
} from "../../../../frontend/features/games/gameRelease.ts";

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

test("a build's reports are not in a release; what the check writes from game.json is", (t) => {
    const files = build(scratch(t), {
        ...GAME,
        "network.json": '{"version":1,"hosts":[],"inlineScripts":[]}',
        "credits.json": '{"version":1,"credits":[]}',
        "licenses/three-MIT.txt": "MIT",
        "thumbnail.jpg": "card",
    });
    assert.deepEqual(
        files.map((f) => f.path),
        [
            "assets/a.js",
            "credits.json",
            "index.html",
            "licenses/three-MIT.txt",
            "network.json",
        ]
    );
});

test("pointer: publish, rollback, history, unpoint", (t) => {
    const file = join(scratch(t), "deep/pointers.json");
    assert.deepEqual(readPointers(file), { version: 1, games: {} });
    const entry = (n) => ({
        release: String(n).padStart(16, "0"),
        base: `https://gateway.example/ipfs/cid${n}/`,
        // Any https host that sends a release's headers itself.
        backend: "elsewhere",
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
    const unpointed = unpoint(pointers, "ace");
    assert.equal(resolveGameFrame("ace", [unpointed]).source, "committed");
    // The stored releases stay listed, so a person can switch back.
    assert.equal(unpointed.games.ace.current, null);
    assert.equal(unpointed.games.ace.releases.length, HISTORY);
    assert.throws(() => rollback(unpointed, "ace"), /no hosted release/);
    assert.equal(
        currentRelease(point(unpointed, "ace"), "ace").release,
        entry(10 + HISTORY + 4).release
    );
    assert.equal(
        currentRelease(point(unpointed, "ace", entry(20).release), "ace")
            .address,
        "cid20"
    );
    assert.throws(
        () => point(unpointed, "ace", "f".repeat(16)),
        /no stored release f+/
    );
    assert.throws(() => point(unpointed, "garden"), /no stored release/);

    // Storing without pointing: a game on its committed build stays there,
    // and a hosted game keeps the release it loads, however many follow.
    let stored = pointTo({ version: 1, games: {} }, "ace", entry(1), {
        point: false,
    });
    assert.equal(stored.games.ace.current, null);
    assert.equal(resolveGameFrame("ace", [stored]).source, "committed");
    stored = point(stored, "ace");
    for (let n = 30; n < 30 + HISTORY + 5; n++)
        stored = pointTo(stored, "ace", entry(n), { point: false });
    assert.equal(currentRelease(stored, "ace").address, "cid1");
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
    // Storing a release does not switch the game: the page keeps loading
    // the committed build until a person points the game at a release.
    assert.equal(first.pointed, false);
    assert.equal(
        resolveGameFrame("ace", [readPointers(pointers)]).source,
        "committed"
    );
    writePointers(pointers, point(readPointers(pointers), "ace"));
    assert.equal(
        resolveGameFrame("ace", [readPointers(pointers)]).src,
        `/api/games/releases/ace/${first.entry.release}/index.html`
    );
    // From then on a publish moves the pointer.
    const second = await publishRelease({
        game: "ace",
        dir: join(root, "v2"),
        files: v2,
        storage,
        pointers,
    });
    assert.equal(second.previous.release, first.entry.release);
    assert.equal(second.pointed, true);
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
        assert.equal(init.redirect, "manual", "no redirect is followed");
        const path = url.replace(`https://games.example/ipfs/${cid}/`, "");
        if (path === moved)
            return new Response("", {
                status: 301,
                headers: { location: "https://elsewhere.example/x" },
            });
        return pinned.has(path)
            ? new Response(pinned.get(path))
            : new Response("", { status: 404 });
    };
    let moved = null;
    const storage = pinataStorage({
        jwt: "test-key",
        gateway: "https://games.example/ipfs/",
        fetch,
    });
    const pointers = join(root, "pointers.json");
    // Stored, and listed, but the game is not switched to it.
    const kept = await publishRelease({
        game: "ace",
        dir,
        files,
        storage,
        pointers,
    });
    assert.equal(kept.pointed, false);
    assert.equal(
        resolveGameFrame("ace", [readPointers(pointers)]).source,
        "committed"
    );
    // The gateway sends neither CORS nor the game's policy, and is not
    // asked for them: visitors load the release from the site's route,
    // which sends both. The entry says so, and is one that route accepts.
    assert.equal(storage.headers, undefined);
    assert.equal(kept.entry.served, "site");
    assert.deepEqual(
        await releaseHostProblems(storage, { game: "ace", ...kept.entry }),
        []
    );
    assert.match(
        (
            await releaseHostProblems(storage, {
                game: "ace",
                ...kept.entry,
                base: `http://games.example/ipfs/${cid}/`,
            })
        ).join(),
        /not an https gateway folder/
    );
    const { entry, pointed } = await publishRelease({
        game: "ace",
        dir,
        files,
        storage,
        pointers,
        point: true,
    });
    assert.equal(pointed, true);
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
    // The page's frame is the site's route, never the gateway, and that
    // route finds the gateway folder for this release in the same file.
    assert.equal(
        resolveGameFrame("ace", [readPointers(pointers)]).src,
        `/api/games/releases/ace/${release}/index.html`
    );
    assert.deepEqual(pinnedRelease(readPointers(pointers), "ace", release), {
        release,
        base: `https://games.example/ipfs/${cid}/`,
    });
    assert.ok(!readFileSync(pointers, "utf8").includes("test-key"));

    // A gateway that serves other bytes fails verification.
    pinned.set("index.html", Buffer.from("swapped"));
    assert.deepEqual(
        (await verifyRelease(storage, { game: "ace", ...entry })).problems.map(
            (p) => p.path
        ),
        ["index.html"]
    );

    // So does one that redirects: the site's route follows no redirect.
    pinned.set("index.html", Buffer.from(GAME["index.html"]));
    moved = "assets/a.js";
    assert.match(
        (await verifyRelease(storage, { game: "ace", ...entry })).problems
            .map((p) => `${p.path}: ${p.problem}`)
            .join(),
        /^assets\/a\.js: .*answered 301 \(a redirect/
    );

    // An upload that comes back without a CID the site would fetch.
    const odd = pinataStorage({
        jwt: "k",
        gateway: "https://games.example",
        fetch: async () => Response.json({ IpfsHash: "../../elsewhere" }),
    });
    await assert.rejects(
        odd.put({ game: "ace", release, dir, files }),
        /the site cannot serve this release: its address/
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

test("the publishing side and the site agree on what the site's route serves", () => {
    const cid = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
    const v0 = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
    const entries = [
        { address: cid, base: `https://games.example/ipfs/${cid}/` },
        { address: v0, base: `https://games.example/ipfs/${v0}/` },
        { address: cid, base: `https://games.example/pre/ipfs/${cid}/` },
        { address: cid, base: `http://games.example/ipfs/${cid}/` },
        { address: cid, base: `https://games.example/ipfs/${cid}` },
        { address: cid, base: `https://games.example/ipfs/${v0}/` },
        { address: cid, base: `https://a:b@games.example/ipfs/${cid}/` },
        { address: cid, base: `https://games.example/ipfs/${cid}/?x=1` },
        { address: cid, base: `https://games.example/x/../ipfs/${cid}/` },
        { address: "cid1", base: "https://games.example/ipfs/cid1/" },
        { address: "..", base: "https://games.example/ipfs/../" },
        { address: cid, base: `/api/games/releases/ace/${"0".repeat(16)}/` },
        { address: cid },
        {},
    ];
    const accepted = entries.map(
        (entry) => siteRouteProblems(entry).length === 0
    );
    assert.deepEqual(
        accepted,
        entries.map(
            (entry) =>
                pinnedGatewayBase({ backend: "pinata", ...entry }) !== null
        )
    );
    assert.deepEqual(accepted.slice(0, 4), [true, true, true, false]);
    assert.ok(accepted.slice(3).every((ok) => !ok));
});

test("another https host is still asked for both headers", async (t) => {
    const root = scratch(t),
        dir = join(root, "build");
    const files = build(dir, GAME);
    const local = localFolderStorage({ root: join(root, "store") });
    let sent = {};
    // A host visitors load from directly: nothing in front of it.
    const storage = {
        name: "elsewhere",
        put: async (release) => ({
            ...(await local.put(release)),
            base: "https://releases.example/ace/",
        }),
        read: local.read,
        headers: async () => new Headers(sent),
    };
    const pointers = join(root, "pointers.json");
    await assert.rejects(
        publishRelease({
            game: "ace",
            dir,
            files,
            storage,
            pointers,
            point: true,
        }),
        /pointer was left where it was.*Access-Control-Allow-Origin.*Content-Security-Policy/
    );
    // Stored and listed, never pointed at.
    assert.equal(currentRelease(readPointers(pointers), "ace"), null);
    const [entry] = readPointers(pointers).games.ace.releases;
    assert.equal(entry.served, undefined);
    sent = { "access-control-allow-origin": "*" };
    assert.match(
        (await releaseHostProblems(storage, { game: "ace", ...entry })).join(),
        /^it does not send the release's Content-Security-Policy/
    );
    sent = {
        "access-control-allow-origin": "*",
        "content-security-policy": releasePolicy(dir),
    };
    const { pointed } = await publishRelease({
        game: "ace",
        dir,
        files,
        storage,
        pointers,
        point: true,
    });
    assert.equal(pointed, true);
    assert.equal(
        resolveGameFrame("ace", [readPointers(pointers)]).src,
        "https://releases.example/ace/index.html"
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
    build(join(root, "ace/0000000000000002"), {
        "index.html": "hi",
        "network.json": JSON.stringify({
            version: 1,
            hosts: ["cdn.example.com"],
            inlineScripts: [],
        }),
    });
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
    // The game's policy (docs/games/trust.md) and a sandbox: with no
    // network.json in the release, its own files only.
    const own = ok.headers.get("content-security-policy");
    assert.match(own, /^default-src 'none'; /);
    assert.match(own, /; connect-src 'self' data: blob:; /);
    assert.match(own, /; sandbox allow-scripts allow-pointer-lock$/);
    // Each release is served under the hosts it declared itself.
    const declared = (
        await fetch(
            `${origin}/api/games/releases/ace/0000000000000002/index.html`
        )
    ).headers.get("content-security-policy");
    assert.match(
        declared,
        /; connect-src 'self' data: blob: https:\/\/cdn\.example\.com wss:\/\/cdn\.example\.com; /
    );
    assert.match(declared, /; sandbox allow-scripts allow-pointer-lock$/);
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

// The browser half: a release runs under its game's network policy when it
// is loaded from a release address, as it does from the committed folder.
let chromium;
try {
    ({ chromium } = createRequire(import.meta.url)("playwright"));
} catch {
    /* no Playwright here: the browser test is skipped */
}
test(
    "hosted stage: a release address holds the game to the hosts it declared",
    { skip: !chromium && "Playwright not installed" },
    async (t) => {
        const root = scratch(t);
        const page = (host) =>
            `<!doctype html><script type="module" src="./assets/a.js"></script><!-- ${host} -->`;
        const game = (host) =>
            `fetch("https://${host}/x").catch(() => {}).finally(() => parent.postMessage({ type: "tiny:ready" }, "*"));`;
        const run = async (name, host) => {
            const out = join(root, name);
            const manifest = { network: ["declared.example"] };
            mkdirSync(out, { recursive: true });
            writeFileSync(join(out, "index.html"), page(host));
            // The check writes network.json into the build before it lists it.
            const network = networkStage(manifest, out);
            const files = build(out, { "assets/a.js": game(host) });
            const hosted = await hostedReleaseStage({
                id: "tiny",
                out,
                files,
                chromium,
                network,
                reportUri: REPORT_PATH,
            });
            return { hosted, findings: network.findings() };
        };
        const kept = await run("kept", "declared.example");
        assert.deepEqual(kept.hosted.findings, []);
        assert.deepEqual(kept.findings, []);
        // The same game reaching a host it never declared: the release
        // address's policy blocks it, and the check hears of it.
        const strayed = await run("strayed", "undeclared.example");
        assert.deepEqual(strayed.hosted.findings, []);
        assert.deepEqual(
            [...new Set(strayed.findings.map((f) => f.code))],
            ["NETWORK_UNDECLARED"]
        );
        assert.match(
            strayed.findings.map((f) => f.message).join("\n"),
            /blocked a request to undeclared\.example/
        );
    }
);
