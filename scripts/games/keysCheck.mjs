// The keys and focus stage of `pnpm games:check` (docs/games/keys-focus.md).
//
//   scan     Reads the game's source. Flags raw key listeners, direct
//            pointer-lock requests, and bindings on keys the page reserves.
//   browser  Opens the build beside a page that runs the site's own key
//            handling (frontend/features/games/contract/gameInput.ts), plays, then
//            types in the page's chat field and opens its menu, and asserts
//            the game took no input and the player did not move.
//
// Used by games.mjs; `node scripts/games/keysCheck.mjs scan <id>` runs the
// scan alone.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { GAME_MESSAGE_PREFIX } from "../../games/runtime/src/contract.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const SOURCE = /\.(js|mjs|cjs|jsx|ts|tsx|html)$/;
const SKIP_DIR = new Set([
    "node_modules",
    "dist",
    "public",
    "test",
    "tests",
    "scripts",
    "tools",
    ".check",
]);
const SKIP_FILE = /\.(test|spec)\.[a-z]+$|\.config\.[a-z]+$/;

const RULES = [
    {
        code: "RAW_KEY_LISTENER",
        // "keydown" as a string anywhere (addEventListener, a helper, a map
        // of handlers), or an onkeydown property or attribute.
        pattern: /(["'`])key(?:down|up|press)\1|\bonkey(?:down|up|press)\b/g,
        message:
            "raw key listener; take keys as declared actions from bindPageKeys",
    },
    {
        code: "RAW_POINTER_LOCK",
        pattern: /\.requestPointerLock\s*\(/g,
        message:
            "direct pointer lock; use lockPointer() from bindPageKeys so the page can take the cursor back",
    },
    {
        code: "RAW_KEYBOARD_LOCK",
        pattern: /\bnavigator\s*\.\s*keyboard\b/g,
        message: "keyboard lock would take the page's keys",
    },
];

/** Comments say what they like; only code is scanned. Line numbers survive. */
export function stripComments(text) {
    return text.replace(
        /\/\*[\s\S]*?\*\/|(^|[^:\\"'`])\/\/[^\n]*|<!--[\s\S]*?-->/g,
        (match, lead = "") =>
            lead + match.slice(lead.length).replace(/[^\n]/g, " ")
    );
}

/** Findings in one file's text. */
export function scanText(text, path = "") {
    const code = stripComments(text);
    const findings = [];
    for (const rule of RULES)
        for (const match of code.matchAll(rule.pattern)) {
            const line = code.slice(0, match.index).split("\n").length;
            findings.push({
                code: rule.code,
                message: `${path}:${line} ${rule.message}`,
                file: path,
                line,
            });
        }
    return findings.sort((a, b) => a.line - b.line);
}

function sourceFiles(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory())
            return SKIP_DIR.has(entry.name) || entry.name.startsWith(".")
                ? []
                : sourceFiles(path);
        return SOURCE.test(entry.name) && !SKIP_FILE.test(entry.name)
            ? [path]
            : [];
    });
}

/** The actions a game declares: `runtime.input` on the lifecycle, else `input`. */
export const declaredInput = (manifest) =>
    manifest?.runtime?.input ?? manifest?.input;

/**
 * Static half. `legacy` games (game.json `keysCheck.legacy`) read keys
 * themselves on a page of their own; their findings are listed, not blocking.
 */
export async function keysScan({
    id,
    manifest,
    source = join(root, "games", id),
}) {
    const { checkBindings } = await import(
        pathToFileURL(join(root, "games/runtime/src/keys.ts")).href
    );
    const files = sourceFiles(source);
    const findings = [
        ...checkBindings(declaredInput(manifest)),
        ...files.flatMap((path) =>
            scanText(
                readFileSync(path, "utf8"),
                relative(source, path).split(sep).join("/")
            )
        ),
    ].map(({ code, message }) => ({ code, message }));
    const legacy = manifest?.keysCheck?.legacy === true;
    return {
        files: files.length,
        legacy,
        findings: legacy ? [] : findings,
        warnings: legacy ? findings : [],
    };
}

/** The page the browser half opens: the site's key handling around the game. */
const harness = (
    id
) => `<!doctype html><meta charset="utf-8"><title>keys check</title>
<style>html,body{margin:0;height:100%;background:#000}iframe{border:0;width:100%;height:100%}
#chat{position:fixed;left:16px;bottom:16px;width:320px;font:16px system-ui;padding:8px}</style>
<iframe id="game" sandbox="allow-scripts allow-pointer-lock" referrerpolicy="no-referrer" allow="gamepad" src="/game-builds/${id}/index.html"></iframe>
<input id="chat" data-game-chat placeholder="chat" autocomplete="off">
<script type="module">
import { createGameInputHost, focusGameChat } from "/__keys/gameInput.js";
const game = ${JSON.stringify(id)};
const frame = document.getElementById("game");
// The one contract (docs/games/contract.md): every game says
// oncyber:game:<kind>; a build from before it says <id>:<kind>. The page's
// helpers name kinds <id>:<kind>, and each message goes out in the form the
// game greeted in, as GamePage's send does.
const CONTRACT = ${JSON.stringify(GAME_MESSAGE_PREFIX)}, LEGACY = game + ":";
let prefix = LEGACY;
const kindOf = (type) => typeof type !== "string" ? ""
    : type.startsWith(CONTRACT) ? type.slice(CONTRACT.length)
    : type.startsWith(LEGACY) ? type.slice(LEGACY.length) : "";
const send = (message) => frame.contentWindow.postMessage({ ...message, type: prefix + kindOf(message.type) }, "*");
const keys = (window.__keys = { ready: false, error: null, intents: [], sent: [], menu: false, state: null, states: 0 });
const host = (window.__host = createGameInputHost({
    game,
    send: (message) => { keys.sent.push(message); send(message); },
    focusGame: () => frame.focus(),
    intent(intent) {
        keys.intents.push(intent);
        if (intent === "menu") {
            keys.menu = !keys.menu;
            if (keys.menu) host.hold("menu"); else host.release("menu");
        } else if (intent === "mute") {
            // As the page does (GameInputLayer, GameSound): the sound
            // channel carries the setting (docs/games/sound.md); the muted
            // message is what a build from before it hears.
            host.setMuted(!host.muted);
            send({ type: game + ":audio", muted: host.muted });
        }
        else if (!keys.menu) focusGameChat(document);
    },
}));
host.watch(document);
addEventListener("message", (event) => {
    if (event.source !== frame.contentWindow) return;
    const data = event.data, kind = kindOf(data && data.type);
    if (!kind) return;
    if (host.receive(kind, data)) return;
    if (kind === "hello") {
        prefix = data.type.startsWith(CONTRACT) ? CONTRACT : LEGACY;
        send({ type: game + ":identity", name: "Check", pfp: "", avatarUrl: "" });
        // A contract game waits for its visit: a direct one, alone.
        if (prefix === CONTRACT) send({ type: game + ":enter", arrival: { from: "direct", view: null }, trip: null });
    } else if (kind === "ready" && !keys.ready) {
        keys.ready = true;
        host.sync();
        requestAnimationFrame(() => { frame.focus(); send({ type: game + ":entered" }); });
    } else if (kind === "error") keys.error = String(data.message || "error");
    else if (kind === "input-state") { keys.state = data; keys.states++; }
});
window.__probe = () => new Promise((resolve) => {
    const before = keys.states, started = performance.now();
    send({ type: game + ":input-probe" });
    const wait = () => keys.states > before ? resolve(keys.state)
        : performance.now() - started > 2000 ? resolve(null) : setTimeout(wait, 20);
    wait();
});
</script>`;

/** Adds the harness to a page: `<origin>/__keys`, beside the served build. */
export async function harnessPage(page, id) {
    await page.route("**/__keys", (route) =>
        route.fulfill({ contentType: "text/html", body: harness(id) })
    );
    await page.route("**/__keys/gameInput.js", (route) =>
        route.fulfill({
            contentType: "text/javascript",
            body: stripTypeScriptTypes(
                readFileSync(
                    join(root, "frontend/features/games/contract/gameInput.ts"),
                    "utf8"
                )
            ),
        })
    );
}

const same = (a, b) =>
    Array.isArray(a) &&
    Array.isArray(b) &&
    a.length === b.length &&
    a.every((v, i) => Math.abs(v - b[i]) < 1e-4);
const matches = (probe, want) =>
    Object.entries(want ?? {}).every(([key, value]) => probe?.[key] === value);

/**
 * Browser half. Returns `{ findings, steps }`; a finding blocks the check.
 * `origin` already serves /game-builds/<id>/; this adds the harness with routes.
 */
export async function keysBrowserCheck({
    browser,
    origin,
    id,
    manifest,
    timeoutMs = 120_000,
}) {
    const findings = [];
    const steps = [];
    const bad = (code, message) => findings.push({ code, message });
    const input = declaredInput(manifest) ?? {};
    const plan = manifest?.keysCheck ?? {};
    const moveKey =
        plan.move ?? Object.values(input).flatMap((b) => b?.keyboard ?? [])[0];
    // A small view: software rendering is slow and this stage needs no pixels.
    const page = await browser.newPage({
        viewport: { width: 640, height: 360 },
    });
    try {
        await harnessPage(page, id);
        await page.goto(`${origin}/__keys`);
        const read = () =>
            page.evaluate(() => ({
                ...window.__keys,
                paused: window.__host.paused,
                reason: window.__host.reason,
                muted: window.__host.muted,
                active: document.activeElement?.id ?? "",
                chat: document.getElementById("chat").value,
            }));
        // A game busy building a scene answers late; ask again before giving up.
        const probe = async () => {
            for (let i = 0; i < 10; i++) {
                const state = await page.evaluate(() => window.__probe());
                if (state) return state;
            }
            throw new Error(
                "the game stopped answering the page's input probe"
            );
        };
        const until = async (test, ms) => {
            const deadline = Date.now() + ms;
            for (;;) {
                const value = await test();
                if (value || Date.now() > deadline) return value;
                await page.waitForTimeout(100);
            }
        };
        const hold = async (key, ms) => {
            await page.keyboard.down(key);
            await page.waitForTimeout(ms);
            await page.keyboard.up(key);
            await page.waitForTimeout(80);
        };
        const focusGame = () =>
            page.evaluate(() => document.getElementById("game").focus());

        if (!(await until(async () => (await read()).ready, timeoutMs))) {
            bad(
                "KEYS_BOOT",
                `the game did not say ready beside the page's key handling${
                    (await read()).error ? `: ${(await read()).error}` : ""
                }`
            );
            return { findings, steps };
        }
        await page.waitForTimeout(300);
        await focusGame();
        let state = await page.evaluate(() => window.__probe());
        if (!state) {
            bad(
                "KEYS_NOT_BOUND",
                "the game does not answer the page: bind keys with bindPageKeys from the runtime"
            );
            return { findings, steps };
        }
        if (!moveKey) {
            bad(
                "KEYS_NOT_BOUND",
                "game.json declares no keyboard binding to test"
            );
            return { findings, steps };
        }

        // Into play, with the keys the game declared.
        for (const key of plan.start ?? []) {
            await focusGame();
            await hold(key, 60);
            await page.waitForTimeout(500);
        }
        if (
            plan.ready &&
            !(await until(
                async () => matches((await probe())?.probe, plan.ready),
                45_000
            ))
        )
            bad(
                "KEYS_NOT_PLAYING",
                `the game did not reach ${JSON.stringify(
                    plan.ready
                )} after ${JSON.stringify(plan.start ?? [])}`
            );
        await focusGame();

        // 1. A declared key reaches the game, and (when the game reports a
        //    position) moves the player. Without this the rest proves nothing.
        const proveMove = async (label) => {
            const before = await probe();
            let after = before;
            for (let i = 0; i < 12; i++) {
                await hold(moveKey, 250);
                after = await probe();
                if (
                    after.delivered > before.delivered &&
                    (!plan.move ||
                        !before.probe?.position ||
                        !same(after.probe?.position, before.probe.position))
                )
                    break;
            }
            const moved =
                !!before.probe?.position &&
                !same(after.probe?.position, before.probe.position);
            steps.push({
                step: label,
                delivered: after.delivered - before.delivered,
                moved,
            });
            if (after.delivered <= before.delivered)
                bad(
                    "KEYS_NOT_DELIVERED",
                    `${label}: ${moveKey} did not reach the game as an action`
                );
            else if (plan.move && !moved)
                bad(
                    "KEYS_MOVE_UNPROVEN",
                    `${label}: holding ${moveKey} did not move the player (probe().position)`
                );
            return after;
        };
        state = await proveMove("play");

        // 2. Enter belongs to the page: it focuses chat and pauses the game.
        //    The move key is down as focus leaves, so its key-up never
        //    reaches the game: the pause must let go of it.
        await page.keyboard.down(moveKey);
        await page.waitForTimeout(120);
        await hold("Enter", 40);
        await page.keyboard.up(moveKey);
        let pageState = await until(async () => {
            const s = await read();
            return s.active === "chat" && s.paused ? s : null;
        }, 2000);
        if (!pageState) {
            bad(
                "KEYS_ENTER_NOT_PAGE",
                "Enter in the game did not reach the page's chat"
            );
            await page.focus("#chat");
        }
        await page.waitForTimeout(150);
        const still = await probe();
        if (!still.paused)
            bad(
                "KEYS_NOT_PAUSED",
                "the game was not told input paused while the visitor types"
            );
        if (still.held.length)
            bad(
                "KEYS_HELD",
                `actions still held after pause: ${still.held.join(", ")}`
            );

        // 3. Type in chat: every bound key, the page's keys as letters, and
        //    the move key held down.
        const letters = [
            ...new Set(Object.values(input).flatMap((b) => b?.keyboard ?? [])),
        ]
            .map((code) =>
                /^Key[A-Z]$/.test(code)
                    ? code.slice(3).toLowerCase()
                    : code === "Space"
                    ? " "
                    : ""
            )
            .join("");
        const text = `${letters} mp`;
        await page.keyboard.type(text, { delay: 15 });
        await hold(moveKey, 600);
        for (const code of ["ArrowUp", "ArrowLeft", "Space"])
            await hold(code, 60);
        await page.waitForTimeout(300);
        const typed = await probe();
        pageState = await read();
        steps.push({
            step: "typing",
            chat: pageState.chat.length,
            delivered: typed.delivered - still.delivered,
            moved:
                !!still.probe?.position &&
                !same(typed.probe?.position, still.probe.position),
        });
        if (!pageState.chat.includes(text))
            bad(
                "KEYS_CHAT_LOST",
                `chat received ${JSON.stringify(
                    pageState.chat
                )}, typed ${JSON.stringify(text)}`
            );
        if (typed.delivered !== still.delivered || typed.held.length)
            bad(
                "KEYS_LEAK",
                `the game took ${
                    typed.delivered - still.delivered
                } action(s) while the visitor typed in chat`
            );
        if (
            still.probe?.position &&
            !same(typed.probe?.position, still.probe.position)
        )
            bad(
                "KEYS_MOVED_WHILE_TYPING",
                `the player moved from ${JSON.stringify(
                    still.probe.position
                )} to ${JSON.stringify(
                    typed.probe?.position
                )} while the visitor typed in chat`
            );
        if (
            typed.probe &&
            "muted" in typed.probe &&
            typed.probe.muted !== still.probe.muted
        )
            bad(
                "KEYS_MUTED_WHILE_TYPING",
                "typing m in chat changed the game's sound"
            );

        // 4. Escape leaves chat; the game resumes with focus.
        await hold("Escape", 40);
        pageState = await until(async () => {
            const s = await read();
            return !s.paused && s.active === "game" ? s : null;
        }, 2000);
        if (!pageState)
            bad(
                "KEYS_NOT_RESUMED",
                "leaving chat with Escape did not resume the game with focus"
            );
        if ((await probe()).paused)
            bad(
                "KEYS_NOT_RESUMED",
                "the game was not told input resumed after chat"
            );
        await focusGame();

        // 5. Escape in the game opens the page's menu. The game keeps the
        //    keyboard focus here, so only the pause stops its input.
        await hold("Escape", 40);
        pageState = await until(async () => {
            const s = await read();
            return s.menu ? s : null;
        }, 2000);
        if (!pageState)
            bad(
                "KEYS_ESCAPE_NOT_PAGE",
                "Escape in the game did not open the page's menu"
            );
        else {
            await page.waitForTimeout(150);
            const before = await probe();
            await hold(moveKey, 500);
            const after = await probe();
            steps.push({
                step: "menu",
                delivered: after.delivered - before.delivered,
                moved:
                    !!before.probe?.position &&
                    !same(after.probe?.position, before.probe.position),
            });
            if (!before.paused || before.reason !== "menu")
                bad(
                    "KEYS_NOT_PAUSED",
                    "the game was not told input paused while the page menu is open"
                );
            if (after.delivered !== before.delivered)
                bad(
                    "KEYS_LEAK",
                    "the game took input while the page menu was open"
                );
            if (
                before.probe?.position &&
                !same(after.probe?.position, before.probe.position)
            )
                bad(
                    "KEYS_MOVED_IN_MENU",
                    "the player moved while the page menu was open"
                );
            await hold("Escape", 40);
            if (
                !(await until(
                    async () => !(await read()).menu && !(await probe()).paused,
                    2000
                ))
            )
                bad(
                    "KEYS_NOT_RESUMED",
                    "closing the page menu did not resume the game"
                );
        }

        // 6. Cmd/Ctrl+M is the page's: the game is told, it does not decide.
        //    (M on its own is the game's, like any other key.)
        const sound = await probe();
        await focusGame();
        await page.keyboard.down("Control");
        await hold("KeyM", 40);
        await page.keyboard.up("Control");
        pageState = await until(async () => {
            const s = await read();
            return s.muted ? s : null;
        }, 2000);
        if (!pageState)
            bad(
                "KEYS_MUTE_NOT_PAGE",
                "Ctrl+M in the game did not reach the page"
            );
        else {
            const muted = await probe();
            if (
                sound.probe &&
                "muted" in sound.probe &&
                muted.probe.muted !== true
            )
                bad(
                    "KEYS_MUTE_IGNORED",
                    "the game did not turn sound off when the page said so"
                );
            await page.keyboard.down("Control");
            await hold("KeyM", 40);
            await page.keyboard.up("Control");
            await page.waitForTimeout(150);
        }

        // 7. And input works again.
        await focusGame();
        await proveMove("resumed");
    } catch (error) {
        bad("KEYS_CHECK_ERROR", String(error?.message ?? error).slice(0, 300));
    } finally {
        await page.close().catch(() => {});
    }
    return { findings, steps };
}

/** Both halves, for games.mjs. Blocking findings and a report for check.json. */
export async function runKeysCheck({ browser, origin, id, manifest, source }) {
    const scan = await keysScan({ id, manifest, source });
    // A game that reads keys itself would only fail the browser half the same way.
    const run =
        scan.legacy || scan.findings.length
            ? { findings: [], steps: [] }
            : await keysBrowserCheck({ browser, origin, id, manifest });
    const findings = [...scan.findings, ...run.findings];
    return {
        findings,
        report: {
            status: findings.length
                ? "failed"
                : scan.legacy
                ? "legacy"
                : "passed",
            scanned: scan.files,
            warnings: scan.warnings,
            steps: run.steps,
        },
    };
}

if (
    process.argv[1] &&
    resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
    const [command, id] = process.argv.slice(2);
    const source = join(root, "games", id ?? "");
    if (command !== "scan" || !id || !existsSync(join(source, "game.json"))) {
        console.error("usage: keysCheck.mjs scan <id>");
        process.exit(2);
    }
    const scan = await keysScan({
        id,
        manifest: JSON.parse(readFileSync(join(source, "game.json"), "utf8")),
    });
    for (const finding of [...scan.findings, ...scan.warnings])
        console.log(
            `${scan.legacy ? "warn " : ""}${finding.code}: ${finding.message}`
        );
    console.log(
        `${id}: ${
            scan.findings.length ? "failed" : scan.legacy ? "legacy" : "passed"
        } · ${scan.files} files scanned`
    );
    process.exit(scan.findings.length ? 1 : 0);
}
