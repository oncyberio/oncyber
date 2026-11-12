/** @jest-environment jsdom */
import { waitForNextSceneUpdate } from "./nextSceneUpdate";
import type { LobbyTravelView } from "@features/lobby/lobbyJourneyProtocol";
import { WORLD_TRAVEL_HANDOFF_MS } from "@features/lobby/worldTravelPose";
import { WORLD_TILE_REVEAL_MS } from "@features/lobby/worldTileMotion";
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
// Camera/ownership tests below drive an explicit presentation position.
// The real frame clock is exercised separately and in the stalled-frame case.
const mockCreateRevealClock = jest.fn((duration: number) => ({
    sample: (now: number) => Math.min(1, now / duration),
}));
jest.mock("@features/lobby/worldRevealClock", () => ({
    createWorldRevealClock: (duration: number) => mockCreateRevealClock(duration),
}));

const mockCompile = jest.fn(async (..._args: any[]) => {});
jest.mock("@3renderer", () => ({ __esModule: true, default: { compileAsync: (...args) => mockCompile(...args) } }), { virtual: true });
const mockCamera: any = {};
const mockScene: any = {};
const mockTravelPeers = {
    hasAvatars: true,
    prepare: jest.fn(async () => {}),
    update: jest.fn(),
    standUp: jest.fn(),
    dispose: jest.fn(),
};
const mockCreateTravelPeers = jest.fn(() => mockTravelPeers);
jest.mock("./lobbyTravelPeers", () => ({
    createLobbyTravelPeers: () => mockCreateTravelPeers(),
}));
jest.mock("@features/lobby/webgpu/avatarAdapter", () => ({
    createAvatar: jest.fn(),
}));
const mockTravelAnimation = {
    active: true,
    prepare: jest.fn(async () => {}),
    hold: jest.fn(),
    standUp: jest.fn(() => 0),
    dispose: jest.fn(),
};
jest.mock("./nativeTravelAnimation", () => ({
    createNativeTravelAnimation: () => mockTravelAnimation,
    NATIVE_TRAVEL_STAND_UP_MS: 805,
}));
jest.mock("../globals/shared", () => ({
    __esModule: true,
    default: { animationTimer: { value: 0 } },
}));
const mockResolveGroundedFeet = jest.fn();
const mockSynchronizeGrounding = jest.fn((..._args: any[]) => true);
jest.mock("./nativeTravelGrounding", () => ({
    resolveNativeTravelGroundedFeet: (...args) =>
        mockResolveGroundedFeet(...args),
    synchronizeNativeTravelGrounding: (...args) =>
        mockSynchronizeGrounding(...args),
}));
const mockPlayers: any = {};
const mockRoot: any = {};
const mockListeners = new Map<string, Set<() => void>>();
const mockEmitter = {
    on: (name, fn) => {
        if (!mockListeners.has(name)) mockListeners.set(name, new Set());
        mockListeners.get(name).add(fn);
    },
    off: (name, fn) => mockListeners.get(name)?.delete(fn),
};
const mockSky = {
    supportedSources: [] as any[],
    stats: { tiles: 864, sources: 1 },
    setProgress: jest.fn(),
    dispose: jest.fn(),
};
const mockEffect = {
    stats: {
        cells: 12,
        triangles: 30,
        skipped: 1,
        batches: 2,
        drawCalls: 4,
        vertices: 90,
    },
    setProgress: jest.fn(),
    setRevealAnchor: jest.fn(),
    dispose: jest.fn(),
};
let mockCanvas: HTMLCanvasElement, mockCss: HTMLDivElement;
let mockFirstPerson = true;
jest.mock("three", () => jest.requireActual("three"));
jest.mock(
    "@3constants",
    () => ({
        get IS_FIRST_PERSON() {
            return mockFirstPerson;
        },
        IS_MOBILE: false,
        ORIENTATION: "landscape",
        PORTRAIT: "portrait",
    }),
    { virtual: true }
);
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
jest.mock("../root", () => ({ __esModule: true, default: mockRoot }));
jest.mock("../camera/constants", () => {
    const { Vector3 } = require("three");
    return {
        MAX_ZOOM_OUT: 6,
        DIRECTION: {
            FORWARD: new Vector3(0, 0, 1),
            BACKWARD: new Vector3(0, 0, -1),
            LEFT: new Vector3(1, 0, 0),
            RIGHT: new Vector3(-1, 0, 0),
        },
    };
});
jest.mock("../constants", () => ({
    get IS_FIRST_PERSON() {
        return mockFirstPerson;
    },
    SET_IS_FIRST_PERSON(value) {
        mockFirstPerson = value;
    },
    get CANVAS() {
        return mockCanvas;
    },
    get CSS_CANVAS() {
        return mockCss;
    },
}));
const mockCreateReveal = jest.fn((..._args: any[]) => mockEffect);
jest.mock("@features/lobby/worldCubeReveal", () => ({
    createWorldCubeReveal: (...args) => mockCreateReveal(...args),
    // eslint-disable-next-line require-yield
    buildWorldCubeReveal: function* (...args) {
        return mockCreateReveal(...args);
    },
}));
const mockCreateSky = jest.fn((..._args: any[]) => mockSky);
jest.mock(
    "@features/lobby/worldSkyReveal",
    () => ({
        createWorldSkyReveal: (...args) => mockCreateSky(...args),
    }),
    { virtual: true }
);
const flush = async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve();
};
const view = {
    cameraOffset: { x: 2, y: 3, z: 6 },
    cameraTargetOffset: { x: 0, y: 1, z: 0 },
    avatarRotation: 1.2,
    avatarLift: 0.38,
    avatarHeight: 1.8,
    fov: 60,
    cameraMode: "third-person" as const,
};
let frames: Map<number, FrameRequestCallback>, frameId: number;
let rendered: Array<() => void>, controller: any, world: any;
beforeEach(() => {
    window.history.replaceState(null, "", "/");
    frames = new Map();
    frameId = 0;
    rendered = [];
    mockCompile.mockClear();
    mockListeners.clear();
    mockResolveGroundedFeet.mockReset();
    mockSynchronizeGrounding.mockClear();
    mockTravelPeers.hasAvatars = true;
    mockCreateTravelPeers.mockClear();
    mockTravelPeers.prepare.mockReset().mockResolvedValue(undefined);
    mockTravelAnimation.prepare.mockReset().mockResolvedValue(undefined);
    mockTravelAnimation.hold.mockClear();
    mockTravelAnimation.standUp.mockReset().mockReturnValue(0);
    mockTravelAnimation.dispose.mockClear();
    mockTravelPeers.standUp.mockClear();
    mockTravelPeers.update.mockClear();
    mockTravelPeers.dispose.mockClear();
    mockCanvas = document.createElement("canvas");
    document.body.appendChild(mockCanvas);
    mockCss = document.createElement("div");
    mockCss.style.visibility = "visible";
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
    camera.position.set(8, 9, 10);
    // Existing legacy fixtures intentionally provide no authored spawn heading.
    // Heading-specific tests below exercise the native metadata/camera fallbacks.
    camera.getWorldDirection = undefined;
    mockCamera.current = camera;
    mockCamera.active = true;
    mockFirstPerson = true;
    window.sessionStorage.clear();
    const third = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
    third.rotation.order = "YXZ";
    third.getCameraHeight = () => 3.6;
    third.theta = third.phi = third.radius = third.targetRadius = 0;
    mockCamera.currentControls = {
        enabled: true,
        setCamera: jest.fn(),
        world: {
            rayIntersect: () => null,
            thirdPersonPos: new THREE.Vector3(10, 2, 20),
            playerState: { veclocity: new THREE.Vector3(), keyStates: {} },
        },
    };
    mockCamera.setThirdPerson = jest.fn(async () => {
        mockFirstPerson = false;
        mockCamera.current = third;
    });
    mockCamera.setFirstPerson = jest.fn(async () => {
        mockFirstPerson = true;
        mockCamera.current = camera;
    });
    mockCamera.updateFrustum = jest.fn();
    const avatar: any = {
        isVersion0: true,
        visible: false,
        opacity: 0.25,
        emote: -1,
        onFloor: false,
        isJumping: true,
        floorVelocity: 3,
        smoothedFloorVelocity: 2,
        headPosition: { y: 3.6 },
        baseScaleRatio: 2,
        highQualityMeshes: { scale: new THREE.Vector3(2, 2, 2) },
    };
    avatar.stopEmote = jest.fn(() => {
        avatar.emote = -1;
        avatar.emoteResolve = null;
    });
    mockPlayers.main = {
        position: new THREE.Vector3(10, 2, 20),
        rotation: new THREE.Euler(0, 0.4, 0),
        visible: false,
        avatar3D: avatar,
        updateAvatar: jest.fn(),
        show: jest.fn(() => {
            mockPlayers.main.visible = true;
            avatar.visible = true;
        }),
        playEmote: jest.fn((index) => {
            avatar.emote = index;
            avatar.emoteResolve = () => {};
            return new Promise(() => {});
        }),
    };
    mockPlayers.instances = [];
    mockRoot.currentSpace = { scene: {} };
    mockRoot.currentArtworks = new THREE.Group();
    mockRoot.currentStreams = new THREE.Group();
    mockRoot.currentPortals = new THREE.Group();
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
    mockCreateReveal.mockClear();
    mockCreateSky.mockClear();
    mockSky.supportedSources = [];
    mockSky.setProgress.mockClear();
    mockSky.dispose.mockClear();
    mockEffect.setProgress.mockClear();
    mockTravelAnimation.standUp.mockClear();
    mockEffect.setRevealAnchor.mockClear();
    mockEffect.dispose.mockClear();
    controller = require("./lobbyWorldReveal").createNativeLobbyReveal(world);
});
afterEach(() => {
    controller.dispose();
    mockCanvas.remove();
    jest.restoreAllMocks();
});
async function stage(travelView: LobbyTravelView = view) {
    const promise = controller.prepare({
        travelView,
        reducedMotion: false,
    });
    await flush();
    rendered.shift()();
    await promise;
}
async function runFrame(now: number) {
    // The next tile step waits for the renderer to present the previous one.
    if (!frames.size && rendered.length) { rendered.shift()(); await flush(); }
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((fn) => fn(now));
    await flush();
}
async function finish(travelView: LobbyTravelView = view) {
    const promise = controller.reveal({
        travelView,
        reducedMotion: false,
    });
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((fn) => fn(WORLD_TILE_REVEAL_MS));
    await flush();
    rendered.shift()();
    await flush();
    await runFrame(WORLD_TRAVEL_HANDOFF_MS);
    rendered.shift()();
    await promise;
}
test("cancelling during the mode-switch microtask restores the original camera", async () => {
    const original = mockCamera.current;
    const promise = controller.prepare({
        travelView: view,
        reducedMotion: false,
    });
    const rejected = expect(promise).rejects.toThrow("Arrival cancelled");
    expect(mockFirstPerson).toBe(false);
    controller.dispose();
    await rejected;
    expect(mockFirstPerson).toBe(true);
    expect(mockCamera.current).toBe(original);
    expect(mockCamera.current.position.toArray()).toEqual([8, 9, 10]);
    expect(mockCamera.active).toBe(true);
    expect(mockCamera.currentControls.enabled).toBe(true);
    expect(world.nextUpdate).not.toHaveBeenCalled();
});
test("staging locks the crouched travel rig and camera until a rendered frame acknowledges it", async () => {
    let ready = false;
    const promise = controller
        .prepare({ travelView: view, reducedMotion: false })
        .then(() => {
            ready = true;
        });
    await flush();
    expect(ready).toBe(false);
    expect(mockCamera.active).toBe(false);
    expect(mockCamera.currentControls.enabled).toBe(false);
    expect(mockTravelAnimation.prepare).toHaveBeenCalledWith(false);
    expect(mockTravelAnimation.hold).toHaveBeenCalledWith(
        expect.objectContaining({ visible: true, height: 1.8 }),
        expect.any(Number)
    );
    expect(mockPlayers.main.playEmote).not.toHaveBeenCalled();
    expect(mockPlayers.main.avatar3D.visible).toBe(false);
    expect(mockPlayers.main.avatar3D.opacity).toBe(1);
    expect(mockPlayers.main.position.toArray()).toEqual([10, 2.38, 20]);
    expect(mockPlayers.main.avatar3D.baseScaleRatio).toBe(1);
    expect(mockPlayers.main.avatar3D.highQualityMeshes.scale.toArray()).toEqual(
        [1, 1, 1]
    );
    expect(mockPlayers.main.avatar3D.headPosition.y).toBe(3.6);
    expect(mockCamera.current.position.toArray()).toEqual([12, 5, 26]);
    mockCamera.current.position.set(99, 99, 99);
    mockPlayers.main.position.set(0, 0, 0);
    mockListeners.get("render").forEach((fn) => fn());
    expect(mockCamera.current.position.toArray()).toEqual([12, 5, 26]);
    expect(mockPlayers.main.position.toArray()).toEqual([10, 2.38, 20]);
    rendered.shift()();
    await promise;
    expect(ready).toBe(true);
});
test("arrival automatically settles into selected third-person and waits for its rendered frame", async () => {
    await stage();
    let complete = false;
    const promise = controller
        .reveal({ travelView: view, reducedMotion: false })
        .then(() => {
            complete = true;
        });
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((fn) => fn(WORLD_TILE_REVEAL_MS));
    await flush();
    expect(complete).toBe(false);
    expect(mockEffect.setProgress).toHaveBeenLastCalledWith(1);
    rendered.shift()();
    await flush();
    expect(complete).toBe(false);
    expect(mockCamera.active).toBe(false);
    expect(mockPlayers.main.visible).toBe(true);
    expect(mockCamera.current.position.toArray()).toEqual([12, 5, 26]);
    expect(mockCss.style.visibility).toBe("visible");
    await runFrame(WORLD_TRAVEL_HANDOFF_MS / 2);
    expect(complete).toBe(false);
    expect(mockCamera.active).toBe(false);
    expect(mockPlayers.main.avatar3D.baseScaleRatio).toBeGreaterThan(1);
    expect(mockPlayers.main.avatar3D.baseScaleRatio).toBeLessThan(2);
    await runFrame(WORLD_TRAVEL_HANDOFF_MS);
    expect(complete).toBe(false);
    expect(
        window.sessionStorage.getItem("oncyber:camera-preference")
    ).toBeNull();
    rendered.shift()();
    await promise;
    expect(complete).toBe(true);
    expect(mockCamera.active).toBe(true);
    expect(mockCamera.currentControls.enabled).toBe(true);
    expect(mockCamera.current.position.toArray()).not.toEqual([8, 9, 10]);
    expect(mockFirstPerson).toBe(false);
    expect(mockCamera.setThirdPerson).toHaveBeenCalledWith(false, true);
    expect(window.sessionStorage.getItem("oncyber:camera-preference")).toBe(
        "third_person"
    );
    expect(mockCamera.current.fov).toBe(75);
    expect(mockPlayers.main.position.toArray()).toEqual([10, 2, 20]);
    expect(mockPlayers.main.avatar3D.emote).toBe(-1);
    expect(mockPlayers.main.visible).toBe(true);
    expect(mockPlayers.main.avatar3D.baseScaleRatio).toBe(2);
    expect(mockPlayers.main.avatar3D.highQualityMeshes.scale.toArray()).toEqual(
        [2, 2, 2]
    );
    expect(mockListeners.get("pre").size).toBe(0);
    expect(mockListeners.get("render").size).toBe(0);
});
test("cancel restores owned state and rejects pending reveal without stale-frame effects", async () => {
    await stage();
    const promise = controller.reveal({
        travelView: view,
        reducedMotion: false,
    });
    const queued = [...frames.values()];
    const rejected = expect(promise).rejects.toThrow("Arrival cancelled");
    controller.dispose();
    await rejected;
    queued.forEach((fn) => fn(WORLD_TILE_REVEAL_MS));
    expect(mockCamera.active).toBe(true);
    expect(mockCamera.currentControls.enabled).toBe(true);
    expect(mockCamera.current.position.toArray()).toEqual([8, 9, 10]);
    expect(mockCamera.current.fov).toBe(75);
    expect(mockPlayers.main.position.toArray()).toEqual([10, 2, 20]);
    expect(mockPlayers.main.avatar3D).toMatchObject({
        visible: false,
        opacity: 0.25,
        onFloor: false,
        isJumping: true,
    });
    expect(frames.size).toBe(0);
    expect(mockCss.style.visibility).toBe("visible");
    expect(world.nextUpdate).toHaveBeenCalledTimes(1);
});
test("cancellation during automatic camera settling restores original mode and dimensions", async () => {
    await stage();
    const promise = controller.reveal({
        travelView: view,
        reducedMotion: false,
    });
    const rejected = expect(promise).rejects.toThrow("Arrival cancelled");
    await runFrame(WORLD_TILE_REVEAL_MS);
    rendered.shift()();
    await flush();
    await runFrame(WORLD_TRAVEL_HANDOFF_MS / 2);
    const queued = [...frames.values()];
    controller.dispose();
    await rejected;
    queued.forEach((fn) => fn(WORLD_TRAVEL_HANDOFF_MS));
    expect(mockFirstPerson).toBe(true);
    expect(mockCamera.current.position.toArray()).toEqual([8, 9, 10]);
    expect(mockPlayers.main.position.toArray()).toEqual([10, 2, 20]);
    expect(mockPlayers.main.avatar3D.baseScaleRatio).toBe(2);
    expect(mockCamera.active).toBe(true);
    expect(frames.size).toBe(0);
    expect(
        window.sessionStorage.getItem("oncyber:camera-preference")
    ).toBeNull();
});
test("staging and every settling frame keep the camera in front of a spawn wall", async () => {
    controller.dispose();
    const wall = new THREE.Box3(
        new THREE.Vector3(-100, -10, 23),
        new THREE.Vector3(100, 100, 23.2)
    );
    mockCamera.currentControls.world.rayIntersect = (ray) => {
        const hit = ray.intersectBox(wall, new THREE.Vector3());
        return hit ? { distance: hit.distanceTo(ray.origin) } : null;
    };
    controller = require("./lobbyWorldReveal").createNativeLobbyReveal(world);
    await stage();
    expect(mockCamera.current.position.z).toBeLessThan(23);
    const promise = controller.reveal({
        travelView: view,
        reducedMotion: false,
    });
    await runFrame(WORLD_TILE_REVEAL_MS);
    expect(mockCamera.current.position.z).toBeLessThan(23);
    rendered.shift()();
    await flush();
    for (const time of [0, 120, 240, 360, 480, WORLD_TRAVEL_HANDOFF_MS]) {
        await runFrame(time);
        expect(mockCamera.current.position.z).toBeLessThan(23);
    }
    rendered.shift()();
    await promise;
    expect(mockFirstPerson).toBe(false);
});
test("cancel after settling but before final render still restores the original mode", async () => {
    await stage();
    const promise = controller.reveal({
        travelView: view,
        reducedMotion: false,
    });
    const rejected = expect(promise).rejects.toThrow("Arrival cancelled");
    await runFrame(WORLD_TILE_REVEAL_MS);
    rendered.shift()();
    await flush();
    await runFrame(WORLD_TRAVEL_HANDOFF_MS);
    expect(mockFirstPerson).toBe(false);
    controller.dispose();
    rendered.shift()();
    await rejected;
    expect(mockFirstPerson).toBe(true);
    expect(mockCamera.current.position.toArray()).toEqual([8, 9, 10]);
    expect(
        window.sessionStorage.getItem("oncyber:camera-preference")
    ).toBeNull();
});
test("explicit first-person selection remains first-person after automatic settling", async () => {
    const firstView = { ...view, cameraMode: "first-person" as const };
    const staged = controller.prepare({
        travelView: firstView,
        reducedMotion: false,
    });
    await flush();
    rendered.shift()();
    await staged;
    const promise = controller.reveal({
        travelView: firstView,
        reducedMotion: false,
    });
    await runFrame(WORLD_TILE_REVEAL_MS);
    rendered.shift()();
    await flush();
    await runFrame(WORLD_TRAVEL_HANDOFF_MS);
    rendered.shift()();
    await promise;
    expect(mockFirstPerson).toBe(true);
    expect(mockPlayers.main.visible).toBe(false);
    expect(mockPlayers.main.avatar3D.visible).toBe(false);
    expect(mockCamera.current.position.toArray()).toEqual([10, 5.6, 20]);
    expect(mockCamera.current.quaternion.toArray().every(Number.isFinite)).toBe(
        true
    );
    expect(window.sessionStorage.getItem("oncyber:camera-preference")).toBe(
        "first_person"
    );
});
test("changing reduced motion mid-reveal completes after the next rendered frame", async () => {
    controller.dispose();
    const motion = { matches: false };
    const prior = window.matchMedia;
    window.matchMedia = () => motion as MediaQueryList;
    try {
        controller =
            require("./lobbyWorldReveal").createNativeLobbyReveal(world);
        await stage();
        const promise = controller.reveal({
            travelView: view,
            reducedMotion: false,
        });
        let callbacks = [...frames.values()];
        frames.clear();
        callbacks.forEach((fn) => fn(400));
        expect(mockEffect.setProgress).not.toHaveBeenLastCalledWith(1);
        motion.matches = true;
        await flush();
        callbacks = [...frames.values()];
        frames.clear();
        callbacks.forEach((fn) => fn(416));
        expect(mockEffect.setProgress).toHaveBeenLastCalledWith(1);
        rendered.shift()();
        await flush();
        await runFrame(0);
        expect(mockCamera.active).toBe(true);
        rendered.shift()();
        await promise;
        expect(mockFirstPerson).toBe(false);
    } finally {
        window.matchMedia = prior;
    }
});
test("development canvas exposes actual reveal stats and restores prior attributes", async () => {
    controller.dispose();
    const previous = process.env.NODE_ENV;
    (process.env as Record<string, string>).NODE_ENV = "development";
    mockCanvas.setAttribute("data-world-reveal-cells", "previous");
    try {
        controller =
            require("./lobbyWorldReveal").createNativeLobbyReveal(world);
        expect(mockCanvas.getAttribute("data-world-reveal-cells")).toBe("12");
        expect(mockCanvas.getAttribute("data-world-reveal-triangles")).toBe(
            "30"
        );
        expect(mockCanvas.getAttribute("data-world-reveal-skipped")).toBe("1");
        expect(mockCanvas.getAttribute("data-world-reveal-drawcalls")).toBe(
            "4"
        );
        expect(mockCanvas.getAttribute("data-world-reveal-batches")).toBe("2");
        await stage();
        expect(mockCanvas.getAttribute("data-world-reveal-progress")).toBe("0");
        await finish();
        expect(mockCanvas.getAttribute("data-world-reveal-progress")).toBe("1");
        controller.dispose();
        expect(mockCanvas.getAttribute("data-world-reveal-cells")).toBe(
            "previous"
        );
        expect(
            mockCanvas.getAttribute("data-world-reveal-progress")
        ).toBeNull();
    } finally {
        (process.env as Record<string, string>).NODE_ENV = previous;
    }
});

export {};

test("successful arrival clears stale emote and movement state, points rear camera forward and accepts W immediately", async () => {
    controller.dispose();
    const { PlayerState } = require("../camera/controls/physics/playerstate");
    const state = new PlayerState();
    state.keyStates = { KeyS: true };
    state.joystickStates = { ANGLE: 180 };
    state.joystickState.pan.set(1, 0, 1);
    state.veclocity.set(3, 2, 1);
    state.isJumping = true;
    state.rotation.set(0, -2, 0);
    state.quaternion.setFromEuler(state.rotation);
    mockCamera.currentControls.world.playerState = state;
    mockCamera.active = false;
    mockCamera.currentControls.enabled = false;
    mockPlayers.main.deactivated = true;
    mockPlayers.main.isSitting = true;
    mockPlayers.main.seatedMesh = {};
    mockPlayers.main.avatar3D.emote = 7;
    mockPlayers.main.avatar3D.emoteResolve = () => {};
    controller = require("./lobbyWorldReveal").createNativeLobbyReveal(world);
    await stage();
    await finish();
    expect(mockPlayers.main.avatar3D).toMatchObject({
        emote: -1,
        onFloor: true,
        isJumping: false,
        floorVelocity: 0,
        smoothedFloorVelocity: 0,
    });
    expect(mockPlayers.main).toMatchObject({
        isSitting: false,
        deactivated: false,
        isMoving: false,
        seatedMesh: null,
    });
    expect(mockCamera.active).toBe(true);
    expect(mockCamera.currentControls.enabled).toBe(true);
    expect(state.keyStates).toEqual({});
    expect(state.joystickStates).toEqual({});
    expect(state.joystickState.pan.length()).toBe(0);
    expect(state.veclocity.length()).toBe(0);
    expect(state.rotation.y).toBeCloseTo(view.avatarRotation);
    expect(
        state.quaternion.angleTo(
            new THREE.Quaternion().setFromEuler(mockPlayers.main.rotation)
        )
    ).toBeCloseTo(0);
    const behind = new THREE.Vector3(
        Math.sin(view.avatarRotation),
        0,
        Math.cos(view.avatarRotation)
    );
    const offset = mockCamera.current.position
        .clone()
        .sub(mockPlayers.main.position)
        .setY(0)
        .normalize();
    expect(offset.dot(behind)).toBeCloseTo(1);
    expect(mockCamera.current.theta).toBeCloseTo(
        (view.avatarRotation * 180) / Math.PI
    );
    state.speed = 10;
    state.keyStates.KeyW = true;
    state.keyControls(1 / 60, mockCamera.current);
    expect(state.veclocity.length()).toBeGreaterThan(0);
    expect(state.veclocity.clone().normalize().dot(behind)).toBeCloseTo(-1);
    expect(state.tempRotation).toBeCloseTo(view.avatarRotation);
    delete state.keyStates.KeyW;
    state.keyControls(1 / 60, mockCamera.current);
    expect(state.direction.length()).toBe(0);
});
test("rear wall clearance stays in the rear shoulder sector, never returning to the front", async () => {
    controller.dispose();
    const wall = new THREE.Box3(
        new THREE.Vector3(-100, -10, 20.65),
        new THREE.Vector3(100, 100, 20.85)
    );
    mockCamera.currentControls.world.rayIntersect = (ray) => {
        const hit = ray.intersectBox(wall, new THREE.Vector3());
        return hit ? { distance: hit.distanceTo(ray.origin) } : null;
    };
    controller = require("./lobbyWorldReveal").createNativeLobbyReveal(world);
    const frontView = {
        ...view,
        avatarRotation: 0,
        cameraOffset: { x: 0, y: 3, z: -6 },
    };
    await stage(frontView);
    await finish(frontView);
    const offset = mockCamera.current.position
        .clone()
        .sub(mockPlayers.main.position);
    expect(offset.z).toBeGreaterThan(0);
    expect(offset.z).toBeLessThan(0.65);
    expect(Math.abs(Math.atan2(offset.x, offset.z))).toBeLessThanOrEqual(
        (Math.PI * 7) / 36 + 0.001
    );
    expect(mockFirstPerson).toBe(false);
});
test("cancelled arrival restores the previous emote, disabled controls and movement snapshot", async () => {
    controller.dispose();
    const state = mockCamera.currentControls.world.playerState;
    state.keyStates = { KeyS: true };
    state.veclocity.set(3, 2, 1);
    mockCamera.active = false;
    mockCamera.currentControls.enabled = false;
    mockPlayers.main.deactivated = true;
    mockPlayers.main.isSitting = true;
    mockPlayers.main.avatar3D.emote = 7;
    mockPlayers.main.avatar3D.emoteResolve = () => {};
    controller = require("./lobbyWorldReveal").createNativeLobbyReveal(world);
    await stage();
    const promise = controller.reveal({
        travelView: view,
        reducedMotion: false,
    });
    const rejected = expect(promise).rejects.toThrow("Arrival cancelled");
    await runFrame(WORLD_TILE_REVEAL_MS);
    rendered.shift()();
    await flush();
    await runFrame(WORLD_TRAVEL_HANDOFF_MS);
    controller.dispose();
    rendered.shift()();
    await rejected;
    expect(mockPlayers.main.avatar3D.emote).toBe(7);
    expect(mockPlayers.main.deactivated).toBe(true);
    expect(mockPlayers.main.isSitting).toBe(true);
    expect(mockCamera.active).toBe(false);
    expect(mockCamera.currentControls.enabled).toBe(false);
    expect(state.keyStates).toEqual({ KeyS: true });
    expect(state.veclocity.toArray()).toEqual([3, 2, 1]);
});

test("native staging starts the outward wave at the player feet", async () => {
    expect(mockCreateReveal.mock.calls[0][1]).toEqual([
        mockRoot.currentSpace.scene,
    ]);
    expect(mockCreateReveal.mock.calls[0][2].hideRoots).toEqual([]);
    expect(mockRoot.currentArtworks.visible).toBe(false);
    expect(mockRoot.currentStreams.visible).toBe(false);
    expect(mockRoot.currentPortals.visible).toBe(false);
    await stage();
    const origin = mockEffect.setRevealAnchor.mock.calls.at(-1)[0];
    expect([origin.x, origin.y, origin.z]).toEqual([10, 2, 20]);
    controller.dispose();
});

test("wide galleries retain fine local tiles and cover distant architecture with adaptive shells", () => {
    const original = mockCreateReveal.mock.calls[0][2];
    expect(original).toMatchObject({
        cellSize: 2,
        radius: 18,
        refinement: { minCellSize: 0.25, maxCellSize: 4, detailRadius: 8 },
        maxTriangles: 120000,
    });
    controller.dispose();
    mockRoot.currentSpace.bbox = new THREE.Box3(
        new THREE.Vector3(-60, -5, -160),
        new THREE.Vector3(60, 90, 160)
    );
    controller = require("./lobbyWorldReveal").createNativeLobbyReveal(world);
    const wide = mockCreateReveal.mock.calls.at(-1)[2];
    expect(wide).toMatchObject({ coverage: "all", radius: 18, cellSize: 2 });
    expect(wide.radius / wide.cellSize).toBe(
        original.radius / original.cellSize
    );
    expect(wide.maxCells).toBe(original.maxCells);
    expect(wide.maxTriangles).toBe(original.maxTriangles);
});

test("missing or invalid gallery bounds retain the compact-room reveal", () => {
    controller.dispose();
    mockRoot.currentSpace.bbox = new THREE.Box3(
        new THREE.Vector3(NaN, 0, NaN),
        new THREE.Vector3(Infinity, 0, Infinity)
    );
    controller = require("./lobbyWorldReveal").createNativeLobbyReveal(world);
    expect(mockCreateReveal.mock.calls.at(-1)[2]).toMatchObject({
        radius: 18,
        cellSize: 2,
    });
});

test("dense geometry is rebuilt with coarser tiles while keeping coverage and budgets", () => {
    controller.dispose();
    mockCreateReveal.mockClear();
    const trial = { ...mockEffect, dispose: jest.fn() };
    mockCreateReveal.mockImplementationOnce((_three, _roots, options) => {
        options.onSkip({ name: "Wide wall" }, "cell bound");
        return trial;
    });
    controller = require("./lobbyWorldReveal").createNativeLobbyReveal(world);
    expect(mockCreateReveal).toHaveBeenCalledTimes(2);
    expect(trial.dispose).toHaveBeenCalledTimes(1);
    const initial = mockCreateReveal.mock.calls[0][2];
    const fitted = mockCreateReveal.mock.calls[1][2];
    expect(fitted.cellSize).toBeGreaterThan(initial.cellSize);
    for (const key of ["radius", "maxCells", "maxTriangles", "maxClipTests"])
        expect(fitted[key]).toBe(initial[key]);
});

test("unsupported shaders do not cause useless rebuilds and geometry retries remain bounded", () => {
    controller.dispose();
    mockCreateReveal.mockClear();
    mockCreateReveal.mockImplementationOnce((_three, _roots, options) => {
        options.onSkip({ name: "Background" }, "shader-material");
        return mockEffect;
    });
    controller = require("./lobbyWorldReveal").createNativeLobbyReveal(world);
    expect(mockCreateReveal).toHaveBeenCalledTimes(1);
    controller.dispose();
    mockCreateReveal.mockClear();
    const skipped = (_three, _roots, options) => {
        options.onSkip({ name: "Dense wall" }, "triangle bound");
        return mockEffect;
    };
    mockCreateReveal
        .mockImplementationOnce(skipped)
        .mockImplementationOnce(skipped)
        .mockImplementationOnce(skipped);
    controller = require("./lobbyWorldReveal").createNativeLobbyReveal(world);
    expect(mockCreateReveal).toHaveBeenCalledTimes(3);
});

test("native reveal covers all architecture and advances the sky on the same timeline", async () => {
    expect(mockCreateReveal.mock.calls[0][2].coverage).toBe("all");
    expect(mockCreateSky.mock.calls[0][1].getCamera()).toBe(mockCamera.current);
    await stage();
    expect(mockSky.setProgress).toHaveBeenLastCalledWith(0);
    const pending = controller.reveal({
        travelView: view,
        reducedMotion: false,
    });
    const rejected = expect(pending).rejects.toThrow("Arrival cancelled");
    await runFrame(WORLD_TILE_REVEAL_MS * 0.5);
    expect(mockSky.setProgress).toHaveBeenLastCalledWith(0.5);
    expect(mockEffect.setProgress).toHaveBeenLastCalledWith(0.5);
    controller.dispose();
    await rejected;
    expect(mockSky.dispose).toHaveBeenCalledTimes(1);
    expect(mockEffect.dispose.mock.invocationCallOrder.at(-1)).toBeLessThan(
        mockSky.dispose.mock.invocationCallOrder.at(-1)
    );
});

test("sky sources are excluded from geometry and survive adaptive geometry rebuilds", () => {
    controller.dispose();
    const background = new THREE.Mesh();
    background.name = "backgroundMesh";
    mockRoot.currentSpace.scene = new THREE.Group();
    mockRoot.currentSpace.scene.add(background);
    mockSky.supportedSources = [background];
    mockSky.dispose.mockClear();
    mockCreateSky.mockClear();
    const trial = { ...mockEffect, dispose: jest.fn() };
    mockCreateReveal.mockImplementationOnce((_three, _roots, options) => {
        options.onSkip({ name: "Tall wall" }, "cell bound");
        return trial;
    });
    controller = require("./lobbyWorldReveal").createNativeLobbyReveal(world);
    expect(mockCreateSky).toHaveBeenCalledTimes(1);
    expect(mockCreateSky.mock.calls[0][1].sources).toEqual([background]);
    expect(mockCreateReveal.mock.calls.at(-1)[2].exclude(background)).toBe(
        true
    );
    expect(trial.dispose).toHaveBeenCalledTimes(1);
    expect(mockSky.dispose).not.toHaveBeenCalled();
});

test("sky state is restored if geometry preparation fails", () => {
    controller.dispose();
    mockSky.dispose.mockClear();
    mockCreateReveal.mockImplementationOnce(() => {
        throw new Error("Invalid geometry");
    });
    expect(() =>
        require("./lobbyWorldReveal").createNativeLobbyReveal(world)
    ).toThrow("Invalid geometry");
    expect(mockSky.dispose).toHaveBeenCalledTimes(1);
});

test("repeated destination preparation keeps the same loaded travel rig", async () => {
    await stage();
    await stage();
    for (const callback of mockListeners.get("render")) callback();
    expect(mockTravelAnimation.prepare).toHaveBeenCalledTimes(1);
    expect(mockTravelAnimation.hold).toHaveBeenCalled();
    expect(mockPlayers.main.playEmote).not.toHaveBeenCalled();
});

test("authored spawn heading frames the room while retaining the lobby avatar composition", async () => {
    controller.dispose();
    const heading = 1.1;
    mockCamera.currentControls.world.roomParameters = {
        initialPlayerRotation: { x: 0, y: heading, z: 0 },
    };
    mockPlayers.main.rotation.y = -2;
    controller = require("./lobbyWorldReveal").createNativeLobbyReveal(world);
    const frontView = {
        ...view,
        avatarRotation: 0,
        cameraOffset: { x: 0, y: 3, z: -6 },
    };
    await stage(frontView);
    const camera = mockCamera.current;
    const offset = camera.position.clone().sub(mockPlayers.main.position);
    expect(Math.atan2(offset.x, offset.z)).toBeCloseTo(heading);
    // The avatar still faces the cinematic camera, independent of world yaw.
    expect(Math.cos(mockPlayers.main.rotation.y - heading)).toBeCloseTo(-1);
    expect(mockPlayers.main.position.toArray()).toEqual([10, 2.38, 20]);
    const target = new THREE.Vector3(10, 3, 20).project(camera);
    expect(target.x).toBeCloseTo(0);
    expect(target.y).toBeCloseTo(0);
});

test("repeated staging rotates party offsets once using the captured spawn heading", async () => {
    controller.dispose();
    mockCamera.currentControls.world.roomParameters = {
        initialPlayerRotation: { y: Math.PI / 2 },
    };
    controller = require("./lobbyWorldReveal").createNativeLobbyReveal(world);
    const partyView = {
        ...view,
        cameraOffset: { x: 0, y: 3, z: 6 },
        spawnOffset: { x: 2, y: 0, z: 0 },
        peers: [
            {
                id: "party-peer",
                name: "Friend",
                offset: { x: 1, y: 0, z: 0 },
                rotation: 0,
            },
        ],
    };
    const untouched = JSON.stringify(partyView);
    await stage(partyView);
    expect(mockPlayers.main.position.x).toBeCloseTo(10);
    expect(mockPlayers.main.position.z).toBeCloseTo(18);
    expect(mockCamera.current.position.x).toBeCloseTo(16);
    expect(mockCamera.current.position.z).toBeCloseTo(18);
    expect(mockTravelPeers.prepare).toHaveBeenCalledTimes(1);
    const first = mockTravelPeers.prepare.mock.calls[0] as any[];
    expect(first[0][0].offset.x).toBeCloseTo(0);
    expect(first[0][0].offset.z).toBeCloseTo(-1);
    expect(first[0][0].rotation).toBeCloseTo(Math.PI / 2);
    const position = mockCamera.current.position.clone();
    const rotation = mockPlayers.main.rotation.y;
    mockCamera.currentControls.world.roomParameters.initialPlayerRotation.y =
        -1;
    await stage(partyView);
    expect(mockCamera.current.position.distanceTo(position)).toBeCloseTo(0);
    expect(mockPlayers.main.rotation.y).toBeCloseTo(rotation);
    expect(mockTravelPeers.prepare).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(partyView)).toBe(untouched);
});

test("handoff turns the avatar into the authored room view without orbiting the camera back", async () => {
    controller.dispose();
    const heading = 0.8;
    const { PlayerState } = require("../camera/controls/physics/playerstate");
    const state = new PlayerState();
    mockCamera.currentControls.world.playerState = state;
    mockCamera.currentControls.world.roomParameters = {
        initialPlayerRotation: { y: heading },
    };
    controller = require("./lobbyWorldReveal").createNativeLobbyReveal(world);
    const frontView = {
        ...view,
        avatarRotation: 0,
        cameraOffset: { x: 0, y: 3, z: -6 },
    };
    await stage(frontView);
    const initialAvatarYaw = mockPlayers.main.rotation.y;
    const pending = controller.reveal({
        travelView: frontView,
        reducedMotion: false,
    });
    await runFrame(WORLD_TILE_REVEAL_MS);
    rendered.shift()();
    await flush();
    for (const time of [0, 120, 240, 300, 360, 480, WORLD_TRAVEL_HANDOFF_MS]) {
        await runFrame(time);
        const offset = mockCamera.current.position
            .clone()
            .sub(mockPlayers.main.position);
        expect(Math.atan2(offset.x, offset.z)).toBeCloseTo(heading);
        if (time === 300) {
            expect(
                Math.abs(mockPlayers.main.rotation.y - initialAvatarYaw)
            ).toBeCloseTo(Math.PI / 2);
            expect(mockCamera.active).toBe(false);
        }
    }
    rendered.shift()();
    await pending;
    expect(Math.cos(mockPlayers.main.rotation.y - heading)).toBeCloseTo(1);
    expect(Math.cos(state.rotation.y - heading)).toBeCloseTo(1);
    expect(mockCamera.current.theta).toBeCloseTo((heading * 180) / Math.PI);
    expect(mockCamera.active).toBe(true);
    expect(mockPlayers.main.avatar3D.emote).toBe(-1);
    state.speed = 10;
    state.keyStates.KeyW = true;
    state.keyControls(1 / 60, mockCamera.current);
    const forward = new THREE.Vector3(
        -Math.sin(heading),
        0,
        -Math.cos(heading)
    );
    expect(state.veclocity.clone().normalize().dot(forward)).toBeCloseTo(1);
});

test("a close spawn door shortens the authored framing without flipping to the opposite side", async () => {
    controller.dispose();
    mockCamera.currentControls.world.roomParameters = {
        initialPlayerRotation: { y: 0 },
    };
    const door = new THREE.Box3(
        new THREE.Vector3(-100, -10, 20.65),
        new THREE.Vector3(100, 100, 20.85)
    );
    mockCamera.currentControls.world.rayIntersect = (ray) => {
        const hit = ray.intersectBox(door, new THREE.Vector3());
        return hit ? { distance: hit.distanceTo(ray.origin) } : null;
    };
    controller = require("./lobbyWorldReveal").createNativeLobbyReveal(world);
    await stage({ ...view, cameraOffset: { x: 0, y: 3, z: -6 } });
    expect(mockCamera.current.position.z).toBeGreaterThan(20);
    expect(mockCamera.current.position.z).toBeLessThan(20.65);
    const forward = mockCamera.current.getWorldDirection(new THREE.Vector3());
    expect(forward.z).toBeLessThan(0);
    expect(Math.abs(Math.atan2(-forward.x, -forward.z))).toBeLessThanOrEqual(
        Math.PI / 6 + 1e-6
    );
});

test("invalid authored rotation falls back to the original native camera heading", async () => {
    controller.dispose();
    mockCamera.currentControls.world.roomParameters = {
        initialPlayerRotation: { y: NaN },
    };
    mockCamera.current.rotation.set(0, -1.3, 0, "YXZ");
    mockCamera.current.getWorldDirection =
        THREE.Camera.prototype.getWorldDirection;
    controller = require("./lobbyWorldReveal").createNativeLobbyReveal(world);
    await stage();
    const offset = mockCamera.current.position
        .clone()
        .sub(mockPlayers.main.position);
    expect(Math.atan2(offset.x, offset.z)).toBeCloseTo(-1.3);
});

test("authored first-person arrival retains its room heading and selected camera mode", async () => {
    controller.dispose();
    const heading = -0.7;
    mockCamera.currentControls.world.roomParameters = {
        initialPlayerRotation: { y: heading },
    };
    controller = require("./lobbyWorldReveal").createNativeLobbyReveal(world);
    const firstView = { ...view, cameraMode: "first-person" as const };
    await stage(firstView);
    await finish(firstView);
    const camera = mockCamera.current;
    const forward = THREE.Camera.prototype.getWorldDirection.call(
        camera,
        new THREE.Vector3()
    );
    expect(Math.atan2(-forward.x, -forward.z)).toBeCloseTo(heading);
    expect(mockFirstPerson).toBe(true);
    expect(mockPlayers.main.avatar3D.visible).toBe(false);
});

test("cancelling an authored-heading handoff restores the original avatar and camera", async () => {
    controller.dispose();
    mockCamera.currentControls.world.roomParameters = {
        initialPlayerRotation: { y: 1.9 },
    };
    const original = mockCamera.current;
    const originalQuaternion = original.quaternion.clone();
    controller = require("./lobbyWorldReveal").createNativeLobbyReveal(world);
    await stage();
    const pending = controller.reveal({
        travelView: view,
        reducedMotion: false,
    });
    const rejected = expect(pending).rejects.toThrow("Arrival cancelled");
    await runFrame(WORLD_TILE_REVEAL_MS);
    rendered.shift()();
    await flush();
    await runFrame(WORLD_TRAVEL_HANDOFF_MS / 2);
    controller.dispose();
    await rejected;
    expect(mockCamera.current).toBe(original);
    expect(original.position.toArray()).toEqual([8, 9, 10]);
    expect(original.quaternion.angleTo(originalQuaternion)).toBeCloseTo(0);
    expect(mockPlayers.main.rotation.y).toBeCloseTo(0.4);
    expect(mockPlayers.main.position.toArray()).toEqual([10, 2, 20]);
    expect(mockFirstPerson).toBe(true);
});

test("compact arrival keeps the native avatar size and camera fixed through handoff", async () => {
    controller.dispose();
    mockCamera.currentControls.world.roomParameters = {
        initialPlayerRotation: { y: 0 },
    };
    const door = new THREE.Box3(
        new THREE.Vector3(-100, -10, 22.4),
        new THREE.Vector3(100, 100, 22.6)
    );
    mockCamera.currentControls.world.rayIntersect = (ray) => {
        const hit = ray.intersectBox(door, new THREE.Vector3());
        return hit ? { distance: hit.distanceTo(ray.origin) } : null;
    };
    controller = require("./lobbyWorldReveal").createNativeLobbyReveal(world);
    await stage();
    const camera = mockCamera.current;
    const position = camera.position.clone(),
        quaternion = camera.quaternion.clone(),
        fov = camera.fov;
    expect(mockPlayers.main.avatar3D.highQualityMeshes.scale.toArray()).toEqual(
        [2, 2, 2]
    );
    expect(mockPlayers.main.position.y).toBe(2);
    await stage();
    expect(camera.position.distanceTo(position)).toBeCloseTo(0);
    const pending = controller.reveal({
        travelView: view,
        reducedMotion: false,
    });
    await runFrame(WORLD_TILE_REVEAL_MS);
    rendered.shift()();
    await flush();
    for (const time of [0, 120, 300, 480, WORLD_TRAVEL_HANDOFF_MS]) {
        await runFrame(time);
        expect(camera.position.distanceTo(position)).toBeCloseTo(0);
        expect(camera.quaternion.angleTo(quaternion)).toBeCloseTo(0);
        expect(camera.fov).toBe(fov);
        expect(
            mockPlayers.main.avatar3D.highQualityMeshes.scale.toArray()
        ).toEqual([2, 2, 2]);
        expect(mockPlayers.main.position.y).toBe(2);
    }
    rendered.shift()();
    await pending;
    expect(camera.travelFraming).toMatchObject({
        avatarHeight: 3.6,
        blend: 1,
        fov,
    });
    expect(mockCamera.active).toBe(true);
    expect(mockPlayers.main.avatar3D.emote).toBe(-1);
});

test.each([
    [80000, 128000],
    [100001, 160000],
])(
    "dense arrival source count %s gets a capped allowance after background/avatar exclusions",
    (triangles, budget) => {
        controller.dispose();
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
        mockRoot.currentSpace.scene = new THREE.Group();
        mockRoot.currentSpace.scene.add(dense, backdrop, avatar);
        mockSky.supportedSources = [backdrop];
        controller =
            require("./lobbyWorldReveal").createNativeLobbyReveal(world);
        expect(mockCreateReveal.mock.calls.at(-1)[2]).toMatchObject({
            cellSize: 2,
            maxTriangles: budget,
            maxClipTests: 1000000,
            maxCells: 12000,
        });
    }
);

test.each([true, false])(
    "native VRM0=%s preserves the visible lobby heading through staging and rear handoff",
    async (isVersion0) => {
        controller.dispose();
        const player = mockPlayers.main;
        const avatar = player.avatar3D;
        avatar.isVersion0 = isVersion0;
        const model = new THREE.Object3D();
        // Match the real native Wrapper.rotation setter, independently of the
        // conversion under test. Lobby adapters attach their VRM scene directly.
        player.updateAvatar = jest.fn(() => {
            model.rotation.y = player.rotation.y + (isVersion0 ? 0 : Math.PI);
        });
        const heading = 0.7;
        mockCamera.currentControls.world.roomParameters = {
            initialPlayerRotation: { y: heading },
        };
        controller =
            require("./lobbyWorldReveal").createNativeLobbyReveal(world);
        const frontView = {
            ...view,
            avatarRotation: 0,
            cameraOffset: { x: 0, y: 3, z: -6 },
        };
        await stage(frontView);
        const authoredRotation = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            heading - Math.PI
        );
        // An asymmetric model-space landmark proves visible orientation, not
        // merely equality of the different renderers' numeric player rotations.
        const landmark = new THREE.Vector3(0.3, 0.8, -0.2);
        expect(
            landmark
                .clone()
                .applyQuaternion(model.quaternion)
                .distanceTo(landmark.clone().applyQuaternion(authoredRotation))
        ).toBeCloseTo(0);
        await finish(frontView);
        const finalRotation = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            heading
        );
        expect(model.quaternion.angleTo(finalRotation)).toBeCloseTo(0);
        const orbit = mockCamera.current.position
            .clone()
            .sub(player.position)
            .setY(0)
            .normalize();
        expect(Math.atan2(orbit.x, orbit.z)).toBeCloseTo(heading);
        if (!isVersion0) {
            // Square's raw VRM1 front is -Z; the native wrapper normalizes it to
            // +Z. The final camera must see its back, without reversing room view.
            const visibleForward = new THREE.Vector3(0, 0, -1).applyQuaternion(
                model.quaternion
            );
            expect(visibleForward.dot(orbit)).toBeCloseTo(-1);
            expect(Math.cos(player.rotation.y - heading)).toBeCloseTo(-1);
        }
        expect(
            mockCamera.currentControls.world.playerState.tempRotation
        ).toBeCloseTo(player.rotation.y);
    }
);

test("cancelling preparation while the renderer is paused rejects without another update", async () => {
    world.nextUpdate.mockImplementation((signal?: AbortSignal) =>
        waitForNextSceneUpdate(mockEmitter, "post-update", signal)
    );
    const pending = controller.prepare({
        travelView: view,
        reducedMotion: false,
    });
    const rejected = expect(pending).rejects.toMatchObject({
        name: "AbortError",
    });
    await flush();
    expect(mockListeners.get("post-update")?.size).toBe(1);
    const stagedSignal = world.nextUpdate.mock.calls[0][0];
    expect(stagedSignal.aborted).toBe(false);
    controller.dispose();
    await rejected;
    expect(stagedSignal.aborted).toBe(true);
    expect(mockListeners.get("post-update")?.size).toBe(0);
    expect(mockEffect.dispose).toHaveBeenCalledTimes(1);
    expect(mockSky.dispose).toHaveBeenCalledTimes(1);
});

test.each(["reveal", "handoff"] as const)(
    "cancelling the %s completion frame releases its render listener while paused",
    async (phase) => {
        await stage();
        const cancellableFrame = (signal?: AbortSignal) =>
            waitForNextSceneUpdate(mockEmitter, "post-update", signal);
        if (phase === "reveal")
            world.nextUpdate.mockImplementation(cancellableFrame);
        const pending = controller.reveal({
            travelView: view,
            reducedMotion: false,
        });
        const rejected = expect(pending).rejects.toThrow("Arrival cancelled");
        await runFrame(WORLD_TILE_REVEAL_MS);
        if (phase === "handoff") {
            rendered.shift()();
            await flush();
            world.nextUpdate.mockImplementation(cancellableFrame);
            await runFrame(WORLD_TRAVEL_HANDOFF_MS);
        }
        expect(mockListeners.get("post-update")?.size).toBe(1);
        const signal = world.nextUpdate.mock.calls.at(-1)[0];
        expect(signal.aborted).toBe(false);
        controller.dispose();
        await rejected;
        expect(signal.aborted).toBe(true);
        expect(mockListeners.get("post-update")?.size).toBe(0);
        expect(mockFirstPerson).toBe(true);
        expect(mockCamera.current.position.toArray()).toEqual([8, 9, 10]);
        expect(
            window.sessionStorage.getItem("oncyber:camera-preference")
        ).toBeNull();
    }
);

const partyViewForLateLoads = () => ({
    ...view,
    peers: [
        {
            id: "party-peer",
            name: "Friend",
            offset: { x: 1, y: 0, z: -1 },
            rotation: 0,
        },
    ],
});

test("slow party cosmetics do not block native preparation or reattach after handoff", async () => {
    let finishCosmetics: () => void;
    mockTravelPeers.hasAvatars = false;
    const realPeer = { visible: true, avatar3D: { visible: true } };
    mockPlayers.instances = [mockPlayers.main, realPeer];
    mockTravelPeers.prepare.mockImplementationOnce(
        () =>
            new Promise<void>((resolve) => {
                finishCosmetics = resolve;
            })
    );
    await stage(partyViewForLateLoads());
    expect(realPeer.visible).toBe(true);
    expect(realPeer.avatar3D.visible).toBe(true);
    expect(mockTravelPeers.prepare).toHaveBeenCalledTimes(1);
    expect(world.nextUpdate).toHaveBeenCalledTimes(1);
    await finish(partyViewForLateLoads());
    expect(mockTravelPeers.dispose).toHaveBeenCalledTimes(1);
    const position = mockPlayers.main.position.clone();
    const cameraPosition = mockCamera.current.position.clone();
    const updates = mockTravelPeers.update.mock.calls.length;
    finishCosmetics();
    await flush();
    expect(mockPlayers.main.position.equals(position)).toBe(true);
    expect(mockCamera.current.position.equals(cameraPosition)).toBe(true);
    expect(mockTravelPeers.update).toHaveBeenCalledTimes(updates);
    expect(mockCreateTravelPeers).toHaveBeenCalledTimes(1);
});

test("cancellation before the cosmetic module resolves prevents a peer renderer from being created", async () => {
    const pending = controller.prepare({
        travelView: partyViewForLateLoads(),
        reducedMotion: false,
    });
    const rejected = expect(pending).rejects.toThrow();
    await Promise.resolve();
    expect(mockCreateTravelPeers).not.toHaveBeenCalled();
    controller.dispose();
    await flush();
    if (rendered.length) rendered.shift()();
    await rejected;
    expect(mockCreateTravelPeers).not.toHaveBeenCalled();
});

test("real peers arriving during cosmetic reveal regain late avatars and labels at handoff without changing local pose", async () => {
    await stage(partyViewForLateLoads());
    const remote: any = { visible: true };
    mockPlayers.instances = [mockPlayers.main, remote];
    for (const listener of mockListeners.get("render") || []) listener();
    expect(remote.visible).toBe(false);
    remote.avatar3D = { visible: true };
    remote.username = { wrapper: { visible: true } };
    const position = mockPlayers.main.position.clone();
    const cameraPosition = mockCamera.current.position.clone();
    for (const listener of mockListeners.get("render") || []) listener();
    expect(remote.avatar3D.visible).toBe(false);
    expect(remote.username.wrapper.visible).toBe(false);
    expect(mockPlayers.main.position.equals(position)).toBe(true);
    expect(mockCamera.current.position.equals(cameraPosition)).toBe(true);
    await finish(partyViewForLateLoads());
    expect(remote.visible).toBe(true);
    expect(remote.avatar3D.visible).toBe(true);
    expect(remote.username.wrapper.visible).toBe(true);
    const arrived = { visible: true, avatar3D: { visible: true } };
    mockPlayers.instances.push(arrived);
    for (const listener of mockListeners.get("render") || []) listener();
    expect(arrived.visible).toBe(true);
    expect(arrived.avatar3D.visible).toBe(true);
});

test("arrival waits for the authored stand-up and idle blend before enabling movement", async () => {
    mockTravelAnimation.standUp.mockReturnValue(805);
    await stage();
    const promise = controller.reveal({
        travelView: view,
        reducedMotion: false,
    });
    await runFrame(WORLD_TILE_REVEAL_MS);
    rendered.shift()();
    await flush();
    expect(mockTravelAnimation.standUp).toHaveBeenCalledWith(0, false);
    expect(mockTravelPeers.standUp).not.toHaveBeenCalled();
    await runFrame(WORLD_TRAVEL_HANDOFF_MS);
    expect(mockCamera.currentControls.enabled).toBe(false);
    expect(mockTravelAnimation.dispose).not.toHaveBeenCalled();
    await runFrame(805);
    expect(mockCamera.currentControls.enabled).toBe(true);
    expect(mockPlayers.main.avatar3D.travelReadyIdleUntilMovement).toBe(true);
    expect(mockTravelAnimation.dispose).toHaveBeenCalledTimes(1);
    rendered.shift()();
    await promise;
});

test("disposing during local travel asset preparation restores native visibility and rejects the late readiness", async () => {
    let loaded: () => void;
    mockTravelAnimation.prepare.mockImplementation(
        () =>
            new Promise<void>((resolve) => {
                loaded = resolve;
            })
    );
    const preparing = controller.prepare({
        travelView: view,
        reducedMotion: false,
    });
    const rejected = expect(preparing).rejects.toThrow("Arrival cancelled");
    await flush();
    controller.dispose();
    loaded();
    await rejected;
    expect(mockPlayers.main.avatar3D.visible).toBe(false);
    expect(mockPlayers.main.avatar3D.travelReadyIdle).toBeUndefined();
    expect(world.nextUpdate).not.toHaveBeenCalled();
});

test("an older arrival without a travel view reveals its native avatar after replacing the temporary rig", async () => {
    const prepared = controller.prepare({ reducedMotion: false });
    await flush();
    rendered.shift()();
    await prepared;
    const revealed = controller.reveal({ reducedMotion: false });
    await runFrame(WORLD_TILE_REVEAL_MS);
    rendered.shift()();
    await flush();
    rendered.shift()();
    await revealed;
    expect(mockPlayers.main.avatar3D.visible).toBe(true);
    expect(mockPlayers.main.visible).toBe(true);
    expect(mockTravelAnimation.dispose).toHaveBeenCalledTimes(1);
});

test("completed arrival transfers its room buffers to Back instead of disposing them", async () => {
    const cache = require("@features/lobby/worldTransitionCache");
    const reusable = mockEffect as any;
    reusable.park = jest.fn(() => true);
    reusable.canReuse = jest.fn(() => true);
    try {
        await stage();
        await finish();
        expect(reusable.park).toHaveBeenCalled();
        expect(mockEffect.dispose).not.toHaveBeenCalled();
        controller.dispose();
        expect(mockEffect.dispose).not.toHaveBeenCalled();
        expect(
            cache.takeWorldTransition(mockRoot.currentSpace.scene)?.effect
        ).toBe(mockEffect);
    } finally {
        cache.clearWorldTransitionCache();
        delete reusable.park;
        delete reusable.canReuse;
    }
});

test("arrival keeps animated room subtrees out of the static cache", () => {
    controller.dispose();
    mockCreateReveal.mockClear();
    const animated = new THREE.Group();
    animated.name = "moving-room-prop";
    animated.add(new THREE.Mesh(new THREE.BoxGeometry()));
    const room = new THREE.Group();
    mockRoot.currentSpace.scene = room;
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
    controller = require("./lobbyWorldReveal").createNativeLobbyReveal(world);
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

test("native mirrors fade while geometry assembles and survive the final source swap", async () => {
    controller.dispose();
    const reflector = new THREE.Mesh(
        new THREE.PlaneGeometry(4, 4),
        mirrorMaterial(0.7)
    );
    reflector.isReflector = true;
    mockRoot.currentSpace.scene = new THREE.Group();
    mockRoot.currentSpace.scene.add(reflector);
    controller = require("./lobbyWorldReveal").createNativeLobbyReveal(world);
    expect(mockCreateReveal.mock.calls.at(-1)[2].exclude(reflector)).toBe(true);
    await stage();
    expect(reflector.visible).toBe(false);
    const pending = controller.reveal({
        travelView: view,
        reducedMotion: false,
    });
    await runFrame(WORLD_TILE_REVEAL_MS * 0.825);
    expect(reflector.visible).toBe(true);
    expect(reflector.material.uniforms.opacity.value).toBeCloseTo(0.35);
    await runFrame(WORLD_TILE_REVEAL_MS);
    expect(reflector.material.uniforms.opacity.value).toBe(0.7);
    rendered.shift()();
    await flush();
    await runFrame(WORLD_TRAVEL_HANDOFF_MS);
    rendered.shift()();
    await pending;
    expect(reflector.visible).toBe(true);
    expect(reflector.material.uniforms.opacity.value).toBe(0.7);
});

test("cancelling arrival restores the authored mirror opacity", async () => {
    controller.dispose();
    const reflector = new THREE.Mesh(
        new THREE.PlaneGeometry(),
        mirrorMaterial(0.45)
    );
    reflector.isReflector = true;
    mockRoot.currentSpace.scene = new THREE.Group();
    mockRoot.currentSpace.scene.add(reflector);
    controller = require("./lobbyWorldReveal").createNativeLobbyReveal(world);
    await stage();
    const pending = controller.reveal({
        travelView: view,
        reducedMotion: false,
    });
    const cancelled = expect(pending).rejects.toThrow("Arrival cancelled");
    await runFrame(WORLD_TILE_REVEAL_MS * 0.8);
    controller.dispose();
    await cancelled;
    expect(reflector.visible).toBe(true);
    expect(reflector.material.uniforms.opacity.value).toBe(0.45);
});

test("arrival stages on the nearby floor and seeds physics from the same feet before resuming", async () => {
    mockResolveGroundedFeet.mockReturnValue(new THREE.Vector3(10, 1.94, 20));
    mockSynchronizeGrounding.mockImplementationOnce((_physics, feet) => {
        expect(mockCamera.active).toBe(false);
        expect(mockCamera.currentControls.enabled).toBe(false);
        expect(feet.toArray()).toEqual([10, 1.94, 20]);
        expect(mockFirstPerson).toBe(false);
        expect(mockCamera.currentControls.setCamera).toHaveBeenLastCalledWith(
            mockCamera.current
        );
        return true;
    });
    await stage();
    expect(mockEffect.setRevealAnchor.mock.calls.at(-1)[0].toArray()).toEqual([
        10, 1.94, 20,
    ]);
    expect(mockPlayers.main.position.y).toBeCloseTo(1.94 + view.avatarLift);
    // A late preference may flip the flag without replacing the staged camera.
    mockFirstPerson = true;
    await finish();
    expect(mockSynchronizeGrounding).toHaveBeenCalledTimes(1);
    expect(mockPlayers.main.position.toArray()).toEqual([10, 1.94, 20]);
    expect(mockCamera.currentControls.world.thirdPersonPos.toArray()).toEqual([
        10, 1.94, 20,
    ]);
    expect(mockCamera.active).toBe(true);
});

test("cancelled grounded staging leaves the original physics state untouched", async () => {
    mockResolveGroundedFeet.mockReturnValue(new THREE.Vector3(10, 1.94, 20));
    await stage();
    controller.dispose();
    expect(mockSynchronizeGrounding).not.toHaveBeenCalled();
    expect(mockPlayers.main.position.toArray()).toEqual([10, 2, 20]);
});

test("a delayed first rendered frame cannot skip the entire square reveal", async () => {
    mockCreateRevealClock.mockImplementationOnce(
        jest.requireActual("@features/lobby/worldRevealClock").createWorldRevealClock
    );
    await stage();
    const pending = controller.reveal({travelView: view, reducedMotion: false});
    const cancelled = pending.catch(error => error);
    await runFrame(15000);
    expect(mockEffect.setProgress).toHaveBeenLastCalledWith(0);
    await runFrame(25000);
    expect(mockEffect.setProgress).toHaveBeenLastCalledWith(50 / WORLD_TILE_REVEAL_MS);
    expect(mockTravelAnimation.standUp).not.toHaveBeenCalled();
    controller.dispose();
    expect(await cancelled).toBeInstanceOf(Error);
});

test("arrival stands up during the reveal's tail and holds input until both have finished", async () => {
    // The floor around the travellers is assembled at 10% of the reveal.
    (mockEffect as any).completeWithin = jest.fn(() => 0.1);
    mockTravelAnimation.standUp.mockReturnValue(805);
    // Both loops run at once here: present every pending frame, then tick.
    const step = async (now: number) => {
        rendered.splice(0).forEach((present) => present());
        await flush();
        const callbacks = [...frames.values()];
        frames.clear();
        callbacks.forEach((fn) => fn(now));
        await flush();
    };
    try {
        await stage();
        let complete = false;
        const pending = controller
            .reveal({ travelView: view, reducedMotion: false })
            .then(() => {
                complete = true;
            });
        // 805 ms of a 1,000 ms reveal: the latest start is at 19.5%.
        await step(0.15 * WORLD_TILE_REVEAL_MS);
        expect(mockTravelAnimation.standUp).not.toHaveBeenCalled();
        await step(0.25 * WORLD_TILE_REVEAL_MS);
        expect(mockTravelAnimation.standUp).toHaveBeenCalledTimes(1);
        expect(mockEffect.setProgress).toHaveBeenLastCalledWith(0.25);
        // Near the end, the far tiles are still assembling.
        await step(0.95 * WORLD_TILE_REVEAL_MS);
        await step(0.96 * WORLD_TILE_REVEAL_MS);
        expect(mockEffect.setProgress).toHaveBeenLastCalledWith(0.96);
        expect(complete).toBe(false);
        expect(mockCamera.active).toBe(false);
        expect(mockCamera.currentControls.enabled).toBe(false);
        for (let i = 0; i < 6 && !complete; i++)
            await step(WORLD_TILE_REVEAL_MS + i);
        await pending;
        expect(complete).toBe(true);
        expect(mockEffect.setProgress).toHaveBeenLastCalledWith(1);
        expect(mockTravelAnimation.standUp).toHaveBeenCalledTimes(1);
        expect(mockCamera.active).toBe(true);
        expect(mockCamera.currentControls.enabled).toBe(true);
    } finally {
        delete (mockEffect as any).completeWithin;
    }
});

test("without a nearby floor, arrival stands up only after the reveal", async () => {
    (mockEffect as any).completeWithin = jest.fn(() => 1);
    try {
        await stage();
        controller
            .reveal({ travelView: view, reducedMotion: false })
            .catch(() => {});
        await runFrame(0.9 * WORLD_TILE_REVEAL_MS);
        expect(mockTravelAnimation.standUp).not.toHaveBeenCalled();
    } finally {
        delete (mockEffect as any).completeWithin;
    }
});

test("cube reveal prewarms both render variants and schedules every display frame", async () => {
    await stage();
    expect(mockCompile).toHaveBeenCalledTimes(2);
    const pending = controller.reveal({ travelView: view, reducedMotion: false }).catch(error => error);
    await runFrame(16);
    expect(frames.size).toBe(1);
    expect(rendered).toHaveLength(0);
    await runFrame(32);
    expect(mockEffect.setProgress).toHaveBeenLastCalledWith(32 / WORLD_TILE_REVEAL_MS);
    controller.dispose();
    await pending;
});

test("native room-to-room travel keeps the outgoing idle pose rather than popping into a crouch", async () => {
    await stage({ ...view, avatarTravelPose: "idle" });
    expect(mockTravelAnimation.prepare).toHaveBeenLastCalledWith(true);
});
