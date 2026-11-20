// Bridge to the Oncyber game page (/games/garden). The game runs in a
// sandboxed, opaque-origin frame, so it has no storage or cookies of its own:
// the page owns identity, the shared room, voice and saved data, and the game
// sees public presentation fields, peer poses, relayed garden packets and its
// own saved values. Standalone (vite dev) it plays offline on localStorage.

import { connectSavedData } from "../../../runtime/src/saved.ts";
import manifest from "../../game.json";

const PREFIX = "garden:";
const DEFAULT_IDENTITY = { name: "You", pfp: "", avatarUrl: "" };

// Saves from before keys were declared (stateVersion 0) are the raw strings
// the page kept: the save as JSON text.
export const MIGRATE = {
    save: (old, from) => {
        if (from !== 0 || typeof old !== "string") return undefined;
        const data = JSON.parse(old);
        return data && Array.isArray(data.list) ? data : undefined;
    },
};

export function createHost() {
    const embedded = window.parent !== window;
    const listeners = new Map();
    const host = { embedded, identity: null, selfId: "", readyPosted: false };
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
    // Saved values (declared in game.json): the page keeps them when
    // embedded, localStorage standalone. See docs/games/saved-data.md.
    host.saved = connectSavedData({
        prefix: PREFIX,
        declared: manifest.saved,
        migrate: MIGRATE,
        timeoutMs: 2500,
    });
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
        host.saved.dispose();
        clearInterval(helloTimer);
        window.removeEventListener("message", onMessage);
    };
    return host;
}
