import * as THREE from "three";
import {
    mapNativeProfilePortalView,
    nativeProfilePortalFraming,
} from "./nativeProfilePortalView";

it("maps camera and feet through the same grounded entrance transform", () => {
    const result = mapNativeProfilePortalView(
        {
            cameraPosition: { x: 1, y: 2.6, z: 5 },
            cameraTarget: { x: 1, y: 1.2, z: 0 },
            playerPosition: { x: 1, y: 0, z: -2 },
            avatarRotation: 0.3,
            fov: 58,
            aspect: 1.7,
        },
        new THREE.Vector3(10, 3, 20),
        Math.PI / 2
    );
    expect(result.cameraPosition.x).toBeCloseTo(15);
    expect(result.cameraPosition.y).toBeCloseTo(5.6);
    expect(result.cameraPosition.z).toBeCloseTo(19);
    expect(result.playerPosition.x).toBeCloseTo(8);
    expect(result.playerPosition.y).toBe(3);
    expect(result.playerPosition.z).toBeCloseTo(19);
    expect(result.cameraTarget.y).toBeCloseTo(4.2);
    expect(result.avatarRotation).toBeCloseTo(Math.PI / 2 + 0.3);
    expect(result.fov).toBe(58);
});

it("converts the whole doorway view to native avatar units without changing projection", () => {
    const view = {
        cameraPosition: { x: 1, y: 2.6, z: 5 },
        cameraTarget: { x: 1, y: 1.2, z: 0 },
        playerPosition: { x: 1, y: 0, z: -2 },
        avatarRotation: 0.3,
        avatarHeight: 1.8,
        fov: 58,
        aspect: 1.7,
    };
    const result = mapNativeProfilePortalView(
        view,
        new THREE.Vector3(10, 3, 20),
        Math.PI / 2,
        2.7
    );
    expect(result.cameraPosition.x).toBeCloseTo(17.5);
    expect(result.cameraPosition.y).toBeCloseTo(6.9);
    expect(result.cameraPosition.z).toBeCloseTo(18.5);
    expect(result.playerPosition.x).toBeCloseTo(7);
    expect(result.playerPosition.y).toBe(3);
    expect(result.playerPosition.z).toBeCloseTo(18.5);
    expect(result.cameraTarget.y).toBeCloseTo(4.8);
    expect(result.avatarHeight).toBe(2.7);
    expect(result.avatarRotation).toBeCloseTo(Math.PI / 2 + 0.3);
    expect(result.fov).toBe(view.fov);
    const framing = nativeProfilePortalFraming(result, 65);
    expect(framing.radius).toBeCloseTo(Math.hypot(1.4, 5) * 1.5);
    expect(framing.targetOffset.y).toBeCloseTo(1.2 * 1.5);

    const sourceCamera = new THREE.PerspectiveCamera(view.fov, view.aspect);
    sourceCamera.position.copy(view.cameraPosition);
    sourceCamera.lookAt(new THREE.Vector3().copy(view.cameraTarget));
    sourceCamera.updateMatrixWorld(true);
    const nativeCamera = sourceCamera.clone();
    nativeCamera.position.copy(result.cameraPosition);
    nativeCamera.lookAt(result.cameraTarget);
    nativeCamera.updateMatrixWorld(true);
    for (const height of [0, view.avatarHeight]) {
        const sourcePoint = new THREE.Vector3().copy(view.playerPosition);
        sourcePoint.y += height;
        const nativePoint = result.playerPosition.clone();
        nativePoint.y += height * 1.5;
        sourcePoint.project(sourceCamera);
        nativePoint.project(nativeCamera);
        expect(nativePoint.x).toBeCloseTo(sourcePoint.x);
        expect(nativePoint.y).toBeCloseTo(sourcePoint.y);
    }
});

it.each([
    [undefined, 2.7],
    [0, 2.7],
    [NaN, 2.7],
    [1.8, undefined],
    [1.8, 0],
    [1.8, Infinity],
])(
    "keeps unit scale when either avatar height is unavailable (%s, %s)",
    (source, native) => {
        const result = mapNativeProfilePortalView(
            {
                cameraPosition: { x: 1, y: 2, z: 3 },
                cameraTarget: { x: 0, y: 1, z: 0 },
                playerPosition: { x: 0, y: 0, z: -1 },
                avatarRotation: 0,
                avatarHeight: source,
                fov: 58,
                aspect: 1.6,
            },
            new THREE.Vector3(),
            0,
            native
        );
        expect(result.cameraPosition.toArray()).toEqual([1, 2, 3]);
        expect(result.playerPosition.toArray()).toEqual([0, 0, -1]);
    }
);
