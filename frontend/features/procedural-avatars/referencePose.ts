import * as T from "three/webgpu";
import { drawingRig, type ReferenceLayout } from "./referenceProportions";
import type { Character } from "./catalog";

export function referencePose(
    root: T.Object3D,
    id: Character,
    layout?: ReferenceLayout
) {
    const mesh = root.getObjectByProperty(
        "isSkinnedMesh",
        true
    ) as T.SkinnedMesh;
    const saved = mesh.skeleton.bones.map((b) => ({
        bone: b,
        p: b.position.clone(),
        q: b.quaternion.clone(),
    }));
    mesh.skeleton.pose();
    const { joints } = drawingRig(id, undefined, layout);
    for (const { name, parent, orientation } of joints.values()) {
        const local = parent
            ? joints
                  .get(parent)
                  .orientation.clone()
                  .invert()
                  .multiply(orientation)
            : orientation;
        root.getObjectByName(name).quaternion.copy(local);
    }
    root.updateMatrixWorld(true);
    return () =>
        saved.forEach(({ bone, p, q }) => {
            bone.position.copy(p);
            bone.quaternion.copy(q);
        });
}
