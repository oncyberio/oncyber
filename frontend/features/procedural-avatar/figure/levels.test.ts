/** @jest-environment node */
import { readFileSync } from "fs";
import path from "path";
import * as THREE from "three/webgpu";
import { VRMLoaderPlugin } from "@pixiv/three-vrm";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { styleFigure } from "./createFigure";
import type { FigureInfo } from "./format";
import {
    LEVEL_BASE,
    LEVEL_COUNT,
    levelFor,
    levelTolerance,
    pixelSize,
} from "./levels";
import { STAGEHAND_STYLE } from "./style";

const FILE = path.join(__dirname, "../../../public/models/figure_male.vrm");

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

describe("the levels a figure is drawn at", () => {
    it("are steps of what a view can show, the first the whole mesh", () => {
        expect(levelTolerance(0)).toBe(0);
        expect(levelTolerance(1)).toBe(LEVEL_BASE);
        expect(levelTolerance(3)).toBeCloseTo(LEVEL_BASE * 2, 12);
        // A view is given the coarsest level that leaves out nothing it
        // could show.
        expect(levelFor(0)).toBe(0);
        expect(levelFor(LEVEL_BASE * 0.99)).toBe(0);
        for (let level = 1; level < LEVEL_COUNT; level++) {
            expect(levelFor(levelTolerance(level))).toBe(level);
            expect(levelFor(levelTolerance(level) * 1.2)).toBe(level);
            expect(levelFor(levelTolerance(level) * 0.99)).toBe(level - 1);
        }
        expect(levelFor(1e9)).toBe(LEVEL_COUNT - 1);
        expect(levelFor(NaN)).toBe(0);
    });

    it("go by the size of a pixel where the figure stands", () => {
        const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 100);
        // Ten metres off, a picture 1080 pixels high takes in 9.33 m.
        expect(pixelSize(camera, 10, 1080)).toBeCloseTo(9.326 / 1080, 5);
        expect(pixelSize(camera, 20, 1080)).toBeCloseTo(
            2 * pixelSize(camera, 10, 1080),
            12
        );
        camera.zoom = 2;
        expect(pixelSize(camera, 10, 1080)).toBeCloseTo(4.663 / 1080, 5);
        // A flat view's pixels are one size at any distance.
        const flat = new THREE.OrthographicCamera(-2, 2, 1, -1, 0.1, 100);
        expect(pixelSize(flat, 3, 500)).toBeCloseTo(0.004, 12);
        expect(pixelSize(flat, 30, 500)).toBeCloseTo(0.004, 12);
    });

    it("are read from the figure's file and kept off its meshes", async () => {
        const untouched = await load();
        let stored = 0;
        untouched.scene.traverse((object: THREE.Object3D) => {
            const mesh = object as THREE.Mesh;
            if (!mesh.isMesh) return;
            const detail = mesh.geometry.getAttribute("_detail");
            expect(detail.itemSize).toBe(2);
            expect(detail.count).toBe(mesh.geometry.attributes.position.count);
            stored++;
        });
        expect(stored).toBe(3);
        const figure = styleFigure(await load(), STAGEHAND_STYLE);
        expect(figure.levels.known).toBe(true);
        for (const mesh of Object.values(figure.meshes))
            expect(mesh.geometry.hasAttribute("_detail")).toBe(false);
    });

    it("leave out more the less a view can show, and never a landmark", async () => {
        const vrm = await load();
        const figure = styleFigure(vrm, STAGEHAND_STYLE);
        const { levels } = figure;
        // The whole mesh first: the very list the mesh has.
        expect(levels.index("face", 0)).toBe(figure.meshes.face.geometry.index);
        expect(levels.triangles(0)).toBe(10868);
        let before = Infinity;
        for (let level = 0; level < LEVEL_COUNT; level++) {
            const triangles = levels.triangles(level);
            expect(triangles).toBeLessThanOrEqual(before);
            before = triangles;
            // The same list each time it is asked for.
            expect(levels.index("body", level)).toBe(
                levels.index("body", level)
            );
        }
        // Nothing can go for a quarter of a millimetre...
        expect(levels.triangles(1)).toBeGreaterThan(10868 * 0.98);
        // ...half of it for half a centimetre, and most by the last.
        expect(levels.triangles(levelFor(0.005))).toBeLessThan(10868 * 0.55);
        expect(before).toBeLessThan(10868 * 0.2);
        // Every level is a list of whole triangles over the same
        // vertices, and still has the rims of the eyes and the mouth.
        const { eyes, mouth } = (vrm.scene.userData.figure as FigureInfo)
            .landmarks;
        const coarsest = levels.index("face", LEVEL_COUNT - 1);
        const used = new Set(Array.from(coarsest.array));
        expect(coarsest.count % 3).toBe(0);
        for (const v of [...eyes.left.loop, ...eyes.right.loop, ...mouth.loop])
            expect(used.has(v)).toBe(true);
        for (let t = 0; t < coarsest.count; t += 3)
            expect(
                new Set([
                    coarsest.getX(t),
                    coarsest.getX(t + 1),
                    coarsest.getX(t + 2),
                ]).size
            ).toBe(3);
    });

    it("can be set on a figure by itself", async () => {
        const figure = styleFigure(await load(), STAGEHAND_STYLE);
        const whole = figure.meshes.body.geometry.index;
        const drawn = figure.setDetail(0.004);
        expect(drawn).toBe(figure.levels.triangles(levelFor(0.004)));
        expect(drawn).toBeLessThan(10868 * 0.6);
        expect(figure.meshes.body.geometry.index).not.toBe(whole);
        expect(
            (figure.meshes.body.geometry.index.count +
                figure.meshes.face.geometry.index.count +
                figure.meshes.ink.geometry.index.count) /
                3
        ).toBe(drawn);
        // The figure is still all there to go back to.
        expect(figure.triangles).toBe(10868);
        expect(figure.setDetail(0)).toBe(10868);
        expect(figure.meshes.body.geometry.index).toBe(whole);
    });
});
