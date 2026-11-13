import {
    DEFAULT_MAX_FPS,
    createFrameCap,
    maxFrameRate,
    maxFrameRateFromSearch,
} from "./frameCap";

const drawnPerSecond = (refreshHz: number, maxFps: number) => {
    const cap = createFrameCap(maxFps);
    let drawn = 0;
    for (let i = 0; i < refreshHz; i++) {
        // a little jitter, as real refresh timestamps have
        const jitter = (i % 3) * 0.3 - 0.3;
        if (cap.shouldDraw(1000 + (i * 1000) / refreshHz + jitter)) drawn++;
    }
    return drawn;
};

test("a 120 Hz display draws 60 frames a second", () => {
    expect(drawnPerSecond(120, 60)).toBe(60);
});

test("a 60 Hz display still draws every refresh", () => {
    expect(drawnPerSecond(60, 60)).toBe(60);
});

test("a 144 Hz display stays near the cap", () => {
    const drawn = drawnPerSecond(144, 60);
    expect(drawn).toBeGreaterThanOrEqual(60);
    expect(drawn).toBeLessThanOrEqual(72);
});

test("0 draws every refresh", () => {
    expect(drawnPerSecond(120, 0)).toBe(120);
});

test("?fps= parsing", () => {
    expect(maxFrameRate(undefined)).toBe(DEFAULT_MAX_FPS);
    expect(maxFrameRate(NaN)).toBe(DEFAULT_MAX_FPS);
    expect(maxFrameRate("abc")).toBe(DEFAULT_MAX_FPS);
    expect(maxFrameRate("120")).toBe(120);
    expect(maxFrameRate(0)).toBe(0);
    expect(maxFrameRateFromSearch("?fps=30")).toBe(30);
    expect(maxFrameRateFromSearch("?lobby=1")).toBe(DEFAULT_MAX_FPS);
});
