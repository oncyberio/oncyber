import { AIM_LIMIT } from "./simulation.js";

const AIM_SPEED = 4.4;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lean = (held, name) => clamp(Number(held?.[name]) || 0, 0, 1);

/**
 * Movement and placement stay independent while preparing a stroke.
 * `held` is the lifecycle's `context.input`: the declared actions
 * (game.json), each 0 to 1, whatever device they came from. `actions` adds
 * the frame's edges (hit, lob, powerReleased) and the meter's click-to-charge.
 */
export function readPadelInput(held, aim, dt, actions = {}) {
  // One request owns its aim until the incoming ball reaches the racket.
  if (actions.committed) {
    return {
      ...actions,
      hit: false,
      lob: false,
      powerHeld: false,
      powerReleased: false,
      moveX: 0,
      moveZ: 0,
      sprint: false,
      aimX: aim.aimX,
      aimZ: aim.aimZ,
    };
  }
  const axis = (positive, negative) =>
    lean(held, positive) - lean(held, negative);
  const moveX = axis("right", "left");
  const moveZ = axis("down", "up");
  const powerHeld = Boolean(actions.powerHeld || lean(held, "power") > 0);
  const targetX = axis("aimRight", "aimLeft");
  const targetZ = axis("aimDown", "aimUp");
  const step = Math.max(0, Number.isFinite(dt) ? dt : 0) * AIM_SPEED;
  return {
    ...actions,
    powerHeld,
    moveX,
    moveZ,
    sprint: lean(held, "run") > 0,
    aimX: clamp(aim.aimX + targetX * step, -AIM_LIMIT, AIM_LIMIT),
    aimZ: clamp(aim.aimZ + targetZ * step, -AIM_LIMIT, AIM_LIMIT),
  };
}
