import { finishInSlices, finishNow, type SlicedWork } from "./slicedWork";

function* steps(limit: number, cost: number, clock: { t: number }) {
    for (let i = 0; i < limit; i++) {
        clock.t += cost;
        yield;
    }
    return limit;
}

it("finishes synchronously without pausing", () => {
    const clock = { t: 0 };
    expect(finishNow(steps(5, 1, clock) as SlicedWork<number>)).toBe(5);
    expect(clock.t).toBe(5);
});

it("pauses once a slice uses its allowance", async () => {
    const clock = { t: 0 };
    const pause = jest.fn(async () => {});
    await expect(
        finishInSlices(steps(8, 3, clock), pause, () => clock.t)
    ).resolves.toBe(8);
    // Every 3 ms checkpoint yields to the visible animation.
    expect(pause).toHaveBeenCalledTimes(8);
});

it("never grows loading slices when rendering is slow", async () => {
    const clock = { t: 0 };
    const slices: number[] = [];
    let sliceStart = 0;
    // Each pause resumes on the next 40 ms frame boundary (a 25 Hz display).
    const pause = jest.fn(async () => {
        slices.push(clock.t - sliceStart);
        clock.t = Math.ceil((clock.t + 1) / 40) * 40;
        sliceStart = clock.t;
    });
    await finishInSlices(steps(200, 1, clock), pause, () => clock.t);
    expect(slices[0]).toBe(3);
    expect(Math.max(...slices)).toBe(3);
    expect(slices.slice(2).every((ms) => ms === 3)).toBe(true);
});
