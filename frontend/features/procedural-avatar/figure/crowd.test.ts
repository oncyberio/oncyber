/** @jest-environment node */
import { readFileSync } from "fs";
import path from "path";
import * as THREE from "three/webgpu";
import { VRMLoaderPlugin } from "@pixiv/three-vrm";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { supportsNativeAvatarMaterial } from "../../lobby/webgpu/avatarMaterials";
import { styleFigure } from "./createFigure";
import { createFigureCrowd, createFigurePoses } from "./crowd";
import { morphName, type FigureInfo } from "./format";
import { LOOK_CELLS, LOOK_SIZE, createFigureLooks, lookOf } from "./looks";
import { FACE_MOTION, blinkAt } from "./shading";
import { STANCES, standFigure } from "./stances";
import { PLAIN_STYLE, STAGEHAND_STYLE } from "./style";
import { variedLook } from "./vary";

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

const basic = async (style = STAGEHAND_STYLE) => {
    const vrm = await load();
    return { vrm, figure: styleFigure(vrm, style, { form: "basic" }) };
};

/** A row's cell by what it holds: its three numbers, then its one. */
const cellOf = (row: Float32Array, name: string) => {
    const at = LOOK_CELLS.findIndex((cell) => cell[0] === name);
    return Array.from(row.subarray(at * 4, at * 4 + 3));
};
const numberOf = (row: Float32Array, name: string) =>
    row[LOOK_CELLS.findIndex((cell) => cell[1] === name) * 4 + 3];

/** The area an opening's rim takes up, seen from the front. */
const areaOf = (
    position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
    loop: number[],
    moved?: (v: number) => [number, number]
) => {
    const at = (v: number) => {
        const by = moved ? moved(v) : [0, 0];
        return [position.getX(v) + by[0], position.getY(v) + by[1]];
    };
    let twice = 0;
    loop.forEach((v, i) => {
        const [a, b] = [at(v), at(loop[(i + 1) % loop.length])];
        twice += a[0] * b[1] - a[1] * b[0];
    });
    return Math.abs(twice) / 2;
};

describe("the basic form", () => {
    it("is the same character at rest, vertex for vertex", async () => {
        const whole = styleFigure(await load(), STAGEHAND_STYLE);
        const { figure } = await basic();
        expect(whole.form).toBe("full");
        expect(figure.form).toBe("basic");
        expect(figure.triangles).toBe(whole.triangles);
        for (const key of ["body", "face", "ink"] as const) {
            const [a, b] = [whole.meshes[key], figure.meshes[key]].map(
                (mesh) => mesh.geometry
            );
            expect(b.attributes.position.array).toEqual(
                a.attributes.position.array
            );
            expect(b.index.array).toEqual(a.index.array);
            if (key !== "ink")
                expect(b.attributes.normal.array).toEqual(
                    a.attributes.normal.array
                );
            else expect(b.attributes.uv.array).toEqual(a.attributes.uv.array);
        }
    });

    it("carries no morph targets, and nothing plays expressions on it", async () => {
        const { vrm, figure } = await basic();
        for (const mesh of Object.values(figure.meshes)) {
            expect(Object.keys(mesh.geometry.morphAttributes)).toEqual([]);
            expect(mesh.morphTargetInfluences).toBeUndefined();
        }
        expect(vrm.expressionManager).toBeUndefined();
        // Posing it still works.
        expect(() => vrm.update(1 / 60)).not.toThrow();
        // The full form keeps all of them.
        const whole = styleFigure(await load(), STAGEHAND_STYLE);
        expect(whole.face).toBeNull();
        expect(
            whole.meshes.face.geometry.morphAttributes.position
        ).toHaveLength(42);
    });

    it("blinks and opens its mouth as the full form does", async () => {
        const fullVrm = await load();
        const whole = styleFigure(fullVrm, STAGEHAND_STYLE);
        const { figure } = await basic();
        expect(figure.face.blink.value).toBe(0);
        expect(figure.face.talk.value).toBe(0);
        for (const key of ["face", "ink"] as const) {
            const full = whole.meshes[key];
            const names = (full.userData.targetNames as string[]).map(
                morphName
            );
            const morph = (name: string) =>
                full.geometry.morphAttributes.position[names.indexOf(name)];
            const { geometry } = figure.meshes[key];
            const blink = geometry.getAttribute(FACE_MOTION.blink);
            const talk = geometry.getAttribute(FACE_MOTION.talk);
            const [left, right, mouth] = [
                morph("EYE_Close_L"),
                morph("EYE_Close_R"),
                morph("MTH_A"),
            ];
            let furthest = 0;
            for (let v = 0; v < blink.count; v++)
                for (let k = 0; k < 3; k++) {
                    expect(blink.getComponent(v, k)).toBeCloseTo(
                        left.getComponent(v, k) + right.getComponent(v, k),
                        6
                    );
                    expect(talk.getComponent(v, k)).toBeCloseTo(
                        mouth.getComponent(v, k),
                        6
                    );
                    furthest = Math.max(
                        furthest,
                        Math.abs(blink.getComponent(v, k))
                    );
                }
            // Both travel in one buffer.
            expect((blink as THREE.InterleavedBufferAttribute).data).toBe(
                (talk as THREE.InterleavedBufferAttribute).data
            );
            expect(furthest).toBeGreaterThan(0.002);
        }
        // The body has no face to move.
        expect(
            figure.meshes.body.geometry.hasAttribute(FACE_MOTION.blink)
        ).toBe(false);
    });

    it("shuts its eyes when it blinks and parts its lips when it talks", async () => {
        const { vrm, figure } = await basic(PLAIN_STYLE);
        const { geometry } = figure.meshes.face;
        const position = geometry.attributes.position;
        const { eyes, mouth } = (vrm.scene.userData.figure as FigureInfo)
            .landmarks;
        const by =
            (name: string) =>
            (v: number): [number, number] =>
                [
                    geometry.getAttribute(name).getX(v),
                    geometry.getAttribute(name).getY(v),
                ];
        for (const eye of [eyes.left, eyes.right]) {
            const open = areaOf(position, eye.loop);
            expect(open).toBeGreaterThan(1e-4);
            expect(
                areaOf(position, eye.loop, by(FACE_MOTION.blink))
            ).toBeLessThan(open * 0.05);
        }
        expect(
            areaOf(position, mouth.loop, by(FACE_MOTION.talk))
        ).toBeGreaterThan(areaOf(position, mouth.loop) + 1e-4);
    });

    it("keeps what its vertices know in one buffer, and no normals for the ink", async () => {
        const { figure } = await basic();
        const { face, ink, body } = figure.meshes;
        const bake = face.geometry.getAttribute("bake");
        const part = face.geometry.getAttribute("part");
        expect((bake as THREE.InterleavedBufferAttribute).data).toBe(
            (part as THREE.InterleavedBufferAttribute).data
        );
        // As the file has them: skin first, in the open.
        expect(Math.round(part.getX(0) * 255)).toBe(0);
        expect(bake.getX(0)).toBeGreaterThan(0);
        expect(bake.getX(0)).toBeLessThanOrEqual(1);
        for (const mesh of [face, ink, body]) {
            expect(mesh.geometry.hasAttribute("_bake")).toBe(false);
            expect(mesh.geometry.hasAttribute("_part")).toBe(false);
        }
        expect(ink.geometry.hasAttribute("normal")).toBe(false);
        expect(body.geometry.hasAttribute("bake")).toBe(true);
        expect(body.geometry.hasAttribute("part")).toBe(false);
    });

    it("is something the lobby's crowd takes", async () => {
        const { vrm, figure } = await basic();
        // What the lobby asks of an avatar before it draws it in a batch.
        expect(vrm.springBoneManager?.joints?.size || 0).toBe(0);
        const meshes: THREE.SkinnedMesh[] = [];
        vrm.scene.traverse((object: THREE.Object3D) => {
            if ((object as THREE.Mesh).isMesh)
                meshes.push(object as THREE.SkinnedMesh);
        });
        expect(meshes).toHaveLength(3);
        for (const mesh of meshes) {
            expect(Array.isArray(mesh.material)).toBe(false);
            expect(
                supportsNativeAvatarMaterial(mesh.material as THREE.Material)
            ).toBe(true);
            expect(
                Object.values(mesh.geometry.morphAttributes).some(
                    (targets) => targets.length
                )
            ).toBe(false);
            expect(mesh.geometry.getAttribute("skinIndex")).toBeDefined();
            expect(mesh.geometry.getAttribute("skinWeight")).toBeDefined();
            expect(mesh.skeleton.bones.length).toBeLessThanOrEqual(256);
            expect(mesh.skeleton.boneInverses).toHaveLength(
                mesh.skeleton.bones.length
            );
        }
        // The full form's materials would pass too; its morphs keep it out.
        const whole = styleFigure(await load(), STAGEHAND_STYLE);
        expect(supportsNativeAvatarMaterial(whole.materials.face)).toBe(true);
        expect(
            whole.meshes.face.geometry.morphAttributes.position.length
        ).toBeGreaterThan(0);
    });
});

describe("a figure's look", () => {
    it("is a row of numbers: colours as they are lit, lengths in metres", async () => {
        const { figure } = await basic();
        const { frames } = figure;
        const row = lookOf(STAGEHAND_STYLE, frames);
        expect(row).toHaveLength(LOOK_SIZE);
        const tone = new THREE.Color(STAGEHAND_STYLE.skin.tone);
        expect(cellOf(row, "tone")).toEqual(
            [tone.r, tone.g, tone.b].map(Math.fround)
        );
        expect(numberOf(row, "flush")).toBeCloseTo(STAGEHAND_STYLE.skin.flush);
        // Only the colour of the light inside the skin is kept.
        expect(Math.max(...cellOf(row, "scatter"))).toBeCloseTo(1);
        expect(numberOf(row, "irisRadius")).toBeCloseTo(
            STAGEHAND_STYLE.eyes.radius * frames.eyeWidth
        );
        expect(cellOf(row, "lidUpper")[1]).toBeCloseTo(
            STAGEHAND_STYLE.lids.upper[1] * frames.eyeWidth
        );
        expect(numberOf(row, "waist")).toBeCloseTo(
            STAGEHAND_STYLE.underwear.waist * frames.hips
        );
        // A catchlight is mirrored with the way the figure faces.
        expect(cellOf(row, "glint0")[0]).toBeCloseTo(
            STAGEHAND_STYLE.eyes.glints[0][0] * frames.forwardZ
        );
        expect(cellOf(row, "glint0")[2]).toBeCloseTo(
            STAGEHAND_STYLE.eyes.glints[0][2]
        );
    });

    it("has a place of its own for everything it holds", () => {
        const names = LOOK_CELLS.flatMap((cell) => [...cell]).filter(Boolean);
        expect(new Set(names).size).toBe(names.length);
        // The catchlights follow one another: the shader counts on it.
        const first = LOOK_CELLS.findIndex((cell) => cell[0] === "glint0");
        expect(LOOK_CELLS[first + 1][0]).toBe("glint1");
    });

    it("is kept in a table, a row a look", async () => {
        const { figure } = await basic();
        const looks = createFigureLooks(figure.frames, 3);
        expect(looks.texture.image.width).toBe(LOOK_CELLS.length);
        expect(looks.texture.image.height).toBe(3);
        expect(looks.texture.type).toBe(THREE.FloatType);
        const data = looks.texture.image.data as Float32Array;
        const version = looks.texture.version;
        looks.set(2, PLAIN_STYLE);
        expect(looks.texture.version).toBeGreaterThan(version);
        expect(Array.from(data.subarray(0, LOOK_SIZE * 2))).toEqual(
            new Array(LOOK_SIZE * 2).fill(0)
        );
        expect(data.subarray(LOOK_SIZE * 2)).toEqual(
            lookOf(PLAIN_STYLE, figure.frames)
        );
        expect(() => looks.set(3, PLAIN_STYLE)).toThrow(RangeError);
        expect(() => looks.set(0.5, PLAIN_STYLE)).toThrow(RangeError);
        expect(() => createFigureLooks(figure.frames, 0)).toThrow(RangeError);
        // A figure by itself draws from a table of one: its own look.
        const own = figure.materials.looks;
        expect(own.capacity).toBe(1);
        expect(own.texture.image.data).toEqual(
            lookOf(STAGEHAND_STYLE, figure.frames)
        );
    });

    it("can be varied a little, the same way each time, leaving the shape alone", () => {
        const varied = variedLook(STAGEHAND_STYLE, 7);
        expect(variedLook(STAGEHAND_STYLE, 7)).toEqual(varied);
        expect(variedLook(STAGEHAND_STYLE, 8)).not.toEqual(varied);
        expect(varied.shape).toBe(STAGEHAND_STYLE.shape);
        expect(varied.eyes.outline).toBe(STAGEHAND_STYLE.eyes.outline);
        expect(varied.eyes.at).toBe(STAGEHAND_STYLE.eyes.at);
        expect(varied.brows.path).toBe(STAGEHAND_STYLE.brows.path);
        expect(varied.brows.width).toBe(STAGEHAND_STYLE.brows.width);
        expect(varied.skin.tone).not.toBe(STAGEHAND_STYLE.skin.tone);
        // A little: no skin of forty is far from the style's own.
        const own = new THREE.Color(STAGEHAND_STYLE.skin.tone);
        for (let seed = 0; seed < 40; seed++) {
            const look = variedLook(STAGEHAND_STYLE, seed);
            for (const colour of [
                look.skin.tone,
                look.skin.blush,
                look.eyes.iris,
                look.brows.colour,
                look.underwear.colour,
            ])
                expect(colour).toMatch(/^#[0-9a-f]{6}$/);
            const tone = new THREE.Color(look.skin.tone);
            expect(
                Math.hypot(tone.r - own.r, tone.g - own.g, tone.b - own.b)
            ).toBeLessThan(0.2);
            expect(look.skin.flush).toBeLessThanOrEqual(1);
        }
    });
});

describe("a blink", () => {
    it("shuts the eyes and opens them again, then waits", () => {
        expect(blinkAt(0)).toBe(0);
        let most = 0;
        for (let t = 0; t < 0.3; t += 0.005) most = Math.max(most, blinkAt(t));
        expect(most).toBeGreaterThan(0.95);
        for (let t = 0.3; t < 2.5; t += 0.05) expect(blinkAt(t)).toBe(0);
        for (let t = -5; t < 5; t += 0.01) {
            expect(blinkAt(t)).toBeGreaterThanOrEqual(0);
            expect(blinkAt(t)).toBeLessThanOrEqual(1);
        }
    });

    it("comes at a moment of its own for each figure", () => {
        const shutAt = (seed: number) => {
            for (let t = 0; t < 12; t += 0.01)
                if (blinkAt(t, seed) > 0.9) return t;
            return -1;
        };
        const moments = [0, 0.2, 0.4, 0.6, 0.8].map(shutAt);
        expect(moments.every((t) => t >= 0)).toBe(true);
        expect(new Set(moments.map((t) => t.toFixed(1))).size).toBe(5);
    });
});

describe("stances", () => {
    it("lower the arms from where the model holds them, the same on both sides", async () => {
        const { vrm, figure } = await basic(PLAIN_STYLE);
        const hand = (side: string) =>
            vrm.humanoid
                .getRawBoneNode(`${side}Hand`)
                .getWorldPosition(new THREE.Vector3());
        vrm.scene.updateMatrixWorld(true);
        const rest = { left: hand("left"), right: hand("right") };
        standFigure(vrm, STANCES.stand, figure.frames.forwardZ);
        vrm.scene.updateMatrixWorld(true);
        const now = { left: hand("left"), right: hand("right") };
        for (const side of ["left", "right"] as const) {
            expect(now[side].y).toBeLessThan(rest[side].y - 0.3);
            expect(Math.abs(now[side].x)).toBeLessThan(
                Math.abs(rest[side].x) - 0.25
            );
            // The elbows bend the hands forward, not back.
            expect(
                (now[side].z - rest[side].z) * figure.frames.forwardZ
            ).toBeGreaterThan(0);
        }
        // (As near as the model's own two sides are alike.)
        expect(now.left.x).toBeCloseTo(-now.right.x, 2);
        expect(now.left.y).toBeCloseTo(now.right.y, 2);
        // A step: one foot forward of the other.
        standFigure(vrm, STANCES.stride, figure.frames.forwardZ);
        vrm.scene.updateMatrixWorld(true);
        const foot = (side: string) =>
            vrm.humanoid
                .getRawBoneNode(`${side}Foot`)
                .getWorldPosition(new THREE.Vector3());
        expect(
            (foot("left").z - foot("right").z) * figure.frames.forwardZ
        ).toBeGreaterThan(0.2);
    });
});

describe("a crowd", () => {
    /** Vertex buffers a mesh's draw binds, and the slots they fill. */
    const counted = (mesh: THREE.InstancedMesh) => {
        const buffers = new Set<unknown>([mesh.instanceMatrix]);
        // A matrix fills four slots.
        let slots = 4;
        for (const attribute of Object.values(mesh.geometry.attributes)) {
            buffers.add(
                (attribute as THREE.InterleavedBufferAttribute).data ||
                    attribute
            );
            slots++;
        }
        return { buffers: buffers.size, slots };
    };

    it("is made of the basic form only", async () => {
        const vrm = await load();
        const whole = styleFigure(vrm, STAGEHAND_STYLE);
        expect(() => createFigurePoses(whole, 0)).toThrow(RangeError);
        const poses = createFigurePoses(whole, 1);
        expect(() => createFigureCrowd(whole, { capacity: 4, poses })).toThrow(
            /basic form/
        );
    });

    it("draws every figure with three meshes that share the figure's vertices", async () => {
        const { figure } = await basic();
        const poses = createFigurePoses(figure, 2);
        const crowd = createFigureCrowd(figure, { capacity: 40, poses });
        expect(crowd.object.children).toHaveLength(3);
        expect(crowd.trianglesEach).toBe(11092);
        for (const key of ["body", "face", "ink"] as const) {
            const mesh = crowd.meshes[key];
            expect(mesh.isInstancedMesh).toBe(true);
            expect(mesh.count).toBe(0);
            const own = figure.meshes[key].geometry;
            // Nothing of the figure is copied.
            for (const [name, attribute] of Object.entries(own.attributes))
                expect(mesh.geometry.getAttribute(name)).toBe(attribute);
            expect(mesh.geometry.index).toBe(own.index);
            expect(mesh.material).not.toBe(figure.meshes[key].material);
            // One set of matrices and one buffer of what each has.
            expect(mesh.instanceMatrix).toBe(crowd.meshes.body.instanceMatrix);
            expect(
                (
                    mesh.geometry.getAttribute(
                        "figureInstance"
                    ) as THREE.InterleavedBufferAttribute
                ).data
            ).toBe(
                (
                    crowd.meshes.body.geometry.getAttribute(
                        "figureFace"
                    ) as THREE.InterleavedBufferAttribute
                ).data
            );
            // Within what any device that runs the app can bind.
            const { buffers, slots } = counted(mesh);
            expect(buffers).toBeLessThanOrEqual(8);
            expect(slots).toBeLessThanOrEqual(16);
            expect(supportsNativeAvatarMaterial(mesh.material)).toBe(true);
        }
        // The figure itself is left as it was.
        expect(figure.meshes.face.geometry.hasAttribute("figureFace")).toBe(
            false
        );
        crowd.count = 40;
        expect(crowd.meshes.ink.count).toBe(40);
        expect(() => (crowd.count = 41)).toThrow(RangeError);
        crowd.dispose();
    });

    it("gives each figure its place, pose, look and face", async () => {
        const { figure } = await basic();
        const poses = createFigurePoses(figure, 4);
        const crowd = createFigureCrowd(figure, {
            capacity: 3,
            poses,
            looks: 2,
        });
        // Until told otherwise, every look is the figure's own.
        expect(
            (crowd.looks.texture.image.data as Float32Array).subarray(LOOK_SIZE)
        ).toEqual(lookOf(STAGEHAND_STYLE, figure.frames));
        const matrix = new THREE.Matrix4().makeTranslation(1, 2, 3);
        crowd.set(1, {
            matrix,
            look: 1,
            pose: [2, 3, 0.25],
            seed: 0.5,
            talk: 2,
        });
        const own = crowd.meshes.body.geometry.getAttribute("figureInstance");
        const face = crowd.meshes.body.geometry.getAttribute("figureFace");
        expect([own.getX(1), own.getY(1), own.getZ(1), own.getW(1)]).toEqual([
            2, 3, 0.25, 1,
        ]);
        // Its mouth cannot be more than open.
        expect([face.getX(1), face.getY(1)]).toEqual([0.5, 1]);
        expect(
            Array.from(crowd.meshes.body.instanceMatrix.array.slice(16, 32))
        ).toEqual(matrix.toArray());
        // The others stand where the figure does, in its first pose.
        expect(
            Array.from(crowd.meshes.body.instanceMatrix.array.slice(0, 16))
        ).toEqual(new THREE.Matrix4().toArray());
        expect(own.getX(0)).toBe(0);
        // One thing at a time leaves the rest.
        crowd.set(1, { pose: 1 });
        expect([own.getX(1), own.getY(1), own.getZ(1), own.getW(1)]).toEqual([
            1, 1, 0, 1,
        ]);
        expect(() => crowd.set(3, {})).toThrow(RangeError);
        expect(() => crowd.set(0, { look: 2 })).toThrow(RangeError);
        expect(() => crowd.set(0, { pose: 4 })).toThrow(RangeError);
        expect(() => crowd.set(0, { pose: [0, 9, 0.5] })).toThrow(RangeError);
    });

    it("takes its poses from the figure as it stands", async () => {
        const { vrm, figure } = await basic();
        const poses = createFigurePoses(figure, 3);
        expect(poses.bones).toBe(figure.meshes.body.skeleton.bones.length);
        expect(poses.texture.image.width).toBe(poses.bones * 4);
        expect(poses.texture.image.height).toBe(3);
        const data = poses.texture.image.data as Float32Array;
        const matrixOf = (row: number, bone: number) =>
            new THREE.Matrix4().fromArray(
                data,
                (row * poses.bones + bone) * 16
            );
        // At rest nothing moves: every bone's matrix leaves things be.
        poses.capture(0);
        const still = new THREE.Matrix4().toArray();
        for (let bone = 0; bone < poses.bones; bone++)
            matrixOf(0, bone)
                .toArray()
                .forEach((value, i) => expect(value).toBeCloseTo(still[i], 5));
        // Standing, a hand ends up where its bone now is.
        const { skeleton } = figure.meshes.body;
        const hand = vrm.humanoid.getRawBoneNode("leftHand");
        const rest = hand.getWorldPosition(new THREE.Vector3());
        standFigure(vrm, STANCES.stand, figure.frames.forwardZ);
        poses.capture(1);
        const stood = rest
            .clone()
            .applyMatrix4(matrixOf(1, skeleton.bones.indexOf(hand)));
        const now = hand.getWorldPosition(new THREE.Vector3());
        expect(stood.distanceTo(now)).toBeLessThan(1e-5);
        expect(now.y).toBeLessThan(rest.y - 0.3);
        // Where the figure's scene is turned is part of the pose.
        vrm.scene.rotation.y = Math.PI;
        poses.capture(2);
        const turned = rest
            .clone()
            .applyMatrix4(matrixOf(2, skeleton.bones.indexOf(hand)));
        expect(turned.x).toBeCloseTo(-stood.x, 5);
        expect(turned.z).toBeCloseTo(-stood.z, 5);
        expect(turned.y).toBeCloseTo(stood.y, 5);
        expect(() => poses.capture(3)).toThrow(RangeError);
    });
});
