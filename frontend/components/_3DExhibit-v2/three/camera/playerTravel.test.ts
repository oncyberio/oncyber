/** @jest-environment jsdom */
import { createTravelCameraResolver } from "@features/lobby/worldTravelCamera";
import { applyWorldTravelView } from "@features/lobby/worldTravelPose";
const THREE = require("three");
const mockCamera: any = {};
const mockPlayers: any = {};
jest.mock("three", () => jest.requireActual("three"));
jest.mock("@3camera", () => ({ __esModule: true, default: mockCamera }), {
    virtual: true,
});
jest.mock(
    "@3factory/player",
    () => ({ __esModule: true, default: mockPlayers }),
    { virtual: true }
);
jest.mock(
    "@3constants",
    () => ({
        USER_HEIGHT: 3.1,
        DEBUG: false,
        IS_MOBILE: false,
        APP_STATES: { SPACE: "space", TELEPORT: "teleport" },
    }),
    { virtual: true }
);
jest.mock(
    "@3emitter",
    () => ({ __esModule: true, default: { on: jest.fn(), off: jest.fn() } }),
    { virtual: true }
);
jest.mock(
    "@3events",
    () => ({ __esModule: true, default: { RESIZE: "resize" } }),
    { virtual: true }
);
jest.mock("@3mediator", () => ({}), { virtual: true });
jest.mock("@3raycaster", () => ({}), { virtual: true });
jest.mock("../utils/spaceutils", () => ({}));
jest.mock("../utils/camera", () => ({ initCamera: jest.fn() }));
jest.mock("../scene", () => ({}));
jest.mock("./constants", () => ({
    FOV: 65,
    NEAR: 0.25,
    walkNear: (near: number) => Math.min(near || 0.25, 0.3),
    FAR: 1000,
    GET_RATIO_FOV: () => 65,
    MAX_ZOOM_OUT: 6,
    MIN_ZOOM_OUT: 0.2,
    PLAYER_CAMERA_SENSITIVITY: 1,
    PLAYER_TRANSITION_TYPE: { ZOOM_IN: "zoom-in" },
}));
let camera: any, staged: any;
beforeEach(() => {
    const player = new THREE.Object3D();
    player.radius = 0.4;
    player.getHeadPosition = jest.fn(() => 3.1);
    player.getWorldCenterPoint = () => player.position.clone();
    player.show = () => {
        player.visible = true;
    };
    player.hide = () => {
        player.visible = false;
    };
    mockPlayers.main = player;
    const wall = new THREE.Box3(
        new THREE.Vector3(-20, -2, 2.4),
        new THREE.Vector3(20, 10, 2.6)
    );
    mockCamera.currentControls = {
        world: {
            rayIntersect: (ray) => {
                const hit = ray.intersectBox(wall, new THREE.Vector3());
                return hit ? { distance: hit.distanceTo(ray.origin) } : null;
            },
        },
    };
    camera = require("./player").default;
    camera.player = player;
    camera.setSpace({ near: 0.25, far: 1000 }, {}, false);
    camera.aspect = 1.6;
    staged = createTravelCameraResolver(
        THREE,
        mockCamera.currentControls.world.rayIntersect
    ).cinematic(
        player.position,
        {
            cameraOffset: { x: 0, y: 2, z: 6 },
            cameraTargetOffset: { x: 0, y: 1.2, z: 0 },
            avatarRotation: 0,
            avatarLift: 0,
            avatarHeight: 1.8,
            fov: 60,
            cameraMode: "third-person",
        },
        { near: 0.25, aspect: 1.6 },
        { avatarHeight: 2.7, targetHeight: 3.1, radius: 6, heading: 0, fov: 65 }
    );
    applyWorldTravelView(
        THREE,
        camera,
        player,
        player.position.clone(),
        staged.view
    );
    camera.travelFraming = { ...staged.profile };
});
test("the first native update preserves the compact cinematic projection", () => {
    const position = camera.position.clone(),
        quaternion = camera.quaternion.clone(),
        fov = camera.fov;
    mockPlayers.main.getHeadPosition.mockClear();
    camera.update(1 / 60);
    camera.updateMatrixWorld(true);
    expect(mockPlayers.main.getHeadPosition).toHaveBeenCalledTimes(1);
    expect(camera.position.distanceTo(position)).toBeLessThan(1e-5);
    expect(camera.quaternion.angleTo(quaternion)).toBeLessThan(1e-5);
    expect(camera.fov).toBe(fov);
    expect(camera.travelFraming.blend).toBe(1);
    expect(mockPlayers.main.visible).toBe(true);
    for (let i = 0; i < 60; i++) camera.update(1 / 60);
    expect(camera.position.distanceTo(position)).toBeLessThan(1e-5);
});
test("moving into a clear room releases the profile smoothly and restores normal FOV", () => {
    const position = camera.position.clone();
    mockCamera.currentControls.world.rayIntersect = () => null;
    camera.update(1 / 60);
    expect(camera.position.distanceTo(position)).toBeLessThan(0.1);
    expect(camera.travelFraming.blend).toBeGreaterThan(0.95);
    for (let i = 0; i < 300; i++) camera.update(1 / 60);
    expect(camera.travelFraming).toBeUndefined();
    expect(camera.fov).toBe(65);
    expect(camera.idealCameraTarget.y).toBe(3.1);
});
test("resizing retains compact composition and a new space clears it", () => {
    camera.resize(1000, 800);
    expect(camera.aspect).toBe(1.25);
    expect(camera.fov).toBe(90);
    camera.setSpace({ near: 0.25, far: 1000 }, {}, false);
    expect(camera.travelFraming).toBeUndefined();
    expect(camera.fov).toBe(65);
});


test("portal framing stays finite and preserves its lens after native controls resume", () => {
    mockCamera.currentControls.world.rayIntersect = () => null;
    const view = {
        cameraPosition: new THREE.Vector3(0, 3, 7),
        cameraTarget: new THREE.Vector3(0, 1.6, 0),
        playerPosition: new THREE.Vector3(),
        avatarRotation: 0, avatarHeight: 1.8, fov: 60, aspect: 1.6,
    };
    applyWorldTravelView(THREE, camera, mockPlayers.main, view.playerPosition, {
        cameraOffset: view.cameraPosition, cameraTargetOffset: view.cameraTarget,
        avatarRotation: 0, avatarLift: 0, fov: view.fov,
    });
    const { nativeProfilePortalFraming } = require("../utils/nativeProfilePortalView");
    camera.travelFraming = nativeProfilePortalFraming(view, 65);
    const position = camera.position.clone();
    for (let i = 0; i < 60; i++) camera.update(1 / 60);
    expect(camera.position.distanceTo(position)).toBeLessThan(1e-4);
    expect(camera.fov).toBe(60);
    camera.resize(1000, 800);
    expect(camera.fov).toBe(60);
});
