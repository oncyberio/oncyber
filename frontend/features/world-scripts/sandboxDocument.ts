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

/**
 * Messages a script may send that nothing asked for (an answer to no
 * frame, a second "started") before the relay stops it, and how many of
 * the others (errors, a restart) it may send in all.
 */
export const WORLD_SCRIPT_UNASKED_LIMIT = 200;
export const WORLD_SCRIPT_SAID_LIMIT = 2000;

/**
 * The relay: the only script in the frame's document. It passes on to the
 * host only what the host is waiting for: one answer for the start, one for
 * each frame it sent, one for each keep. A worker that posts without being
 * asked does not reach the page, does not count as answering, and is
 * stopped when it keeps at it.
 */
export const WORLD_SCRIPT_RELAY = `
(function () {
    var SDK = ${JSON.stringify(WORLD_SCRIPT_SDK)};
    var port = null;
    var worker = null;
    var waitingSince = 0;
    var url = null;
    var owed = [];
    var keeping = false;
    var started = false;
    var unasked = 0;
    var said = 0;
    function stop(reason) {
        if (worker) { worker.onmessage = null; worker.onerror = null; worker.terminate(); }
        worker = null;
        owed = [];
        keeping = false;
        waitingSince = 0;
        if (url) URL.revokeObjectURL(url);
        url = null;
        if (port && reason) port.postMessage({ t: "stopped", reason: reason });
    }
    function flood() {
        stop("The script sent too much at once, so it was stopped.");
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
        started = false;
        unasked = 0;
        said = 0;
        worker.onmessage = function (event) {
            var data = event.data || {};
            if (data.t === "ops") {
                var at = owed.indexOf(data.seq);
                if (at < 0) { if (++unasked > ${WORLD_SCRIPT_UNASKED_LIMIT}) flood(); return; }
                owed.splice(at, 1);
            } else if (data.t === "started") {
                if (started) { if (++unasked > ${WORLD_SCRIPT_UNASKED_LIMIT}) flood(); return; }
                started = true;
            } else if (data.t === "kept") {
                if (!keeping) { if (++unasked > ${WORLD_SCRIPT_UNASKED_LIMIT}) flood(); return; }
                keeping = false;
            } else if (++said > ${WORLD_SCRIPT_SAID_LIMIT}) {
                return flood();
            }
            if (!owed.length && !keeping) waitingSince = 0;
            port.postMessage(data);
        };
        worker.onerror = function (event) {
            event.preventDefault();
            port.postMessage({ t: "error", fatal: true, text: String(event.message || "The script could not start.").slice(0, 800) });
            stop(null);
        };
        // Its start is answered like a frame, with the number -1.
        owed = [-1];
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
            if (message.t === "tick") owed.push(message.seq);
            if (message.t === "keep") keeping = true;
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
        scriptText(WORLD_SCRIPT_RELAY) +
        "</script></body></html>"
    );
}

/** What the relay puts after the SDK in the worker. */
export function buildWorkerScript(source: string) {
    return wrapUserSource(source);
}
