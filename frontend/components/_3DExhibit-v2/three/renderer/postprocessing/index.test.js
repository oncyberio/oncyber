/** @jest-environment jsdom */

jest.mock(
    "@3renderer",
    () => ({
        target: null,
        autoClear: true,
        _callDepth: -1,
        getRenderTarget() {
            return this.target;
        },
        setRenderTarget(target) {
            this.target = target;
        },
        render: jest.fn(),
    }),
    { virtual: true }
);
jest.mock("@3constants", () => ({ DPI: 1 }), { virtual: true });
jest.mock("@3emitter", () => ({ on: jest.fn(), emit: jest.fn() }), {
    virtual: true,
});
jest.mock("@3events", () => ({}), { virtual: true });
jest.mock("@3shared", () => ({ isDynamicRendering: { value: 1 } }), {
    virtual: true,
});
jest.mock("@3gl/globals/fbohelper.js", () => ({}), { virtual: true });
jest.mock("@3editgui/index.js", () => ({ POST_TYPES: {} }), {
    virtual: true,
});
jest.mock("./quad", () =>
    jest.fn().mockImplementation(() => ({ resize: jest.fn() }))
);

import PostProcessing from "./index";
import mockRenderer from "@3renderer";

const scene = {};
const camera = {};

beforeEach(() => {
    mockRenderer.target = null;
    mockRenderer.autoClear = true;
    mockRenderer._callDepth = -1;
    mockRenderer.render.mockReset();
    jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    console.error.mockRestore();
});

// three's renderer switches to its own offscreen target and a deeper call
// level at the start of a frame, and only switches back at the end.
function throwMidFrame(message) {
    mockRenderer.render.mockImplementation(() => {
        mockRenderer.setRenderTarget({ offscreen: true });
        mockRenderer._callDepth++;
        throw new TypeError(message);
    });
}

test("a frame that throws mid-render leaves the renderer drawing to the screen", () => {
    throwMidFrame("Cannot read properties of null (reading 'complete')");

    expect(() => PostProcessing.render(scene, camera, {})).not.toThrow();

    expect(mockRenderer.getRenderTarget()).toBeNull();
    expect(mockRenderer._callDepth).toBe(-1);
    expect(mockRenderer.autoClear).toBe(true);
});

test("the same error is reported once, not every frame", () => {
    throwMidFrame("same error every frame");

    for (let i = 0; i < 5; i++) PostProcessing.render(scene, camera, {});

    expect(console.error).toHaveBeenCalledTimes(1);
});

test("a frame rendered into a caller's target goes back to that target", () => {
    const portalTarget = { portal: true };
    mockRenderer.setRenderTarget(portalTarget);
    throwMidFrame("portal frame failed");

    PostProcessing.render(scene, camera, {}, portalTarget);

    expect(mockRenderer.getRenderTarget()).toBe(portalTarget);
});
