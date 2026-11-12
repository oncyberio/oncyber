import {
    createLobbyLocomotion,
    LOBBY_LOCOMOTION_DURATIONS,
    sanitizeLobbyAnimation,
} from "./locomotion";

const snapshot = (
    pose: ReturnType<ReturnType<typeof createLobbyLocomotion>["update"]>
) => JSON.parse(JSON.stringify(pose));
const ground = { speed: 3.2, grounded: true };
function settle(
    controller: ReturnType<typeof createLobbyLocomotion>,
    speed: number,
    quality?: "crowd"
) {
    let pose;
    for (let i = 0; i < 90; i++)
        pose = controller.update(1 / 60, { speed, grounded: true, quality });
    return snapshot(pose);
}

test("walk and run share one distance-driven phase without restarting across the blend", () => {
    const controller = createLobbyLocomotion(LOBBY_LOCOMOTION_DURATIONS);
    const moving = settle(controller, 3.2);
    expect(moving.primary.name).toBe("WALK");
    expect(moving.secondary.name).toBe("RUN");
    expect(moving.blend).toBeGreaterThan(0);
    expect(moving.blend).toBeLessThan(1);
    const walkPhase =
        moving.primary.time / LOBBY_LOCOMOTION_DURATIONS.WALK.duration;
    expect(walkPhase).toBeCloseTo(
        moving.secondary.time / LOBBY_LOCOMOTION_DURATIONS.RUN.duration,
        8
    );
    const next = controller.update(1 / 60, { ...ground, speed: 3.7 });
    const advance =
        (next.primary.time / LOBBY_LOCOMOTION_DURATIONS.WALK.duration -
            walkPhase +
            1) %
        1;
    expect(advance).toBeGreaterThan(0);
    expect(advance).toBeLessThan(0.06);
});

test("stride cadence follows speed, and stopping settles fully to idle", () => {
    const a = createLobbyLocomotion(LOBBY_LOCOMOTION_DURATIONS);
    const b = createLobbyLocomotion(LOBBY_LOCOMOTION_DURATIONS);
    const slow = settle(a, 0.6);
    const fast = settle(b, 1.2);
    const phaseAdvance = (old, next) =>
        (next.secondary.time -
            old.secondary.time +
            LOBBY_LOCOMOTION_DURATIONS.WALK.duration) %
        LOBBY_LOCOMOTION_DURATIONS.WALK.duration;
    expect(
        phaseAdvance(fast, b.update(1 / 60, { speed: 1.2, grounded: true }))
    ).toBeCloseTo(
        phaseAdvance(slow, a.update(1 / 60, { speed: 0.6, grounded: true })) *
            2,
        5
    );
    let stopped;
    for (let i = 0; i < 20; i++)
        stopped = b.update(1 / 60, { speed: 0, grounded: true });
    expect(stopped).toMatchObject({ primary: { name: "IDLE" }, blend: 0 });
});

test("crowd quality settles to a single clip and hysteresis resists speed noise", () => {
    const controller = createLobbyLocomotion(LOBBY_LOCOMOTION_DURATIONS);
    expect(settle(controller, 2.9, "crowd")).toMatchObject({
        primary: { name: "WALK" },
        blend: 0,
    });
    for (let i = 0; i < 90; i++) {
        const pose = controller.update(1 / 60, {
            speed: i % 2 ? 3.1 : 3,
            grounded: true,
            quality: "crowd",
        });
        expect(pose.primary.name).toBe("WALK");
        expect(pose.blend).toBe(0);
    }
    expect(settle(controller, 5.4, "crowd")).toMatchObject({
        primary: { name: "RUN" },
        blend: 0,
    });
});

test("jump pose is controlled by the airborne arc, untucks near the floor and releases on landing", () => {
    const controller = createLobbyLocomotion(LOBBY_LOCOMOTION_DURATIONS);
    settle(controller, 0);
    const takeoff = snapshot(
        controller.update(0.03, {
            speed: 0,
            grounded: false,
            height: 0.15,
            verticalVelocity: 5.4,
        })
    );
    expect(takeoff.secondary.name).toBe("JUMP");
    expect(takeoff.blend).toBeGreaterThan(0);
    const apex = snapshot(
        controller.update(0.1, {
            speed: 0,
            grounded: false,
            height: 1,
            verticalVelocity: 0,
        })
    );
    expect(apex.primary.name).toBe("JUMP");
    expect(apex.primary.time).toBeCloseTo(
        LOBBY_LOCOMOTION_DURATIONS.JUMP.duration / 2
    );
    const descent = snapshot(
        controller.update(0.05, {
            speed: 0,
            grounded: false,
            height: 0.02,
            verticalVelocity: -5,
        })
    );
    expect(descent.secondary.name).toBe("JUMP");
    expect(descent.blend).toBeLessThan(1);
    expect(descent.secondary.time).toBeGreaterThan(apex.primary.time);
    controller.update(0.1, { speed: 0, grounded: true });
    const landed = controller.update(0.1, { speed: 0, grounded: true });
    expect(landed).toMatchObject({ primary: { name: "IDLE" }, blend: 0 });
    const nextHop = controller.update(0.03, {
        speed: 0,
        grounded: false,
        height: 0.15,
        verticalVelocity: 5.4,
    });
    expect(nextHop.secondary.time).toBeCloseTo(takeoff.secondary.time);
});

test("long falls hold an airborne pose instead of looping or inventing a landing", () => {
    const controller = createLobbyLocomotion({});
    let pose;
    for (let i = 0; i < 200; i++)
        pose = controller.update(0.1, {
            speed: 0,
            grounded: false,
            height: 20,
            verticalVelocity: -30,
        });
    const time = pose.primary.time;
    expect(pose.primary.name).toBe("JUMP");
    expect(time).toBeLessThan(LOBBY_LOCOMOTION_DURATIONS.JUMP.duration);
    controller.update(0.1, {
        speed: 0,
        grounded: false,
        height: 20,
        verticalVelocity: -30,
    });
    expect(pose.primary.time).toBe(time);
});

test("invalid delta and inputs remain finite, large frame gaps are bounded and pose allocation is stable", () => {
    const a = createLobbyLocomotion({});
    const b = createLobbyLocomotion({});
    const pose = a.update(NaN, { speed: Infinity, grounded: true });
    expect(pose.primary.time).toBe(0);
    expect(a.update(-1, ground)).toBe(pose);
    expect(snapshot(a.update(40, ground))).toEqual(
        snapshot(b.update(0.1, ground))
    );
});

test("late clip metadata changes sample duration without resetting normalized gait phase", () => {
    const clips = { WALK: { duration: 1 }, RUN: { duration: 1 } };
    const controller = createLobbyLocomotion(clips, 0.4);
    const before = settle(controller, 3.2);
    clips.WALK.duration = 2;
    const after = controller.update(0, ground);
    expect(after.primary.time).toBeCloseTo(before.primary.time * 2);
    expect(after.secondary.time).toBeCloseTo(before.secondary.time);
});

test("sanitation drops rig-specific vectors, keeps emote travel and removes locomotion drift without mutating source", () => {
    const raw = {
        tracks: [
            {
                name: "mixamorigHips.position",
                times: [0, 0.5, 1],
                values: [0, 1, 0, 0.8, 1.2, 0.6, 1, 1, 1],
            },
            { name: "mixamorigHips.scale", times: [0], values: [1, 1, 1] },
            {
                name: "mixamorigLeftLeg.position",
                times: [0],
                values: [0, 40, 0],
            },
            {
                name: "mixamorigLeftLeg.quaternion",
                times: [0],
                values: [0, 0, 0, 1],
            },
        ],
    };
    const untouched = JSON.stringify(raw);
    const walk = sanitizeLobbyAnimation(raw, "WALK");
    expect(walk.tracks.map((track) => track.name)).toEqual([
        "mixamorigHips.position",
        "mixamorigLeftLeg.quaternion",
    ]);
    expect(walk.tracks[0].values).toEqual([
        0, 1, 0, 0.30000000000000004, 1.2, 0.09999999999999998, 0, 1, 0,
    ]);
    expect(sanitizeLobbyAnimation(raw, "WAVING").tracks[0].values).toEqual(
        raw.tracks[0].values
    );
    expect(JSON.stringify(raw)).toBe(untouched);
});

test("single crowd gait cadence matches its selected stride rather than the richer blend", () => {
    const controller = createLobbyLocomotion(LOBBY_LOCOMOTION_DURATIONS);
    const before = settle(controller, 3.2, "crowd");
    const after = controller.update(1 / 60, {
        speed: 3.2,
        grounded: true,
        quality: "crowd",
    });
    expect(after.primary.name).toBe("WALK");
    const advance =
        (after.primary.time -
            before.primary.time +
            LOBBY_LOCOMOTION_DURATIONS.WALK.duration) %
        LOBBY_LOCOMOTION_DURATIONS.WALK.duration;
    expect(advance).toBeCloseTo(((1 / 60) * 3.2) / 1.6, 5);
});

test("switching detail tiers while running never introduces an idle pose", () => {
    const controller = createLobbyLocomotion(LOBBY_LOCOMOTION_DURATIONS);
    settle(controller, 5.4);
    for (const quality of ["crowd", "full", "crowd"] as const) {
        for (let i = 0; i < 20; i++) {
            const pose = controller.update(1 / 60, {
                speed: 5.4,
                grounded: true,
                quality,
            });
            expect(pose.primary.name).toBe("RUN");
            if (pose.blend > 0) expect(pose.secondary.name).toBe("RUN");
        }
    }
});

test("jump sanitation removes the pose loop's fixed pelvis offset without removing its authored changes", () => {
    const raw = {
        tracks: [
            {
                name: "mixamorigHips.position",
                times: [0, 1],
                values: [1, 116, 2, 1, 118, 2],
            },
        ],
    };
    expect(
        sanitizeLobbyAnimation(raw, "JUMP", [0, 96, 0]).tracks[0].values
    ).toEqual([0, 96, 0, 0, 98, 0]);
    expect(
        sanitizeLobbyAnimation(raw, "WAVING", [0, 96, 0]).tracks[0].values
    ).toEqual(raw.tracks[0].values);
});

test("deceleration keeps a full walking stride and applies actual speed only once", () => {
    const controller = createLobbyLocomotion(LOBBY_LOCOMOTION_DURATIONS);
    let before = settle(controller, 1.6);
    for (const speed of [1.2, 0.8, 0.4, 0.1]) {
        const after = snapshot(
            controller.update(1 / 60, { speed, grounded: true })
        );
        expect(after.primary.name).toBe("WALK");
        expect(after.blend).toBe(0);
        const advance =
            (after.primary.time -
                before.primary.time +
                LOBBY_LOCOMOTION_DURATIONS.WALK.duration) %
            LOBBY_LOCOMOTION_DURATIONS.WALK.duration;
        const impliedTravel =
            (advance / LOBBY_LOCOMOTION_DURATIONS.WALK.duration) *
            (1.6 * LOBBY_LOCOMOTION_DURATIONS.WALK.duration);
        expect(impliedTravel).toBeCloseTo(speed / 60, 6);
        before = after;
    }
    const stopped = snapshot(
        controller.update(1 / 60, { speed: 0, grounded: true })
    );
    expect(stopped.primary.name).toBe("IDLE");
    expect(stopped.secondary.name).toBe("WALK");
    expect(stopped.secondary.time).toBeCloseTo(before.primary.time, 7);
    expect(stopped.blend).toBeGreaterThan(0.8);
    for (let i = 0; i < 6; i++)
        controller.update(1 / 60, { speed: 0, grounded: true });
    expect(controller.update(0, { speed: 0, grounded: true }).blend).toBe(0);
});

test("stopping directly from a run settles the outgoing run rather than introducing a walking pose", () => {
    const controller = createLobbyLocomotion(LOBBY_LOCOMOTION_DURATIONS);
    settle(controller, 5.4);
    const stopped = controller.update(1 / 60, { speed: 0, grounded: true });
    expect(stopped).toMatchObject({
        primary: { name: "IDLE" },
        secondary: { name: "RUN" },
    });
});
