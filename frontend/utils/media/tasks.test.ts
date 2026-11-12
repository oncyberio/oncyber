import { runArtworkTasks } from "./tasks";
import { withMediaTimeout } from "./timeout";

test("a failed preprocessor does not block other artworks; concurrency is bounded", async () => {
    let active = 0,
        peak = 0;
    const loaded: number[] = [];
    const onError = jest.fn();
    await runArtworkTasks(
        [1, 2, 3, 4, 5],
        async (item) => {
            active++;
            peak = Math.max(peak, active);
            await Promise.resolve();
            active--;
            if (item === 2) throw new Error("Bad artwork metadata");
            loaded.push(item);
        },
        { concurrency: 2, onError }
    );
    expect(peak).toBe(2);
    expect(loaded).toEqual([1, 3, 4, 5]);
    expect(onError).toHaveBeenCalledTimes(1);
});

test("leaving a gallery stops queued artwork work", async () => {
    const controller = new AbortController();
    const load = jest.fn(async () => controller.abort());
    await runArtworkTasks([1, 2, 3], load, {
        signal: controller.signal,
        concurrency: 1,
        onError: jest.fn(),
    });
    expect(load).toHaveBeenCalledTimes(1);
});

test("stalled downloads time out and cancel their network work", async () => {
    jest.useFakeTimers();
    let signal: AbortSignal;
    const task = withMediaTimeout(
        (s) => {
            signal = s;
            return new Promise(() => {});
        },
        undefined,
        100
    );
    const assertion = expect(task).rejects.toThrow("timed out");
    jest.advanceTimersByTime(100);
    await assertion;
    expect(signal.aborted).toBe(true);
    jest.useRealTimers();
});

test("cancellation settles even an unresponsive decoder", async () => {
    const controller = new AbortController();
    const task = withMediaTimeout(
        () => new Promise(() => {}),
        controller.signal
    );
    controller.abort();
    await expect(task).rejects.toMatchObject({ name: "AbortError" });
});

test("all artworks get a first attempt before a failing artwork is retried", async () => {
    const visits: string[] = [];
    const onError = jest.fn();
    await runArtworkTasks(
        ["bad", "good", "also-good"],
        async (item, attempt) => {
            visits.push(`${item}:${attempt}`);
            if (item === "bad" && attempt === 0) throw new Error("stalled");
        },
        { concurrency: 1, attempts: 2, onError }
    );
    expect(visits).toEqual(["bad:0", "good:0", "also-good:0", "bad:1"]);
    expect(onError).not.toHaveBeenCalled();
});
test("permanent failures settle after the retry budget", async () => {
    const load = jest.fn().mockRejectedValue(new Error("gone"));
    const onError = jest.fn();
    await runArtworkTasks([1], load, { concurrency: 4, attempts: 2, onError });
    expect(load).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledTimes(1);
});


test("a stalled first pass frees its slot and retries after healthy previews", async () => {
    jest.useFakeTimers();
    const events = [], signals = [];
    const done = runArtworkTasks([1, 2], async (item, attempt, signal) => {
        events.push([item, attempt]);
        signals.push(signal);
        if (item === 1 && attempt === 0) return new Promise(() => {});
    }, {concurrency: 1, attempts: 2, initialTimeout: 100, retryTimeout: 500, onError: jest.fn()});
    jest.advanceTimersByTime(100);
    await done;
    expect(events).toEqual([[1, 0], [2, 0], [1, 1]]);
    expect(signals[0].aborted).toBe(true);
    jest.useRealTimers();
});
