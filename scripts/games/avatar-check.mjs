// The avatar stage of `pnpm games:check`: the rule in docs/games/avatar-kit.md,
// checked in a browser. It plays the page's part for a party of two (the
// game is opened with ?check=avatars&party=2) and asks the game what it sees
// through inspect():
//
//   arrival  after the page's `arrival` message, the frame the lobby reveals
//            contains the visitor's avatar: crouched, facing the camera,
//            hands empty. After `entered` it stands up.
//   others   the second player in the room is drawn, as their Oncyber avatar.
//
// A game opts out of either in game.json, with a reason (see readAvatarRule).
// The harness answers in the form the game greeted in (docs/games/contract.md):
// a contract game gets the lobby's view and its party in `enter`, a build
// before it gets `party` and `arrival`.
//
//   GAMES_CHECK_QUERY   appended to the game's URL in this stage, e.g. "&webgl"
//                       for a game with a WebGL fallback on a machine whose
//                       headless WebGPU loses its device. Recorded in the report.
//   GAMES_CHECK_AVATAR  another avatar file to hand the game.
//   GAMES_CHECK_DEBUG   print the game's console.
// A game answers the inspect question with `answerInspect` from the avatar
// kit (games/kits/avatar/src/page.ts); facts come from `kit.inspect()`.
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { GAME_MESSAGE_PREFIX } from "../../games/runtime/src/contract.ts";
import {
    arrivalProblems,
    enteredProblems,
    othersProblems,
    readAvatarRule,
} from "../../games/kits/avatar/src/facts.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
// A small Oncyber avatar with no textures, served to the game as both players.
const FIXTURE =
    process.env.GAMES_CHECK_AVATAR ||
    join(root, "games/kits/avatar/test/fixtures/square.vrm");
const TYPES = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".json": "application/json",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".css": "text/css",
    ".wasm": "application/wasm",
    ".glb": "model/gltf-binary",
    ".vrm": "model/gltf-binary",
};

// The lobby's last third-person view: its camera four metres in front of an
// avatar turned 0.6 rad, so a game that ignores the avatar's turn fails.
const TURN = 0.6;
const VIEW = {
    cameraOffset: { x: -4 * Math.sin(TURN), y: 2, z: -4 * Math.cos(TURN) },
    cameraTargetOffset: { x: 0, y: 1.2, z: 0 },
    avatarRotation: TURN,
    avatarHeight: 1.8,
    fov: 50,
};

// The page's side of the bridge, for one visitor and one other player.
const harness = (
    id
) => `<!doctype html><meta charset="utf-8"><title>avatar check</title>
<style>html,body{margin:0;height:100%;background:#000}iframe{border:0;width:100%;height:100%}</style>
<iframe id="game" sandbox="allow-scripts allow-pointer-lock" referrerpolicy="no-referrer" src="/games/${id}/index.html?check=avatars&party=2${
    process.env.GAMES_CHECK_QUERY || ""
}"></iframe>
<script>
const frame = document.getElementById("game");
const avatar = location.origin + "/__check/avatar.vrm";
const state = (window.__avatars = { prefix: "", ready: false, error: "", arrivalReady: false, pose: null, inspect: null, nonce: 0 });
const post = (kind, data = {}) => frame.contentWindow.postMessage({ type: state.prefix + kind, ...data }, "*");
const other = { id: "check-2", name: "Player 2", pfp: "", avatarUrl: avatar + "?2" };
const party = { id: "check-party-2-avatars", size: 2, members: [other] };
// The same party as a contract game's enter() hears it, the room connected.
const trip = { ...party, room: "check-room", self: "check-1", arrived: [other] };
const contract = () => state.prefix === ${JSON.stringify(GAME_MESSAGE_PREFIX)};
addEventListener("message", (event) => {
    if (event.source !== frame.contentWindow) return;
    const type = event.data && event.data.type;
    if (typeof type !== "string") return;
    if (type === "oncyber:inspect-result" && event.data.nonce === state.nonce) state.inspect = event.data.inspect;
    if (type.endsWith(":hello") && !state.prefix) {
        state.prefix = type.slice(0, -"hello".length);
        post("identity", { name: "Check", pfp: "", avatarUrl: avatar });
        if (!contract()) post("party", { party });
    }
    if (!state.prefix || !type.startsWith(state.prefix)) return;
    const kind = type.slice(state.prefix.length);
    if (kind === "ready") state.ready = true;
    if (kind === "error") state.error = String(event.data.message || "error");
    if (kind === "arrival-ready") state.arrivalReady = true;
    if (kind === "pose" && [event.data.x, event.data.y, event.data.z, event.data.h].every(Number.isFinite)) state.pose = event.data;
});
// The party's room: this visitor's id, and the other player ten times a
// second, standing beside wherever the game says the visitor is.
window.__room = () => {
    post("self", { id: "check-1" });
    setInterval(() => {
        const at = state.pose || { x: 0, y: 0, z: 0, h: 0 };
        post("peers", { players: [{ id: "check-2", name: "Player 2", pfp: "", vrm: avatar + "?2", x: at.x + 1.2, y: at.y, z: at.z, h: at.h, a: 0, fresh: false, talking: true }] });
    }, 100);
};
window.__send = post;
// The lobby's hand-over with its view, or (no view) a direct visit.
window.__arrive = (view) => {
    if (contract()) post("enter", { arrival: view ? { from: "lobby", view } : { from: "direct", view: null }, trip });
    else if (view) post("arrival", { view });
};
window.__ask = () => new Promise((done) => {
    state.inspect = null;
    const nonce = ++state.nonce;
    frame.contentWindow.postMessage({ type: "oncyber:inspect", nonce }, "*");
    const started = performance.now();
    const poll = () => (state.inspect || performance.now() - started > 2000 ? done(state.inspect) : setTimeout(poll, 25));
    poll();
});
</script>`;

export function serve(id, out) {
    const server = createServer((req, res) => {
        const url = new URL(req.url, "http://localhost");
        const send = (type, body) => {
            res.writeHead(200, {
                "content-type": type,
                "access-control-allow-origin": "*",
            });
            res.end(body);
        };
        if (url.pathname === "/") return send("text/html", harness(id));
        if (url.pathname === "/__check/avatar.vrm")
            return send("model/gltf-binary", readFileSync(FIXTURE));
        const prefix = `/games/${id}/`;
        const path = resolve(
            out,
            `.${decodeURIComponent(url.pathname.slice(prefix.length - 1))}`
        );
        if (
            !url.pathname.startsWith(prefix) ||
            !path.startsWith(out + sep) ||
            !existsSync(path) ||
            statSync(path).isDirectory()
        ) {
            res.writeHead(404);
            return res.end();
        }
        send(
            TYPES[extname(path)] ?? "application/octet-stream",
            readFileSync(path)
        );
    });
    return new Promise((done) =>
        server.listen(0, "127.0.0.1", () => done(server))
    );
}

/**
 * Runs the stage for one game. `findings` block the check; `skipped` lists
 * what the game opted out of, with its reason.
 */
export async function avatarStage({
    id,
    manifest,
    source,
    out,
    chromium,
    headed = false,
    network = null,
}) {
    const rule = readAvatarRule(manifest);
    const findings = rule.problems.map((message) => ({
        code: "AVATAR_RULE",
        message,
    }));
    const skipped = [];
    if (rule.others === "other" && rule.why)
        skipped.push({ check: "others", why: rule.why });
    if (rule.arrival === "none" && rule.arrivalWhy)
        skipped.push({ check: "arrival", why: rule.arrivalWhy });
    const wantOthers = rule.others === "avatar",
        wantArrival = rule.arrival === "pose";
    const done = (extra = {}) => ({
        status: findings.length ? "failed" : "passed",
        party: 2,
        findings,
        skipped,
        ...extra,
    });
    if (findings.length || (!wantOthers && !wantArrival)) return done();

    const server = await serve(id, out);
    const browser = await chromium.launch({
        headless: !headed,
        channel: process.env.PW_CHANNEL || undefined,
        args: ["--enable-unsafe-webgpu", "--ignore-gpu-blocklist"],
    });
    // The game's files under its declared network policy (networkCheck.mjs).
    network?.guard(server);
    network?.patrol(browser);
    const facts = {};
    const started = Date.now();
    let deviceLost = false;
    try {
        const page = await browser.newPage({
            viewport: { width: 1280, height: 720 },
        });
        page.on("console", (m) => {
            if (/device (was )?(lost|destroyed)/i.test(m.text()))
                deviceLost = true;
            if (process.env.GAMES_CHECK_DEBUG)
                console.log(
                    `  [${id} +${Date.now() - started} ms] ${m.type()}: ${m
                        .text()
                        .slice(0, 300)}`
                );
        });
        await page.goto(`http://127.0.0.1:${server.address().port}/`);
        const read = () => page.evaluate(() => ({ ...window.__avatars }));
        const until = async (test, ms) => {
            const deadline = Date.now() + ms;
            let value;
            while (!(value = await test()) && Date.now() < deadline)
                await page.waitForTimeout(100);
            return value;
        };
        const booted = await until(async () => {
            const s = await read();
            return s.ready || s.error ? s : null;
        }, 120_000);
        if (!booted?.ready) {
            findings.push({
                code: "AVATAR_BOOT",
                message: booted?.error || "the game never said ready",
            });
            return done();
        }
        // A game may be busy compiling for its first seconds; ask a few times.
        if (!(await until(() => page.evaluate(() => window.__ask()), 10_000))) {
            findings.push({
                code: "AVATAR_INSPECT",
                message:
                    "the game does not answer the inspect question; call answerInspect(inspect) from the avatar kit",
            });
            return done();
        }
        mkdirSync(join(source, ".check"), { recursive: true });
        await page.evaluate(() => window.__room());
        if (wantArrival) {
            // The lobby's hand-over: its view, then the reveal once the game
            // has framed the visitor (the page waits 1.5 s at most).
            await page.evaluate((view) => window.__arrive(view), VIEW);
            await until(async () => (await read()).arrivalReady, 1500);
            await page.waitForTimeout(150);
            facts.arrival = await page.evaluate(() => window.__ask());
            await page.screenshot({
                path: join(source, ".check/avatar-arrival.png"),
            });
            for (const message of arrivalProblems(facts.arrival))
                findings.push({ code: "AVATAR_ARRIVAL", message });
            await page.evaluate(() => window.__send("entered"));
            // The rise is 0.7 s of game time; a slow headless frame rate stretches it.
            facts.entered = await until(async () => {
                const f = await page.evaluate(() => window.__ask());
                return enteredProblems(f).length ? null : f;
            }, 20_000);
            if (!facts.entered) {
                facts.entered = await page.evaluate(() => window.__ask());
                for (const message of enteredProblems(facts.entered))
                    findings.push({ code: "AVATAR_ENTERED", message });
            }
        } else
            await page.evaluate(() => {
                window.__arrive(null);
                window.__send("entered");
            });
        if (wantOthers) {
            // Avatars load after the room names them.
            facts.others = await until(async () => {
                const f = await page.evaluate(() => window.__ask());
                return othersProblems(f, 1, 1).length ? null : f;
            }, 30_000);
            if (!facts.others) {
                facts.others = await page.evaluate(() => window.__ask());
                for (const message of othersProblems(facts.others, 1, 1))
                    findings.push({ code: "AVATAR_OTHERS", message });
            }
            await page.waitForTimeout(300);
            await page.screenshot({
                path: join(source, ".check/avatar-party.png"),
            });
        }
    } finally {
        await browser.close();
        server.close();
    }
    // Nothing is drawn once the graphics device is gone: say so, not just "0 drawn".
    if (deviceLost && findings.length)
        findings.push({
            code: "AVATAR_GPU_LOST",
            message:
                "the game lost its graphics device in this browser, so nothing was drawn; use PW_CHANNEL=chrome (a real GPU), or GAMES_CHECK_QUERY for the game's fallback renderer",
        });
    return done({
        ms: Date.now() - started,
        ...(process.env.GAMES_CHECK_QUERY
            ? { query: process.env.GAMES_CHECK_QUERY }
            : {}),
        facts,
    });
}
