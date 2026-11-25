import { applyGroundMotion, limitAirSpeed, advanceHeading, GROUND_BRAKE, LEGACY_PACE, SPACE_UNITS_PER_METRE } from "./groundMotion";

const run = (seconds, dt, impulseRate, v = { x: 0, z: 0 }, base = 100) => {
    for (let t = 0; t < seconds - 1e-9; t += dt)
        applyGroundMotion(v, { x: 0, z: -impulseRate * dt }, dt, base);
    return v;
};

test.each([1 / 30, 1 / 60, 1 / 120])(
    "eases to the legacy top speed in under a second at %f s frames",
    (dt) => {
        expect(Math.hypot(...Object.values(run(0.25, dt, 100)))).toBeLessThan(3);
        expect(-run(0.9, dt, 100).z).toBeGreaterThan(95 * LEGACY_PACE);
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

describe("lobby acceleration", () => {
    test("a start passes through the walk before reaching the space's pace", () => {
        // The lobby's walk is 3.2 m/s; a default space runs at about 9.2 units/s.
        const walk = 3.2 * SPACE_UNITS_PER_METRE;
        const early = Math.hypot(...Object.values(run(0.3, 1 / 60, 100)));
        expect(early).toBeLessThan(walk * 1.05);
        expect(-run(0.9, 1 / 60, 100).z).toBeGreaterThan(98 * LEGACY_PACE);
    });

    test("a space authored much faster still reaches its pace in under a second", () => {
        expect(-run(0.95, 1 / 60, 400, { x: 0, z: 0 }, 400).z).toBeGreaterThan(395 * LEGACY_PACE);
    });
});

describe("lobby facing", () => {
    const frames = (n, f) => {
        for (let i = 0; i < n; i++) f();
    };

    test("the body turns toward its travel, the same at every frame rate", () => {
        const at = (dt) => {
            let rotation = 0;
            frames(Math.round(0.1 / dt), () => {
                rotation = advanceHeading(rotation, { x: -5, z: 0 }, 0, dt).rotation;
            });
            return rotation;
        };
        // Travelling along -x faces +pi/2 (atan2(-vx, -vz)).
        expect(at(1 / 30)).toBeCloseTo(at(1 / 120), 2);
        expect(at(1 / 60)).toBeGreaterThan(0.6);
        expect(at(1 / 60)).toBeLessThan(Math.PI / 2);
    });

    test("travel, not keys, sets the facing; keys only steer from rest", () => {
        const moving = advanceHeading(0, { x: 0, z: -5 }, Math.PI / 2, 1 / 60);
        expect(moving.rotation).toBeCloseTo(0);
        expect(moving.turnIntent).toBeCloseTo(Math.PI / 2);
        const still = advanceHeading(0, { x: 0, z: 0 }, Math.PI / 2, 1 / 60);
        expect(still.rotation).toBeGreaterThan(0.1);
        expect(still.headingError).toBe(0);
        const idle = advanceHeading(1, { x: 0, z: 0 }, undefined, 1 / 60);
        expect(idle).toEqual({ rotation: 1, headingError: 0, turnIntent: 0 });
    });

    test("turns take the short way round", () => {
        const { rotation } = advanceHeading(3, { x: 0, z: 0 }, -3, 1 / 60);
        expect(rotation).toBeGreaterThan(3);
    });
});
