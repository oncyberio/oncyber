import {
    benchmarkBudget,
    benchmarkCount,
    benchmarkParticipants,
    benchmarkMotionPose,
} from "./crowdBenchmark";

test("fixture counts have a deterministic 10k ceiling while retaining zero and sensible defaults", () => {
    expect([undefined, "bad", "", "Infinity"].map(benchmarkCount)).toEqual([
        64, 64, 64, 64,
    ]);
    expect(["0", "-2", "256.9", "10000", "20000"].map(benchmarkCount)).toEqual([
        0, 0, 256, 10000, 10000,
    ]);
    expect(
        [undefined, "128", "256", "unbounded", "100000"].map(benchmarkBudget)
    ).toEqual(["256", "128", "256", "unbounded", "256"]);
});

test("the full 10k fixture remains local, deterministic, and spaced through visible-depth fan rows", () => {
    const visitors = benchmarkParticipants(
        10000,
        "/native.glb",
        "/portrait.png",
        0
    );
    expect(visitors).toHaveLength(10000);
    expect(new Set(visitors.map((visitor) => visitor.id)).size).toBe(10000);
    expect(
        new Set(visitors.map((visitor) => `${visitor.x}:${visitor.z}`)).size
    ).toBe(10000);
    expect(
        visitors.every(
            (visitor) => visitor.vrmUrl === "/native.glb" && visitor.floor
        )
    ).toBe(true);
    expect(visitors.filter((visitor) => visitor.animation === 0)).toHaveLength(
        5000
    );
    expect(Math.min(...visitors.map((visitor) => visitor.z))).toBeGreaterThan(
        -100
    );
    expect(visitors).toEqual(
        benchmarkParticipants(10000, "/native.glb", "/portrait.png", 0)
    );
    const grid = benchmarkParticipants(
        256,
        "/native.glb",
        "/portrait.png",
        -1,
        "grid"
    );
    expect(grid.every((visitor) => visitor.animation === -1)).toBe(true);
    expect(benchmarkParticipants(0, "", "")).toEqual([]);
});

test("motion audition covers walk/run pace and physical jump boundaries without a network", () => {
    expect(benchmarkMotionPose(0).speed).toBe(0);
    expect(benchmarkMotionPose(3).speed).toBeCloseTo(1.6);
    expect(benchmarkMotionPose(6).speed).toBeCloseTo(3.2);
    expect(benchmarkMotionPose(8.5).speed).toBeCloseTo(5.4);
    expect(benchmarkMotionPose(11.5).speed).toBe(0);
    expect(benchmarkMotionPose(1 / 3, true)).toMatchObject({
        floor: false,
        y: 1,
    });
    expect(benchmarkMotionPose(2 / 3, true)).toMatchObject({
        floor: true,
        y: 0,
    });
    expect(benchmarkMotionPose(NaN)).toEqual(benchmarkMotionPose(0));
});

test("movement course reports the derivative of travel and stays still through pivots", () => {
    const { benchmarkMovementPose } = require("./crowdBenchmark");
    const dt = 0.00001;
    for (let t = 0.1; t < 11.9; t += 0.13) {
        const a = benchmarkMovementPose(t),
            b = benchmarkMovementPose(t + dt);
        expect(Math.abs((b.z - a.z) / dt)).toBeCloseTo(a.speed, 3);
    }
    expect(benchmarkMovementPose(4.5)).toMatchObject({ speed: 0, z: 2.64 });
    expect(benchmarkMovementPose(4.5).rotation).toBeCloseTo(Math.PI * 1.5);
    expect(benchmarkMovementPose(11).z).toBe(0);
    expect(benchmarkMovementPose(12).rotation % (Math.PI * 2)).toBeCloseTo(
        benchmarkMovementPose(11).rotation % (Math.PI * 2)
    );
});

test("turning course has bounded continuous travel and closes without teleporting", () => {
    const { benchmarkTurningPose } = require("./crowdBenchmark");
    let previous = benchmarkTurningPose(0);
    for (let f = 1; f <= 29 * 120; f++) {
        const p = benchmarkTurningPose(f / 120);
        expect(Math.hypot(p.x - previous.x, p.z - previous.z)).toBeLessThan(
            5.401 / 120
        );
        expect(Math.hypot(p.x, p.z)).toBeLessThan(15);
        expect(p.speed).toBeLessThanOrEqual(5.4);
        expect(Number.isFinite(p.turnIntent)).toBe(true);
        previous = p;
    }
    expect(previous).toEqual(benchmarkTurningPose(0));
});
