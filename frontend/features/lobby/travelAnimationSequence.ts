import {
    TRAVEL_ANIMATION_DURATION_MS as duration,
    TRAVEL_ANIMATION_PLAY_MS as play,
    TRAVEL_ANIMATION_SPEED as speed,
    type TravelAnimationPose,
} from "./travelAnimationPack";
import { TRAVEL_ISOLATE_MS } from "./worldTravelTiming";

export const TRAVEL_POSE_BLEND_MS = 180;
export const TRAVEL_ARRIVAL_MS = play.TRAVEL_STAND_UP + TRAVEL_POSE_BLEND_MS;
const CROUCH_AT_MS = TRAVEL_ISOLATE_MS + play.TRAVEL_ATTACK;
const HOLD_AT_MS = CROUCH_AT_MS + play.TRAVEL_CROUCH_DOWN;
const seconds = (ms: number) => Math.max(0, ms) / 1000;
function blend(
    pose: TravelAnimationPose,
    elapsed: number,
    previous: NonNullable<TravelAnimationPose["previous"]>
): TravelAnimationPose {
    if (elapsed >= TRAVEL_POSE_BLEND_MS) return pose;
    const t = Math.max(0, elapsed / TRAVEL_POSE_BLEND_MS);
    return { ...pose, previous, blend: t * t * (3 - 2 * t) };
}
/** Use authored clip time, so slow frames never restart or truncate a one-shot.
 * One-shots play at their trip speed; the crouch-idle loop plays as authored. */
export function sampleTravelDeparture(
    elapsedMs: number,
    reducedMotion = false
): TravelAnimationPose {
    const elapsed = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0);
    if (reducedMotion || elapsed < TRAVEL_ISOLATE_MS)
        return { name: "IDLE_CC0", time: seconds(elapsed) };
    const attack = elapsed - TRAVEL_ISOLATE_MS;
    if (elapsed < CROUCH_AT_MS)
        return blend(
            {
                name: "TRAVEL_ATTACK",
                time: seconds(attack * speed.TRAVEL_ATTACK),
            },
            attack,
            { name: "IDLE_CC0", time: seconds(elapsed) }
        );
    const crouch = elapsed - CROUCH_AT_MS;
    if (elapsed < HOLD_AT_MS)
        return blend(
            {
                name: "TRAVEL_CROUCH_DOWN",
                time: seconds(crouch * speed.TRAVEL_CROUCH_DOWN),
            },
            crouch,
            { name: "TRAVEL_ATTACK", time: seconds(duration.TRAVEL_ATTACK) }
        );
    const hold = elapsed - HOLD_AT_MS;
    return blend({ name: "TRAVEL_CROUCH_IDLE", time: seconds(hold) }, hold, {
        name: "TRAVEL_CROUCH_DOWN",
        time: seconds(duration.TRAVEL_CROUCH_DOWN),
    });
}
/** Stand fully before returning to the ready idle. Caller keeps movement locked until completion. */
export function sampleTravelArrival(
    elapsedMs: number,
    reducedMotion = false
): TravelAnimationPose {
    const elapsed = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0);
    if (reducedMotion) return { name: "IDLE_CC0", time: seconds(elapsed) };
    if (elapsed < play.TRAVEL_STAND_UP)
        return blend(
            {
                name: "TRAVEL_STAND_UP",
                time: seconds(elapsed * speed.TRAVEL_STAND_UP),
            },
            elapsed,
            { name: "TRAVEL_CROUCH_IDLE", time: 0 }
        );
    const idle = elapsed - play.TRAVEL_STAND_UP;
    return blend({ name: "IDLE_CC0", time: seconds(idle) }, idle, {
        name: "TRAVEL_STAND_UP",
        time: seconds(duration.TRAVEL_STAND_UP),
    });
}
