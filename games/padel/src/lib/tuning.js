/* The tuning table — every number a controller's feel depends on, in one place.
 *
 * A recipe is a set of primitives plus one of these tables; fork the table and
 * you have a new controller without touching code. The vocabulary follows
 * Unreal's CharacterMovementComponent and Quake where it maps cleanly, so an
 * agent that knows either is immediately at home; the defaults here are seeded
 * from Jungle Trail's hand-tuned walker so its port keeps its exact feel.
 *
 * Note on the acceleration model: rather than Unreal's units/s^2, movement uses
 * an exponential *response rate* (approach the target velocity by
 * `1 - exp(-rate*dt)` each frame) — the same model the reference walker used and
 * the one that stays stable at any frame rate. `groundAccel`/`groundBrake` are
 * those rates.
 */
export const DEFAULT_TUNING = {
  // body
  eyeHeight: 1.66, // camera above the feet — the avatar is scaled to match
  headroom: 0.14, // clearance above the eye for the collision capsule
  radius: 0.32,

  // horizontal locomotion
  walkSpeed: 1.45,
  sprintSpeed: 3.1,
  groundAccel: 6.2, // response rate toward target velocity while a key is held
  groundBrake: 7.5, // response rate toward zero when no key is held
  airSteer: 1.15, // how much you can still steer mid-jump
  airDrag: 0.18, // horizontal momentum bleed in flight
  strafeScale: 0.8, // a sidestep is shorter than a stride
  backwardScale: 0.7,

  // slopes (cosine of the surface normal's tilt)
  maxSlopeCos: 0.78, // steepest ground that can be climbed (~39°)
  slopeUphillCap: 0.28,
  slopeUphillK: 0.72,
  slopeUphillDead: 0.04,
  slopeDownhillCap: 0.1,
  slopeDownhillK: 0.26,
  slopeDownhillDead: 0.08,

  // vertical
  gravity: 9.81,
  jumpSpeed: 3.05,
  takeoffTime: 0.18,
  landTime: 0.24,
  groundSnapRate: 12, // how fast the feet settle onto a height change

  // first-person look
  lookSensitivity: 0.0022, // radians per pixel of mouse motion
  pitchClamp: 1.35, // max look up/down (radians)

  // gait / camera feel (first person)
  bob: true,
  fovWiden: 2.4, // degrees the lens opens at a full sprint
  fovLerp: 4.2,

  // third-person follow camera
  tp: {
    distance: 3.4,
    height: 0.7, // pivot lift above the eye
    sensitivity: 0.0026,
    pitchMin: -0.55, // radians; negative looks down over the shoulder
    pitchMax: 1.0,
    collision: true, // keep the camera above the ground / out of walls
    minDistance: 0.5,
    damp: 12, // camera follow stiffness
  },
};

/** Shallow-merge an override table onto the defaults (one level deep for `tp`). */
export function resolveTuning(overrides = {}) {
  const t = { ...DEFAULT_TUNING, ...overrides };
  t.tp = { ...DEFAULT_TUNING.tp, ...(overrides.tp || {}) };
  return t;
}
