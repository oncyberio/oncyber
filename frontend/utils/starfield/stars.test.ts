import {
    STAR_COUNT,
    STAR_SPEED,
    pacing,
    paintStars,
    scatter,
    starClock,
    streakAt,
} from "./stars";

const W = 1280;
const H = 720;

describe("the loading stars, by the clock", () => {
    test("a star is where the time says, however often it is asked", () => {
        // Asked 60 times a second or 7, the same star is in the same place
        // at the same moment: nothing depends on the frames before.
        for (const index of [0, 7, 133, 400]) {
            const direct = streakAt(index, 12.5, W, H);
            for (let t = 0; t < 12.5; t += 1 / 7) streakAt(index, t, W, H);
            expect(streakAt(index, 12.5, W, H)).toEqual(direct);
        }
    });

    test("a star moves outward, faster as it nears, and never jumps mid-flight", () => {
        let checked = 0;
        for (let index = 0; index < STAR_COUNT; index++) {
            let before = streakAt(index, 3, W, H);
            for (let t = 3 + 1 / 120; t < 3.4; t += 1 / 120) {
                const now = streakAt(index, t, W, H);
                if (before && now) {
                    const step = Math.hypot(
                        now.hx - before.hx,
                        now.hy - before.hy
                    );
                    const from = Math.hypot(before.hx, before.hy);
                    const to = Math.hypot(now.hx, now.hy);
                    // Either it carried on outward a little, or it began
                    // again somewhere else (a new flight).
                    if (to >= from) {
                        expect(step).toBeLessThan(120);
                        checked++;
                    }
                }
                before = now;
            }
        }
        expect(checked).toBeGreaterThan(5000);
    });

    test("most of the sky is on the view at any moment, and stays in it", () => {
        for (const seconds of [0, 1.7, 40, 3599.2]) {
            let seen = 0;
            for (let index = 0; index < STAR_COUNT; index++) {
                const star = streakAt(index, seconds, W, H);
                if (!star) continue;
                seen++;
                expect(Math.abs(star.hx)).toBeLessThanOrEqual(W / 2);
                expect(Math.abs(star.hy)).toBeLessThanOrEqual(H / 2);
                expect(star.glow).toBeGreaterThan(0);
                expect(star.glow).toBeLessThanOrEqual(1);
                expect(star.lightness).toBeGreaterThanOrEqual(0.5);
            }
            expect(seen).toBeGreaterThan(STAR_COUNT * 0.8);
        }
    });

    test("two documents asked at the same moment draw the same sky", () => {
        const at = starClock(1_795_700_000_123);
        expect(at).toBe(starClock(1_795_700_000_123));
        expect(streakAt(5, at, W, H)).toEqual(streakAt(5, at, W, H));
        // The clock wraps once a day and stays small enough to stay exact.
        expect(starClock(86_400_000 * 20_000 + 1500)).toBeCloseTo(1.5, 6);
    });

    test("scatter is steady and spread out", () => {
        expect(scatter(3, 9)).toBe(scatter(3, 9));
        const values = Array.from({ length: 2000 }, (_, i) => scatter(i, 4));
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        expect(mean).toBeGreaterThan(0.45);
        expect(mean).toBeLessThan(0.55);
        expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
        expect(Math.max(...values)).toBeLessThan(1);
    });

    test("each frame is drawn from nothing: cleared, then every star on view", () => {
        const calls: string[] = [];
        const context: any = new Proxy(
            {},
            {
                get: (_, name: string) => () => void calls.push(name),
                set: () => true,
            }
        );
        const drawn = paintStars(context, W, H, 2, 10);
        expect(calls[1]).toBe("clearRect");
        expect(calls.filter((name) => name === "stroke")).toHaveLength(
            drawn * 2
        );
        expect(drawn).toBeGreaterThan(STAR_COUNT * 0.8);
    });

    test("pacing counts frames, the longest wait and the hitches", () => {
        const paced = pacing();
        for (const now of [1000, 1016, 1033, 1150, 1166, 1230])
            paced.frame(now);
        expect(paced.read()).toEqual({ frames: 6, worstGap: 117, hitches: 2 });
        expect(STAR_SPEED).toBeGreaterThan(0);
    });
});
