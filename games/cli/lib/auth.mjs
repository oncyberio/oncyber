// Signing in. The same flow as the repository's world tool
// (scripts/world-cli.mjs): open the site's /cli-auth page, the signed-in
// visitor authorises, the browser comes back to a short-lived server on
// this machine with a single-use code, and the code is exchanged for a
// session token (docs/games/publishing.md, "Signing in").
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
    chmodSync,
    existsSync,
    mkdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";

export const DEFAULT_BASE_URL = "https://oncyber.io";

/** The site this run talks to: ONCYBER_BASE_URL, without a trailing slash. */
export function baseUrl(env = process.env) {
    const value = env.ONCYBER_BASE_URL || DEFAULT_BASE_URL;
    let url;
    try {
        url = new URL(value);
    } catch {
        throw new Error(`ONCYBER_BASE_URL is not a URL: ${value}`);
    }
    if (!["https:", "http:"].includes(url.protocol))
        throw new Error(`ONCYBER_BASE_URL must be http or https: ${value}`);
    return url.origin;
}

export const credentialsPath = (home = homedir()) =>
    join(home, ".oncyber", "credentials.json");

/** The saved login, or null. */
export function readCredentials(path = credentialsPath()) {
    try {
        const saved = JSON.parse(readFileSync(path, "utf8"));
        return typeof saved?.token === "string" && saved.token ? saved : null;
    } catch {
        return null;
    }
}

/** Save a login where only this user can read it. */
export function saveCredentials(
    { token, userId, baseUrl: site },
    path = credentialsPath()
) {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    writeFileSync(
        path,
        JSON.stringify({ token, userId, baseUrl: site }, null, 2) + "\n",
        { mode: 0o600 }
    );
    // An existing file keeps its old mode through writeFileSync.
    chmodSync(path, 0o600);
    return path;
}

export function forgetCredentials(path = credentialsPath()) {
    const had = existsSync(path);
    rmSync(path, { force: true });
    return had;
}

/**
 * The session token for `site`: ONCYBER_SESSION_TOKEN, else the saved login
 * when it was made on this same site. A token is never sent to a site it
 * was not issued by.
 */
export function sessionToken({
    env = process.env,
    site = baseUrl(env),
    path = credentialsPath(),
} = {}) {
    if (env.ONCYBER_SESSION_TOKEN) return env.ONCYBER_SESSION_TOKEN;
    const saved = readCredentials(path);
    if (!saved) return null;
    // A login saved before the site was recorded counts for the default.
    return (saved.baseUrl ?? DEFAULT_BASE_URL) === site ? saved.token : null;
}

function openBrowser(url) {
    const command =
        platform() === "darwin"
            ? "open"
            : platform() === "win32"
            ? "start"
            : "xdg-open";
    try {
        const child = spawn(
            command,
            platform() === "win32" ? ["", url] : [url],
            {
                shell: platform() === "win32",
                detached: true,
                stdio: "ignore",
            }
        );
        // No browser to open (a server, a container): the address is printed.
        child.on("error", () => {});
        child.unref();
    } catch {
        // The address is printed for the person to open.
    }
}

const page = (title, text) =>
    `<!doctype html><meta charset="utf-8"><title>Oncyber</title><h1>${title}</h1><p>${text}</p>`;

/**
 * Wait for the browser to come back with a code. Resolves with
 * `{ code }`; `onListening(url)` is called with the address to open.
 */
export function waitForCode({ site, timeoutMs = 5 * 60 * 1000, onListening }) {
    const state = randomBytes(16).toString("hex");
    return new Promise((done, fail) => {
        const server = createServer((req, res) => {
            const url = new URL(req.url, "http://localhost");
            if (url.pathname !== "/callback") {
                res.writeHead(404).end();
                return;
            }
            const code = url.searchParams.get("code");
            const ok = url.searchParams.get("state") === state && code;
            res.writeHead(ok ? 200 : 400, { "Content-Type": "text/html" }).end(
                ok
                    ? page(
                          "Signed in",
                          "The oncyber command is connected. You can close this window."
                      )
                    : page(
                          "That did not work",
                          "The sign-in link did not match this run. Close this window and run oncyber login again."
                      )
            );
            clearTimeout(timer);
            server.close();
            if (ok) done({ code });
            else fail(new Error("the sign-in came back without a valid code"));
        });
        const timer = setTimeout(() => {
            server.close();
            fail(new Error("sign-in timed out: no answer from the browser"));
        }, timeoutMs);
        server.on("error", fail);
        server.listen(0, "127.0.0.1", () => {
            const url = new URL("/cli-auth", site);
            url.searchParams.set("state", state);
            url.searchParams.set(
                "callback",
                `http://localhost:${server.address().port}/callback`
            );
            onListening(url.toString());
        });
    });
}

/** `oncyber login`. Returns `{ userId, path }`. */
export async function login({
    site,
    rpc,
    log = console.log,
    open = openBrowser,
    path = credentialsPath(),
    timeoutMs,
}) {
    const { code } = await waitForCode({
        site,
        timeoutMs,
        onListening(url) {
            log(`Opening ${url}`);
            log("If no browser opens, open that address yourself.");
            open(url);
        },
    });
    const { token, userId } = await rpc("cli", "exchange", { code });
    if (typeof token !== "string" || !token)
        throw new Error("the site answered the sign-in without a token");
    saveCredentials({ token, userId, baseUrl: site }, path);
    return { userId, path };
}
