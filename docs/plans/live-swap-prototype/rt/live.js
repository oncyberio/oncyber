// Live draft host. Runs INSIDE the opaque sandbox (iframe sandbox="allow-scripts").
//
// The world follows the existing portable lifecycle:
//   export default function createGame(ctx) ->
//     { prepare, enter, update(dt), suspend, restore, dispose, inspect }
//
// A code update is a journey from version N to version N+1 of the same world:
//   prepare N+1 in the background while N keeps playing
//   -> at a frame boundary: N.suspend() gives a snapshot
//   -> N+1.enter(continuity), N+1.restore(snapshot)
//   -> N stays suspended for a short probation, then is disposed
// Anything that throws before or during probation puts N back.
//
// The host (this file) owns: the canvas, the clock, input, the snapshot ring,
// the input log, and a cache of expensive things that outlive one version.

const q = new URLSearchParams(location.search);
const BACKEND = q.get("backend") || "webgl2"; // "webgl2" | "webgpu"
const PRESENT = q.get("present") !== "0"; // software WebGPU here cannot present to a canvas
const MANUAL = q.get("manual") === "1"; // frames advance only on request (deterministic tests)
const NOKEEP = q.get("nokeep") === "1"; // rebuild everything on every swap, to show what keep() saves
const FREEZE = q.get("freeze") === "1"; // pause the old version while the new one prepares (measures prepare alone)
const [W, H] = (q.get("size") || "960x540").split("x").map(Number), STEP = 1 / 60, PROBATION = 20;
let preparing = false;

const host = window.parent;
const report = (m) => host.postMessage({ tag: "live", ...m }, "*");
window.addEventListener("error", (e) => report({ kind: "error", where: "window", message: String(e.message) }));
window.addEventListener("unhandledrejection", (e) => report({ kind: "error", where: "promise", message: String(e.reason) }));

const canvas = document.createElement("canvas");
canvas.width = W; canvas.height = H;
document.body.appendChild(canvas);

// ---- things that outlive one version of the code ---------------------------
// keep(key, deps, make, dispose): same key + same deps => the same object comes
// back in the next version, with no rebuild. A version only pays for what its
// edit actually touched. Entries no live version asks for are disposed.
const kept = new Map(); // id -> { value, dispose, users:Set<versionId> }
const stats = { keepHits: 0, keepMisses: 0 };
function makeKeep(vid) {
    return async (key, deps, make, dispose) => {
        const id = key + "|" + JSON.stringify(NOKEEP && key !== "renderer" ? [...deps, vid] : deps);
        let e = kept.get(id);
        if (e) { e.users.add(vid); stats.keepHits++; return e.value; }
        e = { value: null, dispose, users: new Set([vid]) };
        kept.set(id, e);
        stats.keepMisses++;
        try { e.value = Promise.resolve(make()); return await e.value; }
        catch (err) { kept.delete(id); throw err; }
    };
}
async function releaseKeeps(vid) {
    for (const [id, e] of kept) {
        e.users.delete(vid);
        if (e.users.size === 0) {
            kept.delete(id);
            try { e.dispose?.(await e.value); } catch (err) { report({ kind: "error", where: "keep.dispose", message: String(err) }); }
        }
    }
}

// ---- module graph: source text -> blob modules ------------------------------
// Blob URLs belong to the origin that made them, so the parent cannot build
// these for us: the sandbox makes its own from the text it is sent.
let files = {};
const depsOf = (src) => [...src.matchAll(/from\s+["'](\.{1,2}\/[^"']+)["']/g)].map((m) => m[1]);
const resolve = (from, rel) => new URL(rel, "file:///" + from).pathname.slice(1);
function buildGraph(entry) {
    const urls = {}, made = [];
    const visit = (path, stack = []) => {
        if (urls[path]) return urls[path];
        if (!(path in files)) throw new Error(`Missing module ${path}`);
        if (stack.includes(path)) throw new Error(`Import cycle through ${path}`);
        const code = files[path].replace(/from\s+(["'])(\.{1,2}\/[^"']+)\1/g,
            (_, quote, rel) => `from "${visit(resolve(path, rel), [...stack, path])}"`);
        const url = URL.createObjectURL(new Blob([code, `\n//# sourceURL=world/${path}`], { type: "text/javascript" }));
        made.push(url);
        return (urls[path] = url);
    };
    return { entry: visit(entry), revoke: () => made.forEach((u) => URL.revokeObjectURL(u)) };
}

// ---- versions -----------------------------------------------------------------
let nextVid = 1, applySeq = 0, current = null, busy = Promise.resolve();
let frame = 0, frameCost = 0, maxGap = 0, rafCount = 0;
const params = {}; // data the world reads every frame; changing it needs no code swap
const input = Object.create(null), pressedNow = new Set(), deltas = Object.create(null);
const inputLog = []; // { frame, action, value } - the host records, so it can replay
const snapshots = []; // { frame, state } ring
const inspectLog = new Map(); // frame -> JSON of inspect(), for replay comparison

const graphics = {
    canvas, width: W, height: H, pixelRatio: 1, backend: BACKEND,
    // Test-harness convenience: build the three renderer for the configured backend.
    async createRenderer(THREE) {
        const r = new THREE.WebGPURenderer({ canvas, antialias: false, forceWebGL: BACKEND === "webgl2" });
        await r.init();
        r.setSize(W, H, false);
        if (!PRESENT) { r.__rt = new THREE.RenderTarget(W, H); r.setRenderTarget(r.__rt); }
        return r;
    },
};

function makeVersion(factory) {
    const vid = nextVid++;
    const owned = [];
    const abort = new AbortController();
    const ctx = {
        graphics, params, signal: abort.signal,
        input: new Proxy({}, { get: (_, k) => input[k] ?? 0 }),
        pressed: new Proxy({}, { get: (_, k) => pressedNow.has(k) }),
        deltas: new Proxy({}, { get: (_, k) => deltas[k] ?? 0 }),
        keep: makeKeep(vid),
        own: (d) => (owned.push(d), d),
        ui: { publish() {} },
    };
    return { vid, ctx, owned, abort, game: factory(ctx), phase: "created", frames: 0, probation: 0, prev: null, swapSnapshot: null };
}
async function disposeVersion(v) {
    if (!v || v.phase === "disposed") return;
    v.phase = "disposed"; v.abort.abort();
    try { await v.game.dispose?.(); } catch (e) { report({ kind: "error", where: "dispose", message: String(e) }); }
    for (const d of v.owned.splice(0)) { try { d.dispose?.(); } catch {} }
    await releaseKeeps(v.vid);
    v.revoke?.();
}

const continuityOf = (v) => {
    const s = v?.game.inspect?.() ?? {};
    return { avatar: { position: [s.x ?? 0, s.y ?? 0, s.z ?? 0], rotation: [0, 0, 0, 1] },
        camera: { position: [0, 6, 12], target: [0, 1, 0], fov: 60, mode: "third-person" }, party: [] };
};

// The decision. Not declared by the world and not guessed by the agent: the host
// tries the swap, checks it, and reports what actually happened.
let editorFiles = {}; // what the editor holds now (may be ahead of the running version)
let pendingFiles = null, applying = false;
function queueFiles(f, opts) { // edits that arrive mid-swap are merged: the latest text wins
    pendingFiles = { files: { ...(pendingFiles?.files ?? {}), ...f }, opts };
    if (!applying) drain();
}
async function drain() {
    applying = true;
    while (pendingFiles) { const p = pendingFiles; pendingFiles = null; await applyFiles(p.files, p.opts); }
    applying = false;
}
async function applyFiles(newFiles, opts = {}) {
    const seq = ++applySeq, t0 = performance.now(), framesBefore = frame, raf0 = rafCount;
    maxGap = 0;
    editorFiles = { ...editorFiles, ...newFiles };
    const running = current?.files ?? {};
    const changed = Object.keys(editorFiles).filter((p) => running[p] !== editorFiles[p]);
    const hits0 = stats.keepHits, miss0 = stats.keepMisses;
    const marks = {};
    const done = (r) => report({ kind: "applied", seq, changed, ms: +(performance.now() - t0).toFixed(1), ...marks,
        framesDuring: frame - framesBefore, rafDuring: rafCount - raf0, maxFrameGapMs: +maxGap.toFixed(1), keepHits: stats.keepHits - hits0, keepMisses: stats.keepMisses - miss0, ...r });

    files = editorFiles;
    let graph, mod;
    try { graph = buildGraph("game.js"); mod = await import(graph.entry); }
    catch (e) { graph?.revoke(); return done({ outcome: "rejected", stage: "load", error: String(e) }); }
    if (typeof mod.default !== "function") { graph.revoke(); return done({ outcome: "rejected", stage: "load", error: "game.js must default-export createGame(ctx)" }); }
    marks.loadMs = +(performance.now() - t0).toFixed(1);

    let next;
    const t1 = performance.now();
    try {
        next = makeVersion(mod.default); next.revoke = graph.revoke; next.files = editorFiles;
        next.phase = "preparing"; preparing = true;
        await next.game.prepare(); // the old version keeps running while this happens
        next.phase = "ready";
    } catch (e) { preparing = false; await disposeVersion(next); return done({ outcome: "rolled-back", stage: "prepare", error: String(e) }); }
    preparing = false;
    marks.prepareMs = +(performance.now() - t1).toFixed(1);
    const t2 = performance.now();
    if (pendingFiles) { await disposeVersion(next); return done({ outcome: "superseded" }); } // a newer edit is waiting

    // Commit at a frame boundary.
    const prev = current;
    let snapshot = null;
    try {
        if (prev) { prev.phase = "suspended"; snapshot = structuredClone(await prev.game.suspend()); }
        await next.game.enter(continuityOf(prev));
        const carry = prev && (mod.stateVersion ?? 0) === (prev.stateVersion ?? 0);
        if (carry) await next.game.restore(structuredClone(snapshot));
        next.stateVersion = mod.stateVersion ?? 0;
        next.prev = prev; next.swapSnapshot = snapshot; next.probation = prev ? PROBATION : 0;
        next.phase = "entered"; current = next;
        marks.commitMs = +(performance.now() - t2).toFixed(1);
        if (!prev) return done({ outcome: "mounted" });
        let replay = null;
        if (opts.replayFrames) replay = await rewind(opts.replayFrames, true);
        return done({ outcome: carry ? "swapped" : "swapped-state-reset", replay });
    } catch (e) {
        await disposeVersion(next);
        if (prev) { await prev.game.restore(snapshot); prev.phase = "entered"; current = prev; }
        return done({ outcome: "rolled-back", stage: "enter", error: String(e) });
    }
}

async function revert(v, error) { // a version failed inside its probation: put the last good one back
    const prev = v.prev;
    current = null;
    await disposeVersion(v);
    await prev.game.restore(v.swapSnapshot);
    prev.phase = "entered"; current = prev;
    report({ kind: "reverted", error: String(error), toVersion: prev.vid });
}

// ---- clock, input, snapshots ---------------------------------------------------
function setAction(action, value, log = true) {
    if (value > 0 && !(input[action] > 0)) pressedNow.add(action);
    input[action] = value;
    if (log) inputLog.push({ frame, action, value });
}
function simFrame(render = true) {
    const v = current;
    if (!v || v.phase !== "entered" || (FREEZE && preparing)) return false;
    try {
        v.ctx.render = render;
        const f0 = performance.now();
        v.game.update(STEP);
        frameCost = frameCost * 0.9 + (performance.now() - f0) * 0.1;
    } catch (e) {
        if (v.probation > 0 && v.prev) { v.phase = "reverting"; busy = busy.then(() => revert(v, e)); return false; }
        v.phase = "failed"; report({ kind: "error", where: "update", message: String(e) }); return false;
    }
    pressedNow.clear(); for (const k in deltas) deltas[k] = 0;
    v.frames++; frame++;
    if (v.probation > 0 && --v.probation === 0 && v.prev) {
        const old = v.prev; v.prev = null; v.swapSnapshot = null;
        busy = busy.then(() => disposeVersion(old)).then(() => report({ kind: "committed", version: v.vid }));
    }
    if (frame % 30 === 0) {
        snapshots.push({ frame, state: structuredClone(v.game.snapshot ? v.game.snapshot() : v.game.inspect()) });
        if (snapshots.length > 40) snapshots.shift();
    }
    inspectLog.set(frame, JSON.stringify(v.game.inspect()));
    if (inspectLog.size > 1200) inspectLog.delete(inspectLog.keys().next().value);
    return true;
}
// Rewind: restore an earlier snapshot. Replay: run the recorded inputs forward
// again (through the CURRENT code) back to now, then say if the result matches.
async function rewind(frames, replay) {
    const v = current, target = frame - frames;
    const snap = [...snapshots].reverse().find((s) => s.frame <= target);
    if (!snap) { const r0 = { kind: "rewound", ok: false }; report(r0); return r0; }
    const now = frame, wasInput = { ...input }, before = inspectLog.get(now);
    await v.game.restore(structuredClone(snap.state));
    if (!replay) { frame = snap.frame; snapshots.length = snapshots.findIndex((s) => s === snap) + 1; const r1 = { kind: "rewound", ok: true, toFrame: snap.frame }; report(r1); return r1; }
    for (const k in input) input[k] = 0;
    for (const e of inputLog) if (e.frame < snap.frame) input[e.action] = e.value; // input level at the snapshot
    frame = snap.frame;
    const saved = [...snapshots]; const savedInspect = new Map(inspectLog);
    while (frame < now) {
        for (const e of inputLog) if (e.frame === frame) setAction(e.action, e.value, false);
        if (!simFrame(false)) break;
    }
    snapshots.length = 0; snapshots.push(...saved.filter((s) => s.frame <= snap.frame));
    for (const k in wasInput) input[k] = wasInput[k];
    const after = JSON.stringify(v.game.inspect());
    void savedInspect;
    const r2 = { kind: "rewound", ok: true, replayed: now - snap.frame, matches: after === before, before, after };
    report(r2); return r2;
}

if (!MANUAL) {
    let acc = 0, last = performance.now();
    const loop = (now) => {
        if (applying && now - last > maxGap) maxGap = now - last;
        rafCount++;
        acc += Math.min(0.1, (now - last) / 1000); last = now;
        let n = 0;
        while (acc >= STEP && n++ < 4) { simFrame(); acc -= STEP; }
        requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
}

window.addEventListener("message", (e) => {
    if (e.source !== host) return;
    const m = e.data;
    if (m.type === "files") return queueFiles(m.files, m.opts);
    busy = busy.then(async () => {
        if (m.type === "params") { Object.assign(params, m.params); report({ kind: "params", params: { ...params } }); }
        else if (m.type === "action") setAction(m.action, m.value);
        else if (m.type === "step") { for (let i = 0; i < m.n; i++) { simFrame(); await busy0(); } report({ kind: "stepped", frame }); }
        else if (m.type === "rewind") await rewind(m.frames, m.replay);
        else if (m.type === "probe") await probe(m.id, m.pixels);
    }).catch((err) => report({ kind: "error", where: "host", message: String(err?.stack || err) }));
});
const busy0 = () => Promise.resolve();

async function probe(id, withPixels) {
    const v = current;
    const r = await kept.get([...kept.keys()].find((k) => k.startsWith("renderer|")))?.value;
    let pixels = null;
    if (r && withPixels) {
        if (r.__rt) {
            const px = await Promise.race([r.readRenderTargetPixelsAsync(r.__rt, 0, 0, W, H), new Promise((ok) => setTimeout(() => ok(null), 4000))]);
            pixels = px ? summarize(px) : "readback timed out";
        } else {
            // read the canvas in the same task as a render, before the browser clears it
            current?.game.update(0);
            const c2 = document.createElement("canvas"); c2.width = W; c2.height = H;
            const g = c2.getContext("2d"); g.drawImage(canvas, 0, 0);
            pixels = summarize(g.getImageData(0, 0, W, H).data);
        }
    }
    let reachParent = false; try { reachParent = !!host.document; } catch {}
    let storage = "blocked"; try { localStorage.setItem("x", "1"); storage = "open"; } catch {}
    report({ kind: "probe", id, frame, frameCostMs: +frameCost.toFixed(2), version: v?.vid, phase: v?.phase, inspect: v?.game.inspect(),
        keptKeys: [...kept.keys()].map((k) => k.split("|")[0]).sort(),
        memory: r ? { geometries: r.info.memory.geometries, textures: r.info.memory.textures } : null,
        heapMB: (globalThis.gc?.(), performance.memory) ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
        pixels, origin: self.origin, reachParent, storage,
        backend: r ? (r.backend.isWebGPUBackend ? "webgpu" : "webgl2") : null });
}
function summarize(px) { // is something actually drawn? count distinct coarse colours
    const seen = new Set(); let lit = 0;
    for (let i = 0; i < px.length; i += 4 * 97) { seen.add((px[i] >> 4) + "," + (px[i + 1] >> 4) + "," + (px[i + 2] >> 4)); if (px[i] + px[i + 1] + px[i + 2] > 24) lit++; }
    return { distinctColours: seen.size, litShare: +(lit / (px.length / (4 * 97))).toFixed(2) };
}

report({ kind: "booted", backend: BACKEND, present: PRESENT, manual: MANUAL });
