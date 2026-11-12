import { createIdleVariation } from "./idleVariants";
import { createMovingTurns } from "./movingTurns";
import { createAirMotion } from "./airMotion";
import { createMotionTransitions } from "./motionTransitions";
/** Motion clocks shared by live skeletons and baked GPU crowds. No renderer imports. */
export interface LobbyMotionInput {
    /** Metres per second for an avatar at its normal display scale. */
    speed: number;
    /** True when movement input is released; false while driving, omitted for remote actors. */
    stopping?: boolean;
    /** False while a remote stop is only inferred from a missing update. */
    restConfirmed?: boolean;
    /** Keep the ready idle after arrival until a new movement or action. */
    postTeleportIdle?: boolean;
    /** One-shot active idle clip time, applied directly on a hidden arrival frame.
     * Clear to undefined after sampling; leaving it present never restarts the clock. */
    postTeleportIdleTime?: number;
    /** Remaining controller travel while braking, in display metres. */
    stopDistance?: number;
    grounded: boolean;
    height?: number;
    verticalVelocity?: number;
    turnRate?: number;
    /** Number of launches since last landing, when supplied by local physics. */
    jumpCount?: number;
    /** Signed movement-heading error, in radians. */
    headingError?: number;
    /** Desired heading relative to the body, before velocity smoothing. */
    turnIntent?: number;
    /** Disable decorative motion and contact correction for reduced motion/preview. */
    procedural?: boolean;
    quality?: "full" | "crowd";
    /** Set only by the live skeletal adapter, never by GPU instances. */
    warping?: boolean;
}

export type LobbyGait = string;
export interface LobbyClipMetadata {
    duration: number;
    loop?: boolean;
    speed?: number;
    exitPhase?: number;
    distance?: readonly number[];
    contacts?: { left: Float32Array; right: Float32Array };
    /** Dense left/right foot XYZ relative to hips, normalized by leg length. */
    stance?: Float32Array;
    turn?: {
        kind: "arc" | "cut";
        gait: string;
        direction: number;
        angle: number;
        entryPhase: number;
        phaseSpan: number;
    };
}
export interface LobbyLocomotionPose {
    /** Times are authored clip seconds, before any legacy action timeScale. */
    primary: { name: LobbyGait; time: number };
    secondary: { name: LobbyGait; time: number };
    /** Secondary weight; zero needs only the primary sample. */
    blend: number;
    /** Paired with cadence so stride warping never applies speed twice. */
    strideScale?: number;
    /** Authored turn contribution; suppress duplicate procedural lean/twist. */
    turnWeight?: number;
}

export const LOBBY_LOCOMOTION_DURATIONS = {
    IDLE: { duration: 2 },
    WALK: { duration: 1.0333333015441895 },
    RUN: { duration: 0.699999988079071 },
    JUMP: { duration: 2.6666667461395264 },
};

// Speeds are visual calibration anchors, not changes to controller/network speed.
export const LOBBY_GAIT_SPEEDS = { WALK: 1.6, RUN: 4.5 };
const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));
const finite = (value: number, fallback = 0) =>
    Number.isFinite(value) ? value : fallback;
const smooth = (t: number) => t * t * (3 - 2 * t);

/** The metadata object may be populated as a crowd's clips finish loading. */
export function createLobbyLocomotion(
    clips: Record<string, LobbyClipMetadata>,
    phase = 0,
    turnReady?: (name: string) => boolean
) {
    const pose: LobbyLocomotionPose = {
        primary: { name: "IDLE", time: 0 },
        secondary: { name: "IDLE", time: 0 },
        blend: 0,
    };
    const idleVariation = createIdleVariation(clips, phase);
    const transitions = createMotionTransitions(clips);
    const authoredAir = createAirMotion(clips);
    const turns = createMovingTurns(clips, turnReady);
    let gaitPhase = ((finite(phase) % 1) + 1) % 1;
    let idleTime =
        gaitPhase *
        Math.max(
            0.001,
            finite(
                clips.IDLE?.duration,
                LOBBY_LOCOMOTION_DURATIONS.IDLE.duration
            )
        );
    let speed = 0;
    let coarse: LobbyGait = "IDLE";
    let previousCoarse: LobbyGait = coarse;
    let coarseFade = 1;
    let quality: "full" | "crowd" = "full";
    let tierFade = 1;
    const grounds: LobbyGait[] = ["IDLE", "WALK", "RUN", "SPRINT"];
    const groundWeights = { IDLE: 1, WALK: 0, RUN: 0, SPRINT: 0 };
    const tierFrom = { IDLE: 1, WALK: 0, RUN: 0, SPRINT: 0 };
    let airborne = false;
    let airElapsed = 0;
    let airProgress = 0;
    let launchSpeed = 6;
    let previousAirVy = 0;
    let previousJumpCount = 0;
    let jumpWeight = 0;
    let moving = false;
    let moveWeight = 0;
    let movingAmplitude = 1;
    let stoppingFrom: LobbyGait = "WALK";
    const duration = (name: LobbyGait) =>
        Math.max(
            0.001,
            finite(
                clips[name]?.duration,
                LOBBY_LOCOMOTION_DURATIONS[name]?.duration || 1
            )
        );
    const time = (name: LobbyGait) =>
        name === "IDLE"
            ? idleTime % duration(name)
            : name === "JUMP"
            ? airProgress * duration(name)
            : gaitPhase * duration(name);
    const set = (a: LobbyGait, b: LobbyGait = a, blend = 0) => {
        pose.primary.name = a;
        pose.primary.time = time(a);
        pose.secondary.name = b;
        pose.secondary.time = time(b);
        pose.blend = clamp(blend, 0, 1);
        return pose;
    };

    return {
        update(dt: number, input: LobbyMotionInput): LobbyLocomotionPose {
            const step = clamp(finite(dt), 0, 0.1);
            pose.turnWeight = 0;
            const nextQuality = input.quality || "full";
            if (quality !== nextQuality) {
                let dominant: LobbyGait = "IDLE";
                for (const name of grounds) {
                    tierFrom[name] = groundWeights[name];
                    if (groundWeights[name] > groundWeights[dominant])
                        dominant = name;
                }
                quality = nextQuality;
                tierFade = 0;
                coarse = previousCoarse = dominant;
                coarseFade = 1;
            }
            const actualSpeed = clamp(finite(input.speed), 0, 12);
            // A slow pivot needs a small repositioning step rather than rotating
            // an idle pose with both feet glued to the floor. Reuse WALK at a
            // reduced amplitude, only for detailed grounded avatars.
            const pivot =
                input.quality !== "crowd" &&
                input.procedural !== false &&
                input.grounded
                    ? clamp(
                          (Math.abs(finite(input.turnRate)) - 0.25) * 0.18,
                          0,
                          0.5
                      ) *
                      (1 - clamp(actualSpeed / 0.6, 0, 1))
                    : 0;
            const targetSpeed = Math.max(actualSpeed, pivot);
            // Braking must follow physical velocity immediately; smoothing it a
            // second time after the controller keeps the feet/body out of sync.
            if (step > 0) {
                speed =
                    targetSpeed < speed
                        ? targetSpeed
                        : speed +
                          (targetSpeed - speed) * (1 - Math.exp(-18 * step));
            }
            const wasMoving = moving;
            moving = targetSpeed > 0.04;
            if (moving) movingAmplitude = pivot > actualSpeed ? 0.4 : 1;
            if (wasMoving && !moving) {
                stoppingFrom = "WALK";
                for (const gait of ["RUN", "SPRINT"])
                    if (groundWeights[gait] > groundWeights[stoppingFrom])
                        stoppingFrom = gait;
            }
            moveWeight = moving
                ? Math.min(1, moveWeight + step / 0.08)
                : Math.max(0, moveWeight - step / 0.1);
            idleTime += step;
            const runAnchor = clips.SPRINT ? 3.2 : LOBBY_GAIT_SPEEDS.RUN;
            const sprintMix = clips.SPRINT
                ? clamp((speed - runAnchor) / (5.4 - runAnchor), 0, 1)
                : 0;
            const lowGait = sprintMix > 0 ? "RUN" : "WALK";
            const highGait = sprintMix > 0 ? "SPRINT" : "RUN";
            const runMix = clamp(
                (speed - LOBBY_GAIT_SPEEDS.WALK) /
                    (runAnchor - LOBBY_GAIT_SPEEDS.WALK),
                0,
                1
            );
            const walkSpeed = clips.WALK?.speed || LOBBY_GAIT_SPEEDS.WALK;
            const runSpeed = clips.RUN?.speed || runAnchor;
            const sprintSpeed = clips.SPRINT?.speed || 5.4;
            const gaitMix = sprintMix > 0 ? sprintMix : runMix;
            const naturalSpeed =
                sprintMix > 0
                    ? runSpeed + (sprintSpeed - runSpeed) * sprintMix
                    : walkSpeed + (runSpeed - walkSpeed) * runMix;
            const walkStride = walkSpeed * duration("WALK");
            const runStride = runSpeed * duration("RUN");
            const sprintStride = sprintSpeed * duration("SPRINT");
            // A restrained geometric change handles speed variation; cadence
            // supplies the remainder. Coarse/baked instances retain original poses.
            pose.strideScale =
                input.quality !== "crowd" &&
                input.procedural !== false &&
                input.grounded &&
                actualSpeed > 0.04
                    ? clamp(actualSpeed / naturalSpeed, 0.82, 1.15)
                    : 1;
            if (input.quality === "crowd") {
                const midpoint = (LOBBY_GAIT_SPEEDS.WALK + runAnchor) / 2;
                const next: LobbyGait =
                    targetSpeed < (coarse === "IDLE" ? 0.08 : 0.04)
                        ? "IDLE"
                        : clips.SPRINT &&
                          speed >
                              (runAnchor + 5.4) / 2 +
                                  (coarse === "SPRINT" ? -0.2 : 0.2)
                        ? "SPRINT"
                        : speed >
                          midpoint +
                              (coarse === "RUN" || coarse === "SPRINT"
                                  ? -0.3
                                  : 0.3)
                        ? "RUN"
                        : "WALK";
                if (next !== coarse) {
                    previousCoarse = coarseFade < 0.5 ? previousCoarse : coarse;
                    coarse = next;
                    coarseFade = 0;
                }
                coarseFade = Math.min(1, coarseFade + step / 0.16);
            }
            const strideOf = (name: LobbyGait) =>
                name === "SPRINT"
                    ? sprintStride
                    : name === "RUN"
                    ? runStride
                    : walkStride;
            const stride =
                input.quality === "crowd"
                    ? strideOf(previousCoarse) +
                      (strideOf(coarse) - strideOf(previousCoarse)) *
                          smooth(coarseFade)
                    : strideOf(lowGait) +
                      (strideOf(highGait) - strideOf(lowGait)) * gaitMix;
            const crowdMovingWeight =
                (previousCoarse === "IDLE" ? 0 : 1) * (1 - smooth(coarseFade)) +
                (coarse === "IDLE" ? 0 : 1) * smooth(coarseFade);
            const activeWeight =
                input.quality === "crowd"
                    ? crowdMovingWeight
                    : moveWeight * (pivot > actualSpeed ? 0.4 : 1);
            // Apply speed once. Fading toward idle while also slowing phase in
            // proportion to speed would shrink foot travel quadratically. Only
            // brief start/stop fades reduce the gait amplitude; compensate start
            // cadence for that weight, then freeze the phase at physical rest.
            if (moving)
                gaitPhase =
                    (gaitPhase +
                        step *
                            Math.min(
                                2.8,
                                targetSpeed /
                                    (stride *
                                        (input.warping ? pose.strideScale : 1) *
                                        Math.max(0.1, activeWeight))
                            )) %
                    1;

            if (input.quality === "crowd") {
                if (coarseFade < 1)
                    set(previousCoarse, coarse, smooth(coarseFade));
                else set(coarse);
            } else {
                if (speed < LOBBY_GAIT_SPEEDS.WALK) set("WALK");
                else if (gaitMix >= 1) set(highGait);
                else set(lowGait, highGait, gaitMix);
                if (moveWeight < 1) {
                    const gait = moving
                        ? pose.blend < 0.5
                            ? pose.primary.name
                            : pose.secondary.name
                        : stoppingFrom;
                    // Preserve a pivot's small amplitude through its release;
                    // dropping the turn signal must not restore a full walk step.
                    set(
                        "IDLE",
                        gait,
                        moveWeight * (moving ? 1 : movingAmplitude)
                    );
                }
            }

            if (pivot > actualSpeed && moveWeight > 0)
                set("IDLE", "WALK", moveWeight * 0.4);

            // Quality changes retain the current ground mixture, rather than
            // briefly returning a moving avatar to the crowd controller's idle.
            for (const name of grounds) groundWeights[name] = 0;
            groundWeights[pose.primary.name] += 1 - pose.blend;
            groundWeights[pose.secondary.name] += pose.blend;
            if (tierFade < 1) {
                tierFade = Math.min(1, tierFade + step / 0.16);
                const weight = smooth(tierFade);
                for (const name of grounds)
                    groundWeights[name] =
                        tierFrom[name] * (1 - weight) +
                        groundWeights[name] * weight;
                let first: LobbyGait = "IDLE";
                for (const name of grounds)
                    if (groundWeights[name] > groundWeights[first])
                        first = name;
                let second: LobbyGait = first === "IDLE" ? "WALK" : "IDLE";
                for (const name of grounds)
                    if (
                        name !== first &&
                        groundWeights[name] > groundWeights[second]
                    )
                        second = name;
                const total = groundWeights[first] + groundWeights[second];
                set(
                    first,
                    second,
                    total > 0 ? groundWeights[second] / total : 0
                );
            }

            if (clips.JUMP_IDLE) {
                if (authoredAir(step, input, pose)) {
                    turns.update(
                        step,
                        { ...input, grounded: false },
                        pose,
                        gaitPhase
                    );
                    transitions(
                        step,
                        { ...input, grounded: false },
                        pose,
                        gaitPhase,
                        time("IDLE")
                    );
                    return idleVariation(step, input, pose);
                }
                const matchedPhase = transitions(
                    step,
                    input,
                    pose,
                    gaitPhase,
                    time("IDLE")
                );
                if (matchedPhase !== undefined) {
                    gaitPhase = matchedPhase;
                    pose.primary.time = time(pose.primary.name);
                    pose.secondary.time = time(pose.secondary.name);
                }
                const turnPhase = turns.update(step, input, pose, gaitPhase);
                if (turnPhase !== undefined) gaitPhase = turnPhase;
                return idleVariation(step, input, pose);
            }
            const isAirborne = input.grounded === false;
            const vy = finite(input.verticalVelocity);
            const height = Math.max(0, finite(input.height));
            if (
                isAirborne &&
                (!airborne ||
                    input.jumpCount > previousJumpCount ||
                    (vy > 1 && vy - previousAirVy > 2))
            ) {
                airElapsed = airProgress = 0;
                // Infer the remaining ballistic arc even if a peer first appears
                // part way through a jump. Gravity matches the lobby controller.
                launchSpeed = Math.max(
                    1,
                    Math.sqrt(vy * vy + 36 * height),
                    vy,
                    6
                );
            }
            airborne = isAirborne;
            previousAirVy = vy;
            previousJumpCount = input.jumpCount || 0;
            if (airborne) {
                airElapsed += step;
                const measured = Number.isFinite(input.verticalVelocity)
                    ? clamp(0.5 - vy / (2 * launchSpeed), 0, 0.98)
                    : Math.min(0.9, airElapsed / 0.7);
                airProgress = Math.max(airProgress, measured);
                // Untuck close to the floor on descent, then finish releasing on
                // contact. Existing JUMP is a tucked looping pose, not a landing.
                const landing =
                    vy < -0.1 && Number.isFinite(input.height)
                        ? clamp(height / 0.3, 0, 1)
                        : 1;
                const target = landing;
                jumpWeight += clamp(
                    target - jumpWeight,
                    -step / 0.12,
                    step / 0.09
                );
            } else {
                jumpWeight = Math.max(0, jumpWeight - step / 0.12);
            }
            if (jumpWeight > 0) {
                // At most two samples, even when the ground gait is itself blended.
                const ground =
                    pose.blend < 0.5 ? pose.primary.name : pose.secondary.name;
                if (jumpWeight >= 1) set("JUMP");
                else set(ground, "JUMP", jumpWeight);
            }
            if (jumpWeight === 0) {
                const matchedPhase = transitions(
                    step,
                    input,
                    pose,
                    gaitPhase,
                    time("IDLE")
                );
                if (matchedPhase !== undefined) {
                    gaitPhase = matchedPhase;
                    pose.primary.time = time(pose.primary.name);
                    pose.secondary.time = time(pose.secondary.name);
                }
                const turnPhase = turns.update(step, input, pose, gaitPhase);
                if (turnPhase !== undefined) gaitPhase = turnPhase;
            } else {
                turns.update(
                    step,
                    { ...input, grounded: false },
                    pose,
                    gaitPhase
                );
                transitions(
                    step,
                    { ...input, grounded: false },
                    pose,
                    gaitPhase,
                    time("IDLE")
                );
            }
            return idleVariation(step, input, pose);
        },
    };
}

/** Keep authored rotations and hips motion; limb translations/scales are rig-specific. */
export function sanitizeLobbyAnimation<
    T extends {
        tracks: Array<{
            name: string;
            times: ArrayLike<number>;
            values: ArrayLike<number>;
        }>;
    }
>(raw: T, name: string, restingHips?: ArrayLike<number>): T {
    const inPlace =
        ["WALK", "RUN", "SPRINT"].includes(name) ||
        name.startsWith("JUMP_") ||
        name.startsWith("DROP_") ||
        name === "FALLING";
    return {
        ...raw,
        tracks: raw.tracks
            .filter(
                (track) =>
                    track.name.endsWith(".quaternion") ||
                    track.name === "mixamorigHips.position"
            )
            .map((track) => {
                if (track.name !== "mixamorigHips.position") return track;
                if (name === "JUMP" && restingHips?.length >= 3) {
                    // JUMP is an airborne pose loop with a constant raised pelvis.
                    // Physics already lifts the whole avatar; retain only its
                    // authored changes relative to the grounded pelvis baseline.
                    const values = Array.from(track.values);
                    for (let axis = 0; axis < 3; axis++) {
                        const offset = values[axis] - restingHips[axis];
                        for (let i = axis; i < values.length; i += 3)
                            values[i] -= offset;
                    }
                    return { ...track, values };
                }
                if (!inPlace) return track;
                const values = Array.from(track.values);
                const first = track.times[0] || 0;
                const span = track.times[track.times.length - 1] - first;
                // Remove only travel across the cycle, retaining authored hip sway.
                for (const axis of [0, 2]) {
                    const travel =
                        values[values.length - 3 + axis] - values[axis];
                    for (let i = 0; i < track.times.length; i++)
                        values[i * 3 + axis] -=
                            span > 0
                                ? (travel * (track.times[i] - first)) / span
                                : 0;
                }
                return { ...track, values };
            }),
    };
}
