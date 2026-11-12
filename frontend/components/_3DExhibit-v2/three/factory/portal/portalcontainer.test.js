// The real container and the real portal state machine, over stubbed engine
// modules: what a failed opening leaves behind, and what the next press does.

jest.mock("three", () => {
    class Object3D {
        constructor() {
            this.parent = null;
        }
        add(child) {
            if (child) child.parent = this;
        }
        remove(child) {
            if (child) child.parent = null;
        }
    }
    class Value {}
    return {
        Group: Object3D,
        Mesh: Value,
        Vector3: Value,
        Material: Value,
        Matrix4: Value,
        Euler: Value,
        AnimationMixer: Value,
        Quaternion: Value,
        Raycaster: Value,
        LoopOnce: 0,
    };
});
// Opening a portal into another world reads that world's full exhibit first;
// these tests are about the container, so there is nothing more to read.
jest.mock(
    "@utils/csr",
    () => ({ getPortalExhibit: jest.fn(async () => null) }),
    {
        virtual: true,
    }
);
jest.mock("gsap", () => ({
    __esModule: true,
    default: { delayedCall: jest.fn(() => ({ kill: jest.fn() })) },
}));
jest.mock(
    "@3constants",
    () => ({
        APP_STATES: { SPACE: "space" },
        CURRENT_SPACE: {
            exhibit: { id: "here" },
            space: {},
            roomParameters: {},
        },
        CURRENT_USER: {},
        EDITION_TRANSFORM_CONTROL: {},
        EDIT_MODE: false,
        IS_DESKTOP: true,
        IS_FIRST_PERSON: true,
        IS_MOBILE: false,
        IS_VR: false,
        IS_VR_SUPPORTED: false,
        TRANSITION_ACTIONS: {},
        UPLOADER_MODE: false,
    }),
    { virtual: true }
);
jest.mock(
    "@3factory/abstract/spaceitem",
    () => {
        const { Group } = require("three");
        class SpaceItem extends Group {
            listeners = {};
            on(type, listener) {
                this.listeners[type] = [
                    ...(this.listeners[type] || []),
                    listener,
                ];
            }
            off(type, listener) {
                this.listeners[type] = (this.listeners[type] || []).filter(
                    (it) => it !== listener
                );
            }
            emit(type, event) {
                (this.listeners[type] || []).forEach((it) => it(event));
            }
            onSelect() {}
            disposeResources() {}
        }
        return { SpaceItem };
    },
    { virtual: true }
);
jest.mock(
    "@3emitter",
    () => ({
        __esModule: true,
        default: { emit: jest.fn(), on: jest.fn(), off: jest.fn() },
    }),
    { virtual: true }
);
jest.mock(
    "@3events",
    () => ({
        __esModule: true,
        default: new Proxy({}, { get: (_, name) => String(name) }),
    }),
    { virtual: true }
);
jest.mock(
    "@3camera",
    () => ({
        __esModule: true,
        default: {
            isEditing: false,
            currentControls: {},
            portalCamera: {
                setSpace: jest.fn(),
                updateWorldMatrix: jest.fn(),
                initControls: jest.fn(async () => {}),
                dispose: jest.fn(),
            },
        },
    }),
    { virtual: true }
);
jest.mock(
    "@3renderer",
    () => ({ __esModule: true, default: { xr: { enabled: false } } }),
    { virtual: true }
);
jest.mock("@3raycaster", () => ({ __esModule: true, default: { TYPES: {} } }), {
    virtual: true,
});
jest.mock("@3scene", () => ({ __esModule: true, default: {} }), {
    virtual: true,
});
jest.mock(
    "@3factory/space",
    () => ({ __esModule: true, default: { get: jest.fn() } }),
    { virtual: true }
);
jest.mock(
    "@3factory/artwork",
    () => ({ __esModule: true, default: { loadPreviewAssets: () => ({}) } }),
    { virtual: true }
);
jest.mock(
    "@3factory/portal",
    () => ({ __esModule: true, default: { loadPreviewPortals: () => ({}) } }),
    { virtual: true }
);
jest.mock(
    "@3factory/sprite",
    () => ({ __esModule: true, default: { get: jest.fn(), TYPES: {} } }),
    { virtual: true }
);
jest.mock(
    "@3gl/renderer/dynamicportal",
    () => ({
        __esModule: true,
        default: { sceneData: null, play: jest.fn(), stop: jest.fn() },
    }),
    { virtual: true }
);
jest.mock(
    "@3gl/renderer/portalscreenshot",
    () => ({ __esModule: true, default: {} }),
    { virtual: true }
);
jest.mock("@3gl/camera/portal", () => ({ PortalCamera: class {} }), {
    virtual: true,
});
jest.mock(
    "@3utils/three",
    () => ({ disposeMaterial: jest.fn(), lookAtDistance: () => 1 }),
    { virtual: true }
);
jest.mock(
    "@3utils/spaceutils",
    () => ({ overrideInitialCoords: (roomParameters) => roomParameters }),
    { virtual: true }
);
jest.mock("@3utils/abort", () => jest.requireActual("../../utils/abort"), {
    virtual: true,
});
jest.mock("@3utils/ui", () => ({ showUIPrompt: jest.fn() }), {
    virtual: true,
});
jest.mock(
    "@3modules/label/constants",
    () => jest.requireActual("../../modules/label/constants.js"),
    { virtual: true }
);
jest.mock(
    "@3modules/label",
    () => {
        const label = {
            currentIntersect: null,
            setState: jest.fn(async () => {}),
            updateMatrixWorld: jest.fn(),
        };
        return {
            __esModule: true,
            default: { get: () => label },
            ...jest.requireActual("../../modules/label/constants.js"),
        };
    },
    { virtual: true }
);
jest.mock("@dapp/explorer", () => ({ getBalance: jest.fn(async () => 1) }), {
    virtual: true,
});
jest.mock(
    "@dapp/checkGating",
    () => ({ checkGating: jest.fn(async () => ({ type: "success" })) }),
    { virtual: true }
);
jest.mock("@utils/saveToDb", () => ({}));
jest.mock("@utils/js", () => ({ delay: async () => {} }));
jest.mock("@components/_3DExhibit-v2/utils/gating", () => ({
    getGatingErrMessage: () => "gated",
    passwordRefusalMessage: jest.requireActual(
        "@components/_3DExhibit-v2/utils/gating"
    ).passwordRefusalMessage,
}));
jest.mock("./portalLOD", () => ({ PortalLOD: { create: jest.fn() } }));
jest.mock("./spawnportal/backportal", () => ({
    __esModule: true,
    default: { get: jest.fn(), updateCoords: jest.fn(), dispose: jest.fn() },
}));
jest.mock("./spawnportal/summonportal", () => ({
    __esModule: true,
    default: { summon: jest.fn() },
}));

import label, { LABEL_STATES } from "@3modules/label";
import Emitter from "@3emitter";
import SpaceFactory from "@3factory/space";
import DynamicRendering from "@3gl/renderer/dynamicportal";
import { showUIPrompt } from "@3utils/ui";
import { ABORT_MSG } from "../../utils/abort";
import BackPortal from "./spawnportal/backportal";
import SummonPortal from "./spawnportal/summonportal";
import { OPEN_FAILED_MESSAGE, STATES } from "./constants";
import { Portal } from "./portal";
import { PortalLOD } from "./portalLOD";
import { PortalContainer } from "./portalcontainer";

const labelMock = label.get();

function destination() {
    return { scene: { add: jest.fn(), dispose: jest.fn() } };
}

async function closedPortal(id, opts = {}) {
    const previewMesh = {
        currentState: null,
        visible: true,
        setState: jest.fn(async function (state) {
            this.currentState = state;
        }),
        disposeMaterials: jest.fn(),
        dispose: jest.fn(),
    };
    const portal = new Portal({
        roomParameters: {},
        isStaticPortal: true,
        exhibitId: `dest-${id}`,
        placeholderData: { portalId: id, meshes: { previewMesh } },
        portalData: {
            exhibit: { id: `dest-${id}`, owner: "0xowner" },
            roomParameters: { slug: "dest" },
            user: {},
        },
        ...opts,
    });
    await portal.setState(STATES.CLOSE);
    return portal;
}

function container() {
    return new PortalContainer({ roomParameters: {}, exhibit: {}, space: {} });
}

/** What the label shows now: its message, or null once it is detached. */
function labelText() {
    const [state, opts] = labelMock.setState.mock.calls.at(-1);
    return state === LABEL_STATES.ATTACHED ? opts.message : null;
}

let consoleError;
beforeEach(() => {
    jest.clearAllMocks();
    DynamicRendering.sceneData = null;
    DynamicRendering.play.mockImplementation(() => {});
    SpaceFactory.get.mockImplementation(async () => destination());
    jest.spyOn(console, "log").mockImplementation(() => {});
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test("a portal opens, and its label invites the visitor in", async () => {
    const portals = container();
    const portal = await closedPortal("a");
    portals.addPortal(portal);
    portals.onCurrPortal({ active: true, currentPortal: portal });
    expect(labelText()).toBe("Press 'E' to open portal");

    await portals.openCurrentPortal();

    expect(portal.currentState).toBe(STATES.OPEN);
    expect(portals.opening).toBe(false);
    expect(labelText()).toBe("You can now walk in!");
    expect(consoleError).not.toHaveBeenCalled();
});

test("a portal that fails while opening says so, and the next press opens it", async () => {
    const portals = container();
    const portal = await closedPortal("a");
    portals.addPortal(portal);
    portals.onCurrPortal({ active: true, currentPortal: portal });
    SpaceFactory.get.mockRejectedValueOnce(new Error("network"));

    await expect(portals.openCurrentPortal()).resolves.toBeUndefined();

    expect(portals.opening).toBe(false);
    expect(portals.previousOpenPortal).toBeNull();
    expect(portal.currentState).toBe(STATES.CLOSE);
    expect(portal.previewMesh.currentState).toBe(STATES.CLOSE);
    expect(labelText()).toBe(OPEN_FAILED_MESSAGE);
    expect(OPEN_FAILED_MESSAGE).toBe("Couldn't open. Try again.");
    // no padlock beside it: the portal is not locked
    expect(labelMock.setState.mock.calls.at(-1)[1].iconUrl).toBeNull();

    await portals.openCurrentPortal();

    expect(portal.currentState).toBe(STATES.OPEN);
    expect(labelText()).toBe("You can now walk in!");
    expect(Emitter.emit).toHaveBeenCalledWith(
        "CUSTOM",
        expect.objectContaining({ type: "PORTAL_OPENED" })
    );
});

test("one failed portal does not stop the other portals of the space", async () => {
    const portals = container();
    const failing = await closedPortal("a");
    const other = await closedPortal("b");
    portals.addPortal(failing);
    portals.addPortal(other);
    portals.onCurrPortal({ active: true, currentPortal: failing });
    SpaceFactory.get.mockRejectedValueOnce(new Error("network"));
    await portals.openCurrentPortal();

    portals.onCurrPortal({ active: false, currentPortal: failing });
    portals.onCurrPortal({ active: true, currentPortal: other });
    await portals.openCurrentPortal();

    expect(other.currentState).toBe(STATES.OPEN);
    expect(failing.currentState).toBe(STATES.CLOSE);
});

test("the failure message goes when the visitor looks away, and the portal reads as closed after", async () => {
    const portals = container();
    const portal = await closedPortal("a");
    portals.addPortal(portal);
    portals.onCurrPortal({ active: true, currentPortal: portal });
    SpaceFactory.get.mockRejectedValueOnce(new Error("network"));
    await portals.openCurrentPortal();
    expect(labelText()).toBe(OPEN_FAILED_MESSAGE);

    portals.onCurrPortal({ active: false, currentPortal: portal });
    expect(labelText()).toBeNull();

    portals.onCurrPortal({ active: true, currentPortal: portal });
    expect(labelText()).toBe("Press 'E' to open portal");
});

test("the failure message is not put on the portal the visitor moved on to", async () => {
    const portals = container();
    const failing = await closedPortal("a");
    const other = await closedPortal("b");
    portals.addPortal(failing);
    portals.addPortal(other);
    portals.onCurrPortal({ active: true, currentPortal: failing });
    let fail;
    SpaceFactory.get.mockReturnValueOnce(
        new Promise((_, reject) => {
            fail = reject;
        })
    );
    const opening = portals.openCurrentPortal();
    await new Promise((done) => setTimeout(done));
    portals.onCurrPortal({ active: false, currentPortal: failing });
    portals.onCurrPortal({ active: true, currentPortal: other });

    fail(new Error("network"));
    await opening;

    expect(failing.currentState).toBe(STATES.CLOSE);
    expect(labelText()).toBe("Press 'E' to open portal");
    expect(labelMock.setState.mock.calls.at(-1)[1].mesh).toBe(
        other.previewMesh
    );
});

test("a failure after the destination started playing stops it and frees it", async () => {
    const portals = container();
    const portal = await closedPortal("a");
    portals.addPortal(portal);
    portals.onCurrPortal({ active: true, currentPortal: portal });
    const space = destination();
    SpaceFactory.get.mockResolvedValueOnce(space);
    DynamicRendering.play.mockImplementationOnce((sceneData) => {
        DynamicRendering.sceneData = sceneData;
        throw new Error("lighting");
    });

    await portals.openCurrentPortal();

    expect(space.scene.dispose).toHaveBeenCalledTimes(1);
    expect(DynamicRendering.stop).toHaveBeenCalledTimes(1);
    expect(portal.space).toBeNull();
    expect(portal.currentState).toBe(STATES.CLOSE);
    expect(labelText()).toBe(OPEN_FAILED_MESSAGE);
});

test("a failed opening leaves another portal's destination playing", async () => {
    const portals = container();
    const portal = await closedPortal("a");
    portals.addPortal(portal);
    portals.onCurrPortal({ active: true, currentPortal: portal });
    DynamicRendering.sceneData = { previewMesh: {} };
    SpaceFactory.get.mockRejectedValueOnce(new Error("network"));

    await portals.openCurrentPortal();

    expect(DynamicRendering.stop).not.toHaveBeenCalled();
});

test("a password prompt that throws releases the portals", async () => {
    const portals = container();
    const portal = await closedPortal("a");
    portal.portalData.exhibit.gating = { password: { password: "sesame" } };
    portals.addPortal(portal);
    portals.onCurrPortal({ active: true, currentPortal: portal });
    showUIPrompt.mockRejectedValueOnce(new Error("no keyboard"));

    await portals.openCurrentPortal();

    expect(portals.opening).toBe(false);
    expect(portal.currentState).toBe(STATES.CLOSE);
    expect(labelText()).toBe(OPEN_FAILED_MESSAGE);

    showUIPrompt.mockResolvedValueOnce("sesame");
    await portals.openCurrentPortal();
    expect(portal.currentState).toBe(STATES.OPEN);
});

test("the portal's password is checked by the server, not against the exhibit", async () => {
    const { checkGating } = jest.requireMock("@dapp/checkGating");
    const portals = container();
    const portal = await closedPortal("a");
    // What an exhibit read carries: the prompt and a revision, no password.
    portal.portalData.exhibit.gating = {
        password: { message: "Ask", rev: "r1" },
    };
    portals.addPortal(portal);
    portals.onCurrPortal({ active: true, currentPortal: portal });
    let refused;
    showUIPrompt.mockImplementationOnce(async ({ onSubmit }) => {
        checkGating.mockResolvedValueOnce({ type: "password-error" });
        refused = await onSubmit("wrong").catch((err) => err.message);
        checkGating.mockResolvedValueOnce({ type: "success" });
        await onSubmit("right");
        return "right";
    });

    await portals.openCurrentPortal();

    expect(refused).toBe("Incorrect password");
    expect(checkGating).toHaveBeenCalledWith(
        portal.portalData.exhibit,
        null,
        "wrong"
    );
    expect(checkGating).toHaveBeenCalledWith(
        portal.portalData.exhibit,
        null,
        "right"
    );
    expect(portal.portalData.password).toBe("right");
    expect(portal.currentState).toBe(STATES.OPEN);
});

test("a dismissed password prompt leaves the portal closed without a failure", async () => {
    const portals = container();
    const portal = await closedPortal("a");
    portal.portalData.exhibit.gating = { password: { password: "sesame" } };
    portals.addPortal(portal);
    portals.onCurrPortal({ active: true, currentPortal: portal });
    showUIPrompt.mockResolvedValueOnce(null);

    await portals.openCurrentPortal();

    expect(portals.opening).toBe(false);
    expect(portal.currentState).toBe(STATES.CLOSE);
    expect(portals.openFailedPortal).toBeNull();
    expect(consoleError).not.toHaveBeenCalled();
});

test("an open portal that fails to close does not block the next opening", async () => {
    const portals = container();
    const first = await closedPortal("a");
    const second = await closedPortal("b");
    portals.addPortal(first);
    portals.addPortal(second);
    portals.onCurrPortal({ active: true, currentPortal: first });
    await portals.openCurrentPortal();
    expect(portals.previousOpenPortal).toBe(first);
    const space = first.space;
    space.scene.dispose.mockImplementationOnce(() => {
        throw new Error("dispose");
    });

    portals.onCurrPortal({ active: true, currentPortal: second });
    await portals.openCurrentPortal();

    expect(portals.opening).toBe(false);
    expect(portals.previousOpenPortal).toBeNull();
    expect(second.currentState).toBe(STATES.CLOSE);
    expect(labelText()).toBe(OPEN_FAILED_MESSAGE);

    await portals.openCurrentPortal();
    expect(second.currentState).toBe(STATES.OPEN);
    expect(portals.previousOpenPortal).toBe(second);
});

test("leaving the space while a portal opens shows no failure", async () => {
    const portals = container();
    const portal = await closedPortal("a");
    portals.addPortal(portal);
    portals.onCurrPortal({ active: true, currentPortal: portal });
    SpaceFactory.get.mockRejectedValueOnce(new Error(ABORT_MSG));
    labelMock.setState.mockClear();

    await portals.openCurrentPortal();

    expect(portals.opening).toBe(false);
    expect(portal.currentState).toBe(STATES.CLOSE);
    expect(
        labelMock.setState.mock.calls.some(
            ([, opts]) => opts?.message === OPEN_FAILED_MESSAGE
        )
    ).toBe(false);
});

test("a disposed container is left alone when its opening fails late", async () => {
    const portals = container();
    const portal = await closedPortal("a");
    portals.addPortal(portal);
    portals.onCurrPortal({ active: true, currentPortal: portal });
    let fail;
    SpaceFactory.get.mockReturnValueOnce(
        new Promise((_, reject) => {
            fail = reject;
        })
    );
    const opening = portals.openCurrentPortal();
    await new Promise((done) => setTimeout(done));
    portals.dispose();
    labelMock.setState.mockClear();

    fail(new Error("network"));
    await opening;

    expect(portals.opening).toBe(false);
    expect(labelMock.setState).not.toHaveBeenCalled();
});

test("summoning is released when it throws, and the next summon opens", async () => {
    const portals = container();
    SummonPortal.summon.mockRejectedValueOnce(new Error("metadata"));

    await expect(portals.summonPortal({ exhibitId: "x" })).rejects.toThrow(
        "metadata"
    );
    expect(portals.summoning).toBe(false);

    const summoned = await closedPortal("summoned-x", {
        isStaticPortal: false,
    });
    SummonPortal.summon.mockResolvedValueOnce(summoned);
    await portals.summonPortal({ exhibitId: "x" });

    expect(portals.summoning).toBe(false);
    expect(summoned.currentState).toBe(STATES.OPEN);
});

test("a summoned portal that failed to open makes way for the next summon", async () => {
    const portals = container();
    const failed = await closedPortal("summoned-x", { isStaticPortal: false });
    SummonPortal.summon.mockResolvedValueOnce(failed);
    SpaceFactory.get.mockRejectedValueOnce(new Error("network"));
    await portals.summonPortal({ exhibitId: "x" });
    expect(failed.currentState).toBe(STATES.CLOSE);
    expect(failed.previewMesh.currentState).toBe(STATES.CLOSE);
    expect(labelText()).toBe(OPEN_FAILED_MESSAGE);
    expect(portals.portals).toEqual([failed]);

    const next = await closedPortal("summoned-y", { isStaticPortal: false });
    SummonPortal.summon.mockResolvedValueOnce(next);
    await portals.summonPortal({ exhibitId: "y" });

    expect(portals.portals).toEqual([next]);
    expect(failed.previewMesh.dispose).toHaveBeenCalledTimes(1);
    expect(next.currentState).toBe(STATES.OPEN);
    expect(labelText()).toBe("You can now walk in!");
});

test("closing a summoned portal forgets it, and keeps the back portal", async () => {
    const portals = container();
    const summoned = await closedPortal("summoned-x", {
        isStaticPortal: false,
    });
    SummonPortal.summon.mockResolvedValueOnce(summoned);
    await portals.summonPortal({ exhibitId: "x" });
    const back = {};
    portals.backPortal = back;

    await portals.closePrevOpenningPortal();

    expect(portals.summonedPortal).toBeNull();
    expect(portals.previousOpenPortal).toBeNull();
    expect(portals.backPortal).toBe(back);
    expect(portals.portals).toEqual([]);
});

test("going back again retries a back portal whose opening failed", async () => {
    const portals = container();
    const back = await closedPortal("backto-x", {
        isStaticPortal: false,
        backState: {},
    });
    BackPortal.get.mockResolvedValue(back);
    SpaceFactory.get.mockRejectedValueOnce(new Error("network"));

    await portals.openBackPortal();

    expect(portals.opening).toBe(false);
    expect(back.currentState).toBe(STATES.CLOSE);
    expect(labelText()).toBe(OPEN_FAILED_MESSAGE);
    expect(portals.portals).toEqual([back]);

    await portals.openBackPortal();

    expect(BackPortal.get).toHaveBeenCalledTimes(1);
    expect(portals.portals).toEqual([back]);
    expect(back.currentState).toBe(STATES.OPEN);
});

test("going back again does not ask a dismissed password a second time", async () => {
    const portals = container();
    const back = await closedPortal("backto-x", {
        isStaticPortal: false,
        backState: {},
    });
    back.portalData.exhibit.gating = { password: { password: "sesame" } };
    BackPortal.get.mockResolvedValue(back);
    showUIPrompt.mockResolvedValue(null);
    await portals.openBackPortal();
    expect(showUIPrompt).toHaveBeenCalledTimes(1);

    await portals.openBackPortal();

    expect(showUIPrompt).toHaveBeenCalledTimes(1);
});

test("a lift that fails to change floor can be called again", async () => {
    const portals = container();
    const lift = await closedPortal("floor-1", {
        levels: [{ id: "floor-1" }, { id: "floor-2" }],
    });
    lift.lod = { dispose: jest.fn(), reset: jest.fn() };
    portals.addPortal(lift);
    PortalLOD.create.mockRejectedValueOnce(new Error("metadata"));

    await expect(
        lift.switchLevel({ exhibitId: "dest-2", portalId: "floor-2" })
    ).rejects.toThrow("metadata");

    expect(lift.switching).toBe(false);
});

test("the loading mark of a door portal is not shown once its opening has ended", async () => {
    const portal = await closedPortal("door");
    const sprite = { play: jest.fn() };
    require("@3factory/sprite").default.get.mockResolvedValueOnce(sprite);

    await portal.showLoadingSprite();

    expect(portal.loadingSprite).toBeUndefined();
    expect(sprite.play).not.toHaveBeenCalled();
});
