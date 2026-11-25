import { DEFAULT_MAX_FPS, createFrameCap, maxFrameRate } from "./frameCap";

/** Feeds refreshes at `hz` for `ms`; returns how many were drawn. */
function run(cap: ReturnType<typeof createFrameCap>, hz: number, ms: number) {
    let drawn = 0;
    const step = 1000 / hz;
    for (let time = 0; time < ms; time += step) {
        if (cap.shouldDraw(time)) drawn++;
    }
    return drawn;
}

describe("maxFrameRate", () => {
    it("defaults to 60", () => {
        expect(maxFrameRate(undefined)).toBe(DEFAULT_MAX_FPS);
        expect(maxFrameRate("")).toBe(DEFAULT_MAX_FPS);
        expect(maxFrameRate(NaN)).toBe(DEFAULT_MAX_FPS);
        expect(maxFrameRate("fast")).toBe(DEFAULT_MAX_FPS);
        expect(maxFrameRate("-5")).toBe(DEFAULT_MAX_FPS);
    });

    it("reads a number of 0 or more", () => {
        expect(maxFrameRate("30")).toBe(30);
        expect(maxFrameRate(0)).toBe(0);
        expect(maxFrameRate(120)).toBe(120);
    });
});

describe("createFrameCap", () => {
    it("draws every other refresh on a 120 Hz display", () => {
        expect(run(createFrameCap(60), 120, 1000)).toBe(60);
    });

    it("averages 60 on a 144 Hz display", () => {
        const drawn = run(createFrameCap(60), 144, 2000);
        expect(Math.abs(drawn - 120)).toBeLessThanOrEqual(1);
    });

    it("draws every refresh on a 60 Hz display, even with jitter", () => {
        const cap = createFrameCap(60);
        let drawn = 0;
        for (let i = 0; i < 60; i++) {
            const jitter = i % 2 === 0 ? -1.5 : 1.5;
            if (cap.shouldDraw(i * (1000 / 60) + jitter)) drawn++;
        }
        expect(drawn).toBe(60);
    });

    it("draws 30 a second with a cap of 30", () => {
        expect(run(createFrameCap(30), 120, 990)).toBe(30);
        expect(run(createFrameCap(30), 60, 990)).toBe(30);
    });

    it("draws every refresh with no cap", () => {
        expect(run(createFrameCap(0), 120, 1000)).toBe(120);
    });

    it("draws the first frame after a slow one at once", () => {
        const cap = createFrameCap(60);
        expect(cap.shouldDraw(0)).toBe(true);
        expect(cap.shouldDraw(100)).toBe(true);
        expect(cap.shouldDraw(108.3)).toBe(false);
        expect(cap.shouldDraw(116.7)).toBe(true);
    });
});
