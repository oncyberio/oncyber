import * as THREE from "three";
import { courtMovement } from "./locomotion.js";
// Court gait (walk and run) is the lobby's own motion, from the avatar kit's
// copy of it (games/kits/avatar/motion): Padel bundles no lobby clips.
const LOCOMOTION_URL = new URL(
  "../../kits/avatar/motion/locomotion.json",
  import.meta.url
);
let packPromise;
const TENNIS_URL = new URL("./anim/tennis-motion.json", import.meta.url);
const SOURCE_HIPS_HEIGHT = 96.74480000054845;
const clamp = THREE.MathUtils.clamp;
const smooth = (a, b, t) => THREE.MathUtils.smoothstep(t, a, b);
const lerp = THREE.MathUtils.lerp;

const mixamoVRMRigMap = {
  mixamorigHips: "hips",
  mixamorigSpine: "spine",
  mixamorigSpine1: "chest",
  mixamorigSpine2: "upperChest",
  mixamorigNeck: "neck",
  mixamorigHead: "head",
  mixamorigLeftShoulder: "leftShoulder",
  mixamorigLeftArm: "leftUpperArm",
  mixamorigLeftForeArm: "leftLowerArm",
  mixamorigLeftHand: "leftHand",
  mixamorigLeftHandThumb1: "leftThumbMetacarpal",
  mixamorigLeftHandThumb2: "leftThumbProximal",
  mixamorigLeftHandThumb3: "leftThumbDistal",
  mixamorigLeftHandIndex1: "leftIndexProximal",
  mixamorigLeftHandIndex2: "leftIndexIntermediate",
  mixamorigLeftHandIndex3: "leftIndexDistal",
  mixamorigLeftHandMiddle1: "leftMiddleProximal",
  mixamorigLeftHandMiddle2: "leftMiddleIntermediate",
  mixamorigLeftHandMiddle3: "leftMiddleDistal",
  mixamorigLeftHandRing1: "leftRingProximal",
  mixamorigLeftHandRing2: "leftRingIntermediate",
  mixamorigLeftHandRing3: "leftRingDistal",
  mixamorigLeftHandPinky1: "leftLittleProximal",
  mixamorigLeftHandPinky2: "leftLittleIntermediate",
  mixamorigLeftHandPinky3: "leftLittleDistal",
  mixamorigRightShoulder: "rightShoulder",
  mixamorigRightArm: "rightUpperArm",
  mixamorigRightForeArm: "rightLowerArm",
  mixamorigRightHand: "rightHand",
  mixamorigRightHandPinky1: "rightLittleProximal",
  mixamorigRightHandPinky2: "rightLittleIntermediate",
  mixamorigRightHandPinky3: "rightLittleDistal",
  mixamorigRightHandRing1: "rightRingProximal",
  mixamorigRightHandRing2: "rightRingIntermediate",
  mixamorigRightHandRing3: "rightRingDistal",
  mixamorigRightHandMiddle1: "rightMiddleProximal",
  mixamorigRightHandMiddle2: "rightMiddleIntermediate",
  mixamorigRightHandMiddle3: "rightMiddleDistal",
  mixamorigRightHandIndex1: "rightIndexProximal",
  mixamorigRightHandIndex2: "rightIndexIntermediate",
  mixamorigRightHandIndex3: "rightIndexDistal",
  mixamorigRightHandThumb1: "rightThumbMetacarpal",
  mixamorigRightHandThumb2: "rightThumbProximal",
  mixamorigRightHandThumb3: "rightThumbDistal",
  mixamorigLeftUpLeg: "leftUpperLeg",
  mixamorigLeftLeg: "leftLowerLeg",
  mixamorigLeftFoot: "leftFoot",
  mixamorigLeftToeBase: "leftToes",
  mixamorigRightUpLeg: "rightUpperLeg",
  mixamorigRightLeg: "rightLowerLeg",
  mixamorigRightFoot: "rightFoot",
  mixamorigRightToeBase: "rightToes",
};

const lowerBone = (bone, property) =>
  (bone === "mixamorigHips" && property === "position") ||
  /mixamorig(?:Left|Right)(?:UpLeg|Leg|Foot|ToeBase)/.test(bone);

function retarget(
  data,
  vrm,
  reference,
  sourceHeight,
  lower,
  preservePlanar = false
) {
  const source = THREE.AnimationClip.parse(data);
  const tracks = [];
  for (const track of source.tracks) {
    const [bone, property] = track.name.split(".");
    if (lowerBone(bone, property) !== lower) continue;
    const node = vrm.humanoid.getNormalizedBoneNode(mixamoVRMRigMap[bone]);
    if (!node) continue;
    const values = track.values.slice();
    if (property === "quaternion") {
      if (vrm.meta?.metaVersion === "0")
        for (let i = 0; i < values.length; i += 4) {
          values[i] *= -1;
          values[i + 2] *= -1;
        }
      tracks.push(
        new THREE.QuaternionKeyframeTrack(
          `${node.name}.quaternion`,
          track.times,
          values
        )
      );
    } else if (bone === "mixamorigHips" && property === "position") {
      for (let i = 0; i < values.length; i += 3) {
        // Travel is already authored in place. Keep its small pelvic sway and
        // complete crouch depth exactly as the native lobby retargeter does.
        const scale = reference.height / sourceHeight;
        const mirror = vrm.meta?.metaVersion === "0" ? -1 : 1;
        values[i] = preservePlanar
          ? values[i] * scale * mirror
          : reference.position.x;
        values[i + 1] *= reference.height / sourceHeight;
        values[i + 2] = preservePlanar
          ? values[i + 2] * scale * mirror
          : reference.position.z;
      }
      tracks.push(
        new THREE.VectorKeyframeTrack(
          `${node.name}.position`,
          track.times,
          values
        )
      );
    }
  }
  return new THREE.AnimationClip(
    `${data.name}:${lower ? "lower" : "upper"}`,
    data.duration,
    tracks
  );
}

/** One mixer per player. Upper and lower clips blend independently during a run. */
export async function createPadelMotion(vrm) {
  packPromise ||= Promise.all(
    [LOCOMOTION_URL, TENNIS_URL].map(async (url) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Padel motion: ${response.status}`);
      return response.json();
    })
  );
  const [lobby, capture] = await packPromise;
  // The lobby's set has no sprint: its run cycle, driven faster by the same
  // stride phase, stands in for one.
  const native = [
    lobby.WALK,
    lobby.RUN,
    { ...lobby.RUN, name: "sprint" },
  ].filter((clip) => clip?.tracks);
  if (native.length !== 3) throw new Error("Padel motion: gait clips missing");
  // Preserve original motion provenance; map capture names only at runtime.
  const clips = capture.clips.map((entry) => ({
    ...entry,
    name: entry.name.replace("tennis-", "padel-"),
    clip: { ...entry.clip, name: entry.clip.name.replace("tennis-", "padel-") },
  }));
  const forehand = clips.find((entry) => entry.name === "padel-forehand");
  const overhead = clips.find((entry) => entry.name === "padel-serve");
  const padel = {
    ...capture,
    clips: [
      ...clips.filter((entry) => entry !== overhead),
      {
        ...forehand,
        name: "padel-serve",
        clip: { ...forehand.clip, name: "padel-serve" },
      },
      {
        ...overhead,
        name: "padel-smash",
        clip: { ...overhead.clip, name: "padel-smash" },
      },
    ],
  };
  const hips = vrm.humanoid.getNormalizedBoneNode("hips");
  const v = new THREE.Vector3();
  const hipY = hips.getWorldPosition(v).y;
  const rootY = vrm.scene.getWorldPosition(v).y;
  const reference = {
    position: hips.position.clone(),
    height: Math.abs(hipY - rootY) / (vrm.scene.getWorldScale(v).y || 1),
  };
  const restHipsY = hips.position.y;
  let sampledHipsY = restHipsY;
  const mixer = new THREE.AnimationMixer(vrm.scene);
  const actions = new Map();
  const timing = Object.fromEntries(
    padel.clips.map((entry) => [entry.name, entry])
  );
  function add(data, height, preservePlanar = false) {
    if (actions.has(`${data.name}:upper`)) return;
    for (const lower of [false, true]) {
      const clip = retarget(
        data,
        vrm,
        reference,
        height,
        lower,
        preservePlanar
      );
      const action = mixer.clipAction(clip);
      action.play().paused = true;
      action.setEffectiveWeight(0);
      actions.set(clip.name, { action, weight: 0, target: 0, lower });
    }
  }
  for (const clip of native) add(clip, SOURCE_HIPS_HEIGHT);
  for (const { clip } of padel.clips) add(clip, padel.sourceHipsHeight);
  let idleTime = 0,
    phase = 0,
    mode = "ready",
    selectedStroke = "forehand",
    strokeTime = 0,
    preparationAge = 0,
    preparationBlendAge = 1,
    manualStrokeCandidate = null,
    manualStrokeAge = 0,
    wasPreparing = false,
    wasActive = false,
    snap = true,
    disposed = false;
  function set(name, lower, weight, seconds, loop = false) {
    const entry = actions.get(`${name}:${lower ? "lower" : "upper"}`);
    if (!entry) return;
    entry.target = weight;
    const duration = entry.action.getClip().duration;
    entry.action.time = loop
      ? ((seconds % duration) + duration) % duration
      : clamp(seconds, 0, duration - 0.00001);
  }
  function reset() {
    if (disposed) return;
    mixer.stopAllAction();
    for (const entry of actions.values()) {
      entry.action.reset().stopFading().stopWarping().play();
      entry.action.paused = true;
      entry.action.setEffectiveWeight(0);
      entry.weight = entry.target = 0;
    }
    phase = idleTime = 0;
    strokeTime = preparationAge = 0;
    preparationBlendAge = 1;
    manualStrokeCandidate = null;
    manualStrokeAge = 0;
    selectedStroke = "forehand";
    wasPreparing = wasActive = false;
    sampledHipsY = hips.position.y;
    snap = true;
  }
  function sample(blend) {
    const sum = [0, 0];
    for (const entry of actions.values()) {
      entry.weight = lerp(entry.weight, entry.target, blend);
      if (entry.target === 0 && entry.weight < 0.0001) entry.weight = 0;
      sum[Number(entry.lower)] += entry.weight;
    }
    for (const entry of actions.values())
      entry.action.setEffectiveWeight(
        entry.weight / Math.max(0.0001, sum[Number(entry.lower)])
      );
    // Jump height belongs to the visitor controller. Restore the last clean
    // sample before the mixer so paused flight never accumulates correction.
    hips.position.y = sampledHipsY;
    mixer.update(0);
    sampledHipsY = hips.position.y;
  }
  return {
    get mode() {
      return mode;
    },
    reset,
    update(dt, player = {}, speed = 0, distance = 0) {
      if (disposed) return;
      dt = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.05);
      idleTime += dt;
      for (const entry of actions.values()) entry.target = 0;
      phase =
        (phase +
          Math.min(distance, 0.4) / lerp(1.5, 2.8, smooth(1.5, 6.5, speed))) %
        1;
      for (const entry of actions.values()) entry.target = 0;
      const moving = smooth(0.12, 0.7, speed);
      const walking = 1 - smooth(1.7, 3.6, speed);
      const sprint = smooth(5.2, 7.4, speed);
      const active = [
        "forehand",
        "backhand",
        "serve",
        "smash",
        "hit",
        "swing",
        "power",
      ].includes(player.action);
      const charge = clamp(Number(player.charge) || 0, 0, 1.6);
      const pendingSwing = Boolean(player.swingPending);
      const overheadApproach =
        !active &&
        player.preparedStroke === "smash" &&
        player.assistContact &&
        Number.isFinite(player.contactTimeToHit) &&
        player.contactTimeToHit >= 0 &&
        player.contactTimeToHit <= 0.4;
      const preparing = charge > 0.015 || pendingSwing || overheadApproach;
      // Latch the unit turn. Reclassifying forehand/backhand every frame as
      // the ball crosses the body used to blend two opposing backswings.
      const requestedStroke = active
        ? player.padelStroke || selectedStroke
        : player.preparedStroke || player.padelStroke || "forehand";
      const changedAtContact =
        active && !wasActive && requestedStroke !== selectedStroke;
      const beginningPreparation =
        preparing && !active && (!wasPreparing || wasActive);
      const acquiringOverhead =
        preparing &&
        !active &&
        requestedStroke === "smash" &&
        selectedStroke !== "smash" &&
        Number.isFinite(player.contactTimeToHit) &&
        player.contactTimeToHit > 0.12;
      // A deliberate run across the ball may require the other hand's windup.
      // Wait for a stable forecast and leave time to blend before commitment;
      // automatic adjustments and last-moment contact retain their stroke latch.
      const changingManualHand =
        preparing &&
        !active &&
        !pendingSwing &&
        player.manualPreparation &&
        requestedStroke !== selectedStroke &&
        ["forehand", "backhand"].includes(requestedStroke) &&
        ["forehand", "backhand"].includes(selectedStroke) &&
        Number.isFinite(player.contactTimeToHit) &&
        player.contactTimeToHit > 0.24;
      if (changingManualHand) {
        if (manualStrokeCandidate !== requestedStroke) {
          manualStrokeCandidate = requestedStroke;
          manualStrokeAge = 0;
        }
        manualStrokeAge += dt;
      } else {
        manualStrokeCandidate = null;
        manualStrokeAge = 0;
      }
      const acquiringManualHand = changingManualHand && manualStrokeAge >= 0.05;
      if (
        beginningPreparation ||
        acquiringOverhead ||
        acquiringManualHand ||
        (active && !wasActive)
      ) {
        const changed = requestedStroke !== selectedStroke;
        selectedStroke = requestedStroke;
        if (acquiringManualHand) {
          // Match the new capture's preparation phase instead of replaying its
          // opening stance beneath an already charged, moving upper body.
          const age = Number.isFinite(player.preparationTime)
            ? player.preparationTime
            : preparationAge;
          strokeTime =
            Math.max(0, timing[`padel-${selectedStroke}`].contact - 0.17) *
            smooth(0, 0.42, age);
        } else if (changed || beginningPreparation || !wasPreparing)
          // A smash uses the overhead windup, without replaying a tennis toss.
          strokeTime =
            selectedStroke === "smash"
              ? Math.max(0, timing["padel-smash"].contact - 0.62)
              : 0;
        if (acquiringOverhead || acquiringManualHand) preparationBlendAge = 0;
      }
      preparationBlendAge += dt;
      if (!preparing && !active) preparationAge = 0;
      else if (preparing) preparationAge += dt;
      const stroke = selectedStroke;
      const name = `padel-${
        stroke === "smash"
          ? "smash"
          : ["forehand", "backhand", "serve"].includes(stroke)
          ? stroke
          : "forehand"
      }`;
      const source = timing[name];
      const progress = clamp(Number(player.strokeProgress) || 0, 0, 1);
      const movement = courtMovement(
        Number(player.vx) || 0,
        Number(player.vz) || 0,
        Number(player.yaw) || 0
      );
      const forwardWeight =
        movement.speed > 0.01 ? movement.weights.forward : 1;
      // Forward running keeps the captured gait. Backward/lateral steps use a
      // stable padel upper body and world-space directional foot trajectories.
      const gaitPhase = phase;
      // Physical contact starts the follow-through. The charged preparation
      // samples the preceding backswing from the same capture, never a spike.
      const contactTime = source.contact;
      if (active && !wasActive && (!wasPreparing || changedAtContact))
        strokeTime = Math.max(strokeTime, contactTime - 0.12);
      const preparationTime = Number.isFinite(player.preparationTime)
        ? player.preparationTime
        : preparationAge;
      const contactIn = player.contactTimeToHit;
      const anticipation =
        Number.isFinite(contactIn) &&
        contactIn >= 0 &&
        (charge > 0.4 || pendingSwing || overheadApproach)
          ? 1 - smooth(0.04, 0.23, contactIn)
          : 0;
      const holdTime = Math.max(0, contactTime - 0.17);
      const desiredTime = active
        ? lerp(contactTime, source.clip.duration, progress)
        : lerp(
            stroke === "smash" ? Math.max(0, contactTime - 0.62) : 0,
            holdTime,
            smooth(0, stroke === "serve" ? 0.68 : 0.42, preparationTime)
          ) +
          anticipation * 0.135;
      // A continuous capture cursor preserves the forward swing on release.
      // Directly jumping to the contact frame omitted the fastest part of the
      // racket arc and produced a visible arm snap, especially on early hits.
      if (active || preparing) {
        const rate = active
          ? clamp((desiredTime - strokeTime) / 0.055, 1.15, 6)
          : stroke === "serve"
          ? 3.5
          : 2.4;
        strokeTime += clamp(desiredTime - strokeTime, -dt * rate, dt * rate);
      }
      const attackTime = strokeTime;
      const prepare = active
        ? 1
        : pendingSwing || overheadApproach
        ? smooth(0, 0.11, Math.max(preparationTime, preparationAge))
        : smooth(0.015, 0.18, charge);
      const finish = active ? 1 - smooth(0.7, 1, progress) : 1;
      const strokeWeight = prepare * finish;
      mode = active
        ? `${stroke}-followthrough`
        : preparing
        ? `${stroke}-prepare`
        : moving > 0.5
        ? "locomotion"
        : "ready";
      for (const lower of [false, true]) {
        // Captured arms and torso remain independent of moving legs. Standing
        // shots retain the original planted legs and weight transfer.
        const adjustment = Boolean(player.assistActive && preparing);
        // Short preparation steps are solved against planted feet below. A
        // forward run cycle here would slide sideways under a still torso.
        const locomotion = adjustment ? 0 : moving;
        const swing = strokeWeight * (lower ? 1 - locomotion * 0.92 : 1);
        const gait = locomotion * (1 - swing) * forwardWeight;
        const ready = 1 - swing - gait;
        set(
          "padel-ready",
          lower,
          ready,
          0.12 + Math.sin(idleTime * 1.8) * 0.08
        );
        set(
          "walk",
          lower,
          gait * walking,
          gaitPhase *
            actions.get(`walk:${lower ? "lower" : "upper"}`).action.getClip()
              .duration,
          true
        );
        set(
          "run",
          lower,
          gait * (1 - walking) * (1 - sprint),
          gaitPhase *
            actions.get(`run:${lower ? "lower" : "upper"}`).action.getClip()
              .duration,
          true
        );
        set(
          "sprint",
          lower,
          gait * (1 - walking) * sprint,
          gaitPhase *
            actions.get(`sprint:${lower ? "lower" : "upper"}`).action.getClip()
              .duration,
          true
        );
        set(name, lower, swing, attackTime);
      }
      const blend = snap
        ? 1
        : 1 -
          Math.exp(-dt * (preparationBlendAge < 0.18 ? 12 : active ? 35 : 18));
      wasPreparing = preparing;
      wasActive = active;
      snap = false;
      sample(blend);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      mixer.stopAllAction();
      mixer.uncacheRoot(vrm.scene);
    },
  };
}

/**
 * Small, alternating adjustment steps in world space. Apply after saving the
 * mixer pose and restore that pose before the next update: this layer never
 * changes the physics root or feeds its IK corrections back into the capture.
 */
export function createPadelFootwork(vrm) {
  const legs = ["left", "right"].map((side) => ({
    thigh: vrm.humanoid.getNormalizedBoneNode(`${side}UpperLeg`),
    shin: vrm.humanoid.getNormalizedBoneNode(`${side}LowerLeg`),
    foot: vrm.humanoid.getNormalizedBoneNode(`${side}Foot`),
    anchor: new THREE.Vector3(),
    from: new THREE.Vector3(),
    to: new THREE.Vector3(),
    orientation: new THREE.Quaternion(),
  }));
  const supported = legs.every(
    ({ thigh, shin, foot }) => thigh && shin && foot
  );
  const hip = new THREE.Vector3(),
    knee = new THREE.Vector3(),
    foot = new THREE.Vector3();
  const axis = new THREE.Vector3(),
    pole = new THREE.Vector3(),
    desiredKnee = new THREE.Vector3();
  const target = new THREE.Vector3(),
    direction = new THREE.Vector3(),
    current = new THREE.Vector3();
  const rotation = new THREE.Quaternion(),
    parentRotation = new THREE.Quaternion();
  let active = false,
    weight = 0,
    stepping = 0,
    stepTime = 0,
    duration = 0.24,
    stepHeight = 0.04;

  function orient(bone, endpoint, desired) {
    bone.getWorldPosition(hip);
    endpoint.getWorldPosition(current).sub(hip).normalize();
    direction.copy(desired).sub(hip).normalize();
    rotation.setFromUnitVectors(current, direction);
    bone.getWorldQuaternion(parentRotation);
    rotation.multiply(parentRotation);
    bone.parent.getWorldQuaternion(parentRotation).invert();
    bone.quaternion.copy(parentRotation).multiply(rotation);
    bone.updateWorldMatrix(false, true);
  }
  function solve(leg, desired) {
    leg.thigh.getWorldPosition(hip);
    leg.shin.getWorldPosition(knee);
    leg.foot.getWorldPosition(foot);
    const upper = hip.distanceTo(knee),
      lower = knee.distanceTo(foot);
    if (upper < 0.001 || lower < 0.001) return;
    target.copy(foot).lerp(desired, weight);
    axis.copy(target).sub(hip);
    const distance = clamp(
      axis.length(),
      Math.abs(upper - lower) + 0.001,
      (upper + lower) * 0.995
    );
    axis.normalize();
    target.copy(hip).addScaledVector(axis, distance);
    pole.copy(knee).sub(hip).addScaledVector(axis, -pole.dot(axis));
    if (pole.lengthSq() < 0.00001)
      pole.set(0, 0, 1).addScaledVector(axis, -axis.z);
    pole.normalize();
    const along =
      (upper * upper - lower * lower + distance * distance) / (2 * distance);
    desiredKnee
      .copy(hip)
      .addScaledVector(axis, along)
      .addScaledVector(
        pole,
        Math.sqrt(Math.max(0, upper * upper - along * along))
      );
    orient(leg.thigh, leg.shin, desiredKnee);
    orient(leg.shin, leg.foot, target);
    leg.foot.parent.getWorldQuaternion(parentRotation).invert();
    rotation.copy(parentRotation).multiply(leg.orientation);
    leg.foot.quaternion.slerp(rotation, weight);
    leg.foot.updateWorldMatrix(false, true);
  }
  return {
    reset() {
      active = false;
      weight = stepTime = 0;
    },
    update(dt, player = {}) {
      if (!supported) return;
      dt = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.05);
      if (dt === 0) {
        if (active) {
          vrm.scene.updateWorldMatrix(true, true);
          for (const leg of legs) solve(leg, leg.anchor);
        }
        return;
      }
      const preparing =
        Number(player.charge) > 0.015 || Boolean(player.swingPending);
      const adjusting = Boolean(player.assistActive && preparing);
      vrm.scene.updateWorldMatrix(true, true);
      if (adjusting && !active) {
        active = true;
        stepping = player.vx > 0 ? 1 : 0;
        stepTime = 0;
        for (const leg of legs) {
          leg.foot.getWorldPosition(leg.anchor);
          leg.from.copy(leg.anchor);
          leg.to.copy(leg.anchor);
          leg.foot.getWorldQuaternion(leg.orientation);
        }
      }
      const desiredWeight = active && preparing ? 1 : 0;
      weight = lerp(
        weight,
        desiredWeight,
        1 - Math.exp(-dt * (adjusting ? 22 : 16))
      );
      if (weight < 0.002 && !adjusting) {
        weight = 0;
        active = false;
        return;
      }
      if (!active) return;
      // Complete an airborne foot's last step even if the root arrives before
      // the step cycle ends. Holding charge must never leave one foot hovering.
      if (adjusting || stepTime > 0) {
        const speed = Math.hypot(player.vx || 0, player.vz || 0);
        const leg = legs[stepping];
        if (stepTime === 0) {
          duration = lerp(0.31, 0.19, smooth(0.15, 2.6, speed));
          stepHeight = lerp(0.025, 0.07, smooth(0.15, 2.6, speed));
          leg.from.copy(leg.anchor);
          // Predict only the next small step; never pull a foot across the
          // entire assist path. The other foot stays at its ground anchor.
          leg.foot.getWorldPosition(leg.to);
          leg.to.x += (player.vx || 0) * duration * 0.7;
          leg.to.z += (player.vz || 0) * duration * 0.7;
          leg.to.y = leg.anchor.y;
          direction.copy(leg.to).sub(leg.from);
          if (direction.length() > 0.52)
            leg.to.copy(leg.from).addScaledVector(direction.normalize(), 0.52);
        }
        stepTime += dt;
        const phase = clamp(stepTime / duration, 0, 1);
        leg.anchor.copy(leg.from).lerp(leg.to, smooth(0, 1, phase));
        leg.anchor.y += Math.sin(phase * Math.PI) * stepHeight;
        if (phase === 1) {
          leg.anchor.copy(leg.to);
          stepping = 1 - stepping;
          stepTime = 0;
        }
      }
      for (const leg of legs) solve(leg, leg.anchor);
    },
  };
}

/** Bounded reach around the captured swing; never translates the player root. */
export function createPadelReach(vrm) {
  const torso = ["spine", "chest"].map((name) =>
    vrm.humanoid.getNormalizedBoneNode(name)
  );
  const arms = ["right", "left"].map((side) => ({
    upper: vrm.humanoid.getNormalizedBoneNode(`${side}UpperArm`),
    lower: vrm.humanoid.getNormalizedBoneNode(`${side}LowerArm`),
    hand: vrm.humanoid.getNormalizedBoneNode(`${side}Hand`),
  }));
  const origin = new THREE.Vector3(),
    elbow = new THREE.Vector3(),
    wrist = new THREE.Vector3();
  const target = new THREE.Vector3(),
    axis = new THREE.Vector3(),
    pole = new THREE.Vector3();
  const elbowTarget = new THREE.Vector3(),
    direction = new THREE.Vector3(),
    current = new THREE.Vector3();
  const leanAxis = new THREE.Vector3(),
    armDirection = new THREE.Vector3();
  const quaternion = new THREE.Quaternion(),
    parent = new THREE.Quaternion(),
    wristRotation = new THREE.Quaternion();
  let amount = 0;
  function rotateWorld(bone, rotation) {
    bone.getWorldQuaternion(quaternion).premultiply(rotation);
    bone.parent.getWorldQuaternion(parent).invert();
    bone.quaternion.copy(parent).multiply(quaternion);
    bone.updateWorldMatrix(false, true);
  }
  const change = new THREE.Quaternion();
  function aimBone(bone, child, endpoint) {
    bone.getWorldPosition(origin);
    child.getWorldPosition(current).sub(origin).normalize();
    direction.copy(endpoint).sub(origin).normalize();
    change.setFromUnitVectors(current, direction);
    rotateWorld(bone, change);
  }
  return {
    reset() {
      amount = 0;
      leanAxis.set(0, 0, 0);
      armDirection.set(0, 0, 0);
    },
    update(dt, player = {}) {
      dt = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.05);
      const active =
        Boolean(player.swingPending) ||
        ["forehand", "backhand", "smash", "hit", "swing", "power"].includes(
          player.action
        );
      const reaching =
        active && ["reach", "stretch"].includes(player.contactKind);
      const quality = Number.isFinite(player.contactQuality)
        ? player.contactQuality
        : player.contactKind === "stretch"
        ? 0.62
        : 0.82;
      const recovery = player.swingPending
        ? 0.65
        : 1 - smooth(0.22, 0.82, Number(player.strokeProgress) || 0);
      const desired = reaching
        ? clamp((1 - quality) / 0.38, 0.4, 1) * recovery
        : 0;
      amount = lerp(
        amount,
        desired,
        1 - Math.exp(-dt * (desired > amount ? 24 : 13))
      );
      const point = player.contactPoint || player.assistContact;
      if (point && reaching) {
        const dx = point.x - (player.x || 0),
          dz = point.z - (player.z || 0);
        const planar = Math.hypot(dx, dz);
        if (planar > 0.001) {
          // World-space rotations work on both VRM0 and VRM1 normalized bases.
          leanAxis.set(dz / planar, 0, -dx / planar);
          armDirection
            .set(
              dx / planar,
              clamp(((point.y || 1) - 1.1) * 0.25, -0.2, 0.25),
              dz / planar
            )
            .normalize();
        }
      }
      if (amount < 0.0001 || leanAxis.lengthSq() < 0.5) return;
      vrm.scene.updateWorldMatrix(true, true);
      for (const [i, node] of torso.entries()) {
        if (!node) continue;
        change.setFromAxisAngle(leanAxis, amount * (i ? 0.065 : 0.045));
        rotateWorld(node, change);
      }
      // Move both hands together on the captured two-handed backhand.
      const twoHanded =
        (player.padelStroke || player.preparedStroke) === "backhand";
      for (const [i, { upper, lower, hand }] of arms.entries()) {
        if ((i && !twoHanded) || !upper || !lower || !hand) continue;
        upper.getWorldPosition(origin);
        lower.getWorldPosition(elbow);
        hand.getWorldPosition(wrist);
        hand.getWorldQuaternion(wristRotation);
        const a = origin.distanceTo(elbow),
          b = elbow.distanceTo(wrist);
        if (a < 0.001 || b < 0.001) continue;
        target.copy(wrist).addScaledVector(armDirection, amount * 0.12);
        axis.copy(target).sub(origin);
        // A nearly straight captured elbow must not suddenly bend just because
        // a tiny reach correction fades in. Preserve its existing extension.
        const extension = Math.max(origin.distanceTo(wrist), (a + b) * 0.985);
        const distance = clamp(
          axis.length(),
          Math.abs(a - b) + 0.001,
          extension
        );
        axis.normalize();
        target.copy(origin).addScaledVector(axis, distance);
        pole.copy(elbow).sub(origin).addScaledVector(axis, -pole.dot(axis));
        if (pole.lengthSq() < 0.00001) continue;
        pole.normalize();
        const along = (a * a - b * b + distance * distance) / (2 * distance);
        elbowTarget
          .copy(origin)
          .addScaledVector(axis, along)
          .addScaledVector(pole, Math.sqrt(Math.max(0, a * a - along * along)));
        aimBone(upper, lower, elbowTarget);
        aimBone(lower, hand, target);
        hand.parent.getWorldQuaternion(parent).invert();
        hand.quaternion.copy(parent).multiply(wristRotation);
        hand.updateWorldMatrix(false, true);
      }
    },
  };
}
