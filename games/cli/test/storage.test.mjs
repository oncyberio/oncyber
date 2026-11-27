// Upload mode `storage` of docs/games/publishing.md: each file goes
// straight to the site's storage through the address the site signed for
// it. The stand-in's storage is a second server, another origin, that
// holds each PUT to what its address was made for.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import {
    STORAGE_CONCURRENCY,
    describeRelease,
    publishGame,
    storageAddressProblem,
} from "../lib/publish.mjs";
import { createSite } from "../lib/site.mjs";
import { createStandin } from "./standin.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const manifest = JSON.parse(
    readFileSync(join(repo, "games/lantern-tag/game.json"), "utf8")
);
const digest = (algorithm, bytes, encoding = "hex") =>
    createHash(algorithm).update(bytes).digest(encoding);
const tmp = mkdtempSync(join(tmpdir(), "oncyber-storage-"));
const TOKEN = "test-token-that-stays-on-the-site";
let standin;
before(async () => {
    standin = await createStandin({
        tokens: { [TOKEN]: "account-1" },
        upload: "storage",
    });
});
after(async () => {
    await standin.close();
    rmSync(tmp, { recursive: true, force: true });
});

/** A small checked build in a folder of its own. */
async function game(id, files = {}) {
    const dir = join(tmp, `${id}-${Math.random().toString(36).slice(2, 8)}`);
    const out = join(dir, "dist");
    const reports = join(dir, ".oncyber");
    const all = {
        "index.html": "<!doctype html><title>game</title>",
        "assets/game-abc123.js": "console.log('play');",
        "assets/chunk-B_x9~a.b@2+c.js": "// every character a path may hold",
        "assets/empty.txt": "",
        "network.json": '{"hosts":[]}',
        "credits.json": '{"credits":[]}',
        ...files,
    };
    for (const [path, text] of Object.entries(all)) {
        mkdirSync(dirname(join(out, path)), { recursive: true });
        writeFileSync(join(out, path), text);
    }
    writeFileSync(join(out, "thumbnail.jpg"), "not really a picture");
    const project = { id, dir, out, reports, manifest };
    const { release } = await describeRelease(project);
    mkdirSync(reports, { recursive: true });
    writeFileSync(
        join(reports, "check.json"),
        JSON.stringify({
            status: "passed",
            checkedAt: "2026-11-17T12:00:00.000Z",
            hosted: { release },
        })
    );
    return project;
}
const site = () => createSite({ baseUrl: standin.url, token: TOKEN });
const stored = () =>
    standin.state.storageRequests.filter((request) => request.method === "PUT");

test("publish: every file to its own signed address, with the site's headers and no token", async () => {
    const project = await game("sky-run");
    const lines = [];
    const published = await publishGame({
        project,
        site: site(),
        log: (line) => lines.push(line),
    });
    assert.equal(published.link, `${standin.url}/games/sky-run`);
    const { files } = await describeRelease(project);
    // What the site holds is byte for byte what was built.
    const held = standin.state.releases.get(`sky-run/${published.release}`);
    assert.equal(held.size, files.length);
    for (const file of files)
        assert.deepEqual(
            held.get(file.path),
            readFileSync(join(project.out, file.path)),
            file.path
        );
    assert.equal(
        standin.state.games.get("sky-run").releases.at(-1).backend,
        "storage"
    );
    // One PUT a file, and one for the card's picture, all to the storage
    // and none to the site.
    const puts = stored();
    assert.equal(puts.length, files.length + 1);
    assert.ok(
        !standin.state.requests.some((request) => request.method === "PUT")
    );
    assert.ok(lines.some((line) => line.includes("thumbnail.jpg")));
    for (const request of puts) {
        const made = standin.state.addresses.get(request.url);
        // The headers the site said to send, exactly.
        for (const [name, value] of Object.entries(made.headers))
            assert.equal(request.headers[name.toLowerCase()], value, name);
        // The address is the credential: the session token stays home.
        assert.equal(request.headers.authorization, undefined);
        assert.equal(request.headers.cookie, undefined);
        assert.ok(!JSON.stringify(request).includes(TOKEN));
    }
    // The MD5 the command listed is the one the storage held each file to.
    const script = files.find((file) => file.path === "assets/game-abc123.js");
    assert.equal(script.md5, digest("md5", "console.log('play');"));
    const sent = puts.find((request) =>
        request.url.includes("assets/game-abc123.js")
    );
    assert.equal(
        sent.headers["content-md5"],
        digest("md5", "console.log('play');", "base64")
    );
    assert.equal(sent.headers["x-goog-content-length-range"], "20,20");
});

test("publishing the same build again asks for no address and uploads nothing", async () => {
    const project = await game("again-game");
    const first = await publishGame({ project, site: site() });
    const before = stored().length;
    const lines = [];
    const second = await publishGame({
        project,
        site: site(),
        log: (line) => lines.push(line),
    });
    assert.equal(second.release, first.release);
    assert.equal(stored().length, before);
    assert.match(lines.join("\n"), /already stored/);
});

test("a storage that is briefly unavailable is tried once more; twice is a refusal", async () => {
    const project = await game("retry-game");
    standin.state.storageFailures.push(503);
    const published = await publishGame({ project, site: site() });
    assert.equal(published.status, "unlisted");

    const again = await game("refused-game", { "assets/more.js": "1" });
    const finishes = () =>
        standin.state.requests.filter((request) => request.method === "POST")
            .length;
    standin.state.storageFailures.push(503, 503, 503, 503, 503, 503, 503, 503);
    const before = finishes();
    await assert.rejects(
        publishGame({ project: again, site: site() }),
        (error) =>
            error.code === "UPLOAD_REFUSED" &&
            error.status === 503 &&
            /storage refused the upload \(503\): Try again/.test(error.message)
    );
    // begin, and no finish.
    assert.equal(finishes() - before, 1);
    assert.ok(!standin.state.games.has("refused-game"));
    standin.state.storageFailures.length = 0;
});

test("a file the storage will not take stops the publish before finish", async () => {
    const project = await game("changed-game");
    // The build changes between the check and the upload of one file.
    const real = site();
    let changed = false;
    const sneaky = {
        ...real,
        async upload(url, bytes, headers) {
            if (!changed && url.includes("index.html")) {
                changed = true;
                return real.upload(url, Buffer.from("something else"), headers);
            }
            return real.upload(url, bytes, headers);
        },
    };
    await assert.rejects(
        publishGame({ project, site: sneaky }),
        (error) => error.code === "UPLOAD_REFUSED" && error.status === 400
    );
    assert.ok(!standin.state.games.has("changed-game"));
});

/** A site whose `begin` answers `upload`, and a record of every request. */
function fakeSite(upload, storage = async () => ({ ok: true, status: 200 })) {
    const calls = [];
    const connection = createSite({
        baseUrl: "https://site.example",
        token: TOKEN,
        fetch: async (url, init) => {
            calls.push({ url: String(url), init });
            if (!String(url).startsWith("https://site.example/"))
                return storage(String(url), init);
            const { method } = JSON.parse(init.body);
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    type: "Success",
                    value:
                        method === "begin"
                            ? {
                                  uploadId: "u1",
                                  release: upload.release,
                                  stored: false,
                                  upload: upload.answer,
                              }
                            : {
                                  id: "fake-game",
                                  release: upload.release,
                                  url: "/games/fake-game",
                                  status: "unlisted",
                              },
                }),
            };
        },
    });
    return { connection, calls };
}
const addressesFor = (files, base = "https://storage.example/bucket/") =>
    files.map((file) => ({
        path: file.path,
        url: `${base}${file.path}?X-Goog-Signature=abc`,
        headers: { "Content-Type": "application/octet-stream" },
    }));

test("an address that is not one to send a file to: nothing is sent anywhere", async () => {
    assert.equal(
        storageAddressProblem("https://storage.googleapis.com/b/o?x=1"),
        null
    );
    assert.equal(storageAddressProblem("http://127.0.0.1:9199/b/o"), null);
    assert.equal(storageAddressProblem("http://localhost:9199/b/o"), null);
    for (const address of [
        "http://storage.example/b/o",
        "http://127.0.0.1.example/b/o",
        "ftp://storage.example/b/o",
        "https://user:pass@storage.example/b/o",
        "/relative/path",
        "",
    ])
        assert.ok(storageAddressProblem(address), address);

    const project = await game("fake-game");
    const { files, release } = await describeRelease(project);
    const good = addressesFor(files);
    for (const [answer, message] of [
        // One file has no address.
        [{ mode: "storage", files: good.slice(1) }, /no upload address for/],
        [{ mode: "storage" }, /no upload address for/],
        // One address is plain http to another machine.
        [
            {
                mode: "storage",
                files: [
                    ...good.slice(1),
                    { ...good[0], url: "http://storage.example/x" },
                ],
            },
            /is not https/,
        ],
        [
            {
                mode: "storage",
                files: [...good.slice(1), { ...good[0], headers: { a: 1 } }],
            },
            /headers that are not text/,
        ],
    ]) {
        const { connection, calls } = fakeSite({ release, answer });
        await assert.rejects(
            publishGame({ project, site: connection }),
            (error) =>
                error.code === "UPLOAD_ADDRESS" &&
                message.test(error.message) &&
                /Nothing was uploaded/.test(error.message)
        );
        // Only begin: no PUT, no finish.
        assert.deepEqual(
            calls.map((call) => call.init.method),
            ["POST"]
        );
    }
});

test("a few files at a time, a lost connection tried once more, a repeat taken as sent", async () => {
    const extra = Object.fromEntries(
        Array.from({ length: 12 }, (_, at) => [`assets/part-${at}.js`, `${at}`])
    );
    const project = await game("fake-game", extra);
    const { files, release } = await describeRelease(project);
    let flying = 0;
    let most = 0;
    const tries = new Map();
    const { connection, calls } = fakeSite(
        { release, answer: { mode: "storage", files: addressesFor(files) } },
        async (url, init) => {
            assert.equal(init.method, "PUT");
            assert.deepEqual(init.headers, {
                "Content-Type": "application/octet-stream",
            });
            assert.equal(init.redirect, "error");
            const tried = (tries.get(url) ?? 0) + 1;
            tries.set(url, tried);
            flying++;
            most = Math.max(most, flying);
            await new Promise((done) => setTimeout(done, 5));
            flying--;
            // The first answer to one file is lost on the way back.
            if (url.includes("part-3.js") && tried === 1)
                throw new TypeError("fetch failed");
            // The storage already holds another: an address writes once.
            if (url.includes("part-7.js")) return { ok: false, status: 412 };
            return { ok: true, status: 200 };
        }
    );
    const lines = [];
    const published = await publishGame({
        project,
        site: connection,
        log: (line) => lines.push(line),
    });
    assert.equal(published.status, "unlisted");
    assert.ok(most > 1 && most <= STORAGE_CONCURRENCY, `${most} at once`);
    assert.equal(tries.size, files.length);
    for (const [url, tried] of tries)
        assert.equal(tried, url.includes("part-3.js") ? 2 : 1, url);
    assert.ok(lines.some((line) => /part-7\.js was already sent/.test(line)));
    // The token went to the site in its RPC calls, and nowhere else.
    for (const call of calls)
        if (!call.url.startsWith("https://site.example/"))
            assert.ok(!JSON.stringify(call.init).includes(TOKEN), call.url);

    // A connection that fails twice stops the publish, with no finish.
    const down = fakeSite(
        { release, answer: { mode: "storage", files: addressesFor(files) } },
        async () => {
            throw new TypeError("fetch failed");
        }
    );
    await assert.rejects(
        publishGame({ project, site: down.connection }),
        (error) =>
            error.code === "UNREACHABLE" &&
            /cannot reach the site's storage at storage\.example/.test(
                error.message
            )
    );
    assert.equal(
        down.calls.filter((call) => call.init.method === "POST").length,
        1
    );
});
