// The process stage of `pnpm games:check`: the rules in
// docs/games/good-game.md that a machine can hold a game to.
//
//   brief    games/<id>/BRIEF.md exists and is filled in
//   party    game.json says what the game offers 1, 2, 3, 4 and 5 to 8 players
//   solo     ...and one player alone always has something to play
//   bot      games/<id>/bot.json plays the game through declared input
//   arrival  from the lobby the visitor arrives in a walkable world, starts
//            a match by choice, and returns to the arrival afterwards
//   handoff  the first frame matches the lobby's last (camera, crouch, hands)
//   video    the bot's run is recorded to games/<id>/.check/bot.webm
//
// The pure rules live in games/runtime/src/{arrival,bot,brief}.ts so games
// and tests share them; this file runs them against a build in Chromium.
import { createServer } from "node:http";
import { stripTypeScriptTypes } from "node:module";
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    renameSync,
    rmSync,
    statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** Load a dependency-free TypeScript module from games/runtime/src. */
export async function runtimeModule(name) {
    const source = readFileSync(
        join(repo, "games/runtime/src", `${name}.ts`),
        "utf8"
    );
    const warn = process.emitWarning;
    process.emitWarning = () => {}; // stripTypeScriptTypes is experimental in Node 22
    try {
        return await import(
            `data:text/javascript;base64,${Buffer.from(
                stripTypeScriptTypes(source)
            ).toString("base64")}`
        );
    } finally {
        process.emitWarning = warn;
    }
}

/** The definition of done, in order. Each check owns its finding codes. */
export const CHECKS = [
    {
        id: "brief",
        rule: "The brief was written first",
        codes: ["BRIEF_MISSING", "BRIEF_INCOMPLETE", "BRIEF_INSPECT"],
    },
    { id: "party", rule: "Respect the party", codes: ["PARTY_UNDECLARED"] },
    { id: "solo", rule: "Keep a solo path", codes: ["SOLO_PATH"] },
    {
        id: "bot",
        rule: "Ship a bot",
        codes: [
            "BOT_MISSING",
            "BOT_INVALID",
            "BOT_UNDECLARED_INPUT",
            "BOT_IDLE",
            "BOT_BOOT",
            "BOT_FACTS",
            "BOT_STEP",
            "BOT_NO_RESULT",
        ],
    },
    {
        id: "arrival",
        rule: "Arrive like a world",
        codes: [
            "ARRIVAL_TITLE",
            "ARRIVAL_STUCK",
            "ARRIVAL_AUTOSTART",
            "ARRIVAL_NOT_WALKABLE",
            "ARRIVAL_NO_START",
            "LEAVE_NOT_ARRIVAL",
        ],
    },
    {
        id: "handoff",
        rule: "Match the handoff",
        codes: [
            "HANDOFF_FACTS",
            "HANDOFF_DISTANCE",
            "HANDOFF_HEIGHT",
            "HANDOFF_FOV",
            "HANDOFF_FACING",
            "HANDOFF_CROUCH",
            "HANDOFF_HANDS",
        ],
    },
    {
        id: "video",
        rule: "Leave a recording for review",
        codes: ["VIDEO_MISSING"],
    },
];
// These need the bot to have run in a browser.
const PLAYED = ["arrival", "handoff", "video"];

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

// Stands in for the page bridge on a lobby trip: identity, then (when the
// runner says so) the lobby's last view, the reveal, and `entered`.
const harness = (
    id,
    query
) => `<!doctype html><meta charset="utf-8"><title>bot</title>
<style>html,body{margin:0;height:100%;background:#000}iframe{border:0;width:100%;height:100%}</style>
<iframe id="game" sandbox="allow-scripts allow-pointer-lock" referrerpolicy="no-referrer" src="/games/${id}/index.html${
    query ? `?${query}` : ""
}"></iframe>
<script>
const frame = document.getElementById("game");
const post = (kind, data) => frame.contentWindow.postMessage({ type: "${id}:" + kind, ...data }, "*");
window.__bot = { ready: false, error: null, staged: null };
addEventListener("message", (event) => {
    if (event.source !== frame.contentWindow) return;
    const type = event.data && event.data.type;
    if (type === "${id}:hello") post("identity", { name: "Bot", pfp: "", avatarUrl: "", storage: {} });
    if (type === "${id}:ready") window.__bot.ready = true;
    if (type === "${id}:error") window.__bot.error = String(event.data.message || "error");
    if (type === "${id}:arrival-ready" && window.__bot.staged) window.__bot.staged(true);
});
// As GamePage does: send the view, wait for arrival-ready, 1.5 s at most.
window.__arrive = (view) => new Promise((resolve) => {
    const timer = setTimeout(() => window.__bot.staged(false), 1500);
    window.__bot.staged = (answered) => { clearTimeout(timer); window.__bot.staged = null; resolve(answered); };
    post("arrival", { view });
});
window.__entered = () => { post("entered"); frame.focus(); };
</script>`;

function serve(id, out, query) {
    const server = createServer((req, res) => {
        const url = new URL(req.url, "http://localhost");
        if (url.pathname === "/") {
            res.writeHead(200, { "content-type": "text/html" });
            return res.end(harness(id, query));
        }
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
        res.writeHead(200, {
            "content-type": TYPES[extname(path)] ?? "application/octet-stream",
            "access-control-allow-origin": "*",
        });
        res.end(readFileSync(path));
    });
    return new Promise((done) =>
        server.listen(0, "127.0.0.1", () => done(server))
    );
}

/** The files a game is held to, read from games/<id>/. */
export function readGameFiles(source) {
    const read = (name) =>
        existsSync(join(source, name))
            ? readFileSync(join(source, name), "utf8")
            : null;
    const botText = read("bot.json");
    let bot = null,
        botError = null;
    try {
        bot = botText === null ? null : JSON.parse(botText);
    } catch (error) {
        botError = String(error.message);
    }
    return { brief: read("BRIEF.md"), bot, botError, hasBot: botText !== null };
}

/** The checks that need no browser. */
export async function staticFindings({ manifest, files }) {
    const [
        { briefFindings },
        { partyFindings },
        { botFindings, declaredInput },
    ] = [
        await runtimeModule("brief"),
        await runtimeModule("brief"),
        await runtimeModule("bot"),
    ];
    const format = manifest.format === "world" ? "world" : "match";
    return [
        ...briefFindings(files.brief),
        ...partyFindings(manifest.party),
        ...(!files.hasBot
            ? [
                  {
                      code: "BOT_MISSING",
                      message:
                          "no bot.json; every game ships a bot that plays it through declared input",
                  },
              ]
            : files.botError
            ? [{ code: "BOT_INVALID", message: `bot.json: ${files.botError}` }]
            : botFindings(files.bot, declaredInput(manifest), format)),
    ];
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/** Play the bot in a browser. Returns findings, the run's log and the video. */
async function play({ id, source, out, manifest, bot, chromium, headed }) {
    const { lobbyArrivalView, handoffFindings } = await runtimeModule(
        "arrival"
    );
    const {
        botKey,
        declaredInput,
        factsMatch,
        factsDiff,
        INSPECT_GLOBAL,
        SCREENS,
    } = await runtimeModule("bot");
    const input = declaredInput(manifest);
    const format = manifest.format === "world" ? "world" : "match";
    const findings = [];
    const add = (code, message) => findings.push({ code, message });
    const log = [];
    const seen = new Set();
    const chapters = {};
    const server = await serve(id, out, bot.query ?? "");
    const videoDir = mkdtempSync(join(tmpdir(), "oncyber-bot-"));
    const browser = await chromium.launch({
        headless: !headed,
        channel: process.env.PW_CHANNEL || undefined,
        args: ["--enable-unsafe-webgpu", "--ignore-gpu-blocklist"],
    });
    const size = { width: 1280, height: 720 };
    const context = await browser.newContext({
        viewport: size,
        recordVideo: { dir: videoDir, size },
    });
    const page = await context.newPage();
    const started = Date.now();
    const mark = (name) =>
        (chapters[name] = Math.round((Date.now() - started) / 100) / 10);
    let video = null;
    try {
        await page.goto(`http://127.0.0.1:${server.address().port}/`);
        const bootBy = Date.now() + 120_000;
        let state = { ready: false, error: null };
        while (Date.now() < bootBy && !state.ready && !state.error) {
            await sleep(250);
            state = await page.evaluate(() => ({
                ready: window.__bot.ready,
                error: window.__bot.error,
            }));
        }
        if (!state.ready) {
            add(
                "BOT_BOOT",
                state.error
                    ? `the game failed to load: ${state.error}`
                    : "the game never said ready"
            );
            return { findings, log, chapters, video };
        }
        const frame = page
            .frames()
            .find(
                (f) =>
                    f !== page.mainFrame() &&
                    f.url().includes(`/games/${id}/index.html`)
            );
        const facts = async () => {
            const value = await frame
                .evaluate(
                    (name) => globalThis[name]?.inspect?.() ?? null,
                    INSPECT_GLOBAL
                )
                .catch(() => null);
            if (value && typeof value === "object")
                for (const key of Object.keys(value)) seen.add(key);
            return value;
        };
        const waitFor = async (expected, timeoutMs) => {
            const by = Date.now() + timeoutMs;
            let now = await facts();
            while (!factsMatch(now, expected) && Date.now() < by) {
                await sleep(100);
                now = await facts();
            }
            return now;
        };

        // The lobby's last frame for a solo trip, turned so a game that
        // ignores the avatar's heading is caught.
        const view = lobbyArrivalView({
            partySize: 1,
            yaw: 0.6,
            pageWidth: size.width,
        });
        const answered = await page.evaluate((v) => window.__arrive(v), view);
        mark("arrival");
        let now = await facts();
        if (
            !now ||
            !SCREENS.includes(now.screen) ||
            !Array.isArray(now.position)
        ) {
            add(
                "BOT_FACTS",
                "the game exposes no facts: call exposeInspect() and report screen and position (docs/games/good-game.md)"
            );
            return { findings, log, chapters, video };
        }
        log.push({
            at: mark("revealed"),
            event: "revealed",
            answered,
            screen: now.screen,
            arrival: now.arrival ?? null,
        });
        if (now.screen !== "arrival")
            add(
                "ARRIVAL_TITLE",
                `a visitor from the lobby landed on "${now.screen}", not in a walkable arrival`
            );
        else findings.push(...handoffFindings(view, now.arrival));

        await page.evaluate(() => window.__entered());
        if (now.screen === "arrival") {
            // The visitor stands up, and nothing starts until they choose.
            const stood = await (async () => {
                const by = Date.now() + 4000;
                let f = await facts();
                while (f?.arrival?.crouched === true && Date.now() < by) {
                    await sleep(100);
                    f = await facts();
                }
                return f;
            })();
            if (stood?.arrival?.crouched === true)
                add(
                    "ARRIVAL_STUCK",
                    "the avatar is still crouched 4 s after the reveal"
                );
            await sleep(1000);
            now = await facts();
            if (now?.screen !== "arrival")
                add(
                    "ARRIVAL_AUTOSTART",
                    `the game moved to "${now?.screen}" on its own; starting is the visitor's choice`
                );
        }

        const origin = now?.position ?? [0, 0];
        let walked = 0;
        const runSteps = async (part, steps, deadline) => {
            const one = async (step, where) => {
                if (Date.now() > deadline)
                    throw new Error(`${where}: the bot ran out of time`);
                if ("press" in step || "hold" in step) {
                    const key = botKey(input, step.press ?? step.hold);
                    await page.keyboard.down(key);
                    await sleep("hold" in step ? step.ms : 80);
                    await page.keyboard.up(key);
                    await sleep(50);
                } else if ("wait" in step) await sleep(step.wait);
                else if ("expect" in step) {
                    const f = await facts();
                    if (!factsMatch(f, step.expect))
                        throw new Error(
                            `${where}: ${factsDiff(f, step.expect)}`
                        );
                } else if ("repeat" in step) {
                    const by = Math.min(
                        deadline,
                        Date.now() + (step.timeoutMs ?? 60_000)
                    );
                    let f = await facts();
                    while (!factsMatch(f, step.until)) {
                        if (Date.now() > by)
                            throw new Error(
                                `${where}: gave up repeating; ${factsDiff(
                                    f,
                                    step.until
                                )}`
                            );
                        for (let i = 0; i < step.repeat.length; i++)
                            await one(step.repeat[i], `${where}.repeat[${i}]`);
                        f = await facts();
                    }
                } else if ("until" in step) {
                    const f = await waitFor(
                        step.until,
                        Math.min(
                            step.timeoutMs ?? 10_000,
                            Math.max(0, deadline - Date.now())
                        )
                    );
                    if (!factsMatch(f, step.until))
                        throw new Error(
                            `${where}: ${factsDiff(f, step.until)}`
                        );
                }
                const f = await facts();
                if (f?.screen === "arrival" && Array.isArray(f.position))
                    walked = Math.max(
                        walked,
                        Math.hypot(
                            f.position[0] - origin[0],
                            f.position[f.position.length - 1] -
                                origin[origin.length - 1]
                        )
                    );
            };
            try {
                for (let i = 0; i < steps.length; i++)
                    await one(steps[i], `${part}[${i}]`);
                log.push({
                    at: mark(`${part}Done`),
                    event: part,
                    status: "passed",
                });
                return true;
            } catch (error) {
                add("BOT_STEP", String(error.message).slice(0, 300));
                log.push({
                    at: mark(`${part}Done`),
                    event: part,
                    status: "failed",
                });
                return false;
            }
        };
        const deadline = Date.now() + 420_000;
        let ok = await runSteps("arrival", bot.arrival, deadline);
        if (walked < 0.5)
            add(
                "ARRIVAL_NOT_WALKABLE",
                `the bot's arrival moved the avatar ${walked.toFixed(
                    2
                )} m; a visitor must be able to walk before starting`
            );
        now = await facts();
        if (ok && format === "match" && now?.screen !== "match") {
            add(
                "ARRIVAL_NO_START",
                `after the bot's arrival the game is on "${now?.screen}", not in a match`
            );
            ok = false;
        }
        mark("match");
        if (ok) ok = await runSteps("play", bot.play, deadline);
        if (ok && format === "match") {
            now = await facts();
            if (now?.screen !== "results") {
                add(
                    "BOT_NO_RESULT",
                    `the bot's match ended on "${now?.screen}", not on a result`
                );
                ok = false;
            }
            mark("results");
            await sleep(1500); // let the result be seen in the recording
            if (ok && (await runSteps("leave", bot.leave, deadline))) {
                now = await waitFor({ screen: "arrival" }, 5000);
                if (now?.screen !== "arrival")
                    add(
                        "LEAVE_NOT_ARRIVAL",
                        `leaving the match went to "${now?.screen}"; it returns to the arrival`
                    );
            }
        }
        await sleep(1000);
        mark("end");
        log.push({ at: chapters.end, event: "facts", facts: await facts() });
    } finally {
        const recording = page.video();
        await context.close();
        await browser.close();
        server.close();
        try {
            const from = await recording.path();
            mkdirSync(join(source, ".check"), { recursive: true });
            const to = join(source, ".check/bot.webm");
            rmSync(to, { force: true });
            renameSync(from, to);
            video = {
                path: `games/${id}/.check/bot.webm`,
                bytes: statSync(to).size,
                seconds: chapters.end ?? null,
                chapters,
            };
        } catch {
            /* reported below as VIDEO_MISSING */
        }
        rmSync(videoDir, { recursive: true, force: true });
    }
    if (!video || video.bytes < 10_000)
        add("VIDEO_MISSING", "no recording of the bot's run was written");
    return { findings, log, chapters, video, seen: [...seen] };
}

/**
 * Run the stage for one built game. Returns
 * `{ status, checks: [{ id, rule, status, findings }], findings, video, log }`.
 */
export async function processStage({
    id,
    root = repo,
    manifest,
    chromium,
    headed = false,
}) {
    const source = join(root, "games", id);
    const out = join(root, "frontend/public/games", id);
    const files = readGameFiles(source);
    const findings = await staticFindings({ manifest, files });
    const botRuns = !findings.some((f) => f.code.startsWith("BOT_"));
    let run = null;
    if (botRuns) {
        run = await play({
            id,
            source,
            out,
            manifest,
            bot: files.bot,
            chromium,
            headed,
        });
        findings.push(...run.findings);
        // The brief's promise about inspect() is held against the live game.
        if (files.brief && run.seen) {
            const { briefInspectKeys } = await runtimeModule("brief");
            const missing = briefInspectKeys(files.brief).filter(
                (key) => !run.seen.includes(key)
            );
            if (missing.length)
                findings.push({
                    code: "BRIEF_INSPECT",
                    message: `BRIEF.md lists inspect() keys the game never reported: ${missing.join(
                        ", "
                    )}`,
                });
        }
    }
    const reached =
        run &&
        !run.findings.some(
            (f) => f.code === "BOT_BOOT" || f.code === "BOT_FACTS"
        );
    const checks = CHECKS.map((check) => {
        const own = findings.filter((f) => check.codes.includes(f.code));
        const skipped = PLAYED.includes(check.id) && !reached;
        return {
            id: check.id,
            rule: check.rule,
            status: own.length ? "failed" : skipped ? "skipped" : "passed",
            findings: own,
        };
    });
    return {
        status: checks.every((c) => c.status === "passed")
            ? "passed"
            : "failed",
        checks,
        findings,
        video: run?.video ?? null,
        log: run?.log ?? [],
    };
}
