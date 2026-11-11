import {
    createLobbyLocomotion,
    type LobbyClipMetadata,
    type LobbyLocomotionPose,
    type LobbyMotionInput,
} from "@features/lobby/locomotion";
import {
    IDLE,
    IDLE_CC0,
    WALK,
    RUN,
    JUMP,
    FLY,
    POSSIBLE_ACTIONS,
} from "./constants";

import { GROUND_BRAKE } from "../../../camera/controls/physics/groundMotion";

const PREFIX = "@lobby/";
// The lobby clock expects metres per second for a 1.8 m avatar. Space avatars
// are normalized taller (about 2.85 units), so convert world units by the
// avatar's own height. Cadence then matches travel: no sliding, no slow motion.
// Authored space speeds are faster than the lobby, so the ordinary pace runs
// and the Shift boost sprints.
const LOBBY_AVATAR_HEIGHT = 1.8;
const NATIVE_AVATAR_HEIGHT = 2.85;
export const nativeLocomotionSpeed = (speed: number, height?: number) =>
    (Math.max(0, speed || 0) * LOBBY_AVATAR_HEIGHT) /
    (height > 0.5 ? height : NATIVE_AVATAR_HEIGHT);
// Space floors report a lost contact for single frames while walking over
// seams and steps. Only a launch or a sustained fall leaves the ground.
const AIRBORNE_GRACE = 0.18;
const LAUNCH_VELOCITY = 1.5;
const defaults = [IDLE, IDLE_CC0, WALK, RUN, JUMP, FLY];
export function hasCustomPlayerAction(wrapper: any) {
    // Identity, not just a name: a space may provide its own WALK or IDLE.
    return (
        !!wrapper.currentAction &&
        !POSSIBLE_ACTIONS.includes(wrapper.currentAction)
    );
}

/** Keep the existing vec4/batch layout. Negative w opts into exact pose samples;
 * custom/legacy actions retain their original nonnegative crossfade duration. */
export function encodeLobbyPose(
    pose: LobbyLocomotionPose,
    ids: string[],
    metadata: Record<string, LobbyClipMetadata>,
    target: number[]
) {
    const a = ids.indexOf(PREFIX + pose.primary.name);
    const b = ids.indexOf(PREFIX + pose.secondary.name);
    if (a < 0 || b < 0) return false;
    const phase = (sample: { name: string; time: number }) => {
        const duration = metadata[sample.name]?.duration;
        return duration > 0
            ? Math.max(0, Math.min(0.9999, sample.time / duration))
            : 0;
    };
    target[0] = a + phase(pose.primary);
    target[1] = b + phase(pose.secondary);
    target[2] = 0;
    target[3] = -1 - Math.max(0, Math.min(1, pose.blend));
    return true;
}

export function createNativeLobbyMotion(
    wrapper: any,
    metadata: Record<string, LobbyClipMetadata>
) {
    if (!metadata?.IDLE || !metadata.WALK || !metadata.RUN) return undefined;
    const locomotion = createLobbyLocomotion(metadata, Math.random());
    const position = { x: 0, y: 0, z: 0 };
    let initialized = false,
        rotation = 0,
        speed = 0,
        airTime = 0;
    const input: LobbyMotionInput = {
        speed: 0,
        grounded: true,
        verticalVelocity: 0,
        turnRate: 0,
    };
    const animations = [0, 0, 0, -1];
    let active = false;
    const actions = () => wrapper.vrm?.possibleActions;
    return {
        update(dt: number) {
            const step = Math.max(
                0,
                Math.min(Number.isFinite(dt) ? dt : 0, 0.1)
            );
            const p = wrapper.position;
            const dx = p.x - position.x,
                dy = p.y - position.y,
                dz = p.z - position.z;
            const distance = Math.hypot(dx, dz);
            const discontinuity =
                !initialized ||
                distance > Math.max(2, step * 24) ||
                Math.abs(dy) > 3;
            const native = wrapper.nativeMotionInput;
            const rawSpeed = native
                ? Math.max(0, native.speed || 0)
                : !discontinuity && step > 0
                ? distance / step
                : 0;
            // Smooth network packets using time, rather than frame-count
            // thresholds. Remote updates arrive unevenly, so average over
            // roughly a tenth of a second; speeding up stays a little quicker
            // than slowing down so starts never lag behind travel.
            // A held position is a real stop (interpolation moves every frame
            // otherwise): settle to idle in ~0.2s instead of easing out of the
            // walk for over half a second.
            const smoothing = rawSpeed > speed ? 12 : rawSpeed < 0.01 ? 20 : 8;
            speed = discontinuity
                ? 0
                : native
                ? rawSpeed
                : speed +
                  (rawSpeed - speed) * (1 - Math.exp(-smoothing * step));
            if (speed < 0.015) speed = 0;
            input.speed = nativeLocomotionSpeed(speed, wrapper.headPosition?.y);
            const verticalVelocity =
                native?.verticalVelocity ??
                (!discontinuity && step > 0 ? dy / step : 0);
            const contact = native?.grounded ?? wrapper.onFloor !== false;
            airTime = contact || discontinuity ? 0 : airTime + step;
            const launched =
                (native?.jumpCount ?? 0) > 0 ||
                verticalVelocity > LAUNCH_VELOCITY;
            input.grounded = contact || (!launched && airTime < AIRBORNE_GRACE);
            input.verticalVelocity = contact
                ? verticalVelocity
                : input.grounded
                ? 0
                : verticalVelocity;
            input.jumpCount = native?.jumpCount;
            input.stopping = native?.stopping;
            input.restConfirmed = native?.stopping;
            // Native release braking is exponential at GROUND_BRAKE per second.
            // Match its remaining travel in display metres.
            input.stopDistance = native?.stopping
                ? input.speed / GROUND_BRAKE
                : undefined;
            input.headingError = native?.headingError;
            input.turnIntent = native?.stopping
                ? undefined
                : native?.headingError;
            const yaw = wrapper.rotation || 0;
            input.turnRate =
                !discontinuity && step > 0
                    ? Math.atan2(
                          Math.sin(yaw - rotation),
                          Math.cos(yaw - rotation)
                      ) / step
                    : 0;
            Object.assign(position, p);
            rotation = yaw;
            initialized = true;
            if (
                native?.flying ||
                wrapper.isSitting ||
                wrapper.travelReadyIdle ||
                hasCustomPlayerAction(wrapper)
            )
                return false;
            if (wrapper.currentEmote) {
                if (speed > 0.08 || !input.grounded) wrapper.stopEmote();
                else return false;
            }
            if (
                wrapper.currentAction &&
                !defaults.includes(wrapper.currentAction)
            )
                return false;
            const pose = locomotion.update(step, input);
            if (wrapper.isHighQuality) {
                const available = actions();
                const a = available?.[PREFIX + pose.primary.name];
                const b = available?.[PREFIX + pose.secondary.name];
                if (!a || !b) return false;
                for (const action of Object.values(available) as any[]) {
                    action
                        .stopFading()
                        .stopWarping()
                        .setEffectiveWeight(0)
                        .setEffectiveTimeScale(0);
                }
                const sample = (action: any, time: number, weight: number) => {
                    if (weight <= 0) return;
                    action.enabled = true;
                    action.paused = false;
                    if (!action.isScheduled()) action.play();
                    action.time = time;
                    action.setEffectiveWeight(weight);
                };
                sample(a, pose.primary.time, 1 - pose.blend);
                sample(b, pose.secondary.time, pose.blend);
            } else {
                if (
                    !encodeLobbyPose(
                        pose,
                        wrapper.metaIds?.[0] || [],
                        metadata,
                        animations
                    )
                )
                    return false;
                wrapper.animations = animations;
                wrapper.currentAnimationIndex = Math.floor(
                    animations[pose.blend >= 0.5 ? 1 : 0]
                );
            }
            wrapper.currentAction = input.grounded
                ? speed < 0.08
                    ? IDLE
                    : input.speed < 2.4
                    ? WALK
                    : RUN
                : JUMP;
            active = true;
            return true;
        },
        release() {
            if (!active) return;
            active = false;
            if (wrapper.isHighQuality) {
                for (const [name, action] of Object.entries(
                    actions() || {}
                ) as [string, any][]) {
                    if (name.startsWith(PREFIX)) action.stop();
                    action.setEffectiveTimeScale(1);
                }
                // Explicit emotes/travel actions must start, even if their semantic
                // name matches the last default state.
                wrapper.currentAction = null;
            }
        },
    };
}
