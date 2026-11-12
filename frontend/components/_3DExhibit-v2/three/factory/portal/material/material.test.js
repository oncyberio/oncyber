/** @jest-environment jsdom */

// One three core for "three" and "three/webgpu", as in the app bundle.
jest.mock("three", () =>
    jest.requireActual("../../../../../../../node_modules/three/build/three.core.js")
);

jest.mock(
    "@3shared",
    () => ({
        __esModule: true,
        default: {
            timer: { value: 0 },
            dpi: { value: 1 },
            resolution: { value: { x: 1, y: 1 } },
            isDynamicRendering: { value: 0 },
        },
    }),
    { virtual: true }
);

jest.mock("@3renderer", () => ({ __esModule: true, default: { backend: {} } }), {
    virtual: true,
});

const THREE = require("three/webgpu");
const TwoDMaterial = require("./2d/index.js").default;
const Three60Material = require("./360/index.js").default;
const { toTopDownRows } = require("../../../utils/readpixels.js");

function build(material) {
    const gpu = new THREE.WebGPURenderer({
        canvas: document.createElement("canvas"),
    });
    gpu.hasFeature = () => false;
    // No init() here, so r187's shared bind groups have no cache yet.
    gpu._bindings ??= { getSharedBindGroup: (group) => group };
    const backend = gpu.backend;
    backend.utils.getTextureSampleData = () => ({ primarySamples: 1 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    const scene = new THREE.Scene();
    scene.add(mesh);
    const camera = new THREE.PerspectiveCamera();
    const builder = backend.createNodeBuilder(mesh, gpu);
    builder.camera = camera;
    builder.scene = scene;
    builder.build();
    return builder;
}

test("2D portal preview builds and keeps a swappable map uniform", () => {
    const map = new THREE.Texture();
    const material = new TwoDMaterial({ map, aspect: 0.5 });
    expect(material.uniforms.map.value).toBe(map);
    const next = new THREE.Texture();
    material.uniforms.map.value = next;
    expect(material.uniforms.map.value).toBe(next);
    const builder = build(material);
    expect(builder.fragmentShader).toContain("textureSample");
});

test("360 portal preview builds with its uniforms", () => {
    const material = new Three60Material({
        map: new THREE.Texture(),
        tinfo: new THREE.Texture(),
        halo: "color",
    });
    material.uniforms.loading.value = 0.5;
    material.uniforms.rotation.value = 1;
    expect(material.fog).toBe(true);
    const builder = build(material);
    expect(builder.fragmentShader).toContain("atan2");
});

test("readback rows come out top-first on both backends", () => {
    // 1x2 image, rows [A, B] top-first
    const A = [1, 2, 3, 4];
    const B = [5, 6, 7, 8];
    // WebGPU: top-down rows padded to 256 bytes
    const padded = new Uint8Array(256 + 4);
    padded.set(A, 0);
    padded.set(B, 256);
    expect(Array.from(toTopDownRows(padded, 1, 2, false))).toEqual([...A, ...B]);
    // WebGL: bottom-up, tightly packed
    const packed = new Uint8Array([...B, ...A]);
    expect(Array.from(toTopDownRows(packed, 1, 2, true))).toEqual([...A, ...B]);
});
