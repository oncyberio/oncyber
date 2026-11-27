import * as THREE from "three";

const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const smooth = (a, b, n) => THREE.MathUtils.smoothstep(n, a, b);

/** Camera-independent movement relative to the side of the court we face. */
export function courtMovement(vx = 0, vz = 0, yaw = 0) {
  const speed = Math.hypot(vx, vz);
  const lateral =
    speed > 0.0001 ? (vx * Math.cos(yaw) - vz * Math.sin(yaw)) / speed : 0;
  const forward =
    speed > 0.0001 ? (vx * Math.sin(yaw) + vz * Math.cos(yaw)) / speed : 0;
  const total = Math.abs(lateral) + Math.abs(forward) || 1;
  return {
    speed,
    lateral,
    forward,
    weights: {
      forward: Math.max(0, forward) / total,
      back: Math.max(0, -forward) / total,
      left: Math.max(0, -lateral) / total,
      right: Math.max(0, lateral) / total,
    },
    facing:
      lateral * lerp(0.28, 0.42, Math.max(0, forward)) * smooth(0.15, 2, speed),
  };
}

/** A view setting, not an animation change: hidden bones continue to update. */
export function createLocalViewVisibility(body) {
  let firstPerson = false,
    previousVisibility = body.visible;
  return {
    set(value) {
      value = Boolean(value);
      if (value === firstPerson) return;
      if (value) {
        previousVisibility = body.visible;
        body.visible = false;
      } else body.visible = previousVisibility;
      firstPerson = value;
    },
    get active() {
      return firstPerson;
    },
  };
}

/** Reframe the animated racket as a first-person foreground object. A constant
 * grip cant reveals the string bed while preserving every relative swing.
 */
export function createRacketPresentation(mount, legacy = false) {
  const naturalScale = mount.scale.clone();
  const naturalPosition = mount.position.clone();
  const naturalRotation = mount.quaternion.clone();
  const handedness = legacy ? 1 : -1;
  const gripCant = new THREE.Quaternion().setFromEuler(
    new THREE.Euler((handedness * Math.PI) / 3, (handedness * Math.PI) / 6, 0)
  );
  let presented = false;
  const center = new THREE.Vector3(),
    natural = new THREE.Vector3(),
    next = new THREE.Vector3();
  return {
    restore() {
      if (presented) {
        mount.position.copy(naturalPosition);
        mount.quaternion.copy(naturalRotation);
      }
      mount.scale.copy(naturalScale);
      presented = false;
    },
    update(firstPerson) {
      naturalPosition.copy(mount.position);
      naturalRotation.copy(mount.quaternion);
      presented = Boolean(firstPerson);
      mount.scale.copy(naturalScale);
      if (!firstPerson) return;
      // Post-multiplying the same local cant keeps Q2*inverse(Q1), the
      // captured world-space change through the swing, exactly unchanged.
      mount.quaternion.multiply(gripCant);
      mount.scale.multiplyScalar(0.78);
      center
        .set(legacy ? 0.485 : -0.485, 0, 0)
        .multiply(mount.scale)
        .applyQuaternion(mount.quaternion);
      natural.copy(center).add(mount.position);
      // Compress translation toward the lower edge while retaining the swing
      // arc and every captured wrist rotation. These are actor-local metres.
      next.set(
        clamp(natural.x * 0.55, -0.42, 0.42),
        clamp(natural.y + 0.28, 1.02, 1.22),
        clamp(natural.z + 0.85, 0.98, 1.4)
      );
      mount.position.add(next.sub(natural));
    },
  };
}

/**
 * Court-facing running, backpedaling and shuffling with world-space stance
 * anchors. Restore the mixer pose before each update; all corrections stay in
 * the leg joints. The actor root is owned exclusively by the simulation.
 */
export function createCourtLocomotion(vrm, actor) {
  actor.updateWorldMatrix(true, true);
  const actorInverse = actor.matrixWorld.clone().invert();
  const actorRotation = actor.getWorldQuaternion(new THREE.Quaternion());
  const pelvis = vrm.humanoid.getNormalizedBoneNode("hips");
  const pelvisScale = new THREE.Vector3();
  function bindBasis(bone, child) {
    if (!bone || !child) return null;
    const down = child.position.clone().normalize();
    const forward = actor
      .getWorldDirection(new THREE.Vector3())
      .applyQuaternion(
        bone.getWorldQuaternion(new THREE.Quaternion()).invert()
      );
    forward.addScaledVector(down, -forward.dot(down)).normalize();
    const across = new THREE.Vector3().crossVectors(down, forward).normalize();
    forward.crossVectors(across, down).normalize();
    return new THREE.Quaternion()
      .setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(across, down, forward)
      )
      .invert();
  }
  const legs = ["left", "right"].map((side) => {
    const thigh = vrm.humanoid.getNormalizedBoneNode(`${side}UpperLeg`);
    const shin = vrm.humanoid.getNormalizedBoneNode(`${side}LowerLeg`);
    const foot = vrm.humanoid.getNormalizedBoneNode(`${side}Foot`);
    return {
      thigh,
      shin,
      foot,
      upperBasis: bindBasis(thigh, shin),
      lowerBasis: bindBasis(shin, foot),
      offset: foot
        ?.getWorldPosition(new THREE.Vector3())
        .applyMatrix4(actorInverse),
      rotation: foot
        ?.getWorldQuaternion(new THREE.Quaternion())
        .premultiply(actorRotation.clone().invert()),
      anchor: new THREE.Vector3(),
      start: new THREE.Vector3(),
      end: new THREE.Vector3(),
      target: new THREE.Vector3(),
      stance: true,
      pose: null,
    };
  });
  const supported = legs.every((leg) => leg.thigh && leg.shin && leg.foot);
  const hip = new THREE.Vector3(),
    knee = new THREE.Vector3(),
    foot = new THREE.Vector3();
  const axis = new THREE.Vector3(),
    pole = new THREE.Vector3(),
    kneeTarget = new THREE.Vector3();
  const desired = new THREE.Vector3(),
    direction = new THREE.Vector3();
  const velocity = new THREE.Vector3(),
    predicted = new THREE.Vector3();
  const rotation = new THREE.Quaternion(),
    parent = new THREE.Quaternion(),
    worldFoot = new THREE.Quaternion(),
    capturedThigh = new THREE.Quaternion(),
    capturedShin = new THREE.Quaternion();
  const across = new THREE.Vector3(),
    forward = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  let active = false,
    weight = 0,
    phase = 0,
    groundOffset = 0;
  function turn(bone, target, inverseBindBasis) {
    bone.getWorldPosition(hip);
    direction.copy(target).sub(hip).normalize();
    actor.getWorldDirection(forward);
    forward.addScaledVector(direction, -forward.dot(direction)).normalize();
    across.crossVectors(direction, forward).normalize();
    forward.crossVectors(across, direction).normalize();
    rotation
      .setFromRotationMatrix(basis.makeBasis(across, direction, forward))
      .multiply(inverseBindBasis);
    bone.parent.getWorldQuaternion(parent).invert();
    bone.quaternion.copy(parent).multiply(rotation);
    bone.updateWorldMatrix(false, true);
  }
  function solve(leg) {
    capturedThigh.copy(leg.thigh.quaternion);
    capturedShin.copy(leg.shin.quaternion);
    leg.thigh.getWorldPosition(hip);
    leg.shin.getWorldPosition(knee);
    leg.foot.getWorldPosition(foot);
    const a = hip.distanceTo(knee),
      b = knee.distanceTo(foot);
    if (a < 0.001 || b < 0.001) return;
    desired.copy(foot).lerp(leg.target, weight);
    axis.copy(desired).sub(hip);
    const length = clamp(
      axis.length(),
      Math.abs(a - b) + 0.001,
      (a + b) * 0.995
    );
    axis.normalize();
    desired.copy(hip).addScaledVector(axis, length);
    // Keep the knee's bend plane facing the court. Borrowing the instantaneous
    // captured knee as a pole can flip 180 degrees when that leg straightens.
    actor.getWorldDirection(pole);
    pole.addScaledVector(axis, -pole.dot(axis));
    pole.normalize();
    const along = (a * a - b * b + length * length) / (2 * length);
    kneeTarget
      .copy(hip)
      .addScaledVector(axis, along)
      .addScaledVector(pole, Math.sqrt(Math.max(0, a * a - along * along)));
    turn(leg.thigh, kneeTarget, leg.upperBasis);
    turn(leg.shin, desired, leg.lowerBasis);
    // Fade the entire joint correction, including twist, back into the capture.
    // Blending ankle positions alone leaves a final orientation pop at rest.
    rotation.copy(leg.thigh.quaternion);
    leg.thigh.quaternion.copy(capturedThigh).slerp(rotation, weight);
    rotation.copy(leg.shin.quaternion);
    leg.shin.quaternion.copy(capturedShin).slerp(rotation, weight);
    leg.thigh.updateWorldMatrix(false, true);
    actor.getWorldQuaternion(worldFoot).multiply(leg.rotation);
    leg.foot.parent.getWorldQuaternion(parent).invert();
    worldFoot.premultiply(parent);
    leg.foot.quaternion.slerp(worldFoot, weight);
    leg.foot.updateWorldMatrix(false, true);
  }
  return {
    get state() {
      return { active, weight, phase, stance: legs.map((leg) => leg.stance) };
    },
    reset() {
      active = false;
      weight = phase = 0;
      velocity.set(0, 0, 0);
    },
    update(dt, player = {}, speed = 0) {
      if (!supported) return;
      dt = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.05);
      const preparing = player.charge > 0.015 || Boolean(player.swingPending);
      const moving = !preparing && !player.assistActive && speed > 0.15;
      actor.updateWorldMatrix(true, true);
      if (dt > 0) {
        // Simulation velocity is already accelerated; filtering it again makes
        // the landing step trail behind the player during direction changes.
        velocity.x = Number(player.vx) || 0;
        velocity.z = Number(player.vz) || 0;
        if (moving && !active) {
          active = true;
          phase = velocity.x > 0 ? 0 : 0.5;
          for (const leg of legs) {
            leg.foot.getWorldPosition(leg.anchor);
            leg.target.copy(leg.anchor);
            leg.start.copy(leg.anchor);
            leg.end.copy(leg.anchor);
            leg.stance = true;
            leg.pose = [leg.thigh, leg.shin, leg.foot].map((node) =>
              node.quaternion.clone().normalize()
            );
          }
          groundOffset = Math.min(
            ...legs.map((leg) => leg.anchor.y - actor.position.y)
          );
        }
        weight = lerp(
          weight,
          moving ? 1 : 0,
          1 - Math.exp(-dt * (moving ? 28 : 22))
        );
        if (weight < 0.002 && !moving) {
          active = false;
          weight = 0;
        }
        if (active) {
          // Cadence follows actual travel, not the smoothed landing direction:
          // slowing the feet during a reversal makes the planted leg drag.
          const travel = Math.hypot(
            Number(player.vx) || 0,
            Number(player.vz) || 0
          );
          const stride = lerp(0.72, 1.75, smooth(0.2, 6.5, travel));
          const cycle = stride / Math.max(0.2, travel);
          const stanceFraction = 0.4;
          if (moving) phase = (phase + (travel * dt) / stride) % 1;
          for (const [i, leg] of legs.entries()) {
            const legPhase = (phase + i * 0.5) % 1;
            const stance = legPhase < stanceFraction;
            if (moving && !stance) {
              const swing = (legPhase - stanceFraction) / (1 - stanceFraction);
              if (leg.stance) leg.start.copy(leg.anchor);
              predicted.copy(leg.offset).applyMatrix4(actor.matrixWorld);
              predicted.addScaledVector(
                velocity,
                cycle * (1 - legPhase + stanceFraction * 0.5)
              );
              predicted.y = actor.position.y + groundOffset;
              if (leg.stance) leg.end.copy(predicted);
              else leg.end.lerp(predicted, 1 - Math.exp(-dt * 16));
              leg.target.copy(leg.start).lerp(leg.end, smooth(0, 1, swing));
              leg.target.y =
                actor.position.y +
                groundOffset +
                Math.sin(swing * Math.PI) ** 2 *
                  lerp(0.04, 0.09, smooth(0.2, 6.5, travel));
              leg.anchor.copy(leg.target);
            } else if (moving && stance) {
              if (!leg.stance) {
                leg.anchor.copy(leg.end);
                leg.anchor.y = actor.position.y + groundOffset;
              }
              leg.target.copy(leg.anchor);
            }
            leg.stance = stance;
          }
        }
      }
      if (active) {
        // An athletic knee bend gives the short avatar enough extension for
        // a planted stance without dragging an almost straight leg behind it.
        if (pelvis) {
          pelvis.parent.getWorldScale(pelvisScale);
          pelvis.position.y -= (0.065 * weight) / Math.max(0.01, pelvisScale.y);
          pelvis.updateWorldMatrix(false, true);
        }
        for (const leg of legs) {
          solve(leg);
          // A step can move rapidly near full knee extension. Limit that joint
          // acceleration instead of allowing a visible one-frame leg snap.
          [leg.thigh, leg.shin, leg.foot].forEach((node, i) => {
            if (!leg.pose) return;
            if (dt > 0) leg.pose[i].rotateTowards(node.quaternion, dt * 18);
            node.quaternion.copy(leg.pose[i]);
          });
          leg.thigh.updateWorldMatrix(false, true);
        }
      }
    },
  };
}
