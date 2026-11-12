import type * as THREE from "three";
type MathLibrary = Pick<typeof THREE, "Quaternion" | "Vector3">;

/** Short lived, velocity-aware offsets over the newly sampled pose. Detailed rigs
 * only: no second outgoing clip evaluation, per-frame allocation or crowd bones.
 */
export function createMotionInertia(
    math: MathLibrary,
    nodes: THREE.Object3D[],
    hips?: THREE.Object3D
) {
    const q = () => new math.Quaternion(),
        v = () => new math.Vector3();
    const tracks = nodes.map((node) => ({
        node,
        base: q(),
        previous: node.quaternion.clone(),
        target: q(),
        velocity: v(),
        targetVelocity: v(),
        offset: v(),
        rate: v(),
    }));
    const delta = q(),
        inverse = q(),
        rotation = q();
    const vector = v(),
        correction = v();
    const basePosition = v(),
        previousPosition = hips?.position.clone() || v(),
        positionVelocity = v(),
        positionOffset = v(),
        positionRate = v();
    let key = "",
        initialized = false,
        applied = false,
        elapsed = 1;
    const decay = 32;
    function log(out: THREE.Vector3, a: THREE.Quaternion, b: THREE.Quaternion) {
        delta.copy(a).multiply(inverse.copy(b).invert()).normalize();
        if (delta.w < 0) delta.set(-delta.x, -delta.y, -delta.z, -delta.w);
        const length = Math.hypot(delta.x, delta.y, delta.z);
        out.set(delta.x, delta.y, delta.z).multiplyScalar(
            length > 1e-7 ? (2 * Math.atan2(length, delta.w)) / length : 2
        );
        return out;
    }
    function restore() {
        if (!applied) return;
        for (const track of tracks) track.node.quaternion.copy(track.base);
        if (hips) hips.position.copy(basePosition);
        applied = false;
    }
    return {
        restore,
        reset() {
            restore();
            initialized = false;
            key = "";
            elapsed = 1;
        },
        update(dt: number, nextKey?: string) {
            if (!nextKey || !Number.isFinite(dt) || dt <= 0 || dt > 0.1) {
                initialized = false;
                elapsed = 1;
                return;
            }
            const changed = initialized && key !== nextKey;
            if (changed) elapsed = 0;
            else elapsed += dt;
            const active = elapsed < 0.24;
            for (const track of tracks) {
                track.base.copy(track.node.quaternion);
                if (changed) {
                    const speed = track.velocity.length();
                    rotation.copy(track.previous);
                    if (speed > 1e-7)
                        rotation.premultiply(
                            delta.setFromAxisAngle(
                                vector
                                    .copy(track.velocity)
                                    .multiplyScalar(1 / speed),
                                speed * dt
                            )
                        );
                    log(track.offset, rotation, track.base).clampLength(0, 0.7);
                    track.rate
                        .copy(track.velocity)
                        .sub(track.targetVelocity)
                        .clampLength(0, 8);
                }
                if (initialized && !changed)
                    log(track.targetVelocity, track.base, track.target)
                        .multiplyScalar(1 / dt)
                        .clampLength(0, 8);
                track.target.copy(track.base);
                if (active) {
                    correction
                        .copy(track.rate)
                        .addScaledVector(track.offset, decay)
                        .multiplyScalar(elapsed)
                        .add(track.offset)
                        .multiplyScalar(Math.exp(-decay * elapsed));
                    const angle = correction.length();
                    if (angle > 1e-7)
                        track.node.quaternion.premultiply(
                            rotation.setFromAxisAngle(
                                vector
                                    .copy(correction)
                                    .multiplyScalar(1 / angle),
                                angle
                            )
                        );
                }
                if (initialized)
                    log(track.velocity, track.node.quaternion, track.previous)
                        .multiplyScalar(1 / dt)
                        .clampLength(0, 8);
                track.previous.copy(track.node.quaternion);
            }
            if (hips) {
                basePosition.copy(hips.position);
                if (changed) {
                    positionOffset
                        .subVectors(previousPosition, basePosition)
                        .clampLength(
                            0,
                            Math.max(0.001, Math.abs(basePosition.y) * 0.08)
                        );
                    positionRate.copy(positionVelocity).clampLength(0, 0.5);
                }
                if (active)
                    hips.position.add(
                        correction
                            .copy(positionRate)
                            .addScaledVector(positionOffset, decay)
                            .multiplyScalar(elapsed)
                            .add(positionOffset)
                            .multiplyScalar(Math.exp(-decay * elapsed))
                    );
                if (initialized)
                    positionVelocity
                        .subVectors(hips.position, previousPosition)
                        .multiplyScalar(1 / dt);
                previousPosition.copy(hips.position);
            }
            applied = active;
            initialized = true;
            key = nextKey;
        },
    };
}
