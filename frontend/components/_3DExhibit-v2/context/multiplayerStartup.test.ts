/** @jest-environment jsdom */
import {
    prepareMultiplayerResources,
    awaitMultiplayerStep,
} from "./multiplayerStartup";

function deferred<T>() {
    let resolve: (value: T) => void;
    let reject: (error: Error) => void;
    const promise = new Promise<T>((yes, no) => {
        resolve = yes;
        reject = no;
    });
    return { promise, resolve, reject };
}
const flush = async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve();
};
afterEach(() => jest.useRealTimers());

test("all three entry resources start once and consumers reuse their results", async () => {
    const room = deferred<object>(),
        chat = deferred<object>(),
        words = deferred<string[]>();
    const load = {
        roomService: jest.fn(() => room.promise),
        chatProvider: jest.fn(() => chat.promise),
        profanity: jest.fn(() => words.promise),
    };
    const ready = prepareMultiplayerResources(load);
    await flush();
    Object.values(load).forEach((loader) =>
        expect(loader).toHaveBeenCalledTimes(1)
    );
    const roomModule = { default: "room" },
        chatModule = { default: "chat" };
    room.resolve(roomModule);
    chat.resolve(chatModule);
    words.resolve(["word"]);
    expect(await ready.roomService).toBe(roomModule);
    expect(await ready.chatProvider).toBe(chatModule);
    expect(await ready.profanity).toEqual(["word"]);
    expect(await ready.roomService).toBe(roomModule);
    expect(
        (await ready.settled).every((result) => result.status === "fulfilled")
    ).toBe(true);
    Object.values(load).forEach((loader) =>
        expect(loader).toHaveBeenCalledTimes(1)
    );
});

test("module and moderation latency overlap profile and room connection without skipping readiness", async () => {
    jest.useFakeTimers();
    const start = Date.now();
    const delay = <T>(ms: number, value: T) =>
        new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));
    const startup = prepareMultiplayerResources({
        roomService: () => delay(100, "arena"),
        chatProvider: () => delay(300, "chat"),
        profanity: () => delay(200, ["word"]),
    });
    const joined = jest.fn();
    const ready = (async () => {
        await delay(50, "profile");
        await startup.roomService;
        await delay(250, "socket");
        joined();
        await startup.profanity;
        await startup.chatProvider;
        return Date.now() - start;
    })();
    await flush();
    jest.advanceTimersByTime(50);
    await flush();
    jest.advanceTimersByTime(50);
    await flush();
    jest.advanceTimersByTime(200);
    await flush();
    expect(joined).not.toHaveBeenCalled();
    jest.advanceTimersByTime(50);
    await flush();
    expect(await ready).toBe(350);
    expect(joined).toHaveBeenCalledTimes(1);
    // Previous serial profile → arena → join → profanity → chat takes 900ms.
});

test("an early import failure remains observable without blocking an independent consumer", async () => {
    const room = deferred<object>(),
        chat = deferred<object>(),
        words = deferred<string[]>();
    const ready = prepareMultiplayerResources({
        roomService: () => room.promise,
        chatProvider: () => chat.promise,
        profanity: () => words.promise,
    });
    const drained = jest.fn();
    const settled = ready.settled.then(drained);
    const error = Error("chunk failed");
    chat.reject(error);
    room.resolve({});
    await flush();
    expect(drained).not.toHaveBeenCalled();
    await expect(ready.chatProvider).rejects.toBe(error);
    await expect(ready.roomService).resolves.toEqual({});
    words.resolve(null);
    await settled;
    expect(await ready.profanity).toBeNull();
});

test("a synchronous loader error still starts and observes the other resources", async () => {
    const error = Error("module unavailable");
    const profanity = jest.fn(async () => null);
    const ready = prepareMultiplayerResources({
        roomService: () => {
            throw error;
        },
        chatProvider: async () => ({}),
        profanity,
    });
    await ready.settled;
    await expect(ready.roomService).rejects.toBe(error);
    expect(profanity).toHaveBeenCalledTimes(1);
});

test("cancellation releases a stalled step and observes its later rejection", async () => {
    const step = deferred<string>();
    const controller = new AbortController();
    const pending = awaitMultiplayerStep(step.promise, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    step.reject(Error("late failure"));
    await flush();
});

test("an already cancelled step never exposes a late value", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
        awaitMultiplayerStep(Promise.resolve("late"), controller.signal)
    ).rejects.toMatchObject({ name: "AbortError" });
});
