import { createIdleVariation, chooseLobbyIdle } from "./idleVariants";
import {
    createLobbyLocomotion,
    LobbyClipMetadata,
    LobbyLocomotionPose,
} from "./locomotion";

const left = [-0.15, -1, 0.25, 0.15, -1, -0.25];
const right = [-0.15, -1, -0.25, 0.15, -1, 0.25];
const neutral = [-0.15, -1, 0, 0.15, -1, 0];
const clip = (...frames: number[][]): LobbyClipMetadata => ({
    duration: 1,
    loop: true,
    stance: new Float32Array(frames.flat()),
});
const metadata = () => ({
    IDLE: clip(left, left),
    IDLE_ONCYBER: clip(right, right),
    IDLE_CC0: clip(neutral, neutral),
    WALK: clip(left, right, left),
    RUN: clip(left, right, left),
});
const pose = (name: string, time = 0): LobbyLocomotionPose => ({
    primary: { name, time },
    secondary: { name, time },
    blend: 0,
});
const still = { speed: 0, grounded: true, restConfirmed: true };

test.each([0, 0.4, 0.9])(
    "CC0 always follows movement and originals follow sustained rest (seed %s)",
    (seed) => {
        const clock = createLobbyLocomotion(metadata(), seed);
        for (let f = 0; f < 60; f++)
            clock.update(1 / 60, { speed: 4.5, grounded: true });
        let p: LobbyLocomotionPose;
        for (let f = 0; f < 3 * 60; f++) p = clock.update(1 / 60, still);
        expect(p.primary.name).toBe("IDLE_CC0");
        for (let f = 0; f < 5 * 60; f++) p = clock.update(1 / 60, still);
        expect(["IDLE", "IDLE_ONCYBER"]).toContain(p.primary.name);
        const chosen = p.primary.name;
        for (let f = 0; f < 3 * 60; f++) {
            p = clock.update(1 / 60, {
                ...still,
                quality: f < 90 ? "full" : "crowd",
                procedural: f < 120,
            });
            expect(p.primary.name).toBe(chosen);
        }
        for (let f = 0; f < 60; f++)
            clock.update(1 / 60, { speed: 4.5, grounded: true });
        for (let f = 0; f < 3 * 60; f++) p = clock.update(1 / 60, still);
        expect(p.primary.name).toBe("IDLE_CC0");
    }
);

test("ready idle enters at the closest foot phase instead of forcing frame zero", () => {
    const clips = metadata();
    clips.IDLE_CC0 = clip(right, left, right);
    const choose = createIdleVariation(clips, 0.2);
    choose(1 / 60, { speed: 1.6, grounded: true }, pose("WALK", 0));
    const p = choose(1 / 60, still, pose("IDLE"));
    expect(p.primary.name).toBe("WALK");
    expect(p.secondary.name).toBe("IDLE_CC0");
    expect(p.secondary.time).toBeCloseTo(0.5);
    expect(p.blend).toBeLessThan(0.03);
});

test("resting idle matches the CC0 stance, not an unrelated random original", () => {
    const clips = metadata();
    clips.IDLE_CC0 = clip(right, right);
    const choose = createIdleVariation(clips, 0);
    let p: LobbyLocomotionPose;
    for (let f = 0; f < 6 * 60; f++) p = choose(1 / 60, still, pose("IDLE"));
    expect(p.primary.name).toBe("IDLE_ONCYBER");
});

test.each([30, 60, 120])(
    "rest fades over two samples and movement interrupts immediately at %s Hz",
    (hz) => {
        const choose = createIdleVariation(metadata(), 0);
        let p: LobbyLocomotionPose,
            previous = 0,
            blends = 0;
        for (let f = 0; f < 5 * hz; f++) {
            p = choose(1 / hz, still, pose("IDLE"));
            if (
                p.primary.name === "IDLE_CC0" &&
                p.secondary.name !== "IDLE_CC0"
            ) {
                expect(p.blend).toBeGreaterThanOrEqual(previous);
                expect(p.blend - previous).toBeLessThan(0.07);
                previous = p.blend;
                blends++;
            }
            if (f === Math.floor(4.4 * hz)) {
                const moving = choose(
                    1 / hz,
                    { speed: 4, grounded: true, stopping: false },
                    pose("RUN", 0.2)
                );
                expect(moving.primary.name).toBe("RUN");
                expect(moving.blend).toBe(0);
                break;
            }
        }
        expect(blends).toBeGreaterThan(hz * 0.25);
    }
);

test("unconfirmed network freeze never enters resting; confirmed time starts from zero", () => {
    const choose = createIdleVariation(metadata(), 0);
    let p: LobbyLocomotionPose;
    for (let f = 0; f < 10 * 60; f++)
        p = choose(1 / 60, { ...still, restConfirmed: false }, pose("IDLE"));
    expect(p.primary.name).toBe("IDLE_CC0");
    for (let f = 0; f < 3 * 60; f++) p = choose(1 / 60, still, pose("IDLE"));
    expect(p.primary.name).toBe("IDLE_CC0");
    for (let f = 0; f < 3 * 60; f++) p = choose(1 / 60, still, pose("IDLE"));
    expect(["IDLE", "IDLE_ONCYBER"]).toContain(p.primary.name);
});

test("rest entry is staggered from four to six seconds across the crowd", () => {
    const entries = [];
    for (const seed of [0, 0.5, 0.99]) {
        const choose = createIdleVariation(metadata(), seed);
        for (let f = 0; f < 7 * 60; f++) {
            const p = choose(1 / 60, still, pose("IDLE"));
            if (
                p.primary.name === "IDLE_CC0" &&
                p.secondary.name !== "IDLE_CC0"
            ) {
                entries.push((f + 1) / 60);
                break;
            }
        }
    }
    entries.forEach((time, i) =>
        expect(time).toBeCloseTo(4 + [0, 0.5, 0.99][i] * 2, 1)
    );
});

test("CC0 preview keeps its ready idle and rests with the original idle alias", () => {
    const clips = { IDLE: clip(left, left), IDLE_RELAXED: clip(left, left) };
    const choose = createIdleVariation(clips, 0);
    let p: LobbyLocomotionPose;
    for (let f = 0; f < 3 * 60; f++) p = choose(1 / 60, still, pose("IDLE"));
    expect(p.primary.name).toBe("IDLE");
    for (let f = 0; f < 3 * 60; f++) p = choose(1 / 60, still, pose("IDLE"));
    expect(p.primary.name).toBe("IDLE_RELAXED");
    expect(chooseLobbyIdle({ IDLE: { duration: 2 } }, 0.9)).toBe("IDLE");
});

test.each([0, 0.5, 0.99])(
    "post-teleport rest holds the ready idle beyond 30 seconds (seed %s)",
    (seed) => {
        const clock = createLobbyLocomotion(metadata(), seed);
        for (let f = 0; f < 35 * 60; f++) {
            const p = clock.update(1 / 60, {
                ...still,
                postTeleportIdle: true,
            });
            expect(p.primary.name).toBe("IDLE_CC0");
            expect(p.blend).toBe(0);
        }
    }
);

test("arrival crossfades an already-relaxed avatar back to the closest ready phase", () => {
    const clips = metadata();
    clips.IDLE_ONCYBER = clip(left, left);
    clips.IDLE_CC0 = clip(right, left, right);
    const choose = createIdleVariation(clips, 0);
    let p: LobbyLocomotionPose;
    for (let f = 0; f < 7 * 60; f++) p = choose(1 / 60, still, pose("IDLE"));
    const previous = p.primary.name;
    expect(["IDLE", "IDLE_ONCYBER"]).toContain(previous);

    p = choose(1 / 60, { ...still, postTeleportIdle: true }, pose("IDLE"));
    expect(p.primary.name).toBe(previous);
    expect(p.secondary.name).toBe("IDLE_CC0");
    expect(p.secondary.time).toBeCloseTo(0.5);
    expect(p.blend).toBeGreaterThan(0);
    expect(p.blend).toBeLessThan(0.03);
    for (let f = 0; f < 60; f++)
        p = choose(1 / 60, { ...still, postTeleportIdle: true }, pose("IDLE"));
    expect(p.primary.name).toBe("IDLE_CC0");
});

test("holding the arrival idle advances its clock without repeatedly restarting it", () => {
    const choose = createIdleVariation(metadata(), 0.2);
    const input = { ...still, postTeleportIdle: true };
    let p = choose(0.05, input, pose("IDLE"));
    let time = p.primary.time;
    for (let f = 0; f < 100; f++) {
        p = choose(0.05, input, pose("IDLE"));
        expect(p.primary.time).toBeCloseTo((time + 0.05) % 1);
        time = p.primary.time;
    }
});

test("releasing the arrival hold starts the ordinary rest timer from zero", () => {
    const choose = createIdleVariation(metadata(), 0);
    let p: LobbyLocomotionPose;
    for (let f = 0; f < 35 * 60; f++)
        p = choose(1 / 60, { ...still, postTeleportIdle: true }, pose("IDLE"));
    for (let f = 0; f < 3 * 60; f++) p = choose(1 / 60, still, pose("IDLE"));
    expect(p.primary.name).toBe("IDLE_CC0");
    for (let f = 0; f < 3 * 60; f++) p = choose(1 / 60, still, pose("IDLE"));
    expect(["IDLE", "IDLE_ONCYBER"]).toContain(p.primary.name);
});

test("movement and jumping take precedence over a held arrival idle", () => {
    const choose = createIdleVariation(metadata(), 0);
    for (let f = 0; f < 60; f++)
        choose(1 / 60, { ...still, postTeleportIdle: true }, pose("IDLE"));
    const moving = choose(
        1 / 60,
        { speed: 4.5, grounded: true, stopping: false, postTeleportIdle: true },
        pose("RUN", 0.2)
    );
    expect(moving.primary).toEqual({ name: "RUN", time: 0.2 });
    const jumping = choose(
        1 / 60,
        { speed: 0, grounded: false, postTeleportIdle: true },
        pose("JUMP", 0.3)
    );
    expect(jumping.primary).toEqual({ name: "JUMP", time: 0.3 });
});

test.each([false, true])(
    "arrival holds the base idle when CC0 is missing (idle alias %s)",
    (hasAlias) => {
        const clips = {
            IDLE: clip(left, left),
            ...(hasAlias ? { IDLE_RELAXED: clip(right, right) } : {}),
        };
        const clock = createLobbyLocomotion(clips, 0.2);
        let p: LobbyLocomotionPose;
        for (let f = 0; f < 35 * 60; f++) {
            p = clock.update(1 / 60, { ...still, postTeleportIdle: true });
            expect(p.primary.name).toBe("IDLE");
            expect(Number.isFinite(p.primary.time)).toBe(true);
        }
        const before = p.primary.time;
        p = clock.update(1 / 60, { ...still, postTeleportIdle: true });
        expect(p.primary.time).toBeCloseTo((before + 1 / 60) % 1);
    }
);

test("arrival fades from the visible rest pose, never a zero-weight walking slot", () => {
    const clock = createLobbyLocomotion(metadata(), 0);
    let p: LobbyLocomotionPose;
    for (let f = 0; f < 7 * 60; f++) p = clock.update(1 / 60, still);
    const previous = p.primary.name;
    expect(["IDLE", "IDLE_ONCYBER"]).toContain(previous);
    p = clock.update(1 / 60, { ...still, postTeleportIdle: true });
    expect(p.primary.name).toBe(previous);
    expect(p.secondary.name).toBe("IDLE_CC0");
    expect(p.blend).toBeGreaterThan(0);
    expect(p.blend).toBeLessThan(0.03);
});

test.each([0, 0.000001, 0.0001, 0.0009])(
    "ready-to-rest fade never promotes a residual walk weight of %s",
    (walkWeight) => {
        const choose = createIdleVariation(metadata(), 0);
        let fadingFrames = 0;
        for (let f = 0; f < 6 * 60; f++) {
            const incoming = pose("IDLE");
            incoming.secondary = { name: "WALK", time: 0.4 };
            incoming.blend = walkWeight;
            const p = choose(1 / 60, still, incoming);
            const emittedWalkWeight =
                (p.primary.name === "WALK" ? 1 - p.blend : 0) +
                (p.secondary.name === "WALK" ? p.blend : 0);
            expect(emittedWalkWeight).toBeLessThanOrEqual(walkWeight);
            if (p.primary.name === "IDLE_CC0" && p.secondary.name !== "WALK") {
                expect(["IDLE", "IDLE_ONCYBER"]).toContain(p.secondary.name);
                fadingFrames++;
            }
        }
        expect(fadingFrames).toBeGreaterThan(30);
    }
);

test.each([30, 60, 120])(
    "ready-to-rest preserves the outgoing clock on every fade frame at %s Hz",
    (hz) => {
        const clock = createLobbyLocomotion(metadata(), 0);
        let previousReadyTime = 0;
        let hasPrevious = false;
        let fadingFrames = 0;
        for (let f = 0; f < 6 * hz; f++) {
            const p = clock.update(1 / hz, still);
            if (p.primary.name === "IDLE_CC0") {
                if (hasPrevious) {
                    const advance =
                        (p.primary.time - previousReadyTime + 1) % 1;
                    expect(advance).toBeCloseTo(1 / hz, 8);
                }
                previousReadyTime = p.primary.time;
                hasPrevious = true;
                if (p.blend > 0) {
                    expect(["IDLE", "IDLE_ONCYBER"]).toContain(
                        p.secondary.name
                    );
                    fadingFrames++;
                }
            }
            if (f >= 3 * hz) {
                if (p.blend < 1)
                    expect(["IDLE", "IDLE_ONCYBER", "IDLE_CC0"]).toContain(
                        p.primary.name
                    );
                if (p.blend > 0)
                    expect(["IDLE", "IDLE_ONCYBER", "IDLE_CC0"]).toContain(
                        p.secondary.name
                    );
            }
        }
        expect(fadingFrames).toBeGreaterThan(hz * 0.7);
    }
);

test("arrival from relaxed idle never substitutes residual walking for its outgoing pose", () => {
    const choose = createIdleVariation(metadata(), 0);
    let p: LobbyLocomotionPose;
    for (let f = 0; f < 7 * 60; f++) p = choose(1 / 60, still, pose("IDLE"));
    const previous = p.primary.name;
    for (let f = 0; f < 10; f++) {
        const incoming = pose("IDLE");
        incoming.secondary = { name: "WALK", time: 0.4 };
        incoming.blend = 0.0001;
        p = choose(1 / 60, { ...still, postTeleportIdle: true }, incoming);
        expect(p.primary.name).toBe(previous);
        expect(p.secondary.name).toBe("IDLE_CC0");
    }
});

test.each([false, true])(
    "a hidden arrival samples the departing ready idle phase (hold already active: %s)",
    (alreadyHeld) => {
        const clips = metadata();
        clips.IDLE_CC0.duration = 2.5;
        const choose = createIdleVariation(clips, 0);
        for (let f = 0; f < 7 * 60; f++) choose(1 / 60, still, pose("IDLE"));
        if (alreadyHeld) {
            choose(0.1, { ...still, postTeleportIdle: true }, pose("IDLE"));
            choose(0.1, { ...still, postTeleportIdle: true }, pose("IDLE"));
        }
        const input = {
            ...still,
            postTeleportIdle: true,
            postTeleportIdleTime: 1.75,
        };
        let p = choose(0, input, pose("IDLE"));
        expect(p.primary.name).toBe("IDLE_CC0");
        expect(p.primary.time).toBe(1.75);
        expect(p.blend).toBe(0);
        for (let f = 1; f <= 120; f++) {
            p = choose(1 / 60, input, pose("IDLE"));
            expect(p.primary.name).toBe("IDLE_CC0");
            const error = Math.abs(p.primary.time - ((1.75 + f / 60) % 2.5));
            expect(Math.min(error, 2.5 - error)).toBeCloseTo(0, 8);
        }
        p = choose(1 / 60, { ...still, postTeleportIdle: true }, pose("IDLE"));
        expect(p.primary.time).toBeCloseTo((1.75 + 121 / 60) % 2.5, 8);
        // A later arrival can reuse the same time after the one-shot was removed.
        p = choose(0, input, pose("IDLE"));
        expect(p.primary.time).toBe(1.75);
    }
);

test("arrival phase wraps the ready clip and falls back to the base idle", () => {
    const choose = createIdleVariation({ IDLE: { duration: 2 } }, 0);
    const p = choose(
        0,
        { ...still, postTeleportIdle: true, postTeleportIdleTime: 5.75 },
        pose("IDLE")
    );
    expect(p.primary).toEqual({ name: "IDLE", time: 1.75 });
    expect(
        choose(0.1, { ...still, postTeleportIdle: true }, pose("IDLE")).primary
            .time
    ).toBeCloseTo(1.85);
});

test.each([NaN, Infinity, -1, 60.1])(
    "invalid arrival time %s never corrupts the active idle clock",
    (postTeleportIdleTime) => {
        const choose = createIdleVariation(metadata(), 0.2);
        const p = choose(
            0,
            { ...still, postTeleportIdle: true, postTeleportIdleTime },
            pose("IDLE")
        );
        expect(p.primary.name).toBe("IDLE_CC0");
        expect(Number.isFinite(p.primary.time)).toBe(true);
        expect(p.primary.time).toBeGreaterThanOrEqual(0);
        expect(p.primary.time).toBeLessThan(1);
    }
);

test("an arrival phase never overrides real movement or an unheld idle", () => {
    const moving = createIdleVariation(metadata(), 0);
    const p = moving(
        0,
        {
            speed: 4.5,
            grounded: true,
            postTeleportIdle: true,
            postTeleportIdleTime: 0.75,
        },
        pose("RUN", 0.2)
    );
    expect(p.primary).toEqual({ name: "RUN", time: 0.2 });
    const ordinary = createIdleVariation(metadata(), 0.2);
    expect(
        ordinary(0, { ...still, postTeleportIdleTime: 0.75 }, pose("IDLE"))
            .primary.time
    ).toBeCloseTo(0.2);
});
