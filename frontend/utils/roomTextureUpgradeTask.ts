export type RoomTextureUpgradeScheduler = {
    /** Queue work without competing with the arrival animation. */
    idle: (run: () => void) => () => void;
    /** Each callback must run in a separate rendering frame. */
    frame: (run: () => void) => () => void;
    stats?: RoomTextureUpgradeStats;
    observe?: (durationMs: number) => void;
};

type IdleDeadline = { didTimeout: boolean; timeRemaining: () => number };
type Cancel = () => void;
export type RoomTextureUpgradeStats = {
    slotsGranted: number;
    framesObserved: number;
    maxFrameGapMs: number;
    frameCadenceMs: number;
    idleDeferrals: number;
    busyDeferrals: number;
    inputDeferrals: number;
    hiddenDeferrals: number;
    maxGPUCallMs: number;
};
export type RoomTextureUpgradeEnvironment = {
    now: () => number;
    requestFrame: (run: (timestamp: number) => void) => Cancel;
    requestIdle: ((run: (deadline: IdleDeadline) => void) => Cancel) | null;
    delay: (run: () => void, milliseconds: number) => Cancel;
    hidden: () => boolean;
    inputPending: () => boolean;
};
export type RoomTextureUpgradeStep = () => void | Promise<void>;
type UpgradeOptions<T> = {
    load: (signal: AbortSignal) => Promise<T>;
    /** Steps may asynchronously prepare/upload many small chunks. They must use
     * the signal before installing a texture or retaining a late result. */
    apply: (value: T, signal: AbortSignal) => Iterable<RoomTextureUpgradeStep>;
    /** Release donor/unused resources; installed textures belong to the scene. */
    release: (value: T) => void;
    onError?: (error: unknown) => void;
};

const clock = () =>
    typeof performance === "undefined" ? Date.now() : performance.now();
const delay = (run: () => void, milliseconds: number) => {
    const id = setTimeout(run, milliseconds);
    return () => clearTimeout(id);
};

/** Wait for spare time after rendering, with no timeout that forces an upload
 * into a busy frame. Consistent samples learn normal cadence through 30Hz;
 * anomalous gaps still back off. Without idle callbacks, a post-frame timer
 * conservatively uses the remaining 60Hz budget. */
export function createRoomTextureUpgradeScheduler(
    overrides: Partial<RoomTextureUpgradeEnvironment> = {}
) {
    const environment: RoomTextureUpgradeEnvironment = {
        now: clock,
        requestFrame(run) {
            if (typeof requestAnimationFrame === "function") {
                const id = requestAnimationFrame(run);
                return () => cancelAnimationFrame(id);
            }
            return delay(() => run(clock()), 16);
        },
        requestIdle:
            typeof window !== "undefined" &&
            typeof window.requestIdleCallback === "function"
                ? (run) => {
                      // No timeout: room polish is allowed to wait indefinitely
                      // while the browser needs its frame budget for interaction.
                      const id = window.requestIdleCallback(run);
                      return () => window.cancelIdleCallback(id);
                  }
                : null,
        delay,
        hidden: () =>
            typeof document !== "undefined" && document.hidden === true,
        inputPending: () => {
            const scheduling =
                typeof navigator === "undefined"
                    ? undefined
                    : (navigator as any).scheduling;
            return !!scheduling?.isInputPending?.({ includeContinuous: true });
        },
        ...overrides,
    };
    const stats: RoomTextureUpgradeStats = {
        slotsGranted: 0,
        framesObserved: 0,
        maxFrameGapMs: 0,
        frameCadenceMs: 1000 / 60,
        idleDeferrals: 0,
        busyDeferrals: 0,
        inputDeferrals: 0,
        hiddenDeferrals: 0,
        maxGPUCallMs: 0,
    };
    let recentCost = 0;
    let backoffFrames = 0;
    const cadenceSamples: number[] = [];
    const sampleCadence = (gap: number) => {
        // Learn a consistently throttled/rendered cadence, not a long stall.
        // Four similar samples cover common refresh rates down through 30Hz;
        // slower or uneven frames continue to defer this optional work.
        if (gap < 4 || gap > 36) {
            cadenceSamples.length = 0;
            return;
        }
        cadenceSamples.push(gap);
        if (cadenceSamples.length > 4) cadenceSamples.shift();
        if (cadenceSamples.length < 4) return;
        const ordered = [...cadenceSamples].sort((a, b) => a - b);
        const median = (ordered[1] + ordered[2]) / 2;
        if (ordered[3] - ordered[0] <= Math.max(1.5, median * 0.08))
            stats.frameCadenceMs = median;
    };
    const queue = (run: () => void, needsFrame: boolean): Cancel => {
        let active = true;
        let cancel: Cancel = () => {};
        let previousFrame: number | undefined;
        let quietIntervals = 0;
        let cooldown = backoffFrames;
        backoffFrames = 0;
        const paused = () => {
            if (environment.hidden()) {
                stats.hiddenDeferrals++;
                return true;
            }
            if (environment.inputPending()) {
                stats.inputDeferrals++;
                return true;
            }
            return false;
        };
        const retry = () => {
            previousFrame = undefined;
            quietIntervals = 0;
            cancel = environment.delay(() => {
                if (active) begin();
            }, 100);
        };
        const ready = (deadline: IdleDeadline) => {
            if (!active) return;
            if (paused()) {
                retry();
                return;
            }
            const minimumSlack = Math.max(4, Math.min(8, recentCost * 1.5 + 1));
            if (
                deadline.didTimeout ||
                deadline.timeRemaining() < minimumSlack
            ) {
                stats.idleDeferrals++;
                previousFrame = undefined;
                quietIntervals = 0;
                nextFrame();
                return;
            }
            active = false;
            stats.slotsGranted++;
            run();
        };
        const idle = (frameTimestamp?: number) => {
            if (environment.requestIdle) {
                cancel = environment.requestIdle(ready);
            } else {
                cancel = environment.delay(() => {
                    ready({
                        didTimeout: false,
                        timeRemaining: () =>
                            Math.max(
                                0,
                                1000 / 60 - (environment.now() - frameTimestamp)
                            ),
                    });
                }, 0);
            }
        };
        const nextFrame = () => {
            cancel = environment.requestFrame((timestamp) => {
                if (!active) return;
                if (paused()) {
                    retry();
                    return;
                }
                stats.framesObserved++;
                if (previousFrame !== undefined) {
                    const gap = Math.max(0, timestamp - previousFrame);
                    stats.maxFrameGapMs = Math.max(stats.maxFrameGapMs, gap);
                    sampleCadence(gap);
                    const busyGap =
                        stats.frameCadenceMs +
                        Math.max(4, stats.frameCadenceMs * 0.15);
                    if (gap > busyGap) {
                        stats.busyDeferrals++;
                        quietIntervals = 0;
                        cooldown = Math.min(8, cooldown + 2);
                    } else if (cooldown > 0) {
                        cooldown--;
                    } else {
                        quietIntervals++;
                    }
                }
                previousFrame = timestamp;
                if (quietIntervals < 1) nextFrame();
                else idle(timestamp);
            });
        };
        const begin = () => {
            if (paused()) retry();
            else if (needsFrame || !environment.requestIdle || cooldown > 0)
                nextFrame();
            else idle();
        };
        begin();
        return () => {
            if (!active) return;
            active = false;
            cancel();
        };
    };
    return {
        idle: (run: () => void) => queue(run, false),
        frame: (run: () => void) => queue(run, true),
        stats,
        /** Call immediately after one synchronous GPU operation, not around an
         * awaited worker task: worker/network time does not consume frame time. */
        observe(durationMs: number) {
            if (!Number.isFinite(durationMs) || durationMs < 0) return;
            stats.maxGPUCallMs = Math.max(stats.maxGPUCallMs, durationMs);
            recentCost = Math.max(durationMs, recentCost * 0.8);
            if (durationMs > 3) backoffFrames = Math.max(backoffFrames, 2);
        },
    };
}

/** Share this gate between a task and each chunk inside an asynchronous upload.
 * Cancelling releases queued browser callbacks and rejects immediately. */
export function waitForRoomTextureUpgradeSlot(
    signal: AbortSignal,
    scheduler: RoomTextureUpgradeScheduler = createRoomTextureUpgradeScheduler()
): Promise<void> {
    return new Promise((resolve, reject) => {
        let complete = false;
        let cancel: Cancel = () => {};
        const cleanup = () => signal.removeEventListener("abort", abort);
        const abort = () => {
            if (complete) return;
            complete = true;
            cleanup();
            try {
                cancel();
            } finally {
                reject(
                    Object.assign(
                        new Error("Room texture upgrade cancelled."),
                        { name: "AbortError" }
                    )
                );
            }
        };
        if (signal.aborted) {
            abort();
            return;
        }
        signal.addEventListener("abort", abort, { once: true });
        try {
            cancel = scheduler.frame(() => {
                if (complete) return;
                complete = true;
                cleanup();
                resolve();
            });
        } catch (error) {
            complete = true;
            cleanup();
            reject(error);
        }
    });
}

/** Optional room polish starts only after the caller releases arrival. A failed
 * upgrade leaves the low-resolution room usable. Cancellation does not wait for
 * an unabortable decoder: its late result is still observed and released. */
export function createRoomTextureUpgradeTask<T>(
    options: UpgradeOptions<T>,
    scheduler: RoomTextureUpgradeScheduler = createRoomTextureUpgradeScheduler()
) {
    const controller = new AbortController();
    let started = false;
    let settled = false;
    let cancelScheduled: (() => void) | undefined;
    let finish: () => void;
    const progress = {
        completedSteps: 0,
        totalStepSyncMs: 0,
        maxStepSyncMs: 0,
    };
    const finished = new Promise<void>((resolve) => {
        finish = () => {
            if (settled) return;
            settled = true;
            resolve();
        };
    });
    const report = (error: unknown) => {
        try {
            options.onError?.(error);
        } catch {
            // Diagnostics must not produce an unhandled background rejection.
        }
    };
    const slot = (
        phase: "idle" | "frame",
        work: RoomTextureUpgradeStep = () => {}
    ): Promise<boolean> =>
        new Promise((resolve, reject) => {
            if (controller.signal.aborted) {
                resolve(false);
                return;
            }
            let complete = false;
            let cancel = () => {};
            const clear = () => {
                if (cancelScheduled === stop) cancelScheduled = undefined;
            };
            const stop = () => {
                if (complete) return;
                complete = true;
                clear();
                try {
                    cancel();
                } finally {
                    resolve(false);
                }
            };
            cancelScheduled = stop;
            try {
                cancel = scheduler[phase](() => {
                    if (complete) return;
                    complete = true;
                    clear();
                    if (controller.signal.aborted) {
                        resolve(false);
                        return;
                    }
                    try {
                        const startedAt = clock();
                        const pending = work();
                        const synchronousMs = Math.max(0, clock() - startedAt);
                        progress.totalStepSyncMs += synchronousMs;
                        progress.maxStepSyncMs = Math.max(
                            progress.maxStepSyncMs,
                            synchronousMs
                        );
                        // Awaiting a worker/chunk promise yields the JS thread;
                        // it never runs a second texture concurrently.
                        Promise.resolve(pending).then(
                            () => resolve(true),
                            reject
                        );
                    } catch (error) {
                        reject(error);
                    }
                });
            } catch (error) {
                complete = true;
                clear();
                reject(error);
            }
        });
    const run = async () => {
        let value: T;
        let loaded = false;
        let steps: Iterator<RoomTextureUpgradeStep> | undefined;
        try {
            if (!(await slot("idle"))) return;
            if (controller.signal.aborted) return;
            value = await options.load(controller.signal);
            loaded = true;
            if (controller.signal.aborted) return;
            steps = options.apply(value, controller.signal)[Symbol.iterator]();
            while (!controller.signal.aborted) {
                let done = false;
                const ran = await slot("frame", () => {
                    const step = steps.next();
                    done = !!step.done;
                    if (!step.done) return step.value();
                });
                if (!ran || done || controller.signal.aborted) break;
                progress.completedSteps++;
            }
        } catch (error) {
            if (!controller.signal.aborted) report(error);
        } finally {
            try {
                steps?.return?.();
            } catch (error) {
                report(error);
            }
            if (loaded) {
                try {
                    options.release(value);
                } catch (error) {
                    report(error);
                }
            }
            finish();
        }
    };
    return {
        /** Idempotent; creating a task never starts a download. */
        start() {
            if (started || controller.signal.aborted) return;
            started = true;
            void run();
        },
        dispose() {
            if (controller.signal.aborted) return;
            controller.abort();
            try {
                cancelScheduled?.();
            } catch (error) {
                report(error);
            }
            finish();
        },
        /** Settles on completion/failure or immediately on disposal. */
        finished,
        get stats() {
            return { ...progress, scheduling: scheduler.stats };
        },
    };
}
