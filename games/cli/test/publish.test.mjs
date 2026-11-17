// The command's half of docs/games/publishing.md, against a stand-in for
// the site's half that verifies what the contract says the site verifies.
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
    describeRelease,
    listGames,
    publishGame,
    unpublishGame,
} from "../lib/publish.mjs";
import { createSite } from "../lib/site.mjs";
import { createStandin } from "./standin.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const manifest = JSON.parse(
    readFileSync(join(repo, "games/lantern-tag/game.json"), "utf8")
);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const tmp = mkdtempSync(join(tmpdir(), "oncyber-publish-"));
let standin;
before(async () => {
    standin = await createStandin({
        tokens: { "test-token": "account-1", "other-token": "account-2" },
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
        "network.json": '{"hosts":[]}',
        "credits.json": '{"credits":[]}',
        ...files,
    };
    for (const [path, text] of Object.entries(all)) {
        mkdirSync(dirname(join(out, path)), { recursive: true });
        writeFileSync(join(out, path), text);
    }
    // Beside the build, not part of the release.
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
const site = (token = "test-token") =>
    createSite({ baseUrl: standin.url, token });
const puts = () =>
    standin.state.requests.filter((request) => request.method === "PUT").length;

test("publish: begin, every file to the site with its hash, finish, the link", async () => {
    const project = await game("sky-run");
    const lines = [];
    const before = puts();
    const published = await publishGame({
        project,
        site: site(),
        log: (line) => lines.push(line),
    });
    assert.equal(published.id, "sky-run");
    assert.equal(published.status, "unlisted");
    assert.equal(published.url, "/games/sky-run");
    assert.equal(published.link, `${standin.url}/games/sky-run`);
    assert.match(published.release, /^[0-9a-f]{16}$/);
    // What the site holds is byte for byte what was built.
    const stored = standin.state.releases.get(`sky-run/${published.release}`);
    const { files } = await describeRelease(project);
    assert.equal(stored.size, files.length);
    for (const file of files) {
        assert.equal(sha256(stored.get(file.path)), file.sha256, file.path);
        assert.deepEqual(
            stored.get(file.path),
            readFileSync(join(project.out, file.path))
        );
    }
    // The reports are not sent as release files; the card's picture is,
    // beside them.
    assert.ok(!stored.has("thumbnail.jpg"));
    assert.equal(puts() - before, files.length + 1);
    assert.ok(lines.some((line) => line.includes("thumbnail.jpg")));
    const record = standin.state.games.get("sky-run");
    assert.equal(record.owner, "account-1");
    assert.equal(record.releases.at(-1).check, "self-reported");
    assert.equal(record.entry.title, manifest.name);
});

test("publishing the same build again uploads nothing", async () => {
    const project = await game("again-game");
    const first = await publishGame({ project, site: site() });
    const before = puts();
    const lines = [];
    const second = await publishGame({
        project,
        site: site(),
        log: (line) => lines.push(line),
    });
    assert.equal(second.release, first.release);
    assert.equal(puts(), before);
    assert.match(lines.join("\n"), /already stored/);
    assert.equal(standin.state.games.get("again-game").releases.length, 2);
});

test("games lists the account's games; unpublish takes one down, only for its owner", async () => {
    const project = await game("mine-game");
    await publishGame({ project, site: site() });
    const mine = await listGames(site());
    const listed = mine.find((entry) => entry.id === "mine-game");
    assert.deepEqual(Object.keys(listed).sort(), [
        "id",
        "publishedAt",
        "release",
        "status",
        "title",
        "url",
    ]);
    assert.equal(listed.status, "unlisted");
    assert.deepEqual(await listGames(site("other-token")), []);
    await assert.rejects(
        unpublishGame(site("other-token"), "mine-game"),
        /not a game of this account/
    );
    await unpublishGame(site(), "mine-game");
    assert.equal(
        (await listGames(site())).find((entry) => entry.id === "mine-game")
            .status,
        "unpublished"
    );
});

test("not signed in: said before anything is sent", async () => {
    const project = await game("anon-game");
    const before = standin.state.requests.length;
    await assert.rejects(
        publishGame({ project, site: site(null) }),
        (error) =>
            error.code === "NOT_SIGNED_IN" &&
            /oncyber login/.test(error.message)
    );
    assert.equal(standin.state.requests.length, before);
    await assert.rejects(
        listGames(site("expired-token")),
        (error) =>
            error.code === "NOT_SIGNED_IN" &&
            /oncyber login/.test(error.message)
    );
});

test("publishing not enabled on this site, or not for this account", async () => {
    const off = await createStandin({ publishing: "off" });
    const some = await createStandin({ publishing: ["someone-else"] });
    const none = await createStandin();
    try {
        const project = await game("off-game");
        await assert.rejects(
            publishGame({
                project,
                site: createSite({ baseUrl: off.url, token: "test-token" }),
            }),
            (error) =>
                error.code === "PUBLISHING_OFF" &&
                /not enabled on this site/.test(error.message)
        );
        assert.equal(off.state.games.size, 0);
        await assert.rejects(
            publishGame({
                project,
                site: createSite({ baseUrl: some.url, token: "test-token" }),
            }),
            (error) => error.code === "NOT_ALLOWED"
        );
        // A site with no publishing route at all answers 404 with a page.
        none.server.removeAllListeners("request");
        none.server.on("request", (req, res) =>
            res
                .writeHead(404, { "content-type": "text/html" })
                .end("<h1>404</h1>")
        );
        await assert.rejects(
            publishGame({
                project,
                site: createSite({ baseUrl: none.url, token: "test-token" }),
            }),
            (error) => error.code === "PUBLISHING_OFF"
        );
    } finally {
        await off.close();
        await some.close();
        await none.close();
    }
});

test("an id that is taken, or one of the catalog's, is refused with what to do", async () => {
    const mine = await game("taken-game");
    await publishGame({ project: mine, site: site() });
    const theirs = await game("taken-game", {
        "index.html": "<!doctype html>theirs",
    });
    await assert.rejects(
        publishGame({ project: theirs, site: site("other-token") }),
        (error) =>
            error.code === "ID_TAKEN" &&
            /another account's game/.test(error.message) &&
            /"oncyber": \{ "id"/.test(error.message)
    );
    const catalogued = await game("lantern-tag");
    await assert.rejects(
        publishGame({ project: catalogued, site: site() }),
        (error) => error.code === "ID_TAKEN"
    );
});

test("a check that failed, or passed for another build, publishes nothing", async () => {
    const project = await game("unchecked-game");
    const before = standin.state.requests.length;
    writeFileSync(
        join(project.out, "assets/late.js"),
        "// added after the check"
    );
    await assert.rejects(
        publishGame({ project, site: site() }),
        /changed after it was checked/
    );
    writeFileSync(
        join(project.reports, "check.json"),
        JSON.stringify({ status: "failed", findings: [{ code: "X" }] })
    );
    await assert.rejects(
        publishGame({ project, site: site() }),
        /last check failed/
    );
    assert.equal(standin.state.requests.length, before);
});

test("an upload the site refuses stops the publish, and the game is not registered", async () => {
    const project = await game("refused-game");
    // The site is sent bytes that are not what begin listed.
    const tampering = site();
    const put = tampering.put;
    tampering.put = (url, bytes, headers) =>
        put(
            url,
            url.endsWith("index.html") ? Buffer.from("tampered") : bytes,
            headers
        );
    await assert.rejects(
        publishGame({ project, site: tampering }),
        (error) =>
            error.code === "UPLOAD_REFUSED" &&
            error.status === 422 &&
            /does not match the size and hash/.test(error.message)
    );
    assert.ok(!standin.state.games.has("refused-game"));
});

test("the session token goes only to the site it is for", async () => {
    const connection = site();
    await assert.rejects(
        connection.put(
            "https://elsewhere.example/api/games/uploads/x/index.html",
            Buffer.from("x")
        ),
        (error) => error.code === "UPLOAD_ADDRESS"
    );
});

test("mode pinata, or any upload the command does not know, fails with nothing sent", async () => {
    const project = await game("pinata-game");
    const { release } = await describeRelease(project);
    const calls = [];
    const answer = (value) => ({
        ok: true,
        status: 200,
        json: async () => ({ type: "Success", value }),
        text: async () => "",
    });
    const fake = (upload) =>
        createSite({
            baseUrl: "https://site.example",
            token: "test-token",
            fetch: async (url, init) => {
                calls.push({ url: String(url), init });
                const { method } = JSON.parse(init.body);
                return answer(
                    method === "begin"
                        ? { uploadId: "u1", release, stored: false, upload }
                        : {
                              id: "pinata-game",
                              release,
                              url: "/games/pinata-game",
                              status: "unlisted",
                          }
                );
            },
        });
    await assert.rejects(
        publishGame({ project, site: fake({ mode: "pinata" }) }),
        (error) =>
            error.code === "UPLOAD_MODE" &&
            /Nothing was uploaded/.test(error.message)
    );
    // The contract's provisional shape for it: one CAR archive.
    await assert.rejects(
        publishGame({
            project,
            site: fake({
                mode: "pinata",
                url: "https://uploads.storage.example/signed",
                expires: 1800,
                as: "car",
            }),
        }),
        (error) =>
            error.code === "UPLOAD_MODE" &&
            /Nothing was uploaded/.test(error.message)
    );
    await assert.rejects(
        publishGame({
            project,
            site: fake({ mode: "carrier-pigeon", url: "x" }),
        }),
        (error) => error.code === "UPLOAD_MODE"
    );
    // Only begin was called, each time: no upload, no finish.
    assert.deepEqual(
        calls.map((call) => JSON.parse(call.init.body).method),
        ["begin", "begin", "begin"]
    );
});

test("a file the site would not take is named before anything is sent", async () => {
    const { pathProblem } = await import("../lib/publish.mjs");
    for (const path of [
        "index.html",
        "assets/index-ClP-_tdX.js",
        "licenses/three-MIT.txt",
        "a/_b/c@2x+1~.png",
    ])
        assert.equal(pathProblem(path), null, path);
    for (const path of [
        "assets/a file.txt",
        ".well-known/x",
        "a/../b",
        "a//b",
        "ends-in-dot.",
        "-dash.js",
        "é.js",
        `${"a/".repeat(13)}x`,
        "x".repeat(201),
    ])
        assert.ok(pathProblem(path), path);
    const project = await game("spaces-game");
    writeFileSync(join(project.out, "assets/my file.txt"), "x");
    const before = standin.state.requests.length;
    await assert.rejects(
        publishGame({ project, site: site() }),
        /dist\/assets\/my file\.txt has a name the site does not take/
    );
    const cased = await game("case-game", { "assets/Readme.txt": "a" });
    writeFileSync(join(cased.out, "assets/README.txt"), "b");
    await assert.rejects(
        publishGame({ project: cased, site: site() }),
        /only by case/
    );
    assert.equal(standin.state.requests.length, before);
});

test("mine is called with no input, as the contract writes it", async () => {
    const bodies = [];
    const connection = createSite({
        baseUrl: "https://site.example",
        token: "test-token",
        fetch: async (url, init) => {
            bodies.push(JSON.parse(init.body));
            return {
                ok: true,
                status: 200,
                json: async () => ({ type: "Success", value: [] }),
            };
        },
    });
    assert.deepEqual(await listGames(connection), []);
    assert.deepEqual(bodies, [
        { type: "method", method: "mine", params: [], token: "test-token" },
    ]);
});
