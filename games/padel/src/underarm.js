import * as THREE from "three";

/** Retain captured footwork while constraining the serving hand to an underarm
 * arc. All changes are rotations: bone lengths and the simulation root stay fixed. */
export function createPadelUnderarm(vrm) {
  const bone = (name) => vrm.humanoid.getNormalizedBoneNode(name);
  const upper = bone("rightUpperArm"),
    lower = bone("rightLowerArm"),
    hand = bone("rightHand");
  const shoulder = new THREE.Vector3(),
    elbow = new THREE.Vector3(),
    wrist = new THREE.Vector3();
  const target = new THREE.Vector3(),
    elbowTarget = new THREE.Vector3(),
    axis = new THREE.Vector3(),
    pole = new THREE.Vector3();
  const from = new THREE.Vector3(),
    to = new THREE.Vector3(),
    at = new THREE.Vector3();
  const q = new THREE.Quaternion(),
    world = new THREE.Quaternion(),
    parent = new THREE.Quaternion();
  function aim(node, child, point) {
    node.getWorldPosition(at);
    child.getWorldPosition(from).sub(at).normalize();
    to.copy(point).sub(at).normalize();
    q.setFromUnitVectors(from, to);
    node.getWorldQuaternion(world).premultiply(q);
    node.parent.getWorldQuaternion(parent).invert();
    node.quaternion.copy(parent).multiply(world);
    node.updateWorldMatrix(false, true);
  }
  return {
    update(player = {}) {
      if (
        !upper ||
        !lower ||
        !hand ||
        (player.padelStroke || player.preparedStroke) !== "serve"
      )
        return;
      if (
        player.action !== "serve" &&
        !player.swingPending &&
        !(player.charge > 0.015)
      )
        return;
      vrm.scene.updateWorldMatrix(true, true);
      upper.getWorldPosition(shoulder);
      lower.getWorldPosition(elbow);
      hand.getWorldPosition(wrist);
      const a = shoulder.distanceTo(elbow),
        b = elbow.distanceTo(wrist);
      if (a < 0.001 || b < 0.001) return;
      const progress =
        player.action === "serve"
          ? THREE.MathUtils.clamp(player.strokeProgress || 0, 0, 1)
          : 0;
      const travel = Math.sin(progress * Math.PI * 0.75);
      const yaw = player.yaw || 0;
      target
        .copy(shoulder)
        .add(
          new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(
            -0.12 + travel * 0.43
          )
        );
      target.y -= (a + b) * (0.84 - travel * 0.19);
      axis.copy(target).sub(shoulder);
      const distance = THREE.MathUtils.clamp(
        axis.length(),
        Math.abs(a - b) + 0.001,
        (a + b) * 0.98
      );
      axis.normalize();
      target.copy(shoulder).addScaledVector(axis, distance);
      pole.copy(elbow).sub(shoulder);
      pole.addScaledVector(axis, -pole.dot(axis));
      if (pole.lengthSq() < 0.00001) pole.set(Math.cos(yaw), 0, -Math.sin(yaw));
      pole.normalize();
      const along = (a * a - b * b + distance * distance) / (2 * distance);
      elbowTarget
        .copy(shoulder)
        .addScaledVector(axis, along)
        .addScaledVector(pole, Math.sqrt(Math.max(0, a * a - along * along)));
      aim(upper, lower, elbowTarget);
      aim(lower, hand, target);
    },
  };
}
