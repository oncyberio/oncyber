import * as T from "three/webgpu";
export type Hand = "left" | "right";
export interface GripOptions {
    /** Handle radius in the unscaled avatar's metres. Its center is the item's origin, +Y toward the index finger. */
    radius?: number;
}
type Grip = {
    item: T.Object3D;
    mount: T.Group;
    fingers: { bone: T.Bone; pose: T.Quaternion; animated: T.Quaternion }[];
};
const owners = new WeakMap<T.Object3D, () => void>();

/** Sockets are allocated on equip. Item geometry and materials belong to the caller. */
export function createHandItems(
    bones: Map<string, T.Bone>,
    body: T.SkinnedMesh
) {
    const hands = new Map<Hand, Grip>();
    function release(side: Hand) {
        const grip = hands.get(side);
        if (!grip) return;
        for (const { bone, pose, animated } of grip.fingers)
            if (bone.quaternion.angleTo(pose) < 1e-6)
                bone.quaternion.copy(animated);
        owners.delete(grip.item);
        if (grip.item.parent === grip.mount) grip.item.removeFromParent();
        grip.mount.removeFromParent();
        hands.delete(side);
        if (body.geometry.userData.referenceItem?.side === side)
            body.geometry.setDrawRange(0, Infinity);
    }
    function pose(grip: Grip) {
        for (const f of grip.fingers) {
            if (f.bone.quaternion.angleTo(f.pose) > 1e-6)
                f.animated.copy(f.bone.quaternion);
            f.bone.quaternion.copy(f.pose);
        }
    }
    function equip(side: Hand, item: T.Object3D, opts: GripOptions = {}) {
        release(side);
        if (!item) return;
        // Moving an item directly between hands releases the old finger pose too.
        owners.get(item)?.();
        const wrist = bones.get(side + "Hand"),
            middle = bones.get(side + "MiddleProximal");
        const forward = middle.position.clone().normalize();
        const across = bones
            .get(side + "IndexProximal")
            .position.clone()
            .sub(bones.get(side + "LittleProximal").position);
        across.addScaledVector(forward, -across.dot(forward)).normalize();
        const normal = across
            .clone()
            .cross(forward)
            .multiplyScalar(side === "left" ? 1 : -1);
        const palm = middle.position.length();
        const radius = T.MathUtils.clamp(
            opts.radius ?? palm * 0.34,
            palm * 0.1,
            palm * 0.68
        );
        const mount = new T.Group();
        mount.name = side + "Grip";
        mount.position
            .copy(middle.position)
            .addScaledVector(normal, radius * 0.95)
            .addScaledVector(forward, radius * 0.36);
        mount.quaternion.setFromRotationMatrix(
            new T.Matrix4().makeBasis(
                across.clone().cross(forward),
                across,
                forward
            )
        );
        wrist.add(mount);
        mount.add(item);
        const fingers: Grip["fingers"] = [];
        const axis = forward.clone().cross(normal);
        const tight = 1 - radius / palm;
        for (const finger of ["Index", "Middle", "Ring", "Little", "Thumb"]) {
            const thumb = finger === "Thumb",
                chain = thumb
                    ? ["Metacarpal", "Proximal", "Distal"]
                    : ["Proximal", "Intermediate", "Distal"];
            const angles = thumb
                ? [0.3, 0.48, 0.55]
                : [0.5 + 0.55 * tight, 0.65 + 0.74 * tight, 0.55 + 0.7 * tight];
            chain.forEach((part, i) => {
                const bone = bones.get(side + finger + part);
                const q = new T.Quaternion().setFromAxisAngle(axis, angles[i]);
                if (thumb && i === 0)
                    q.premultiply(
                        new T.Quaternion().setFromAxisAngle(
                            normal,
                            side === "left" ? 0.7 : -0.7
                        )
                    );
                fingers.push({
                    bone,
                    pose: q,
                    animated: bone.quaternion.clone(),
                });
            });
        }
        const grip = { item, mount, fingers };
        hands.set(side, grip);
        owners.set(item, () => release(side));
        const builtIn = body.geometry.userData.referenceItem;
        if (builtIn?.side === side)
            body.geometry.setDrawRange(0, builtIn.start);
        pose(grip);
    }
    return {
        equip,
        release,
        update() {
            for (const grip of hands.values()) pose(grip);
        },
        clear() {
            for (const side of hands.keys()) release(side);
        },
    };
}
