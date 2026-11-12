import { prepareNativeEntry } from "./prepareNativeEntry";

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
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test("scene becomes ready while coordinate connection is still pending", async () => {
    const joined = deferred<boolean>();
    const state = jest.fn();
    const controller = new AbortController();
    const connect = jest.fn(() => joined.promise);
    const stage = jest.fn(async () => {});
    await prepareNativeEntry(connect, stage, {
        signal: controller.signal,
        onConnectionState: state,
    });
    expect(stage).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(state.mock.calls).toEqual([["connecting"]]);
    joined.resolve(true);
    await flush();
    expect(state.mock.calls).toEqual([["connecting"], ["connected"]]);
});

test("a failed coordinate connection retries without delaying or restarting the scene", async () => {
    const state = jest.fn();
    const stage = jest.fn(async () => {});
    const connect = jest
        .fn()
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValueOnce(false)
        .mockResolvedValue(true);
    await prepareNativeEntry(connect, stage, {
        signal: new AbortController().signal,
        onConnectionState: state,
    });
    await flush();
    expect(stage).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(750);
    await flush();
    expect(connect).toHaveBeenCalledTimes(2);
    jest.advanceTimersByTime(2000);
    await flush();
    expect(connect).toHaveBeenCalledTimes(3);
    expect(stage).toHaveBeenCalledTimes(1);
    expect(state).toHaveBeenLastCalledWith("connected");
});

test("exhausted retries remain a nonfatal connection state", async () => {
    const state = jest.fn();
    await expect(
        prepareNativeEntry(
            async () => false,
            async () => {},
            {
                signal: new AbortController().signal,
                onConnectionState: state,
                retryDelays: [],
            }
        )
    ).resolves.toBeUndefined();
    expect(state).toHaveBeenLastCalledWith("unavailable");
});

test("a stage failure cancels its pending connection without waiting for it", async () => {
    const joined = deferred<boolean>();
    let connectionSignal: AbortSignal;
    const error = new Error("invalid geometry");
    const state = jest.fn();
    await expect(
        prepareNativeEntry(
            (signal) => {
                connectionSignal = signal;
                return joined.promise;
            },
            async () => {
                throw error;
            },
            {
                signal: new AbortController().signal,
                onConnectionState: state,
            }
        )
    ).rejects.toBe(error);
    expect(connectionSignal.aborted).toBe(true);
    joined.resolve(true);
    await flush();
    expect(state.mock.calls).toEqual([["connecting"]]);
});

test("leaving during a pending join prevents late success notifications", async () => {
    const joined = deferred<boolean>();
    const controller = new AbortController();
    const state = jest.fn();
    let connectionSignal: AbortSignal;
    await prepareNativeEntry(
        (signal) => {
            connectionSignal = signal;
            return joined.promise;
        },
        async () => {},
        { signal: controller.signal, onConnectionState: state }
    );
    controller.abort();
    expect(connectionSignal.aborted).toBe(true);
    joined.resolve(true);
    await flush();
    expect(state.mock.calls).toEqual([["connecting"]]);
});

test("leaving clears retry timers and never starts another join", async () => {
    const controller = new AbortController();
    const connect = jest.fn(async () => false);
    await prepareNativeEntry(connect, async () => {}, {
        signal: controller.signal,
    });
    await flush();
    expect(jest.getTimerCount()).toBe(1);
    controller.abort();
    await flush();
    expect(jest.getTimerCount()).toBe(0);
    jest.advanceTimersByTime(10000);
    expect(connect).toHaveBeenCalledTimes(1);
});

test("an already cancelled entry starts neither scene nor network", async () => {
    const controller = new AbortController();
    controller.abort();
    const stage = jest.fn(async () => {});
    const connect = jest.fn(async () => true);
    await expect(
        prepareNativeEntry(connect, stage, { signal: controller.signal })
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(stage).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
});

test("departure aborts a connection even after background join succeeded", async () => {
    const controller = new AbortController();
    let connectionSignal: AbortSignal;
    await prepareNativeEntry(
        async (signal) => {
            connectionSignal = signal;
            return true;
        },
        async () => {},
        { signal: controller.signal }
    );
    await flush();
    expect(connectionSignal.aborted).toBe(false);
    controller.abort();
    expect(connectionSignal.aborted).toBe(true);
});
