/**
 * Where the visitor stands and looks, as a script is told every frame.
 */
import { Vector3 } from "three";
import type { WorldView } from "../host";
import { currentCamera, mainPlayer } from "./facade";

export function readView(): WorldView {
    const camera = currentCamera();
    const forward = camera
        ? camera.getWorldDirection(new Vector3())
        : new Vector3(0, 0, -1);
    const cameraPosition = camera
        ? camera.getWorldPosition(new Vector3())
        : new Vector3();
    const position = mainPlayer()?.position ?? cameraPosition;
    const flat = new Vector3(forward.x, 0, forward.z);
    if (flat.lengthSq() > 0) flat.normalize();
    return {
        player: {
            position: [position.x, position.y, position.z],
            forward: [flat.x, flat.y, flat.z],
            yaw: Math.atan2(flat.x, flat.z),
        },
        camera: {
            position: [cameraPosition.x, cameraPosition.y, cameraPosition.z],
            forward: [forward.x, forward.y, forward.z],
        },
    };
}
