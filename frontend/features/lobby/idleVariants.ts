import type {
    LobbyClipMetadata,
    LobbyLocomotionPose,
    LobbyMotionInput,
} from "./locomotion";

export const LOBBY_IDLE_CLIPS = [
    "IDLE",
    "IDLE_ONCYBER",
    "IDLE_CC0",
    "IDLE_RELAXED",
] as const;

export const isLobbyIdle = (name: string) =>
    LOBBY_IDLE_CLIPS.includes(name as (typeof LOBBY_IDLE_CLIPS)[number]);

/** Stable resting choice. The CC0 audition exposes the original idle as IDLE_RELAXED. */
export function chooseLobbyIdle(
    clips: Record<string, LobbyClipMetadata>,
    seed: number
) {
    const relaxed = clips.IDLE_RELAXED ? "IDLE_RELAXED" : "IDLE";
    return seed >= 0.5 && clips.IDLE_ONCYBER?.duration > 0
        ? "IDLE_ONCYBER"
        : relaxed;
}

/** Interpolate baked foot positions relative to the pelvis, in leg lengths. */
export function sampleLobbyStance(
    clip: LobbyClipMetadata | undefined,
    time: number,
    result: Float32Array
) {
    if (!clip?.stance?.length || !(clip.duration > 0)) return false;
    const count = clip.stance.length / 6;
    const phase =
        clip.loop === false
            ? Math.max(0, Math.min(1, time / clip.duration))
            : (((time / clip.duration) % 1) + 1) % 1;
    const frame = phase * (count - 1),
        lo = Math.floor(frame),
        hi = Math.min(count - 1, lo + 1);
    for (let axis = 0; axis < 6; axis++)
        result[axis] =
            clip.stance[lo * 6 + axis] +
            (clip.stance[hi * 6 + axis] - clip.stance[lo * 6 + axis]) *
                (frame - lo);
    return true;
}

/** CC0 ready idle after motion, then a stance-matched original idle after
 * 4–6 seconds of confirmed rest. Post-teleport rest holds the ready idle.
 * Two samples, no per-frame search or allocation.
 */
export function createIdleVariation(
    clips: Record<string, LobbyClipMetadata>,
    seed = 0
) {
    const initial = Number.isFinite(seed) ? ((seed % 1) + 1) % 1 : 0;
    let random = initial,
        selected = "",
        clock = 0,
        armed = false,
        restAge = 0,
        relaxed = false,
        postTeleportIdle = false,
        teleportTimeLatched = false;
    let previousA = "",
        previousB = "",
        previousATime = 0,
        previousBTime = 0,
        previousBlend = 0;
    let fadeAge = 1,
        fadeDuration = 0.22,
        from = "",
        fromTime = 0,
        followOutgoingMotion = false;
    const query = new Float32Array(6),
        other = new Float32Array(6),
        candidate = new Float32Array(6);
    const scores = new Float32Array(3),
        times = new Float32Array(3);
    const names = ["IDLE", "IDLE_ONCYBER", "IDLE_CC0"];
    const remember = (pose: LobbyLocomotionPose) => {
        previousA = pose.primary.name;
        previousATime = pose.primary.time;
        previousB = pose.secondary.name;
        previousBTime = pose.secondary.time;
        previousBlend = pose.blend;
        return pose;
    };
    const choose = (rest: boolean) => {
        names[0] = rest
            ? clips.IDLE_RELAXED
                ? "IDLE_RELAXED"
                : "IDLE"
            : clips.IDLE_CC0
            ? "IDLE_CC0"
            : "IDLE";
        names[1] = "IDLE_ONCYBER";
        const count = rest ? 2 : 1;
        const a =
            previousBlend < 1 &&
            sampleLobbyStance(clips[previousA], previousATime, query);
        const b =
            previousBlend > 0 &&
            sampleLobbyStance(clips[previousB], previousBTime, other);
        if (b)
            for (let axis = 0; axis < 6; axis++)
                query[axis] = a
                    ? query[axis] + (other[axis] - query[axis]) * previousBlend
                    : other[axis];
        let best = Infinity;
        for (let index = 0; index < count; index++) {
            const clip = clips[names[index]];
            scores[index] = Infinity;
            times[index] = initial * (clip?.duration || 1);
            if (!clip) continue;
            if (!a && !b) {
                scores[index] = 0;
                best = 0;
                continue;
            }
            for (let sample = 0; sample < 12; sample++) {
                const time = (sample / 12) * clip.duration;
                if (!sampleLobbyStance(clip, time, candidate)) continue;
                let error = 0;
                for (let axis = 0; axis < 6; axis++)
                    error += (query[axis] - candidate[axis]) ** 2;
                if (error < scores[index]) {
                    scores[index] = error;
                    times[index] = time;
                }
            }
            best = Math.min(best, scores[index]);
        }
        // About a few centimetres of stance difference may share the draw;
        // a visibly different support-leg arrangement cannot win at random.
        const tolerance = best + 0.0025;
        let eligible = 0;
        for (let i = 0; i < count; i++)
            if (clips[names[i]] && scores[i] <= tolerance) eligible++;
        let draw = Math.floor(random * eligible);
        let index = 0;
        for (let i = 0; i < count; i++)
            if (clips[names[i]] && scores[i] <= tolerance && draw-- === 0) {
                index = i;
                break;
            }
        selected = eligible
            ? names[index]
            : rest
            ? chooseLobbyIdle(clips, random)
            : names[0];
        clock = eligible ? times[index] : random * clips[selected].duration;
        random = (random + 0.61803398875) % 1;
    };
    return (dt: number, input: LobbyMotionInput, pose: LobbyLocomotionPose) => {
        const holdReadyIdle = input.postTeleportIdle === true;
        const idleTimeSeed =
            holdReadyIdle &&
            Number.isFinite(input.postTeleportIdleTime) &&
            input.postTeleportIdleTime >= 0 &&
            input.postTeleportIdleTime <= 60
                ? input.postTeleportIdleTime
                : undefined;
        const seedArrival = idleTimeSeed !== undefined && !teleportTimeLatched;
        teleportTimeLatched = idleTimeSeed !== undefined;
        if (
            !clips.IDLE ||
            (!clips.IDLE_ONCYBER &&
                !clips.IDLE_CC0 &&
                !clips.IDLE_RELAXED &&
                !holdReadyIdle)
        )
            return remember(pose);
        if (!selected) {
            selected = clips.IDLE_CC0 ? "IDLE_CC0" : "IDLE";
            clock = initial * clips[selected].duration;
        }
        clock += dt;
        if (holdReadyIdle && !postTeleportIdle) {
            // The lobby may have kept an already-relaxed clock while away.
            // Re-enter once using the visible stance, then let the ready clip loop.
            armed = true;
            restAge = 0;
            relaxed = false;
        }
        postTeleportIdle = holdReadyIdle;
        const resting =
            input.grounded && input.speed <= 0.04 && input.stopping !== false;
        const idleWeight =
            (pose.primary.name === "IDLE" ? 1 - pose.blend : 0) +
            (pose.secondary.name === "IDLE" ? pose.blend : 0);
        if (!resting || idleWeight === 0) {
            armed = true;
            restAge = 0;
            relaxed = false;
            fadeAge = 1;
        }
        if (resting && armed && idleWeight > 0) {
            choose(false);
            fadeDuration = 0.22;
            from = previousBlend < 0.5 ? previousA : previousB;
            fromTime = previousBlend < 0.5 ? previousATime : previousBTime;
            followOutgoingMotion = !isLobbyIdle(from);
            // Landings already own a timed 120 ms handoff; do not prolong it.
            fadeAge = from && !from.startsWith("DROP_") ? 0 : 1;
            armed = false;
        }
        if (seedArrival && resting && idleWeight >= 0.999) {
            // The previous renderer already displayed this ready pose. Sample it
            // directly after the hidden emote warmup, even if the hold was already
            // active. Subsequent frames continue the clock instead of reseeding.
            selected = clips.IDLE_CC0 ? "IDLE_CC0" : "IDLE";
            clock = idleTimeSeed % clips[selected].duration;
            armed = relaxed = followOutgoingMotion = false;
            restAge = 0;
            fadeAge = 1;
        }
        // A frozen extrapolation target is not a confirmed network stop.
        // Count only fully idle, grounded time; a turn/landing resets the timer.
        if (
            !holdReadyIdle &&
            resting &&
            idleWeight >= 0.999 &&
            input.restConfirmed !== false
        )
            restAge += dt;
        else restAge = 0;
        if (
            !holdReadyIdle &&
            !relaxed &&
            restAge >= 4 + initial * 2 &&
            fadeAge >= fadeDuration
        ) {
            from = selected;
            // The fade advances its outgoing clock below, just once per frame.
            fromTime = (clock - dt) % clips[selected].duration;
            followOutgoingMotion = false;
            choose(true);
            relaxed = true;
            fadeDuration = 0.85;
            fadeAge = from === selected ? 1 : 0;
        }
        if (resting && idleWeight > 0 && fadeAge < fadeDuration) {
            fadeAge += dt;
            // Only a motion-to-idle handoff follows a still-playing stop or
            // landing. An idle-to-idle fade must retain its captured idle: even
            // tiny residual gait weights would otherwise become a full walk.
            const outgoing = followOutgoingMotion
                ? pose.primary.name !== "IDLE" && pose.blend < 1
                    ? pose.primary
                    : pose.secondary.name !== "IDLE" && pose.blend > 0
                    ? pose.secondary
                    : undefined
                : undefined;
            if (outgoing) {
                from = outgoing.name;
                fromTime = outgoing.time;
            } else
                fromTime =
                    clips[from]?.loop === false
                        ? Math.min(clips[from].duration, fromTime + dt)
                        : (fromTime + dt) % (clips[from]?.duration || 1);
            const t = Math.min(1, fadeAge / fadeDuration);
            pose.primary.name = from;
            pose.primary.time = fromTime;
            pose.secondary.name = selected;
            pose.secondary.time = clock % clips[selected].duration;
            pose.blend = Math.min(idleWeight, t * t * (3 - 2 * t));
            return remember(pose);
        }
        const time = clock % clips[selected].duration;
        if (pose.primary.name === "IDLE") {
            pose.primary.name = selected;
            pose.primary.time = time;
        }
        if (pose.secondary.name === "IDLE") {
            pose.secondary.name = selected;
            pose.secondary.time = time;
        }
        return remember(pose);
    };
}
