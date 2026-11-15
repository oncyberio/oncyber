import { RuntimeSession } from "@oncyber/game-runtime";
import { bindBrowserInput } from "@oncyber/game-runtime/browser";
import { postCheckReport, runCheck } from "@oncyber/game-runtime/check";
import scenario from "../../scenario.json";
import manifest from "../../game.json";
import createGame, { debugHooks } from "../game/game.js";
import { createHost } from "./host.js";
import { createAudio, play, setMuted, unlockAudio, updateAudio } from "./audio.js";
import { createHUD } from "./hud.js";
import "./hud.css";

// The browser host for Skyhoop: it creates the WebGPU device (WebGL 2 for
// older browsers), runs the lifecycle session, draws the HUD from what the
// game publishes, turns mouse, keys, touch and gamepads into the declared
// input actions, plays the sounds the game cues and relays the lobby
// handoff from the Oncyber page.

const DEFAULT_VRM = "https://cyber.mypinata.cloud/ipfs/QmX7XfjWmKPXYe6eX9Kr719JtgiGMJe8iNt1YEJDdpTMhG?filename=square.glb";
const AVATAR_MAX = 32 * 1024 * 1024;

const params = new URLSearchParams(location.search);
const canvas = document.querySelector("#world");
const notice = document.querySelector("#notice");
const hudRoot = document.querySelector("#hud");
const page = createHost();
page.hello();

const fail = (message) => {
    notice.textContent = message;
    notice.classList.add("show");
};

// ------------------------------------------------------------- services

const audio = createAudio();
audio.muted = false;
const unlock = () => unlockAudio(audio);
window.addEventListener("pointerdown", unlock, { capture: true });
window.addEventListener("keydown", unlock, { capture: true });

let identity = null;
let avatarBytes = null;
async function avatar(ref) {
    if (ref !== identity.avatar) throw new Error("AVATAR_NOT_VOUCHED");
    if (!avatarBytes)
        avatarBytes = fetch(ref)
            .then((r) => {
                if (!r.ok) throw new Error(`AVATAR_HTTP_${r.status}`);
                return r.arrayBuffer();
            })
            .then((buf) => {
                if (buf.byteLength > AVATAR_MAX) throw new Error("AVATAR_TOO_LARGE");
                return buf;
            });
    const buf = await avatarBytes;
    return buf.slice(0);
}

let pendingView = null;
page.on("arrival", (view) => (pendingView = view));

async function call(capability, operation, value) {
    if (capability === "audio") {
        if (operation === "update") {
            for (const cue of Array.isArray(value?.cues) ? value.cues : []) {
                if (cue.n === "mute-toggle") {
                    setMuted(audio, !audio.muted);
                    page.storage.set("muted", audio.muted ? "1" : "0");
                } else play(audio, String(cue.n), cue);
            }
            if (value?.env) updateAudio(audio, value.env);
            return true;
        }
    }
    if (capability === "travel") {
        if (operation === "status") {
            const view = pendingView;
            pendingView = null;
            return { view, entered: page.entered };
        }
        if (operation === "arrival-ready") {
            page.arrivalReady();
            return true;
        }
        if (operation === "lobby") {
            page.exit();
            return true;
        }
    }
    throw new Error("HOST_SERVICE_UNAVAILABLE");
}

async function asset(path, signal) {
    const r = await fetch(new URL(`./${path.replace(/^public\//, "")}`, location.href), { signal });
    if (!r.ok) throw new Error("ASSET_LOAD_FAILED");
    return r.arrayBuffer();
}

// ------------------------------------------------------------- session

async function createSession(options) {
    let device = null;
    let context = null;
    if (!params.has("webgl") && navigator.gpu) {
        try {
            const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
            if (adapter) device = await adapter.requestDevice();
            if (device) context = canvas.getContext("webgpu");
        } catch (err) {
            console.warn("[skyhoop] WebGPU unavailable, using WebGL 2", err?.message || err);
            device = null;
        }
    }
    const graphics = {
        canvas,
        context,
        device,
        width: canvas.clientWidth,
        height: canvas.clientHeight,
        pixelRatio: Math.min(devicePixelRatio, params.has("low") ? 1 : 2),
        decodeImage: (bytes, mimeType) => createImageBitmap(new Blob([bytes], { type: mimeType }), { premultiplyAlpha: "none", colorSpaceConversion: "none" }),
    };
    if (device) {
        device.lost.then((info) => {
            if (info.reason !== "destroyed") fail("The graphics device was lost. Reload to keep playing.");
        });
    }
    const session = new RuntimeSession(createGame, { ...options, graphics, now: () => performance.now() });
    const cleanup = bindBrowserInput(session, options.manifest);
    let last = performance.now();
    let alive = true;
    let held = false;
    const tick = (now) => {
        if (!alive) return;
        graphics.width = canvas.clientWidth;
        graphics.height = canvas.clientHeight;
        if (!held) {
            pollGamepad(session);
            try {
                session.tick(Math.max(0, (now - last) / 1000));
            } catch (e) {
                console.error("[skyhoop]", e);
                fail("Something went wrong. Reload to play again.");
            }
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
        backend: device ? "webgpu" : "webgl2",
        hold(paused) {
            held = paused;
            last = performance.now();
        },
        async dispose() {
            alive = false;
            cleanup();
            await session.dispose();
            device?.destroy();
        },
    };
}

// ------------------------------------------------------------- input

let uiState = { screen: "loading" };
let session = null;
const safe = (f) => {
    try {
        f();
    } catch {
        /* not entered yet */
    }
};
const act = (name, value) => safe(() => session?.action(name, value));
/** Relative input, split to the runtime's |value| <= 1 per call. */
const delta = (name, value) =>
    safe(() => {
        let v = value / 100;
        while (Math.abs(v) > 1e-6) {
            const part = Math.max(-1, Math.min(1, v));
            session?.delta(name, part);
            v -= part;
        }
    });

const isTouch = matchMedia("(pointer: coarse)").matches || params.has("touch");
// ?nolock: screenshots and checks fly without the mouse captured.
const locked = () => document.pointerLockElement === canvas || params.has("nolock");
function requestFly() {
    if (isTouch) return;
    try {
        const p = canvas.requestPointerLock({ unadjustedMovement: true });
        p?.catch?.(() => canvas.requestPointerLock());
    } catch {
        canvas.requestPointerLock();
    }
}

const hud = createHUD({
    root: hudRoot,
    touch: isTouch,
    onAction: (name, value) => {
        unlock();
        act(name, value);
    },
    onDelta: delta,
    requestFly,
    isLocked: locked,
});

let drag = null;
canvas.addEventListener("pointerdown", (e) => {
    if (isTouch) return;
    if (uiState.screen === "match" && !uiState.paused) {
        if (!locked()) return requestFly();
        if (e.button === 0) act("shoot", 1);
        if (e.button === 2) act("pass", 1);
        return;
    }
    // Arrival: drag to look around.
    drag = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
});
window.addEventListener("pointerup", (e) => {
    if (e.button === 0) act("shoot", 0);
    if (e.button === 2) act("pass", 0);
    drag = null;
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
window.addEventListener("pointermove", (e) => {
    if (locked()) {
        delta("lookX", e.movementX);
        delta("lookY", e.movementY);
    } else if (drag) {
        delta("lookX", (e.clientX - drag.x) * 0.9);
        delta("lookY", (e.clientY - drag.y) * 0.9);
        drag = { x: e.clientX, y: e.clientY };
    }
});
document.addEventListener("pointerlockchange", () => {
    // Losing the mouse mid-match (Esc) pauses.
    if (!locked() && uiState.screen === "match" && !uiState.paused && !isTouch) {
        act("back", 1);
        setTimeout(() => act("back", 0), 30);
    }
    hud.refreshLock(uiState);
});

// Gamepads: sticks, triggers and buttons onto the same actions.
const padWas = {};
function pollGamepad(s) {
    const pads = navigator.getGamepads?.() || [];
    const p = [...pads].find((x) => x && x.connected);
    if (!p) return;
    const dz = (v) => (Math.abs(v) < 0.14 ? 0 : v);
    const set = (name, v) => {
        if (padWas[name] === v) return;
        padWas[name] = v;
        safe(() => s.action(name, Math.max(-1, Math.min(1, v))));
    };
    set("moveX", dz(p.axes[0] || 0));
    set("moveY", -dz(p.axes[1] || 0));
    set("lookStickX", dz(p.axes[2] || 0));
    set("lookStickY", dz(p.axes[3] || 0));
    const b = (i) => (p.buttons[i] ? p.buttons[i].value || (p.buttons[i].pressed ? 1 : 0) : 0);
    set("up", b(0) > 0.5 ? 1 : 0);
    set("interact", b(0) > 0.5 ? 1 : 0);
    set("roll", b(1) > 0.5 ? 1 : 0);
    set("pass", b(2) > 0.5 ? 1 : 0);
    set("swap", b(3) > 0.5 ? 1 : 0);
    set("down", b(6) > 0.3 ? 1 : 0);
    set("shoot", b(7) > 0.3 ? 1 : 0);
    set("boost", b(10) > 0.5 || b(4) > 0.5 ? 1 : 0);
    set("back", b(9) > 0.5 ? 1 : 0);
    set("forward", b(5) > 0.5 ? 1 : 0);
}

// ------------------------------------------------------------- start

async function start() {
    const who = await page.resolveIdentity();
    audio.muted = page.storage.get("muted") === "1";
    identity = { id: "local-visitor", name: who.name || "You", avatar: who.avatarUrl || params.get("vrm") || DEFAULT_VRM };
    const host = await createSession({
        manifest: manifest.runtime,
        services: { identity, asset, call, avatar },
        sendUI: (value) => {
            uiState = value;
            hud.render(value);
        },
    });
    session = host.session;
    if (params.has("qa") || /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
        window.__skyhoop = debugHooks;
        window.__session = host.session;
    }
    const bootStart = performance.now();
    hud.render({ screen: "loading", boot: 0.05, difficulty: "normal", score: [0, 0], toasts: [], radar: [] });
    await host.session.prepare();
    await host.session.enter({
        avatar: { id: identity.id, position: [0, 0, 26], rotation: [0, 0, 0, 1] },
        camera: { position: [0, 2, 31], target: [0, 1.05, 26], fov: 58, mode: "third-person" },
        party: [],
    });
    page.ready();
    if (params.has("check")) {
        const report = await runCheck({
            session: host.session,
            scenario,
            backend: host.backend,
            bootMs: performance.now() - bootStart,
            frame: () => new Promise((resolve) => requestAnimationFrame(resolve)),
            pauseHostClock: (paused) => host.hold(paused),
        });
        postCheckReport(report);
    }
    const dispose = () => void host.dispose();
    page.on("dispose", dispose);
    window.addEventListener("pagehide", dispose, { once: true });
}

start().catch((err) => {
    console.error(err);
    page.fail(err?.message || "boot failed");
    fail("Skyhoop needs a browser with WebGPU or WebGL 2.");
});
