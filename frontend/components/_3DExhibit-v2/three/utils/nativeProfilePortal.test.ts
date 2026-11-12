/** @jest-environment jsdom */
const THREE = require("three");
const mockCamera: any = {};
const mockPlayers: any = {};
const mockRoot: any = {};
const mockRenderer: any = {};
const mockScene = new THREE.Scene();
const mockListeners = new Map<string, Set<() => void>>();
const mockEmitter = {
    on(name, fn) {
        if (!mockListeners.has(name)) mockListeners.set(name, new Set());
        mockListeners.get(name).add(fn);
    },
    off(name, fn) {
        mockListeners.get(name)?.delete(fn);
    },
};
let mockCanvas: HTMLCanvasElement, mockCss: HTMLDivElement;
let mockFirstPerson = false;
const mockRender = jest.fn();
const mockGround = jest.fn();
const mockSynchronize = jest.fn();
const mockIdle = jest.fn();
jest.mock("@3camera", () => ({ __esModule: true, default: mockCamera }), {
    virtual: true,
});
jest.mock("@3scene", () => ({ __esModule: true, default: mockScene }), {
    virtual: true,
});
jest.mock("@3emitter", () => ({ __esModule: true, default: mockEmitter }), {
    virtual: true,
});
jest.mock("@3renderer", () => ({ __esModule: true, default: mockRenderer }), {
    virtual: true,
});
jest.mock(
    "@3events",
    () => ({
        __esModule: true,
        default: { PRE_UPDATE: "pre", PRE_RENDER: "render" },
    }),
    { virtual: true }
);
jest.mock(
    "../factory/player",
    () => ({ __esModule: true, default: mockPlayers }),
    { virtual: true }
);
jest.mock("../root", () => ({ __esModule: true, default: mockRoot }), {
    virtual: true,
});
jest.mock(
    "../renderer/postprocessing",
    () => ({
        __esModule: true,
        default: { render: (...args) => mockRender(...args) },
    }),
    { virtual: true }
);
jest.mock(
    "../constants",
    () => ({
        get CANVAS() {
            return mockCanvas;
        },
        get CSS_CANVAS() {
            return mockCss;
        },
        get IS_FIRST_PERSON() {
            return mockFirstPerson;
        },
        SET_IS_FIRST_PERSON(value) {
            mockFirstPerson = value;
        },
        CURRENT_SPACE: { roomParameters: { name: "Actual geometry" } },
    }),
    { virtual: true }
);
jest.mock(
    "./nativeTravelGrounding",
    () => ({
        resolveNativeTravelGroundedFeet: (...args) => mockGround(...args),
        synchronizeNativeTravelGrounding: (...args) => mockSynchronize(...args),
    }),
    { virtual: true }
);
jest.mock(
    "./nativeTravelAvatarYaw",
    () => ({ nativeTravelAvatarYawOffset: () => 0 }),
    { virtual: true }
);
jest.mock(
    "./nativeTravelIdle",
    () => ({ holdNativeTravelIdle: (...args) => mockIdle(...args) }),
    { virtual: true }
);
const { createNativeProfilePortal } = require("./nativeProfilePortal");
const view = {
    cameraPosition: { x: 0, y: 2.6, z: 5 },
    cameraTarget: { x: 0, y: 1.2, z: 0 },
    playerPosition: { x: 0, y: 0, z: -2 },
    avatarRotation: 0,
    fov: 58,
    aspect: 1.6,
};
let controller: ReturnType<typeof createNativeProfilePortal>;
let world: { nextUpdate: jest.Mock };
beforeEach(() => {
    jest.clearAllMocks();
    mockListeners.clear();
    mockCanvas = document.createElement("canvas");
    mockCss = document.createElement("div");
    mockCss.style.visibility = "visible";
    mockCamera.current = new THREE.PerspectiveCamera(60, 1.3, 0.1, 100);
    mockCamera.current.position.set(14, 5, 25);
    mockCamera.current.lookAt(10, 3, 20);
    mockCamera.active = true;
    mockCamera.setThirdPerson = jest.fn(async () => {});
    mockCamera.updateFrustum = jest.fn();
    mockCamera.addAudioListener = jest.fn();
    mockCamera.currentControls = {
        enabled: true,
        setCamera: jest.fn(),
        world: {
            roomParameters: { initialPlayerRotation: { y: Math.PI / 2 } },
            playerState: {
                veclocity: new THREE.Vector3(1, 2, 3),
                direction: new THREE.Vector3(0, 0, 1),
                keyStates: { KeyW: true },
                joystickState: { pan: new THREE.Vector3(1, 0, 0) },
            },
        },
    };
    const player: any = new THREE.Object3D();
    player.position.set(10, 2.1, 20);
    player.visible = true;
    player.isMoving = true;
    player.avatar3D = {
        visible: true,
        opacity: 0.9,
        onFloor: true,
        isJumping: false,
        headPosition: { y: 3.6 },
        hipPosition: new THREE.Vector3(0, 1.5, 0),
        spinePosition: new THREE.Vector3(0, 2.4, 0),
        baseScaleRatio: 2,
        highQualityMeshes: { scale: new THREE.Vector3(2, 2, 2) },
    };
    player.tweenHeadPosition = 4;
    player.tweenTextPosition = 3.6;
    player.username = { wrapper: { visible: true } };
    player.show = jest.fn(() => {
        player.visible = true;
    });
    player.updateAvatar = jest.fn();
    mockPlayers.main = player;
    mockScene.clear();
    const room = new THREE.Group();
    mockScene.add(room);
    mockRoot.currentSpace = { scene: room };
    mockRenderer.compileAsync = jest.fn(async () => {});
    mockRenderer.getRenderTarget = jest.fn(() => "saved-target");
    mockRenderer.setRenderTarget = jest.fn();
    mockRenderer.clear = jest.fn();
    mockRenderer.clippingPlanes = [new THREE.Plane()];
    mockRenderer.info = { render: { manualFrame: 0 } };
    mockRender.mockImplementation(() => {});
    mockGround.mockImplementation(
        (_physics, feet) => new THREE.Vector3(feet.x, 2, feet.z)
    );
    world = { nextUpdate: jest.fn(async () => {}) };
    controller = createNativeProfilePortal(world);
});
afterEach(() => controller?.dispose());


it("warms both clipping pipelines before exposing the live room and preserves movement on crossing", async () => {
    const moving = { ...view, avatarHeight: 1.8, movement: { keys: ["KeyW"], speed: 3, velocity: { x: 0, y: 0, z: -3 } } };
    await controller.prepare({ reducedMotion: false, portalView: moving });
    expect(mockRenderer.compileAsync).toHaveBeenCalledTimes(2);
    expect(mockRoot.currentSpace.scene.parent.isClippingGroup).toBe(true);
    controller.preview({ ...moving, playerPosition: { x: 0, y: 0, z: -3 } });
    const position = mockPlayers.main.position.clone();
    const camera = mockCamera.current.position.clone();
    await controller.reveal({ reducedMotion: false });
    expect(mockPlayers.main.position).toEqual(position);
    expect(mockCamera.current.position).toEqual(camera);
    expect(mockCamera.currentControls.world.playerState.keyStates.KeyW).toBe(true);
    expect(mockPlayers.main.isMoving).toBe(true);
    // Destination is twice the source scale, rotated 90 degrees.
    expect(mockCamera.currentControls.world.playerState.veclocity.x).toBeCloseTo(-6);
    expect(mockCamera.currentControls.world.playerState.veclocity.z).toBeCloseTo(0);
    expect(mockIdle).not.toHaveBeenCalled();
    expect(mockRoot.currentSpace.scene.parent).toBe(mockScene);
    expect(mockCamera.currentControls.enabled).toBe(true);
    expect(mockRenderer.compileAsync).toHaveBeenCalledTimes(2);
});
it("cancelling a prepared portal restores camera, controls and scene parenting", async () => {
    const original = mockCamera.current.position.clone();
    await controller.prepare({ reducedMotion: false, portalView: view });
    controller.dispose();
    expect(mockCamera.current.position).toEqual(original);
    expect(mockCamera.currentControls.enabled).toBe(true);
    expect(mockRoot.currentSpace.scene.parent).toBe(mockScene);
    expect(document.documentElement.hasAttribute("data-profile-portal-preview")).toBe(false);
});

// A module, so its top-level names stay out of the other test scripts.
export {};
