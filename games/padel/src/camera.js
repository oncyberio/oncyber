import * as THREE from "three";

export const PADEL_CAMERA_MODES = Object.freeze([
  "broadcast",
  "courtside",
  "first-person",
]);
const clamp = THREE.MathUtils.clamp;
const finite = (value, fallback) => (Number.isFinite(value) ? value : fallback);
const radians = THREE.MathUtils.degToRad;
const degrees = THREE.MathUtils.radToDeg;
const TRANSITION_TIME = 0.48;
const DEFAULT_HEIGHT = 1.78;

function viewFov(base, aspect, horizontalMinimum, maximum) {
  const portraitFov = degrees(
    2 * Math.atan(Math.tan(radians(horizontalMinimum) / 2) / aspect)
  );
  return clamp(Math.max(base, portraitFov), base, maximum);
}

/** Camera poses use the player's simulation root, never animated head bones.
 * Aim always stays generally toward the far court; following a lob cannot turn
 * the view backwards or make the opponent disappear above a close ball.
 */
export function calculatePadelCameraPose(state = {}) {
  const mode = PADEL_CAMERA_MODES.includes(state.mode)
    ? state.mode
    : "broadcast";
  const playing = Boolean(state.playing);
  const aspect = clamp(finite(state.aspect, 16 / 9), 0.45, 3.5);
  const p = state.player ?? {};
  const player = {
    x: clamp(finite(p.x, 0), -7.5, 7.5),
    y: clamp(finite(p.y, 0), 0, 3),
    z: clamp(finite(p.z, 10.7), 0.9, 18),
  };
  const b = state.ball ?? {};
  const ball = {
    x: clamp(finite(b.x, 0), -10, 10),
    y: clamp(finite(b.y, 1), 0, 24),
    z: clamp(finite(b.z, 0), -25, 25),
  };
  const height = clamp(finite(state.avatarHeight, DEFAULT_HEIGHT), 1.3, 2.3);
  const position = new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  let fov = 46;

  if (!playing || mode === "broadcast") {
    position.set(
      playing ? player.x * 0.1 : 12,
      playing ? 11.9 : 13.7,
      playing ? 22.8 : 25
    );
    lookAt.set(playing ? ball.x * 0.06 : -3.7, 0.45, playing ? -1.5 : 0);
    if (aspect <= 1.2) {
      position.y += 6;
      position.z += 9;
    }
  } else if (mode === "courtside") {
    position.set(player.x * 0.9, player.y + 3.1, player.z + 5.2);
    const lobLift = b.active ? clamp((ball.y - 2) * 0.1, 0, 0.85) : 0;
    lookAt.set(
      clamp(player.x * 0.12 + ball.x * 0.09, -1.8, 1.8),
      1.0 + lobLift,
      -5.5
    );
    fov = viewFov(58, aspect, 58, 88);
  } else {
    // Just in front of the face, not behind the neck. Root-locked eye height
    // avoids gait bob, sudden swing pitching, and camera lag through the head.
    position.set(player.x, player.y + height * 0.9, player.z - 0.12);
    const courtYaw = Math.atan2(-player.x, player.z + 8);
    const ballAhead = b.active && ball.z < position.z - 0.35;
    const ballYaw = Math.atan2(ball.x - position.x, position.z - ball.z);
    const yaw =
      courtYaw + (ballAhead ? clamp(ballYaw - courtYaw, -0.32, 0.32) * 0.6 : 0);
    const baselinePitch = Math.atan2(1.05 - position.y, player.z + 8);
    const ballPitch = Math.atan2(
      ball.y - position.y,
      Math.max(1.5, Math.hypot(ball.x - position.x, ball.z - position.z))
    );
    // At the net keep enough downward view to retain the tape, even during a lob.
    const maxPitch = player.z < 3 ? (-0.18 * (3 - player.z)) / 2.1 : 0.21;
    const pitch = clamp(
      baselinePitch +
        (ballAhead ? clamp(ballPitch - baselinePitch, -0.16, 0.35) * 0.55 : 0),
      -0.25,
      maxPitch
    );
    const distance = 16;
    lookAt.set(
      position.x + Math.sin(yaw) * Math.cos(pitch) * distance,
      position.y + Math.sin(pitch) * distance,
      position.z - Math.cos(yaw) * Math.cos(pitch) * distance
    );
    fov = viewFov(66, aspect, 62, 96);
  }
  return {
    mode,
    firstPerson: playing && mode === "first-person",
    playing,
    aspect,
    position,
    lookAt,
    fov,
    near: playing && mode === "first-person" ? 0.045 : 0.1,
  };
}

/** Owns the smoothing state for one THREE.PerspectiveCamera. Pass snap=true to
 * apply a paused mode change with dt=0. Ordinary zero-dt renders do not advance
 * transitions. Returned vectors are reusable controller state; do not mutate.
 */
export function createPadelCamera(camera) {
  if (!camera?.isPerspectiveCamera)
    throw new TypeError("A PerspectiveCamera is required");
  let initialized = false;
  let mode = null;
  let wasPlaying = false;
  let transitionElapsed = TRANSITION_TIME;
  const lookAt = new THREE.Vector3();
  const transitionPosition = new THREE.Vector3();
  const transitionLook = new THREE.Vector3();
  const previousPlayer = new THREE.Vector3();
  let transitionFov = 46;
  const result = {
    mode: "broadcast",
    firstPerson: false,
    position: camera.position,
    lookAt,
    fov: camera.fov,
  };

  function update(dt, state = {}, snap = false) {
    const pose = calculatePadelCameraPose({ aspect: camera.aspect, ...state });
    const delta = clamp(finite(dt, 0), 0, 0.1);
    const nextPlayer = new THREE.Vector3(
      finite(state.player?.x, 0),
      finite(state.player?.y, 0),
      finite(state.player?.z, 10.7)
    );
    const switched =
      initialized && (pose.mode !== mode || pose.playing !== wasPlaying);
    const resetJump =
      initialized &&
      pose.playing &&
      wasPlaying &&
      pose.mode !== "broadcast" &&
      nextPlayer.distanceToSquared(previousPlayer) > 16;
    if (!initialized || snap || resetJump) {
      camera.position.copy(pose.position);
      lookAt.copy(pose.lookAt);
      camera.fov = pose.fov;
      transitionElapsed = TRANSITION_TIME;
    } else {
      if (switched) {
        transitionPosition.copy(camera.position);
        transitionLook.copy(lookAt);
        transitionFov = camera.fov;
        transitionElapsed = 0;
      }
      if (transitionElapsed < TRANSITION_TIME) {
        transitionElapsed = Math.min(
          TRANSITION_TIME,
          transitionElapsed + delta
        );
        const t = transitionElapsed / TRANSITION_TIME;
        const eased = t * t * (3 - 2 * t);
        camera.position.lerpVectors(transitionPosition, pose.position, eased);
        lookAt.lerpVectors(transitionLook, pose.lookAt, eased);
        camera.fov = THREE.MathUtils.lerp(transitionFov, pose.fov, eased);
      } else {
        // First person follows every root step exactly. Only the gaze is damped.
        if (pose.firstPerson) camera.position.copy(pose.position);
        else
          camera.position.lerp(
            pose.position,
            1 - Math.exp(-delta * (pose.mode === "broadcast" ? 4 : 12))
          );
        lookAt.lerp(
          pose.lookAt,
          1 - Math.exp(-delta * (pose.firstPerson ? 9 : 6))
        );
        camera.fov = THREE.MathUtils.lerp(
          camera.fov,
          pose.fov,
          1 - Math.exp(-delta * 9)
        );
      }
    }
    const projectionChanged =
      Math.abs(camera.aspect - pose.aspect) > 1e-8 ||
      Math.abs(camera.near - pose.near) > 1e-8 ||
      Math.abs(result.fov - camera.fov) > 1e-6;
    camera.aspect = pose.aspect;
    camera.near = pose.near;
    if (projectionChanged || !initialized || snap)
      camera.updateProjectionMatrix();
    camera.lookAt(lookAt);
    camera.updateMatrixWorld();
    initialized = true;
    mode = pose.mode;
    wasPlaying = pose.playing;
    previousPlayer.copy(nextPlayer);
    Object.assign(result, {
      mode,
      firstPerson: pose.firstPerson,
      fov: camera.fov,
    });
    return result;
  }
  function reset() {
    initialized = false;
    transitionElapsed = TRANSITION_TIME;
  }
  return { update, reset };
}
