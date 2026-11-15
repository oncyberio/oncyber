/**
 * Pausing, for the game side of the page bridge. Three things can pause a
 * game, and they all end here, in one place: the tab is hidden, the page
 * opened a menu over it, or the page paused the game's input because the
 * visitor types in it (keys.ts; a game chooses whether that holds its
 * clock, see `PauseReason`). What happens next depends on who else is
 * playing:
 *
 *   solo         the game pauses: its clock stops (suspend) and starts again
 *                where it was (restore) once every reason is gone.
 *   multiplayer  the match does not pause. Under a page menu it keeps
 *                running; in a hidden tab, where the browser stops animation
 *                frames, it keeps simulating about once a second and catches
 *                up on the rest when the tab comes back. The other players
 *                are told this one stepped away (`away`, docs/games/party.md).
 *
 * The core is pure (no DOM, no timers of its own); `bindPausing` connects it
 * to a document and the page's `pause` / `resume` messages, and
 * `sessionPausing` ties it to a RuntimeSession's suspend() and restore().
 * See docs/games/loading-and-pausing.md.
 */
import { GAME_MESSAGE_PREFIX } from "./contract.ts";
import type { Json, RuntimeSession } from "./index.ts";
import { expose } from "./loading.ts";

/**
 * `hidden` and `menu` come from `bindPausing`. `input` is the page's input
 * pause (the visitor types in the page's chat): input stops for every game
 * (keys.ts); a game whose solo play should also stand still holds it from
 * its key binder (`bindSessionKeys`'s `paused` and `resumed`), as Ace does.
 */
export type PauseReason = "hidden" | "menu" | "input";
export type PauseMode = "solo" | "multiplayer";
export const PAUSE_REASONS: readonly PauseReason[] = [
    "hidden",
    "menu",
    "input",
];

export interface PausingOptions {
    /** Read each time a reason arrives, so a game can be solo until a match starts. */
    mode: PauseMode | (() => PauseMode);
    /** Solo: stop the clock. Called once, by the first reason. */
    pause(reason: PauseReason): void;
    /** Solo: start the clock again. Called once, when the last reason is gone. */
    resume(info: { reason: PauseReason; awayMs: number }): void;
    /** Multiplayer: simulate `seconds` the browser did not give the game frames for. */
    catchUp?(seconds: number): void;
    /**
     * Multiplayer: the tab was hidden (true) or shown again (false) while
     * the match goes on. Tell the other players (docs/games/party.md).
     */
    away?(away: boolean): void;
    /** Plain facts that stand still while a solo game is paused and move while it plays. */
    fingerprint?(): Json;
    now?: () => number;
    /** Repeats `tick` while a multiplayer match is hidden; returns its cancel. */
    every?(tick: () => void, ms: number): () => void;
}
export interface PausingReport {
    mode: PauseMode;
    paused: boolean;
    reasons: PauseReason[];
    pauses: number;
    resumes: number;
    /** Seconds handed to `catchUp` so far. */
    caughtUp: number;
    fingerprint: Json;
}
export interface Pausing {
    readonly paused: boolean;
    hold(reason: PauseReason): void;
    release(reason: PauseReason): void;
    report(): PausingReport;
    dispose(): void;
}

export function createPausing(options: PausingOptions): Pausing {
    const now =
        options.now ?? (() => globalThis.performance?.now?.() ?? Date.now());
    const mode = () =>
        typeof options.mode === "function" ? options.mode() : options.mode;
    const reasons = new Set<PauseReason>();
    let paused = false,
        pausedAt = 0,
        pauses = 0,
        resumes = 0,
        caughtUp = 0;
    // A hidden multiplayer match: when it was last simulated, and its timer.
    let simulatedAt: number | null = null,
        stopTimer: (() => void) | null = null,
        away = false;
    const catchUp = () => {
        if (simulatedAt === null) return;
        const at = now(),
            seconds = Math.max(0, (at - simulatedAt) / 1000);
        simulatedAt = at;
        if (seconds > 0) {
            caughtUp += seconds;
            options.catchUp?.(seconds);
        }
    };
    const stopCatchUp = () => {
        stopTimer?.();
        stopTimer = null;
        simulatedAt = null;
    };
    const pausing: Pausing = {
        get paused() {
            return paused;
        },
        hold(reason) {
            if (!PAUSE_REASONS.includes(reason) || reasons.has(reason)) return;
            reasons.add(reason);
            if (paused) return;
            if (mode() === "solo") {
                stopCatchUp();
                paused = true;
                pausedAt = now();
                pauses++;
                options.pause(reason);
            } else if (reason === "hidden" && simulatedAt === null) {
                simulatedAt = now();
                stopTimer = options.every?.(catchUp, 1000) ?? null;
                away = true;
                options.away?.(true);
            }
        },
        release(reason) {
            if (!reasons.delete(reason)) return;
            if (reason === "hidden") {
                catchUp();
                stopCatchUp();
                if (away) {
                    away = false;
                    options.away?.(false);
                }
            }
            if (!paused || reasons.size) return;
            paused = false;
            resumes++;
            options.resume({ reason, awayMs: Math.max(0, now() - pausedAt) });
        },
        report: () => ({
            mode: mode(),
            paused,
            reasons: [...reasons],
            pauses,
            resumes,
            caughtUp: Math.round(caughtUp * 1000) / 1000,
            fingerprint: options.fingerprint?.() ?? null,
        }),
        dispose() {
            stopCatchUp();
            reasons.clear();
            paused = false;
        },
    };
    expose("pausing", pausing.report);
    return pausing;
}

/**
 * Runs the time a game missed in fixed steps, at most `maxSeconds` of it:
 * past that, a match takes its state from the other players instead of
 * replaying it. Returns the seconds simulated.
 */
export function simulateMissed(
    seconds: number,
    tick: (seconds: number) => void,
    step = 0.1,
    maxSeconds = 10
): number {
    if (!Number.isFinite(seconds) || seconds <= 0 || !(step > 0)) return 0;
    const total = Math.min(seconds, maxSeconds);
    const steps = Math.ceil(total / step - 1e-9);
    for (let i = 0; i < steps; i++)
        tick(i < steps - 1 ? step : total - step * (steps - 1));
    return total;
}

/** Connects a Pausing to the tab's visibility and the page's menu messages. */
export function bindPausing(
    pausing: Pausing,
    options: {
        /**
         * An older build's own prefix, with its colon: "garden:". The one
         * contract's prefix is always understood; a contract game passes none.
         */
        prefix?: string;
        document: {
            hidden: boolean;
            addEventListener(type: string, listener: () => void): void;
            removeEventListener(type: string, listener: () => void): void;
        };
        window: {
            parent: unknown;
            addEventListener(
                type: string,
                listener: (event: any) => void
            ): void;
            removeEventListener(
                type: string,
                listener: (event: any) => void
            ): void;
        };
    }
): () => void {
    const { document, window } = options;
    const prefixes = [GAME_MESSAGE_PREFIX, options.prefix].filter(Boolean);
    const visibility = () =>
        document.hidden ? pausing.hold("hidden") : pausing.release("hidden");
    const message = (event: { source: unknown; data: any }) => {
        if (event.source !== window.parent) return;
        const type = event.data?.type;
        // The tab's visibility is the browser's to report; the page reports menus.
        if (event.data?.reason !== "menu") return;
        if (prefixes.some((prefix) => type === `${prefix}pause`))
            pausing.hold("menu");
        else if (prefixes.some((prefix) => type === `${prefix}resume`))
            pausing.release("menu");
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("message", message);
    visibility();
    return () => {
        document.removeEventListener("visibilitychange", visibility);
        window.removeEventListener("message", message);
        pausing.dispose();
    };
}

/**
 * Pausing for a game on the lifecycle: solo pauses are suspend() and
 * restore(); a multiplayer match is ticked through the time it missed.
 * Create the browser session with `visibility: false` so this is the only
 * thing that suspends it.
 */
export function sessionPausing(
    session: RuntimeSession,
    options: {
        mode: PauseMode | (() => PauseMode);
        onError?(error: unknown): void;
        /** Called around a pause so the host can reset its frame clock. */
        onChange?(paused: boolean): void;
        away?: PausingOptions["away"];
        every?: PausingOptions["every"];
        now?: () => number;
    }
): Pausing {
    // suspend() and restore() are asynchronous; keep them in order.
    let queue = Promise.resolve();
    const run = (operation: () => Promise<void>) => {
        queue = queue
            .then(operation)
            .catch((error) => options.onError?.(error));
    };
    let inspect: Json = null;
    return createPausing({
        mode: options.mode,
        now: options.now,
        away: options.away,
        every:
            options.every ??
            ((tick, ms) => {
                const timer = setInterval(tick, ms);
                return () => clearInterval(timer);
            }),
        pause: () =>
            run(async () => {
                if (session.phase === "entered") await session.suspend();
                options.onChange?.(true);
            }),
        resume: () =>
            run(async () => {
                if (session.phase === "suspended") await session.restore();
                options.onChange?.(false);
            }),
        catchUp: (seconds) => {
            try {
                simulateMissed(seconds, (step) => session.tick(step));
            } catch (error) {
                options.onError?.(error);
            }
        },
        // Frames stop while suspended; the game's own facts must not move either.
        fingerprint: () => {
            try {
                inspect = session.inspect();
            } catch {
                /* disposed: keep the last one */
            }
            return { frames: session.frames, inspect };
        },
    });
}
