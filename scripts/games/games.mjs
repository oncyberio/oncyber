#!/usr/bin/env node
// Check and publish the games in games/<id>.
//
//   node scripts/games/games.mjs check <id> [--headed]
//   node scripts/games/games.mjs publish <id> [--headed]
//
// check   Serves frontend/public/games/<id>/ on a loopback port, opens it in
//         the same sandboxed frame the site uses, with ?check. The game plays
//         its scenario.json through the lifecycle and reports back; this
//         script adds console errors, a screenshot and the bundle's size, and
//         writes frontend/public/games/<id>/check.json. Exits 1 on failure.
// publish Builds games/<id> (npm run build), runs check, and only when it
//         passes writes frontend/public/games/<id>/release.json: a version
//         derived from the files' hashes plus the check summary. A release
//         is that fixed set of files; publishing again makes a new version.
//
// Needs Playwright with Chromium (`npm i -g playwright && npx playwright
// install chromium`, or set NODE_PATH to a node_modules that has it).
// PW_CHANNEL=chrome uses the installed Chrome instead (a real GPU).
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { networkStage } from "./networkCheck.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const [command, id, ...flags] = process.argv.slice(2);
const headed = flags.includes("--headed");

if (!["check", "publish"].includes(command) || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(id ?? "")) {
    console.error("usage: games.mjs check|publish <id> [--headed]");
    process.exit(2);
}
const source = join(root, "games", id);
const out = join(root, "frontend/public/games", id);
if (!existsSync(join(source, "game.json"))) fail(`games/${id}/game.json not found`);
const manifest = JSON.parse(readFileSync(join(source, "game.json"), "utf8"));
// Games on the lifecycle play their scenario; others only prove they boot.
const lifecycle = Boolean(manifest.runtime) && existsSync(join(source, "scenario.json"));
// The hosts the game declared: written into the build, enforced and watched below.
let network;

function fail(message) {
    console.error(`games: ${message}`);
    process.exit(1);
}

function listFiles(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        return entry.isDirectory() ? listFiles(path) : [path];
    });
}
// What a release is made of: everything the browser can load, not the
// reports this script writes next to it.
const REPORTS = new Set(["check.json", "release.json"]);
function bundleFiles() {
    if (!existsSync(join(out, "index.html"))) fail(`frontend/public/games/${id}/index.html missing; build first`);
    return listFiles(out)
        .map((path) => relative(out, path).split(sep).join("/"))
        .filter((path) => !REPORTS.has(path))
        .sort()
        .map((path) => {
            const bytes = readFileSync(join(out, path));
            return { path, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
        });
}

/** Facts any file listing can tell, before the game runs. */
function staticScan(files) {
    const findings = [];
    const total = files.reduce((sum, f) => sum + f.bytes, 0);
    const largest = files.reduce((a, b) => (b.bytes > (a?.bytes ?? -1) ? b : a), null);
    // YouTube Playables' first-bundle limit, a public reference point.
    if (total > 30 * 1024 * 1024) findings.push({ code: "BUNDLE_LARGE", message: `${(total / 1048576).toFixed(1)} MiB; keep under 30 MiB` });
    const shipped = new Set(files.map((f) => f.path));
    for (const asset of manifest.runtime?.assets ?? []) {
        const path = asset.replace(/^public\//, "");
        if (!shipped.has(path)) findings.push({ code: "ASSET_MISSING", message: `declared asset ${asset} is not in the build` });
    }
    for (const required of ["index.html", manifest.runtime?.entries?.ui].filter(Boolean))
        if (!shipped.has(required)) findings.push({ code: "ENTRY_MISSING", message: `${required} is not in the build` });
    return { files: files.length, bytes: total, largest: largest && { path: largest.path, bytes: largest.bytes }, findings };
}

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".jpg": "image/jpeg", ".png": "image/png", ".css": "text/css", ".wasm": "application/wasm", ".glb": "model/gltf-binary", ".vrm": "model/gltf-binary" };

// The page the game sees: the same sandbox as the site, and a stand-in for
// the page bridge that answers hello with a test identity.
const harness = `<!doctype html><meta charset="utf-8"><title>check</title>
<style>html,body{margin:0;height:100%;background:#000}iframe{border:0;width:100%;height:100%}</style>
<iframe id="game" sandbox="allow-scripts allow-pointer-lock" referrerpolicy="no-referrer" src="/games/${id}/index.html?check"></iframe>
<script>
const frame = document.getElementById("game");
addEventListener("message", (event) => {
    if (event.source !== frame.contentWindow) return;
    const type = event.data && event.data.type;
    if (type === "oncyber:check-report") window.__report = event.data.report;
    if (typeof type === "string" && type.endsWith(":hello")) {
        const prefix = type.slice(0, -"hello".length);
        frame.contentWindow.postMessage({ type: prefix + "identity", name: "Check", pfp: "", avatarUrl: "", storage: {} }, "*");
    }
    if (typeof type === "string" && type.endsWith(":ready")) window.__readyAt = window.__readyAt || performance.now();
    if (typeof type === "string" && type.endsWith(":error")) window.__gameError = String(event.data.message || "error");
});
</script>`;

function serve() {
    const server = createServer((req, res) => {
        const url = new URL(req.url, "http://localhost");
        if (network.handle(req, res)) return;
        if (url.pathname === "/") {
            res.writeHead(200, { "content-type": "text/html" });
            return res.end(harness);
        }
        const prefix = `/games/${id}/`;
        const path = resolve(out, `.${decodeURIComponent(url.pathname.slice(prefix.length - 1))}`);
        if (!url.pathname.startsWith(prefix) || !path.startsWith(out + sep) || !existsSync(path) || statSync(path).isDirectory()) {
            res.writeHead(404);
            return res.end();
        }
        res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream", "access-control-allow-origin": "*", ...network.headers });
        res.end(readFileSync(path));
    });
    return new Promise((done) => server.listen(0, "127.0.0.1", () => done(server)));
}

async function check() {
    network = networkStage(manifest, out);
    const files = bundleFiles();
    const scan = staticScan(files);
    let chromium;
    try {
        ({ chromium } = createRequire(import.meta.url)("playwright"));
    } catch {
        fail("Playwright not found (npm i -g playwright, or set NODE_PATH)");
    }
    const server = await serve();
    const errors = [], pageErrors = [];
    const browser = await chromium.launch({ headless: !headed, channel: process.env.PW_CHANNEL || undefined, args: ["--enable-unsafe-webgpu", "--ignore-gpu-blocklist"] });
    let report = null, gameError = null, readyAt = null;
    const started = Date.now();
    try {
        const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
        page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 500)));
        page.on("pageerror", (e) => {
            errors.push(String(e.message).slice(0, 500));
            pageErrors.push(String(e.message).slice(0, 500));
        });
        network.watch(page, server.address().port);
        await page.goto(`http://127.0.0.1:${server.address().port}/`);
        const deadline = Date.now() + 180_000;
        while (Date.now() < deadline && !report && !gameError && !(readyAt && !lifecycle)) {
            await page.waitForTimeout(500);
            ({ report, gameError, readyAt } = await page.evaluate(() => ({ report: window.__report ?? null, gameError: window.__gameError ?? null, readyAt: window.__readyAt ?? null })));
        }
        // A boot-only game: give it a few seconds of play for late errors.
        if (!lifecycle && readyAt) {
            await page.waitForTimeout(5000);
            report = { status: "passed", backend: "unknown", bootMs: Math.round(readyAt), stages: [{ stage: "boot", status: "passed", ms: Math.round(readyAt) }], frames: null, inspect: null, bootOnly: true };
        }
        mkdirSync(join(source, ".check"), { recursive: true });
        await page.screenshot({ path: join(source, ".check/screenshot.png") });
    } finally {
        await browser.close();
        server.close();
    }
    scan.findings.push(...network.findings());
    const result = {
        version: 1,
        game: id,
        checkedAt: new Date().toISOString(),
        status: report?.status === "passed" && !gameError && !scan.findings.length && !(report.bootOnly && pageErrors.length) ? "passed" : "failed",
        // Boot only: the game doesn't implement the lifecycle, so no scenario ran.
        scope: lifecycle ? "scenario" : "boot",
        files: { count: scan.files, bytes: scan.bytes, largest: scan.largest },
        findings: [
            ...scan.findings,
            ...(gameError ? [{ code: "GAME_FAILED", message: gameError }] : []),
            ...(report?.bootOnly ? pageErrors.map((message) => ({ code: "PAGE_ERROR", message })) : []),
            ...(!report && !gameError ? [{ code: "CHECK_TIMEOUT", message: `no report after ${Math.round((Date.now() - started) / 1000)} s` }] : []),
            ...(report?.stages ?? []).filter((s) => s.status === "failed").map((s) => ({ code: `STAGE_${s.stage.toUpperCase()}`, message: s.error ?? "failed" })),
        ],
        // Console errors are reported, not blocking: games load avatars and
        // other files from the network, which a check can't vouch for.
        consoleErrors: errors.slice(0, 20),
        network: network.summary(),
        run: report,
    };
    writeFileSync(join(out, "check.json"), JSON.stringify(result, null, 2) + "\n");
    const f = report?.frames;
    console.log(`${id}: ${result.status}` + (f ? ` · ${report.backend} · boot ${report.bootMs} ms · frames median ${f.medianMs} ms, p95 ${f.p95Ms} ms` : report ? ` · boot only, ready in ${report.bootMs} ms` : ""));
    for (const finding of result.findings) console.log(`  ${finding.code}: ${finding.message}`);
    if (errors.length) console.log(`  ${errors.length} console error(s), first: ${errors[0]}`);
    console.log(`  report: frontend/public/games/${id}/check.json · screenshot: games/${id}/.check/screenshot.png`);
    return { result, files };
}

if (command === "publish") {
    execFileSync("npm", ["run", "build"], { cwd: source, stdio: "inherit" });
}
const { result, files } = await check();
if (command === "publish") {
    if (result.status !== "passed") fail("check failed; nothing published");
    const version = createHash("sha256").update(files.map((f) => `${f.path}:${f.sha256}`).join("\n")).digest("hex").slice(0, 16);
    const release = {
        version: 1,
        game: id,
        name: manifest.name ?? id,
        release: version,
        publishedAt: new Date().toISOString(),
        check: { status: result.status, checkedAt: result.checkedAt, backend: result.run?.backend, frames: result.run?.frames },
        files,
    };
    writeFileSync(join(out, "release.json"), JSON.stringify(release, null, 2) + "\n");
    console.log(`${id}: published release ${version} (${files.length} files). Commit frontend/public/games/${id}.`);
}
process.exit(result.status === "passed" ? 0 : 1);
