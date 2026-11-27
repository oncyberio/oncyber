// The scene profile of `pnpm games:check` (docs/games/scene-profile.md).
//
// Before a game is published, the check says what its build costs a
// visitor: what has to arrive before the first frame, and what every frame
// draws. Each number that is over its budget becomes a warning that names
// what to change. Warnings never fail the check: they are for the maker,
// or the agent, to keep working against.
//
// The numbers are facts of the build (bytes, triangles, passes), not frame
// times: the check's browser usually has no graphics card, so its frame
// times say little about a phone. The budgets are where Oncyber's own
// field numbers change: FIELD below is 30 days of visits to worlds,
// measured in November 2026 (the queries are in the docs page).
import { SCENE_PROBE } from "./scene-probe.mjs";

export { SCENE_PROBE };

/** The connection the first frame's wait is estimated on. */
export const REFERENCE_MBIT = 9;

export const SCENE_BUDGETS = {
    /** As the loading check and the field report: first frame within 5 s. */
    firstFrameMs: 5000,
    /** Triangles a frame, every pass counted, where phones change. */
    phoneTriangles: 100_000,
    /** ... where desktops change, */
    triangles: 700_000,
    /** ... and where desktops change sharply. */
    heavyTriangles: 1_500_000,
    /** A phone's canvas is drawn at no more than this many pixels per point. */
    phonePixelRatio: 2,
};

/**
 * Share of 20-second samples under 30 frames a second, in Oncyber worlds,
 * and how visits start. See docs/games/scene-profile.md for the tables.
 */
export const FIELD = {
    phoneSlowUnder100k: 6.0,
    phoneSlowOver100k: 13.8,
    desktopSlowUnder100k: 8.6,
    desktopSlowOver700k: 15.3,
    desktopSlowOver1500k: 29.8,
    phoneSlowNoReflector: 4.5,
    phoneSlowReflector: 20.8,
    desktopSlowNoReflector: 10.3,
    desktopSlowReflector: 14.8,
    /** Of 100 visits that open a world, how many start it. */
    startedOfOpened: 33,
};

/** Fewer rendered frames than this are too few to describe a game. */
const MIN_FRAMES = 30;

const MIB = 1024 * 1024;
const mib = (bytes) =>
    bytes >= 10 * MIB
        ? `${Math.round(bytes / MIB)} MiB`
        : bytes >= MIB / 10
        ? `${(bytes / MIB).toFixed(1)} MiB`
        : `${Math.max(1, Math.round(bytes / 1024))} KiB`;
const count = (value) => Math.round(value).toLocaleString("en-US");
const seconds = (ms) =>
    ms >= 10000 ? `${Math.round(ms / 1000)} s` : `${(ms / 1000).toFixed(1)} s`;

/**
 * Keeps what the check's server sent and when, so the profile can say what
 * arrived before the first frame.
 */
export function servedLog(now = Date.now) {
    const sent = [];
    return {
        add: (path, bytes) => sent.push({ path, bytes, at: now() }),
        /** Each file once, as first sent, up to the moment `at`. */
        before(at) {
            const seen = new Map();
            for (const one of sent)
                if (one.at <= at && !seen.has(one.path))
                    seen.set(one.path, one.bytes);
            return [...seen].map(([path, bytes]) => ({ path, bytes }));
        },
    };
}

/**
 * How many times a frame draws the scene: the passes that draw at least
 * half of what the largest one does. A mirror, water or a shadow map each
 * add one; a full-screen effect (two triangles) does not.
 */
export function sceneDraws(passes) {
    const largest = Math.max(0, ...passes.map((pass) => pass.triangles));
    if (largest < 1000) return passes.length ? 1 : 0;
    return passes.filter((pass) => pass.triangles >= largest / 2).length;
}

/**
 * The profile, from what was counted.
 *
 * @param {object} input
 * @param {object | null} input.drawn       the probe's reading on the desktop visit
 * @param {object | null} [input.phone]     the probe's reading on the phone visit
 * @param {{ path: string, bytes: number }[] | null} input.before
 *                                          files sent before the first frame
 * @param {number | null} input.firstFrameMs first frame here, from the page's start
 * @param {number} [input.budgetMs]         the game's own first-frame budget
 */
export function sceneProfile({
    drawn,
    phone = null,
    before,
    firstFrameMs,
    budgetMs = SCENE_BUDGETS.firstFrameMs,
}) {
    const notes = [];
    let start = null;
    if (before && firstFrameMs != null) {
        const bytes = before.reduce((sum, file) => sum + file.bytes, 0);
        const downloadMs = Math.round(
            ((bytes * 8) / (REFERENCE_MBIT * 1e6)) * 1000
        );
        start = {
            bytes,
            files: before.length,
            largest: [...before].sort((a, b) => b.bytes - a.bytes).slice(0, 3),
            hereMs: Math.round(firstFrameMs),
            downloadMs,
            estimatedMs: Math.round(firstFrameMs) + downloadMs,
            budgetMs,
            referenceMbit: REFERENCE_MBIT,
        };
    } else notes.push("the first frame was not seen, so its wait is not estimated"); // prettier-ignore

    let frame = null;
    if (drawn?.frames) {
        frame = {
            api: drawn.apis.join(", "),
            frames: drawn.frames,
            triangles: drawn.triangles,
            calls: drawn.calls,
            passes: drawn.passes,
            sceneDraws: sceneDraws(drawn.passes),
            textures: drawn.textures,
        };
        if (drawn.frames < MIN_FRAMES)
            notes.push(
                `only ${drawn.frames} frame${
                    drawn.frames === 1 ? "" : "s"
                } drew anything, so the frame numbers say little (a graphics device lost in this browser does that: PW_CHANNEL=chrome uses a real one)`
            );
        if (drawn.unsized)
            notes.push(
                `${drawn.unsized} draw(s) could not be sized (indirect or bundled), so the triangle counts are low`
            );
    } else
        notes.push(
            "no frame was seen drawing with WebGL or WebGPU (a canvas drawn from a worker, or a 2D game), so frames are not profiled"
        );

    let phoneCanvas = null;
    if (phone?.canvas?.layoutWidth) {
        const { width, height, layoutWidth, layoutHeight } = phone.canvas;
        phoneCanvas = {
            width,
            height,
            layoutWidth,
            layoutHeight,
            devicePixelRatio: phone.pixelRatio,
            pixelRatio:
                Math.round(
                    Math.sqrt((width * height) / (layoutWidth * layoutHeight)) *
                        100
                ) / 100,
        };
    }
    const profile = { version: 1, start, frame, phoneCanvas, notes };
    return { ...profile, warnings: sceneWarnings(profile) };
}

/** What is over its budget, each with what to change. */
export function sceneWarnings({ start, frame, phoneCanvas }) {
    const warnings = [];
    const warn = (code, message) => warnings.push({ code, message });
    if (start && start.estimatedMs > start.budgetMs)
        warn(
            "SCENE_FIRST_FRAME_WAIT",
            `${mib(start.bytes)} arrive before the first frame: about ${seconds(
                start.downloadMs
            )} on a ${start.referenceMbit} Mbit/s connection, plus ${seconds(
                start.hereMs
            )} here, against a budget of ${seconds(
                start.budgetMs
            )}. The largest: ${start.largest
                .map((file) => `${file.path} (${mib(file.bytes)})`)
                .join(
                    ", "
                )}. Load after the first frame what the first frame does not show. Of 100 visits that open an Oncyber world, ${
                FIELD.startedOfOpened
            } wait long enough to start it.`
        );
    // Too few frames to hold a budget against: the note says so instead.
    if (frame && frame.frames >= MIN_FRAMES) {
        const heavy = frame.triangles.heavy;
        if (heavy > SCENE_BUDGETS.triangles)
            warn(
                "SCENE_TRIANGLES",
                `a frame draws ${count(
                    heavy
                )} triangles. Oncyber worlds over ${count(
                    heavy > SCENE_BUDGETS.heavyTriangles
                        ? SCENE_BUDGETS.heavyTriangles
                        : SCENE_BUDGETS.triangles
                )} run under 30 frames a second ${
                    heavy > SCENE_BUDGETS.heavyTriangles
                        ? FIELD.desktopSlowOver1500k
                        : FIELD.desktopSlowOver700k
                }% of the time on desktops, against ${
                    FIELD.desktopSlowUnder100k
                }% under ${count(
                    SCENE_BUDGETS.phoneTriangles
                )}, and phones fare worse. Use simpler models, or draw far things with fewer triangles.`
            );
        else if (heavy > SCENE_BUDGETS.phoneTriangles)
            warn(
                "SCENE_TRIANGLES_PHONE",
                `a frame draws ${count(
                    heavy
                )} triangles. Oncyber worlds over ${count(
                    SCENE_BUDGETS.phoneTriangles
                )} run under 30 frames a second ${
                    FIELD.phoneSlowOver100k
                }% of the time on phones, against ${
                    FIELD.phoneSlowUnder100k
                }% under it. Draw fewer on a phone: simpler models, or a shorter view.`
            );
        if (frame.sceneDraws > 1)
            warn(
                "SCENE_DRAWN_AGAIN",
                `a frame draws the scene ${
                    frame.sceneDraws
                } times (${frame.passes
                    .filter((pass) => pass.triangles >= 1000)
                    .map(
                        (pass) =>
                            `${count(pass.triangles)} triangles to ${
                                pass.screen ? "the screen" : "a texture"
                            }`
                    )
                    .join(
                        ", "
                    )}): a mirror, water or shadows draw it again. Oncyber worlds with a reflection run under 30 frames a second ${
                    FIELD.phoneSlowReflector
                }% of the time on phones, against ${
                    FIELD.phoneSlowNoReflector
                }% without (desktops: ${FIELD.desktopSlowReflector}% against ${
                    FIELD.desktopSlowNoReflector
                }%). Leave the extra pass out on a phone, or draw fewer things into it.`
            );
    }
    if (
        phoneCanvas &&
        phoneCanvas.pixelRatio > SCENE_BUDGETS.phonePixelRatio + 0.05
    )
        // prettier-ignore
        warn(
            "SCENE_PIXELS_PHONE",
            `on the phone the canvas is ${phoneCanvas.width} x ${
                phoneCanvas.height
            } for a ${phoneCanvas.layoutWidth} x ${
                phoneCanvas.layoutHeight
            } view: ${phoneCanvas.pixelRatio} pixels per point, ${(
                (phoneCanvas.pixelRatio / SCENE_BUDGETS.phonePixelRatio) **
                2
            ).toFixed(1)} times the pixels of a ratio of ${
                SCENE_BUDGETS.phonePixelRatio
            } to fill every frame. Use the graphics settings' pixelRatio from the SDK, which stops at ${
                SCENE_BUDGETS.phonePixelRatio
            }.`
        );
    return warnings;
}

/** The profile as lines for the check's output. */
export function describeScene(profile, { warnings = true } = {}) {
    const lines = [];
    const { start, frame, phoneCanvas } = profile;
    if (start)
        lines.push(
            `scene: ${mib(start.bytes)} in ${start.files} file${
                start.files === 1 ? "" : "s"
            } before the first frame · about ${seconds(
                start.estimatedMs
            )} to a first frame at ${
                start.referenceMbit
            } Mbit/s (budget ${seconds(start.budgetMs)})`
        );
    if (frame)
        lines.push(
            `scene: a frame draws ${count(
                frame.triangles.usual
            )} triangles (${count(
                frame.triangles.heavy
            )} when heavy) in ${count(
                frame.calls.usual
            )} draw calls, the scene ${frame.sceneDraws} time${
                frame.sceneDraws === 1 ? "" : "s"
            } · ${frame.textures.count} textures, about ${mib(
                frame.textures.bytes
            )} on the card` +
                (frame.textures.largest
                    ? `, the largest ${frame.textures.largest.width} x ${frame.textures.largest.height}`
                    : "") +
                ` · ${frame.api}`
        );
    if (phoneCanvas)
        lines.push(
            `scene: on the phone the canvas is ${phoneCanvas.width} x ${phoneCanvas.height}, ${phoneCanvas.pixelRatio} pixels per point`
        );
    for (const note of profile.notes) lines.push(`scene: ${note}`);
    if (warnings)
        for (const warning of profile.warnings)
            lines.push(`warning ${warning.code}: ${warning.message}`);
    if ((start || frame) && !profile.warnings.length && !profile.notes.length)
        lines.push("scene: within its budgets");
    return lines;
}

/** The probe's reading from the game's frame of a check page, or null. */
export async function readScene(page) {
    const game = page
        .frames()
        .find((frame) => frame.parentFrame() === page.mainFrame());
    if (!game) return null;
    return game
        .evaluate(() => window.__oncyberScene?.read() ?? null)
        .catch(() => null);
}
