// The network stage of `pnpm games:check`.
//
// A game may reach its own files and the hosts in game.json's `network`
// list. This stage:
//   - validates the declaration and writes it into the build as
//     network.json, where the site reads it to set the game's
//     Content-Security-Policy (frontend/features/games/networkPolicy.js);
//   - serves the check's copy of the game with that same policy, on every
//     stage's server (`guard`), so a game that only works with wider access
//     fails here, not after publishing;
//   - fails the check on any request to an undeclared host, whether the
//     policy blocked it (the browser reports it to /__csp-report) or it got
//     out some other way (seen on the request log of every browser the
//     check opens, `patrol`).
//
// See docs/games/trust.md.
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const {
    NETWORK_FILE,
    readNetwork,
    readInlineScripts,
    hostDeclared,
    gameContentSecurityPolicy,
} = createRequire(import.meta.url)(
    join(root, "frontend/features/games/networkPolicy.js")
);

export const REPORT_PATH = "/__csp-report";
const LOCAL = new Set(["data:", "blob:", "about:"]);

/** "host" for the default TLS port, "host:port" otherwise; null for a URL that names no server. */
export function requestHost(url) {
    try {
        const parsed = new URL(url);
        if (LOCAL.has(parsed.protocol)) return null;
        return parsed.host.toLowerCase();
    } catch {
        return null;
    }
}

/**
 * CSP hash sources for the inline scripts in an HTML file: part of the
 * release like any other file, so they run; anything injected later doesn't.
 */
export function inlineScriptHashes(html) {
    const hashes = [];
    for (const [, attributes, body] of html.matchAll(
        /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi
    )) {
        if (/\bsrc\s*=/i.test(attributes) || !body.trim()) continue;
        hashes.push(
            `sha256-${createHash("sha256").update(body).digest("base64")}`
        );
    }
    return hashes;
}
function buildInlineScripts(dir) {
    const hashes = new Set();
    for (const entry of readdirSync(dir, {
        withFileTypes: true,
        recursive: true,
    }))
        if (entry.isFile() && entry.name.endsWith(".html"))
            for (const hash of inlineScriptHashes(
                readFileSync(
                    join(entry.parentPath ?? entry.path, entry.name),
                    "utf8"
                )
            ))
                hashes.add(hash);
    return [...hashes].sort();
}

/**
 * @param manifest the game's game.json
 * @param out the build directory (frontend/public/games/<id>); the
 *   declaration is written there when the build exists
 */
export function networkStage(manifest, out) {
    const { hosts, errors } = readNetwork(manifest?.network);
    const findings = new Map();
    const requested = new Set();
    const add = (code, message) =>
        findings.set(`${code} ${message}`, { code, message });
    for (const error of errors) add("NETWORK_DECLARATION", error);
    if (manifest?.network === undefined)
        add(
            "NETWORK_DECLARATION",
            `game.json has no "network" list; declare the hosts the game reaches, or [] for none`
        );
    let inlineScripts = [];
    if (out && existsSync(join(out, "index.html"))) {
        const found = buildInlineScripts(out);
        inlineScripts = readInlineScripts(found);
        if (found.length > inlineScripts.length)
            add(
                "POLICY_INLINE_SCRIPTS",
                `${found.length} inline scripts in the build's HTML; at most ${inlineScripts.length} run, move the rest into files`
            );
        writeFileSync(
            join(out, NETWORK_FILE),
            JSON.stringify({ version: 1, hosts, inlineScripts }, null, 2) + "\n"
        );
    }

    // The check's servers (host:port): the game's own files.
    const own = new Set();
    const watched = new WeakSet();
    const socket = (page) =>
        page.on("websocket", (opened) =>
            saw(opened.url(), "opened a socket to")
        );
    /** Every request and socket of a browser context, once. */
    const attach = (context) => {
        if (watched.has(context)) return;
        watched.add(context);
        context.on("request", (request) => saw(request.url(), "requested"));
        context.on("page", socket);
        context.pages().forEach(socket);
    };
    /** A request the browser made or tried: record it, and fail on an undeclared host. */
    const saw = (url, how) => {
        const host = requestHost(url);
        if (!host || own.has(host)) return;
        // Only TLS reaches a declared host; the policy lists https and wss.
        const secure = /^(https|wss):/.test(url);
        if (secure && hostDeclared(hosts, host))
            return void requested.add(host);
        add(
            "NETWORK_UNDECLARED",
            `${how} ${
                secure ? host : url.slice(0, 120)
            }, which game.json "network" does not list` +
                (secure ? "" : " (only https and wss hosts can be declared)")
        );
    };

    return {
        hosts,
        /** Headers for the game's files on the check server. */
        headers: {
            "content-security-policy": gameContentSecurityPolicy(hosts, {
                inlineScripts,
                reportUri: REPORT_PATH,
            }),
        },
        /** The check server's report endpoint. True when it took the request. */
        handle(req, res) {
            if (
                req.method !== "POST" ||
                new URL(req.url, "http://localhost").pathname !== REPORT_PATH
            )
                return false;
            let body = "";
            req.on("data", (chunk) => body.length < 65536 && (body += chunk));
            req.on("end", () => {
                res.writeHead(204, { "access-control-allow-origin": "*" });
                res.end();
                try {
                    this.report(JSON.parse(body)["csp-report"]);
                } catch {
                    // Not a report; nothing to learn from it.
                }
            });
            return true;
        },
        /** One violation the browser reported. */
        report(violation) {
            const blocked = String(violation?.["blocked-uri"] ?? "");
            const directive = String(
                violation?.["effective-directive"] ??
                    violation?.["violated-directive"] ??
                    "policy"
            ).split(" ")[0];
            const host = requestHost(blocked);
            // The policy refused it, so it is a finding even on a declared host.
            if (
                host &&
                /^(https|wss):/.test(blocked) &&
                hostDeclared(hosts, host)
            )
                add(
                    "NETWORK_UNDECLARED",
                    `${directive}: blocked a request to ${host}, which is declared for data, images and media only, not script or frames`
                );
            else if (host) saw(blocked, `${directive}: blocked a request to`);
            else
                add(
                    "POLICY_BLOCKED",
                    `${directive}: blocked ${
                        blocked || "a load"
                    }; games ship their code as files and may not use eval, inline handlers or script added after the build`
                );
        },
        /** Watch every request the page and its frames and workers make. */
        watch(page, port) {
            own.add(`127.0.0.1:${port}`);
            attach(page.context());
        },
        /**
         * Watch every page a browser opens from now on: each stage of the
         * check opens its own. Returns the browser.
         */
        patrol(browser) {
            const newContext = browser.newContext.bind(browser);
            browser.newContext = async (...options) => {
                const context = await newContext(...options);
                attach(context);
                return context;
            };
            const newPage = browser.newPage.bind(browser);
            browser.newPage = async (...options) => {
                const page = await newPage(...options);
                attach(page.context());
                return page;
            };
            browser.contexts().forEach(attach);
            return browser;
        },
        /**
         * Put a stage's own server under the policy: the game's files get
         * the same headers as on the main check server, and violations are
         * collected from it. Call once the server is listening.
         */
        guard(server) {
            own.add(`127.0.0.1:${server.address().port}`);
            const listeners = server.listeners("request");
            server.removeAllListeners("request");
            server.on("request", (req, res) => {
                if (this.handle(req, res)) return;
                if (req.url.startsWith("/games/")) {
                    const writeHead = res.writeHead.bind(res);
                    res.writeHead = (status, headers) =>
                        writeHead(
                            status,
                            status === 200
                                ? { ...headers, ...this.headers }
                                : headers
                        );
                }
                for (const listener of listeners)
                    listener.call(server, req, res);
            });
            return server;
        },
        findings: () => [...findings.values()],
        /** For check.json: what was declared and which of it the run used. */
        summary: () => ({ hosts, requested: [...requested].sort() }),
    };
}
