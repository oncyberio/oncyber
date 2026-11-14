import * as THREE from "three";
import { padelPositionAllowed, PADEL_VISIT_BOUNDS } from "./visit.js";

export const PADEL_TRAVEL_TIMING = Object.freeze({
  reveal: 1.8,
  stand: 1,
  standBlend: 0.1,
  readyBlend: 0.18,
  handoff: 1.18,
  depart: 1.1,
  crouch: 1,
  crouchLoop: 1.3666666746139526,
});
const clamp = THREE.MathUtils.clamp;
const finite = (value, fallback = 0) =>
  Number.isFinite(value) ? value : fallback;
const ease = (value) => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};
const vector = (value) =>
  value &&
  [value.x, value.y, value.z].every(
    (v) => Number.isFinite(v) && Math.abs(v) <= 1000
  );
const plain = (value) => ({ x: value.x, y: value.y, z: value.z });
const shortest = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
const DEFAULT_ANCHOR = Object.freeze({ x: 0, y: 0, z: 10.8 });

/** Translate and uniformly scale the entire composition, never just the camera
 * distance. This preserves the avatar's normalized screen position and size. */
export function mapPadelTravelView(source, avatarHeight = 1.78) {
  if (
    !source ||
    !vector(source.cameraOffset) ||
    !vector(source.cameraTargetOffset) ||
    !Number.isFinite(source.avatarRotation) ||
    Math.abs(source.avatarRotation) > 1e6 ||
    !Number.isFinite(source.avatarLift) ||
    Math.abs(source.avatarLift) > 100 ||
    !(source.fov > 0 && source.fov < 180)
  )
    return null;
  avatarHeight = clamp(finite(avatarHeight, 1.78), 0.2, 10);
  const sourceHeight =
    source.avatarHeight >= 0.2 && source.avatarHeight <= 10
      ? source.avatarHeight
      : avatarHeight;
  const scale = avatarHeight / sourceHeight;
  const scaled = (point) => ({
    x: point.x * scale,
    y: point.y * scale,
    z: point.z * scale,
  });
  const view = {
    cameraOffset: scaled(source.cameraOffset),
    cameraTargetOffset: scaled(source.cameraTargetOffset),
    avatarRotation: shortest(source.avatarRotation),
    avatarLift: source.avatarLift * scale,
    avatarHeight,
    fov: source.fov,
    cameraMode:
      source.cameraMode === "first-person" ? "first-person" : "third-person",
    avatarIdleTime: clamp(finite(source.avatarIdleTime), 0, 60),
  };
  if (
    vector(source.spawnOffset) &&
    Math.hypot(
      source.spawnOffset.x,
      source.spawnOffset.y,
      source.spawnOffset.z
    ) <= 32
  )
    view.spawnOffset = scaled(source.spawnOffset);
  return view;
}

/** The formation translates as a whole; only a blocked individual slot is moved
 * to its nearest walkable ground. Padel arrivals always have grounded feet. */
export function findPadelTravelLanding(view, anchor = DEFAULT_ANCHOR) {
  const base = vector(anchor) ? anchor : DEFAULT_ANCHOR;
  const offset = view?.spawnOffset || { x: 0, z: 0 };
  const x = clamp(
    base.x + finite(offset.x),
    PADEL_VISIT_BOUNDS.left + 0.4,
    PADEL_VISIT_BOUNDS.right - 0.4
  );
  const z = clamp(
    base.z + finite(offset.z),
    PADEL_VISIT_BOUNDS.back + 0.4,
    PADEL_VISIT_BOUNDS.front - 0.4
  );
  if (padelPositionAllowed(x, z)) return { x, y: 0, z };
  for (let radius = 0.2; radius <= 3; radius += 0.2) {
    for (let i = 0; i < 32; i++) {
      const angle = (i / 32) * Math.PI * 2;
      const px = x + Math.sin(angle) * radius,
        pz = z + Math.cos(angle) * radius;
      if (padelPositionAllowed(px, pz)) return { x: px, y: 0, z: pz };
    }
  }
  return { ...DEFAULT_ANCHOR };
}

export function capturePadelTravelView(camera, player, options = {}) {
  const x = finite(player?.x),
    z = finite(player?.z),
    lift = finite(player?.y);
  const height = clamp(finite(options.avatarHeight, 1.78), 0.2, 10);
  const feet = new THREE.Vector3(x, 0, z);
  const reference = new THREE.Vector3(x, lift + height * 0.65, z);
  const focus = camera
    .getWorldDirection(new THREE.Vector3())
    .multiplyScalar(Math.max(0.5, camera.position.distanceTo(reference)))
    .add(camera.position);
  return {
    cameraOffset: plain(camera.position.clone().sub(feet)),
    cameraTargetOffset: plain(focus.sub(feet)),
    avatarRotation: shortest(
      finite(player?.yaw) - finite(options.travelYawOffset)
    ),
    avatarLift: lift,
    avatarHeight: height,
    avatarIdleTime: clamp(
      finite(options.avatarIdleTime, finite(player?.travelIdleTime)),
      0,
      60
    ),
    cameraMode:
      options.cameraMode === "first-person" ? "first-person" : "third-person",
    fov: camera.fov,
  };
}

/** Stage once while hidden, acknowledge a rendered frame in the caller, then
 * startReveal(). The timer never consumes the hidden loading/preparation time. */
export function createPadelTravel({ camera, visit }) {
  const state = {
    phase: "inactive",
    worldProgress: 1,
    geometryProgress: 1,
    handoffProgress: 1,
    locked: false,
    done: true,
    reducedMotion: false,
    anchor: null,
    view: null,
    player: visit.state,
  };
  let elapsed = 0,
    holdTime = 0,
    holdAtStand = 0,
    idleTime = 0;
  let reduced = false,
    height = 1.78,
    followPose = null,
    readyIdle = false,
    yawOffset = 0;
  const target = new THREE.Vector3(),
    position = new THREE.Vector3();
  const orbit = new THREE.Vector3(),
    endOrbit = new THREE.Vector3();
  function lock(value) {
    state.locked = value;
    visit.setTravelLocked(value);
    visit.setCameraEnabled(!value);
  }
  function progress(value) {
    state.worldProgress = state.geometryProgress = clamp(value, 0, 1);
  }
  function applyCamera(view = state.view) {
    const anchor = state.anchor;
    camera.position.set(
      anchor.x + view.cameraOffset.x,
      anchor.y + view.cameraOffset.y,
      anchor.z + view.cameraOffset.z
    );
    target.set(
      anchor.x + view.cameraTargetOffset.x,
      anchor.y + view.cameraTargetOffset.y,
      anchor.z + view.cameraTargetOffset.z
    );
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
    if (camera.fov !== view.fov || camera.near !== 0.1) {
      camera.fov = view.fov;
      camera.near = 0.1;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld(true);
  }
  function player(pose, lift = state.view?.avatarLift || 0) {
    state.player = {
      ...visit.state,
      y: state.anchor.y + lift,
      animationMode: "travel",
      travelPose: pose,
      travelReadyIdle: pose.name === "IDLE_CC0",
      travelIdleTime: pose.name === "IDLE_CC0" ? pose.time : 0,
      vx: 0,
      vz: 0,
      speed: 0,
      grounded: true,
      verticalVelocity: 0,
      jumpCount: 0,
    };
  }
  function holdPose() {
    return reduced
      ? { name: "IDLE_CC0", time: holdTime }
      : {
          name: "TRAVEL_CROUCH_IDLE",
          time: holdTime % PADEL_TRAVEL_TIMING.crouchLoop,
        };
  }
  function prepare(options = {}) {
    height = clamp(finite(options.avatarHeight, 1.78), 0.2, 10);
    reduced = state.reducedMotion = Boolean(options.reducedMotion);
    yawOffset = finite(options.travelYawOffset);
    elapsed = holdTime = holdAtStand = idleTime = 0;
    readyIdle = false;
    const mapped = mapPadelTravelView(options.travelView, height);
    state.anchor = findPadelTravelLanding(mapped, options.anchor);
    const facing = mapped
      ? shortest(mapped.avatarRotation + yawOffset)
      : Math.PI;
    visit.place({ ...state.anchor, yaw: facing });
    visit.state.travelReadyIdle = false;
    visit.state.travelIdleTime = 0;
    followPose = visit.getFollowPose({
      yaw: facing - Math.PI,
      pitch: 0.24,
      distance: 6.8,
    });
    state.view = mapped || {
      cameraOffset: plain(
        followPose.position
          .clone()
          .sub(
            new THREE.Vector3(state.anchor.x, state.anchor.y, state.anchor.z)
          )
      ),
      cameraTargetOffset: { x: 0, y: 1.4, z: 0 },
      avatarRotation: facing,
      avatarLift: 0,
      avatarHeight: height,
      cameraMode: "third-person",
      fov: 58,
    };
    state.phase = "staged";
    state.done = false;
    state.handoffProgress = 0;
    progress(0);
    lock(true);
    applyCamera();
    player(holdPose());
    return state;
  }
  function startReveal() {
    if (state.phase !== "staged") return state;
    state.phase = "revealing";
    elapsed = 0;
    return state;
  }
  function cameraHandoff(amount) {
    const mix = ease(amount),
      from = state.view,
      anchor = state.anchor;
    target.set(
      from.cameraTargetOffset.x,
      from.cameraTargetOffset.y,
      from.cameraTargetOffset.z
    );
    const endTarget = followPose.target
      .clone()
      .sub(new THREE.Vector3(anchor.x, anchor.y, anchor.z));
    orbit
      .set(from.cameraOffset.x, from.cameraOffset.y, from.cameraOffset.z)
      .sub(target);
    endOrbit.copy(followPose.position).sub(followPose.target);
    const startYaw = Math.atan2(orbit.x, orbit.z),
      endYaw = Math.atan2(endOrbit.x, endOrbit.z);
    const startPitch = Math.atan2(orbit.y, Math.hypot(orbit.x, orbit.z));
    const endPitch = Math.atan2(endOrbit.y, Math.hypot(endOrbit.x, endOrbit.z));
    const yaw = startYaw + shortest(endYaw - startYaw) * mix;
    const pitch = THREE.MathUtils.lerp(startPitch, endPitch, mix);
    const radius = THREE.MathUtils.lerp(orbit.length(), endOrbit.length(), mix);
    target.lerp(endTarget, mix);
    position
      .set(
        Math.sin(yaw) * Math.cos(pitch) * radius,
        Math.sin(pitch) * radius,
        Math.cos(yaw) * Math.cos(pitch) * radius
      )
      .add(target);
    applyCamera({
      cameraOffset: position,
      cameraTargetOffset: target.clone(),
      fov: THREE.MathUtils.lerp(from.fov, followPose.fov, mix),
    });
  }
  function update(dt = 0) {
    dt = clamp(finite(dt), 0, 0.1);
    if (state.phase === "inactive") return state;
    if (state.phase === "ready") {
      if (
        visit.state.speed > 0.08 ||
        !visit.state.grounded ||
        visit.state.action === "load" ||
        visit.state.emote
      )
        readyIdle = false;
      idleTime += dt;
      visit.state.travelReadyIdle = readyIdle;
      visit.state.travelIdleTime = idleTime;
      state.player = readyIdle
        ? {
            ...visit.state,
            animationMode: "travel",
            travelPose: { name: "IDLE_CC0", time: idleTime },
            travelReadyIdle: true,
            travelIdleTime: idleTime,
          }
        : visit.state;
      return state;
    }
    holdTime += dt;
    if (state.phase === "staged") {
      applyCamera();
      player(holdPose());
      return state;
    }
    if (state.phase === "departing" || state.phase === "departed") {
      elapsed += dt;
      const t = reduced ? PADEL_TRAVEL_TIMING.depart : elapsed;
      progress(1 - t / PADEL_TRAVEL_TIMING.depart);
      const pose = reduced
        ? { name: "IDLE_CC0", time: t }
        : t < PADEL_TRAVEL_TIMING.crouch
        ? {
            name: "TRAVEL_CROUCH_DOWN",
            time: t,
            ...(t < 0.18
              ? {
                  previous: { name: "IDLE_CC0", time: idleTime + t },
                  blend: ease(t / 0.18),
                }
              : {}),
          }
        : {
            name: "TRAVEL_CROUCH_IDLE",
            time:
              (t - PADEL_TRAVEL_TIMING.crouch) %
              PADEL_TRAVEL_TIMING.crouchLoop,
          };
      applyCamera();
      player(pose, 0);
      if (t >= PADEL_TRAVEL_TIMING.depart) {
        state.phase = "departed";
        state.done = true;
      }
      return state;
    }
    elapsed += dt;
    const reveal = PADEL_TRAVEL_TIMING.reveal;
    if (reduced) elapsed = reveal + PADEL_TRAVEL_TIMING.handoff;
    progress(elapsed / reveal);
    if (elapsed < reveal) {
      applyCamera();
      player(holdPose());
      return state;
    }
    if (state.phase !== "handoff") {
      holdAtStand =
        (holdTime - Math.max(0, elapsed - reveal)) %
        PADEL_TRAVEL_TIMING.crouchLoop;
      state.phase = "handoff";
    }
    const time = Math.max(0, elapsed - reveal);
    state.handoffProgress = clamp(time / PADEL_TRAVEL_TIMING.handoff, 0, 1);
    cameraHandoff(state.handoffProgress);
    let pose;
    if (reduced) pose = { name: "IDLE_CC0", time: 0 };
    else if (time < PADEL_TRAVEL_TIMING.stand)
      pose = {
        name: "TRAVEL_STAND_UP",
        time,
        ...(time < PADEL_TRAVEL_TIMING.standBlend
          ? {
              previous: { name: "TRAVEL_CROUCH_IDLE", time: holdAtStand },
              blend: ease(time / PADEL_TRAVEL_TIMING.standBlend),
            }
          : {}),
      };
    else {
      idleTime = time - PADEL_TRAVEL_TIMING.stand;
      pose = {
        name: "IDLE_CC0",
        time: idleTime,
        ...(idleTime < PADEL_TRAVEL_TIMING.readyBlend
          ? {
              previous: {
                name: "TRAVEL_STAND_UP",
                time: PADEL_TRAVEL_TIMING.stand,
              },
              blend: ease(idleTime / PADEL_TRAVEL_TIMING.readyBlend),
            }
          : {}),
      };
    }
    player(pose, state.view.avatarLift * (1 - ease(state.handoffProgress)));
    if (state.handoffProgress >= 1) {
      visit.adoptFollow(followPose);
      state.phase = "ready";
      state.done = true;
      readyIdle = true;
      visit.state.travelReadyIdle = true;
      visit.state.travelIdleTime = idleTime;
      lock(false);
    }
    return state;
  }
  function capture(options = {}) {
    return capturePadelTravelView(
      camera,
      state.phase === "inactive" ? visit.state : state.player,
      {
        avatarHeight: height,
        travelYawOffset: yawOffset,
        cameraMode: state.locked ? state.view?.cameraMode : "third-person",
        ...options,
      }
    );
  }
  function startDepart(options = {}) {
    yawOffset = finite(options.travelYawOffset, yawOffset);
    height = clamp(finite(options.avatarHeight, height), 0.2, 10);
    reduced = state.reducedMotion = Boolean(options.reducedMotion);
    // Plant the feet before departure; a jump must not reappear at the destination.
    visit.place({ ...visit.state, y: 0 });
    state.player = visit.state;
    state.anchor = { x: visit.state.x, y: 0, z: visit.state.z };
    state.view = capturePadelTravelView(camera, visit.state, {
      avatarHeight: height,
      avatarIdleTime: idleTime,
      travelYawOffset: yawOffset,
      cameraMode: options.cameraMode,
    });
    state.phase = "departing";
    state.done = false;
    state.handoffProgress = 0;
    elapsed = holdTime = 0;
    progress(1);
    lock(true);
    return update(0);
  }
  function cancel() {
    lock(false);
    readyIdle = false;
    visit.state.travelReadyIdle = false;
    visit.state.travelIdleTime = 0;
    state.phase = "inactive";
    state.done = true;
    state.player = visit.state;
    progress(1);
    return state;
  }
  return {
    state,
    prepare,
    startReveal,
    startDepart,
    update,
    capture,
    cancel,
    releaseReadyIdle() {
      readyIdle = false;
      visit.state.travelReadyIdle = false;
      state.player = visit.state;
    },
  };
}
