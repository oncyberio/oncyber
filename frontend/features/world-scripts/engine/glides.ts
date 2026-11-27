/**
 * Where a thing is put: at once, or over a moment (a rewind glides every
 * object back to its start instead of jumping it there).
 */
import { Object3D, Vector3 } from "three";
import type { Vec3 } from "../protocol";

export interface Placement {
    position?: Vec3;
    rotation?: Vec3;
    scale?: Vec3;
}

interface Glide {
    object: Object3D;
    from: { p: Vector3; r: Vector3; s: Vector3 };
    to: { p: Vector3; r: Vector3; s: Vector3 };
    elapsed: number;
    seconds: number;
}

const v = new Vector3();

export const places = (props: Placement) =>
    !!(props.position || props.rotation || props.scale);

export function applyTransform(object: Object3D, props: Placement) {
    if (props.position) object.position.fromArray(props.position);
    if (props.rotation)
        object.rotation.set(
            props.rotation[0],
            props.rotation[1],
            props.rotation[2]
        );
    if (props.scale) object.scale.fromArray(props.scale);
}

export function createGlides() {
    const glides = new Map<string, Glide>();
    return {
        /** Takes `object` over `seconds` to where `props` puts it. */
        start(id: string, object: Object3D, props: Placement, seconds: number) {
            const to = new Object3D();
            to.position.copy(object.position);
            to.rotation.copy(object.rotation);
            to.scale.copy(object.scale);
            applyTransform(to, props);
            glides.set(id, {
                object,
                from: {
                    p: object.position.clone(),
                    r: new Vector3(
                        object.rotation.x,
                        object.rotation.y,
                        object.rotation.z
                    ),
                    s: object.scale.clone(),
                },
                to: {
                    p: to.position.clone(),
                    r: new Vector3(to.rotation.x, to.rotation.y, to.rotation.z),
                    s: to.scale.clone(),
                },
                elapsed: 0,
                seconds,
            });
        },
        /**
         * A glide still under way is aimed at the new place instead of
         * being cut short. False when `id` is not gliding.
         */
        aim(id: string, props: Placement) {
            const glide = glides.get(id);
            if (!glide) return false;
            const target = glide.to;
            if (props.position) target.p.fromArray(props.position);
            if (props.rotation) target.r.fromArray(props.rotation);
            if (props.scale) target.s.fromArray(props.scale);
            return true;
        },
        stop(id: string) {
            glides.delete(id);
        },
        /** Once a frame, with the seconds since the last. */
        update(delta: number) {
            glides.forEach((glide, id) => {
                glide.elapsed += delta;
                const t = Math.min(1, glide.elapsed / glide.seconds);
                const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
                glide.object.position.lerpVectors(glide.from.p, glide.to.p, e);
                v.lerpVectors(glide.from.r, glide.to.r, e);
                glide.object.rotation.set(v.x, v.y, v.z);
                glide.object.scale.lerpVectors(glide.from.s, glide.to.s, e);
                if (t >= 1) glides.delete(id);
            });
        },
    };
}
