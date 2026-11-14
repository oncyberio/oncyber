/**
 * Field health for games: what breaks, and how fast games run, on real
 * visits. The page collects, per game and release:
 *
 *   - `first-frame`   milliseconds from mounting the frame to the game's `ready`
 *   - `frames`        median and p95 frame time of each 20 s of play
 *   - `error`         an uncaught error in the frame
 *   - `stage-failed`  a lifecycle stage that threw (prepare, enter, update, ...)
 *   - `load-failed`   the game said `error` before `ready`, or never got there
 *
 * each with the device type. The frame reports errors, stages and frame
 * times (`games/runtime/src/health.ts`); everything from the frame is
 * checked and cut to size here, because the game is outside code.
 *
 * Events go out as the PostHog event `game health`, through the same path
 * as load timings, and only when an analytics key is configured. They hold
 * no account data and no game content: see docs/games/field-health.md.
 */
import { useEffect, type RefObject } from "react";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { fetchGameRelease } from "./gamePause";

export type GameDevice = "phone" | "tablet" | "headset" | "desktop";

export type GameHealthEvent = {
    game: string;
    release: string;
    device: GameDevice;
} & (
    | { kind: "first-frame"; ms: number }
    | { kind: "frames"; medianMs: number; p95Ms: number; frames: number }
    | {
          kind: "error";
          message: string;
          where: string;
          /** Whether the game had drawn its first frame. */
          afterReady: boolean;
      }
    | { kind: "stage-failed"; stage: string; message: string; where: string }
    | { kind: "load-failed"; reason: "error" | "timeout" }
);

/** Share of visits whose frame times are sent. Failures are always sent. */
export const FRAME_SAMPLE_RATE = 0.2;
/** The frame's window: frame times before this long after `ready` include loading. */
const FRAME_WINDOW_MS = 20000;
/** At most this many frame windows (ten minutes) and failures per visit. */
const MAX_FRAME_EVENTS = 30;
const MAX_FAILURE_EVENTS = 10;
/** The page gives a game this long to draw its first frame. */
export const LOAD_TIMEOUT_MS = 120000;
const STAGES = ["prepare", "enter", "update", "suspend", "restore", "dispose"];

const text = (value: unknown, max: number) =>
    typeof value === "string"
        ? value
              .replace(/[\u0000-\u001f]+/g, " ")
              .trim()
              .slice(0, max)
        : "";
const ms = (value: unknown, max: number) =>
    typeof value === "number" && Number.isFinite(value) && value >= 0
        ? Math.min(max, Math.round(value * 10) / 10)
        : null;

export function gameDevice(
    nav:
        | { userAgent?: string; maxTouchPoints?: number }
        | undefined = typeof navigator !== "undefined" ? navigator : undefined
): GameDevice {
    const agent = nav?.userAgent ?? "";
    if (/OculusBrowser|Quest|Pico|VisionOS|XR\b/i.test(agent)) return "headset";
    if (/iPad|Tablet|PlayBook|Silk/i.test(agent)) return "tablet";
    if (/Android/i.test(agent))
        return /Mobile/i.test(agent) ? "phone" : "tablet";
    if (/iPhone|iPod|Mobile/i.test(agent)) return "phone";
    // An iPad asks for the desktop site by default: a Mac with a touch screen.
    if (/Macintosh/i.test(agent) && (nav?.maxTouchPoints ?? 0) > 1)
        return "tablet";
    return "desktop";
}

/**
 * One visit's health. Events wait until the release id is known
 * (`setRelease`), so every event names the release it happened in.
 */
export function createGameHealth({
    game,
    device = gameDevice(),
    send,
    now = () => performance.now(),
    random = Math.random,
    frameSampleRate = FRAME_SAMPLE_RATE,
}: {
    game: string;
    device?: GameDevice;
    send: (event: GameHealthEvent) => void;
    now?: () => number;
    random?: () => number;
    frameSampleRate?: number;
}) {
    const started = now();
    // Decided once, so a visit's frame times are all there or all absent.
    const sampled = random() < frameSampleRate;
    let release: string | null = null;
    let waiting: Array<Record<string, unknown>> = [];
    let readyAt: number | null = null;
    let finished = false;
    let frameEvents = 0;
    let failureEvents = 0;
    const seen = new Set<string>();

    const emit = (fields: Record<string, unknown>) => {
        if (finished) return;
        if (release === null) {
            if (waiting.length < 64) waiting.push(fields);
            return;
        }
        try {
            send({ game, release, device, ...fields } as GameHealthEvent);
        } catch {
            // Analytics must never break a game.
        }
    };
    const failure = (key: string, fields: Record<string, unknown>) => {
        if (seen.has(key) || failureEvents >= MAX_FAILURE_EVENTS) return;
        seen.add(key);
        failureEvents++;
        emit(fields);
    };

    return {
        /** The release id from release.json; "unknown" when it can't be read. */
        setRelease(id: string | null) {
            if (release !== null) return;
            release = id || "unknown";
            const queued = waiting;
            waiting = [];
            queued.forEach(emit);
        },
        /** The game said `ready`: its first frame is on screen. */
        ready() {
            if (readyAt !== null) return;
            readyAt = now();
            emit({ kind: "first-frame", ms: Math.round(readyAt - started) });
        },
        /** The game said `error` before `ready`, or the page gave up waiting. */
        loadFailed(reason: "error" | "timeout") {
            if (readyAt === null)
                failure("load-failed", { kind: "load-failed", reason });
        },
        /** One `<id>:health` message from the frame. Anything malformed is dropped. */
        report(data: any) {
            const message = text(data?.message, 200);
            const where = text(data?.where, 100);
            if (data?.kind === "error" && message) {
                failure(`error:${message}`, {
                    kind: "error",
                    message,
                    where,
                    afterReady: readyAt !== null,
                });
            } else if (
                data?.kind === "stage" &&
                STAGES.includes(data.stage) &&
                message
            ) {
                failure(`stage:${data.stage}:${message}`, {
                    kind: "stage-failed",
                    stage: data.stage,
                    message,
                    where,
                });
            } else if (data?.kind === "frames") {
                const medianMs = ms(data.medianMs, 10000);
                const p95Ms = ms(data.p95Ms, 10000);
                const frames = ms(data.count, 100000);
                if (
                    !sampled ||
                    medianMs === null ||
                    p95Ms === null ||
                    !frames ||
                    p95Ms < medianMs ||
                    // A window that started while the game was loading.
                    readyAt === null ||
                    now() - readyAt < FRAME_WINDOW_MS ||
                    frameEvents >= MAX_FRAME_EVENTS
                )
                    return;
                frameEvents++;
                emit({ kind: "frames", medianMs, p95Ms, frames });
            }
        },
        dispose() {
            finished = true;
            waiting = [];
        },
    };
}

/**
 * Sends one event the way the rest of the app sends analytics. Nothing
 * leaves the browser when no analytics key is configured. On the
 * development server, where analytics only logs, events go to this
 * machine's /dev/games instead.
 */
export function sendGameHealth(event: GameHealthEvent) {
    if (process.env.NODE_ENV === "development") {
        void fetch("/api/dev/game-health", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(event),
            keepalive: true,
        }).catch(() => {});
        return;
    }
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    void amplitude_logAnalyticsEvent("game_health", event).catch(() => {});
}

/**
 * Collects the health of the game in `frame` for as long as the page
 * shows it. `GamePage` calls this once; it only listens.
 */
export function useGameHealth(
    game: string,
    frame: RefObject<HTMLIFrameElement>
) {
    useEffect(() => {
        const health = createGameHealth({
            game,
            send: sendGameHealth,
            // Every development visit, like load timings.
            ...(process.env.NODE_ENV === "development" && {
                frameSampleRate: 1,
            }),
        });
        let current = true;
        void fetchGameRelease(game).then(
            (release) => current && health.setRelease(release)
        );
        const timeout = setTimeout(
            () => health.loadFailed("timeout"),
            LOAD_TIMEOUT_MS
        );
        const receive = (event: MessageEvent) => {
            // Same test as the page bridge: this frame, and its opaque origin.
            if (
                event.source !== frame.current?.contentWindow ||
                event.origin !== "null"
            )
                return;
            const type = event.data?.type;
            if (type === `${game}:ready`) health.ready();
            else if (type === `${game}:error`) health.loadFailed("error");
            else if (type === `${game}:health`) health.report(event.data);
        };
        window.addEventListener("message", receive);
        return () => {
            current = false;
            clearTimeout(timeout);
            window.removeEventListener("message", receive);
            health.dispose();
        };
    }, [game]);
}
