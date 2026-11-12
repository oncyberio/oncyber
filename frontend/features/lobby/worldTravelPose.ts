import type { LobbyTravelView } from "./lobbyJourneyProtocol";

export const WORLD_TRAVEL_HANDOFF_MS = 600;
export function easeWorldTravelHandoff(progress: number) {
    const t = Math.max(0, Math.min(1, progress));
    return t * t * (3 - 2 * t);
}

/** Map the lobby's relative view onto destination feet without translating its camera
 * through the space. Geometry reveal deliberately never transforms player meshes. */
export function applyWorldTravelView(
    THREE: any,
    camera: any,
    player: any,
    anchor: { x: number; y: number; z: number },
    view?: LobbyTravelView
) {
    if (!view) return;
    player.position.set(anchor.x, anchor.y + view.avatarLift, anchor.z);
    player.rotation.y = view.avatarRotation;
    player.show?.();
    player.updateAvatar?.();
    camera.position.set(
        anchor.x + view.cameraOffset.x,
        anchor.y + view.cameraOffset.y,
        anchor.z + view.cameraOffset.z
    );
    const target = new THREE.Vector3(
        anchor.x + view.cameraTargetOffset.x,
        anchor.y + view.cameraTargetOffset.y,
        anchor.z + view.cameraTargetOffset.z
    );
    camera.lookAt(target);
    camera.fov = view.fov;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    // Seed the native follow camera from the displayed view for release to controls.
    camera.cameraPosition?.copy(camera.position);
    camera.idealCameraPosition?.copy(camera.position);
    camera.cameraTarget?.copy(target);
    camera.idealCameraTarget?.copy(target);
    if (typeof camera.theta === "number") {
        const offset = camera.position.clone().sub(target);
        camera.theta = (Math.atan2(offset.x, offset.z) * 180) / Math.PI;
        camera.phi =
            (Math.atan2(offset.y, Math.hypot(offset.x, offset.z)) * 180) /
            Math.PI;
        camera.radius = camera.targetRadius = offset.length();
    }
}
