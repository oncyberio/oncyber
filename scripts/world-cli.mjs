#!/usr/bin/env node
/**
 * Terminal editing for an exhibit's structural content (kitbash/artworks).
 *
 * There's no CLI for this today — the browser studio always talks to
 * Firestore directly (`ExhibitStore.ts`'s `onSnapshot`), which a terminal
 * script can't do without shipping Firestore credentials to every machine
 * that runs it. Instead this drives the same RPC endpoint the studio's
 * autosave already uses (`/api/_v2/exhibit`, `update`/`get` methods, see
 * `pages/api/_v2/exhibit/{get,update}.ts`) over plain HTTP.
 *
 * Auth: `login` opens a browser to a consent page (Wrangler-shaped: sign in,
 * click Authorize, done — no scoped-permissions UI) and gets a token back
 * over a short-lived localhost callback server, saved to
 * ~/.world-cli/credentials.json. See pages/cli-auth.tsx and
 * pages/api/_v2/cli/{authorize,exchange}.ts for the browser/server halves.
 * ONCYBER_SESSION_TOKEN still works as a manual override (e.g. CI) and takes
 * priority over the saved file.
 *
 * Usage:
 *   node scripts/world-cli.mjs login
 *   node scripts/world-cli.mjs pull <exhibitId> [file]
 *   node scripts/world-cli.mjs push <exhibitId> [file]
 *   node scripts/world-cli.mjs snapshot <exhibitId> [label]
 *
 * `file` defaults to `./<exhibitId>.world.json` — this is the file to hand
 *-edit (or have Claude edit) between a pull and a push. Its shape:
 *   { "info": {...}, "artworks": {...}, "kitbash": { "<id>": {...}, ... } }
 * New kitbash items must match one of the structural component shapes in
 * `frontend/utils/worldContent/componentSchemas.ts` (terrain/mesh/lighting/
 * water/spawn) or the server will reject them on push.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { homedir, platform } from "node:os";
import { join } from "node:path";

const BASE_URL = process.env.ONCYBER_BASE_URL || "http://localhost:3000";

const CREDENTIALS_PATH = join(homedir(), ".world-cli", "credentials.json");

function loadSavedToken() {
    try {
        return JSON.parse(readFileSync(CREDENTIALS_PATH, "utf-8")).token;
    } catch {
        return undefined;
    }
}

async function saveCredentials(token, userId) {
    await mkdir(join(homedir(), ".world-cli"), { recursive: true });
    await writeFile(CREDENTIALS_PATH, JSON.stringify({ token, userId }, null, 2) + "\n", {
        mode: 0o600,
    });
}

// Env var wins (CI, one-off overrides) over the saved login — read once at
// startup, matching how every other config value here is resolved.
const TOKEN = process.env.ONCYBER_SESSION_TOKEN || loadSavedToken();

// Above this many changed kitbash items, auto-snapshot before pushing — the
// exact threshold matters less than "bulk changes get a safety net by
// default" (see plan: there is no other rollback mechanism today).
const AUTO_SNAPSHOT_THRESHOLD = 10;

function shadowPath(file) {
    return file.replace(/(\.json)?$/, ".base.json");
}

async function rpcCall(method, params, { service = "exhibit", token = TOKEN } = {}) {
    if (!token) {
        throw new Error(`Not logged in — run \`world-cli.mjs login\` first.`);
    }

    const res = await fetch(`${BASE_URL}/api/_v2/${service}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "method", method, params: [params], token }),
    });

    const data = await res.json();

    if (data.type === "Error") {
        throw new Error(`${method} failed: ${data.error}`);
    }

    return data.value;
}

function diffRecord(collection, before, after) {
    const patches = [];
    const beforeKeys = new Set(Object.keys(before));
    const afterKeys = new Set(Object.keys(after));

    for (const id of afterKeys) {
        if (!beforeKeys.has(id)) {
            patches.push({ op: "add", path: [collection, id], value: after[id] });
        } else if (JSON.stringify(before[id]) !== JSON.stringify(after[id])) {
            patches.push({ op: "replace", path: [collection, id], value: after[id] });
        }
    }

    for (const id of beforeKeys) {
        if (!afterKeys.has(id)) {
            patches.push({ op: "remove", path: [collection, id] });
        }
    }

    return patches;
}

async function readJson(path) {
    return JSON.parse(await readFile(path, "utf-8"));
}

async function writeJson(path, value) {
    await writeFile(path, JSON.stringify(value, null, 2) + "\n", "utf-8");
}

async function cmdPull(exhibitId, file) {
    file = file || `${exhibitId}.world.json`;

    const exhibit = await rpcCall("get", { id: exhibitId });

    await writeJson(file, exhibit);
    await writeJson(shadowPath(file), exhibit);

    console.log(`Pulled exhibit ${exhibitId} -> ${file}`);
    console.log(
        `(${shadowPath(file)} tracks the last-synced state — don't hand-edit it, \`push\` diffs against it)`
    );
}

async function cmdPush(exhibitId, file) {
    file = file || `${exhibitId}.world.json`;

    if (!existsSync(shadowPath(file))) {
        throw new Error(
            `No base snapshot found at ${shadowPath(file)} — run \`pull ${exhibitId} ${file}\` first.`
        );
    }

    const current = await readJson(file);
    const base = await readJson(shadowPath(file));

    const patches = diffRecord("kitbash", base.kitbash || {}, current.kitbash || {});

    if (patches.length === 0) {
        console.log("No kitbash changes to push.");
        return;
    }

    console.log(`Pushing ${patches.length} kitbash change(s)...`);

    if (patches.length >= AUTO_SNAPSHOT_THRESHOLD) {
        const snap = await rpcCall("snapshotCreate", {
            id: exhibitId,
            label: `auto: before ${patches.length}-item push via world-cli`,
        });
        console.log(`Auto-snapshot created: ${snap.id}`);
    }

    await rpcCall("update", { id: exhibitId, patches });

    console.log("Push succeeded — re-pulling to refresh local state.");

    await cmdPull(exhibitId, file);
}

async function cmdSnapshot(exhibitId, label) {
    const snap = await rpcCall("snapshotCreate", { id: exhibitId, label });
    console.log(`Snapshot created: ${snap.id}`);
}

function openBrowser(url) {
    const cmd =
        platform() === "darwin" ? "open" : platform() === "win32" ? "start" : "xdg-open";
    // Detached: this process owns the login flow's own short-lived server,
    // not the browser it opens — nothing here should keep the OS's browser
    // process tied to this one.
    spawn(cmd, platform() === "win32" ? ["", url] : [url], {
        shell: platform() === "win32",
        detached: true,
        stdio: "ignore",
    }).unref();
}

const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

async function cmdLogin() {
    const state = randomBytes(16).toString("hex");

    const { code } = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            server.close();
            reject(new Error("Login timed out — no browser response within 5 minutes."));
        }, LOGIN_TIMEOUT_MS);

        const server = createServer((req, res) => {
            const url = new URL(req.url, "http://localhost");
            if (url.pathname !== "/callback") {
                res.writeHead(404).end();
                return;
            }

            const receivedState = url.searchParams.get("state");
            const receivedCode = url.searchParams.get("code");

            if (receivedState !== state || !receivedCode) {
                res.writeHead(400, { "Content-Type": "text/html" }).end(
                    "<h1>Invalid callback</h1><p>State mismatch or missing code — you can close this window.</p>"
                );
                clearTimeout(timeout);
                server.close();
                reject(new Error("Login callback failed state verification."));
                return;
            }

            res.writeHead(200, { "Content-Type": "text/html" }).end(
                "<h1>world-cli connected</h1><p>You can close this window.</p>"
            );
            clearTimeout(timeout);
            server.close();
            resolve({ code: receivedCode });
        });

        server.listen(0, "127.0.0.1", () => {
            const { port } = server.address();
            const authUrl = new URL("/cli-auth", BASE_URL);
            authUrl.searchParams.set("state", state);
            authUrl.searchParams.set("callback", `http://localhost:${port}/callback`);

            console.log(`Opening ${authUrl} …`);
            openBrowser(authUrl.toString());
        });
    });

    const res = await fetch(`${BASE_URL}/api/_v2/cli`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "method", method: "exchange", params: [{ code }] }),
    });
    const data = await res.json();

    if (data.type === "Error") {
        throw new Error(`Login failed: ${data.error}`);
    }

    await saveCredentials(data.value.token, data.value.userId);

    console.log(`Logged in as ${data.value.userId}. Saved to ${CREDENTIALS_PATH}`);
}

async function main() {
    const [, , cmd, exhibitId, ...rest] = process.argv;

    if (cmd === "login") return cmdLogin();

    if (!cmd || !exhibitId) {
        console.error(
            "Usage: world-cli.mjs <login|pull|push|snapshot> [exhibitId] [file|label]"
        );
        process.exit(1);
    }

    if (cmd === "pull") return cmdPull(exhibitId, rest[0]);
    if (cmd === "push") return cmdPush(exhibitId, rest[0]);
    if (cmd === "snapshot") return cmdSnapshot(exhibitId, rest[0]);

    console.error(`Unknown command: ${cmd}`);
    process.exit(1);
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
