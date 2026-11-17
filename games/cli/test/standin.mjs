#!/usr/bin/env node
// A small stand-in for the site's half of docs/games/publishing.md, for the
// tests and for trying the command by hand:
//
//   node games/cli/test/standin.mjs [port]
//
// It implements cli.exchange, gamePublish.begin / finish / mine / unpublish
// and the mode `site` upload address, and verifies what the contract says
// the site verifies: the id, who owns it, the limits, the check's word, the
// release id, and every file's size and SHA-256. Nothing is kept on disk.
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
/** The release id, written out here on its own: docs/games/releases.md. */
export const standinReleaseId = (files) =>
    sha256(
        [...files]
            .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
            .map((file) => `${file.path}:${file.sha256}`)
            .join("\n")
    ).slice(0, 16);

const ID = /^[a-z0-9][a-z0-9-]{2,40}$/;

/**
 * @param {{ tokens?: Record<string, string>, codes?: Record<string, string>,
 *   publishing?: "open" | "off" | string[], catalog?: string[] }} [options]
 *   `tokens` maps a session token to its account, `codes` a sign-in code to
 *   a token, `publishing` is GAMES_PUBLISHING, `catalog` the repository's
 *   own game ids.
 */
export async function createStandin({
    tokens = { "test-token": "account-1" },
    codes = { "good-code": "test-token" },
    publishing = "open",
    catalog = ["ace", "garden", "lantern-tag", "padel"],
    port = 0,
} = {}) {
    const state = {
        games: new Map(),
        uploads: new Map(),
        releases: new Map(),
        requests: [],
    };
    let next = 1;
    const fail = (message) => {
        throw new Error(message);
    };

    const procedures = {
        begin(account, input) {
            const { id, manifest, entry, files, check } = input ?? {};
            if (
                typeof id !== "string" ||
                !ID.test(id) ||
                id.includes("--") ||
                id.endsWith("-") ||
                id.includes("-party-") ||
                id.endsWith("-party")
            )
                fail("That id cannot be published under.");
            if (Buffer.byteLength(JSON.stringify(manifest ?? null)) > 64 * 1024)
                fail("game.json is larger than 64 KiB.");
            if (catalog.includes(id))
                fail(
                    `${id} is a game in Oncyber's own catalog; choose another id.`
                );
            const game = state.games.get(id);
            if (game && game.owner !== account)
                fail(`${id} is another account's game; choose another id.`);
            if (!manifest || typeof manifest !== "object")
                fail("manifest is missing");
            for (const field of [
                "title",
                "description",
                "players",
                "partySizes",
                "devices",
                "tags",
            ])
                if (entry?.[field] === undefined)
                    fail(`entry.${field} is missing`);
            if (entry.id !== id) fail("entry.id is not the id");
            if (!Array.isArray(files) || !files.length || files.length > 400)
                fail("a release is 1 to 400 files");
            const seen = new Set();
            let bytes = 0;
            for (const file of files) {
                const names =
                    typeof file?.path === "string" ? file.path.split("/") : [];
                if (
                    !names.length ||
                    file.path.length > 200 ||
                    names.length > 13 ||
                    names.some(
                        (name) =>
                            !/^[A-Za-z0-9_][A-Za-z0-9._\-@+~]*$/.test(name) ||
                            name.endsWith(".")
                    ) ||
                    [
                        "check.json",
                        "release.json",
                        "thumbnail.jpg",
                        "oncyber-release.json",
                    ].includes(file.path) ||
                    seen.has(file.path.toLowerCase()) ||
                    !Number.isInteger(file.bytes) ||
                    file.bytes < 0 ||
                    !/^[0-9a-f]{64}$/.test(file.sha256 ?? "")
                )
                    fail(`files: ${file?.path} is not a release file`);
                seen.add(file.path.toLowerCase());
                bytes += file.bytes;
            }
            if (!seen.has("index.html")) fail("files: no index.html");
            if (bytes > 30 * 1024 * 1024) fail("a release is at most 30 MiB");
            const release = standinReleaseId(files);
            if (check?.status !== "passed" || check.release !== release)
                fail("the check did not pass for these files");
            const uploadId = `upload-${next++}`;
            const key = `${id}/${release}`;
            const stored = state.releases.has(key);
            state.uploads.set(uploadId, {
                account,
                id,
                release,
                entry,
                files,
                check,
                received: new Map(),
                thumbnail: null,
                stored,
            });
            return {
                uploadId,
                release,
                stored,
                upload: {
                    mode: "site",
                    url: `/api/games/uploads/${uploadId}/`,
                },
            };
        },
        finish(account, input) {
            const upload = state.uploads.get(input?.uploadId);
            if (!upload || upload.account !== account) fail("no such upload");
            const key = `${upload.id}/${upload.release}`;
            if (!upload.stored) {
                const missing = upload.files.filter(
                    (file) => !upload.received.has(file.path)
                );
                if (missing.length)
                    fail(
                        `not uploaded: ${missing.map((f) => f.path).join(", ")}`
                    );
                state.releases.set(key, upload.received);
            }
            const now = new Date().toISOString();
            const game = state.games.get(upload.id) ?? {
                id: upload.id,
                owner: account,
                releases: [],
                createdAt: now,
            };
            Object.assign(game, {
                status: "unlisted",
                entry: upload.entry,
                current: upload.release,
                updatedAt: now,
            });
            game.releases.push({
                release: upload.release,
                backend: "local",
                publishedAt: now,
                files: upload.files.length,
                bytes: upload.files.reduce((sum, f) => sum + f.bytes, 0),
                check: "self-reported",
            });
            state.games.set(upload.id, game);
            state.uploads.delete(input.uploadId);
            return {
                id: upload.id,
                release: upload.release,
                url: `/games/${upload.id}`,
                status: "unlisted",
            };
        },
        mine(account) {
            return [...state.games.values()]
                .filter((game) => game.owner === account)
                .map((game) => ({
                    id: game.id,
                    title: game.entry.title,
                    status: game.status,
                    release: game.current,
                    publishedAt: game.releases.at(-1).publishedAt,
                    url: `/games/${game.id}`,
                }));
        },
        unpublish(account, input) {
            const game = state.games.get(input?.id);
            if (!game || game.owner !== account)
                fail("That is not a game of this account.");
            game.status = "unpublished";
            return { id: game.id, status: game.status };
        },
    };

    const body = (req) =>
        new Promise((done) => {
            const chunks = [];
            req.on("data", (chunk) => chunks.push(chunk));
            req.on("end", () => done(Buffer.concat(chunks)));
        });
    const json = (res, status, value) =>
        res
            .writeHead(status, { "content-type": "application/json" })
            .end(JSON.stringify(value));
    const mayPublish = (account) =>
        publishing === "open" ||
        (Array.isArray(publishing) && publishing.includes(account));

    const server = createServer(async (req, res) => {
        const url = new URL(req.url, "http://localhost");
        const bytes = await body(req);
        state.requests.push({ method: req.method, path: url.pathname });
        try {
            if (req.method === "POST" && url.pathname === "/api/_v2/cli") {
                const { method, params } = JSON.parse(bytes);
                const token = codes[params?.[0]?.code];
                if (method !== "exchange" || !token)
                    return json(res, 500, {
                        type: "Error",
                        error: "Invalid or already-used code",
                    });
                return json(res, 200, {
                    type: "Success",
                    value: { token, userId: tokens[token] },
                });
            }
            if (
                req.method === "POST" &&
                url.pathname === "/api/_v2/gamePublish"
            ) {
                const { method, params, token } = JSON.parse(bytes);
                const account = Object.hasOwn(tokens, token ?? "")
                    ? tokens[token]
                    : null;
                if (!account)
                    return json(res, 401, {
                        type: "Error",
                        error: "Unauthorized",
                    });
                if (!Object.hasOwn(procedures, method))
                    return json(res, 500, {
                        type: "Error",
                        error: `Invalid Method ${method}`,
                    });
                if (!mayPublish(account))
                    return json(res, 500, {
                        type: "Error",
                        error:
                            publishing === "off"
                                ? "Not found"
                                : "This account may not publish games on this site.",
                    });
                try {
                    return json(res, 200, {
                        type: "Success",
                        value: procedures[method](account, params?.[0]),
                    });
                } catch (error) {
                    return json(res, 500, {
                        type: "Error",
                        error: error.message,
                    });
                }
            }
            const put = /^\/api\/games\/uploads\/([^/]+)\/(.+)$/.exec(
                url.pathname
            );
            if (req.method === "PUT" && put) {
                const upload = state.uploads.get(put[1]);
                const token = /^Bearer (.+)$/.exec(
                    req.headers.authorization ?? ""
                )?.[1];
                if (!upload || tokens[token ?? ""] !== upload.account)
                    return json(res, 401, { error: "Unauthorized" });
                // The path as it was listed: nothing is decoded.
                const path = put[2];
                if (path === "thumbnail.jpg") {
                    if (bytes.length > 512 * 1024)
                        return json(res, 413, {
                            error: "The picture is too large.",
                        });
                    upload.thumbnail = bytes;
                    return json(res, 200, { path, bytes: bytes.length });
                }
                const file = upload.files.find((f) => f.path === path);
                if (!file)
                    return json(res, 404, {
                        error: `${path} is not in this release.`,
                    });
                if (
                    bytes.length !== file.bytes ||
                    sha256(bytes) !== file.sha256
                )
                    return json(res, 422, {
                        error: `${path} does not match the size and hash begin listed.`,
                    });
                upload.received.set(path, bytes);
                return json(res, 200, {
                    path,
                    bytes: bytes.length,
                    sha256: file.sha256,
                });
            }
            res.writeHead(404, { "content-type": "text/html" }).end(
                "<h1>404</h1>"
            );
        } catch (error) {
            json(res, 500, { type: "Error", error: String(error.message) });
        }
    });
    await new Promise((done) => server.listen(port, "127.0.0.1", done));
    return {
        server,
        state,
        url: `http://127.0.0.1:${server.address().port}`,
        close: () => new Promise((done) => server.close(done)),
    };
}

if (
    process.argv[1] &&
    import.meta.url === pathToFileURL(process.argv[1]).href
) {
    const standin = await createStandin({
        port: Number(process.argv[2]) || 0,
    });
    console.log(`stand-in site at ${standin.url}
  ONCYBER_BASE_URL=${standin.url} ONCYBER_SESSION_TOKEN=test-token oncyber publish`);
}
