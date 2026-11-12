import {
    createRoomTextureUpgradeTask,
    createRoomTextureUpgradeScheduler,
    waitForRoomTextureUpgradeSlot,
    type RoomTextureUpgradeScheduler,
} from "./roomTextureUpgradeTask";

const flush = async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
};
const deferred = <T>() => {
    let resolve: (value: T) => void;
    let reject: (error: Error) => void;
    const promise = new Promise<T>((yes, no) => {
        resolve = yes;
        reject = no;
    });
    return { promise, resolve, reject };
};
function scheduling() {
    const queues = {
        idle: new Map<number, () => void>(),
        frame: new Map<number, () => void>(),
    };
    let id = 0;
    const scheduler: RoomTextureUpgradeScheduler = {
        idle: (run) => queue("idle", run),
        frame: (run) => queue("frame", run),
    };
    function queue(phase: "idle" | "frame", run: () => void) {
        const current = ++id;
        queues[phase].set(current, run);
        return () => queues[phase].delete(current);
    }
    async function tick(phase: "idle" | "frame") {
        const first = queues[phase].entries().next().value;
        if (first) {
            queues[phase].delete(first[0]);
            first[1]();
        }
        await flush();
    }
    return { queues, scheduler, tick };
}
function fixture() {
    const timing = scheduling();
    const value = { donor: true };
    const steps = [jest.fn(), jest.fn(), jest.fn()];
    const options = {
        load: jest.fn(async (_signal: AbortSignal) => value),
        apply: jest.fn(() => steps),
        release: jest.fn(),
        onError: jest.fn(),
    };
    const task = createRoomTextureUpgradeTask(options, timing.scheduler);
    return { ...timing, task, options, value, steps };
}

test("downloads only after explicit start and an idle opportunity", async () => {
    const f = fixture();
    await flush();
    expect(f.options.load).not.toHaveBeenCalled();
    expect(f.queues.idle.size).toBe(0);
    f.task.start();
    f.task.start();
    expect(f.queues.idle.size).toBe(1);
    expect(f.options.load).not.toHaveBeenCalled();
    await f.tick("idle");
    expect(f.options.load).toHaveBeenCalledTimes(1);
    expect(f.steps[0]).not.toHaveBeenCalled();
    f.task.dispose();
    await flush();
});

test("uploads and swaps one texture per frame, then releases donor resources once", async () => {
    const f = fixture();
    f.task.start();
    await f.tick("idle");
    for (let i = 0; i < f.steps.length; i++) {
        await f.tick("frame");
        f.steps.forEach((step, index) =>
            expect(step).toHaveBeenCalledTimes(index <= i ? 1 : 0)
        );
    }
    await f.tick("frame");
    await f.task.finished;
    expect(f.options.release).toHaveBeenCalledTimes(1);
    expect(f.options.release).toHaveBeenCalledWith(f.value);
    expect(f.options.onError).not.toHaveBeenCalled();
    f.task.start();
    f.task.dispose();
    await flush();
    expect(f.options.load).toHaveBeenCalledTimes(1);
    expect(f.options.release).toHaveBeenCalledTimes(1);
    expect(f.queues.frame.size).toBe(0);
});

test("dispose before start or before idle prevents all work", async () => {
    const before = fixture();
    before.task.dispose();
    before.task.start();
    await before.task.finished;
    expect(before.queues.idle.size).toBe(0);
    expect(before.options.load).not.toHaveBeenCalled();
    const queued = fixture();
    queued.task.start();
    const lateCallback = queued.queues.idle.values().next().value;
    queued.task.dispose();
    await queued.task.finished;
    expect(queued.queues.idle.size).toBe(0);
    lateCallback();
    await flush();
    expect(queued.options.load).not.toHaveBeenCalled();
});

test("departure settles promptly and releases a nonabortable late decode without applying it", async () => {
    const f = fixture();
    const pending = deferred<typeof f.value>();
    f.options.load.mockImplementation(() => pending.promise);
    f.task.start();
    await f.tick("idle");
    const signal = f.options.load.mock.calls[0][0];
    f.task.dispose();
    await f.task.finished;
    expect(signal.aborted).toBe(true);
    expect(f.options.release).not.toHaveBeenCalled();
    pending.resolve(f.value);
    await flush();
    expect(f.options.apply).not.toHaveBeenCalled();
    expect(f.options.release).toHaveBeenCalledTimes(1);
    expect(f.options.release).toHaveBeenCalledWith(f.value);
    expect(f.queues.frame.size).toBe(0);
});

test("late download rejection after departure is observed silently", async () => {
    const f = fixture();
    const pending = deferred<typeof f.value>();
    f.options.load.mockImplementation(() => pending.promise);
    f.task.start();
    await f.tick("idle");
    f.task.dispose();
    pending.reject(new Error("aborted decoder"));
    await flush();
    expect(f.options.release).not.toHaveBeenCalled();
    expect(f.options.onError).not.toHaveBeenCalled();
});

test("departure between textures cancels the queued frame and closes the generator", async () => {
    const f = fixture();
    const closed = jest.fn();
    f.options.apply.mockImplementation(function* () {
        try {
            yield f.steps[0];
            yield f.steps[1];
        } finally {
            closed();
        }
    } as any);
    f.task.start();
    await f.tick("idle");
    await f.tick("frame");
    const lateCallback = f.queues.frame.values().next().value;
    f.task.dispose();
    await flush();
    lateCallback();
    await flush();
    expect(f.steps[0]).toHaveBeenCalledTimes(1);
    expect(f.steps[1]).not.toHaveBeenCalled();
    expect(f.queues.frame.size).toBe(0);
    expect(closed).toHaveBeenCalledTimes(1);
    expect(f.options.release).toHaveBeenCalledTimes(1);
});

test("download failure is nonfatal and never creates apply work", async () => {
    const f = fixture();
    const error = new Error("offline");
    f.options.load.mockRejectedValue(error);
    f.task.start();
    await f.tick("idle");
    await f.task.finished;
    expect(f.options.onError).toHaveBeenCalledWith(error);
    expect(f.options.apply).not.toHaveBeenCalled();
    expect(f.options.release).not.toHaveBeenCalled();
});

test("a failed texture upload stops subsequent work and releases the donor", async () => {
    const f = fixture();
    const error = new Error("GPU upload failed");
    f.steps[0].mockImplementation(() => {
        throw error;
    });
    f.task.start();
    await f.tick("idle");
    await f.tick("frame");
    await f.task.finished;
    expect(f.options.onError).toHaveBeenCalledWith(error);
    expect(f.steps[1]).not.toHaveBeenCalled();
    expect(f.options.release).toHaveBeenCalledTimes(1);
    expect(f.queues.frame.size).toBe(0);
});

test("failed plan construction still releases its downloaded resource", async () => {
    const f = fixture();
    f.options.apply.mockImplementation(() => {
        throw new Error("invalid plan");
    });
    f.task.start();
    await f.tick("idle");
    await f.task.finished;
    expect(f.options.release).toHaveBeenCalledTimes(1);
    expect(f.options.onError).toHaveBeenCalledTimes(1);
});

test("cleanup and diagnostic failures cannot reject the background task", async () => {
    const f = fixture();
    f.options.apply.mockReturnValue([]);
    f.options.release.mockImplementation(() => {
        throw new Error("cleanup failed");
    });
    f.options.onError.mockImplementation(() => {
        throw new Error("report failed");
    });
    f.task.start();
    await f.tick("idle");
    await f.tick("frame");
    await expect(f.task.finished).resolves.toBeUndefined();
    expect(f.options.release).toHaveBeenCalledTimes(1);
});

test("browser idle callback is cancelled without starting a download", async () => {
    const original = (globalThis as any).window;
    const idle = jest.fn(() => 7);
    const cancelIdle = jest.fn();
    (globalThis as any).window = {
        requestIdleCallback: idle,
        cancelIdleCallback: cancelIdle,
    };
    try {
        const load = jest.fn(async () => ({}));
        const task = createRoomTextureUpgradeTask({
            load,
            apply: () => [],
            release: () => {},
        });
        task.start();
        expect(idle).toHaveBeenCalledWith(expect.any(Function));
        task.dispose();
        await task.finished;
        expect(cancelIdle).toHaveBeenCalledWith(7);
        expect(load).not.toHaveBeenCalled();
    } finally {
        if (original === undefined) delete (globalThis as any).window;
        else (globalThis as any).window = original;
    }
});

test("timer fallback delays download and cancels frame work on departure", async () => {
    jest.useFakeTimers();
    try {
        const load = jest.fn(async () => ({}));
        const apply = jest.fn();
        const release = jest.fn();
        const task = createRoomTextureUpgradeTask({
            load,
            apply: () => [apply],
            release,
        });
        task.start();
        jest.advanceTimersByTime(31);
        expect(load).not.toHaveBeenCalled();
        jest.advanceTimersByTime(2);
        await flush();
        expect(load).toHaveBeenCalledTimes(1);
        expect(apply).not.toHaveBeenCalled();
        expect(jest.getTimerCount()).toBe(1);
        task.dispose();
        await flush();
        expect(jest.getTimerCount()).toBe(0);
        expect(apply).not.toHaveBeenCalled();
        expect(release).toHaveBeenCalledTimes(1);
    } finally {
        jest.useRealTimers();
    }
});

test("asynchronous texture steps finish sequentially without holding the render callback", async () => {
    const f = fixture();
    const prepared = deferred<void>();
    f.steps[0].mockImplementation(() => prepared.promise);
    f.task.start();
    await f.tick("idle");
    await f.tick("frame");
    expect(f.steps[0]).toHaveBeenCalledTimes(1);
    expect(f.steps[1]).not.toHaveBeenCalled();
    expect(f.queues.frame.size).toBe(0);
    expect(f.task.stats.completedSteps).toBe(0);
    prepared.resolve();
    await flush();
    expect(f.queues.frame.size).toBe(1);
    expect(f.task.stats.completedSteps).toBe(1);
    await f.tick("frame");
    expect(f.steps[1]).toHaveBeenCalledTimes(1);
    expect(f.task.stats.completedSteps).toBe(2);
    f.task.dispose();
    await flush();
});

test("departure during asynchronous preparation settles promptly but keeps its donor until late work settles", async () => {
    const f = fixture();
    const prepared = deferred<void>();
    f.steps[0].mockImplementation(() => prepared.promise);
    f.task.start();
    await f.tick("idle");
    await f.tick("frame");
    f.task.dispose();
    await f.task.finished;
    expect(f.options.load.mock.calls[0][0].aborted).toBe(true);
    expect(f.options.release).not.toHaveBeenCalled();
    prepared.resolve();
    await flush();
    expect(f.steps[1]).not.toHaveBeenCalled();
    expect(f.options.release).toHaveBeenCalledTimes(1);
    expect(f.queues.frame.size).toBe(0);
    expect(f.task.stats.completedSteps).toBe(0);
});

test("asynchronous upload rejection is observed and stops subsequent texture work", async () => {
    const f = fixture();
    const error = new Error("worker failed");
    f.steps[0].mockRejectedValue(error);
    f.task.start();
    await f.tick("idle");
    await f.tick("frame");
    await f.task.finished;
    expect(f.steps[1]).not.toHaveBeenCalled();
    expect(f.options.release).toHaveBeenCalledTimes(1);
    expect(f.options.onError).toHaveBeenCalledWith(error);
});

function budgetTiming(idleSupport = true) {
    let time = 0;
    let hidden = false;
    let input = false;
    let id = 0;
    const frames = new Map<number, (timestamp: number) => void>();
    const idle = new Map<
        number,
        (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void
    >();
    const timers = new Map<number, () => void>();
    const add = <T>(queue: Map<number, T>, run: T) => {
        const current = ++id;
        queue.set(current, run);
        return () => queue.delete(current);
    };
    const scheduler = createRoomTextureUpgradeScheduler({
        now: () => time,
        requestFrame: (run) => add(frames, run),
        requestIdle: idleSupport ? (run) => add(idle, run) : null,
        delay: (run) => add(timers, run),
        hidden: () => hidden,
        inputPending: () => input,
    });
    const take = <T>(queue: Map<number, T>) => {
        const next = queue.entries().next().value;
        if (!next) throw new Error("No scheduled callback");
        queue.delete(next[0]);
        return next[1] as T;
    };
    return {
        scheduler,
        frames,
        idle,
        timers,
        hide: (value: boolean) => {
            hidden = value;
        },
        input: (value: boolean) => {
            input = value;
        },
        frame: async (delta = 1000 / 60) => {
            time += delta;
            take(frames)(time);
            await flush();
        },
        spare: async (remaining = 8, didTimeout = false) => {
            take(idle)({ didTimeout, timeRemaining: () => remaining });
            await flush();
        },
        timer: async (elapsed = 0) => {
            time += elapsed;
            take(timers)();
            await flush();
        },
    };
}

test("normal 60fps rendering makes steady progress one chunk per quiet two-frame window", async () => {
    const f = budgetTiming();
    const controller = new AbortController();
    const uploaded: number[] = [];
    for (let chunk = 0; chunk < 5; chunk++) {
        const waiting = waitForRoomTextureUpgradeSlot(
            controller.signal,
            f.scheduler
        ).then(() => uploaded.push(chunk));
        await f.frame();
        expect(f.idle.size).toBe(0);
        await f.frame();
        expect(uploaded).toHaveLength(chunk);
        await f.spare(5);
        await waiting;
    }
    expect(uploaded).toEqual([0, 1, 2, 3, 4]);
    expect(f.scheduler.stats.slotsGranted).toBe(5);
    expect(f.scheduler.stats.framesObserved).toBe(10);
    expect(f.scheduler.stats.maxFrameGapMs).toBeCloseTo(1000 / 60);
    expect(f.scheduler.stats.busyDeferrals).toBe(0);
});

test("insufficient idle slack and expired deadlines never force a GPU chunk", async () => {
    const f = budgetTiming();
    const run = jest.fn();
    f.scheduler.frame(run);
    await f.frame();
    await f.frame();
    await f.spare(3);
    expect(run).not.toHaveBeenCalled();
    await f.frame();
    await f.frame();
    await f.spare(20, true);
    expect(run).not.toHaveBeenCalled();
    expect(f.scheduler.stats.idleDeferrals).toBe(2);
    await f.frame();
    await f.frame();
    await f.spare(5);
    expect(run).toHaveBeenCalledTimes(1);
});

test("a busy frame backs off for two quiet intervals before accepting idle budget", async () => {
    const f = budgetTiming();
    const run = jest.fn();
    f.scheduler.frame(run);
    await f.frame();
    await f.frame(42);
    expect(f.scheduler.stats.maxFrameGapMs).toBe(42);
    expect(f.scheduler.stats.busyDeferrals).toBe(1);
    await f.frame();
    await f.frame();
    expect(f.idle.size).toBe(0);
    expect(run).not.toHaveBeenCalled();
    await f.frame();
    await f.spare();
    expect(run).toHaveBeenCalledTimes(1);
});

test("hidden pages and pending continuous input pause work without a forced timeout", async () => {
    const f = budgetTiming();
    const run = jest.fn();
    f.hide(true);
    f.scheduler.frame(run);
    expect(f.frames.size).toBe(0);
    expect(f.scheduler.stats.hiddenDeferrals).toBe(1);
    await f.timer(5000);
    expect(run).not.toHaveBeenCalled();
    f.hide(false);
    f.input(true);
    await f.timer(100);
    expect(f.frames.size).toBe(0);
    expect(f.scheduler.stats.inputDeferrals).toBe(1);
    f.input(false);
    await f.timer(100);
    await f.frame();
    await f.frame();
    f.input(true);
    await f.spare();
    expect(run).not.toHaveBeenCalled();
    f.input(false);
    await f.timer(100);
    await f.frame();
    await f.frame();
    await f.spare();
    expect(run).toHaveBeenCalledTimes(1);
});

test("expensive observed GPU calls increase slack and cooldown requirements", async () => {
    const f = budgetTiming();
    const run = jest.fn();
    f.scheduler.observe(5);
    f.scheduler.observe(Number.NaN);
    f.scheduler.frame(run);
    for (let frame = 0; frame < 3; frame++) await f.frame();
    expect(f.idle.size).toBe(0);
    await f.frame();
    await f.spare(7);
    expect(run).not.toHaveBeenCalled();
    await f.frame();
    await f.frame();
    await f.spare(9);
    expect(run).toHaveBeenCalledTimes(1);
    expect(f.scheduler.stats.maxGPUCallMs).toBe(5);
    expect(f.scheduler.stats.idleDeferrals).toBe(1);
});

test("cancelling a chunk budget wait removes queued callbacks and its abort listener", async () => {
    const f = budgetTiming();
    const controller = new AbortController();
    const remove = jest.spyOn(controller.signal, "removeEventListener");
    const waiting = waitForRoomTextureUpgradeSlot(
        controller.signal,
        f.scheduler
    );
    await f.frame();
    await f.frame();
    const stale = f.idle.values().next().value;
    controller.abort();
    await expect(waiting).rejects.toMatchObject({ name: "AbortError" });
    expect(f.idle.size).toBe(0);
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
    stale({ didTimeout: false, timeRemaining: () => 20 });
    expect(f.scheduler.stats.slotsGranted).toBe(0);
});

test("fallback browsers use only budget remaining after the rendered frame", async () => {
    const f = budgetTiming(false);
    const run = jest.fn();
    f.scheduler.frame(run);
    await f.frame();
    await f.frame();
    await f.timer(14);
    expect(run).not.toHaveBeenCalled();
    expect(f.scheduler.stats.idleDeferrals).toBe(1);
    await f.frame();
    await f.frame();
    await f.timer(2);
    expect(run).toHaveBeenCalledTimes(1);
});

test("a stable 30Hz cadence eventually advances and keeps requiring actual idle slack", async () => {
    const f = budgetTiming();
    const run = jest.fn();
    f.scheduler.frame(run);
    for (let frames = 0; !f.idle.size && frames < 16; frames++)
        await f.frame(33.35);
    expect(f.idle.size).toBe(1);
    expect(f.scheduler.stats.frameCadenceMs).toBeCloseTo(33.35);
    expect(run).not.toHaveBeenCalled();
    await f.spare(3.9);
    expect(run).not.toHaveBeenCalled();
    await f.frame(33.3);
    await f.frame(33.4);
    await f.spare(4);
    expect(run).toHaveBeenCalledTimes(1);
    const next = jest.fn();
    f.scheduler.frame(next);
    await f.frame(33.35);
    await f.frame(33.35);
    await f.spare(5);
    expect(next).toHaveBeenCalledTimes(1);
});

test("isolated slow frames never redefine a learned 30Hz cadence", async () => {
    const f = budgetTiming();
    const first = jest.fn();
    f.scheduler.frame(first);
    for (let frames = 0; !f.idle.size && frames < 16; frames++)
        await f.frame(33.35);
    await f.spare();
    const run = jest.fn();
    f.scheduler.frame(run);
    await f.frame(33.35);
    await f.frame(51);
    expect(f.idle.size).toBe(0);
    expect(f.scheduler.stats.frameCadenceMs).toBeCloseTo(33.35);
    await f.frame(33.35);
    await f.frame(33.35);
    expect(f.idle.size).toBe(0);
    await f.frame(33.35);
    await f.spare();
    expect(run).toHaveBeenCalledTimes(1);
    expect(f.scheduler.stats.maxFrameGapMs).toBe(51);
});

test("uneven and sustained long frame gaps defer rather than being learned as safe", async () => {
    const f = budgetTiming();
    const run = jest.fn();
    const cancel = f.scheduler.frame(run);
    await f.frame();
    for (const gap of [33, 17, 34, 18, 33, 16, 55, 55, 55, 55, 55, 55])
        await f.frame(gap);
    expect(f.idle.size).toBe(0);
    expect(run).not.toHaveBeenCalled();
    expect(f.scheduler.stats.frameCadenceMs).toBeCloseTo(1000 / 60);
    expect(f.scheduler.stats.busyDeferrals).toBeGreaterThan(0);
    cancel();
    expect(f.frames.size).toBe(0);
});

test("a learned slow cadence never overrides continuous input deferral", async () => {
    const f = budgetTiming();
    f.scheduler.frame(() => {});
    for (let frames = 0; !f.idle.size && frames < 16; frames++)
        await f.frame(33.35);
    await f.spare();
    f.input(true);
    const run = jest.fn();
    const cancel = f.scheduler.frame(run);
    for (let attempt = 0; attempt < 8; attempt++) await f.timer(100);
    expect(run).not.toHaveBeenCalled();
    expect(f.frames.size).toBe(0);
    expect(f.idle.size).toBe(0);
    expect(f.scheduler.stats.inputDeferrals).toBe(9);
    cancel();
    expect(f.timers.size).toBe(0);
});
