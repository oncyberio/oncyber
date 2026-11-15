// Bridge to the Oncyber game page (/games/garden). The game runs in a
// sandboxed, opaque-origin frame, so it has no storage or cookies of its own:
// the page owns identity, the shared room, voice and saved data, and the game
// sees public presentation fields, peer poses, relayed garden packets and its
// own saved values. Standalone (vite dev) it plays offline on localStorage.

const PREFIX = "garden:";
const DEFAULT_IDENTITY = { name: "You", pfp: "", avatarUrl: "" };
// Values the page keeps for this game, by key. Small strings only.
const STORAGE_KEYS = new Set(["save"]);
const STORAGE_MAX = 256 * 1024;

export function createHost() {
    const embedded = window.parent !== window;
    const listeners = new Map();
    const host = { embedded, identity: null, selfId: "", readyPosted: false };
    const stored = new Map();
    const fire = (type, value) =>
        (listeners.get(type) || []).forEach((listener) => listener(value));
    const post = (type, data = {}) => {
        if (embedded)
            window.parent.postMessage(
                { type: PREFIX + type, ...data },
                window.location.origin
            );
    };
    const text = (value, max) =>
        typeof value === "string" && value.trim()
            ? value.trim().slice(0, max)
            : "";
    let helloTimer = 0;
    const onMessage = (event) => {
        if (
            event.source !== window.parent ||
            event.origin !== window.location.origin
        )
            return;
        const type = event.data?.type;
        if (typeof type !== "string" || !type.startsWith(PREFIX)) return;
        const kind = type.slice(PREFIX.length);
        if (kind === "identity") {
            host.identity = {
                name: text(event.data.name, 24) || "You",
                pfp: text(event.data.pfp, 2048),
                avatarUrl: text(event.data.avatarUrl, 2048),
            };
            const saved = event.data.storage;
            if (saved && typeof saved === "object")
                for (const key of STORAGE_KEYS)
                    if (typeof saved[key] === "string" && saved[key].length <= STORAGE_MAX)
                        stored.set(key, saved[key]);
            clearInterval(helloTimer);
            if (host.readyPosted) post("ready");
        } else if (kind === "self") {
            host.selfId = text(event.data.id, 64);
        }
        fire(kind, kind === "identity" ? host.identity : event.data);
    };
    window.addEventListener("message", onMessage);
    host.on = (type, listener) => {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(listener);
    };
    host.post = post;
    // Saved values: the page's storage when embedded, localStorage standalone.
    host.storage = {
        get(key) {
            if (!STORAGE_KEYS.has(key)) return null;
            if (embedded) return stored.get(key) ?? null;
            try {
                return localStorage.getItem(`bloom-garden:${key}`);
            } catch {
                return null;
            }
        },
        set(key, value) {
            if (!STORAGE_KEYS.has(key) || typeof value !== "string" || value.length > STORAGE_MAX) return false;
            if (embedded) {
                stored.set(key, value);
                post("storage", { key, value });
                return true;
            }
            try {
                localStorage.setItem(`bloom-garden:${key}`, value);
                return true;
            } catch {
                return false;
            }
        },
    };
    // The page may attach its listener after this frame loads, so keep
    // greeting until it answers with an identity.
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
    host.fail = (message) =>
        post("error", { message: String(message).slice(0, 200) });
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
