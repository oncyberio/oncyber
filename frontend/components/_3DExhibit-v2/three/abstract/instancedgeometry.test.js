/** @jest-environment node */
// The instanced buffers (artwork frames, name tags, kitbash parts) are sent
// to the GPU only when what they hold changed. While shadows auto-update the
// cache key used to be random, so every buffer was re-sent on every frame.
import { BoxGeometry, Frustum, Matrix4, PerspectiveCamera } from "three";

const mockRenderer = { shadowMap: { autoUpdate: true } };
const mockCamera = new PerspectiveCamera(60, 1, 0.1, 1000);
mockCamera.position.set(0, 0, 10);
mockCamera.updateMatrixWorld();
const mockFrustum = new Frustum().setFromProjectionMatrix(
    new Matrix4().multiplyMatrices(
        mockCamera.projectionMatrix,
        mockCamera.matrixWorldInverse
    )
);
jest.mock("@3renderer", () => ({ __esModule: true, default: mockRenderer }), {
    virtual: true,
});
jest.mock(
    "@3camera",
    () => ({
        __esModule: true,
        default: { current: mockCamera, frustum: mockFrustum },
    }),
    { virtual: true }
);
jest.mock("@3scene", () => ({ __esModule: true, default: {} }), {
    virtual: true,
});

const GeometryInstancer =
    require("./instancedgeometry.js").default ||
    require("./instancedgeometry.js");

const wrapper = (x) => ({
    visible: true,
    position: { x, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
});

function uploads(geometry) {
    return geometry.attributes.offset.version;
}

afterEach(() => {
    mockRenderer.shadowMap.autoUpdate = true;
});

test.each([true, false])(
    "unchanged instances are sent once (shadows auto-update: %p)",
    (autoUpdate) => {
        mockRenderer.shadowMap.autoUpdate = autoUpdate;
        const geometry = new GeometryInstancer(new BoxGeometry(), {
            scale: true,
        });
        const wrappers = [wrapper(0), wrapper(1)];
        geometry.sort(wrappers);
        const first = uploads(geometry);
        for (let frame = 0; frame < 5; frame++) geometry.sort(wrappers);
        expect(uploads(geometry)).toBe(first);
        wrappers[1].position.x = 2;
        geometry.sort(wrappers);
        expect(uploads(geometry)).toBe(first + 1);
    }
);

test("a new transparency order is sent even when no instance moved", () => {
    const geometry = new GeometryInstancer(new BoxGeometry(), {
        scale: true,
        transparencySorting: true,
    });
    const wrappers = [wrapper(-1), wrapper(1)];
    geometry.sort(wrappers);
    const first = uploads(geometry);
    geometry.sort(wrappers);
    expect(uploads(geometry)).toBe(first);
    mockCamera.position.set(-20, 0, 0);
    geometry.sort(wrappers);
    mockCamera.position.set(0, 0, 10);
    expect(uploads(geometry)).toBe(first + 1);
    expect(geometry.attributes.offset.array[0]).toBe(1);
});
