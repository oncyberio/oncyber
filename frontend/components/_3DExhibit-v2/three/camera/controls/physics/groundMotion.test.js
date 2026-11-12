import { applyGroundMotion, limitAirSpeed, GROUND_BRAKE, LEGACY_PACE } from "./groundMotion";

const run = (seconds, dt, impulseRate, v = { x: 0, z: 0 }, base = 100) => {
    for (let t = 0; t < seconds - 1e-9; t += dt)
        applyGroundMotion(v, { x: 0, z: -impulseRate * dt }, dt, base);
    return v;
};

test.each([1 / 30, 1 / 60, 1 / 120])(
    "eases to the legacy top speed in about half a second at %f s frames",
    (dt) => {
        expect(Math.hypot(...Object.values(run(0.25, dt, 100)))).toBeLessThan(6);
        expect(-run(0.6, dt, 100).z).toBeGreaterThan(95 * LEGACY_PACE);
        expect(-run(2, dt, 100).z).toBeCloseTo(100 * LEGACY_PACE, 1);
    }
);

test("the Shift boost reaches 1.5x without exceeding it", () => {
    const v = run(3, 1 / 60, 150);
    expect(-v.z).toBeCloseTo(150 * LEGACY_PACE, 1);
});

test("releasing input brakes quickly to an exact rest", () => {
    const v = run(2, 1 / 60, 100);
    let travelled = 0;
    for (let i = 0; i < 30; i++) {
        applyGroundMotion(v, { x: 0, z: 0 }, 1 / 60, 100);
        travelled += -v.z / 60;
    }
    expect(v.z).toBe(0);
    expect(travelled).toBeLessThan(((100 * LEGACY_PACE) / GROUND_BRAKE) * 1.05);
});

test("air control can steer but never adds speed beyond take-off or top speed", () => {
    const v = { x: 14, z: 0 };
    v.x += 3;
    limitAirSpeed(v, 14, 10);
    expect(v.x).toBeCloseTo(14);
    const slow = { x: 2, z: 0 };
    slow.x += 1;
    limitAirSpeed(slow, 2, 10);
    expect(slow.x).toBe(3);
});
