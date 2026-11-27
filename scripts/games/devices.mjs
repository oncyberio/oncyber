// The device stage of `pnpm games:check`: reruns the check in a phone-sized
// touch viewport and with a stand-in gamepad, pressing the controls the
// runtime builds from game.json's input bindings (games/runtime/src/
// deviceControls.ts). Results are reported per device and only block a
// release when game.json claims the phone and the phone run fails.
// Rules for game authors: docs/games/devices.md.
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { SCENE_PROBE, readScene } from "./scene-profile.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const PHONE = "Pixel 7";
const SOURCE_TYPES = new Set([".js", ".mjs", ".ts", ".tsx", ".jsx", ".html"]);
const SKIP_DIRS = new Set([
    "node_modules",
    ".check",
    "test",
    "tests",
    "scripts",
    "public",
    "dist",
]);

function sourceFiles(dir, base = dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory())
            return SKIP_DIRS.has(entry.name) || entry.name.startsWith(".")
                ? []
                : sourceFiles(path, base);
        if (
            !SOURCE_TYPES.has(extname(entry.name)) ||
            /\.(test|config)\.[a-z]+$/.test(entry.name)
        )
            return [];
        return [
            {
                path: relative(base, path).split(sep).join("/"),
                text: readFileSync(path, "utf8"),
            },
        ];
    });
}

/**
 * Runs inside the check page's message listener (the `harness` of
 * games.mjs): a device profile's game asks for each scenario action to be
 * pressed on the real control, and hears back once it has been.
 */
export const devicesHarness = `
    if (type === "oncyber:check-input" && typeof window.__deviceInput === "function") {
        const { id, action, value } = event.data;
        Promise.resolve().then(() => window.__deviceInput(String(action), Number(value)))
            .catch((e) => String(e && e.message || e))
            .then((error) => frame.contentWindow.postMessage({ type: "oncyber:check-input-done", id, error: error || null }, "*"));
    }`;

// A connected standard gamepad whose state the check sets.
const FAKE_PAD = `(() => {
    const pad = { id: "Check gamepad (STANDARD GAMEPAD)", index: 0, connected: true, mapping: "standard", timestamp: 0,
        axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
    window.__checkPad = pad;
    Object.defineProperty(Navigator.prototype, "getGamepads", { configurable: true, value: () => [pad, null, null, null] });
})();`;

/** Reads the runtime's controls inside the game frame, in frame coordinates. */
const readControls = () => {
    const devices = window.__oncyberDevices;
    const box = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const shown =
            r.width > 0 &&
            r.height > 0 &&
            getComputedStyle(el).visibility !== "hidden";
        return { x: r.left, y: r.top, width: r.width, height: r.height, shown };
    };
    if (!devices) return null;
    const rootEl = document.querySelector("[data-oncyber-controls]");
    return {
        built: Boolean(rootEl),
        viewport: { width: innerWidth, height: innerHeight },
        stick: devices.layout.stick,
        stickZone: box(rootEl && rootEl.querySelector("[data-oncyber-stick]")),
        stickBase: box(
            rootEl && rootEl.querySelector("[data-oncyber-stick-base]")
        ),
        reach: devices.reach,
        buttons: devices.layout.buttons.map((b) => ({
            ...b,
            box: box(
                rootEl &&
                    rootEl.querySelector(
                        '[data-oncyber-action="' + b.action + '"]'
                    )
            ),
        })),
        pads: devices.pads,
        log: JSON.parse(JSON.stringify(devices.log)),
    };
};

/** Touches through the browser's own input pipeline, several fingers at once. */
function touchDriver(cdp) {
    const points = new Map();
    const list = () =>
        [...points.values()].map((p) => ({
            x: Math.round(p.x),
            y: Math.round(p.y),
            id: p.id,
            radiusX: 8,
            radiusY: 8,
            force: 1,
        }));
    let ids = 0;
    return {
        has: (key) => points.has(key),
        async down(key, x, y) {
            points.set(key, { id: ++ids, x, y });
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchStart",
                touchPoints: list(),
            });
        },
        async move(key, x, y) {
            Object.assign(points.get(key), { x, y });
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: list(),
            });
        },
        async up(key) {
            if (!points.delete(key)) return;
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchEnd",
                touchPoints: list(),
            });
        },
        async clear() {
            if (!points.size) return;
            points.clear();
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchEnd",
                touchPoints: [],
            });
        },
    };
}

function geometry(controls) {
    const findings = [];
    const { width, height } = controls.viewport;
    const items = [
        ...(controls.stickZone
            ? [{ name: "stick", box: controls.stickZone }]
            : []),
        ...controls.buttons.map((b) => ({ name: b.action, box: b.box })),
    ].filter((item) => item.box?.shown);
    for (const { name, box } of items) {
        if (Math.min(box.width, box.height) < 44)
            findings.push({
                code: "TOUCH_TARGET_SMALL",
                message: `${name} is ${Math.round(box.width)} x ${Math.round(
                    box.height
                )} px; keep touch targets at 44 px or more`,
            });
        if (
            box.x < 0 ||
            box.y < 0 ||
            box.x + box.width > width + 0.5 ||
            box.y + box.height > height + 0.5
        )
            findings.push({
                code: "TOUCH_CONTROL_OFFSCREEN",
                message: `${name} leaves the ${width} x ${height} viewport`,
            });
    }
    for (let i = 0; i < items.length; i++)
        for (let j = i + 1; j < items.length; j++) {
            const a = items[i].box,
                b = items[j].box;
            if (
                a.x < b.x + b.width - 1 &&
                b.x < a.x + a.width - 1 &&
                a.y < b.y + b.height - 1 &&
                b.y < a.y + a.height - 1
            )
                findings.push({
                    code: "TOUCH_CONTROLS_OVERLAP",
                    message: `${items[i].name} and ${items[j].name} overlap`,
                });
        }
    return findings;
}

async function runProfile({
    browser,
    playwright,
    lib,
    origin,
    id,
    manifest,
    source,
    lifecycle,
    profile,
}) {
    const phone = profile === "phone";
    const context = await browser.newContext(
        phone
            ? { ...playwright.devices[PHONE] }
            : { viewport: { width: 1280, height: 720 } }
    );
    if (!phone) await context.addInitScript(FAKE_PAD);
    // What the phone's canvas is drawn at (scene-profile.mjs).
    else await context.addInitScript(SCENE_PROBE);
    const page = await context.newPage();
    const errors = [],
        pageErrors = [],
        findings = [];
    page.on(
        "console",
        (m) => m.type() === "error" && errors.push(m.text().slice(0, 500))
    );
    page.on("pageerror", (e) =>
        pageErrors.push(String(e.message).slice(0, 500))
    );
    const cdp = await context.newCDPSession(page);
    const touch = touchDriver(cdp);
    const input = manifest.runtime?.input ?? {};
    const gameFrame = () => page.mainFrame().childFrames()[0];
    const controlsNow = async () => {
        const frame = gameFrame();
        return frame ? frame.evaluate(readControls).catch(() => null) : null;
    };
    const offset = async () =>
        (await (await gameFrame().frameElement()).boundingBox()) ?? {
            x: 0,
            y: 0,
        };

    // The stick is one finger for all of its actions.
    const stickState = {};
    async function pressTouch(action, value) {
        const controls = await controlsNow();
        const part = controls?.stick.find((s) => s.action === action);
        const button = controls?.buttons.find((b) => b.action === action);
        if (!part && !button) return `NO_TOUCH_CONTROL:${action}`;
        const at = await offset();
        if (button) {
            if (!button.box?.shown) return `TOUCH_CONTROL_HIDDEN:${action}`;
            if (value !== 0 && value !== 1)
                return `TOUCH_VALUE_UNSUPPORTED:${action}`;
            if (value)
                await touch.down(
                    action,
                    at.x + button.box.x + button.box.width / 2,
                    at.y + button.box.y + button.box.height / 2
                );
            else await touch.up(action);
            return null;
        }
        if (!controls.stickBase?.shown) return `TOUCH_CONTROL_HIDDEN:${action}`;
        stickState[action] = value;
        let x = 0,
            y = 0;
        for (const s of controls.stick) {
            const v = (stickState[s.action] ?? 0) * (s.sign || 1);
            if (s.axis === "x") x += v;
            else y += v;
        }
        const length = Math.hypot(x, y);
        if (length > 1) {
            x /= length;
            y /= length;
        }
        const cx = at.x + controls.stickBase.x + controls.stickBase.width / 2,
            cy = at.y + controls.stickBase.y + controls.stickBase.height / 2;
        if (!x && !y) return touch.up("stick").then(() => null);
        if (!touch.has("stick")) await touch.down("stick", cx, cy);
        await touch.move(
            "stick",
            cx + x * controls.reach,
            cy - y * controls.reach
        );
        return null;
    }
    async function pressPad(action, value) {
        const source = lib
            .gamepadBindings(input[action])
            .map(lib.parseGamepad)
            .find(Boolean);
        if (!source) return `NO_GAMEPAD_BINDING:${action}`;
        await gameFrame().evaluate(
            ({ source, value }) => {
                const pad = window.__checkPad;
                if (source.kind === "button")
                    pad.buttons[source.index] = {
                        pressed: value > 0,
                        touched: value > 0,
                        value: value > 0 ? 1 : 0,
                    };
                else
                    pad.axes[source.index] =
                        (source.invert ? -1 : 1) * (source.sign || 1) * value;
                pad.timestamp = performance.now();
            },
            { source, value }
        );
        return null;
    }
    const press = phone ? pressTouch : pressPad;
    await page.exposeFunction("__deviceInput", (action, value) =>
        press(action, value)
    );

    let report = null,
        gameError = null,
        readyAt = null,
        controls = null,
        drawn = null;
    const started = Date.now();
    try {
        // The check page of games.mjs, staging the scenario's visit for ?check=<profile>.
        await page.goto(`${origin}/devices/${profile}`);
        // Software rendering (no GPU) can need longer: GAMES_CHECK_TIMEOUT_S.
        const deadline =
            Date.now() +
            (Number(process.env.GAMES_CHECK_TIMEOUT_S) || 180) * 1000;
        while (
            Date.now() < deadline &&
            !report &&
            !gameError &&
            !(readyAt && !lifecycle)
        ) {
            await page.waitForTimeout(500);
            ({ report, gameError, readyAt } = await page.evaluate(() => ({
                report: window.__report ?? null,
                gameError: window.__gameError ?? null,
                readyAt: window.__readyAt ?? null,
            })));
        }
        if (!lifecycle && readyAt) {
            // No scenario to play: press every control the runtime built and
            // see each one reach the game.
            report = {
                status: "passed",
                backend: "unknown",
                bootMs: Math.round(readyAt),
                stages: [
                    {
                        stage: "boot",
                        status: "passed",
                        ms: Math.round(readyAt),
                    },
                ],
                frames: null,
                inspect: null,
                bootOnly: true,
            };
            findings.push(...(await probe()));
        }
        controls = await controlsNow();
        if (phone && controls?.built) findings.push(...geometry(controls));
        mkdirSync(join(source, ".check"), { recursive: true });
        await page.screenshot({
            path: join(source, `.check/screenshot-${profile}.png`),
        });
        await touch.clear().catch(() => {});
        if (phone) drawn = await readScene(page);
    } finally {
        await context.close();
    }

    async function probe() {
        const out = [];
        const wanted = phone ? null : (await controlsNow())?.pads;
        // Controls may wait for play to start (a title screen hides them).
        let seenControls = null;
        for (let i = 0; i < 40; i++) {
            seenControls = await controlsNow();
            if (
                !phone
                    ? seenControls
                    : seenControls?.built &&
                      (seenControls.stickBase?.shown ||
                          seenControls.buttons.some((b) => b.box?.shown))
            )
                break;
            await page.waitForTimeout(500);
        }
        if (!seenControls)
            return [
                {
                    code: "NO_DEVICE_LAYER",
                    message:
                        "the game does not use the runtime's input (bindBrowserInput), so nothing can be pressed",
                },
            ];
        const actions = phone
            ? [
                  ...seenControls.stick.map((s) => s.action),
                  ...seenControls.buttons.map((b) => b.action),
              ]
            : wanted ?? seenControls.pads;
        if (!actions.length)
            return [
                {
                    code: phone ? "NO_TOUCH_CONTROLS" : "NO_GAMEPAD_BINDINGS",
                    message: `game.json declares no ${
                        phone ? "stick or button" : "gamepad"
                    } bindings`,
                },
            ];
        for (const action of actions) {
            const before = (await controlsNow())?.log[action]?.count ?? 0;
            const error = await press(action, 1);
            if (error) {
                out.push({
                    code: error.split(":")[0],
                    message: `${action}: ${error}`,
                });
                continue;
            }
            let entry = null;
            for (let i = 0; i < 40; i++) {
                await page.waitForTimeout(50);
                entry = (await controlsNow())?.log[action];
                if (entry && entry.count > before && entry.value > 0.9) break;
            }
            await press(action, 0);
            // A gamepad is read once a frame, and frames can be slow here.
            let after = null;
            for (let i = 0; i < 40; i++) {
                await page.waitForTimeout(50);
                after = (await controlsNow())?.log[action];
                if (after?.value === 0) break;
            }
            if (
                !(
                    entry &&
                    entry.count > before &&
                    entry.value > 0.9 &&
                    entry.device === (phone ? "touch" : "gamepad")
                )
            )
                out.push({
                    code: "CONTROL_DEAD",
                    message: `${action}: pressing it on the ${profile} did not reach the game`,
                });
            else if (after?.value !== 0)
                out.push({
                    code: "CONTROL_STUCK",
                    message: `${action}: still held after release`,
                });
        }
        return out;
    }

    findings.push(
        ...(gameError ? [{ code: "GAME_FAILED", message: gameError }] : []),
        ...(report?.bootOnly
            ? pageErrors.map((message) => ({ code: "PAGE_ERROR", message }))
            : []),
        ...(!report && !gameError
            ? [
                  {
                      code: "CHECK_TIMEOUT",
                      message: `no report after ${Math.round(
                          (Date.now() - started) / 1000
                      )} s`,
                  },
              ]
            : []),
        ...(report?.stages ?? [])
            .filter((s) => s.status === "failed")
            .map((s) => ({
                code: `STAGE_${s.stage.toUpperCase()}`,
                message: s.error ?? "failed",
            }))
    );
    const viewport = phone
        ? playwright.devices[PHONE].viewport
        : { width: 1280, height: 720 };
    return {
        status:
            report?.status === "passed" && !findings.length
                ? "passed"
                : "failed",
        input: phone ? "touch" : "gamepad",
        viewport: `${viewport.width} x ${viewport.height}`,
        ...(phone ? { emulates: PHONE } : {}),
        scope: lifecycle ? "scenario" : "controls",
        findings,
        controls:
            controls && phone
                ? {
                      stick: controls.stick.map((s) => s.action),
                      buttons: controls.buttons.map((b) => b.action),
                  }
                : undefined,
        consoleErrors: [...pageErrors, ...errors].slice(0, 10),
        run: report,
        ...(drawn ? { drawn } : {}),
    };
}

/**
 * Returns `{ report, blocking, lines }`: the `devices` block for check.json,
 * the findings that fail the check, and the lines to print.
 */
export async function checkDevices({
    browser,
    port,
    id,
    manifest,
    source,
    lifecycle,
    desktop,
}) {
    let lib;
    try {
        lib = await import("../../games/runtime/src/devices.ts");
    } catch (error) {
        const message = `device profiles skipped: this Node cannot load TypeScript (${String(
            error.code ?? error.message
        ).slice(0, 80)}); use Node 22.18 or later`;
        return {
            report: {
                declared: [],
                notes: [{ code: "DEVICES_SKIPPED", message }],
                profiles: {},
            },
            blocking: [],
            lines: [`  devices: ${message}`],
        };
    }
    const playwright = createRequire(import.meta.url)("playwright");
    const scenarioPath = join(source, "scenario.json");
    const actions = existsSync(scenarioPath)
        ? (JSON.parse(readFileSync(scenarioPath, "utf8")).steps ?? [])
              .filter((s) => s.type === "action")
              .map((s) => s.action)
        : [];
    const described = lib.describeDevices(manifest, actions);
    const notes = [
        ...described.findings,
        ...lib.scanDeviceCode(sourceFiles(source)),
    ];
    const origin = `http://127.0.0.1:${port}`;
    const profiles = {
        desktop: {
            status: desktop?.status === "passed" ? "passed" : "failed",
            input: "keyboard",
            viewport: "1280 x 720",
            scope: lifecycle ? "scenario" : "boot",
        },
    };
    const run = (profile) =>
        runProfile({
            browser,
            playwright,
            lib,
            origin,
            id,
            manifest,
            source,
            lifecycle,
            profile,
        }).catch((error) => ({
            status: "failed",
            input: profile === "phone" ? "touch" : "gamepad",
            findings: [
                {
                    code: "PROFILE_CRASHED",
                    message: String(error.message ?? error).slice(0, 300),
                },
            ],
            run: null,
        }));
    profiles.phone = await run("phone");
    // Without a single gamepad binding there is nothing to rerun.
    if (described.gamepad.length || described.declared.includes("gamepad"))
        profiles.gamepad = await run("gamepad");
    for (const [name, profile] of Object.entries(profiles))
        profile.claimed = described.declared.includes(name);

    const blocking = [];
    if (profiles.phone.claimed && profiles.phone.status !== "passed")
        blocking.push({
            code: "PHONE_FAILED",
            message: `game.json claims the phone but the phone run failed: ${
                profiles.phone.findings
                    .map((f) => `${f.code} ${f.message}`)
                    .join("; ")
                    .slice(0, 300) || "no report"
            }`,
        });
    const lines = Object.entries(profiles).map(
        ([name, p]) =>
            `  ${name.padEnd(8)} ${p.status}${
                p.claimed ? "" : " (not claimed in game.json)"
            } · ${p.input}${p.viewport ? ` · ${p.viewport}` : ""}` +
            (name !== "desktop" && p.findings?.length
                ? `\n${p.findings
                      .map((f) => `    ${f.code}: ${f.message}`)
                      .join("\n")}`
                : "")
    );
    for (const note of notes)
        lines.push(`  note ${note.code}: ${note.message}`);
    return {
        report: { declared: described.declared, notes, profiles },
        blocking,
        lines,
    };
}
