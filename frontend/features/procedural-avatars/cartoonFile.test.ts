import * as T from "three/webgpu";
import file from "../../public/lobby/procedural/recipes/mara-venn.json";
import coatFile from "../../public/lobby/procedural/recipes/rick-coat-study.json";
import nori from "../../public/lobby/procedural/recipes/nori-quill.json";
import tess from "../../public/lobby/procedural/recipes/tess-brindle.json";
import { buildCharacter } from "./buildCharacter";
import { loadRecipeForUrl, proceduralCharacter } from "./catalog";
import { readCartoonFile } from "./cartoonFile";
import { disposeAvatarGraph } from "../lobby/webgpu/avatarResources";

test("both lined coat tails follow the corresponding thigh on the shared animated mesh", () => {
    const { design } = readCartoonFile(coatFile);
    const actor = buildCharacter({ style: "cartoon", design });
    try {
        const mesh = actor.scene.getObjectByProperty(
            "isSkinnedMesh",
            true
        ) as T.SkinnedMesh;
        const { uv, skinIndex, skinWeight } = mesh.geometry.attributes;
        const movingJoints = new Set<string>();
        for (let i = 0; i < uv.count; i++) {
            if (Math.floor(uv.getX(i)) === 29 && skinWeight.getY(i) > 0.15)
                movingJoints.add(mesh.skeleton.bones[skinIndex.getY(i)].name);
        }
        expect(movingJoints).toEqual(
            new Set(["spine", "chest", "leftUpperLeg", "rightUpperLeg"])
        );
        expect(mesh.geometry.index.count / 3).toBeLessThanOrEqual(4000);
    } finally {
        disposeAvatarGraph(actor.scene);
    }
    const invalid = JSON.parse(JSON.stringify(coatFile));
    const coat = invalid.design.fit.sections.coat;
    coat.rows[0][2] = coat.rows[0][1] - 2;
    expect(() => readCartoonFile(invalid)).toThrow();
});

test("a radial crown needs one ordered rim and tooth rows must enclose the cavity", () => {
    const { design } = readCartoonFile(file);
    const rim: [number, number][] = Array.from({ length: 16 }, (_, i) => {
        const radius = i % 2 ? 40 : 60,
            angle = (i * Math.PI) / 8;
        return [radius * Math.cos(angle), 60 + radius * Math.sin(angle)];
    });
    design.hair.cut = "spikes";
    design.fit.sections.radialCrown = { center: [0, 60], rim };
    design.mouth = "speaking";
    design.fit.sections.openMouth = {
        rows: [
            [-10, 110, 111, 114, 115, 116],
            [0, 109, 112, 113, 115, 117],
            [10, 110, 110, 116, 116, 116],
        ],
        interior: "#612523",
        teeth: "#e5d6a2",
        tongue: "#bf5551",
    };
    expect(() => readCartoonFile({ ...file, design })).not.toThrow();
    rim.reverse();
    expect(() => readCartoonFile({ ...file, design })).not.toThrow();
    [rim[2], rim[3]] = [rim[3], rim[2]];
    expect(() => readCartoonFile({ ...file, design })).toThrow();
    [rim[2], rim[3]] = [rim[3], rim[2]];
    design.fit.sections.openMouth.rows[1][3] = 105;
    expect(() => readCartoonFile({ ...file, design })).toThrow();
});

test.each([file, tess, nori])(
    "$name builds one animated mesh and retains its hand sockets",
    (recipe) => {
        const { design } = readCartoonFile(recipe);
        const actor = buildCharacter({ style: "cartoon", design });
        try {
            const meshes: T.SkinnedMesh[] = [];
            actor.scene.traverse((o) => {
                if ((o as T.SkinnedMesh).isSkinnedMesh)
                    meshes.push(o as T.SkinnedMesh);
            });
            expect(meshes).toHaveLength(1);
            const geometry = meshes[0].geometry;
            expect(geometry.groups).toHaveLength(0);
            expect(geometry.index.count / 3).toBeLessThanOrEqual(4000);
            for (const name of [
                "position",
                "normal",
                "skinWeight",
                "skinIndex",
            ])
                expect(
                    geometry.getAttribute(name).array.every(Number.isFinite)
                ).toBe(true);
            const prop = new T.Object3D();
            actor.equipItem("right", prop);
            const first = prop.parent;
            expect(first).toBeTruthy();
            actor.equipItem("left", prop);
            expect(prop.parent).not.toBe(first);
            actor.releaseItems();
            expect(prop.parent).toBeNull();
        } finally {
            disposeAvatarGraph(actor.scene);
        }
    }
);

test("rejects overlapping garment bands, inverted hair openings and crossed limb sections", () => {
    for (const edit of [
        (d: typeof file.design) => {
            d.outfit.bands[0].start = d.outfit.bands[0].end + 0.1;
        },
        (d: typeof file.design) => {
            d.fit.sections.hair[0][3] = d.fit.sections.hair[0][2] + 2;
        },
        (d: typeof file.design) => {
            d.fit.sections.leg[1][0] = d.fit.sections.leg[0][0];
        },
        (d: typeof file.design) => {
            d.skin = "black";
        },
    ]) {
        const invalid = JSON.parse(JSON.stringify(file));
        edit(invalid.design);
        expect(() => readCartoonFile(invalid)).toThrow();
    }
});

test("accepts one exposed ear and rejects duplicate ears on a single temple", () => {
    const candidate: typeof tess = JSON.parse(JSON.stringify(tess));
    expect(readCartoonFile(candidate).design.fit.sections.ears).toHaveLength(1);
    candidate.design.fit.sections.ears.push([
        ...candidate.design.fit.sections.ears[0],
    ]);
    expect(() => readCartoonFile(candidate)).toThrow();
});

test("fetches one selected same-origin recipe, retries a failed selection and reuses the validated result", async () => {
    const previous = global.fetch;
    const fetch = jest
        .fn()
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValue({
            ok: true,
            text: async () => JSON.stringify(file),
        });
    global.fetch = fetch;
    try {
        const url = "/models/procedural/drawn-test-native";
        expect(proceduralCharacter(url)).toBe("morty");
        expect(
            await loadRecipeForUrl("https://elsewhere.example" + url)
        ).toBeUndefined();
        await expect(loadRecipeForUrl(url)).rejects.toThrow("Could not load");
        const [a, b] = await Promise.all([
            loadRecipeForUrl(url),
            loadRecipeForUrl(url),
        ]);
        expect(a).toBe(b);
        expect(a.cartoon).toEqual(file.design);
        expect(await loadRecipeForUrl(url)).toBe(a);
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(fetch).toHaveBeenCalledWith(
            "/lobby/procedural/recipes/test-native.json",
            { redirect: "error" }
        );
    } finally {
        global.fetch = previous;
    }
});

test("a tighter authoring budget simplifies the body while preserving the head and hands", () => {
    const { design } = readCartoonFile(tess);
    const measure = (budget?: number) => {
        const actor = buildCharacter({
            style: "cartoon",
            design: {
                ...design,
                fit: { ...design.fit, triangleBudget: budget },
            },
        });
        try {
            const mesh = actor.scene.getObjectByProperty(
                "isSkinnedMesh",
                true
            ) as T.SkinnedMesh;
            const { attributes, index } = mesh.geometry;
            const protectedBones = new Set(
                mesh.skeleton.bones.flatMap((b, i) =>
                    /head|hand|thumb|index|middle|ring|little/i.test(b.name)
                        ? [i]
                        : []
                )
            );
            // Compare triangles by their retained positions, independent of compaction order.
            const protectedFaces: number[] = [];
            for (let i = 0; i < index.count; i += 3) {
                const a = index.getX(i);
                if (!protectedBones.has(attributes.skinIndex.getX(a))) continue;
                for (let j = 0; j < 3; j++) {
                    const k = index.getX(i + j);
                    protectedFaces.push(
                        attributes.position.getX(k),
                        attributes.position.getY(k),
                        attributes.position.getZ(k),
                        attributes.uv.getX(k)
                    );
                }
            }
            return { triangles: index.count / 3, protectedFaces };
        } finally {
            disposeAvatarGraph(actor.scene);
        }
    };
    const ordinary = measure();
    const target = ordinary.triangles - 24;
    const fitted = measure(target);
    expect(fitted.triangles).toBeLessThanOrEqual(target);
    expect(fitted.protectedFaces).toEqual(ordinary.protectedFaces);
    expect(measure(ordinary.triangles + 100).triangles).toBe(
        ordinary.triangles
    );
});
