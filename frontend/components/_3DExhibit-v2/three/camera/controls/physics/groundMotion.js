// Ground and air movement feel for space controls, modelled on the lobby.
//
// The controls still add their per-frame impulse to the velocity (keyboard,
// strafing, Shift, joystick). That impulse only says where the player wants to
// go and how fast. Here we keep the space's authored top speed (the legacy
// controller's 60 Hz pace), but reach it with the lobby's acceleration, so a
// start walks before it runs, and brake quickly and cleanly on release.

/** Settled speed per unit of impulse rate (legacy controller at 60 Hz). */
export const LEGACY_PACE = (1 / 60) * Math.exp(-10 / 60) / (1 - Math.exp(-10 / 60));
/** Release braking rate, per second (the lobby uses the same response). */
export const GROUND_BRAKE = 28;
/** Space units per lobby metre: avatars are normalized to about 2.85 units,
 * lobby avatars to 1.8 m. */
export const SPACE_UNITS_PER_METRE = 2.85 / 1.8;
/** The lobby's acceleration cap (multiplayer/protocol/movement.js), so a
 * start passes through the walk before it runs. */
const LOBBY_ACCELERATION = 6.4;
/** Slowest ramp to a space's ordinary pace, for spaces authored much faster
 * than the lobby (the lobby reaches its run in about 0.84 s). */
const MAX_RAMP_TIME = 0.85;
/** How fast the velocity follows the input direction, per second (lobby: 12). */
const STEER = 12;
/** The lobby turns the body toward its travel at this rate, per second. */
export const HEADING_RATE = 12;
/** Below this speed (units/s) the body keeps its heading (lobby: 0.1 m/s). */
export const HEADING_MIN_SPEED = 0.1 * SPACE_UNITS_PER_METRE;
/** Below this speed (units/s) a released player is at rest. */
const REST_SPEED = 0.05;
/** Air control as a fraction of the ground impulse rate (100 -> 20, as before). */
export const AIR_CONTROL = 0.2;

/**
 * @param {{x:number,z:number}} velocity horizontal velocity before this frame's impulse (mutated)
 * @param {{x:number,z:number}} impulse horizontal impulse the controls added this frame
 * @param {number} dt seconds
 * @param {number} baseSpeed the space's unboosted impulse rate (playerState.speed)
 */
export function applyGroundMotion(velocity, impulse, dt, baseSpeed) {
    if (!(dt > 0)) return velocity;
    // The legacy controller settled near rate / 10.9 at 60 Hz (and drifted
    // with frame rate); keep that 60 Hz pace at every frame rate.
    const desiredX = (impulse.x / dt) * LEGACY_PACE;
    const desiredZ = (impulse.z / dt) * LEGACY_PACE;
    const top = Math.hypot(desiredX, desiredZ);
    const current = Math.hypot(velocity.x, velocity.z);
    if (top < 1e-4) {
        const k = Math.exp(-GROUND_BRAKE * dt);
        velocity.x *= k;
        velocity.z *= k;
        if (current * k < REST_SPEED) velocity.x = velocity.z = 0;
        return velocity;
    }
    const follow = 1 - Math.exp(-STEER * dt);
    let x = velocity.x + (desiredX - velocity.x) * follow;
    let z = velocity.z + (desiredZ - velocity.z) * follow;
    const accel = Math.max(
        LOBBY_ACCELERATION * SPACE_UNITS_PER_METRE,
        Math.max(1e-3, baseSpeed * LEGACY_PACE) / MAX_RAMP_TIME
    );
    const limit = current + accel * dt;
    const next = Math.hypot(x, z);
    if (next > limit) {
        x *= limit / next;
        z *= limit / next;
    }
    velocity.x = x;
    velocity.z = z;
    return velocity;
}

/**
 * Air control may steer, but can never push past the faster of the take-off
 * speed and the ground top speed.
 * @param {{x:number,z:number}} velocity horizontal velocity after this frame's air impulse (mutated)
 * @param {number} before horizontal speed before the impulse
 * @param {number} top ground top speed for the current input (units/s)
 */
export function limitAirSpeed(velocity, before, top) {
    const limit = Math.max(before, top);
    const speed = Math.hypot(velocity.x, velocity.z);
    if (speed > limit && speed > 0) {
        velocity.x *= limit / speed;
        velocity.z *= limit / speed;
    }
    return velocity;
}

const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

/**
 * The lobby's facing: the body turns toward where it is actually travelling,
 * easing at HEADING_RATE, so a turn arcs with the velocity instead of
 * snapping to the keys. Standing still (or pressed against a wall), it turns
 * toward the input instead, and otherwise keeps its heading.
 * @param {number} rotation current body heading (radians, as playerState.rotation.y)
 * @param {{x:number,z:number}} velocity world velocity, units/s
 * @param {number | undefined} wanted heading of the input, when there is input
 * @param {number} dt seconds
 * @returns {{ rotation: number, headingError: number, turnIntent: number }}
 */
export function advanceHeading(rotation, velocity, wanted, dt) {
    const step = Math.max(0, Math.min(Number.isFinite(dt) ? dt : 0, 0.1));
    const speed = Math.hypot(velocity.x, velocity.z);
    const travel =
        speed > HEADING_MIN_SPEED ? Math.atan2(-velocity.x, -velocity.z) : undefined;
    const target = travel ?? wanted;
    const headingError = target === undefined ? 0 : wrap(target - rotation);
    const next = wrap(rotation + headingError * (1 - Math.exp(-HEADING_RATE * step)));
    return {
        rotation: next,
        headingError: travel === undefined ? 0 : wrap(travel - next),
        turnIntent: wanted === undefined ? 0 : wrap(wanted - next),
    };
}
