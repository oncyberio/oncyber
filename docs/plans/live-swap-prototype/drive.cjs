// Drives the live-swap prototype in a real browser and prints what happened.
//
//   node drive.cjs [all|webgl2|webgpu|nokeep|manual]
//   GPU=real PW_CHANNEL=chrome HEADLESS=0 node drive.cjs   real GPU: present to the canvas on both backends
//   GPU=software (default)                                 headless software rendering (WebGPU cannot present there)
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium } = require("playwright");

const REAL = process.env.GPU === "real";
const LEAK_SWAPS = +(process.env.LEAK_SWAPS || 30);
const PROBATION_FRAMES = 25;

const serve = (dir, port) => new Promise((ok) => {
    const srv = http.createServer((req, res) => {
        const f = path.join(dir, decodeURIComponent(req.url.split("?")[0]).replace(/\/$/, "/index.html"));
        if (!f.startsWith(dir) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { "Content-Type": f.endsWith(".html") ? "text/html" : "text/javascript", "Access-Control-Allow-Origin": "*", "Cache-Control": "max-age=3600" });
        fs.createReadStream(f).pipe(res);
    }).listen(port, "127.0.0.1", () => ok(srv));
});

const WORLD = process.env.WORLD || "world";
const W = (p) => fs.readFileSync(path.join(__dirname, WORLD, p), "utf8");
const base = { "game.js": W("game.js"), "lib/player.js": W("lib/player.js"), "lib/props.js": W("lib/props.js") };
const edit = (file, from, to, src = base) => { if (!src[file].includes(from)) throw new Error("edit target missing: " + from); return { [file]: src[file].replace(from, to) }; };

async function session(browser, query, label) {
    const page = await browser.newPage({ viewport: { width: 980, height: 560 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 200)));
    page.on("console", (m) => { if (m.type() === "error" || /lost/i.test(m.text())) errors.push(m.text().slice(0, 200)); });
    await page.goto("http://127.0.0.1:8200/");
    const log = () => page.evaluate(() => window.liveLog);
    const clear = () => page.evaluate(() => (window.liveLog = []));
    const until = async (pred, what, ms = 90000) => {
        const t0 = Date.now();
        while (Date.now() - t0 < ms) { const hit = (await log()).find(pred); if (hit) return hit; await page.waitForTimeout(10); }
        throw new Error(`${label}: timeout waiting for ${what}; errors: ${JSON.stringify(errors.slice(-5))}; log tail: ${JSON.stringify((await log()).slice(-3))}`);
    };
    const send = (msg) => page.evaluate((m) => window.send(m), msg);
    const mount = async () => { await clear(); await page.evaluate((q) => window.mountFrame(q), query); return until((m) => m.kind === "booted", "boot"); };
    let probeId = 0;
    const probe = async (pixels = false) => { const id = ++probeId; await send({ type: "probe", id, pixels }); return until((m) => m.kind === "probe" && m.id === id, "probe"); };
    const apply = async (files, opts) => { await clear(); await send({ type: "files", files, opts }); return until((m) => m.kind === "applied" && m.outcome !== "superseded", "applied"); };
    const settle = async (r) => { // wait for the probation outcome of a swap
        if (r.outcome !== "swapped" && r.outcome !== "swapped-state-reset") return r;
        const end = await until((m) => m.kind === "committed" || m.kind === "reverted", "commit/revert");
        r.after = end.kind; if (end.error) r.revertError = end.error;
        return r;
    };
    const step = async (n) => { await clear(); await send({ type: "step", n }); return until((m) => m.kind === "stepped", "stepped"); };
    return { page, errors, log, clear, until, send, mount, probe, apply, settle, step };
}

const brief = (r) => ({ outcome: r.outcome + (r.after ? " → " + r.after : ""), totalMs: r.ms, loadMs: r.loadMs, prepareMs: r.prepareMs, commitMs: r.commitMs,
    framesDuring: r.framesDuring, maxFrameGapMs: r.maxFrameGapMs, keep: `${r.keepHits} kept / ${r.keepMisses} rebuilt`,
    ...(r.stage ? { stage: r.stage } : {}), ...(r.error ? { error: r.error.slice(0, 70) } : {}), ...(r.revertError ? { revertError: r.revertError.slice(0, 60) } : {}) });

async function realtime(browser, backend, extra = "") {
    const present = REAL || backend === "webgl2";
    const s = await session(browser, `backend=${backend}&present=${present ? 1 : 0}${extra}`, backend + extra);
    const out = { backend, options: extra || "(default)", gpu: REAL ? "real" : "software" };
    const t0 = Date.now();
    await s.mount();
    out.coldStart = { ...brief(await s.apply(base)), wallMsFromFrameCreate: Date.now() - t0 };
    await s.send({ type: "action", action: "moveX", value: 1 });
    await s.page.waitForTimeout(700);
    await s.send({ type: "action", action: "jump", value: 1 }); await s.send({ type: "action", action: "jump", value: 0 });
    await s.page.waitForTimeout(800);
    const pA = await s.probe(), tA = Date.now(); await s.page.waitForTimeout(1000); const pB = await s.probe(), tB = Date.now();
    out.steady = { backend: pB.backend, simFps: +(((pB.frame - pA.frame) / (tB - tA)) * 1000).toFixed(1), updateCostMs: pB.frameCostMs, memory: pB.memory,
        sandbox: { origin: pB.origin, canReachParent: pB.reachParent, storage: pB.storage } };
    if (present) await s.page.screenshot({ path: path.join(__dirname, `shot-${backend}-before.png`) });

    const cases = [
        ["visual edit (ground colours)", edit("game.js", "GROUND_A = 0x1f3d2b", "GROUND_A = 0x5a2d82")],
        ["logic edit (jump strength)", edit("lib/player.js", "JUMP = 7", "JUMP = 11")],
        ["syntax error", edit("lib/player.js", "JUMP = 7", "JUMP = = 11")],
        ["prepare() throws", edit("game.js", "scene = new THREE.Scene();", "scene = new THREE.Scene(); throw new Error('boom in prepare');")],
        ["enter() throws", edit("game.js", "[s.player.x, s.player.y, s.player.z] = continuity.avatar.position;", "throw new Error('boom in enter');")],
        ["update() throws on 5th frame", edit("game.js", "s.t += dt;", "s.t += dt; if ((s.__n = (s.__n || 0) + 1) === 5) throw new Error('boom in update');")],
        ["heavy edit (300 → 400 props)", edit("game.js", "PROPS = 300", "PROPS = 400")],
        ["new state field, old snapshot", edit("lib/player.js", "maxY: 0, jumps: 0 })", "maxY: 0, jumps: 0, stamina: 100 })")],
        ["state shape break (stateVersion 1)", edit("game.js", "export const stateVersion = 0;", "export const stateVersion = 1;")],
    ];
    out.swaps = [];
    for (const [name, files] of cases) {
        const before = (await s.probe()).inspect;
        const r = await s.settle(await s.apply({ ...base, ...files }));
        await s.page.waitForTimeout(250);
        const after = (await s.probe()).inspect;
        out.swaps.push({ name, ...brief(r), x: `${before.x.toFixed(1)} → ${after.x.toFixed(1)}`, t: `${before.t.toFixed(1)} → ${after.t.toFixed(1)}`, jumps: `${before.jumps} → ${after.jumps}` });
    }
    // a bigger world: 96 material kinds, 600 props; then a small edit on top of it
    const big = { ...base, ...edit("game.js", "PROPS = 300, KINDS = 24", "PROPS = 600, KINDS = 96") };
    out.bigger = { grow: brief(await s.settle(await s.apply(big))) };
    out.bigger.smallEditAfter = brief(await s.settle(await s.apply({ ...big, ...edit("game.js", "GROUND_B = 0x4f7f55", "GROUND_B = 0x7f4f55", big) })));

    // back to the base source, then a data-only change: no code swap at all
    await s.settle(await s.apply(base));
    const a = (await s.probe()).inspect; await s.page.waitForTimeout(400); const b = (await s.probe()).inspect;
    await s.send({ type: "params", params: { speed: 18 } });
    const c = (await s.probe()).inspect; await s.page.waitForTimeout(400); const d = (await s.probe()).inspect;
    out.dataOnly = { unitsPerSecondBefore: +((b.x - a.x) / (b.t - a.t)).toFixed(2), unitsPerSecondAfter: +((d.x - c.x) / (d.t - c.t)).toFixed(2) };

    // typing fast: 8 edits sent back to back
    await s.clear();
    const tBurst = Date.now();
    for (let i = 0; i < 8; i++) await s.send({ type: "files", files: edit("game.js", "GROUND_B = 0x4f7f55", `GROUND_B = 0x${(0x101010 * (i + 2)).toString(16)}`) });
    await s.until((m) => m.kind === "applied" && m.outcome === "swapped", "burst swap");
    const burstMs = Date.now() - tBurst;
    await s.until((m) => m.kind === "committed", "burst commit");
    const burst = (await s.log()).filter((m) => m.kind === "applied");
    out.burst = { editsSent: 8, swapsDone: burst.filter((m) => m.outcome === "swapped").length, superseded: burst.filter((m) => m.outcome === "superseded").length, msUntilLatestIsLive: burstMs };

    // leak check: many swaps alternating two visual variants
    const m0 = await s.probe();
    for (let i = 0; i < LEAK_SWAPS; i++) await s.settle(await s.apply({ ...base, ...edit("game.js", "GROUND_A = 0x1f3d2b", i % 2 ? "GROUND_A = 0x803030" : "GROUND_A = 0x303080") }));
    const m1 = await s.probe(true);
    out.leak = { swaps: LEAK_SWAPS, gpuObjectsBefore: m0.memory, gpuObjectsAfter: m1.memory, heapBeforeMB: m0.heapMB, heapAfterMB: m1.heapMB, keptAtEnd: m1.keptKeys.join(","), pixelsAtEnd: m1.pixels };
    if (present) await s.page.screenshot({ path: path.join(__dirname, `shot-${backend}-after.png`) });

    // What a world with no lifecycle contract gets: reload the whole frame (state lost)
    const tR = Date.now();
    await s.mount();
    const cold = await s.apply(base);
    out.fullFrameReload = { wallMs: Date.now() - tR, prepareMs: cold.prepareMs, stateKept: false };
    out.errors = [...new Set(s.errors)].slice(0, 6);
    await s.page.close();
    return out;
}


// How much a swap costs depending on what the world keeps (bigger world: 96 materials, 600 props).
async function granularity(browser, extra = "") {
    const s = await session(browser, `backend=webgpu&present=${REAL ? 1 : 0}${extra}`, "granularity" + extra);
    const out = { world: WORLD, options: extra || "(default)" };
    await s.mount();
    const big = { ...base, ...edit("game.js", "PROPS = 300, KINDS = 24", "PROPS = 600, KINDS = 96") };
    out.coldStartBigWorld = brief(await s.apply(big));
    await s.send({ type: "action", action: "moveX", value: 1 });
    await s.page.waitForTimeout(500);
    const p0 = await s.probe();
    out.start = { memory: p0.memory, heapMB: p0.heapMB };
    const runs = { logic: [], ground: [] };
    for (let i = 0; i < +(process.env.GRAN_N || 4); i++) {
        runs.logic.push(brief(await s.settle(await s.apply({ ...big, ...edit("lib/player.js", "JUMP = 7", `JUMP = ${8 + i}`) }))));
        runs.ground.push(brief(await s.settle(await s.apply({ ...big, ...edit("lib/player.js", "JUMP = 7", `JUMP = ${8 + i}`), ...edit("game.js", "GROUND_B = 0x4f7f55", `GROUND_B = 0x${(0x101010 * (i % 14 + 1)).toString(16)}`, big) }))));
    }
    const med = (a, k) => a.map((r) => r[k]).sort((x, y) => x - y)[Math.floor(a.length / 2)];
    out.logicEdit = { outcomes: runs.logic.map((r) => r.outcome), prepareMs: runs.logic.map((r) => r.prepareMs), medianPrepareMs: med(runs.logic, "prepareMs"), maxFrameGapMs: Math.max(...runs.logic.map((r) => r.maxFrameGapMs)), keep: runs.logic[0].keep };
    out.groundEdit = { outcomes: runs.ground.map((r) => r.outcome), prepareMs: runs.ground.map((r) => r.prepareMs), medianPrepareMs: med(runs.ground, "prepareMs"), maxFrameGapMs: Math.max(...runs.ground.map((r) => r.maxFrameGapMs)), keep: runs.ground[0].keep };
    const p = await s.probe();
    out.end = { inspect: p.inspect, memory: p.memory, heapMB: p.heapMB };
    out.errors = [...new Set(s.errors)].slice(0, 6);
    await s.page.close();
    return out;
}

// Visual check on the backend that can present here: screenshot before and after two swaps.
async function shot(browser) {
    const s = await session(browser, "backend=webgl2&present=1", "shot");
    await s.mount();
    const out = { world: WORLD, cold: brief(await s.apply(base)) };
    await s.send({ type: "action", action: "moveX", value: 1 });
    await s.page.waitForTimeout(1500);
    await s.send({ type: "action", action: "moveX", value: 0 });
    await s.page.screenshot({ path: path.join(__dirname, `shot-${WORLD}-before.png`) });
    out.logic = brief(await s.settle(await s.apply({ ...base, ...edit("lib/player.js", "JUMP = 7", "JUMP = 11") })));
    out.ground = brief(await s.settle(await s.apply({ ...base, ...edit("lib/player.js", "JUMP = 7", "JUMP = 11"), ...edit("game.js", "GROUND_A = 0x1f3d2b", "GROUND_A = 0x5a2d82") })));
    out.bad = brief(await s.settle(await s.apply({ ...base, ...edit("game.js", "s.t += dt;", "s.t += dt; if ((s.__n = (s.__n || 0) + 1) === 5) throw new Error('boom in update');") })));
    await s.page.waitForTimeout(600);
    const p = await s.probe(true);
    out.after = { inspect: p.inspect, pixels: p.pixels, memory: p.memory, phase: p.phase };
    await s.page.screenshot({ path: path.join(__dirname, `shot-${WORLD}-after.png`) });
    out.errors = [...new Set(s.errors)].slice(0, 6);
    await s.page.close();
    return out;
}

async function deterministic(browser) {
    const s = await session(browser, "backend=webgl2&present=1&manual=1", "manual");
    await s.mount();
    await s.apply(base);
    const out = {};
    await s.step(60);
    await s.send({ type: "action", action: "moveX", value: 1 });
    await s.step(30);
    await s.send({ type: "action", action: "jump", value: 1 });
    await s.step(1);
    await s.send({ type: "action", action: "jump", value: 0 });
    await s.step(119);
    const before = (await s.probe()).inspect;
    // 1. rewind 150 frames and replay the recorded input through the same code
    await s.clear(); await s.send({ type: "rewind", frames: 150, replay: true });
    const r1 = await s.until((m) => m.kind === "rewound", "rewound");
    out.replaySameCode = { replayedFrames: r1.replayed, endsInSameState: r1.matches };
    // 2. change the jump, and replay the last 150 frames through the NEW code
    const r2 = await s.apply({ ...base, ...edit("lib/player.js", "JUMP = 7", "JUMP = 11") }, { replayFrames: 150 });
    const after = (await s.probe()).inspect;
    out.swapThenReplay = { outcome: r2.outcome, replayedFrames: r2.replay?.replayed, jumpPeak: `${before.maxY} → ${after.maxY}`, x: `${before.x} → ${after.x}`, clock: `${before.t} → ${after.t}` };
    await s.step(PROBATION_FRAMES);
    // 3. a world that uses Math.random in its rules: the host must notice the replay diverges
    await s.apply({ ...base, ...edit("lib/player.js", "p.x += (input.moveX || 0) * speed * dt;", "p.x += (input.moveX || 0) * speed * dt + (Math.random() - 0.5) * 0.01;") });
    await s.step(200);
    await s.clear(); await s.send({ type: "rewind", frames: 100, replay: true });
    const r3 = await s.until((m) => m.kind === "rewound", "rewound");
    out.replayWithRandomInRules = { replayedFrames: r3.replayed, endsInSameState: r3.matches };
    // 4. plain rewind (no replay)
    const b4 = (await s.probe()).inspect;
    await s.clear(); await s.send({ type: "rewind", frames: 90, replay: false });
    const r4 = await s.until((m) => m.kind === "rewound", "rewound");
    const a4 = (await s.probe()).inspect;
    out.rewindOnly = { ok: r4.ok, clock: `${b4.t} → ${a4.t}` };
    out.errors = [...new Set(s.errors)].slice(0, 6);
    await s.page.close();
    return out;
}

(async () => {
    const servers = [await serve(path.join(__dirname, "host"), 8200), await serve(path.join(__dirname, "rt"), 8201)];
    const args = REAL ? ["--enable-unsafe-webgpu", "--enable-precise-memory-info", "--js-flags=--expose-gc"] : ["--enable-unsafe-webgpu", "--enable-unsafe-swiftshader", "--enable-precise-memory-info", "--js-flags=--expose-gc"];
    const browser = await chromium.launch({ args, channel: process.env.PW_CHANNEL || undefined, headless: process.env.HEADLESS !== "0" });
    const which = process.argv[2] || "all";
    const results = { browser: browser.version(), gpu: REAL ? "real" : "software" };
    const run = async (key, fn) => { try { results[key] = await fn(); } catch (e) { results[key] = { failure: String(e.stack || e).slice(0, 1200) }; } };
    if (which === "all" || which === "webgl2") await run("webgl2", () => realtime(browser, "webgl2", process.env.EXTRA || ""));
    if (which === "all" || which === "webgpu") await run("webgpu", () => realtime(browser, "webgpu", process.env.EXTRA || ""));
    if (which === "all" || which === "nokeep") await run("webgpu_nokeep", () => realtime(browser, "webgpu", (process.env.EXTRA || "") + "&nokeep=1"));
    if (which === "shot") await run("shot", () => shot(browser));
    if (which === "granularity") await run("granularity", () => granularity(browser, process.env.EXTRA || ""));
    if (which === "all" || which === "manual") await run("deterministic", () => deterministic(browser));
    const file = path.join(__dirname, process.env.OUT || "results.json");
    fs.writeFileSync(file, JSON.stringify(results, null, 1));
    console.log(JSON.stringify(results, null, 1));
    await browser.close(); servers.forEach((s) => s.close());
    process.exit(0);
})();
