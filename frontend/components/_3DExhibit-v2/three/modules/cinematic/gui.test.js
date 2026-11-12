// The cinematic editing panel (TweakPane, react-color) is not part of the
// engine a visitor loads: it is imported only when advanced mode builds it.

jest.mock(
    "@3constants",
    () => {
        const state = { recording: false };
        return {
            CINEMATIC: false,
            CURRENT_SPACE: {},
            DEBUG: false,
            ERROR_CODES: {},
            WEB_CODECS: true,
            // a live binding in the engine: read on every use
            get IS_RECORDING() {
                return state.recording;
            },
            SET_IS_RECORDING: (value) => {
                state.recording = value;
            },
        };
    },
    { virtual: true }
);
jest.mock("@3scene", () => ({ __esModule: true, default: {} }), {
    virtual: true,
});
jest.mock("@3events", () => ({ __esModule: true, default: {} }), {
    virtual: true,
});
jest.mock("@3emitter", () => ({ __esModule: true, default: {} }), {
    virtual: true,
});
jest.mock(
    "@3camera",
    () => ({ __esModule: true, default: { current: null } }),
    {
        virtual: true,
    }
);
jest.mock(
    "@3cameras/editcinematic.js",
    () => ({
        __esModule: true,
        default: { name: "edit", activate() {}, desactivate() {} },
    }),
    { virtual: true }
);
jest.mock(
    "@3cameras/cinematic.js",
    () => ({
        __esModule: true,
        default: { name: "display", activate() {}, desactivate() {} },
    }),
    { virtual: true }
);
jest.mock("@3gl/root", () => ({ __esModule: true, default: {} }), {
    virtual: true,
});
jest.mock(
    "@3gl/globals/customGui",
    () => {
        mockGuiLoads.count++;
        return { cinematicGUI: mockGui() };
    },
    { virtual: true }
);
jest.mock("@env", () => ({ nodeEnv: {} }));
jest.mock("three", () => ({ CameraHelper: class {} }));
jest.mock("gsap/CustomEase", () => ({
    __esModule: true,
    default: { create: () => "none" },
}));
jest.mock("./splines/editor", () => ({ __esModule: true, default: class {} }));
jest.mock("./splines/curve.js", () => ({
    __esModule: true,
    default: class {},
}));
jest.mock("./composer", () => ({
    __esModule: true,
    default: {
        active: false,
        reset: jest.fn(),
        layout: jest.fn(),
        dispose: jest.fn(),
        startTween: { play: jest.fn() },
    },
}));

const mockGuiLoads = { count: 0 };

/** A GUI folder whose every call chains, like the TweakPane controllers. */
function mockGui() {
    const chain = new Proxy(function () {}, {
        get: (_target, prop) => (prop === "then" ? undefined : chain),
        apply: () => chain,
    });
    return { addFolder: jest.fn(() => chain) };
}

import Cinematic from "./index";

test("loading the engine does not load the cinematic editing panel", () => {
    expect(Cinematic).toBeDefined();
    expect(mockGuiLoads.count).toBe(0);
});

test("building the panel loads it on demand", async () => {
    await Cinematic.addGui();
    expect(mockGuiLoads.count).toBe(1);
    const { cinematicGUI } = jest.requireMock("@3gl/globals/customGui");
    expect(cinematicGUI.addFolder).toHaveBeenCalledWith("View");
});
