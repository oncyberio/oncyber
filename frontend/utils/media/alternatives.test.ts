import { loadMediaAlternatives } from "./alternatives";

afterEach(() => jest.useRealTimers());
test("a stalled primary is aborted and the working fallback gets a turn", async () => {
    jest.useFakeTimers();
    let first: AbortSignal;
    const load = jest.fn((url, signal) => {
        if (url === "slow") {
            first = signal;
            return new Promise(() => {});
        }
        return Promise.resolve("image");
    });
    const result = loadMediaAlternatives(
        ["slow", "good"],
        load,
        undefined,
        100,
        1000
    );
    const assertion = expect(result).resolves.toBe("image");
    jest.advanceTimersByTime(100);
    await assertion;
    expect(first.aborted).toBe(true);
    expect(load.mock.calls.map((call) => call[0])).toEqual(["slow", "good"]);
});
test("duplicate fallback URLs are only attempted once", async () => {
    const load = jest.fn().mockRejectedValue(new Error("gone"));
    await expect(
        loadMediaAlternatives(["", "bad", "bad"], load)
    ).rejects.toThrow("gone");
    expect(load).toHaveBeenCalledTimes(1);
});
test("leaving the gallery aborts the load and does not fetch another source", async () => {
    const parent = new AbortController();
    const load = jest.fn(() => new Promise(() => {}));
    const result = loadMediaAlternatives(["slow", "next"], load, parent.signal);
    const assertion = expect(result).rejects.toMatchObject({
        name: "AbortError",
    });
    parent.abort();
    await assertion;
    expect(load).toHaveBeenCalledTimes(1);
});
