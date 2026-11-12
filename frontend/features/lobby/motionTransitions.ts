import { LOBBY_STOP_CLIPS } from "./motionNames";
import { sampleLobbyStance } from "./idleVariants";
import type {
    LobbyClipMetadata,
    LobbyLocomotionPose,
    LobbyMotionInput,
} from "./locomotion";

const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
/** Invert the authored monotonically decreasing remaining-distance curve. */
export function distanceMatchTime(
    curve: readonly number[],
    remaining: number,
    duration: number
) {
    if (!curve?.length || !Number.isFinite(remaining)) return 0;
    for (let i = 1; i < curve.length; i++)
        if (remaining >= curve[i]) {
            const span = curve[i - 1] - curve[i];
            return (
                (duration *
                    (i -
                        1 +
                        (span > 0
                            ? clamp((curve[i - 1] - remaining) / span)
                            : 0))) /
                (curve.length - 1)
            );
        }
    return duration;
}

/** Event transitions share the same two-sample budget as the crowd gait blend. */
export function createMotionTransitions(
    clips: Record<string, LobbyClipMetadata>
) {
    let previousSpeed: number | undefined,
        braking = 0,
        coasting = 0,
        stopAttempted = false,
        cooldown = 0;
    let name = "",
        time = 0,
        age = 0,
        initialDistance = 0,
        angle = 0;
    let matchedStopTime = 0;
    const query = new Float32Array(6),
        other = new Float32Array(6),
        candidate = new Float32Array(6);
    const matchStop = (pose: LobbyLocomotionPose, fallback: string) => {
        matchedStopTime = 0;
        const a =
            pose.blend < 1 &&
            sampleLobbyStance(
                clips[pose.primary.name],
                pose.primary.time,
                query
            );
        const b =
            pose.blend > 0 &&
            sampleLobbyStance(
                clips[pose.secondary.name],
                pose.secondary.time,
                other
            );
        if (!a && !b) return fallback;
        if (b)
            for (let axis = 0; axis < 6; axis++)
                query[axis] = a
                    ? query[axis] + (other[axis] - query[axis]) * pose.blend
                    : other[axis];
        let best = Infinity,
            selected = fallback;
        // Match both support feet and the early settling poses. A half-cycle
        // label alone can choose a bent knee opposite the currently visible leg.
        for (const name of LOBBY_STOP_CLIPS) {
            const clip = clips[name];
            if (!clip?.distance) continue;
            for (let frame = 0; frame <= 8; frame++) {
                const time = (clip.duration * 0.6 * frame) / 8;
                if (!sampleLobbyStance(clip, time, candidate)) continue;
                let error = 0;
                for (let axis = 0; axis < 6; axis++)
                    error += (query[axis] - candidate[axis]) ** 2;
                if (error < best) {
                    best = error;
                    selected = name;
                    matchedStopTime = time;
                }
            }
        }
        return selected;
    };
    let settledIdle = false;
    const idle = (pose: LobbyLocomotionPose, time: number) => {
        pose.primary.name = pose.secondary.name = "IDLE";
        pose.primary.time = pose.secondary.time = time;
        pose.blend = 0;
        pose.strideScale = 1;
    };
    let outgoingName = "IDLE",
        outgoingTime = 0,
        lastTurnSign = 0;
    return (
        dt: number,
        input: LobbyMotionInput,
        pose: LobbyLocomotionPose,
        phase: number,
        idleTime: number
    ) => {
        const speed = Number.isFinite(input.speed)
            ? Math.max(0, input.speed)
            : 0;
        const acceleration =
            previousSpeed === undefined || dt <= 0
                ? 0
                : (speed - previousSpeed) / dt;
        const starting =
            previousSpeed !== undefined &&
            previousSpeed <= 0.04 &&
            speed > 0.04;
        previousSpeed = speed;
        cooldown = Math.max(0, cooldown - dt);
        braking = acceleration < -2 ? braking + dt : 0;
        coasting = braking === 0 && speed > 0.1 ? coasting + dt : 0;
        if (braking === 0) stopAttempted = false;
        const hasStopDistance = Number.isFinite(input.stopDistance);
        const remainingDistance = hasStopDistance
            ? Math.max(0, input.stopDistance)
            : (speed * speed) / Math.max(0.1, -2 * acceleration);
        // Releasing sprint or reducing analog input can brake just as sharply
        // as releasing movement. Only the latter should plant a stopping foot.
        // Remote actors have no input intent: infer a stop only below half walk
        // speed, and abandon it if deceleration ends while still travelling.
        const stopping = input.stopping ?? (hasStopDistance || speed <= 0.8);
        const resumed =
            input.stopping === false ||
            (input.stopping === undefined &&
                !hasStopDistance &&
                coasting >= 0.08);
        const turn = Number.isFinite(input.turnRate) ? input.turnRate : 0;
        const enabled =
            input.procedural !== false &&
            input.grounded &&
            input.quality !== "crowd";
        if (!enabled) {
            settledIdle = false;
            name = "";
            braking = 0;
            return;
        }
        // An authored stop/pivot owns the final handoff. The underlying gait
        // fade may still contain a little WALK, especially at high frame rates.
        // Keep the completed idle pose until fresh movement or a new turn.
        if (settledIdle) {
            if (speed > 0.04 || (Math.abs(turn) > 0.5 && cooldown === 0))
                settledIdle = false;
            else {
                idle(pose, idleTime);
                return;
            }
        }
        // Choose the supporting half cycle; left/right phases share source timing.
        const side = phase < 0.5 ? "L" : "R";
        let requested = "";
        if (!name && cooldown === 0) {
            // Deceleration is also a run-to-walk transition. Reserve a stop
            // for the final step, when the predicted remaining travel fits the
            // authored clip. Otherwise a long braking ramp repeatedly times out
            // to the gait and restarts STOP, producing visible snaps.
            const stopName = `STOP_${side}`;
            const stopTime = (2 * remainingDistance) / Math.max(0.04, speed);
            if (
                stopping &&
                braking >= 0.025 &&
                !stopAttempted &&
                Math.abs(input.turnIntent || input.headingError || 0) < 0.85 &&
                speed > 0.1 &&
                stopTime <= (clips[stopName]?.duration || 0)
            )
                requested = matchStop(pose, stopName);
            else if (starting) requested = `START_${side}`;
            else if (speed < 0.15 && Math.abs(turn) > 0.5)
                requested = `PIVOT_${turn > 0 ? "L" : "R"}${
                    Math.abs(input.headingError || turn * 0.65) > 2 ? 180 : 90
                }`;
        }
        if (requested && clips[requested]) {
            name = requested;
            time = age = angle = 0;
            initialDistance = Math.max(0.005, remainingDistance);
            if (name.startsWith("STOP")) {
                stopAttempted = true;
                time = matchedStopTime;
                const curve = clips[name].distance;
                if (curve?.length > 1) {
                    const frame =
                        (time / clips[name].duration) * (curve.length - 1);
                    const lo = Math.floor(frame),
                        hi = Math.min(curve.length - 1, lo + 1);
                    const fraction =
                        curve[lo] + (curve[hi] - curve[lo]) * (frame - lo);
                    initialDistance /= Math.max(0.01, fraction);
                }
            }
            lastTurnSign = Math.sign(turn);
            const dominant = pose.blend < 0.5 ? pose.primary : pose.secondary;
            outgoingName = dominant.name;
            outgoingTime = dominant.time;
        }
        if (!name) return;
        const clip = clips[name],
            stop = name.startsWith("STOP"),
            pivot = name.startsWith("PIVOT");
        if (
            !clip ||
            (stop && (resumed || acceleration > 1.5)) ||
            (name.startsWith("START") && (speed <= 0.04 || braking >= 0.025)) ||
            (pivot &&
                (speed > 0.3 ||
                    (Math.abs(turn) > 0.3 && Math.sign(turn) !== lastTurnSign)))
        ) {
            name = "";
            cooldown = 0.08;
            return;
        }
        age += dt;
        const previousTime = time;
        if (stop && speed > 0.04) {
            // Distance estimates can collapse in a few frames near rest. Bound
            // playback instead of skipping through the leg's final support step.
            const matched = distanceMatchTime(
                clip.distance,
                clamp(remainingDistance / initialDistance),
                clip.duration
            );
            time = Math.min(time + dt, Math.max(time, matched));
        } else if (stop) time += dt;
        else if (pivot && Math.abs(turn) > 0.25) {
            angle += Math.abs(turn) * dt;
            time = Math.min(
                clip.duration * 0.85,
                (clip.duration * angle) /
                    (name.endsWith("180") ? Math.PI : Math.PI / 2)
            );
        } else time += dt;
        // A stalled measurement cannot strand an avatar in a transition forever.
        if (age > (pivot ? 1.4 : 0.7))
            // Finish a stalled stop at normal playback speed; never jump from
            // the planted step to the last frames in a single update.
            time = stop
                ? Math.max(time, previousTime + dt)
                : Math.max(time, clip.duration - 0.06) + dt;
        if (time >= clip.duration) {
            const exitPhase = name.startsWith("START")
                ? clip.exitPhase
                : undefined;
            settledIdle = (stop || pivot) && speed <= 0.04;
            if (settledIdle) idle(pose, idleTime);
            name = "";
            cooldown = 0.08;
            return exitPhase;
        }
        pose.strideScale = 1;
        const entry = clamp(age / (stop ? 0.12 : 0.075));
        const incoming = stop ? entry * entry * (3 - 2 * entry) : entry,
            outgoing = clamp((clip.duration - time) / 0.075);
        if (outgoing < 1) {
            const base = pose.blend < 0.5 ? pose.primary : pose.secondary;
            // Select the destination from physical motion, not whichever old
            // gait happens to win a fading 50/50 blend on this particular frame.
            const toIdle = (stop || pivot) && speed <= 0.04;
            pose.secondary.name = toIdle ? "IDLE" : base.name;
            pose.secondary.time = toIdle
                ? idleTime
                : name.startsWith("START") &&
                  ["WALK", "RUN", "SPRINT"].includes(base.name)
                ? ((clip.exitPhase +
                      (time - clip.duration) /
                          Math.max(0.001, clips.WALK.duration) +
                      1) %
                      1) *
                  clips[base.name].duration
                : base.time;
            pose.primary.name = name;
            pose.primary.time = time;
            pose.blend = 1 - outgoing;
        } else {
            pose.primary.name = outgoingName;
            pose.primary.time = outgoingTime;
            pose.secondary.name = name;
            pose.secondary.time = time;
            pose.blend = incoming;
        }
    };
}
