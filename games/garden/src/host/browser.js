import { bindBrowserInput, browserUI, createBrowserSession } from "@oncyber/game-runtime/browser";
import { RuntimeSession } from "@oncyber/game-runtime";
import { postCheckReport, runCheck } from "@oncyber/game-runtime/check";
import { reportHealth } from "@oncyber/game-runtime/health";
import scenario from "../../scenario.json";
import createGame, { debugHooks } from "../game/game.js";
import manifest from "../../game.json";
import { createHost } from "./host.js";
import { createAudio, play, setMuted, unlockAudio, updateAudio } from "./audio.js";

// The browser host for Bloom Garden's portable game: it creates the runtime
// session (WebGPU; a WebGL 2 fallback for older browsers only), mounts the UI
// page in its sandbox, and implements the services the game declares:
// storage, audio, avatar bytes, the multiplayer relay (through the Oncyber
// /garden page) and travel back to the lobby.

const DEFAULT_VRM =
    "https://cyber.mypinata.cloud/ipfs/QmX7XfjWmKPXYe6eX9Kr719JtgiGMJe8iNt1YEJDdpTMhG?filename=square.glb";
const AVATAR_MAX = 32 * 1024 * 1024;

const params = new URLSearchParams(location.search);
const canvas = document.querySelector("#world");
const frame = document.querySelector("#game-ui");
const notice = document.querySelector("#notice");
const page = createHost();
page.hello();
// Uncaught errors, failed lifecycle stages and frame times, reported to the page.
const health = reportHealth({ game: "garden" });

// Dev diagnostics for device simulators: ?log posts errors and state.
const remoteLog = params.has("log")
    ? (msg) => void fetch("/__log", { method: "POST", body: String(msg).slice(0, 4000) }).catch(() => {})
    : null;
if (remoteLog) {
    remoteLog(`start ua=${navigator.userAgent} gpu=${!!navigator.gpu} dpr=${devicePixelRatio} ${innerWidth}x${innerHeight}`);
    window.addEventListener("error", (e) => remoteLog(`error ${e.message} ${e.filename}:${e.lineno}`));
    window.addEventListener("unhandledrejection", (e) => remoteLog(`rejection ${e.reason?.stack || e.reason}`));
    for (const level of ["error", "warn"]) {
        const orig = console[level];
        console[level] = (...a) => {
            remoteLog(`${level} ${a.map((x) => x?.stack || x?.message || String(x)).join(" ")}`);
            orig.apply(console, a);
        };
    }
}

const fail = (message) => {
    notice.textContent = message;
    notice.classList.add("show");
};

// ------------------------------------------------------------- services

const audio = createAudio();
// Audio may only start inside a user gesture. A tap in the UI frame also
// activates this document, so unlock on the UI's first action and on our own.
const unlock = () => unlockAudio(audio);
window.addEventListener("pointerdown", unlock, { capture: true });
window.addEventListener("keydown", unlock, { capture: true });
window.addEventListener("message", (event) => {
    if (event.source === frame.contentWindow && event.data?.type === "oncyber:action") unlock();
});

// Peers and inbox from the page's room.
const room = { peers: [], inbox: [], vouched: new Set() };
page.on("peers", (data) => {
    room.peers = Array.isArray(data.players) ? data.players.slice(0, 32) : [];
    for (const p of room.peers) if (typeof p.vrm === "string" && p.vrm) room.vouched.add(p.vrm);
});
page.on("net", (data) => {
    if (typeof data.from !== "string") return;
    // Packets cross to the game as strings (the bridge limits JSON depth).
    room.inbox.push({ from: data.from, json: JSON.stringify(data.data ?? null) });
    if (room.inbox.length > 64) room.inbox.shift();
});

const avatars = new Map();
// services.avatar: only the visitor's avatar and those of players the room
// announced; fetched once, size-capped by us and by the runtime.
async function avatar(ref) {
    if (ref !== identity.avatar && !room.vouched.has(ref)) throw new Error("AVATAR_NOT_VOUCHED");
    const bytes = await avatarBytes(ref);
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}
function avatarBytes(ref) {
    if (!avatars.has(ref))
        avatars.set(
            ref,
            fetch(ref)
                .then((r) => {
                    if (!r.ok) throw new Error(`AVATAR_HTTP_${r.status}`);
                    return r.arrayBuffer();
                })
                .then((buf) => {
                    if (buf.byteLength > AVATAR_MAX) throw new Error("AVATAR_TOO_LARGE");
                    return new Uint8Array(buf);
                })
        );
    return avatars.get(ref);
}

let identity = null;
const json = (v) => JSON.parse(JSON.stringify(v ?? null));

async function call(capability, operation, value) {
    if (capability === "storage") {
        if (operation === "config")
            return {
                time: params.has("time") ? Number(params.get("time")) : null,
                grow: Number(params.get("grow")) || null,
                fast: Number(params.get("fast")) || null,
            };
        if (operation === "load") {
            try {
                return { data: JSON.parse(page.storage.get("save") || "null") };
            } catch {
                return { data: null };
            }
        }
        if (operation === "save") {
            return page.storage.set("save", JSON.stringify(value?.data ?? null));
        }
    }
    if (capability === "audio") {
        if (operation === "mute") {
            setMuted(audio, !!value?.muted);
            page.storage.set("muted", value?.muted ? "1" : "0");
            return true;
        }
        if (operation === "update") {
            for (const cue of Array.isArray(value?.cues) ? value.cues : []) play(audio, String(cue.n), cue);
            if (value?.env) updateAudio(audio, value.env);
            return true;
        }
    }
    if (capability === "network" && operation === "exchange") {
        const pose = value?.pose;
        if (pose) page.post("pose", pose);
        if (typeof value?.packet === "string" && page.selfId) {
            try {
                page.post("net", { data: JSON.parse(value.packet) });
            } catch {
                /* malformed packet: drop it */
            }
        }
        // Hand back as much of the inbox as fits one bridge message.
        const inbox = [];
        let size = JSON.stringify(room.peers).length;
        while (room.inbox.length) {
            const next = JSON.stringify(room.inbox[0]).length;
            if (size + next > 12000) break;
            size += next;
            inbox.push(room.inbox.shift());
        }
        return json({ self: page.selfId, online: !!page.selfId && page.embedded, peers: room.peers, inbox });
    }
    if (capability === "travel" && operation === "lobby") {
        page.exit();
        return true;
    }
    throw new Error("HOST_SERVICE_UNAVAILABLE");
}

async function asset(path, signal) {
    const r = await fetch(new URL(`./${path.replace(/^public\//, "")}`, location.href), { signal });
    if (!r.ok) throw new Error("ASSET_LOAD_FAILED");
    return r.arrayBuffer();
}

// ------------------------------------------------------------- session

/** WebGL 2 fallback for browsers without WebGPU (not a portable target). */
async function createFallbackSession(options) {
    let session;
    const bridge = browserUI(options.ui, () => session);
    const graphics = {
        canvas: options.canvas,
        context: null,
        device: null,
        width: options.canvas.clientWidth,
        height: options.canvas.clientHeight,
        pixelRatio: Math.min(devicePixelRatio, 2),
        decodeImage: (bytes, mimeType) =>
            createImageBitmap(new Blob([bytes], { type: mimeType }), { premultiplyAlpha: "none", colorSpaceConversion: "none" }),
    };
    session = new RuntimeSession(options.factory, { ...options, graphics, sendUI: bridge.publish, now: () => performance.now() });
    const cleanup = bindBrowserInput(session, options.manifest);
    let last = performance.now();
    let alive = true;
    let held = false;
    const tick = (now) => {
        if (!alive) return;
        if (held) {
            last = now;
            requestAnimationFrame(tick);
            return;
        }
        graphics.width = options.canvas.clientWidth;
        graphics.height = options.canvas.clientHeight;
        try {
            session.tick((now - last) / 1000);
        } catch (e) {
            options.onError(e);
        }
        last = now;
        requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    document.addEventListener("visibilitychange", () => {
        last = performance.now();
        if (document.hidden && session.phase === "entered") void session.suspend();
        else if (!document.hidden && session.phase === "suspended") void session.restore();
    });
    return {
        session,
        hold(paused) {
            held = paused;
            last = performance.now();
        },
        async dispose() {
            alive = false;
            cleanup();
            bridge.dispose();
            await session.dispose();
        },
    };
}

async function start() {
    const who = await page.resolveIdentity();
    audio.muted = page.storage.get("muted") === "1";
    identity = {
        id: "local-visitor",
        name: who.name || "You",
        avatar: who.avatarUrl || params.get("vrm") || DEFAULT_VRM,
    };
    const options = {
        canvas,
        ui: frame,
        manifest: manifest.runtime,
        services: { identity, asset, call, avatar },
        onError: (error) => {
            console.error("[garden]", error);
            health.stageFailed("update", error);
            if (/DEVICE_LOST|destroyed/i.test(error?.message || "")) fail("The graphics device was lost. Reload to keep playing.");
        },
    };
    const bootStart = performance.now();
    let backend = "webgpu";
    let host;
    const wantWebGL = params.has("webgl");
    if (!wantWebGL && navigator.gpu) {
        try {
            host = await createBrowserSession(createGame, options);
        } catch (err) {
            console.warn("[garden] WebGPU unavailable, using WebGL 2", err?.message || err);
        }
    }
    if (!host) backend = "webgl2";
    if (!host) host = await createFallbackSession({ ...options, factory: createGame });
    frame.src = "./ui.html";
    // Playtest hooks: with ?qa, or on a local dev server.
    if (params.has("qa") || /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
        window.__garden = debugHooks;
        window.__session = host.session;
        Object.defineProperty(window, "__photo", {
            configurable: true,
            set: (v) => (debugHooks.photo = v),
            get: () => debugHooks.photo,
        });
    }
    await health.stage("prepare", () => host.session.prepare());
    await health.stage("enter", () => host.session.enter({
        avatar: { id: identity.id, position: [0, 0, 13], rotation: [0, 1, 0, 0] },
        camera: { position: [0, 3.5, 20], target: [0, 1.3, 13], fov: 50, mode: "third-person" },
        party: [],
    }));
    page.ready();
    // pnpm games:check opens the game with ?check: play the scenario, measure
    // frames and report to the check page.
    if (params.has("check")) {
        const report = await runCheck({
            session: host.session,
            scenario,
            backend,
            bootMs: performance.now() - bootStart,
            frame: () => new Promise((resolve) => requestAnimationFrame(resolve)),
            pauseHostClock: (paused) => host.hold(paused),
        });
        postCheckReport(report);
    }
    if (remoteLog) setInterval(() => remoteLog(`state ${JSON.stringify(host.session.inspect())}`), 3000);
    const dispose = () => void host.dispose();
    page.on("dispose", dispose);
    window.addEventListener("pagehide", dispose, { once: true });
}

start().catch((err) => {
    console.error(err);
    page.fail(err?.message || "boot failed");
    fail("Bloom Garden needs a browser with WebGPU or WebGL 2.");
});
