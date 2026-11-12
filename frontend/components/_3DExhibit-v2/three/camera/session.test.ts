/** @jest-environment jsdom */
const mockThree = require("three");
const mockMain = new mockThree.PerspectiveCamera();
mockMain.setState = jest.fn(async () => mockMain.position.set(4, 3, 8));
const mockPlayerCamera = new mockThree.PerspectiveCamera();
mockPlayerCamera.setState = jest.fn(async () => {});
mockPlayerCamera.setSpace = jest.fn();
const mockPlayers: any = { main: new mockThree.Object3D() };
const mockConstants: any = {
    APP_STATES: { INTRO: "intro", SPACE: "space", IDLE: "idle" },
    CURRENT_STATE: "intro",
    CURRENT_SPACE: null,
    IS_FIRST_PERSON: false,
    SET_IS_FIRST_PERSON: (value: boolean) => {
        mockConstants.IS_FIRST_PERSON = value;
    },
    SET_IS_DEBUG_VIEW: jest.fn(),
    USER_HEIGHT: 3,
    USER_INTERACTED: new Promise(() => {}),
    DOWN_VECTOR: new mockThree.Vector3(0, -1, 0),
};
jest.mock("three", () => jest.requireActual("three"));
jest.mock("./main", () => ({ __esModule: true, default: mockMain }));
jest.mock("./player", () => ({ __esModule: true, default: mockPlayerCamera }));
jest.mock("./editmode", () => ({}));
jest.mock("./vr", () => ({}));
jest.mock("./debug", () => ({}));
jest.mock("./portal", () => ({}));
jest.mock("./sample", () => ({}));
jest.mock("./mapcamera", () => ({}));
jest.mock("./transition", () => ({}));
jest.mock("./exposition", () => ({}));
jest.mock("./controls", () => ({}));
jest.mock("./controls/highlightcontrols", () => ({}));
jest.mock("./utils", () => ({
    __esModule: true,
    default: {
        intersectRay: async () => ({
            position: new mockThree.Vector3(4, 0.25, 8),
        }),
    },
}));
jest.mock("./constants", () => ({}));
jest.mock("gsap", () => ({
    __esModule: true,
    default: { delayedCall: jest.fn() },
}));
jest.mock("@3constants", () => mockConstants, { virtual: true });
jest.mock(
    "@3factory/player",
    () => ({ __esModule: true, default: mockPlayers }),
    { virtual: true }
);
jest.mock(
    "@3emitter",
    () => ({ __esModule: true, default: { on: jest.fn(), emit: jest.fn() } }),
    { virtual: true }
);
jest.mock("@3events", () => ({}), { virtual: true });
jest.mock("@3scene", () => ({}), { virtual: true });
jest.mock("@3shared", () => ({}), { virtual: true });
jest.mock("@3gui", () => ({}), { virtual: true });
jest.mock(
    "@3abstract/augmented",
    () => ({ __esModule: true, default: class {} }),
    { virtual: true }
);
jest.mock("@3modules/cinematic", () => ({}), { virtual: true });
jest.mock("@3factory/multiplayer", () => ({}), { virtual: true });
jest.mock("@utils/js", () => ({}));
jest.mock("../factory/abstract/spaceitem", () => ({}));
jest.mock("../globals/audioListener", () => ({
    __esModule: true,
    default: new mockThree.Object3D(),
}));
jest.mock("../raycaster", () => ({}));
jest.mock("../factory/player/constants", () => ({}));
jest.mock("@components/_3DExhibit-v2/utils/constants", () => ({
    soloDefaultSpaces: [],
}));

jest.mock("./controls/physics/playerstate", () => ({ PlayerState: class {} }));
jest.mock("./controls/physics/collisions", () => ({}));
jest.mock("@components/_3DExhibit-v2/three/utils/camera", () => ({
    getUserInitialPositions: () => ({ userHeight: 3, colliderHeight: 2.75 }),
}));
const { Physics } = require("./controls/physics");
const camera = require("./index").default;

beforeEach(() => {
    jest.clearAllMocks();
    mockConstants.CURRENT_STATE = "intro";
    mockConstants.IS_FIRST_PERSON = false;
    mockConstants.CURRENT_SPACE = { space: {}, roomParameters: {} };
    mockPlayers.main = new mockThree.Object3D();
    mockPlayers.main.show = jest.fn();
    camera.active = false;
    camera.isTransitioning = false;
    camera.isFly = false;
    camera.thirdPersonCamInited = true;
    camera.current = mockPlayerCamera;
    camera.createControls = jest.fn(async () => {
        const world = new Physics({ camera: mockMain, roomParameters: {} });
        world.update = jest.fn();
        return {
            world,
            removeEvents: jest.fn(),
            addEvents: jest.fn(),
            setCamera: jest.fn((next) => {
                world.setCamera(next);
            }),
        };
    });
});

test("a new space binds movement to its initial camera even after leaving third person", async () => {
    await camera.setState("space", { space: {}, roomParameters: {} });

    expect(mockConstants.IS_FIRST_PERSON).toBe(true);
    expect(camera.active).toBe(true);
    expect(camera.current).toBe(mockMain);
    expect(camera.currentControls.world.target).toBe(mockMain.position);
    expect(camera.thirdPersonCamInited).toBe(false);
    expect(mockPlayerCamera.setState).toHaveBeenCalled();

    // The actual physics target must move the camera, not an off-screen avatar.
    camera.currentControls.world.target.x += 2;
    expect(camera.current.position.x).toBe(6);
    expect(mockPlayers.main.position.x).toBe(4);
});

test("the saved third-person preference can be reapplied to the new player", async () => {
    await camera.setState("space", { space: {}, roomParameters: {} });
    await camera.setThirdPerson(false, true);

    expect(mockConstants.IS_FIRST_PERSON).toBe(false);
    expect(camera.current).toBe(mockPlayerCamera);
    expect(camera.currentControls.world.target).toBe(mockPlayers.main.position);
    expect(mockPlayerCamera.setSpace).toHaveBeenCalled();
    expect(camera.currentControls.addEvents).toHaveBeenCalled();
});

// A module, so its top-level names stay out of the other test scripts.
export {};
