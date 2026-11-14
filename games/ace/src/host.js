// Talks to the Oncyber game page (/games/ace, "ace:*" messages) when embedded,
// or plays standalone with defaults (vite dev). Embedded, the game runs in an
// opaque-origin sandboxed frame with no storage, so the page keeps its saved
// settings and hands them over with the identity.

const DEFAULT_IDENTITY = { name: "You", pfp: "", avatarUrl: "" };
const STORAGE_KEYS = new Set(["settings", "muted"]);
const STORAGE_MAX = 64 * 1024;

export function createHost() {
    const embedded = window.parent !== window;
    const host = {
        embedded,
        identity: null,
        entered: !embedded,
        listeners: { identity: [], entered: [], dispose: [] },
    };
    const stored = new Map();
    const fire = (type, value) => host.listeners[type].forEach((f) => f(value));
    const onMessage = (event) => {
        if (
            event.source !== window.parent ||
            event.origin !== window.location.origin
        )
            return;
        const data = event.data || {};
        if (data.type === "ace:identity") {
            const name =
                typeof data.name === "string" && data.name.trim()
                    ? data.name.trim().slice(0, 24)
                    : "You";
            const pfp = typeof data.pfp === "string" ? data.pfp : "";
            host.identity = {
                name,
                pfp,
                avatarUrl:
                    typeof data.avatarUrl === "string" ? data.avatarUrl : "",
            };
            const saved = data.storage;
            if (saved && typeof saved === "object")
                for (const key of STORAGE_KEYS)
                    if (typeof saved[key] === "string" && saved[key].length <= STORAGE_MAX)
                        stored.set(key, saved[key]);
            clearInterval(helloTimer);
            fire("identity", host.identity);
            // The host only accepts readiness after it has sent identity.
            if (host.readyPosted) post({ type: "ace:ready" });
        } else if (data.type === "ace:entered") {
            host.entered = true;
            fire("entered");
        } else if (data.type === "ace:dispose") {
            fire("dispose");
        }
    };
    window.addEventListener("message", onMessage);
    const post = (message) => {
        if (embedded)
            window.parent.postMessage(message, window.location.origin);
    };
    host.on = (type, f) => host.listeners[type].push(f);
    // Saved values: the page's storage when embedded, localStorage standalone.
    host.storage = {
        get(key) {
            if (!STORAGE_KEYS.has(key)) return null;
            if (embedded) return stored.get(key) ?? null;
            try {
                return localStorage.getItem(`ace:${key}`);
            } catch {
                return null;
            }
        },
        set(key, value) {
            if (!STORAGE_KEYS.has(key) || typeof value !== "string" || value.length > STORAGE_MAX) return;
            if (embedded) {
                stored.set(key, value);
                post({ type: "ace:storage", key, value });
                return;
            }
            try {
                localStorage.setItem(`ace:${key}`, value);
            } catch {
                /* private mode */
            }
        },
    };
    // The parent page may attach its listener after this frame loads, so keep
    // greeting until it answers with an identity.
    let helloTimer = 0;
    host.hello = () => {
        post({ type: "ace:hello" });
        if (!embedded) return;
        let tries = 0;
        helloTimer = setInterval(() => {
            if (host.identity || ++tries > 40) clearInterval(helloTimer);
            else post({ type: "ace:hello" });
        }, 250);
    };
    host.progress = () => {};
    host.ready = () => {
        host.readyPosted = true;
        post({ type: "ace:ready" });
    };
    host.fail = (message) =>
        post({ type: "ace:error", message: String(message).slice(0, 200) });
    host.exit = () => {
        if (embedded) post({ type: "ace:exit" });
    };
    host.dispose = () => {
        clearInterval(helloTimer);
        window.removeEventListener("message", onMessage);
    };

    // Identity falls back to defaults for standalone play.
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
                embedded ? 1500 : 0
            );
        });
    return host;
}
