import * as THREE from "three/webgpu";
import type { SpringSpec } from "./generate";

/**
 * Follow-through for a chain of bones (a ponytail): each bone's tip is a
 * point with inertia, pulled back towards its rest direction, weighed down
 * by gravity, and kept at the bone's length. The bone then turns to aim at
 * its tip.
 */
export class SpringChain {
    private readonly links: {
        bone: THREE.Bone;
        axis: THREE.Vector3;
        length: number;
        tail: THREE.Vector3;
        previous: THREE.Vector3;
    }[] = [];
    private started = false;
    private readonly a = new THREE.Vector3();
    private readonly b = new THREE.Vector3();
    private readonly q = new THREE.Quaternion();
    private readonly m = new THREE.Matrix4();

    constructor(
        bones: Record<string, THREE.Bone>,
        private readonly spec: SpringSpec
    ) {
        spec.bones.forEach((name, i) => {
            const bone = bones[name];
            if (!bone) return;
            const next = bones[spec.bones[i + 1]];
            const tip = next
                ? next.position.clone()
                : new THREE.Vector3(spec.tip[0], spec.tip[1], spec.tip[2]);
            this.links.push({
                bone,
                axis: tip.clone().normalize(),
                length: tip.length(),
                tail: new THREE.Vector3(),
                previous: new THREE.Vector3(),
            });
        });
    }

    /** Snap to the rest pose: after a teleport, or the first frame. */
    reset() {
        for (const link of this.links) {
            link.bone.quaternion.identity();
            link.bone.updateWorldMatrix(true, false);
            link.tail
                .copy(link.axis)
                .multiplyScalar(link.length)
                .applyMatrix4(link.bone.matrixWorld);
            link.previous.copy(link.tail);
        }
        this.started = true;
    }

    update(dt: number) {
        if (!this.started || dt > 0.25) {
            this.reset();
            return;
        }
        if (dt <= 0) return;
        const { stiffness, drag, gravity } = this.spec;
        const step = Math.min(dt, 1 / 30);
        for (const link of this.links) {
            const { bone, axis, length, tail, previous } = link;
            const parent = bone.parent;
            parent.updateWorldMatrix(true, false);
            // World length of the bone, so a scaled avatar still works.
            const scale = this.a.setFromMatrixScale(parent.matrixWorld).x;
            bone.quaternion.identity();
            bone.updateMatrix();
            bone.matrixWorld.multiplyMatrices(parent.matrixWorld, bone.matrix);
            const origin = this.a.setFromMatrixPosition(bone.matrixWorld);
            const rest = this.b.copy(axis).transformDirection(bone.matrixWorld);
            const next = tail
                .clone()
                .add(
                    previous.subVectors(tail, previous).multiplyScalar(1 - drag)
                )
                .addScaledVector(rest, stiffness * step * 12 * length * scale)
                .add(
                    new THREE.Vector3(
                        0,
                        -gravity * step * length * scale * 4,
                        0
                    )
                );
            // Keep the bone its length.
            next.sub(origin)
                .normalize()
                .multiplyScalar(length * scale)
                .add(origin);
            previous.copy(tail);
            tail.copy(next);
            // Aim the bone's axis at the tip, in the parent's space.
            const local = next
                .clone()
                .applyMatrix4(this.m.copy(bone.matrixWorld).invert())
                .normalize();
            bone.quaternion.copy(this.q.setFromUnitVectors(axis, local));
            bone.updateMatrix();
            bone.matrixWorld.multiplyMatrices(parent.matrixWorld, bone.matrix);
        }
    }
}
