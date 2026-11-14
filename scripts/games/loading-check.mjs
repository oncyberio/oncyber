// The loading and pausing stage of `pnpm games:check` (see games.mjs and
// docs/games/loading-and-pausing.md). It runs after the game's own check,
// on the live game, and proves four things from outside the frame:
//
//   first frame  the game sent `first-frame`, before `ready`, inside the budget
//   progress     the page got at least one `progress` message before it
//   resize       after each resize the canvas is drawn in the same task and
//                on the next frame (never blank), at the new shape
//   pause        an open page menu and a hidden tab: a solo game's state
//                holds and then moves again; a multiplayer match keeps moving
//
// The game side is games/runtime/src/loading.ts and pausing.ts, which leave
// read-only reports on `__oncyberGame` inside the frame.

/** Default budget from the frame's start to its first frame, on loopback. */
export const FIRST_FRAME_BUDGET_MS = 5000;

/** Added to the check page: records what the game tells the page while it loads. */
export const loadingHarness = `
(() => {
    const game = document.getElementById("game");
    const seen = (window.__loading = { progress: [], firstFrame: null, frames: [], readyAt: null, prefix: "" });
    addEventListener("message", (event) => {
        if (event.source !== game.contentWindow) return;
        const type = event.data && event.data.type;
        if (typeof type !== "string" || !type.includes(":")) return;
        const at = Math.round(performance.now());
        const kind = type.slice(type.indexOf(":") + 1);
        if (!type.startsWith("oncyber:")) seen.prefix = type.slice(0, type.indexOf(":") + 1);
        if (kind === "progress") seen.progress.push({ at, value: event.data.value, label: event.data.label });
        else if (kind === "first-frame") seen.firstFrame = seen.firstFrame || { at, ms: event.data.ms, width: event.data.width, height: event.data.height };
        else if (kind === "frame") seen.frames.push({ at, width: event.data.width, height: event.data.height });
        else if (kind === "ready") seen.readyAt = seen.readyAt || at;
    });
    window.__gamePost = (kind, data) => game.contentWindow.postMessage({ type: seen.prefix + kind, ...data }, "*");
})();
`;

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sleep = (page, ms) => page.waitForTimeout(ms);
const gameReport = (game) =>
    game.evaluate(() => ({
        loading: globalThis.__oncyberGame?.loading?.() ?? null,
        pausing: globalThis.__oncyberGame?.pausing?.() ?? null,
    }));

/** Inside the game frame: is the largest canvas showing a picture right now? */
function installResizeProbe() {
    const probe = (window.__resizeProbe = { samples: [] });
    const pad = document.createElement("canvas");
    pad.width = pad.height = 24;
    const pen = pad.getContext("2d", { willReadFrequently: true });
    const sample = (when) => {
        const canvas = [...document.querySelectorAll("canvas")].sort(
            (a, b) => b.width * b.height - a.width * a.height
        )[0];
        const entry = {
            when,
            width: innerWidth,
            height: innerHeight,
            canvas: canvas ? [canvas.width, canvas.height] : null,
            blank: true,
            error: "",
        };
        try {
            pen.clearRect(0, 0, 24, 24);
            pen.drawImage(canvas, 0, 0, 24, 24);
            const pixels = pen.getImageData(0, 0, 24, 24).data;
            // Blank: every sampled pixel is the same colour (a cleared canvas).
            for (let i = 4; i < pixels.length && entry.blank; i += 4)
                for (let c = 0; c < 4; c++)
                    if (Math.abs(pixels[i + c] - pixels[c]) > 3)
                        entry.blank = false;
        } catch (error) {
            entry.error = String(error?.message ?? error);
        }
        probe.samples.push(entry);
    };
    probe.sample = sample;
    // Added after the game's own listener, so it sees what the game left.
    addEventListener("resize", () => {
        sample("resize");
        requestAnimationFrame(() => sample("frame"));
    });
}

function setHidden(hidden) {
    Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => hidden,
    });
    Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => (hidden ? "hidden" : "visible"),
    });
    document.dispatchEvent(new Event("visibilitychange"));
}

/**
 * @param page      the check page (Playwright), with the game past its own check
 * @param manifest  the game's game.json
 * @param required  false: a game that hasn't adopted the helpers is skipped
 */
export async function checkLoading(page, { manifest, required }) {
    const findings = [],
        notes = [];
    const flag = (code, message) => findings.push({ code, message });
    const budget =
        manifest.loading?.firstFrameBudgetMs ?? FIRST_FRAME_BUDGET_MS;
    const game = page
        .frames()
        .find((frame) => frame.parentFrame() === page.mainFrame());
    const seen = await page.evaluate(() => window.__loading);
    const first = await gameReport(game);
    if (!first.loading && !first.pausing && !seen.firstFrame && !required)
        return {
            status: "skipped",
            notes: ["the game does not use games/runtime loading and pausing"],
            findings,
        };

    // ---- first frame and progress
    if (!seen.firstFrame)
        flag("FIRST_FRAME_MISSING", "the game never sent first-frame");
    else {
        if (seen.firstFrame.at > budget)
            flag(
                "FIRST_FRAME_SLOW",
                `first frame after ${seen.firstFrame.at} ms; the budget is ${budget} ms`
            );
        if (seen.readyAt !== null && seen.readyAt < seen.firstFrame.at)
            flag(
                "READY_BEFORE_FIRST_FRAME",
                "ready was sent before first-frame"
            );
    }
    const before = seen.progress.filter(
        (p) => !seen.firstFrame || p.at <= seen.firstFrame.at
    );
    if (!before.length)
        flag(
            "PROGRESS_MISSING",
            "no progress message reached the page before the first frame"
        );
    if (before.some((p, i) => i && p.value < before[i - 1].value))
        flag("PROGRESS_WENT_DOWN", "progress values must not decrease");

    // ---- resize: never a blank canvas, and the new shape by the next frame
    const viewport = page.viewportSize();
    const resize = [];
    await game.evaluate(installResizeProbe);
    await game.evaluate(
        () =>
            new Promise((done) =>
                requestAnimationFrame(
                    () => (window.__resizeProbe.sample("baseline"), done())
                )
            )
    );
    const baseline = (
        await game.evaluate(() => window.__resizeProbe.samples)
    )[0];
    // Some headless WebGPU setups can't be read back (or lose the device);
    // that is the machine, not the rule, so it is noted and not judged.
    if (baseline.blank)
        notes.push(
            `resize not judged: the canvas reads as blank before any resize${
                baseline.error ? ` (${baseline.error})` : ""
            }`
        );
    else
        for (const size of [
            { width: 900, height: 620 },
            { width: 520, height: 700 },
            viewport,
        ]) {
            const from = await game.evaluate(
                () => window.__resizeProbe.samples.length
            );
            await page.setViewportSize(size);
            let samples = [];
            for (let i = 0; i < 40 && samples.length < 2; i++) {
                await sleep(page, 50);
                samples = (
                    await game.evaluate(() => window.__resizeProbe.samples)
                ).slice(from);
            }
            await sleep(page, 150);
            const announced = (
                await page.evaluate(() => window.__loading.frames)
            ).some((f) => f.width === size.width && f.height === size.height);
            const last = samples.findLast((s) => s.when === "frame");
            const shape = last?.canvas
                ? Math.abs(
                      last.canvas[0] / last.canvas[1] - size.width / size.height
                  ) /
                  (size.width / size.height)
                : 1;
            const result = {
                ...size,
                blank: !samples.length || samples.some((s) => s.blank),
                redrawn: shape < 0.03,
                announced,
            };
            resize.push(result);
            const label = `${size.width}x${size.height}`;
            if (!samples.length)
                flag(
                    "RESIZE_NOT_SEEN",
                    `no resize reached the game at ${label}`
                );
            else if (result.blank)
                flag(
                    "RESIZE_BLANK_FRAME",
                    `the canvas was blank after resizing to ${label}; draw in the resize handler`
                );
            if (samples.length && !result.redrawn)
                flag(
                    "RESIZE_NOT_REDRAWN",
                    `the canvas kept its old shape a frame after resizing to ${label}`
                );
            if (!announced)
                flag(
                    "RESIZE_NOT_ANNOUNCED",
                    `the page was not told about the redraw at ${label} (loading.redrawn)`
                );
        }

    // ---- pause: a page menu, then a hidden tab
    const pause = {
        mode: first.pausing?.mode ?? null,
        menu: null,
        hidden: null,
    };
    if (!first.pausing)
        flag(
            "PAUSING_MISSING",
            "the game has no pausing (games/runtime/src/pausing.ts)"
        );
    else {
        // The game must be in play, or a held state proves nothing.
        let moving = false,
            previous = (await gameReport(game)).pausing.fingerprint;
        for (let i = 0; i < 60 && !moving; i++) {
            await sleep(page, 250);
            const next = (await gameReport(game)).pausing.fingerprint;
            moving = !same(next, previous);
            previous = next;
        }
        if (!moving)
            flag(
                "PAUSE_NOT_PLAYING",
                "the game's fingerprint never changed, so a pause can't be told from play"
            );
        else
            for (const reason of ["menu", "hidden"]) {
                const set = (on) =>
                    reason === "menu"
                        ? page.evaluate(
                              ([kind]) =>
                                  window.__gamePost(kind, { reason: "menu" }),
                              [on ? "pause" : "resume"]
                          )
                        : game.evaluate(setHidden, on);
                await set(true);
                await sleep(page, 400);
                const a = (await gameReport(game)).pausing;
                await sleep(page, 1000);
                const b = (await gameReport(game)).pausing;
                let outcome;
                if (a.mode === "solo") {
                    if (!a.paused)
                        flag(
                            "PAUSE_IGNORED",
                            `a solo game did not pause for ${reason}`
                        );
                    else if (!same(a.fingerprint, b.fingerprint))
                        flag(
                            "PAUSE_STATE_MOVED",
                            `state changed while paused for ${reason}`
                        );
                    outcome =
                        a.paused && same(a.fingerprint, b.fingerprint)
                            ? "held"
                            : "failed";
                } else {
                    if (b.paused)
                        flag(
                            "MATCH_PAUSED",
                            `a multiplayer match paused for ${reason}; it must keep simulating`
                        );
                    else if (same(a.fingerprint, b.fingerprint))
                        flag(
                            "MATCH_STOPPED",
                            `a multiplayer match stopped moving for ${reason}`
                        );
                    outcome =
                        !b.paused && !same(a.fingerprint, b.fingerprint)
                            ? "kept playing"
                            : "failed";
                }
                await set(false);
                let after = b;
                for (let i = 0; i < 12; i++) {
                    await sleep(page, 250);
                    after = (await gameReport(game)).pausing;
                    // A game may keep its own pause menu up after a hidden tab;
                    // after a page menu it must be playing again.
                    if (
                        !after.paused &&
                        (reason === "hidden" ||
                            !same(after.fingerprint, b.fingerprint))
                    )
                        break;
                }
                if (after.paused || after.reasons.length)
                    flag("RESUME_STUCK", `still paused after ${reason} ended`);
                else if (
                    reason === "menu" &&
                    same(after.fingerprint, b.fingerprint)
                )
                    flag(
                        "RESUME_STUCK",
                        "state did not move again after the page menu closed"
                    );
                else if (
                    a.mode === "multiplayer" &&
                    reason === "hidden" &&
                    !(after.caughtUp > 0)
                )
                    flag(
                        "MATCH_NO_CATCH_UP",
                        "a hidden multiplayer match never caught up on missed time"
                    );
                pause[reason] = outcome;
            }
    }

    return {
        status: findings.length ? "failed" : "passed",
        firstFrameMs: seen.firstFrame?.at ?? null,
        firstFrameBudgetMs: budget,
        // The game's own clock, from its document's start.
        gameFirstFrameMs: seen.firstFrame?.ms ?? null,
        progress: {
            messages: before.length,
            labels: [
                ...new Set(before.map((p) => p.label).filter(Boolean)),
            ].slice(0, 12),
        },
        resize,
        pause,
        notes,
        findings,
    };
}
