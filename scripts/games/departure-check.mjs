// The departure stage of `pnpm games:check`: does the game's last frame
// match the lobby's first? See docs/games/departure.md.
//
// The check page plays the part of the Oncyber page: it sends `departure`,
// waits for `departure-ready` and records frames across the seam.
//
//   last game frame    a screenshot once the game has answered. The game has
//                      faded its world to black, so what is lit is the avatar.
//   first lobby frame  the lobby opens on the view the game handed over: the
//                      avatar on black, its feet and head where that view
//                      projects them. Projected here; `--lobby <url>` also
//                      records the real seam from a running lobby, frame by
//                      frame (departure-lobby.mjs).
//
// The stage fails when the game doesn't answer in the time the page waits,
// hands over a view the lobby can't frame, shows a black or avatar-less
// frame at any point, leaves its world or interface on screen, or draws the
// avatar somewhere other than where the lobby will.
import { writeFileSync } from "node:fs";
import { join } from "node:path";

/** The page stops waiting after this long (gameDeparture.ts). */
export const DEPARTURE_WAIT_MS = 1500;
/** Shares of the frame. Position: 4 % of the frame; size: 15 % of the avatar. */
export const TOLERANCE = {
    x: 0.04,
    feet: 0.04,
    head: 0.06,
    size: 0.15,
    held: 0.02,
};
/** Below this share of lit pixels a frame counts as black. */
const MIN_LIT = 0.0015;
/** Lit pixels allowed away from the avatar: stray world or interface. */
const MAX_OUTSIDE = 0.01;
/** Frames of slack when the check browser itself is slow. */
const SLOW_FRAMES = 6;

const finite = (n) => typeof n === "number" && Number.isFinite(n);
const point = (p) =>
    !!p && [p.x, p.y, p.z].every((n) => finite(n) && Math.abs(n) <= 1000);

/** Same rules as readTravelView in games/runtime/src/departure.ts. */
export function readView(view) {
    if (
        !view ||
        !point(view.cameraOffset) ||
        !point(view.cameraTargetOffset) ||
        !finite(view.avatarRotation) ||
        !finite(view.avatarHeight) ||
        view.avatarHeight < 0.2 ||
        view.avatarHeight > 10 ||
        !finite(view.fov) ||
        view.fov <= 5 ||
        view.fov >= 150
    )
        return null;
    return view;
}

/**
 * Where the lobby draws the avatar on its first frame: feet at the origin,
 * head at avatarHeight, seen from the view's camera. Kept equal to
 * avatarOnScreen in games/runtime/src/departure.ts by a test.
 */
export function lobbyAvatarBox(view, aspect) {
    const eye = view.cameraOffset;
    const t = view.cameraTargetOffset;
    const fx = t.x - eye.x,
        fy = t.y - eye.y,
        fz = t.z - eye.z;
    const distance = Math.hypot(fx, fy, fz);
    if (distance < 1e-6) return null;
    const f = { x: fx / distance, y: fy / distance, z: fz / distance };
    const flat = Math.hypot(f.x, f.z);
    const r =
        flat > 1e-6
            ? { x: -f.z / flat, y: 0, z: f.x / flat }
            : { x: 1, y: 0, z: 0 };
    const u = {
        x: r.y * f.z - r.z * f.y,
        y: r.z * f.x - r.x * f.z,
        z: r.x * f.y - r.y * f.x,
    };
    const tan = Math.tan((view.fov * Math.PI) / 360);
    const project = (y) => {
        const d = { x: -eye.x, y: y - eye.y, z: -eye.z };
        const depth = d.x * f.x + d.y * f.y + d.z * f.z;
        if (depth < 0.05) return null;
        return {
            x:
                0.5 +
                (d.x * r.x + d.y * r.y + d.z * r.z) /
                    (depth * tan * aspect) /
                    2,
            y: 0.5 - (d.x * u.x + d.y * u.y + d.z * u.z) / (depth * tan) / 2,
        };
    };
    const feet = project(0),
        head = project(view.avatarHeight);
    if (!feet || !head) return null;
    return {
        x: (feet.x + head.x) / 2,
        top: head.y,
        bottom: feet.y,
        height: feet.y - head.y,
    };
}

/**
 * Compare the avatar measured in one frame with the avatar in another (or
 * with the lobby's projected box). Returns the problems, empty when matched.
 */
export function compareAvatar(game, lobby, tolerance = TOLERANCE) {
    const problems = [];
    const pct = (n) => `${(n * 100).toFixed(1)} %`;
    if (Math.abs(game.x - lobby.x) > tolerance.x)
        problems.push(
            `avatar is ${pct(Math.abs(game.x - lobby.x))} of the frame ${
                game.x < lobby.x ? "left" : "right"
            } of where the lobby draws it`
        );
    if (Math.abs(game.bottom - lobby.bottom) > tolerance.feet)
        problems.push(
            `feet are ${pct(
                Math.abs(game.bottom - lobby.bottom)
            )} of the frame ${
                game.bottom < lobby.bottom ? "above" : "below"
            } the lobby's`
        );
    if (Math.abs(game.top - lobby.top) > tolerance.head)
        problems.push(
            `head is ${pct(Math.abs(game.top - lobby.top))} of the frame ${
                game.top < lobby.top ? "above" : "below"
            } the lobby's`
        );
    const ratio = game.height / lobby.height;
    if (!(Math.abs(ratio - 1) <= tolerance.size))
        problems.push(
            `avatar is ${ratio.toFixed(2)}x the size the lobby draws it`
        );
    return problems;
}

/** Judge the recorded frames. Pure, so it can be tested without a browser. */
export function judgeDeparture({
    answerMs,
    answer,
    frames,
    last,
    held,
    aspect,
    frameMs = 0,
}) {
    const fail = (code, error, extra = {}) => ({
        status: "failed",
        code,
        error,
        ...extra,
    });
    if (answerMs == null)
        return fail(
            "DEPARTURE_NO_ANSWER",
            "the game never answered `departure` with `departure-ready`"
        );
    // A check browser without a GPU draws a few frames a second; the handful
    // of frames a departure needs must not count against the game.
    const allowed =
        DEPARTURE_WAIT_MS + SLOW_FRAMES * Math.max(0, frameMs - 1000 / 60);
    if (answerMs > allowed)
        return fail(
            "DEPARTURE_SLOW",
            `the last frame took ${Math.round(
                answerMs
            )} ms; the page waits ${DEPARTURE_WAIT_MS} ms`
        );
    const view = readView(answer?.view);
    if (!view)
        return fail(
            "DEPARTURE_NO_VIEW",
            `the game handed over no usable view${
                answer?.problem ? ` (${answer.problem})` : ""
            }`
        );
    const projected = lobbyAvatarBox(view, aspect);
    if (!projected)
        return fail(
            "DEPARTURE_NO_VIEW",
            "the view puts the avatar behind the camera"
        );
    const black = frames.find((frame) => frame.lit < MIN_LIT);
    if (black)
        return fail(
            "DEPARTURE_BLACK_FRAME",
            `a black, avatar-less frame ${black.ms} ms into leaving (${black.phase})`,
            { view }
        );
    if (!last.box)
        return fail(
            "DEPARTURE_NO_AVATAR",
            "the last game frame shows no avatar",
            { view }
        );
    const facts = {
        view,
        gameAvatar: last.box,
        lobbyAvatar: projected,
        lobbyFrame: "projected",
    };
    if (last.outside > MAX_OUTSIDE)
        return fail(
            "DEPARTURE_WORLD_VISIBLE",
            `${(last.outside * 100).toFixed(
                1
            )} % of the last frame is lit away from the avatar; fade the world and hide the interface`,
            facts
        );
    const problems = compareAvatar(last.box, projected);
    if (problems.length)
        return fail("DEPARTURE_MISMATCH", problems.join("; "), facts);
    if (!held?.box)
        return fail(
            "DEPARTURE_NOT_HELD",
            "the avatar disappeared after the game answered",
            facts
        );
    const moved = compareAvatar(held.box, last.box, {
        x: TOLERANCE.held,
        feet: TOLERANCE.held,
        head: TOLERANCE.held,
        size: 0.05,
    });
    if (moved.length)
        return fail(
            "DEPARTURE_NOT_HELD",
            `the frame changed after the game answered: ${moved.join("; ")}`,
            facts
        );
    return { status: "passed", ...facts };
}

/**
 * Judge a seam recorded from a running lobby: the game's last frames, then
 * the lobby's first, one animation frame apart, each `{ side, lit, box }`.
 */
export function judgeSeam(frames) {
    const fail = (code, error, extra = {}) => ({
        status: "failed",
        code,
        error,
        ...extra,
    });
    const game = frames.filter((frame) => frame.side === "game"),
        lobby = frames.filter((frame) => frame.side === "lobby");
    if (!game.length || !lobby.length)
        return fail(
            "DEPARTURE_NO_SEAM",
            "the trip back to the lobby was not recorded"
        );
    const empty = frames.find((frame) => frame.lit < MIN_LIT || !frame.box);
    if (empty)
        return fail(
            "DEPARTURE_BLACK_FRAME",
            `a black, avatar-less ${empty.side} frame at the seam (frame ${
                frames.indexOf(empty) + 1
            } of ${frames.length})`
        );
    const facts = {
        gameAvatar: game[game.length - 1].box,
        lobbyAvatar: lobby[0].box,
        lobbyFrame: "recorded",
    };
    const problems = compareAvatar(facts.gameAvatar, facts.lobbyAvatar);
    return problems.length
        ? fail("DEPARTURE_MISMATCH", problems.join("; "), facts)
        : { status: "passed", ...facts };
}

/**
 * Reads screenshots in a spare page: the share of lit pixels, the box around
 * them, and the share lit outside an expected box.
 */
export async function createFrameReader(browser) {
    const page = await browser.newPage();
    await page.setContent("<canvas></canvas>");
    return {
        read: (png, expected = null) =>
            page.evaluate(
                async ({ data, expected }) => {
                    const image = new Image();
                    image.src = `data:image/png;base64,${data}`;
                    await image.decode();
                    const w = 320,
                        h = Math.round((320 * image.height) / image.width);
                    const canvas = document.querySelector("canvas");
                    canvas.width = w;
                    canvas.height = h;
                    const context = canvas.getContext("2d", {
                        willReadFrequently: true,
                    });
                    context.drawImage(image, 0, 0, w, h);
                    const pixels = context.getImageData(0, 0, w, h).data;
                    const columns = new Array(w).fill(0),
                        rows = new Array(h).fill(0);
                    let lit = 0,
                        outside = 0;
                    // The avatar's arms and hair reach past the feet-to-head line.
                    const pad = expected ? expected.height * 0.6 : 0;
                    for (let y = 0; y < h; y++)
                        for (let x = 0; x < w; x++) {
                            const i = (y * w + x) * 4;
                            if (
                                Math.max(
                                    pixels[i],
                                    pixels[i + 1],
                                    pixels[i + 2]
                                ) <= 28
                            )
                                continue;
                            lit++;
                            columns[x]++;
                            rows[y]++;
                            if (!expected) continue;
                            const nx = (x + 0.5) / w,
                                ny = (y + 0.5) / h;
                            if (
                                Math.abs(nx - expected.x) > pad ||
                                ny < expected.top - pad / 2 ||
                                ny > expected.bottom + pad / 2
                            )
                                outside++;
                        }
                    // Two lit pixels in a row or column: a stray pixel is not an edge.
                    const edge = (counts, from, step) => {
                        for (
                            let i = from;
                            i >= 0 && i < counts.length;
                            i += step
                        )
                            if (counts[i] >= 2) return i;
                        return -1;
                    };
                    const left = edge(columns, 0, 1),
                        top = edge(rows, 0, 1);
                    const box =
                        left < 0 || top < 0
                            ? null
                            : (() => {
                                  const right = edge(columns, w - 1, -1) + 1,
                                      bottom = edge(rows, h - 1, -1) + 1;
                                  return {
                                      x: (left + right) / 2 / w,
                                      top: top / h,
                                      bottom: bottom / h,
                                      height: (bottom - top) / h,
                                      width: (right - left) / w,
                                  };
                              })();
                    return {
                        lit: lit / (w * h),
                        outside: outside / (w * h),
                        box,
                    };
                },
                { data: png.toString("base64"), expected }
            ),
        close: () => page.close(),
    };
}

const round = (value) =>
    typeof value === "number"
        ? Math.round(value * 1000) / 1000
        : Array.isArray(value)
        ? value.map(round)
        : value && typeof value === "object"
        ? Object.fromEntries(
              Object.entries(value).map(([k, v]) => [k, round(v)])
          )
        : value;

/** The game's own frame interval right now, in milliseconds. */
async function frameInterval(page) {
    const game = page.frames().find((frame) => frame !== page.mainFrame());
    if (!game) return 0;
    return game
        .evaluate(
            () =>
                new Promise((resolve) => {
                    const times = [];
                    const tick = (now) =>
                        times.push(now) < 7
                            ? requestAnimationFrame(tick)
                            : resolve((times[6] - times[0]) / 6);
                    requestAnimationFrame(tick);
                })
        )
        .catch(() => 0);
}

/**
 * Run the stage on a check page whose game has booted. The check page keeps
 * the game's messages by kind in `window.__game` (see games.mjs).
 */
export async function checkDeparture({
    page,
    browser,
    id,
    title,
    shots,
    lobbyUrl,
}) {
    const started = Date.now();
    const reader = await createFrameReader(browser);
    const viewport = page.viewportSize();
    const aspect = viewport.width / viewport.height;
    const frames = [];
    const snap = async (phase) => {
        const ms = Date.now() - started;
        const png = await page.screenshot();
        frames.push({ ms, phase, lit: (await reader.read(png)).lit });
        return png;
    };
    try {
        await snap("playing");
        const frameMs = await frameInterval(page);
        await page.evaluate((type) => {
            window.__departureAt = performance.now();
            document
                .getElementById("game")
                .contentWindow.postMessage({ type, reason: "self" }, "*");
        }, `${id}:departure`);
        const answered = () =>
            page.evaluate(() => {
                const ready = window.__game?.["departure-ready"];
                return ready
                    ? {
                          answer: ready.data,
                          ms: ready.at - window.__departureAt,
                      }
                    : null;
            });
        // Frames while the game stages its exit, then the answer. A
        // screenshot can take seconds without a GPU, so time is the page's.
        const asked = Date.now();
        let reply = await answered();
        while (!reply && Date.now() - asked < 6000) {
            await snap("leaving");
            reply = await answered();
        }
        const lastPng = await snap("last");
        await page.waitForTimeout(400);
        const heldPng = await snap("held");
        const view = readView(reply?.answer?.view);
        const projected = view && lobbyAvatarBox(view, aspect);
        const last = await reader.read(lastPng, projected);
        const held = await reader.read(heldPng, projected);
        writeFileSync(join(shots, "departure-last-game-frame.png"), lastPng);
        let verdict = judgeDeparture({
            answerMs: reply?.ms ?? null,
            answer: reply?.answer,
            frames,
            last,
            held,
            aspect,
            frameMs,
        });
        let seam = null;
        if (lobbyUrl && verdict.status === "passed") {
            // The same exit for real: lobby, game, and back.
            const { recordLobbyTrip } = await import("./departure-lobby.mjs");
            let recorded;
            try {
                const trip = await recordLobbyTrip({
                    browser,
                    lobbyUrl,
                    id,
                    title,
                    viewport,
                });
                seam = [];
                for (const frame of trip.frames)
                    seam.push({
                        side: frame.side,
                        ...(await reader.read(frame.png)),
                    });
                const lastGame = trip.frames
                    .filter((frame) => frame.side === "game")
                    .pop();
                const firstLobby = trip.frames.find(
                    (frame) => frame.side === "lobby"
                );
                if (lastGame)
                    writeFileSync(
                        join(shots, "departure-seam-last-game-frame.png"),
                        lastGame.png
                    );
                if (firstLobby)
                    writeFileSync(
                        join(shots, "departure-seam-first-lobby-frame.png"),
                        firstLobby.png
                    );
                recorded = judgeSeam(seam);
            } catch (error) {
                recorded = {
                    status: "failed",
                    code: "DEPARTURE_NO_SEAM",
                    error: `the trip through ${lobbyUrl} failed: ${String(
                        error?.message ?? error
                    )
                        .split("\n")[0]
                        .slice(0, 200)}`,
                };
            }
            verdict = { ...verdict, ...recorded, view: verdict.view };
        }
        return {
            stage: "departure",
            status: verdict.status,
            ms: Date.now() - started,
            ...(verdict.error
                ? { error: verdict.error, code: verdict.code }
                : {}),
            departure: round({
                answerMs: reply?.ms ?? null,
                frameMs,
                lobbyFrame: verdict.lobbyFrame ?? null,
                view: verdict.view ?? null,
                gameAvatar: verdict.gameAvatar ?? null,
                lobbyAvatar: verdict.lobbyAvatar ?? null,
                frames,
                ...(seam ? { seam } : {}),
            }),
        };
    } finally {
        await reader.close();
    }
}
