import * as THREE from "three";

const clamp = THREE.MathUtils.clamp;
const smooth = (a, b, n) => THREE.MathUtils.smoothstep(n, a, b);

/** Match the short paddle to a real overhead contact. The actor/physics root and
 * bone lengths never move: a bounded body hop and two arm rotations supply reach.
 * Restore the mixer pose and body.position.y before each sample. */
export function createPadelOverhead(vrm, body, legacy = false) {
  const bone = (name) => vrm.humanoid.getNormalizedBoneNode(name);
  const upper = bone("rightUpperArm"),
    lower = bone("rightLowerArm"),
    hand = bone("rightHand");
  const shoulder = new THREE.Vector3(),
    elbow = new THREE.Vector3(),
    wrist = new THREE.Vector3();
  const contact = new THREE.Vector3(),
    target = new THREE.Vector3(),
    elbowTarget = new THREE.Vector3();
  const axis = new THREE.Vector3(),
    pole = new THREE.Vector3(),
    from = new THREE.Vector3(),
    to = new THREE.Vector3();
  const point = new THREE.Vector3(),
    faceAxis = new THREE.Vector3(),
    paddleAxis = new THREE.Vector3(legacy ? 1 : -1, 0, 0);
  const q = new THREE.Quaternion(),
    world = new THREE.Quaternion(),
    parent = new THREE.Quaternion(),
    grip = new THREE.Quaternion();
  let correction = 0,
    lift = 0,
    previousProgress = 1;
  function aim(node, child, endpoint) {
    node.getWorldPosition(point);
    child.getWorldPosition(from).sub(point).normalize();
    to.copy(endpoint).sub(point).normalize();
    q.setFromUnitVectors(from, to);
    node.getWorldQuaternion(world).premultiply(q);
    node.parent.getWorldQuaternion(parent).invert();
    node.quaternion.copy(parent).multiply(world);
    node.updateWorldMatrix(false, true);
  }
  return {
    reset() {
      correction = lift = 0;
      previousProgress = 1;
    },
    get lift() {
      return lift;
    },
    update(dt, player = {}) {
      if (!upper || !lower || !hand) return;
      dt = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.05);
      const stroke =
        player.action === "smash"
          ? player.padelStroke
          : player.preparedStroke || player.padelStroke;
      const active = player.action === "smash";
      const preparing =
        !active &&
        stroke === "smash" &&
        (player.swingPending ||
          player.charge > 0.015 ||
          (player.assistContact &&
            Number.isFinite(player.contactTimeToHit) &&
            player.contactTimeToHit <= 0.4));
      const source = active ? player.contactPoint : player.assistContact;
      const valid =
        (active || preparing) &&
        source &&
        [source.x, source.y, source.z].every(Number.isFinite) &&
        source.y > 1.9;
      const progress = clamp(player.strokeProgress || 0, 0, 1);
      const time = Number.isFinite(player.contactTimeToHit)
        ? Math.max(0, player.contactTimeToHit)
        : 0.4;
      const anticipation = preparing ? 1 - smooth(0.025, 0.34, time) : 0;
      const desired = valid
        ? active
          ? 1 - smooth(0.04, 0.46, progress)
          : anticipation
        : 0;
      // The pre-contact correction reaches its target before launch; late NPC
      // contacts blend in instead of translating a body instantaneously.
      const firstContact = active && progress < previousProgress;
      correction +=
        (desired - correction) * (dt === 0 ? 0 : 1 - Math.exp(-dt * 28));
      if (
        dt > 0 &&
        valid &&
        active &&
        !firstContact &&
        progress < 0.08 &&
        correction > 0.9
      )
        correction = 1;
      previousProgress = active ? progress : 1;
      vrm.scene.updateWorldMatrix(true, true);
      upper.getWorldPosition(shoulder);
      lower.getWorldPosition(elbow);
      hand.getWorldPosition(wrist);
      const a = shoulder.distanceTo(elbow),
        b = elbow.distanceTo(wrist);
      if (a < 0.001 || b < 0.001) return;
      let wantedLift = 0;
      if (valid) {
        contact.set(source.x, source.y, source.z);
        const planar = Math.hypot(
          contact.x - shoulder.x,
          contact.z - shoulder.z
        );
        const reach = (a + b) * 0.975 + 0.29;
        const vertical = Math.sqrt(
          Math.max(0.08, reach * reach - Math.min(planar, reach * 0.88) ** 2)
        );
        const needed = clamp(contact.y - shoulder.y - vertical + 0.035, 0, 0.9);
        const flight = active ? 1 - smooth(0, 0.82, progress) : anticipation;
        wantedLift = needed * flight;
      }
      // A stale/aborted request lands smoothly and leaves every non-smash pose
      // untouched once recovery finishes. No extra travel/visitor lift is used.
      const rate = wantedLift > lift ? 28 : 15;
      lift += (wantedLift - lift) * (dt === 0 ? 0 : 1 - Math.exp(-dt * rate));
      if (lift < 0.0001) lift = 0;
      body.position.y += lift;
      vrm.scene.updateWorldMatrix(true, true);
      if (!valid || correction < 0.0001) return;
      upper.getWorldPosition(shoulder);
      lower.getWorldPosition(elbow);
      hand.getWorldPosition(wrist);
      // Aim the paddle's actual 29cm head offset toward the contact, keeping a
      // little forward cant. This works in either VRM normalized handedness.
      faceAxis.copy(contact).sub(shoulder).normalize();
      hand.getWorldQuaternion(grip);
      from.copy(paddleAxis).applyQuaternion(grip);
      q.setFromUnitVectors(from, faceAxis);
      world.copy(grip).premultiply(q);
      grip.slerp(world, correction);
      const follow = active ? smooth(0, 0.46, progress) : 0;
      target.copy(contact);
      target.y -= follow * 0.36;
      target.x += Math.sin(player.yaw || 0) * follow * 0.15;
      target.z += Math.cos(player.yaw || 0) * follow * 0.15;
      from.copy(paddleAxis).applyQuaternion(grip).multiplyScalar(0.29);
      target.sub(from);
      target.lerpVectors(wrist, target, correction);
      axis.copy(target).sub(shoulder);
      const distance = clamp(
        axis.length(),
        Math.abs(a - b) + 0.001,
        (a + b) * 0.985
      );
      axis.normalize();
      target.copy(shoulder).addScaledVector(axis, distance);
      pole.copy(elbow).sub(shoulder);
      pole.addScaledVector(axis, -pole.dot(axis));
      if (pole.lengthSq() < 0.00001)
        pole.set(Math.cos(player.yaw || 0), 0, -Math.sin(player.yaw || 0));
      pole.normalize();
      const along = (a * a - b * b + distance * distance) / (2 * distance);
      elbowTarget
        .copy(shoulder)
        .addScaledVector(axis, along)
        .addScaledVector(pole, Math.sqrt(Math.max(0, a * a - along * along)));
      aim(upper, lower, elbowTarget);
      aim(lower, hand, target);
      hand.parent.getWorldQuaternion(parent).invert();
      hand.quaternion.copy(parent).multiply(grip);
      hand.updateWorldMatrix(false, true);
    },
  };
}
