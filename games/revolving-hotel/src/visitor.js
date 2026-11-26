// Copy the action skeleton's normalized pose onto the avatar the page gave
// the kit. Solve in the corridor's coordinate system and pivot around the
// visitor's measured hips so an upside-down avatar stays on its surface.
import { Vector3 } from "three";
export function createVisitorDriver(kit, action) {
    let previous, pairs, hipRest, localHip, vrm0;
    const origin = new Vector3();
    return function wearPose(dt) {
        const avatar = kit.self,
            vrm = avatar.vrm;
        if (!vrm) return;
        if (vrm !== previous) {
            previous = vrm;
            avatar.rest();
            vrm0 = vrm.meta?.metaVersion === "0";
            pairs = Object.entries(action.normBones)
                .map(([n, b]) => [b, vrm.humanoid.getNormalizedBoneNode(n)])
                .filter(([, b]) => b);
            const hips = vrm.humanoid.getNormalizedBoneNode("hips");
            hipRest = hips.position.clone();
            localHip = avatar.root.worldToLocal(
                hips.getWorldPosition(new Vector3())
            );
        }
        avatar.manual = true;
        for (const [from, to] of pairs) {
            to.quaternion.copy(from.quaternion);
            if (vrm0) {
                to.quaternion.x *= -1;
                to.quaternion.z *= -1;
            }
        }
        const hips = vrm.humanoid.getNormalizedBoneNode("hips");
        hips.position.copy(hipRest);
        hips.position.y +=
            hipRest.y * (action.bones.Hips.position.y / action.rest.Hips.y - 1);
        avatar.root.quaternion.copy(action.root.quaternion);
        origin.copy(localHip).applyQuaternion(avatar.root.quaternion);
        avatar.root.position.copy(action.root.position).sub(origin);
        avatar.root.updateWorldMatrix(true, true);
        vrm.update(dt);
    };
}
