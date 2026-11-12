import { createWorldRevealClock } from "./worldRevealClock";
test("late first frame and pipeline stalls cannot skip the squares", () => {
    const clock = createWorldRevealClock(1800);
    expect(clock.sample(15000)).toBe(0);
    expect(clock.sample(25000)).toBeCloseTo(50 / 1800);
    for (let frame = 1; frame <= 108; frame++) clock.sample(25000 + frame * 17);
    expect(clock.sample(28000)).toBe(1);
});
test("backgrounding preserves the visible reveal", () => {
    const clock = createWorldRevealClock(1800);
    clock.sample(0); const progress = clock.sample(16);
    expect(clock.sample(10000, false)).toBe(progress);
    expect(clock.sample(20000)).toBe(progress);
    expect(clock.sample(20016)).toBeCloseTo(32 / 1800);
});
