// Talks to the Oncyber game page (/games/skyhoop, "skyhoop:*" messages)
// when embedded, or plays standalone with defaults (vite dev). Embedded, the
// game runs in an opaque-origin sandboxed frame with no storage, so the page
// keeps saved values and hands them over with the identity.

const PREFIX = "skyhoop:";
const DEFAULT_IDENTITY = { name: "You", pfp: "", avatarUrl: "" };
const STORAGE_KEYS = new Set(["settings", "muted"]);
const STORAGE_MAX = 64 * 1024;

/** The lobby's camera relative to the avatar's feet; null when malformed. */
export function readArrivalView(value) {
    const vector = (v) => v && [v.x, v.y, v.z].every((n) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 1000);
    if (!value || !vector(value.cameraOffset) || !vector(value.cameraTargetOffset) || !Number.isFinite(value.avatarRotation) || !(value.fov > 5 && value.fov < 150))
        return null;
    const copy = (v) => ({ x: v.x, y: v.y, z: v.z });
    return {
        cameraOffset: copy(value.cameraOffset),
        cameraTargetOffset: copy(value.cameraTargetOffset),
        avatarRotation: value.avatarRotation,
        avatarHeight: value.avatarHeight >= 0.2 && value.avatarHeight <= 10 ? value.avatarHeight : 1.8,
        fov: value.fov,
    };
}

export function createHost() {
    const embedded = window.parent !== window;
    const listeners = new Map();
    const host = { embedded, identity: null, entered: !embedded, view: null, readyPosted: false };
    const stored = new Map();
    const fire = (type, value) => (listeners.get(type) || []).forEach((f) => f(value));
    const post = (type, data = {}) => {
        if (embedded) window.parent.postMessage({ type: PREFIX + type, ...data }, window.location.origin);
    };
    const text = (v, max) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : "");
    let helloTimer = 0;
    const onMessage = (event) => {
        if (event.source !== window.parent || event.origin !== window.location.origin) return;
        const type = event.data?.type;
        if (typeof type !== "string" || !type.startsWith(PREFIX)) return;
        const kind = type.slice(PREFIX.length);
        const data = event.data;
        if (kind === "identity") {
            host.identity = { name: text(data.name, 24) || "You", pfp: text(data.pfp, 2048), avatarUrl: text(data.avatarUrl, 2048) };
            const saved = data.storage;
            if (saved && typeof saved === "object")
                for (const key of STORAGE_KEYS) if (typeof saved[key] === "string" && saved[key].length <= STORAGE_MAX) stored.set(key, saved[key]);
            clearInterval(helloTimer);
            if (host.readyPosted) post("ready");
            fire("identity", host.identity);
        } else if (kind === "arrival") {
            host.view = readArrivalView(data.view);
            fire("arrival", host.view);
        } else if (kind === "entered") {
            host.entered = true;
            fire("entered");
        } else if (kind === "dispose") fire("dispose");
    };
    window.addEventListener("message", onMessage);
    host.on = (type, f) => {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(f);
    };
    host.storage = {
        get(key) {
            if (!STORAGE_KEYS.has(key)) return null;
            if (embedded) return stored.get(key) ?? null;
            try {
                return localStorage.getItem(`skyhoop:${key}`);
            } catch {
                return null;
            }
        },
        set(key, value) {
            if (!STORAGE_KEYS.has(key) || typeof value !== "string" || value.length > STORAGE_MAX) return;
            if (embedded) {
                stored.set(key, value);
                post("storage", { key, value });
                return;
            }
            try {
                localStorage.setItem(`skyhoop:${key}`, value);
            } catch {
                /* private mode */
            }
        },
    };
    host.hello = () => {
        post("hello");
        if (!embedded) return;
        let tries = 0;
        helloTimer = setInterval(() => {
            if (host.identity || ++tries > 40) clearInterval(helloTimer);
            else post("hello");
        }, 250);
    };
    host.ready = () => {
        host.readyPosted = true;
        post("ready");
    };
    host.arrivalReady = () => post("arrival-ready");
    host.fail = (message) => post("error", { message: String(message).slice(0, 200) });
    host.exit = () => post("exit");
    host.resolveIdentity = () =>
        new Promise((resolve) => {
            if (host.identity) return resolve(host.identity);
            host.on("identity", resolve);
            setTimeout(
                () => {
                    if (!host.identity) {
                        host.identity = { ...DEFAULT_IDENTITY };
                        resolve(host.identity);
                    }
                },
                embedded ? 4000 : 0
            );
        });
    host.dispose = () => {
        clearInterval(helloTimer);
        window.removeEventListener("message", onMessage);
    };
    return host;
}
