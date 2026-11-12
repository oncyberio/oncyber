import { FeelSimulation, FEEL_PROFILES, FeelProfile } from "./feelSimulation";
import { writeFileSync } from "fs";
const run = (profile: FeelProfile, count = 32, seed = 42) => {
    const sim = new FeelSimulation({ profile, count, seed });
    for (let f = 0; f < 60 * 24; f++) sim.advance(1 / 60);
    return sim.report();
};
test("seeded impaired simulation is reproducible", () => {
    expect(run("mobile", 4)).toEqual(run("mobile", 4));
});
test("network feel scenarios keep prediction, queues and remote motion bounded", () => {
    const reports = (Object.keys(FEEL_PROFILES) as FeelProfile[]).map(
        (profile) => run(profile)
    );
    for (const r of reports) {
        expect(r.observedActors).toBe(32);
        expect(r.pendingInputs).toBeLessThan(180);
        expect(r.remoteStepMeters.max).toBeLessThanOrEqual(8 / 60 + 0.0001);
        expect(r.queueMax).toBeLessThan(2000);
        expect(Number.isFinite(r.correctionMeters.max)).toBe(true);
    }
    expect(reports[0].correctionMeters.max).toBeLessThan(0.00001);
    if (process.env.LOBBY_FEEL_REPORT)
        writeFileSync(
            process.env.LOBBY_FEEL_REPORT,
            JSON.stringify(reports, null, 2) + "\n"
        );
});

test("local input responds immediately before a distant authority receives it", () => {
    const sim = new FeelSimulation({ profile: "distant", count: 2 });
    sim.advance(1 / 60, {
        strafe: 0,
        forward: -1,
        yaw: 0,
        jump: true,
        running: false,
        animation: -1,
    });
    expect(sim.predictor.state.y).toBeGreaterThan(0);
    expect(sim.predictor.state.z).toBeLessThan(0);
    expect(sim.authorities[0].state.y).toBe(0);
    expect(sim.authorities[0].sequence).toBe(0);
});
test("remote smoothing reduces jitter stops with bounded presentation offset", () => {
    const reports = [false, true].map((smoothing) => {
        const sim = new FeelSimulation({
            profile: "regional",
            count: 32,
            smoothing,
        });
        for (let frame = 0; frame < 24 * 60; frame++) sim.advance(1 / 60);
        return sim.report();
    });
    expect(reports[1].stoppedDuringMotionPercent).toBeLessThan(
        reports[0].stoppedDuringMotionPercent * 0.3
    );
    expect(reports[1].remoteAcceleration.p95).toBeLessThan(
        reports[0].remoteAcceleration.p95 * 0.5
    );
    // Worst raw interpolation-target offset across all 32 actors each frame.
    // Velocity-following smooths batch bursts without adding position lag.
    // This is the raw target error, not the old metric's clipped one-step target.
    expect(reports[1].presentationErrorMeters.p95).toBeLessThan(0.25);
    expect(reports[1].correctionMeters.max).toBeLessThan(0.00001);
});

test("the interactive lab presents motion between fixed ticks on high-refresh displays", () => {
    const sim = new FeelSimulation({ count: 2 });
    const command = {
        strafe: 0,
        forward: -1,
        yaw: 0,
        running: false,
        jump: false,
        animation: -1,
    };
    sim.advance(1 / 60, command);
    const fixed = { ...sim.predictor.state };
    const shown = sim.advance(1 / 120, command);
    expect(sim.predictor.state).toEqual(fixed);
    expect(shown.z).toBeLessThan(fixed.z);
});

test.each([60, 120])(
    "render-time sampling preserves the remote acceleration limit at %s Hz",
    (hz) => {
        const sim = new FeelSimulation({ count: 64, profile: "regional" });
        const previous = new Map<
            string,
            { x: number; z: number; vx: number; vz: number }
        >();
        const acceleration: number[] = [];
        for (let frame = 0; frame < hz * 12; frame++) {
            sim.advance(1 / hz);
            // This is the additional call made by the actual scene after advanceMovement.
            for (const person of sim.participants()) {
                const last = previous.get(person.id);
                const vx = last ? (person.x - last.x) * hz : 0;
                const vz = last ? (person.z - last.z) * hz : 0;
                if (last && frame > hz * 2)
                    acceleration.push(
                        Math.hypot(vx - last.vx, vz - last.vz) * hz
                    );
                previous.set(person.id, { x: person.x, z: person.z, vx, vz });
            }
        }
        acceleration.sort((a, b) => a - b);
        expect(
            acceleration[Math.floor(acceleration.length * 0.95)]
        ).toBeLessThan(45);
    }
);

test.each([60, 120])(
    "uploaded Avatar 52 stop settles without backward travel at %s Hz",
    (hz) => {
        const sim = new FeelSimulation({
            profile: "regional",
            seed: 42,
            count: 64,
        });
        const trail: Array<{ x: number; z: number }> = [];
        for (let frame = 0; frame < hz * 20; frame++) {
            sim.advance(1 / hz);
            const actor = sim.participants().find((p) => p.id === "52");
            if (actor && frame / hz >= 18)
                trail.push({ x: actor.x, z: actor.z });
        }
        const end = sim.authorities[52].state;
        const dx = end.x - trail[0].x,
            dz = end.z - trail[0].z;
        const length = Math.hypot(dx, dz);
        let backtrack = 0,
            previous = -Infinity;
        for (const point of trail) {
            const along =
                ((point.x - end.x) * dx + (point.z - end.z) * dz) / length;
            expect(along).toBeLessThanOrEqual(0.002);
            backtrack += Math.max(0, previous - along);
            previous = along;
        }
        expect(backtrack).toBeLessThan(0.002);
        expect(
            Math.hypot(trail.at(-1).x - end.x, trail.at(-1).z - end.z)
        ).toBeLessThan(0.002);
    }
);
