#!/usr/bin/env node
// Check and publish the games in games/<id>.
//
//   node scripts/games/games.mjs check <id> [--headed] [--video]
//   node scripts/games/games.mjs publish <id> [--headed] [--video]
//
// check   Serves frontend/public/game-builds/<id>/ on a loopback port, opens it in
//         the same sandboxed frame the site uses, with ?check. The game plays
//         its scenario.json through the lifecycle and reports back; this
//         script adds console errors, a screenshot and the bundle's size, and
//         writes frontend/public/game-builds/<id>/check.json. Exits 1 on failure.
// publish Builds games/<id> (npm run build), runs check, and only when it
//         passes writes frontend/public/game-builds/<id>/release.json: a version
//         derived from the files' hashes plus the check summary. A release
//         is that fixed set of files; publishing again makes a new version.
//
// Needs Playwright with Chromium (`npm i -g playwright && npx playwright
// install chromium`, or set NODE_PATH to a node_modules that has it).
// PW_CHANNEL=chrome uses the installed Chrome instead (a real GPU).
// GAMES_CHECK_TIMEOUT_S=600 waits longer for the report (default 180).
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { contractFindings, enterFindings, harnessScript } from "./contract-check.mjs";
import { checkSocial, scanOwnVoice } from "./social-check.mjs";
import { runKeysCheck } from "./keysCheck.mjs";
import { checkSafeArea, describeSafeArea } from "./safe-area.mjs";
import { avatarStage } from "./avatar-check.mjs";
import { checkDeparture } from "./departure-check.mjs";
import { partyCheck } from "./party-check.mjs";
import { resultsHarness, resultsPlan, resultsStage } from "./results-stage.mjs";
import { checkDevices, devicesHarness } from "./devices.mjs";
import { checkLoading, loadingHarness } from "./loading-check.mjs";
import { locomotionStage } from "./locomotion-check.mjs";
import { scanUiKit } from "./ui-kit-check.mjs";
import { soundHarness, soundStage } from "./sound-check.mjs";
import { runSavedDataStage, savedFreshVisitor, savedStaticFindings } from "./saved-data.mjs";
import { describeProcess, processStage } from "./process.mjs";
import { listingStage } from "./listing.mjs";
import { networkStage, REPORT_PATH } from "./networkCheck.mjs";
import { checkHealth, healthHarness } from "./health-stage.mjs";
import { checkCredits } from "./credits.mjs";
import { SCENE_PROBE, describeScene, readScene, sceneProfile, servedLog } from "./scene-profile.mjs";
import { hostedReleaseStage } from "./releases/stage.mjs";
import { publishRelease, releaseTarget } from "./releases/publish.mjs";
import { RELEASE_REPORTS } from "./releases/storage.mjs";
import { gameOut, gameReports, gameSource, shown, standalone } from "./layout.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const [command, id, ...flags] = process.argv.slice(2);
const headed = flags.includes("--headed");
// Record the bot's run in the process stage (off by default: it is slow).
const video = flags.includes("--video") || process.env.GAMES_CHECK_VIDEO === "1";
// --lobby <url>: record the lobby's first frame from a running app (departure-check.mjs).
const lobbyUrl = flags.includes("--lobby") ? flags[flags.indexOf("--lobby") + 1] : null;

if (!["check", "publish"].includes(command) || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(id ?? "")) {
    console.error("usage: games.mjs check|publish <id> [--headed] [--video] [--lobby <url>]");
    process.exit(2);
}
// A game in a folder of its own (the `oncyber` command) is checked where it is: layout.mjs.
const outside = standalone();
if (outside && command === "publish") fail("a game outside the repository publishes with `oncyber publish`");
const source = gameSource(root, id);
const out = gameOut(root, id);
const reports = gameReports(root, id);
if (!existsSync(join(source, "game.json"))) fail(`${shown(root, join(source, "game.json"))} not found`);
const manifest = JSON.parse(readFileSync(join(source, "game.json"), "utf8"));
// Games on the lifecycle play their scenario; others only prove they boot,
// which passes only for a game the catalog doesn't list (contract-check.mjs).
const lifecycle = Boolean(manifest.runtime) && existsSync(join(source, "scenario.json"));
// Outside the repository there is no catalog to be listed in: the game is going to be published, so it is held to the contract.
const contract = contractFindings({ root, id, manifest, source, ...(outside ? { listed: true } : {}) });

// Match results: what the run must report (docs/games/results.md).
const results = resultsPlan(manifest);
// The hosts the game declared: written into the build, enforced and watched below.
let network;
// What the check's server sent and when: what arrives before the first frame (scene-profile.mjs).
const served = servedLog();

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
// reports this script writes next to it (releases/storage.mjs says which,
// and why). network.json and credits.json are written before the listing
// and are part of the release.
const REPORTS = RELEASE_REPORTS;
function bundleFiles() {
    if (!existsSync(join(out, "index.html"))) fail(`${shown(root, join(out, "index.html"))} missing; build first`);
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
// the page bridge that answers hello with a test identity. `query` follows
// "?check" in the game's URL; `visit` is the visit the page stages.
const harness = (query, visit) => `<!doctype html><meta charset="utf-8"><title>check</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}iframe{border:0;width:100%;height:100%;display:block}</style>
<iframe id="game" sandbox="allow-scripts allow-pointer-lock" referrerpolicy="no-referrer" allow="gamepad; autoplay" src="/game-builds/${id}/index.html?check${query}"></iframe>
<script>
const frame = document.getElementById("game");
${savedFreshVisitor}
addEventListener("message", (event) => {
    if (event.source !== frame.contentWindow) return;
    savedFreshVisitor(event, frame);
    const type = event.data && event.data.type;
    if (type === "oncyber:check-report") window.__report = event.data.report;
    // The game's messages by kind, for stages that play the page's part.
    if (typeof type === "string" && type.includes(":")) (window.__game ||= {})[type.slice(type.lastIndexOf(":") + 1)] = { data: event.data, at: performance.now() };
    if (typeof type === "string" && type.endsWith(":hello")) {
        const prefix = type.slice(0, -"hello".length);
        frame.contentWindow.postMessage({ type: prefix + "identity", name: "Check", pfp: "", avatarUrl: "" }, "*");
    }
${resultsHarness}
${devicesHarness}
    if (typeof type === "string" && type.endsWith(":ready")) window.__readyAt = window.__readyAt || performance.now();
    if (typeof type === "string" && type.endsWith(":error")) window.__gameError = String(event.data.message || "error");
});
${loadingHarness}
</script>
<script>${harnessScript(id, visit)}</script>${soundHarness(id)}${healthHarness}`;

function serve() {
    const server = createServer((req, res) => {
        const url = new URL(req.url, "http://localhost");
        if (network.handle(req, res)) return;
        if (url.pathname === "/") {
            res.writeHead(200, { "content-type": "text/html" });
            return res.end(harness("", contract.visit));
        }
        // The results stage's own visit: straight in, alone, and the game's bot plays the match game.json names to the end.
        if (url.pathname === "/results") {
            res.writeHead(200, { "content-type": "text/html" });
            return res.end(harness(`=results${results.query}`, { arrival: "direct", party: 0 }));
        }
        // The locomotion stage's own visit: straight in, alone; the stage asks the game to start walking.
        if (url.pathname === "/locomotion") {
            res.writeHead(200, { "content-type": "text/html" });
            return res.end(harness("=locomotion", { arrival: "direct", party: 0 }));
        }
        // The device profiles' visits: the scenario's own visit again, on a phone and with a gamepad.
        if (url.pathname === "/devices/phone" || url.pathname === "/devices/gamepad") {
            res.writeHead(200, { "content-type": "text/html" });
            return res.end(harness(`=${url.pathname.slice("/devices/".length)}`, contract.visit));
        }
        const prefix = `/game-builds/${id}/`;
        const path = resolve(out, `.${decodeURIComponent(url.pathname.slice(prefix.length - 1))}`);
        if (!url.pathname.startsWith(prefix) || !path.startsWith(out + sep) || !existsSync(path) || statSync(path).isDirectory()) {
            res.writeHead(404);
            return res.end();
        }
        res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream", "access-control-allow-origin": "*", ...network.headers });
        const bytes = readFileSync(path);
        served.add(relative(out, path).split(sep).join("/"), bytes.length);
        res.end(bytes);
    });
    return new Promise((done) => server.listen(0, "127.0.0.1", () => done(server)));
}

async function check() {
    network = networkStage(manifest, out);
    // Asset rights: every shipped file credited, under an allowed licence (credits.mjs). Before the files are listed: the credits.json it writes is one of the release's files.
    const rights = existsSync(join(out, "index.html")) ? await checkCredits(id) : null;
    const files = bundleFiles();
    const scan = staticScan(files);
    scan.findings.push(...contract.findings);
    scan.findings.push(...(await savedStaticFindings({ id, manifest })));
    scan.findings.push(...rights.findings);
    let chromium;
    try {
        ({ chromium } = createRequire(import.meta.url)("playwright"));
    } catch {
        fail(outside ? "Playwright not found. Install it beside the game: npm install --save-dev playwright && npx playwright install chromium" : "Playwright not found (npm i -g playwright, or set NODE_PATH)");
    }
    const server = await serve();
    const errors = [], pageErrors = [];
    // Every browser the check opens is watched for requests to hosts the game didn't declare (docs/games/trust.md).
    const launch = async () => network.patrol(await chromium.launch({ headless: !headed, channel: process.env.PW_CHANNEL || undefined, args: ["--enable-unsafe-webgpu", "--ignore-gpu-blocklist"] }));
    const browser = await launch();
    let report = null, gameError = null, readyAt = null, greeted = null, social = null, keys = null, safeArea = null, reported = null, devices = null, loading = null, locomotion = null, ui = { screens: [], warnings: [] }, listing = null, health = { findings: [], summary: null }, drawn = null, firstFrame = null;
    const started = Date.now();
    try {
        const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
        page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 500)));
        page.on("pageerror", (e) => {
            errors.push(String(e.message).slice(0, 500));
            pageErrors.push(String(e.message).slice(0, 500));
        });
        network.watch(page, server.address().port);
        // Counts what the game draws, from before it loads (scene-profile.mjs).
        await page.addInitScript(SCENE_PROBE);
        await page.goto(`http://127.0.0.1:${server.address().port}/`);
        // Software rendering (no GPU) can need longer: GAMES_CHECK_TIMEOUT_S.
        const deadline = Date.now() + (Number(process.env.GAMES_CHECK_TIMEOUT_S) || 180) * 1000;
        while (Date.now() < deadline && !report && !gameError && !(readyAt && !lifecycle)) {
            await page.waitForTimeout(500);
            ({ report, gameError, readyAt } = await page.evaluate(() => ({ report: window.__report ?? null, gameError: window.__gameError ?? null, readyAt: window.__readyAt ?? null })));
        }
        // A boot-only game: give it a few seconds of play for late errors.
        if (!lifecycle && readyAt) {
            await page.waitForTimeout(5000);
            report = { status: "passed", backend: "unknown", bootMs: Math.round(readyAt), stages: [{ stage: "boot", status: "passed", ms: Math.round(readyAt) }], frames: null, inspect: null, bootOnly: true };
        }
        // The scene profile's reading, before the stages below resize and pause the game.
        drawn = await readScene(page);
        firstFrame = await page.evaluate(() => ({ at: window.__loading?.firstFrame?.at ?? null, origin: performance.timeOrigin })).catch(() => null);
        greeted = await page.evaluate(() => window.__contract ?? null);
        ui = await scanUiKit(page);
        mkdirSync(join(source, ".check"), { recursive: true });
        await page.screenshot({ path: join(source, ".check/screenshot.png") });
        // The listing: its fields, and the card's thumbnail from this run (listing.mjs).
        listing = await listingStage({ root: outside ? null : root, out, manifest, page, booted: report?.status === "passed" && !gameError, retake: command === "publish" || flags.includes("--thumbnail") });
        // Sound (docs/games/sound.md), on the live game the scenario played in: the page's part of the sound channel, asserted on the output's facts.
        if (report) await soundStage(page, report, { required: lifecycle && manifest.runtime.capabilities.includes("audio") });
        // Loading and pausing (docs/games/loading-and-pausing.md), on the live game the scenario played in, before its trip back ends the visit.
        if (report?.status === "passed") loading = await checkLoading(page, { manifest, required: lifecycle }).catch((error) => ({ status: "failed", findings: [{ code: "LOADING_CHECK_ERROR", message: String(error.message).slice(0, 300) }] }));
        // Field health (docs/games/field-health.md), on the live game: an error thrown after ready reaches the page; a disabled game stays paused.
        health = await checkHealth(page, { id, manifest, files, ready: Boolean(report || readyAt), prefix: greeted?.prefix });
        // The trip back to the lobby (docs/games/departure.md), on the page the scenario played in: it ends that visit.
        if (report && manifest.departure === "matched") report.stages.push(await checkDeparture({ page, browser, id, prefix: greeted?.prefix, title: manifest.name ?? id, shots: join(source, ".check"), lobbyUrl }));
        // Results the scenario's visit posted, its departure included.
        const posted = report ? await page.evaluate(() => window.__results ?? []) : [];
        page.removeAllListeners();
        await page.close();
        // Every finished match reports exactly one result (docs/games/results.md): what that visit posted, then the match game.json says the check can finish, on a visit of its own.
        if (report) {
            const match = results.query ? await browser.newPage({ viewport: { width: 1280, height: 720 } }) : null;
            if (match) await match.goto(`http://127.0.0.1:${server.address().port}/results`);
            reported = await resultsStage(match, results, posted);
            await match?.close();
            if (reported.ran) {
                report.stages.push(reported.stage);
                if (reported.stage.status === "failed") report.status = "failed";
            }
        }
        // Chat and voice: the page's, carried from the lobby (docs/games/voice-chat.md).
        scan.findings.push(...scanOwnVoice(out));
        social = await checkSocial({ id, out, browser, network });
        // Keys and focus (docs/games/keys-focus.md): source scan, then typing in the page's chat during play.
        keys = await runKeysCheck({ browser, origin: `http://127.0.0.1:${server.address().port}`, id, manifest, source });
        scan.findings.push(...keys.findings);
        // The HUD must stay clear of what the page floats over the game.
        if (report && !gameError) safeArea = await checkSafeArea({ browser, origin: `http://127.0.0.1:${server.address().port}`, id, shots: join(source, ".check") });
        // The same scenario on a phone and with a gamepad (docs/games/devices.md): one more visit of the check page each, the real controls pressed.
        if (report) devices = await checkDevices({ browser, port: server.address().port, id, manifest, source, lifecycle, desktop: report });
        // Games that walk like the lobby (docs/games/locomotion.md): one more visit of the check page, straight in and alone, forward held for two seconds.
        if (report && manifest.locomotion === "lobby") {
            const walk = await browser.newPage({ viewport: { width: 1280, height: 720 } });
            await walk.goto(`http://127.0.0.1:${server.address().port}/locomotion`);
            locomotion = await locomotionStage(walk, manifest);
            await walk.close();
        }
    } finally {
        await browser.close();
        server.close();
    }
    // The scene profile (docs/games/scene-profile.md): what arrives before the first frame and what a frame draws, with a warning for each number over its budget.
    const firstFrameMs = firstFrame?.at ?? (drawn?.firstDrawAt != null && firstFrame ? Math.round(drawn.timeOrigin + drawn.firstDrawAt - firstFrame.origin) : null);
    const scene = sceneProfile({ drawn, phone: devices?.report?.profiles?.phone?.drawn ?? null, before: firstFrameMs == null ? null : served.before(firstFrame.origin + firstFrameMs), firstFrameMs, budgetMs: manifest.loading?.firstFrameBudgetMs });
    if (devices?.report?.profiles?.phone) delete devices.report.profiles.phone.drawn;
    const entry = enterFindings({ id, contract: greeted, visit: contract.visit, report });
    scan.findings.push(...entry.findings);
    const warnings = [...contract.warnings, ...entry.warnings];
    // Other people as their Oncyber avatars, and the arrival pose (docs/games/avatar-kit.md).
    const avatars = await avatarStage({ id, manifest, source, out, chromium, headed, network });
    // What the game offers a party, and that a dropped member doesn't stop it.
    const party = await partyCheck({ id, manifest, out, source, headed, network });
    // Saved data: save, reload, read back; then boot against old saves.
    const saved = await runSavedDataStage({ id, manifest, out, launch, network });
    // The build must also work from a release address, not only this folder, under the same network policy.
    const hosted = await hostedReleaseStage({ id, out, files, chromium, headed, network, reportUri: REPORT_PATH });
    const result = {
        version: 1,
        game: id,
        checkedAt: new Date().toISOString(),
        status: report?.status === "passed" && report.stages.every((s) => s.status === "passed") && social?.status === "passed" && !gameError && !scan.findings.length && !(report.bootOnly && pageErrors.length) && safeArea?.status !== "failed" && avatars.status === "passed" && party.status !== "failed" && !devices?.blocking.length && loading?.status !== "failed" && locomotion?.status !== "failed" && saved.status === "passed" && !listing?.findings.length && !health.findings.length && !hosted.findings.length ? "passed" : "failed",
        // Boot only: the game doesn't implement the lifecycle, so no scenario ran.
        scope: lifecycle ? "scenario" : "boot",
        files: { count: scan.files, bytes: scan.bytes, largest: scan.largest },
        avatars,
        hosted: hosted.summary,
        findings: [
            ...scan.findings,
            ...hosted.findings,
            ...avatars.findings,
            ...(devices?.blocking ?? []),
            ...saved.findings,
            ...(listing?.findings ?? []),
            ...health.findings,
            ...(gameError ? [{ code: "GAME_FAILED", message: gameError }] : []),
            ...(reported?.findings ?? []),
            ...(report?.bootOnly ? pageErrors.map((message) => ({ code: "PAGE_ERROR", message })) : []),
            ...(!report && !gameError ? [{ code: "CHECK_TIMEOUT", message: `no report after ${Math.round((Date.now() - started) / 1000)} s` }] : []),
            ...(report?.stages ?? []).filter((s) => s.status === "failed" && s.stage !== "results").map((s) => ({ code: `STAGE_${s.stage.toUpperCase()}`, message: s.error ?? "failed" })),
            ...(social?.status === "failed" ? [{ code: "STAGE_SOCIAL", message: social.error ?? "failed" }] : []),
            ...(safeArea?.findings ?? []),
            ...party.findings,
            ...(loading?.findings ?? []),
            ...(locomotion?.status === "failed" ? [{ code: "STAGE_LOCOMOTION", message: locomotion.error }] : []),
        ],
        loading: loading && { ...loading, findings: undefined },
        social,
        safeArea,
        party: { status: party.status, ms: party.ms, ...party.detail },
        // Advice that never blocks: menu screens that don't use the UI kit, and what the scene costs.
        warnings: [...ui.warnings, ...scene.warnings],
        scene: { ...scene, warnings: undefined },
        ui: { screens: ui.screens },
        // Console errors are reported, not blocking: games load avatars and
        // other files from the network, which a check can't vouch for.
        ...(reported?.ran ? { results: reported.results } : {}),
        consoleErrors: errors.slice(0, 20),
        // The one contract: the form the build greeted in and the visit staged.
        contract: { listed: contract.listed, prefix: greeted?.prefix ?? null, version: greeted?.version ?? null, visit: contract.visit, warnings },
        devices: devices?.report,
        saved: { status: saved.status, ms: saved.ms, keys: saved.keys, runs: saved.runs },
        listing: listing?.summary ?? null,
        health: health.summary,
        credits: { thirdParty: rights.thirdParty, own: rights.own, warnings: rights.warnings },
        run: report,
        keys: keys?.report ?? null,
        ...(locomotion ? { locomotion } : {}),
    };
    // The process stage, last: brief, offer, solo, bot, arrival, handoff, video.
    result.process = await processStage({ id, root, manifest, chromium, headed, video, network });
    result.findings.push(...result.process.findings);
    if (result.process.status !== "passed") result.status = "failed";
    // The network (docs/games/trust.md), once every stage has run: the declaration, and any request any of them made to a host it doesn't list.
    result.network = network.summary();
    result.findings.push(...network.findings());
    if (network.findings().length) result.status = "failed";
    mkdirSync(reports, { recursive: true });
    writeFileSync(join(reports, "check.json"), JSON.stringify(result, null, 2) + "\n");
    const f = report?.frames;
    console.log(`${id}: ${result.status}` + (f ? ` · ${report.backend} · boot ${report.bootMs} ms · frames median ${f.medianMs} ms, p95 ${f.p95Ms} ms` : report ? ` · boot only, ready in ${report.bootMs} ms` : ""));
    if (loading) console.log(`  loading: ${loading.status}` + (loading.firstFrameMs != null ? ` · first frame ${loading.firstFrameMs} ms (budget ${loading.firstFrameBudgetMs} ms) · pause ${loading.pause.mode}: menu ${loading.pause.menu}, hidden ${loading.pause.hidden}` : ""));
    for (const note of loading?.notes ?? []) console.log(`  loading: ${note}`);
    for (const line of describeScene(scene, { warnings: false })) console.log(`  ${line}`);
    for (const line of describeSafeArea(safeArea)) console.log(`  ${line}`);
    if (saved.keys) console.log(`  saved data: ${saved.status} · ${saved.keys} key(s), ${saved.runs.length} boots`);
    console.log(`  ${describeProcess(result.process)}`);
    for (const finding of result.findings) console.log(`  ${finding.code}: ${finding.message}`);
    for (const warning of [...warnings, ...result.warnings]) console.log(`  warning ${warning.code}: ${warning.message}`);
    for (const line of devices?.lines ?? []) console.log(line);
    if (locomotion) console.log(`  locomotion: ${locomotion.status}` + (locomotion.metres != null ? ` · walked ${locomotion.metres} m in ${locomotion.seconds} s (the lobby: ${locomotion.lobbyMetres} m)` : ""));
    for (const warning of rights.warnings) console.log(`  warning ${warning.code}: ${warning.message}`);
    if (errors.length) console.log(`  ${errors.length} console error(s), first: ${errors[0]}`);
    for (const skip of avatars.skipped) console.log(`  avatars: ${skip.check} not checked: ${skip.why}`);
    console.log(`  report: ${shown(root, join(reports, "check.json"))} · screenshot: ${shown(root, join(source, ".check/screenshot.png"))}` + (result.process.video ? ` · video: ${result.process.video.path}` : ""));
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
    console.log(`${id}: published release ${version} (${files.length} files). Commit frontend/public/game-builds/${id}.`);
    // Hosted release: store the checked files. The pointer moves only for a game a person already switched to hosted releases (docs/games/releases.md); otherwise the page keeps loading the committed build.
    const target = releaseTarget();
    const { entry, pointed } = await publishRelease({ game: id, dir: out, files, ...target });
    console.log(`${id}: release ${entry.release} stored (${entry.backend}) at ${entry.base}; ` + (pointed ? `the page now loads it (pointer: ${relative(root, target.pointers)})` : `the page still loads the committed build. Switch with: pnpm games:release point ${id}`));
}
process.exit(result.status === "passed" ? 0 : 1);
