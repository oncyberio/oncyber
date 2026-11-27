/** @jest-environment node */
import { readFileSync } from "fs";
import path from "path";
import * as THREE from "three/webgpu";
import { VRMLoaderPlugin } from "@pixiv/three-vrm";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { boundaryLoops, weld } from "./bake";
import { styleFigure } from "./createFigure";
import {
    FIGURE_FORMAT,
    FIGURE_MATERIALS,
    partId,
    type FigureInfo,
} from "./format";
import { RIM_POINTS } from "./shape";
import { PLAIN_STYLE, STAGEHAND_STYLE } from "./style";

const FILE = path.join(__dirname, "../../../public/models/figure_male.vrm");

/** The file as the app loads it. */
async function load() {
    const file = readFileSync(FILE);
    const loader = new GLTFLoader();
    loader.register(
        (parser) => new VRMLoaderPlugin(parser, { autoUpdateHumanBones: true })
    );
    const gltf = await loader.parseAsync(
        file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
        ""
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return gltf.userData.vrm as any;
}

const meshesOf = (vrm: { scene: THREE.Object3D }) => {
    const found: Record<string, THREE.SkinnedMesh> = {};
    vrm.scene.traverse((object) => {
        const mesh = object as THREE.SkinnedMesh;
        if (mesh.isSkinnedMesh)
            found[(mesh.material as THREE.Material).name] = mesh;
    });
    return found;
};

describe("the figure file", () => {
    const file = readFileSync(FILE);
    const jsonLength = file.readUInt32LE(12);
    const json = JSON.parse(file.subarray(20, 20 + jsonLength).toString());

    it("is small and carries no images", () => {
        expect(file.length).toBeLessThan(800_000);
        expect(json.images).toBeUndefined();
        expect(json.textures).toBeUndefined();
        expect(json.materials.map((m: { name: string }) => m.name)).toEqual([
            FIGURE_MATERIALS.body,
            FIGURE_MATERIALS.face,
            FIGURE_MATERIALS.ink,
        ]);
    });

    it("says what it is and where it came from", () => {
        const info: FigureInfo = json.scenes[0].extras.figure;
        expect(info.format).toBe(FIGURE_FORMAT);
        expect(info.source.license).toBe("CC0");
        expect(info.triangles.body + info.triangles.face).toBeLessThan(10_000);
        expect(json.extensions.VRM.meta.licenseName).toBe("CC0");
    });

    it("loads as a VRM with its bones, its expressions and three meshes", async () => {
        const vrm = await load();
        for (const bone of ["hips", "head", "leftHand", "rightFoot", "leftEye"])
            expect(vrm.humanoid.getRawBoneNode(bone)).toBeTruthy();
        for (const expression of ["blink", "aa", "happy", "angry", "sad"])
            expect(
                vrm.expressionManager.getExpression(expression)
            ).toBeTruthy();
        const meshes = meshesOf(vrm);
        expect(Object.keys(meshes).sort()).toEqual(
            Object.values(FIGURE_MATERIALS).sort()
        );
        const face = meshes[FIGURE_MATERIALS.face];
        expect(face.geometry.morphAttributes.position).toHaveLength(54);
        expect(face.geometry.hasAttribute("_bake")).toBe(true);
        expect(face.geometry.hasAttribute("uv")).toBe(false);
    });

    it("stands on the floor, and its skin is one closed surface", async () => {
        const meshes = meshesOf(await load());
        const body = meshes[FIGURE_MATERIALS.body].geometry;
        const face = meshes[FIGURE_MATERIALS.face].geometry;
        body.computeBoundingBox();
        expect(body.boundingBox.min.y).toBeCloseTo(0, 5);
        expect(body.boundingBox.max.y).toBeGreaterThan(1.7);
        // Body and face skin together: the only open edges are the two
        // eyes and the mouth.
        const positions: number[] = [];
        const indices: number[] = [];
        for (const geometry of [body, face]) {
            const base = positions.length / 3;
            const part = geometry.getAttribute("_part");
            positions.push(...geometry.attributes.position.array);
            const index = geometry.index.array;
            for (let t = 0; t < index.length; t += 3)
                if (Math.round(part.getX(index[t]) * 255) === partId("skin"))
                    indices.push(
                        index[t] + base,
                        index[t + 1] + base,
                        index[t + 2] + base
                    );
        }
        const loops = boundaryLoops(
            Uint32Array.from(indices),
            weld(Float32Array.from(positions))
        );
        expect(loops.map((loop) => loop.length).sort((a, b) => a - b)).toEqual([
            24, 24, 32,
        ]);
    });

    it("binds every vertex to bones by weights that add up to one", async () => {
        const meshes = meshesOf(await load());
        for (const mesh of Object.values(meshes)) {
            const weights = mesh.geometry.attributes.skinWeight;
            expect(weights.normalized).toBe(true);
            for (let v = 0; v < weights.count; v += 37) {
                const raw = weights.array;
                expect(
                    raw[v * 4] +
                        raw[v * 4 + 1] +
                        raw[v * 4 + 2] +
                        raw[v * 4 + 3]
                ).toBe(65535);
            }
        }
    });
});

describe("styling a figure", () => {
    it("draws it with three materials and leaves its triangles alone", async () => {
        const vrm = await load();
        const figure = styleFigure(vrm, PLAIN_STYLE);
        expect(figure.triangles).toBe(10252);
        const { body, face, ink } = figure.meshes;
        expect(body.material).toBe(figure.materials.body);
        expect(face.material).toBe(figure.materials.face);
        expect(ink.material).toBe(figure.materials.ink);
        expect(figure.materials.ink.transparent).toBe(true);
        expect(figure.materials.body.transparent).toBe(false);
        // Nothing it draws with is an image.
        for (const material of Object.values(figure.materials).slice(0, 3))
            expect((material as THREE.MeshBasicNodeMaterial).map).toBeNull();
        figure.dispose();
    });

    it("measures the face it is given", async () => {
        const figure = styleFigure(await load(), PLAIN_STYLE);
        const { frames } = figure;
        // The figure faces -z in its own space, its left at +x... or not:
        // whichever it is, the two eyes mirror each other.
        expect(Math.abs(frames.forwardZ)).toBe(1);
        expect(frames.eyes.left.centre[0]).toBeCloseTo(
            -frames.eyes.right.centre[0],
            2
        );
        expect(Math.sign(frames.eyes.left.centre[0])).toBe(frames.leftSign);
        expect(frames.eyes.left.rim).toHaveLength(RIM_POINTS);
        expect(frames.eyeWidth).toBeGreaterThan(0.03);
        expect(frames.eyeWidth).toBeLessThan(0.045);
        expect(frames.mouthWidth).toBeGreaterThan(0.03);
        expect(frames.mouth.centre[1]).toBeLessThan(frames.eyes.left.centre[1]);
        expect(figure.marks.nose[1]).toBeLessThan(frames.eyes.left.centre[1]);
        expect(figure.marks.nose[1]).toBeGreaterThan(frames.mouth.centre[1]);
        expect(frames.hips).toBeGreaterThan(0.9);
    });

    it("leaves the body's proportions as they are", async () => {
        const plain = await load();
        const styled = await load();
        styleFigure(plain, PLAIN_STYLE);
        styleFigure(styled, STAGEHAND_STYLE);
        const a = meshesOf(plain)["figure-body"].geometry.attributes.position;
        const b = meshesOf(styled)["figure-body"].geometry.attributes.position;
        let moved = 0;
        for (let i = 0; i < a.array.length; i++)
            moved = Math.max(moved, Math.abs(a.array[i] - b.array[i]));
        // Only the face is the style's to change; the body below the
        // neck is untouched.
        for (let v = 0; v < a.count; v++)
            if (a.getY(v) < 1.4)
                for (const axis of [0, 1, 2])
                    expect(a.getComponent(v, axis)).toBe(
                        b.getComponent(v, axis)
                    );
        expect(moved).toBeLessThan(0.01);
    });

    it("gives the Stagehand his own eyes and brows, which still blink", async () => {
        const plain = styleFigure(await load(), PLAIN_STYLE);
        const vrm = await load();
        const figure = styleFigure(vrm, STAGEHAND_STYLE);
        // Larger eyes, closer set, under lowered lids.
        expect(figure.frames.eyeWidth).toBeGreaterThan(
            plain.frames.eyeWidth * 1.1
        );
        const tall = (frame: typeof figure.frames.eyes.left) =>
            Math.max(...frame.rim.map((p) => p[1])) -
            Math.min(...frame.rim.map((p) => p[1]));
        expect(
            tall(figure.frames.eyes.left) / figure.frames.eyeWidth
        ).toBeLessThan(tall(plain.frames.eyes.left) / plain.frames.eyeWidth);
        // His brows are his own line: four points, thick, then a tail.
        const brow = figure.frames.brows.left;
        expect(brow.knots).toHaveLength(4);
        expect(brow.knots[1].width).toBeGreaterThan(0.008);
        expect(brow.knots[3].width).toBeLessThan(0.002);
        // A blink still brings the lids together: with it full on, the
        // upper and lower edges of the opening are the same line.
        const face = figure.meshes.face;
        const names = face.userData.targetNames as string[];
        const blink =
            face.geometry.morphAttributes.position[
                names.findIndex((n) => n.endsWith("EYE_Close"))
            ];
        const position = face.geometry.attributes.position;
        const rim = (vrm.scene.userData.figure as FigureInfo).landmarks.eyes
            .left;
        const shut = rim.loop.map((v) => position.getY(v) + blink.getY(v));
        const open = rim.loop.map((v) => position.getY(v));
        const spread = (ys: number[]) => Math.max(...ys) - Math.min(...ys);
        expect(spread(open)).toBeGreaterThan(0.012);
        // Shut, what height is left is the slope of the closed line.
        const upper = shut.slice(1, rim.turn);
        const lower = shut.slice(rim.turn + 1).reverse();
        const gap = upper.map((y, i) =>
            Math.abs(y - lower[Math.round((i / upper.length) * lower.length)])
        );
        expect(Math.max(...gap)).toBeLessThan(0.003);
    });
});
