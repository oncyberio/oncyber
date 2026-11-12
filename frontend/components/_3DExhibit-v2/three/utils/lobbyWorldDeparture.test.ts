/** @jest-environment jsdom */
jest.mock("../renderer/postprocessing", () => ({
    __esModule: true,
    default: { render: jest.fn() },
}));
jest.mock("@utils/nativeWorldTravel", () => ({
    captureWorldTravelFrame: jest.fn(),
}));

export {};
import { WORLD_DISSOLVE_MS } from "@features/lobby/worldTravelTiming";
jest.mock("@3renderer", () => ({ __esModule: true, default: {} }), {
    virtual: true,
});
jest.mock("@features/lobby/warmWorldTransition", () => ({
    warmWorldTransition: jest.fn(async () => {}),
}));
jest.mock("@features/lobby/worldRevealClock", () => ({
    createWorldRevealClock: (duration) => ({
        sample: (now) => Math.min(1, now / duration),
    }),
}));
const THREE = require("three");
const { NodeMaterial } = require("three/webgpu");
const { texture, uniform } = require("three/tsl");
/** factory/reflector/mesh.js: TSL reflector() as `tDiffuse`, opacity uniform. */
function mirrorMaterial(opacity: number) {
    const material: any = new NodeMaterial();
    material.transparent = true;
    material.defines = {};
    material.uniforms = {
        opacity: uniform(opacity),
        tDiffuse: texture(new THREE.Texture()),
    };
    material.opacityNode = material.uniforms.opacity;
    return material;
}
const mockCamera: any = {};
const mockPlayers: any = {};
const mockRoot: any = {};
const mockScene: any = {};
const mockListeners = new Map<string, Set<() => void>>();
const mockEmitter = {
    on: (name, fn) => {
        if (!mockListeners.has(name)) mockListeners.set(name, new Set());
        mockListeners.get(name).add(fn);
    },
    off: (name, fn) => mockListeners.get(name)?.delete(fn),
};
let mockCanvas: HTMLCanvasElement, mockCss: HTMLDivElement;
const mockCreateReveal = jest.fn();
const mockCreateSky = jest.fn();
jest.mock("three", () => jest.requireActual("three"));
jest.mock("@3camera", () => ({ __esModule: true, default: mockCamera }), {
    virtual: true,
});
jest.mock("@3scene", () => ({ __esModule: true, default: mockScene }), {
    virtual: true,
});
jest.mock("@3emitter", () => ({ __esModule: true, default: mockEmitter }), {
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
jest.mock("../factory/player", () => ({
    __esModule: true,
    default: mockPlayers,
}));
jest.mock("../globals/shared", () => ({
    __esModule: true,
    default: { animationTimer: { value: 17 } },
}));
jest.mock("../root", () => ({ __esModule: true, default: mockRoot }));
jest.mock("../constants", () => ({
    get CANVAS() {
        return mockCanvas;
    },
    get CSS_CANVAS() {
        return mockCss;
    },
}));
jest.mock("@features/lobby/worldCubeReveal", () => ({
    createWorldCubeReveal: (...args) => mockCreateReveal(...args),
    // eslint-disable-next-line require-yield
    buildWorldCubeReveal: function* (...args) {
        return mockCreateReveal(...args);
    },
}));
jest.mock("@features/lobby/worldSkyReveal", () => ({
    createWorldSkyReveal: (...args) => mockCreateSky(...args),
}));
let controller: any, world: any, effect: any, sky: any;
let frames: Map<number, FrameRequestCallback>, frameId: number;
let rendered: Array<() => void>;
const flush = async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
};
const tick = async (now: number) => {
    await flush();
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((fn) => fn(now));
    await flush();
};
beforeEach(() => {
    window.sessionStorage.clear();
    mockListeners.clear();
    frames = new Map();
    frameId = 0;
    rendered = [];
    mockCanvas = document.createElement("canvas");
    mockCss = document.createElement("div");
    mockCss.style.visibility = "visible";
    mockCamera.current = new THREE.PerspectiveCamera(68, 1, 0.1, 1000);
    mockCamera.current.position.set(30, 5, 12);
    mockCamera.current.lookAt(26, 2, 10);
    mockCamera.active = true;
    mockCamera.currentControls = {
        enabled: true,
        setCamera: jest.fn(),
        world: {
            playerState: {
                veclocity: new THREE.Vector3(1, 0, 2),
                direction: new THREE.Vector3(0, 0, -1),
                tempRotation: 1,
                keyStates: { KeyW: true },
                joystickState: { pan: new THREE.Vector3(0.2, 0, 0.3) },
            },
        },
    };
    mockCamera.updateFrustum = jest.fn();
    const player: any = new THREE.Object3D();
    player.position.set(26, 1, 10);
    player.rotation.y = 1;
    player.deactivated = false;
    player.isMoving = true;
    player.avatar3D = {
        isVersion0: true,
        visible: true,
        opacity: 0.8,
        emote: 7,
        onFloor: true,
        isJumping: false,
        floorVelocity: 3,
        smoothedFloorVelocity: 2,
    };
    player.avatar3D.stopEmote = jest.fn(() => {
        player.avatar3D.emote = -1;
        player.avatar3D.emoteResolve = null;
    });
    player.playEmote = jest.fn((index) => {
        player.avatar3D.emote = index;
        player.avatar3D.emoteResolve = () => {};
        return new Promise(() => {});
    });
    player.updateAvatar = jest.fn();
    mockPlayers.main = player;
    mockPlayers.instances = [player, new THREE.Object3D()];
    mockRoot.currentSpace = { scene: new THREE.Group() };
    mockRoot.currentArtworks = new THREE.Group();
    mockRoot.currentStreams = new THREE.Group();
    mockRoot.currentPortals = new THREE.Group();
    effect = {
        stats: { cells: 20 },
        setProgress: jest.fn(),
        dispose: jest.fn(),
    };
    sky = {
        supportedSources: [new THREE.Object3D()],
        stats: { tiles: 0, dimmedSources: 1 },
        setProgress: jest.fn(),
        dispose: jest.fn(),
    };
    mockCreateReveal.mockReset().mockReturnValue(effect);
    mockCreateSky.mockReset().mockReturnValue(sky);
    world = {
        nextUpdate: jest.fn(
            () => new Promise<void>((resolve) => rendered.push(resolve))
        ),
    };
    jest.spyOn(performance, "now").mockReturnValue(0);
    jest.spyOn(window, "requestAnimationFrame").mockImplementation((fn) => {
        frames.set(++frameId, fn);
        return frameId;
    });
    jest.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
        frames.delete(id);
    });
    controller = require("./lobbyWorldDeparture").createNativeLobbyDeparture(
        world
    );
});
afterEach(() => {
    controller.dispose();
    require("@features/lobby/worldTransitionCache").clearWorldTransitionCache();
    jest.restoreAllMocks();
});

test("construction is inert; departure starts from live feet and leaves sources intact until animation", async () => {
    expect(mockCreateReveal).not.toHaveBeenCalled();
    expect(mockCamera.active).toBe(true);
    mockPlayers.main.position.set(40, 3, 20);
    const embeddedSky = new THREE.Mesh();
    embeddedSky.name = "Space";
    const wall = new THREE.Mesh();
    wall.name = "S_Wall_01";
    mockRoot.currentSpace.scene.add(embeddedSky, wall);
    sky.supportedSources = [embeddedSky];
    const pending = controller.depart({ reducedMotion: false });
    pending.catch(() => {});
    expect(mockCreateReveal.mock.calls[0][2]).toMatchObject({
        anchor: new THREE.Vector3(40, 3, 20),
        mode: "dissolve",
        direction: "inward",
        hideRoots: [],
        coverage: "all",
        radius: 18,
        cellSize: 2,
    });
    expect(mockCreateSky.mock.calls[0][1].mode).toBe("dissolve");
    expect(mockCreateSky.mock.calls[0][1].sources).toEqual([embeddedSky, wall]);
    expect(effect.setProgress).not.toHaveBeenCalled();
    const exclude = mockCreateReveal.mock.calls[0][2].exclude;
    expect(exclude(mockPlayers.main)).toBe(true);
    expect(exclude(mockPlayers.instances[1])).toBe(true);
    expect(exclude(sky.supportedSources[0])).toBe(true);
    expect(exclude(wall)).toBe(false);
    expect(mockPlayers.main.playEmote).not.toHaveBeenCalled();
    expect(mockPlayers.main.avatar3D.emote).toBe(-1);
    expect(mockPlayers.main.avatar3D.travelReadyIdle).toBe(true);
    expect(mockCamera.active).toBe(false);
    expect(mockCamera.currentControls.enabled).toBe(false);
    await tick(350);
    expect(effect.setProgress).toHaveBeenLastCalledWith(0.5);
    expect(sky.setProgress).toHaveBeenLastCalledWith(0.5);
});

test("700ms dissolve and150ms black hold await a rendered frame; duplicate Back shares one promise", async () => {
    const done = jest.fn();
    const pending = controller.depart({ reducedMotion: false });
    pending.then(done);
    expect(controller.depart({ reducedMotion: false })).toBe(pending);
    await tick(700);
    expect(effect.setProgress).toHaveBeenLastCalledWith(1);
    expect(world.nextUpdate).not.toHaveBeenCalled();
    await tick(849);
    expect(world.nextUpdate).not.toHaveBeenCalled();
    await tick(850);
    expect(world.nextUpdate).toHaveBeenCalledTimes(1);
    expect(done).not.toHaveBeenCalled();
    rendered.shift()();
    await pending;
    expect(done).toHaveBeenCalledTimes(1);
    expect(effect.dispose).not.toHaveBeenCalled();
    expect(sky.dispose).not.toHaveBeenCalled();
    expect(mockCamera.currentControls.enabled).toBe(false);
    expect(mockPlayers.main.deactivated).toBe(true);
    controller.dispose();
    expect(effect.dispose).toHaveBeenCalledTimes(1);
    expect(sky.dispose).toHaveBeenCalledTimes(1);
});

test("locks current camera and pose; cancellation restores movement and emote and ignores stale frames", async () => {
    const player = mockPlayers.main,
        camera = mockCamera.current,
        position = player.position.clone(),
        cameraPosition = camera.position.clone(),
        q = camera.quaternion.clone();
    const pending = controller.depart({ reducedMotion: false });
    const rejected = expect(pending).rejects.toThrow("Departure cancelled");
    await flush();
    const stale = [...frames.values()][0];
    player.position.set(99, 99, 99);
    player.rotation.y = 4;
    camera.position.set(99, 99, 99);
    camera.quaternion.identity();
    for (const callback of mockListeners.get("render")) callback();
    expect(player.position.equals(position)).toBe(true);
    expect(player.rotation.y).toBe(1);
    expect(camera.position.equals(cameraPosition)).toBe(true);
    expect(camera.quaternion.equals(q)).toBe(true);
    controller.dispose();
    await rejected;
    expect(mockCamera.active).toBe(true);
    expect(mockCamera.currentControls.enabled).toBe(true);
    expect(player.deactivated).toBe(false);
    expect(player.isMoving).toBe(true);
    expect(player.avatar3D.emote).toBe(7);
    expect(player.avatar3D.travelReadyIdle).toBeUndefined();
    expect(player.avatar3D.opacity).toBe(0.8);
    expect(mockCss.style.visibility).toBe("visible");
    expect(
        mockCamera.currentControls.world.playerState.veclocity.toArray()
    ).toEqual([1, 0, 2]);
    expect(mockCamera.currentControls.world.playerState.keyStates).toEqual({
        KeyW: true,
    });
    expect([...mockListeners.values()].every((set) => set.size === 0)).toBe(
        true
    );
    expect(frames.size).toBe(0);
    stale(1000);
    await flush();
    expect(world.nextUpdate).not.toHaveBeenCalled();
});

test("reduced motion skips dissolve/hold but still waits for final rendered black frame", async () => {
    const pending = controller.depart({ reducedMotion: true });
    await tick(0);
    expect(effect.setProgress).toHaveBeenLastCalledWith(1);
    expect(sky.setProgress).toHaveBeenLastCalledWith(1);
    expect(world.nextUpdate).toHaveBeenCalledTimes(1);
    rendered.shift()();
    await pending;
    expect(mockCamera.active).toBe(false);
});

test("cancellation during final render rejects and cannot acknowledge a late frame", async () => {
    const done = jest.fn();
    const pending = controller.depart({ reducedMotion: true });
    pending.then(done, () => {});
    await tick(0);
    controller.dispose();
    rendered.shift()();
    await flush();
    await expect(pending).rejects.toThrow("Departure cancelled");
    expect(done).not.toHaveBeenCalled();
});

test("bounded adaptive retries restore each intact trial and retain one sky", () => {
    const trials = Array.from({ length: 3 }, () => ({
        stats: { cells: 30 },
        setProgress: jest.fn(),
        dispose: jest.fn(),
    }));
    mockCreateReveal.mockImplementation((_three, _roots, options) => {
        const trial = trials[mockCreateReveal.mock.calls.length - 1];
        options.onSkip({}, "cell bound");
        return trial;
    });
    controller.depart({ reducedMotion: false }).catch(() => {});
    expect(mockCreateReveal.mock.calls.map((call) => call[2].cellSize)).toEqual(
        [2, 4, 8]
    );
    expect(trials[0].dispose).toHaveBeenCalledTimes(1);
    expect(trials[1].dispose).toHaveBeenCalledTimes(1);
    expect(trials[2].dispose).not.toHaveBeenCalled();
    expect(mockCreateSky).toHaveBeenCalledTimes(1);
    expect(sky.dispose).not.toHaveBeenCalled();
});

test("build failure restores camera/player and releases the sky immediately", async () => {
    mockCreateReveal.mockImplementation(() => {
        throw new Error("build failed");
    });
    await expect(controller.depart({ reducedMotion: false })).rejects.toThrow(
        "build failed"
    );
    expect(mockCamera.active).toBe(true);
    expect(mockCamera.currentControls.enabled).toBe(true);
    expect(mockPlayers.main.avatar3D.emote).toBe(7);
    expect(sky.dispose).toHaveBeenCalledTimes(1);
    expect(frames.size).toBe(0);
});

test("a delayed first frame still gives the rendered black state its full hold", async () => {
    const pending = controller.depart({ reducedMotion: false });
    await tick(1000);
    expect(effect.setProgress).toHaveBeenLastCalledWith(1);
    expect(world.nextUpdate).not.toHaveBeenCalled();
    await tick(1149);
    expect(world.nextUpdate).not.toHaveBeenCalled();
    await tick(1150);
    expect(world.nextUpdate).toHaveBeenCalledTimes(1);
    rendered.shift()();
    await pending;
});

test("retained renderer cleanup never restores the old pose or sky into its next space", async () => {
    const pending = controller.depart({ reducedMotion: true });
    await tick(0);
    rendered.shift()();
    await pending;
    mockRoot.currentSpace = { scene: new THREE.Group() };
    mockPlayers.main.position.set(80, 2, 90);
    mockCamera.current.position.set(81, 3, 94);
    const nextBackground = new THREE.Color("red"),
        nextFog = {};
    mockScene.background = nextBackground;
    mockScene.fog = nextFog;
    effect.dispose.mockImplementation(() => {
        mockScene.background = null;
        mockScene.fog = null;
    });
    for (const callback of [...mockListeners.get("render")]) callback();
    expect(mockPlayers.main.position.toArray()).toEqual([80, 2, 90]);
    expect(mockCamera.current.position.toArray()).toEqual([81, 3, 94]);
    expect(mockScene.background).toBe(nextBackground);
    expect(mockScene.fog).toBe(nextFog);
    expect(mockCamera.currentControls.enabled).toBe(true);
    expect([...mockListeners.values()].every((set) => set.size === 0)).toBe(
        true
    );
});

test("a prior successful fit avoids failed departure builds without relaxing geometry budgets", () => {
    const {
        rememberWorldRevealFitHint,
    } = require("@features/lobby/worldRevealFitHints");
    const settings = {
        cellSize: 2,
        radius: 18,
        coverage: "all",
        refinement: { minCellSize: 0.25, maxCellSize: 4, detailRadius: 8 },
        rigidProps: {
            minTriangles: 5000,
            maxExtent: 5,
            maxSources: 64,
            maxTriangles: 400000,
        },
        maxCells: 12000,
        maxFragments: 20000,
        maxTriangles: 120000,
        maxClipTests: 1000000,
    };
    rememberWorldRevealFitHint(
        mockRoot.currentSpace.scene,
        settings,
        { cellSize: 4, budgetLimited: false },
        window.location.pathname
    );
    controller.depart({ reducedMotion: false }).catch(() => {});
    expect(mockCreateReveal).toHaveBeenCalledTimes(1);
    expect(mockCreateReveal.mock.calls[0][2]).toMatchObject({
        ...settings,
        cellSize: 4,
    });
});

test("returns an immutable feet-relative view matching the final rendered camera, including free-look and collision distance", async () => {
    const camera = mockCamera.current;
    const player = mockPlayers.main;
    player.position.set(12, 1.5, -8);
    player.rotation.y = 1.2;
    player.avatar3D.headPosition = new THREE.Vector3(0, 2.7, 0);
    camera.position.set(12.8, 3.1, -7.3);
    camera.lookAt(11.6, 2.8, -9.5);
    camera.fov = 71;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    const feet = player.position.clone();
    const expected = [0, 1.35, 2.7].map((height) =>
        feet.clone().add(new THREE.Vector3(0, height, 0)).project(camera)
    );
    const pending = controller.depart({ reducedMotion: true });
    await tick(0);
    rendered.shift()();
    const view = await pending;
    expect(view).toMatchObject({
        avatarHeight: 2.7,
        avatarRotation: 1.2,
        avatarLift: 0,
        cameraMode: "third-person",
        fov: 71,
    });
    expect(view.cameraOffset).toEqual({
        x: expect.any(Number),
        y: expect.any(Number),
        z: expect.any(Number),
    });
    const returnedCamera = new THREE.PerspectiveCamera(
        view.fov,
        camera.aspect,
        camera.near,
        camera.far
    );
    returnedCamera.position.set(
        view.cameraOffset.x,
        view.cameraOffset.y,
        view.cameraOffset.z
    );
    returnedCamera.lookAt(
        view.cameraTargetOffset.x,
        view.cameraTargetOffset.y,
        view.cameraTargetOffset.z
    );
    returnedCamera.updateMatrixWorld(true);
    [0, 1.35, 2.7].forEach((height, index) => {
        const projected = new THREE.Vector3(0, height, 0).project(
            returnedCamera
        );
        expect(projected.x).toBeCloseTo(expected[index].x, 6);
        expect(projected.y).toBeCloseTo(expected[index].y, 6);
    });
    const savedOffset = { ...view.cameraOffset };
    player.position.set(0, 0, 0);
    camera.position.set(0, 0, 0);
    expect(view.cameraOffset).toEqual(savedOffset);
});

test.each([
    [80000, 128000],
    [100001, 160000],
])(
    "dense departure source count %s uses the same capped allowance after exclusions",
    (triangles, budget) => {
        const dense = new THREE.Mesh(
            new THREE.BufferGeometry(),
            new THREE.MeshBasicMaterial()
        );
        dense.geometry.setAttribute(
            "position",
            new THREE.Float32BufferAttribute([0, 0, 0], 3)
        );
        dense.geometry.index = { count: triangles * 3 };
        const backdrop = dense.clone();
        const avatar = dense.clone();
        avatar.name = "avatarContainer";
        mockRoot.currentSpace.scene.add(dense, backdrop, avatar);
        sky.supportedSources = [backdrop];
        controller.depart({ reducedMotion: false }).catch(() => {});
        expect(mockCreateReveal.mock.calls[0][2]).toMatchObject({
            cellSize: 2,
            maxTriangles: budget,
            maxClipTests: 1000000,
            maxCells: 12000,
        });
    }
);

test.each([true, false])(
    "return view preserves visible native VRM0=%s front/back and off-center landmarks",
    async (isVersion0) => {
        const player = mockPlayers.main;
        const camera = mockCamera.current;
        player.avatar3D.isVersion0 = isVersion0;
        player.rotation.y = -0.8;
        camera.updateMatrixWorld(true);
        const nativeModel = new THREE.Object3D();
        nativeModel.position.copy(player.position);
        // This is the actual Wrapper.rotation convention, not the bridge helper.
        nativeModel.rotation.y = player.rotation.y + (isVersion0 ? 0 : Math.PI);
        nativeModel.updateMatrixWorld(true);
        const landmarks = [
            new THREE.Vector3(0.3, 1.4, -0.2),
            new THREE.Vector3(-0.2, 0.8, 0.1),
        ];
        const expected = landmarks.map((point) =>
            nativeModel.localToWorld(point.clone()).project(camera)
        );
        const pending = controller.depart({ reducedMotion: true });
        await tick(0);
        rendered.shift()();
        const view = await pending;
        const lobbyCamera = new THREE.PerspectiveCamera(
            view.fov,
            camera.aspect,
            camera.near,
            camera.far
        );
        lobbyCamera.position.set(
            view.cameraOffset.x,
            view.cameraOffset.y,
            view.cameraOffset.z
        );
        lobbyCamera.lookAt(
            view.cameraTargetOffset.x,
            view.cameraTargetOffset.y,
            view.cameraTargetOffset.z
        );
        lobbyCamera.updateMatrixWorld(true);
        const lobbyModel = new THREE.Object3D();
        lobbyModel.rotation.y = view.avatarRotation;
        lobbyModel.updateMatrixWorld(true);
        landmarks.forEach((point, index) => {
            const projected = lobbyModel
                .localToWorld(point.clone())
                .project(lobbyCamera);
            expect(projected.x).toBeCloseTo(expected[index].x, 6);
            expect(projected.y).toBeCloseTo(expected[index].y, 6);
        });
        expect(view.avatarRotation).toBeCloseTo(nativeModel.rotation.y);
        expect(player.rotation.y).toBeCloseTo(-0.8);
    }
);

test("return uses the ready idle from the first departure hold and hands off its last rendered phase", async () => {
    const avatar = mockPlayers.main.avatar3D;
    avatar.isHighQuality = true;
    avatar.vrm = { possibleActions: { IDLE_CC0: { time: 0 } } };
    avatar.setCurrentAction = jest.fn((action) => {
        avatar.currentAction = action;
    });
    const pending = controller.depart({ reducedMotion: false });
    expect(avatar.currentAction.name).toBe("IDLE_CC0");
    expect(avatar.emote).toBe(-1);
    await tick(700);
    await tick(850);
    // A frame may render after the final dissolve tick; transfer that phase.
    avatar.vrm.possibleActions.IDLE_CC0.time = 1.375;
    rendered.shift()();
    const view = await pending;
    expect(view.avatarIdleTime).toBe(1.375);
    expect(mockPlayers.main.playEmote).not.toHaveBeenCalled();
    controller.dispose();
    expect(avatar.travelReadyIdle).toBeUndefined();
});

test("Back reuses arrival buffers at current feet and rebuilds only late media", async () => {
    const {
        rememberWorldTransition,
    } = require("@features/lobby/worldTransitionCache");
    const cached = {
        stats: { cells: 9000, maxDistance: 80 },
        park: jest.fn(() => true),
        canReuse: jest.fn(() => true),
        restart: jest.fn(() => true),
        getAddedSources: jest.fn(() => []),
        setProgress: jest.fn(),
        dispose: jest.fn(),
    };
    rememberWorldTransition(mockRoot.currentSpace.scene, cached, {
        cellSize: 2,
        triangleBudget: 160000,
        refinement: { minCellSize: 0.25, maxCellSize: 4 },
    });
    // A poster/video/model arriving after the reveal is a separate fresh layer.
    const video = new THREE.Mesh(new THREE.PlaneGeometry(2, 1));
    mockRoot.currentArtworks.add(video);
    mockPlayers.main.position.set(60, 2, 20);
    controller.depart({ reducedMotion: false }).catch(() => {});
    expect(cached.restart).toHaveBeenCalledWith({
        anchor: new THREE.Vector3(60, 2, 20),
        mode: "dissolve",
        direction: "inward",
    });
    expect(mockCreateReveal).toHaveBeenCalledTimes(1);
    expect(mockCreateReveal.mock.calls[0][1]).toContain(
        mockRoot.currentArtworks
    );
    expect(mockCreateReveal.mock.calls[0][1]).not.toContain(
        mockRoot.currentSpace.scene
    );
    expect(mockCreateReveal.mock.calls[0][2]).toMatchObject({
        maxTriangles: 30000,
        waveExtent: 80,
    });
    await tick(300);
    expect(cached.setProgress).toHaveBeenCalled();
    expect(effect.setProgress).toHaveBeenCalled();
    controller.dispose();
    expect(cached.dispose).not.toHaveBeenCalled();
    expect(cached.park).toHaveBeenCalledTimes(2);
});

test("departure captures animated room subtrees in the fresh moving layer", () => {
    const animated = new THREE.Group();
    animated.name = "moving-room-prop";
    animated.add(new THREE.Mesh(new THREE.BoxGeometry()));
    const room = mockRoot.currentSpace.scene;
    room.add(animated);
    room.animations = [
        new THREE.AnimationClip("turn", 1, [
            new THREE.QuaternionKeyframeTrack(
                "moving-room-prop.quaternion",
                [0, 1],
                [0, 0, 0, 1, 0, 1, 0, 0]
            ),
        ]),
    ];
    controller.depart({ reducedMotion: false }).catch(() => {});
    const roomCall = mockCreateReveal.mock.calls.find((call) =>
        call[1].includes(room)
    );
    const movingCall = mockCreateReveal.mock.calls.find((call) =>
        call[1].includes(animated)
    );
    expect(roomCall[2].exclude(animated)).toBe(true);
    expect(movingCall[2].exclude(animated)).toBe(false);
    expect(movingCall[2].hideRoots).toContain(animated);
});

test("native mirrors dim continuously on departure and restore when cancelled", async () => {
    const reflector = new THREE.Mesh(
        new THREE.PlaneGeometry(),
        mirrorMaterial(0.6)
    );
    reflector.isReflector = true;
    mockRoot.currentSpace.scene.add(reflector);
    const pending = controller.depart({ reducedMotion: false });
    const cancelled = expect(pending).rejects.toThrow("Departure cancelled");
    expect(mockCreateReveal.mock.calls.at(-1)[2].exclude(reflector)).toBe(true);
    expect(reflector.material.uniforms.opacity.value).toBe(0.6);
    await tick(WORLD_DISSOLVE_MS * 0.15);
    expect(reflector.visible).toBe(true);
    expect(reflector.material.uniforms.opacity.value).toBeCloseTo(0.3);
    await tick(WORLD_DISSOLVE_MS * 0.3);
    expect(reflector.visible).toBe(false);
    controller.dispose();
    await cancelled;
    expect(reflector.visible).toBe(true);
    expect(reflector.material.uniforms.opacity.value).toBe(0.6);
});

test("artwork beyond the room bounds cannot give nearby artwork a later departure wave", async () => {
    effect.stats.maxDistance = 40;
    effect.setRevealAnchor = jest.fn();
    const media = {
        stats: { cells: 10, maxDistance: 120 },
        setProgress: jest.fn(),
        setRevealAnchor: jest.fn(),
        dispose: jest.fn(),
    };
    mockRoot.currentArtworks.add(new THREE.Mesh());
    mockCreateReveal.mockReturnValueOnce(effect).mockReturnValueOnce(media);
    controller.depart({ reducedMotion: false }).catch(() => {});
    await flush();
    expect(effect.setRevealAnchor).toHaveBeenCalledWith(
        mockPlayers.main.position,
        120
    );
    expect(media.setRevealAnchor).toHaveBeenCalledWith(
        mockPlayers.main.position,
        120
    );
});
