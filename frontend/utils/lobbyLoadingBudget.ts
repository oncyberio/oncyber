/** Timing-only startup policy. Keep this module free of renderer/animation imports:
 * it also runs inside nested game frames. These values mirror the source camera's
 * 600 ms isolation, and the attack (106 frames at 30 fps), crouch-down (1 s) and
 * clap (frame 65) played at the trip's departure speed. Tests keep them equal to
 * worldTravelTiming. */
const DEPARTURE_SPEED = 1.55;
export const LOBBY_LOADING_OPENING_MS = 600;
export const LOBBY_LOADING_BLACK_MS =
    600 + ((65 / 30) * 1000) / DEPARTURE_SPEED + 700;
/** The departure has finished its attack and crouch-down (TRAVEL_DEPARTURE_MS):
 * from here only black, the crouch-idle loop and the travel circle are on
 * screen, so covered preparation runs at full speed. Between blackout and this
 * moment the attack and crouch-down still play against black. */
export const LOBBY_LOADING_SEATED_MS = Math.max(
    600 + ((106 / 30) * 1000 + 1000) / DEPARTURE_SPEED,
    LOBBY_LOADING_BLACK_MS + 150
);

export type LobbyLoadingPhase =
    | "opening"
    | "preparing"
    | "revealing"
    | "active";
export type LobbyLoadingBudget = {
    phase: LobbyLoadingPhase;
    enabled: boolean;
    budgetMs: number;
    waitUntil: number;
    /** Forced (indivisible) work, such as engine module evaluation, waits until
     * the avatar is seated: one 100 ms task would visibly stall the jump. */
    heavyWaitUntil: number;
    attempt: string | null;
    startedAt: number | null;
    elapsedMs: number | null;
    reducedMotion: boolean;
};
export type LobbyLoadingWindow = {
    frameElement: { getAttribute(name: string): string | null } | null;
    parent: LobbyLoadingWindow;
    location: { origin: string };
};
const unrestricted = (): LobbyLoadingBudget => ({
    phase: "active",
    enabled: false,
    budgetMs: Infinity,
    waitUntil: 0,
    heavyWaitUntil: 0,
    attempt: null,
    startedAt: null,
    elapsedMs: null,
    reducedMotion: false,
});
const monotonicNow = () =>
    typeof performance === "undefined" ? Date.now() : performance.now();
const epochNow = () =>
    typeof performance !== "undefined" &&
    Number.isFinite(performance.timeOrigin)
        ? performance.timeOrigin + performance.now()
        : Date.now();
const currentWindow = () =>
    typeof window === "undefined"
        ? null
        : (window as unknown as LobbyLoadingWindow);

/** Read the owning lobby iframe, including a same-origin game's nested iframe.
 * Absolute timestamps avoid comparing performance.now() from different documents.
 * Missing/invalid policy and ordinary visits preserve their existing behavior. */
export function readLobbyLoadingBudget(
    target: LobbyLoadingWindow | null = currentWindow(),
    now = epochNow()
): LobbyLoadingBudget {
    try {
        if (!target || !Number.isFinite(now)) return unrestricted();
        const origin = target.location.origin;
        for (let depth = 0; depth < 4; depth++) {
            const parent = target.parent;
            if (
                !parent ||
                parent === target ||
                parent.location.origin !== origin
            )
                return unrestricted();
            const frame = target.frameElement;
            if (!frame) return unrestricted();
            const attempt = frame.getAttribute("data-lobby-loading-attempt");
            if (attempt !== null) {
                const phase = frame.getAttribute("data-lobby-loading-phase");
                const rawStart = frame.getAttribute("data-lobby-loading-start");
                const reduced = frame.getAttribute(
                    "data-lobby-loading-reduced-motion"
                );
                if (
                    !/^[a-z0-9-]{20,80}$/i.test(attempt) ||
                    !["opening", "preparing", "revealing", "active"].includes(
                        phase
                    ) ||
                    (reduced !== null &&
                        reduced !== "true" &&
                        reduced !== "false")
                )
                    return unrestricted();
                const startedAt =
                    rawStart === null || rawStart === ""
                        ? null
                        : Number(rawStart);
                if (
                    startedAt !== null &&
                    (!Number.isFinite(startedAt) ||
                        startedAt <= 0 ||
                        startedAt > now + 1000)
                )
                    return unrestricted();
                const elapsedMs =
                    startedAt === null ? null : Math.max(0, now - startedAt);
                const reducedMotion = reduced === "true";
                const enabled = phase !== "active";
                const opening =
                    enabled &&
                    phase !== "revealing" &&
                    !reducedMotion &&
                    elapsedMs !== null &&
                    elapsedMs < LOBBY_LOADING_OPENING_MS;
                const beforeSeated =
                    enabled &&
                    phase !== "revealing" &&
                    !reducedMotion &&
                    startedAt !== null &&
                    now < startedAt + LOBBY_LOADING_SEATED_MS;
                // Full speed means no per-frame allowance; major steps that
                // ask for their own painted frame (`force`) still get one.
                const budgetMs = !enabled
                    ? Infinity
                    : reducedMotion
                    ? // Reduced motion is black from selection.
                      phase === "revealing" || startedAt === null
                        ? 4
                        : Infinity
                    : phase === "revealing"
                    ? 1.5
                    : startedAt === null
                    ? 4
                    : now < startedAt + LOBBY_LOADING_BLACK_MS
                    ? 1.5
                    : now < startedAt + LOBBY_LOADING_SEATED_MS
                    ? 4
                    : Infinity;
                return {
                    phase: phase as LobbyLoadingPhase,
                    enabled,
                    budgetMs,
                    waitUntil: opening
                        ? Math.min(
                              startedAt + LOBBY_LOADING_OPENING_MS,
                              now + LOBBY_LOADING_OPENING_MS
                          )
                        : 0,
                    heavyWaitUntil: beforeSeated
                        ? Math.min(
                              startedAt + LOBBY_LOADING_SEATED_MS,
                              now + LOBBY_LOADING_SEATED_MS
                          )
                        : 0,
                    attempt,
                    startedAt,
                    elapsedMs,
                    reducedMotion,
                };
            }
            target = parent;
        }
    } catch {
        // Access to a cross-origin or detached ancestor must never block loading.
    }
    return unrestricted();
}

type Cancel = () => void;
export type LobbyLoadingEnvironment = {
    readBudget: () => LobbyLoadingBudget;
    now: () => number;
    epochNow: () => number;
    hidden: () => boolean;
    requestFrame: (run: () => void) => Cancel;
    delay: (run: () => void, milliseconds: number) => Cancel;
};
export type LobbyLoadingWorkOptions = { signal?: AbortSignal; force?: boolean };
const aborted = () =>
    Object.assign(new Error("Lobby loading work cancelled"), {
        name: "AbortError",
    });
const delay = (run: () => void, milliseconds: number): Cancel => {
    const timer = setTimeout(run, milliseconds);
    return () => clearTimeout(timer);
};

/** A shared cooperative checkpoint, not preemption: one parse/upload can exceed
 * its allowance. Elapsed time since the last grant is a conservative slice bound,
 * never a measurement of CPU time inside an awaited download or worker job. */
export function createLobbyLoadingScheduler(
    overrides: Partial<LobbyLoadingEnvironment> = {}
) {
    const environment: LobbyLoadingEnvironment = {
        readBudget: () => readLobbyLoadingBudget(),
        now: monotonicNow,
        epochNow,
        hidden: () =>
            typeof document !== "undefined" && document.hidden === true,
        requestFrame(run) {
            if (typeof requestAnimationFrame !== "function")
                return delay(run, 16);
            const id = requestAnimationFrame(run);
            return () => cancelAnimationFrame(id);
        },
        delay,
        ...overrides,
    };
    type Waiter = {
        resolve: () => void;
        reject: (error: Error) => void;
        signal?: AbortSignal;
        abort: () => void;
        force: boolean;
        minimumFrame: number;
    };
    const waiters: Waiter[] = [];
    let sliceStart: number | undefined;
    let owner: string | null = null;
    let frame = 0;
    let lastForcedFrame = -1;
    let scheduled: Cancel | null = null;
    let accounting: Cancel | null = null;
    let generation = 0;
    let drainQueued = false;
    const requestDrain = () => {
        if (drainQueued) return;
        drainQueued = true;
        void Promise.resolve().then(() => {
            drainQueued = false;
            drain();
        });
    };
    const cancelScheduled = () => {
        generation++;
        scheduled?.();
        scheduled = null;
    };
    const policy = () => {
        const value = environment.readBudget();
        if (owner !== value.attempt) {
            owner = value.attempt;
            sliceStart = undefined;
        }
        return value;
    };
    const finish = (waiter: Waiter, error?: Error) => {
        const index = waiters.indexOf(waiter);
        if (index < 0) return;
        waiters.splice(index, 1);
        waiter.signal?.removeEventListener("abort", waiter.abort);
        if (error) waiter.reject(error);
        else waiter.resolve();
        if (!waiters.length) {
            cancelScheduled();
            if (error) {
                accounting?.();
                accounting = null;
            }
        }
    };
    const schedule = () => {
        if (scheduled || !waiters.length) return;
        const budget = policy();
        const until = waiters[0].force
            ? Math.max(budget.waitUntil, budget.heavyWaitUntil)
            : budget.waitUntil;
        const hold = Math.max(0, until - environment.epochNow());
        const token = ++generation;
        const resume = () => {
            if (token !== generation) return;
            scheduled = null;
            requestDrain();
        };
        if (budget.enabled && (hold > 0 || environment.hidden())) {
            scheduled = environment.delay(resume, hold > 0 ? hold : 100);
            return;
        }
        scheduled = environment.requestFrame(() => {
            if (token !== generation) return;
            // A task after rAF lets the browser paint before starting more work.
            scheduled = environment.delay(() => {
                if (token !== generation) return;
                scheduled = null;
                frame++;
                sliceStart = environment.now();
                requestDrain();
            }, 0);
        });
    };
    const drain = () => {
        if (!waiters.length || scheduled || accounting) return;
        const waiter = waiters[0];
        const budget = policy();
        const now = environment.now();
        if (sliceStart === undefined) sliceStart = now;
        if (
            budget.enabled &&
            (environment.hidden() ||
                budget.waitUntil > environment.epochNow() ||
                (waiter.force &&
                    budget.heavyWaitUntil > environment.epochNow()) ||
                now - sliceStart >= budget.budgetMs ||
                (waiter.force &&
                    (frame < waiter.minimumFrame || frame <= lastForcedFrame)))
        ) {
            schedule();
            return;
        }
        if (waiter.force && budget.enabled) lastForcedFrame = frame;
        finish(waiter);
        // A separate task lets all nested await continuations finish before the
        // next grant. Keep this guard even when the queue temporarily empties.
        // Forced consumers additionally require separate painted frames.
        accounting = environment.delay(() => {
            accounting = null;
            requestDrain();
        }, 0);
    };
    return {
        yieldWork({
            signal,
            force = false,
        }: LobbyLoadingWorkOptions = {}): Promise<void> {
            if (signal?.aborted) return Promise.reject(aborted());
            const budget = policy();
            if (!budget.enabled) return Promise.resolve();
            return new Promise((resolve, reject) => {
                const waiter: Waiter = {
                    resolve,
                    reject,
                    signal,
                    force,
                    minimumFrame: frame + (force ? 1 : 0),
                    abort: () => {
                        finish(waiter, aborted());
                        requestDrain();
                    },
                };
                waiters.push(waiter);
                signal?.addEventListener("abort", waiter.abort, { once: true });
                requestDrain();
            });
        },
    };
}

const scheduler = createLobbyLoadingScheduler();
export const yieldLobbyLoadingWork = (options: LobbyLoadingWorkOptions = {}) =>
    scheduler.yieldWork(options);
