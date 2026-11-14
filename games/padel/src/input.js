import { AIM_LIMIT } from "./simulation.js";

const AIM_SPEED = 4.4;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** Movement and placement stay independent while preparing a stroke. */
export function readPadelInput(keys, aim, dt, actions = {}) {
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
    Number(keys.has(positive)) - Number(keys.has(negative));
  const moveX = axis("KeyD", "KeyA");
  const moveZ = axis("KeyS", "KeyW");
  const powerHeld = Boolean(
    actions.powerHeld || keys.has("Enter") || keys.has("NumpadEnter")
  );
  const targetX = axis("ArrowRight", "ArrowLeft");
  const targetZ = axis("ArrowDown", "ArrowUp");
  const step = Math.max(0, Number.isFinite(dt) ? dt : 0) * AIM_SPEED;
  return {
    ...actions,
    powerHeld,
    moveX,
    moveZ,
    sprint: keys.has("ShiftLeft") || keys.has("ShiftRight"),
    aimX: clamp(aim.aimX + targetX * step, -AIM_LIMIT, AIM_LIMIT),
    aimZ: clamp(aim.aimZ + targetZ * step, -AIM_LIMIT, AIM_LIMIT),
  };
}
