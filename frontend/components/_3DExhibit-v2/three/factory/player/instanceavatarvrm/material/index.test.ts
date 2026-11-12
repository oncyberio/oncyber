/** @jest-environment jsdom */
import * as THREE from "three/webgpu";
jest.mock("@3constants", () => ({ DEBUG: false }), { virtual: true });
jest.mock(
    "@3shared",
    () => ({ __esModule: true, default: { animationTimer: { value: 0 } } }),
    { virtual: true }
);
jest.mock("@3renderer", () => ({}), { virtual: true });
const Material = require("./index").default;
const Shared = require("@3shared").default;

function createMaterial(lighting = false, atlas = false) {
    const metadata = {
        uvPos: { x: 0, y: 0 },
        uvScale: { x: 1, y: 1 },
        image: {
            source: { data: { data: new Float32Array([0, 0, 0.5, 0.25]) } },
        },
    };
    return new Material(
        {
            atlas,
            metadata,
            additionalMetas: metadata,
            animationTexture: new THREE.DataTexture(
                new Float32Array(4),
                1,
                1,
                THREE.RGBAFormat,
                THREE.FloatType
            ),
            scale: new THREE.Vector3(1, 1, 1),
            base: {
                updateWorldMatrix() {},
                bind() {},
                skeleton: {},
                bindMatrix: new THREE.Matrix4(),
                bindMatrixInverse: new THREE.Matrix4(),
                material: {
                    side: THREE.FrontSide,
                    color: new THREE.Color(1, 1, 1),
                },
            },
        },
        lighting
    );
}

test.each([false, true])(
    "avatar fade is a writable numeric uniform updated per rendered camera (lighting=%s)",
    (lighting) => {
        const material = createMaterial(lighting);
        const fade = material.uniforms.avatarCameraFadeScale;
        const descriptor = Object.getOwnPropertyDescriptor(fade, "value");
        expect(descriptor.get).toBeUndefined();
        expect(descriptor.writable).toBe(true);
        expect(fade.value).toBe(1);
        expect(fade.updateType).toBe("render");
        fade.update({
            camera: { near: 0.1, travelFraming: { blend: 1 } },
        });
        expect(fade.value).toBeCloseTo(0.45);
        fade.update({ camera: { near: 0.1 } });
        expect(fade.value).toBe(1);
    }
);

test.each([false, true])(
    "avatar light profile is stable when the room lighting toggles (lighting=%s)",
    (lighting) => {
        const material = createMaterial(lighting);
        expect(material.isNodeMaterial).toBe(true);
        expect(material.isMeshLambertNodeMaterial).toBe(true);
        expect(material.lightsNode).toBeTruthy();
        expect(material.transparent).toBe(true);
        expect(material.fog).toBe(true);
        expect(material.positionNode).toBeTruthy();
        expect(material.colorNode).toBeTruthy();
        expect(material.outputNode).toBeNull();
        expect(material.uniforms.metaData.array).toHaveLength(1);
    }
);

test("animation clock follows Shared.animationTimer", () => {
    const material = createMaterial();
    Shared.animationTimer.value = 12.5;
    material.uniforms.timer.update({});
    expect(material.uniforms.timer.value).toBe(12.5);
});

test("atlas materials expose a swappable map uniform", () => {
    const material = createMaterial(false, true);
    const texture = new THREE.Texture();
    material.uniforms.map.value = texture;
    expect(material.uniforms.map.value).toBe(texture);
});

test("clones and occlusion variants share uniforms; occlusion outputs black", () => {
    const material = createMaterial();
    const clone = material.clone(),
        occlusion = material.occlusionMaterial;
    expect(occlusion.isOcclusion).toBe(true);
    expect(occlusion.outputNode).toBeTruthy();
    for (const variant of [clone, occlusion]) {
        expect(variant.uniforms).toBe(material.uniforms);
        expect(variant.uniforms.avatarCameraFadeScale).toBe(
            material.uniforms.avatarCameraFadeScale
        );
    }
    // the pipeline flags variants it builds itself with defines.OCCLUSION
    const flagged = material.clone();
    flagged.defines = { OCCLUSION: "" };
    try {
        flagged.setup({});
    } catch (e) {
        // only the flag handling matters here, not a full node build
    }
    expect(flagged.isOcclusion).toBe(true);
    expect(flagged.outputNode).toBeTruthy();
});

test("unlit PFPs keep the same material in lit and unlit rooms", () => {
    for (const roomLit of [false, true]) {
        const material = createMaterial(roomLit, true);
        expect(material.isMeshBasicNodeMaterial).toBe(true);
        expect(material.lightsNode).toBeNull();
    }
});

test.each([false, true])(
    "native sampled-pose and lighting shader builds (portrait=%s)",
    (portrait) => {
        const material = createMaterial(false, portrait);
        const geometry = new THREE.BoxGeometry();
        const count = geometry.attributes.position.count;
        geometry.setAttribute(
            "skinIndex",
            new THREE.Uint16BufferAttribute(new Uint16Array(count * 4), 4)
        );
        geometry.setAttribute(
            "skinWeight",
            new THREE.Float32BufferAttribute(
                new Float32Array(count * 4).fill(0.25),
                4
            )
        );
        for (const [name, size] of Object.entries({
            offset: 3,
            rotationY: 1,
            scale: 1,
            animations: 4,
            opacity: 1,
            atlas: 4,
        }))
            geometry.setAttribute(
                name,
                new THREE.InstancedBufferAttribute(new Float32Array(size), size)
            );
        const mesh = new THREE.Mesh(geometry, material);
        const gpu = new THREE.WebGPURenderer({
            canvas: document.createElement("canvas"),
        });
        gpu.hasFeature = () => false;
        (gpu as any)._bindings = undefined;
        const backend = gpu.backend as any;
        backend.device = { limits: { maxUniformBufferBindingSize: 65536 } };
        backend.utils.getTextureSampleData = () => ({ primarySamples: 1 });
        const builder = backend.createNodeBuilder(mesh, gpu);
        builder.camera = new THREE.PerspectiveCamera();
        builder.scene = new THREE.Scene();
        builder.build();
        expect(builder.vertexShader).toContain("textureLoad(");
        expect(builder.vertexShader).toContain("fract(");
        expect(builder.fragmentShader).not.toContain("NaN");
    }
);
