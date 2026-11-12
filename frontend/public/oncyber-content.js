/* Optional engine-neutral bridge. Include before the host iframe's load event.
 * No identity is sent on boot and no wallet provider is exposed.
 *
 * window.oncyberContent:
 *   ready()                 the world has drawn its first frame
 *   openMenu()              show Oncyber's world menu (pause the game first)
 *   requestWalletAddress()  ask the visitor to share a public address
 *   onResume(listener)      the visitor closed that menu with Resume; returns
 *                           a function that removes the listener */
(function () {
    "use strict";
    if (window === window.parent || window.oncyberContent) return;
    // The message names, as frontend/features/content-host/
    // contentBridgeMessages.ts declares them. Copied because worlds load this
    // file on its own; contentBridgeMessages.test.ts fails when they differ.
    var PROTOCOL = {
        "tag": "oncyber:content",
        "v": 1,
        "kinds": { "init": "init", "request": "request", "result": "result", "error": "error", "event": "event" },
        "methods": { "ready": "ready", "menu": "menu", "walletConnect": "wallet.connect" },
        "events": { "resume": "resume" }
    };
    var KIND = PROTOCOL.kinds, METHOD = PROTOCOL.methods;
    var trustedOrigin = document.currentScript?.dataset.hostOrigin || "https://oncyber.io";
    var session = null, origin = null, counter = 0, initialized = [], resumeListeners = [];
    var pending = new Map();
    window.addEventListener("message", function (event) {
        var data = event.data;
        if (event.source !== window.parent || event.origin !== trustedOrigin || !data || data.tag !== PROTOCOL.tag || data.v !== PROTOCOL.v) return;
        if (data.kind === KIND.init && typeof data.session === "string" && /^[a-f0-9]{48}$/.test(data.session)) {
            if (session === data.session) return;
            pending.forEach(function (item) { item.reject(new Error("SESSION_CHANGED")); });
            pending.clear(); session = data.session; origin = event.origin;
            initialized.splice(0).forEach(function (resolve) { resolve(); });
        } else if (event.origin === origin && data.session === session && data.kind === KIND.event) {
            if (data.method !== PROTOCOL.events.resume) return;
            // One listener that throws does not keep the others from hearing it.
            resumeListeners.slice().forEach(function (listener) {
                try { listener(); } catch (error) { setTimeout(function () { throw error; }); }
            });
        } else if (event.origin === origin && data.session === session && (data.kind === KIND.result || data.kind === KIND.error)) {
            var item = pending.get(data.id);
            if (!item) return;
            // Public-address results are accepted only over the per-request port.
            if (item.port && data.kind !== KIND.error) return;
            if (data.kind === KIND.error) item.reject(new Error(data.error || "REQUEST_REJECTED"));
            else item.resolve(data.payload);
        }
    });
    function request(method) {
        return new Promise(function (resolve, reject) {
            var expired = false;
            var timer = setTimeout(function () { expired = true; initialized = initialized.filter(function (callback) { return callback !== run; }); reject(new Error("HOST_UNAVAILABLE")); }, 5000);
            function run() {
                if (expired) return;
                clearTimeout(timer);
                var id = "content-" + (++counter), port = method === METHOD.walletConnect ? new MessageChannel() : null;
                var deadline = setTimeout(function () { finish(null, new Error("REQUEST_TIMEOUT")); }, 65000);
                function finish(value, error) {
                    clearTimeout(deadline); pending.delete(id);
                    if (port) port.port1.close();
                    if (error) reject(error); else resolve(value);
                }
                pending.set(id, { port: !!port, resolve: function (value) { finish(value); }, reject: function (error) { finish(null, error); } });
                if (port) port.port1.onmessage = function (event) {
                    var data = event.data;
                    if (!data || data.tag !== PROTOCOL.tag || data.v !== PROTOCOL.v || data.session !== session || data.id !== id) return;
                    if (data.kind === KIND.result) finish(data.payload);
                    else if (data.kind === KIND.error) finish(null, new Error(data.error || "REQUEST_REJECTED"));
                };
                window.parent.postMessage({ tag: PROTOCOL.tag, v: PROTOCOL.v, kind: KIND.request, session: session, id: id, method: method }, origin, port ? [port.port2] : []);
            }
            if (session) run(); else initialized.push(run);
        });
    }
    window.oncyberContent = Object.freeze({
        ready: function () { return request(METHOD.ready); },
        openMenu: function () { return request(METHOD.menu); },
        requestWalletAddress: function () { return request(METHOD.walletConnect); },
        onResume: function (listener) {
            if (typeof listener !== "function") throw new TypeError("onResume needs a function");
            resumeListeners.push(listener);
            return function () { resumeListeners = resumeListeners.filter(function (item) { return item !== listener; }); };
        }
    });
})();
