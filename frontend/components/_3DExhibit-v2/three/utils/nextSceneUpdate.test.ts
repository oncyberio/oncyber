import { waitForNextSceneUpdate } from "./nextSceneUpdate";

function fixture() {
    const listeners = new Set<() => void>();
    const emitter = {
        on: jest.fn((_event: string, callback: () => void) =>
            listeners.add(callback)
        ),
        off: jest.fn((_event: string, callback: () => void) =>
            listeners.delete(callback)
        ),
    };
    const signal = new AbortController();
    const frame = () => [...listeners].forEach((callback) => callback());
    return { emitter, signal, frame, listeners };
}
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test("resolves after a rendered update and the event queue, removing its listener", async () => {
    const f = fixture();
    const done = jest.fn();
    const pending = waitForNextSceneUpdate(
        f.emitter,
        "post-update",
        f.signal.signal
    );
    pending.then(done);
    expect(f.listeners.size).toBe(1);
    f.frame();
    expect(f.listeners.size).toBe(0);
    await Promise.resolve();
    expect(done).not.toHaveBeenCalled();
    jest.runOnlyPendingTimers();
    await pending;
    expect(done).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
    f.signal.abort();
    f.frame();
    expect(done).toHaveBeenCalledTimes(1);
});

test("cancelling a paused scene rejects without requiring another rendered frame", async () => {
    const f = fixture();
    const pending = waitForNextSceneUpdate(
        f.emitter,
        "post-update",
        f.signal.signal
    );
    const rejected = expect(pending).rejects.toMatchObject({
        name: "AbortError",
    });
    f.signal.abort();
    await rejected;
    expect(f.listeners.size).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
    f.frame();
    expect(jest.getTimerCount()).toBe(0);
});

test("cancelling between the frame and queued completion clears the timer", async () => {
    const f = fixture();
    const pending = waitForNextSceneUpdate(
        f.emitter,
        "post-update",
        f.signal.signal
    );
    const rejected = expect(pending).rejects.toMatchObject({
        name: "AbortError",
    });
    f.frame();
    expect(jest.getTimerCount()).toBe(1);
    f.signal.abort();
    await rejected;
    expect(f.listeners.size).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
});

test("already-cancelled waits do not subscribe, and ordinary callers can omit the signal", async () => {
    const f = fixture();
    f.signal.abort();
    await expect(
        waitForNextSceneUpdate(f.emitter, "post-update", f.signal.signal)
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(f.emitter.on).not.toHaveBeenCalled();
    const pending = waitForNextSceneUpdate(f.emitter, "post-update");
    f.frame();
    jest.runOnlyPendingTimers();
    await pending;
    expect(f.listeners.size).toBe(0);
});
