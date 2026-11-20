// The locomotion stage of `pnpm games:check`.
//
// A game whose visitors walk declares `"locomotion": "lobby"` in game.json
// and exposes its walker (exposeLocomotionProbe in games/kits/locomotion).
// This stage holds forward for two seconds of the game's own clock and
// asserts the ground covered matches the lobby's, computed from the lobby's
// own movement code, within 5 %. Games about another way of moving leave
// the key out (or say "own") and the stage is skipped.
import { createRequire } from "node:module";

const lobby = createRequire(import.meta.url)(
    "../../multiplayer/protocol/movement.js"
);

export const HOLD_SECONDS = 2;
export const TOLERANCE = 0.05;

/** Metres the lobby covers from rest with forward held for `seconds`. */
export function lobbyDistance(seconds, running = false) {
    const state = lobby.state();
    const input = lobby.input({
        strafe: 0,
        forward: -1,
        yaw: 0,
        running,
        jump: false,
        animation: -1,
    });
    for (let n = Math.round(seconds / lobby.STEP); n > 0; n--)
        lobby.step(state, input);
    return Math.hypot(state.x, state.z);
}

/** Compare a measured walk with the lobby's. `sample` is the walker after
 * forward was held: where it is, its clock, and where and when it last stood
 * still (`rest`), in the game's units; `scale` is game units per lobby
 * metre. `since` is the walker's clock when the key went down. */
export function judgeWalk(sample, since, wallSeconds) {
    const seconds = sample.time - sample.rest.time;
    const metres =
        Math.hypot(sample.x - sample.rest.x, sample.z - sample.rest.z) /
        (sample.scale || 1);
    const expected = lobbyDistance(seconds);
    const round = (n) => Math.round(n * 1000) / 1000;
    const result = {
        seconds: round(seconds),
        wallSeconds: round(wallSeconds),
        metres: round(metres),
        lobbyMetres: round(expected),
        tolerance: TOLERANCE,
    };
    if (sample.rest.time < since - 1e-6 || seconds < HOLD_SECONDS)
        return {
            status: "failed",
            ...result,
            error: `the walker did not walk from rest for ${HOLD_SECONDS} s while forward was held (its clock advanced ${round(
                sample.time - since
            )} s)`,
        };
    if (Math.abs(metres - expected) > expected * TOLERANCE)
        return {
            status: "failed",
            ...result,
            error: `walked ${round(metres)} m in ${round(
                seconds
            )} s; the lobby covers ${round(expected)} m (allowed ±${
                TOLERANCE * 100
            } %)`,
        };
    return { status: "passed", ...result };
}

/** The stage has a visit of the check page to itself (`/locomotion`:
 * straight in, alone). Wait until the game is ready and, when it speaks the
 * contract, has been entered: a walk begun earlier would be replaced. */
async function visitEntered(page) {
    // Software rendering (no GPU) can need longer: GAMES_CHECK_TIMEOUT_S.
    const deadline =
        Date.now() + (Number(process.env.GAMES_CHECK_TIMEOUT_S) || 180) * 1000;
    const read = () =>
        page.evaluate(() => ({
            ready: !!window.__readyAt,
            entered: !!window.__game?.["arrival-ready"],
            error: window.__gameError ?? null,
        }));
    let visit = await read();
    while (!visit.ready && !visit.error && Date.now() < deadline) {
        await page.waitForTimeout(250);
        visit = await read();
    }
    if (visit.error) throw new Error(`the game failed: ${visit.error}`);
    if (!visit.ready) throw new Error("the game was not ready in time");
    // An older build has no `enter`: don't wait for ever.
    for (let n = 0; n < 40 && !visit.entered; n++) {
        await page.waitForTimeout(250);
        visit = await read();
    }
}

/** Run the stage on a page that has the game in its frame. Returns null when
 * the game does not claim the lobby's walk. */
export async function locomotionStage(page, manifest) {
    if (manifest.locomotion !== "lobby") return null;
    const frame = page.frames().find((f) => f !== page.mainFrame());
    const read = () =>
        frame.evaluate(() => globalThis.__oncyberLocomotion?.read() ?? null);
    try {
        if (!frame) throw new Error("no game frame");
        await visitEntered(page);
        const hasProbe = await frame
            .waitForFunction(() => !!globalThis.__oncyberLocomotion, null, {
                timeout: 10_000,
            })
            .then(
                () => true,
                () => false
            );
        if (!hasProbe)
            throw new Error(
                'game.json says "locomotion": "lobby" but the game exposes no walker (exposeLocomotionProbe)'
            );
        await frame.evaluate(() => globalThis.__oncyberLocomotion.begin?.());
        // Keys go to the focused frame, as they do for a visitor who clicked in.
        await page.locator("iframe").first().focus();
        await frame.evaluate(() => window.focus());
        let before = null;
        for (let n = 0; n < 50 && !before; n++) {
            await page.waitForTimeout(100);
            before = await read();
        }
        if (!before) throw new Error("the game has no walker after begin()");
        // Standing still when the key goes down, so the walk starts from rest.
        for (let n = 0; n < 50 && before.rest.time < before.time - 1e-6; n++) {
            await page.waitForTimeout(100);
            before = (await read()) ?? before;
        }
        const started = Date.now();
        await page.keyboard.down("KeyW");
        let after = before;
        try {
            // Timed on the game's clock: a slow machine walks the same distance.
            while (
                after.time - after.rest.time < HOLD_SECONDS &&
                Date.now() - started < 60_000
            ) {
                await page.waitForTimeout(50);
                after = (await read()) ?? after;
            }
        } finally {
            await page.keyboard.up("KeyW");
        }
        return judgeWalk(after, before.time, (Date.now() - started) / 1000);
    } catch (error) {
        return {
            status: "failed",
            error: String(error?.message ?? error).slice(0, 300),
        };
    }
}
