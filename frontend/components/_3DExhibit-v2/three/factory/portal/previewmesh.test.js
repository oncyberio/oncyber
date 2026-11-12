// The real preview mesh and the real gsap, over stubbed engine modules: an
// opening that is interrupted has to end, because the portal awaits it.

jest.mock("three", () => {
    class Value {}
    class Geometry {
        computeBoundingBox() {}
    }
    return {
        BufferGeometry: Geometry,
        CircleGeometry: Geometry,
        PlaneGeometry: Geometry,
        Euler: Value,
        Texture: Value,
        Matrix3: Value,
        Mesh: Value,
        MeshBasicMaterial: Value,
        Quaternion: Value,
        Vector3: Value,
        Material: Value,
        LinearMipMapLinearFilter: 0,
        LinearFilter: 0,
        SRGBColorSpace: "srgb",
    };
});
jest.mock(
    "@3abstract/pipelinemesh",
    () => ({
        __esModule: true,
        default: class PipeLineMesh {
            constructor(geometry, material) {
                this.geometry = geometry;
                this.material = material;
                this.scale = { x: 1, y: 1 };
            }
            dispose() {}
        },
    }),
    { virtual: true }
);
jest.mock("@3loader", () => ({ __esModule: true, default: {} }), {
    virtual: true,
});
jest.mock("@3camera", () => ({ __esModule: true, default: {} }), {
    virtual: true,
});
jest.mock(
    "@3utils/three",
    () => ({ disposeMaterial: jest.fn(), disposeObject3D: jest.fn() }),
    { virtual: true }
);
jest.mock("@3utils/abort", () => jest.requireActual("../../utils/abort"), {
    virtual: true,
});
jest.mock("@3utils/imagecache", () => ({ __esModule: true, default: {} }), {
    virtual: true,
});
jest.mock(
    "@3portal/textures/infoopentexture",
    () => ({ __esModule: true, default: {} }),
    { virtual: true }
);
jest.mock(
    "@3gl/renderer/portalinfo.js",
    () => ({ __esModule: true, default: {} }),
    { virtual: true }
);
jest.mock(
    "@3modules/material/tvnoisematerial",
    () => ({ __esModule: true, default: { name: "noise" } }),
    { virtual: true }
);
jest.mock(
    "@3modules/material/blackmaterial",
    () => ({ __esModule: true, default: { name: "black" } }),
    { virtual: true }
);
jest.mock(
    "@3modules/starfield",
    () => ({
        __esModule: true,
        default: {
            name: "starfield",
            addEvents: jest.fn(),
            removeEvents: jest.fn(),
            activate: jest.fn(),
            resize: jest.fn(),
        },
    }),
    { virtual: true }
);
jest.mock(
    "@3modules/label/constants",
    () => jest.requireActual("../../modules/label/constants.js"),
    { virtual: true }
);
jest.mock(
    "@3constants",
    () => ({ IS_DESKTOP: true, IS_MOBILE: false, IS_VR: false }),
    { virtual: true }
);
jest.mock("../../constants", () => ({
    CURRENT_SPACE: { roomParameters: {} },
    EDIT_MODE: false,
}));
jest.mock("./textures/infopreviewtexture", () => ({
    __esModule: true,
    default: {},
}));
jest.mock("./material/360/index.js", () => ({
    __esModule: true,
    default: class {},
}));
jest.mock("./material/2d", () => ({ __esModule: true, default: class {} }));
jest.mock("@utils/urlUtils", () => ({}));

import Blackmaterial from "@3modules/material/blackmaterial";
import Starfield from "@3modules/starfield";
import { STATES } from "./constants";
import { PortalPreviewMesh, PORTAL_SHAPES } from "./previewmesh";

function previewMesh() {
    const mesh = PortalPreviewMesh.create({
        type: PORTAL_SHAPES.RECTANGLE,
        width: 1,
        height: 2,
    });
    mesh.portal = {
        opts: { cHeroImg360: "/hero-360.jpg" },
        portalData: { exhibit: { id: "dest" }, user: {} },
    };
    return mesh;
}

/** A static portal that has loaded its 360 preview and is closed. */
function closedWith360Preview() {
    const mesh = previewMesh();
    mesh.three60Material = { uniforms: { loading: { value: 0 } } };
    mesh.setMaterial(mesh.three60Material);
    mesh.currentState = STATES.CLOSE;
    return mesh;
}

const SETTLED = "settled";
function settledWithin(promise, ms) {
    return Promise.race([
        promise.then(() => SETTLED),
        new Promise((done) => setTimeout(() => done("still waiting"), ms)),
    ]);
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test("an opening that is closed before its two seconds are up still ends", async () => {
    const mesh = closedWith360Preview();
    const opening = mesh.setState(STATES.OPENING);
    await Promise.resolve();
    expect(mesh.loadingTween).toBeDefined();

    await mesh.setState(STATES.CLOSE);

    expect(await settledWithin(opening, 200)).toBe(SETTLED);
    expect(mesh.currentState).toBe(STATES.CLOSE);
    expect(mesh.material).toBe(mesh.three60Material);
    expect(mesh.three60Material.uniforms.loading.value).toBe(0);
    expect(console.error).not.toHaveBeenCalled();
});

test("an opening that runs its course ends as opening", async () => {
    const mesh = closedWith360Preview();
    const opening = mesh.setState(STATES.OPENING);
    await Promise.resolve();

    mesh.loadingTween.progress(1);

    expect(await settledWithin(opening, 200)).toBe(SETTLED);
    expect(mesh.currentState).toBe(STATES.OPENING);
    expect(mesh.three60Material.uniforms.loading.value).toBe(1);
});

test("a preview without an image goes back to black when its opening is cancelled", async () => {
    const mesh = previewMesh();
    await mesh.setState(STATES.OPENING);
    expect(mesh.material).toBe(Starfield);

    await mesh.setState(STATES.CLOSE);

    expect(mesh.material).toBe(Blackmaterial);
    expect(mesh.currentState).toBe(STATES.CLOSE);
    expect(Starfield.removeEvents).toHaveBeenCalledTimes(1);
    expect(console.error).not.toHaveBeenCalled();
});
