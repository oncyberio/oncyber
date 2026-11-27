/** @jest-environment node */
import { readFileSync } from "fs";
import path from "path";
import * as THREE from "three/webgpu";
import { VRMLoaderPlugin } from "@pixiv/three-vrm";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { styleFigure, type FigureForm } from "./createFigure";
import { createFigureCrowd, createFigurePoses } from "./crowd";
import { STAGEHAND_STYLE } from "./style";

const FILE = path.join(__dirname, "../../../public/models/figure_male.vrm");

async function figureIn(form: FigureForm) {
    const file = readFileSync(FILE);
    const loader = new GLTFLoader();
    loader.register(
        (parser) => new VRMLoaderPlugin(parser, { autoUpdateHumanBones: true })
    );
    const gltf = await loader.parseAsync(
        file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
        ""
    );
    const vrm = gltf.userData.vrm;
    return { vrm, figure: styleFigure(vrm, STAGEHAND_STYLE, { form }) };
}

/**
 * The shaders a mesh would be drawn with on WebGPU, as text. Writing them
 * needs no graphics card, only the few things the writer asks a device.
 */
function shadersOf(mesh: THREE.Mesh) {
    const canvas = {
        style: {},
        width: 1,
        height: 1,
        addEventListener() {},
        removeEventListener() {},
        getContext: () => null,
    };
    const gpu = new THREE.WebGPURenderer({
        canvas: canvas as unknown as HTMLCanvasElement,
    });
    gpu.hasFeature = () => false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const backend = gpu.backend as any;
    backend.device = { limits: { maxUniformBufferBindingSize: 65536 } };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (gpu as any)._bindings = { getSharedBindGroup: (group: unknown) => group };
    backend.utils.getTextureSampleData = () => ({ primarySamples: 1 });
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const builder = backend.createNodeBuilder(mesh, gpu);
    builder.camera = camera;
    builder.scene = scene;
    builder.build();
    return {
        vertex: builder.vertexShader as string,
        fragment: builder.fragmentShader as string,
    };
}

/** The lines that move a vertex, in the order they run. */
const moves = (vertex: string) =>
    vertex
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("positionLocal ="));
const fetches = (shader: string) => shader.split("textureLoad(").length - 1;
/** A table cell fetched through a texture's placing on a surface. */
const PLACED = /textureLoad\([^\n]+object\.nodeUniform/;

describe("a figure's shaders", () => {
    it("draw a look from the table by whole-number places", async () => {
        const { figure } = await figureIn("full");
        for (const mesh of Object.values(figure.meshes)) {
            const { fragment } = shadersOf(mesh);
            expect(fetches(fragment)).toBeGreaterThan(0);
            expect(fragment).not.toMatch(PLACED);
            // Nothing else is looked up: no picture is sampled.
            expect(fragment).not.toContain("textureSample(");
        }
        // The body reads the first five cells of its row, and no more.
        const body = shadersOf(figure.meshes.body).fragment;
        expect(fetches(body)).toBe(5);
        for (let cell = 0; cell < 5; cell++)
            expect(body).toContain(`vec2<i32>( ${cell}, 0 )`);
    });

    it("move a basic figure's face before its bones pose it", async () => {
        const { figure } = await figureIn("basic");
        for (const key of ["face", "ink"] as const) {
            const lines = moves(shadersOf(figure.meshes[key]).vertex);
            expect(lines[0]).toBe("positionLocal = position;");
            expect(lines[1]).toContain("faceBlink");
            expect(lines[1]).toContain("faceTalk");
            // Then the mesh's own skinning.
            expect(lines.length).toBeGreaterThan(2);
            expect(lines.slice(2).join("\n")).not.toContain("faceBlink");
        }
        // The body has no face, and the full form moves its face by
        // morph targets instead.
        expect(shadersOf(figure.meshes.body).vertex).not.toContain("faceBlink");
        const whole = await figureIn("full");
        expect(shadersOf(whole.figure.meshes.face).vertex).not.toContain(
            "faceBlink"
        );
    });
});

describe("a crowd's shaders", () => {
    it("move the face, then pose, then place each figure", async () => {
        const { figure } = await figureIn("basic");
        const poses = createFigurePoses(figure, 2);
        const crowd = createFigureCrowd(figure, { capacity: 8, poses });
        crowd.count = 8;
        const face = shadersOf(crowd.meshes.face);
        const lines = moves(face.vertex);
        expect(lines).toHaveLength(4);
        expect(lines[0]).toBe("positionLocal = position;");
        expect(lines[1]).toContain("faceBlink");
        expect(lines[2]).toContain("vec4<f32>( positionLocal, 1.0 )");
        expect(lines[2]).not.toContain("instanceIndex");
        expect(lines[3]).toMatch(
            /\[ instanceIndex \] \* vec4<f32>\( positionLocal, 1\.0 \)/
        );
        // The face hangs on one bone: four cells for each of two poses.
        expect(fetches(face.vertex)).toBe(8);
        // The body has room for four, and fetches each only if used.
        const body = shadersOf(crowd.meshes.body);
        expect(fetches(body.vertex)).toBe(32);
        expect(moves(body.vertex)).toHaveLength(3);
        for (const shader of [face.vertex, body.vertex, face.fragment]) {
            expect(shader).not.toMatch(PLACED);
            expect(shader).not.toContain("boneMatrices");
        }
        // Each figure's look is its own row of the table.
        expect(face.vertex).toContain("figureInstance");
        expect(face.fragment).not.toContain("vec2<i32>( 0, 0 )");
        expect(fetches(face.fragment)).toBeGreaterThan(0);
        crowd.dispose();
    });
});
