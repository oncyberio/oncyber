import * as THREE from "three";
import { KinematicLocomotion } from "./lib/kinematic.js";
import { FollowCam } from "./lib/follow-cam.js";
import { resolveTuning } from "./lib/tuning.js";

const finite = (value, fallback = 0) =>
  Number.isFinite(value) ? value : fallback;
const clamp = THREE.MathUtils.clamp;
const ground = {
  heightAt: () => 0,
  normalAt: (_x, _z, out) => out.set(0, 1, 0),
};
export const PADEL_VISIT_BOUNDS = Object.freeze({
  left: -12,
  right: 12,
  back: -17.7,
  front: 17.7,
});
// Match the actual padel net/posts, courtside benches and coolers in world.js.
const obstacles = [
  [-5.12, 5.12, -0.12, 0.12], // net and posts
  [-5.08, 5.08, -10.08, -9.92], // back glass
  [-5.08, 5.08, 9.92, 10.08],
  ...[-5, 5].flatMap((x) => [
    [x - 0.08, x + 0.08, -10, -2],
    [x - 0.08, x + 0.08, -0.45, 0.45],
    [x - 0.08, x + 0.08, 2, 10],
  ]), // side glass/mesh; entry doors at .45 < |z| < 2
];
const RADIUS = 0.32;
export function padelPositionAllowed(x, z, radius = RADIUS) {
  if (![x, z, radius].every(Number.isFinite) || radius < 0) return false;
  const b = PADEL_VISIT_BOUNDS;
  return (
    x >= b.left + radius &&
    x <= b.right - radius &&
    z >= b.back + radius &&
    z <= b.front - radius &&
    !obstacles.some(
      ([left, right, back, front]) =>
        x > left - radius &&
        x < right + radius &&
        z > back - radius &&
        z < front + radius
    )
  );
}
export function moveInPadelWorld(
  x,
  z,
  dx,
  dz,
  _feetY = 0,
  _topY = 1.78,
  radius = RADIUS
) {
  if (![x, z, dx, dz].every(Number.isFinite))
    return { x: finite(x, -7.2), z: finite(z, 11.8) };
  // Small swept steps prevent a slow frame or a jump from tunnelling through a net.
  const steps = Math.max(
    1,
    Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / 0.15)
  );
  dx /= steps;
  dz /= steps;
  for (let step = 0; step < Math.min(steps, 512); step++) {
    if (padelPositionAllowed(x + dx, z, radius)) x += dx;
    if (padelPositionAllowed(x, z + dz, radius)) z += dz;
  }
  return { x, z };
}
function clearSegment(a, b, radius = RADIUS) {
  return !obstacles.some(([left, right, back, front]) => {
    let enter = 0,
      exit = 1;
    for (const [origin, delta, min, max] of [
      [a.x, b.x - a.x, left - radius, right + radius],
      [a.z, b.z - a.z, back - radius, front + radius],
    ]) {
      if (Math.abs(delta) < 1e-9) {
        if (origin <= min || origin >= max) return false;
      } else {
        const t0 = (min - origin) / delta,
          t1 = (max - origin) / delta;
        enter = Math.max(enter, Math.min(t0, t1));
        exit = Math.min(exit, Math.max(t0, t1));
        if (enter > exit) return false;
      }
    }
    return enter < exit - 1e-8 && exit > 1e-8 && enter < 1 - 1e-8;
  });
}
/** Tiny visibility graph keeps click-to-walk useful on both sides of the net. */
export function findPadelVisitPath(start, target) {
  if (
    !start ||
    !target ||
    !padelPositionAllowed(start.x, start.z) ||
    !padelPositionAllowed(target.x, target.z)
  )
    return [];
  if (clearSegment(start, target)) return [{ x: target.x, z: target.z }];
  const nodes = [
    { x: start.x, z: start.z },
    { x: target.x, z: target.z },
  ];
  const padding = RADIUS + 0.07;
  for (const [left, right, back, front] of obstacles) {
    for (const x of [left - padding, right + padding])
      for (const z of [back - padding, front + padding])
        if (padelPositionAllowed(x, z)) nodes.push({ x, z });
  }
  const costs = nodes.map(() => Infinity),
    previous = nodes.map(() => -1),
    visited = new Set();
  costs[0] = 0;
  while (visited.size < nodes.length) {
    let current = -1;
    for (let i = 0; i < nodes.length; i++)
      if (!visited.has(i) && (current < 0 || costs[i] < costs[current]))
        current = i;
    if (current < 0 || !Number.isFinite(costs[current])) return [];
    if (current === 1) break;
    visited.add(current);
    for (let next = 0; next < nodes.length; next++) {
      if (visited.has(next) || !clearSegment(nodes[current], nodes[next]))
        continue;
      const cost =
        costs[current] +
        Math.hypot(
          nodes[next].x - nodes[current].x,
          nodes[next].z - nodes[current].z
        );
      if (cost < costs[next]) {
        costs[next] = cost;
        previous[next] = current;
      }
    }
  }
  const path = [];
  for (let node = 1; node > 0; node = previous[node]) {
    if (node < 0) return [];
    path.unshift(nodes[node]);
  }
  return path;
}
export function serializePadelVisitPose(state) {
  return {
    x: state.x,
    y: state.y,
    z: state.z,
    rotation: state.yaw,
    vx: state.vx,
    vz: state.vz,
    speed: state.speed,
    grounded: state.grounded,
    verticalVelocity: state.verticalVelocity,
    jumpCount: state.jumpCount,
  };
}

/** Platform locomotion and follow camera, with a free cursor for the social UI.
 * The parent owns keyboard focus and calls setEnabled(false) while chat is active.
 */
export function createPadelVisit({
  camera,
  canvas,
  onPose,
  random = Math.random,
  spawn,
} = {}) {
  const tuning = resolveTuning({
    walkSpeed: 2.8,
    sprintSpeed: 5.2,
    groundAccel: 12,
    groundBrake: 14,
    backwardScale: 1,
    strafeScale: 1,
    jumpSpeed: 4.8,
    gravity: 14,
    takeoffTime: 0.13,
    landTime: 0.2,
    bob: false,
    tp: {
      distance: 8.5,
      height: 0.2,
      minDistance: 2.5,
      damp: 9,
      pitchMin: 0.03,
      pitchMax: 0.95,
    },
  });
  const loco = new KinematicLocomotion(tuning);
  loco.setProviders({
    ground,
    collide: { move: moveInPadelWorld },
    constrain: () => {},
  });
  const arrival =
    spawn && padelPositionAllowed(spawn.x, spawn.z)
      ? spawn
      : {
          x: -7.2 + (clamp(finite(random(), 0.5), 0, 1) - 0.5) * 1.8,
          z: 11.8 + (clamp(finite(random(), 0.5), 0, 1) - 0.5) * 2.4,
        };
  loco.place(arrival.x, arrival.z);
  const follow = new FollowCam(tuning);
  follow.currentDist = 6.8;
  follow.pitch = 0.24;
  let yaw = -0.35,
    facing = Math.PI - 0.35,
    enabled = true,
    travelLocked = false,
    cameraEnabled = true,
    active = true,
    disposed = false;
  let drag = null,
    path = [],
    jumpHeld = false,
    poseTime = 0,
    stuckTime = 0;
  const pointer = new THREE.Vector2(),
    ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    point = new THREE.Vector3();
  const listeners = [];
  const on = (name, fn, options) => {
    canvas.addEventListener(name, fn, options);
    listeners.push(() => canvas.removeEventListener(name, fn, options));
  };
  const releaseDrag = () => {
    if (drag && canvas.hasPointerCapture?.(drag.id))
      canvas.releasePointerCapture(drag.id);
    drag = null;
  };
  const cancelMovement = () => {
    path = [];
    releaseDrag();
    jumpHeld = false;
    stuckTime = 0;
    loco.vel.x = loco.vel.z = loco.speed = 0;
    state.vx = state.vz = state.speed = 0;
  };
  on("pointerdown", (event) => {
    if (!enabled || travelLocked || !active || disposed || event.button !== 0)
      return;
    canvas.focus();
    drag = {
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      id: event.pointerId,
    };
    canvas.setPointerCapture?.(event.pointerId);
  });
  on("pointermove", (event) => {
    if (
      !drag ||
      event.pointerId !== drag.id ||
      !enabled ||
      travelLocked ||
      !active ||
      disposed
    )
      return;
    drag.moved ||=
      Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 5;
    if (drag.moved) {
      yaw -= (event.clientX - drag.x) * 0.004;
      follow.orbit(0, event.clientY - drag.y);
    }
    drag.x = event.clientX;
    drag.y = event.clientY;
  });
  on("pointerup", (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    if (!drag.moved && enabled && !travelLocked && active && !disposed) {
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        pointer.set(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          1 - ((event.clientY - rect.top) / rect.height) * 2
        );
        ray.setFromCamera(pointer, camera);
        if (ray.ray.intersectPlane(plane, point))
          path = findPadelVisitPath(loco.pos, point);
      }
    }
    releaseDrag();
  });
  on("pointercancel", releaseDrag);
  on("lostpointercapture", () => {
    drag = null;
  });
  on(
    "wheel",
    (event) => {
      if (enabled && !travelLocked && active && !disposed) {
        event.preventDefault();
        follow.zoom(event.deltaY);
      }
    },
    { passive: false }
  );
  const state = {
    animationMode: "visit",
    x: arrival.x,
    y: 0,
    z: arrival.z,
    yaw: facing,
    vx: 0,
    vz: 0,
    action: "idle",
    actionTime: 0,
    grounded: true,
    verticalVelocity: 0,
    jumpCount: 0,
    speed: 0,
    jumpWindup: tuning.takeoffTime,
    landingImpact: 0,
  };
  function reset() {
    cancelMovement();
    const position = padelPositionAllowed(state.x, state.z) ? state : arrival;
    loco.place(position.x, position.z);
    Object.assign(state, {
      x: loco.pos.x,
      y: 0,
      z: loco.pos.z,
      vx: 0,
      vz: 0,
      speed: 0,
      grounded: true,
      verticalVelocity: 0,
      jumpCount: 0,
      action: "idle",
      actionTime: 0,
      landingImpact: 0,
    });
    poseTime = 0;
    follow.reset();
  }
  // The travel controller uses the exact same endpoint as normal follow updates.
  function getFollowPose(options = {}) {
    const heading = finite(options.yaw, yaw);
    const pitch = clamp(
      finite(options.pitch, follow.pitch),
      tuning.tp.pitchMin,
      tuning.tp.pitchMax
    );
    const distance = clamp(
      finite(options.distance, follow.currentDist),
      tuning.tp.minDistance,
      tuning.tp.distance
    );
    const target = new THREE.Vector3(state.x, state.y + 1.4, state.z);
    return {
      position: new THREE.Vector3(
        clamp(
          state.x + Math.sin(heading) * distance * Math.cos(pitch),
          -11.75,
          11.75
        ),
        target.y + distance * Math.sin(pitch),
        clamp(
          state.z + Math.cos(heading) * distance * Math.cos(pitch),
          -19.4,
          24
        )
      ),
      target,
      fov: 58,
      yaw: heading,
      pitch,
      distance,
    };
  }
  function adoptFollow(options = {}) {
    const pose = getFollowPose(options);
    yaw = pose.yaw;
    follow.pitch = pose.pitch;
    follow.currentDist = pose.distance;
    // Capture the visit FOV rather than the staged incoming FOV on the next update.
    follow._baseFov = pose.fov;
    follow.reset();
    return pose;
  }
  function place(position = {}) {
    if (!padelPositionAllowed(position.x, position.z)) return false;
    state.x = position.x;
    state.z = position.z;
    facing = finite(position.yaw, facing);
    state.yaw = facing;
    reset();
    return true;
  }
  function update(dt, keys = new Set(), jumpRequested = false) {
    if (!active || disposed) return state;
    dt = clamp(finite(dt), 0, 0.05);
    let fx =
      enabled && !travelLocked
        ? Number(keys.has("KeyD") || keys.has("ArrowRight")) -
          Number(keys.has("KeyA") || keys.has("ArrowLeft"))
        : 0;
    let fz =
      enabled && !travelLocked
        ? Number(keys.has("KeyS") || keys.has("ArrowDown")) -
          Number(keys.has("KeyW") || keys.has("ArrowUp"))
        : 0;
    let mag = Math.hypot(fx, fz);
    if (mag) {
      path = [];
      fx /= mag;
      fz /= mag;
    } else if (enabled && !travelLocked && path.length) {
      const target = path[0],
        dx = target.x - loco.pos.x,
        dz = target.z - loco.pos.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 0.12) {
        path.shift();
        if (!path.length) loco.vel.x = loco.vel.z = 0;
      } else {
        fx = (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / distance;
        fz = (dx * Math.sin(yaw) + dz * Math.cos(yaw)) / distance;
        mag = 1;
      }
    }
    const down = enabled && !travelLocked && keys.has("Space");
    const previousX = loco.pos.x,
      previousZ = loco.pos.z;
    loco.update(dt, yaw, {
      fx,
      fz,
      mag,
      sprint:
        enabled &&
        !travelLocked &&
        (keys.has("ShiftLeft") || keys.has("ShiftRight")),
      jump: enabled && !travelLocked && ((down && !jumpHeld) || jumpRequested),
    });
    jumpHeld = down;
    if (loco.speed > 0.08) facing = Math.atan2(loco.vel.x, loco.vel.z);
    if (path.length && loco.speed < 0.05 && mag > 0) stuckTime += dt;
    else stuckTime = 0;
    if (stuckTime > 0.5) {
      path = [];
      stuckTime = 0;
    }
    if (cameraEnabled) {
      // A match may have left a first-person FOV/near plane on this shared camera.
      if (camera.fov !== 58 || camera.near !== 0.1) {
        camera.fov = 58;
        camera.near = 0.1;
        camera.updateProjectionMatrix();
      }
      follow.update(camera, {
        pivotX: loco.pos.x,
        pivotY: loco.pos.y + 1.2,
        pivotZ: loco.pos.z,
        yaw,
        ground,
        dt,
      });
      // Keep the boom in front of the back windscreen and inside the side fences.
      camera.position.x = clamp(camera.position.x, -11.75, 11.75);
      camera.position.z = clamp(camera.position.z, -19.4, 24);
      camera.lookAt(loco.pos.x, loco.pos.y + 1.4, loco.pos.z);
      camera.updateMatrixWorld();
    }
    const action =
      loco.jumpState === "takeoff"
        ? "load"
        : loco.grounded
        ? loco.speed > 0.08
          ? "run"
          : "idle"
        : "jump";
    Object.assign(state, {
      x: loco.pos.x,
      y: loco.pos.y,
      z: loco.pos.z,
      yaw: facing,
      vx: dt > 0 ? (loco.pos.x - previousX) / dt : state.vx,
      vz: dt > 0 ? (loco.pos.z - previousZ) / dt : state.vz,
      speed: loco.speed,
      grounded: loco.grounded,
      verticalVelocity: loco.verticalVelocity,
      jumpCount: loco.jumpCount,
      action,
      actionTime: action === state.action ? state.actionTime + dt : 0,
      landingImpact: loco.landImpact,
    });
    poseTime += dt;
    if (onPose && poseTime >= 0.1 - 1e-8) {
      poseTime = Math.max(0, poseTime - 0.1);
      onPose(serializePadelVisitPose(state));
    }
    return state;
  }
  return {
    state,
    reset,
    update,
    place,
    getFollowPose,
    adoptFollow,
    setTravelLocked(value) {
      travelLocked = Boolean(value);
      if (travelLocked) cancelMovement();
    },
    setCameraEnabled(value) {
      cameraEnabled = Boolean(value);
    },
    setEnabled(value) {
      enabled = Boolean(value);
      if (!enabled) cancelMovement();
    },
    setActive(value) {
      active = Boolean(value);
      cancelMovement();
      poseTime = 0;
    },
    get destination() {
      const target = path.at(-1);
      return target ? { ...target } : null;
    },
    dispose() {
      if (disposed) return;
      cancelMovement();
      disposed = true;
      listeners.forEach((off) => off());
    },
  };
}
