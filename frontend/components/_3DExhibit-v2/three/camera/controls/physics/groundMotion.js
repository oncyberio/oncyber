// Ground and air movement feel for space controls, modelled on the lobby.
//
// The controls still add their per-frame impulse to the velocity (keyboard,
// strafing, Shift, joystick). That impulse only says where the player wants to
// go and how fast. Here we keep the legacy controller's 60 Hz top speed, but ease into it like the lobby (about half a second to
// full pace) and brake quickly and cleanly when input is released.

/** Settled speed per unit of impulse rate (legacy controller at 60 Hz). */
export const LEGACY_PACE = (1 / 60) * Math.exp(-10 / 60) / (1 - Math.exp(-10 / 60));
/** Release braking rate, per second (the lobby uses the same response). */
export const GROUND_BRAKE = 28;
/** Seconds from rest to the ordinary (unboosted) top speed. */
const RAMP_TIME = 0.5;
/** How fast the heading follows the input direction, per second. */
const STEER = 14;
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
    const accel = Math.max(1e-3, baseSpeed * LEGACY_PACE) / RAMP_TIME;
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
