/**
 * Field health, the frame's half. The game page cannot see inside the
 * sandboxed frame, so the game reports three things to it as
 * `oncyber:game:health` messages (`<id>:health` from a build that still
 * speaks its own prefix): uncaught errors, failed lifecycle stages, and
 * frame times (median and 95th percentile of each 20 s of play). The page
 * adds the release, the device type and the time to the first frame, and
 * sends them on (docs/games/field-health.md). The time to the first frame
 * is the loading signal's (`first-frame`, loading.ts), not measured here.
 *
 * Reports carry no game content: an error is its name and message, cut to
 * 200 characters, and the file and line it came from.
 *
 *     const health = reportHealth();
 *     await health.stage("prepare", () => session.prepare());
 *     onError: (error) => health.stageFailed("update", error)
 */
import { GAME_MESSAGE_PREFIX } from "./contract.ts";

export const HEALTH_WINDOW_MS = 20000;
/** The message of the error `pnpm games:check` asks a game to throw. */
export const HEALTH_PROBE = "ONCYBER_HEALTH_PROBE";
export const HEALTH_STAGES = [
    "prepare",
    "enter",
    "update",
    "suspend",
    "restore",
    "dispose",
] as const;
export type HealthStage = (typeof HEALTH_STAGES)[number];

export type HealthReport =
    | { kind: "error"; message: string; where: string }
    | { kind: "stage"; stage: HealthStage; message: string; where: string }
    | { kind: "frames"; count: number; medianMs: number; p95Ms: number };

const MAX_MESSAGE = 200;
/** Reports of one kind a visit may send; a loop that throws every frame sends this many. */
const MAX_FAILURES = 10;
/** A window with fewer frames than this says nothing about the game. */
const MIN_FRAMES = 30;

/** `https://host/games/ace/assets/index-abc.js?x:12:3` -> `index-abc.js:12`. No hosts, paths or queries. */
function place(file: unknown, line?: unknown): string {
    if (typeof file !== "string" || !file) return "";
    const name = file.split(/[?#]/)[0].split("/").pop() ?? "";
    const safe = name.replace(/[^\w.-]/g, "").slice(0, 80);
    return safe && Number.isInteger(line) && (line as number) > 0
        ? `${safe}:${line}`
        : safe;
}

/** What an error is and where it came from, as two short strings. */
export function describeError(
    reason: unknown,
    file?: unknown,
    line?: unknown
): { message: string; where: string } {
    const error = reason as
        | { name?: unknown; message?: unknown; stack?: unknown }
        | null
        | undefined;
    const name =
        typeof error?.name === "string" && error.name !== "Error"
            ? `${error.name}: `
            : "";
    const text =
        typeof error?.message === "string"
            ? error.message
            : typeof reason === "string"
            ? reason
            : "unknown error";
    let where = place(file, line);
    if (!where && typeof error?.stack === "string") {
        // First stack frame, in Chromium's "at f (url:line:col)" or the others' "f@url:line:col".
        const frame = /(?:\(|@|at )([^\s()@]+?):(\d+):\d+\)?\s*$/m.exec(
            error.stack
        );
        if (frame) where = place(frame[1], Number(frame[2]));
    }
    return {
        message: (name + text)
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, MAX_MESSAGE),
        where,
    };
}

/** Median and 95th percentile of a set of frame gaps, in milliseconds. */
export function summarizeFrames(gaps: number[]): {
    count: number;
    medianMs: number;
    p95Ms: number;
} {
    const sorted = [...gaps].sort((a, b) => a - b);
    const at = (q: number) =>
        sorted.length
            ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]
            : 0;
    const round = (value: number) => Math.round(value * 10) / 10;
    return {
        count: sorted.length,
        medianMs: round(at(0.5)),
        p95Ms: round(at(0.95)),
    };
}

/**
 * Collects frame timestamps into fixed windows. `frame(now)` returns a
 * summary when a window closes with enough frames in it; `reset()` drops
 * the current window (the tab was hidden, so its gaps are not the game's).
 */
export function frameWindows(windowMs = HEALTH_WINDOW_MS) {
    let gaps: number[] = [],
        opened = -1,
        last = -1;
    return {
        frame(now: number) {
            if (opened < 0) {
                opened = last = now;
                return null;
            }
            gaps.push(now - last);
            last = now;
            if (now - opened < windowMs) return null;
            const summary =
                gaps.length >= MIN_FRAMES ? summarizeFrames(gaps) : null;
            gaps = [];
            opened = now;
            return summary;
        },
        reset() {
            gaps = [];
            opened = last = -1;
        },
    };
}

/** The parts of `window` the reporter uses, so tests can stand in for it. */
export interface HealthTarget {
    addEventListener(type: string, listener: (event: any) => void): void;
    removeEventListener(type: string, listener: (event: any) => void): void;
    requestAnimationFrame?(callback: (now: number) => void): number;
    cancelAnimationFrame?(id: number): void;
    setTimeout?(callback: () => void, ms: number): unknown;
    document?: {
        hidden: boolean;
        addEventListener(type: string, listener: () => void): void;
        removeEventListener(type: string, listener: () => void): void;
    };
    location?: { search: string };
    parent?: unknown;
}

/**
 * Starts reporting this frame's health to the page. Call it once, before
 * the game loads anything, so failures while loading are reported too.
 */
export function reportHealth(
    options: {
        /**
         * Only for a build that still speaks its own prefix: the game's id.
         * A contract game passes nothing and speaks `oncyber:game:`.
         */
        game?: string;
        target?: HealthTarget;
        /** Where reports go. Default: the parent page. */
        post?(message: { type: string } & HealthReport): void;
        windowMs?: number;
    } = {}
) {
    return startHealth(options);
}

function startHealth(options: {
    game?: string;
    target?: HealthTarget;
    /** Where reports go. Default: the parent page. */
    post?(message: { type: string } & HealthReport): void;
    windowMs?: number;
}) {
    const target = options.target ?? (globalThis as unknown as HealthTarget);
    const parent = target.parent as
        | { postMessage?(message: unknown, origin: string): void }
        | undefined;
    // The reports are the same for any page that embeds the game, and go to
    // the parent only; an opaque-origin frame cannot name its parent's origin.
    const post =
        options.post ??
        ((message) => {
            if (parent && parent !== target) parent.postMessage?.(message, "*");
        });
    const prefix = options.game ? `${options.game}:` : GAME_MESSAGE_PREFIX;
    const type = `${prefix}health`;
    const seen = new Set<string>();
    let failures = 0,
        disposed = false,
        frameId = 0;
    const failure = (report: HealthReport & { message: string }) => {
        const key = `${report.kind}:${"stage" in report ? report.stage : ""}:${
            report.message
        }`;
        if (disposed || seen.has(key) || failures >= MAX_FAILURES) return;
        seen.add(key);
        failures++;
        try {
            post({ type, ...report });
        } catch {
            /* Reporting never breaks the game. */
        }
    };
    const stageFailed = (stage: HealthStage, error: unknown) => {
        if (HEALTH_STAGES.includes(stage))
            failure({ kind: "stage", stage, ...describeError(error) });
    };
    const onError = (event: any) => {
        const error = event?.error ?? event?.message;
        failure({
            kind: "error",
            ...describeError(error, event?.filename, event?.lineno),
        });
        // The check's own error is expected: keep it out of the console.
        if (error?.message === HEALTH_PROBE) event.preventDefault?.();
    };
    const onRejection = (event: any) =>
        failure({ kind: "error", ...describeError(event?.reason) });
    // `pnpm games:check` asks for an uncaught error after the game is ready,
    // to see it arrive at the page. Only a page opened with ?check can ask.
    const checking = /[?&]check\b/.test(target.location?.search ?? "");
    const onMessage = (event: any) => {
        if (
            checking &&
            event?.source === target.parent &&
            // The check asks in the form the game greeted in; the
            // contract's form is always understood.
            (event?.data?.type === `${prefix}health-probe` ||
                event?.data?.type === `${GAME_MESSAGE_PREFIX}health-probe`)
        )
            (target.setTimeout ?? setTimeout)(() => {
                throw new Error(HEALTH_PROBE);
            }, 0);
    };
    const windows = frameWindows(options.windowMs);
    const onFrame = (now: number) => {
        if (disposed) return;
        const summary = target.document?.hidden ? null : windows.frame(now);
        if (summary)
            try {
                post({ type, kind: "frames", ...summary });
            } catch {
                /* as above */
            }
        frameId = target.requestAnimationFrame!(onFrame);
    };
    const onVisibility = () => windows.reset();
    target.addEventListener("error", onError);
    target.addEventListener("unhandledrejection", onRejection);
    target.addEventListener("message", onMessage);
    target.document?.addEventListener("visibilitychange", onVisibility);
    if (target.requestAnimationFrame)
        frameId = target.requestAnimationFrame(onFrame);
    return {
        /** Reports a lifecycle stage that threw or rejected. */
        stageFailed,
        /** Runs one lifecycle stage; a failure is reported and thrown again. */
        async stage<T>(
            stage: HealthStage,
            run: () => Promise<T> | T
        ): Promise<T> {
            try {
                return await run();
            } catch (error) {
                stageFailed(stage, error);
                throw error;
            }
        },
        dispose() {
            disposed = true;
            target.cancelAnimationFrame?.(frameId);
            target.removeEventListener("error", onError);
            target.removeEventListener("unhandledrejection", onRejection);
            target.removeEventListener("message", onMessage);
            target.document?.removeEventListener(
                "visibilitychange",
                onVisibility
            );
        },
    };
}
