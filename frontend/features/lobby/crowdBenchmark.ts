import { input, state, step } from "../../../multiplayer/protocol/movement";
import type { LobbyParticipant } from "./sceneTypes";

export const BENCHMARK_COUNTS = [64, 256, 1000, 10000] as const;
export const BENCHMARK_SAMPLES = 300;
export type DetailBudget = "128" | "256" | "unbounded";

export function benchmarkCount(value: unknown) {
    if (value == null || value === "") return 64;
    const parsed = Number(value);
    return Number.isFinite(parsed)
        ? Math.min(10000, Math.max(0, Math.floor(parsed)))
        : 64;
}
export function benchmarkBudget(value: unknown): DetailBudget {
    return value === "128" || value === "unbounded" ? value : "256";
}

// Realistic tag widths for the name tag pass, including non-Latin names.
const BENCHMARK_NAMES = [
    "rayan",
    "mira.okafor",
    "kenji",
    "0xdead",
    "lena_pixel",
    "théo",
    "ゆき",
    "glitchfrog",
    "ada",
    "nova42",
    "😎sam",
    "jules.eth",
];

/** Rows widen with depth so the fixture uses the camera's field of view. */
export function benchmarkParticipants(
    count: number,
    avatarUrl: string,
    portrait: string,
    animation = -1,
    layout: "fan" | "grid" = "fan"
): LobbyParticipant[] {
    const result: LobbyParticipant[] = [];
    const columns = Math.max(8, Math.ceil(Math.sqrt(count)));
    let row = 0;
    while (result.length < count) {
        const width = layout === "fan" ? 10 + Math.floor(row * 1.2) : columns;
        const remaining = Math.min(width, count - result.length);
        for (let column = 0; column < remaining; column++) {
            const index = result.length;
            result.push({
                id: `fixture-${index}`,
                name:
                    BENCHMARK_NAMES[index % BENCHMARK_NAMES.length] +
                    (index >= BENCHMARK_NAMES.length ? index : ""),
                x: (column - (remaining - 1) / 2) * 0.7,
                y: 0,
                z: -1 - row * 0.7,
                rotation: Math.PI,
                vrmUrl: avatarUrl,
                avatar: portrait,
                scale: 1,
                animation:
                    animation < 0 ? -1 : index % 2 === 0 ? animation : -1,
                floor: true,
            });
        }
        row++;
    }
    return result;
}

/** In-place motion audition, separate from network and movement benchmarks. */
export function benchmarkMotionPose(seconds: number, jump = false) {
    const time = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    if (jump) return benchmarkJumpPose(time);
    const cycle = time % 12;
    // Hold authored gaits and cross their boundaries in both directions.
    const anchors = [
        [0, 0],
        [1, 0],
        [2, 1.6],
        [4, 1.6],
        [5, 3.2],
        [7, 3.2],
        [8, 5.4],
        [9, 5.4],
        [11, 0],
        [12, 0],
    ];
    for (let index = 1; index < anchors.length; index++) {
        if (cycle <= anchors[index][0]) {
            const [start, from] = anchors[index - 1];
            const [end, to] = anchors[index];
            const blend = (cycle - start) / (end - start);
            return { speed: from + (to - from) * blend, y: 0, floor: true };
        }
    }
    return { speed: 0, y: 0, floor: true };
}

/** A reversible flat-floor course with real travel, brakes and stationary pivots. */
export function benchmarkMovementPose(seconds: number) {
    const t = (Number.isFinite(seconds) ? Math.max(0, seconds) : 0) % 12;
    const travel = (time: number) => {
        if (time <= 0) return { distance: 0, speed: 0 };
        if (time < 1) return { distance: 0.8 * time * time, speed: 1.6 * time };
        if (time < 2) return { distance: 0.8 + (time - 1) * 1.6, speed: 1.6 };
        if (time < 2.3) {
            const braking = time - 2;
            return {
                distance: 2.4 + 1.6 * braking - (0.8 / 0.3) * braking * braking,
                speed: 1.6 * (1 - braking / 0.3),
            };
        }
        return { distance: 2.64, speed: 0 };
    };
    const outward = travel(t - 1),
        inward = travel(t - 5);
    const turn = (start: number) => {
        const u = Math.max(0, Math.min(1, t - start));
        return u * u * (3 - 2 * u);
    };
    return {
        x: 0,
        z: outward.distance - inward.distance,
        speed: outward.speed + inward.speed,
        rotation: Math.PI * (1 + turn(4) + turn(8)),
        y: 0,
        floor: true,
    };
}

/** Identical physics for either pack, including one explicit midair launch. */
export function benchmarkJumpPose(seconds: number, double = false) {
    const t = Math.max(0, Number.isFinite(seconds) ? seconds : 0) % 2.2;
    const second = double && t >= 0.28;
    const elapsed = second ? t - 0.28 : t;
    const origin = second ? 6 * 0.28 - 9 * 0.28 ** 2 : 0;
    const y = Math.max(0, origin + 6 * elapsed - 9 * elapsed ** 2);
    const floor = y <= 1e-8;
    return {
        speed: 0,
        y: floor ? 0 : y,
        floor,
        jumpCount: floor ? 0 : second ? 2 : 1,
        verticalVelocity: floor ? 0 : 6 - 18 * elapsed,
    };
}

/** Shared deterministic trajectory, generated once rather than per visitor.
 * Replay out/back closes the course without a teleport at its loop boundary.
 */
const turnCourse = (() => {
    const body = state(),
        samples: {
            x: number;
            z: number;
            speed: number;
            rotation: number;
            turnIntent: number;
        }[] = [];
    for (let frame = 0; frame <= 810; frame++) {
        const t = frame / 60;
        const angle =
            t < 3.5
                ? Math.max(0, t - 1) * 1.3
                : t < 6
                ? 3.25 - (t - 3.5) * 1.4
                : t < 8
                ? -0.25 + (t - 6) * 1.6
                : t < 9.5
                ? 2.95 + Math.PI / 2
                : t < 11
                ? 2.95 - Math.PI / 2
                : 2.95 + Math.PI / 2;
        const amount = t <= 1 || t >= 12.5 ? 0 : t < 3.5 ? 0.5 : 1;
        if (frame)
            step(
                body,
                input({
                    strafe: -Math.sin(angle) * amount,
                    forward: -Math.cos(angle) * amount,
                    yaw: 0,
                    running: t >= 6 && t < 8,
                    jump: false,
                    animation: -1,
                })
            );
        samples.push({
            x: body.x,
            z: body.z,
            speed: Math.hypot(body.vx, body.vz),
            rotation: body.rotation,
            turnIntent: amount
                ? Math.atan2(
                      Math.sin(angle - body.rotation),
                      Math.cos(angle - body.rotation)
                  )
                : 0,
        });
    }
    return samples;
})();
export function benchmarkTurningPose(seconds: number) {
    const t = (Number.isFinite(seconds) ? Math.max(0, seconds) : 0) % 29;
    const reverse = t >= 14.5;
    const at = Math.max(0, Math.min(13.5, reverse ? 28 - t : t)) * 60;
    const lo = Math.floor(at),
        hi = Math.min(810, lo + 1),
        mix = at - lo;
    const a = turnCourse[lo],
        b = turnCourse[hi];
    const delta = Math.atan2(
        Math.sin(b.rotation - a.rotation),
        Math.cos(b.rotation - a.rotation)
    );
    let rotation = a.rotation + delta * mix + (reverse ? Math.PI : 0);
    const smooth = (v: number) => v * v * (3 - 2 * v);
    if (t > 13.5 && t < 14.5) rotation += Math.PI * smooth(t - 13.5);
    if (t > 28) rotation += Math.PI * smooth(t - 28);
    return {
        x: a.x + (b.x - a.x) * mix,
        z: a.z + (b.z - a.z) * mix,
        speed: a.speed + (b.speed - a.speed) * mix,
        rotation,
        turnIntent:
            (reverse ? -1 : 1) *
            (a.turnIntent + (b.turnIntent - a.turnIntent) * mix),
        y: 0,
        floor: true,
    };
}
