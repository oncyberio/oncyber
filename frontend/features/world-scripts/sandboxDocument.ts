/**
 * The document loaded into a world script's frame. The frame is sandboxed
 * with `allow-scripts` only, so it has an opaque origin: no cookies, no
 * storage, no access to the Oncyber page. Its policy blocks every network
 * request. Inside, a small relay starts the script in a Blob worker (its
 * own thread, so a script stuck in a loop never freezes the world) and
 * stops the worker when it stops answering.
 *
 * All traffic with the host goes over one MessagePort handed over in the
 * first message, so no other window can talk to the script or pretend to
 * be it.
 */
import { WORLD_SCRIPT_SDK, wrapUserSource } from "./sdk";

export const WORLD_SCRIPT_SANDBOX = "allow-scripts";

/** No network, no frames, no forms; inline relay and blob workers only. */
export const WORLD_SCRIPT_CSP = [
    "default-src 'none'",
    "script-src 'unsafe-inline' blob:",
    "worker-src blob:",
    "connect-src 'none'",
    "img-src 'none'",
    "media-src 'none'",
    "font-src 'none'",
    "style-src 'none'",
    "frame-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
].join("; ");

/** A worker that has not answered for this long is stopped. */
export const WORLD_SCRIPT_HANG_MS = 2500;

/** Text for a script element: no closing tag can end it early. */
function scriptText(code: string) {
    return code.replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "<\\!--");
}

const RELAY = `
(function () {
    var SDK = ${JSON.stringify(WORLD_SCRIPT_SDK)};
    var port = null;
    var worker = null;
    var waitingSince = 0;
    var url = null;
    function stop(reason) {
        if (worker) worker.terminate();
        worker = null;
        if (url) URL.revokeObjectURL(url);
        url = null;
        if (port && reason) port.postMessage({ t: "stopped", reason: reason });
    }
    setInterval(function () {
        if (worker && waitingSince && Date.now() - waitingSince > ${WORLD_SCRIPT_HANG_MS}) {
            stop("The script stopped answering, so it was stopped.");
        }
    }, 500);
    function boot(message) {
        stop(null);
        var wrapped = SDK + "\\n" + message.wrapped;
        url = URL.createObjectURL(new Blob([wrapped], { type: "text/javascript" }));
        worker = new Worker(url);
        worker.onmessage = function (event) {
            var data = event.data || {};
            if (data.t === "ops" || data.t === "started" || data.t === "kept") waitingSince = 0;
            port.postMessage(data);
        };
        worker.onerror = function (event) {
            event.preventDefault();
            port.postMessage({ t: "error", fatal: true, text: String(event.message || "The script could not start.").slice(0, 800) });
            stop(null);
        };
        waitingSince = Date.now();
        worker.postMessage(message.start);
    }
    window.addEventListener("message", function (event) {
        if (port || event.source !== window.parent || !event.ports || !event.ports[0]) return;
        port = event.ports[0];
        port.onmessage = function (e) {
            var message = e.data || {};
            if (message.t === "boot") return boot(message);
            if (message.t === "stop") return stop(null);
            if (!worker) return;
            if ((message.t === "tick" || message.t === "keep") && !waitingSince) waitingSince = Date.now();
            worker.postMessage(message);
        };
        port.postMessage({ t: "relay-ready" });
    });
})();
`;

export function buildSandboxDocument() {
    return (
        "<!doctype html><html><head>" +
        '<meta charset="utf-8">' +
        `<meta http-equiv="Content-Security-Policy" content="${WORLD_SCRIPT_CSP}">` +
        "</head><body><script>" +
        scriptText(RELAY) +
        "</script></body></html>"
    );
}

/** What the relay puts after the SDK in the worker. */
export function buildWorkerScript(source: string) {
    return wrapUserSource(source);
}
