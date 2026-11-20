// The only renderer-specific part: put a camera pose on a three.js
// PerspectiveCamera. It takes the camera as a value, so the kit imports no
// three.js and works with whichever copy the game bundles.
import type { CameraPose } from "./camera.ts";

interface PerspectiveCameraLike {
    position: { set(x: number, y: number, z: number): unknown };
    fov: number;
    near: number;
    lookAt(x: number, y: number, z: number): void;
    updateProjectionMatrix(): void;
}

/** Place `camera` at the pose. Pass `{ near: false }` to keep the game's own
 * near plane (for a scene built at a very different scale). */
export function applyCameraPose(
    camera: PerspectiveCameraLike,
    pose: CameraPose,
    options: { near?: boolean } = {}
) {
    camera.position.set(pose.position.x, pose.position.y, pose.position.z);
    camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
    const near = options.near === false ? camera.near : pose.near;
    if (camera.fov !== pose.fov || camera.near !== near) {
        camera.fov = pose.fov;
        camera.near = near;
        camera.updateProjectionMatrix();
    }
}
