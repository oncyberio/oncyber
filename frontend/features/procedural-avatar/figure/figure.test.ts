/** @jest-environment node */
import { readFileSync } from "fs";
import path from "path";
import * as THREE from "three/webgpu";
import { VRMLoaderPlugin } from "@pixiv/three-vrm";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { boundaryLoops, weld } from "./bake";
import { styleFigure } from "./createFigure";
import {
    FIGURE_COMPOSITES,
    FIGURE_FORMAT,
    FIGURE_MATERIALS,
    morphName,
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
        expect(file.length).toBeLessThan(600_000);
        expect(json.images).toBeUndefined();
        expect(json.textures).toBeUndefined();
        expect(json.materials.map((m: { name: string }) => m.name)).toEqual([
            FIGURE_MATERIALS.body,
            FIGURE_MATERIALS.face,
            FIGURE_MATERIALS.ink,
        ]);
    });

    it("leaves out expressions that are sums of others, and still has them", async () => {
        const info: FigureInfo = json.scenes[0].extras.figure;
        const names: string[] =
            json.meshes[0].primitives[0].extras.targetNames.map(morphName);
        expect(Object.keys(info.composites)).toHaveLength(12);
        for (const [whole, parts] of Object.entries(info.composites)) {
            // Left out itself; every part of it is there.
            expect(names).not.toContain(whole);
            for (const part of parts) expect(names).toContain(part);
            expect(FIGURE_COMPOSITES[whole]).toEqual(parts);
        }
        // A smile with shut eyes is not quite its two halves: kept.
        expect(names).toContain("EYE_Joy");
        // What drives a blink drives both eyes' own.
        const blink =
            json.extensions.VRM.blendShapeMaster.blendShapeGroups.find(
                (group: { presetName: string }) => group.presetName === "blink"
            );
        expect(
            blink.binds
                .map((bind: { index: number }) => names[bind.index])
                .sort()
        ).toEqual(["EYE_Close_L", "EYE_Close_R"]);
        // And through three-vrm it shuts both eyes.
        const vrm = await load();
        vrm.expressionManager.setValue("blink", 1);
        vrm.expressionManager.update();
        const face = meshesOf(vrm)[FIGURE_MATERIALS.face];
        const on = face.morphTargetInfluences
            .map((value, i) => (value > 0.99 ? names[i] : null))
            .filter(Boolean);
        expect(on.sort()).toEqual(["EYE_Close_L", "EYE_Close_R"]);
    });

    it("says what it is and where it came from", () => {
        const info: FigureInfo = json.scenes[0].extras.figure;
        expect(info.format).toBe(FIGURE_FORMAT);
        expect(info.source.license).toBe("CC0");
        expect(info.triangles.body + info.triangles.face).toBeLessThan(10_500);
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
        expect(face.geometry.morphAttributes.position).toHaveLength(42);
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
            // The body is all skin, and says nothing of its parts.
            const part = geometry.getAttribute("_part");
            positions.push(...geometry.attributes.position.array);
            const index = geometry.index.array;
            for (let t = 0; t < index.length; t += 3)
                if (
                    !part ||
                    Math.round(part.getX(index[t]) * 255) === partId("skin")
                )
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

/**
 * How far from a circle the outline round some points is: the length of
 * the band stretched round them, squared, over 4 pi times its area.
 */
function cornered(points: [number, number][]) {
    const sorted = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const turn = (o: number[], a: number[], b: number[]) =>
        (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const half = (from: [number, number][]) => {
        const chain: [number, number][] = [];
        for (const p of from) {
            while (
                chain.length >= 2 &&
                turn(chain[chain.length - 2], chain[chain.length - 1], p) <= 0
            )
                chain.pop();
            chain.push(p);
        }
        return chain.slice(0, -1);
    };
    const band = [...half(sorted), ...half(sorted.slice().reverse())];
    let length = 0;
    let area = 0;
    band.forEach((a, i) => {
        const b = band[(i + 1) % band.length];
        length += Math.hypot(b[0] - a[0], b[1] - a[1]);
        area += (a[0] * b[1] - b[0] * a[1]) / 2;
    });
    return (length * length) / (4 * Math.PI * Math.abs(area));
}

describe("the figure's ears", () => {
    it("are found again in the file: each ear, and where it joins the head", async () => {
        const vrm = await load();
        const { ears, eyes } = (vrm.scene.userData.figure as FigureInfo)
            .landmarks;
        const position =
            meshesOf(vrm)[FIGURE_MATERIALS.face].geometry.attributes.position;
        for (const side of ["left", "right"] as const) {
            const ear = ears[side];
            expect(ear.all.length).toBeGreaterThan(200);
            expect(ear.root.length).toBeGreaterThan(10);
            expect(ear.root.every((v) => ear.all.includes(v))).toBe(true);
            // On the same side as that eye, and further out.
            const eyeX = position.getX(eyes[side].loop[0]);
            for (const v of ear.all) {
                expect(Math.sign(position.getX(v))).toBe(Math.sign(eyeX));
                expect(Math.abs(position.getX(v))).toBeGreaterThan(0.05);
            }
        }
    });

    it("are rounded by a style without leaving the head", async () => {
        const untouched = await load();
        const vrm = await load();
        // His ears alone: the head they are on left as the figure's.
        const figure = styleFigure(vrm, {
            ...STAGEHAND_STYLE,
            shape: { ...STAGEHAND_STYLE.shape, head: undefined },
        });
        const before =
            meshesOf(untouched)[FIGURE_MATERIALS.face].geometry.attributes
                .position;
        const after = figure.meshes.face.geometry.attributes.position;
        const ear = (vrm.scene.userData.figure as FigureInfo).landmarks.ears
            .left;
        for (const v of ear.root)
            for (const axis of [0, 1, 2])
                expect(after.getComponent(v, axis)).toBe(
                    before.getComponent(v, axis)
                );
        // Its outline is rounder: flat in the ear's own plane, with its
        // length and width evened out, the outline's length squared over
        // the area it holds is 1 for a circle and more for anything with
        // corners.
        const { long, short } = figure.frames.ears.left;
        const flat = (p: typeof after) =>
            ear.all.map((v): [number, number] => [
                p.getX(v) * long[0] + p.getY(v) * long[1] + p.getZ(v) * long[2],
                p.getX(v) * short[0] +
                    p.getY(v) * short[1] +
                    p.getZ(v) * short[2],
            ]);
        expect(cornered(flat(before))).toBeGreaterThan(1.08);
        expect(cornered(flat(after))).toBeLessThan(
            cornered(flat(before)) - 0.03
        );
        // Its normals are whole.
        const normal = figure.meshes.face.geometry.attributes.normal;
        for (const v of ear.all)
            expect(
                Math.hypot(normal.getX(v), normal.getY(v), normal.getZ(v))
            ).toBeCloseTo(1, 4);
        expect(
            figure.frames.ears.left.out[0] * after.getX(ear.all[0])
        ).toBeGreaterThan(0);
    });
});

describe("styling a figure", () => {
    it("draws it with three materials and leaves its triangles alone", async () => {
        const vrm = await load();
        const figure = styleFigure(vrm, PLAIN_STYLE);
        expect(figure.triangles).toBe(10868);
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
        // Only the head is the style's to change. From the collar down
        // nothing is touched; the neck follows the head by as much as
        // the head's bone carries it, at its base by a hair.
        for (let v = 0; v < a.count; v++)
            for (const axis of [0, 1, 2]) {
                const apart = Math.abs(
                    a.getComponent(v, axis) - b.getComponent(v, axis)
                );
                if (a.getY(v) < 1.36) expect(apart).toBe(0);
                else if (a.getY(v) < 1.43) expect(apart).toBeLessThan(0.0005);
            }
        // The skull, which the body's mesh holds, did change, a little.
        expect(moved).toBeGreaterThan(0.001);
        expect(moved).toBeLessThan(0.01);
    });

    it("fits a head to the levels and outline a style gives", async () => {
        const plain = styleFigure(await load(), PLAIN_STYLE);
        // His sheet's head, taken all the way.
        const whole = {
            ...STAGEHAND_STYLE,
            shape: {
                ...STAGEHAND_STYLE.shape,
                head: { ...STAGEHAND_STYLE.shape.head, amount: 1 },
            },
        };
        const figure = styleFigure(await load(), whole);
        const { levels, outline } = whole.shape.head;
        const head = figure.head;
        expect(head.levels.nose).toBeCloseTo(levels.nose, 2);
        expect(head.levels.mouth).toBeCloseTo(levels.mouth, 2);
        expect(head.levels.chin).toBeCloseTo(levels.chin, 2);
        expect(head.levels.crown).toBeCloseTo(levels.crown, 2);
        // Its outline at the eyes and down the jaw, to within a
        // twentieth of an eye's width.
        for (const [out, down] of outline.slice(0, 7))
            expect(Math.abs(head.halfWidth(down) - out)).toBeLessThan(0.05);
        // In its own eye widths, the figure's head is rounder: wider at
        // the eyes, and shorter under them for its width.
        const round = (h: typeof head) => h.halfWidth(0) / h.levels.chin;
        expect(plain.head.halfWidth(0)).toBeGreaterThan(head.halfWidth(0));
        expect(round(head)).toBeLessThan(round(plain.head) - 0.1);
        // The skin's normals are still whole.
        for (const mesh of [figure.meshes.face, figure.meshes.body]) {
            const normal = mesh.geometry.attributes.normal;
            for (let v = 0; v < normal.count; v += 7)
                expect(
                    Math.hypot(normal.getX(v), normal.getY(v), normal.getZ(v))
                ).toBeCloseTo(1, 3);
        }
    });

    it("takes only as much of a head as the style asks for", async () => {
        const none = styleFigure(await load(), {
            ...STAGEHAND_STYLE,
            shape: { ...STAGEHAND_STYLE.shape, head: undefined },
        });
        const some = styleFigure(await load(), STAGEHAND_STYLE);
        const { amount, levels } = STAGEHAND_STYLE.shape.head;
        // The Stagehand takes a little of his sheet's head, not all.
        expect(amount).toBeGreaterThan(0);
        expect(amount).toBeLessThan(0.35);
        for (const level of ["nose", "mouth", "chin", "crown"] as const) {
            const own = none.head.levels[level];
            expect(some.head.levels[level]).toBeCloseTo(
                own + (levels[level] - own) * amount,
                2
            );
        }
        // His eyes are where they were, and as large.
        expect(some.frames.eyeWidth).toBeCloseTo(none.frames.eyeWidth, 5);
        expect(some.frames.corners.left.x).toBeCloseTo(
            none.frames.corners.left.x,
            5
        );
    });

    it("keeps the skin closed when the head is reshaped", async () => {
        const figure = styleFigure(await load(), STAGEHAND_STYLE);
        const positions: number[] = [];
        const indices: number[] = [];
        for (const mesh of [figure.meshes.body, figure.meshes.face]) {
            const base = positions.length / 3;
            const part = mesh.geometry.getAttribute("part");
            positions.push(...mesh.geometry.attributes.position.array);
            const index = mesh.geometry.index.array;
            for (let t = 0; t < index.length; t += 3)
                if (
                    !part ||
                    Math.round(part.getX(index[t]) * 255) === partId("skin")
                )
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

    it("gives the Stagehand his own eyes and brows, which still blink", async () => {
        const plain = styleFigure(await load(), PLAIN_STYLE);
        const vrm = await load();
        const figure = styleFigure(vrm, STAGEHAND_STYLE);
        const { eyes } = STAGEHAND_STYLE;
        // Larger eyes, set closer, and not as tall for their width.
        expect(figure.frames.eyeWidth).toBeCloseTo(
            plain.frames.eyeWidth * eyes.size,
            4
        );
        expect(Math.abs(figure.frames.corners.left.x)).toBeLessThan(
            Math.abs(plain.frames.corners.left.x)
        );
        const tall = (frame: typeof figure.frames.eyes.left) =>
            Math.max(...frame.rim.map((p) => p[1])) -
            Math.min(...frame.rim.map((p) => p[1]));
        expect(
            tall(figure.frames.eyes.left) / figure.frames.eyeWidth
        ).toBeLessThan(tall(plain.frames.eyes.left) / plain.frames.eyeWidth);
        // Seen from the front, the rim is the style's outline: its outer
        // corner as far above the inner one as drawn, on both sides, and
        // nothing of it higher than the outline goes.
        const position = figure.meshes.face.geometry.attributes.position;
        const landmarks = (vrm.scene.userData.figure as FigureInfo).landmarks;
        for (const side of ["left", "right"] as const) {
            const { loop, turn } = landmarks.eyes[side];
            const width = figure.frames.corners[side].width;
            const rise =
                (position.getY(loop[turn]) - position.getY(loop[0])) / width;
            expect(rise).toBeCloseTo(eyes.outline.upper.slice(-1)[0][1], 2);
            const highest = Math.max(
                ...loop.map((v) => position.getY(v) - position.getY(loop[0]))
            );
            expect(highest / width).toBeLessThan(0.36);
        }
        // His brows are his own line: thick to the corner, then a tail.
        const brow = figure.frames.brows.left;
        expect(brow.knots).toHaveLength(6);
        expect(brow.knots[4].width).toBeGreaterThan(0.009);
        expect(brow.knots[5].width).toBeLessThan(0.002);
        // A blink still brings the lids together: with it full on, the
        // upper and lower edges of the opening are the same line.
        const face = figure.meshes.face;
        const names = face.userData.targetNames as string[];
        // The file keeps a blink as each eye's own.
        const blinks = ["EYE_Close_L", "EYE_Close_R"].map(
            (name) =>
                face.geometry.morphAttributes.position[
                    names.findIndex((n) => n.endsWith(name))
                ]
        );
        const rim = landmarks.eyes.left;
        const shut = rim.loop.map(
            (v) => position.getY(v) + blinks[0].getY(v) + blinks[1].getY(v)
        );
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
