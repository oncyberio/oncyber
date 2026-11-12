import { createMediaUpgradeQueue } from "./upgrades";

test("queued nearby upgrades run before stalled-media retries, with bounded concurrency", async () => {
    jest.useFakeTimers();
    const queue = createMediaUpgradeQueue(1);
    const events: string[] = [];
    let calls = 0,
        stalled: AbortSignal;
    const slow = queue(async (signal) => {
        events.push("slow");
        if (!calls++) {
            stalled = signal;
            return new Promise(() => {});
        }
        return "recovered";
    });
    const healthy = queue(async () => {
        events.push("nearby");
        return "preview";
    });
    jest.advanceTimersByTime(8000);
    expect(await healthy).toBe("preview");
    expect(await slow).toBe("recovered");
    expect(stalled.aborted).toBe(true);
    expect(events).toEqual(["slow", "nearby", "slow"]);
    jest.useRealTimers();
});

test("leaving a space prevents queued high-resolution requests", async () => {
    const queue = createMediaUpgradeQueue(1),
        controller = new AbortController();
    controller.abort();
    const load = jest.fn();
    await expect(queue(load, controller.signal)).rejects.toThrow("disposed");
    expect(load).not.toHaveBeenCalled();
});
