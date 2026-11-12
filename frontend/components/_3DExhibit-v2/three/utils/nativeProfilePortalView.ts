import * as THREE from "three";
import type { LobbyPortalView } from "@features/lobby/lobbyPortalPreview";

/** Convert lobby units to native units around the doorway floor. Scaling the
 * complete view preserves its projection while the native avatar keeps its size. */
export function mapNativeProfilePortalView(
    view: LobbyPortalView,
    anchor: THREE.Vector3,
    heading: number,
    nativeAvatarHeight?: number
) {
    const hasNativeHeight =
        Number.isFinite(nativeAvatarHeight) && nativeAvatarHeight > 0;
    const hasSourceHeight =
        Number.isFinite(view.avatarHeight) && view.avatarHeight > 0;
    const unitScale =
        hasNativeHeight && hasSourceHeight
            ? nativeAvatarHeight / view.avatarHeight
            : 1;
    const rotation = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        heading
    );
    const point = (value: { x: number; y: number; z: number }) =>
        new THREE.Vector3(value.x, value.y, value.z)
            .multiplyScalar(unitScale)
            .applyQuaternion(rotation)
            .add(anchor);
    return {
        cameraPosition: point(view.cameraPosition),
        cameraTarget: point(view.cameraTarget),
        playerPosition: point(view.playerPosition),
        velocity: view.movement?.velocity
            ? new THREE.Vector3(
                  view.movement.velocity.x,
                  0,
                  view.movement.velocity.z
              ).multiplyScalar(unitScale).applyQuaternion(rotation)
            : new THREE.Vector3(),
        avatarRotation: view.avatarRotation + heading,
        avatarHeight: hasNativeHeight ? nativeAvatarHeight : view.avatarHeight,
        fov: view.fov,
        aspect: view.aspect,
    };
}

/** Keep the projection seen through the doorway as the native follow camera.
 * The target is stored relative to orbit yaw so looking around remains natural. */
export function nativeProfilePortalFraming(
    view: ReturnType<typeof mapNativeProfilePortalView>,
    baseFov: number
) {
    const orbit = view.cameraPosition.clone().sub(view.cameraTarget);
    const yaw = Math.atan2(orbit.x, orbit.z);
    const offset = view.cameraTarget.clone().sub(view.playerPosition);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), -yaw);
    return {
        kind: "portal" as const,
        targetOffset: { x: offset.x, y: offset.y, z: offset.z },
        radius: orbit.length(),
        avatarHeight: view.avatarHeight || 1.8,
        baseFov,
        fov: view.fov,
        blend: 1,
    };
}
