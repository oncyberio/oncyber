import * as T from "three/webgpu";
import { readFileSync } from "fs";
import { join } from "path";
import { recipeTransform } from "./recipes";
import { fitCoatRow } from "./coatPanels";
import { drawOrbVisor } from "./orbVisor";
import type { Drawing } from "./drawing";
import type { Point } from "./sculpt";
import { readAvatarFile } from "./avatarFile";
import { buildCharacter } from "./buildCharacter";
import { disposeAvatarGraph } from "../lobby/webgpu/avatarResources";
import { loadRecipeForUrl, proceduralCharacter } from "./catalog";
import { cranialStations, cranialDepth } from "./cranialBase";
import { headSections } from "./fittedHead";
import { readCartoonFile } from "./cartoonFile";
import vesper from "../../public/lobby/procedural/recipes/vesper.json";
import tess from "../../public/lobby/procedural/recipes/tess-brindle.json";

import evilMorty from "../../public/lobby/procedural/recipes/evil-morty.json";
import jessica from "../../public/lobby/procedural/recipes/jessica.json";
import beth from "../../public/lobby/procedural/recipes/beth-smith.json";
import morty from "../../public/lobby/procedural/recipes/morty-smith.json";
import summer from "../../public/lobby/procedural/recipes/summer-smith.json";
import jerry from "../../public/lobby/procedural/recipes/jerry-smith.json";
import { recipeForUrl } from "./catalog";
import { tailorCartoon } from "./cartoonCast";
import { studyCrowdMember } from "./studyCrowd";

test.each([morty, summer, jerry, beth, evilMorty, jessica])(
    "the $name file and picker build the same Rick-family body",
    (file) => {
        const { recipe } = readAvatarFile(file);
        const slug = file.name.toLowerCase().replace(/ /g, "-");
        expect(recipe.template).toBe("rick-classic");
        expect(recipe).toEqual(recipeForUrl("/models/procedural/cast-" + slug));
        expect(recipe.cartoon.parts.legs).toBe("classic");
        expect(recipe.cartoon.parts.hands).toBe("classic");
        expect(recipe.cartoon.fit.sections.nose.stroke.length).toBeGreaterThan(
            2
        );
        expect(recipe.cartoon.household.orbits).toHaveLength(2);
    }
);

test("changing Beth's shirt keeps the measured lids and closed hairstyle", () => {
    const original = readAvatarFile(beth).recipe.cartoon;
    const tailored = tailorCartoon(original, { outfit: { color: "#1177aa" } });
    expect(tailored.household.fallRows).toEqual(original.household.fallRows);
    expect(tailored.household.orbits).toEqual(original.household.orbits);
    expect(tailored.outfit.color).toBe("#1177aa");
});

test("measured fasteners and the opening belong to the button-front garment", () => {
    const file = JSON.parse(JSON.stringify(jessica));
    Object.assign(file.design.outfit, {
        buttons: [0.28, 0.51, 0.74],
        buttonColor: "#eddbc7",
        placketDepth: 0.21,
    });
    const original = readAvatarFile(file).recipe.cartoon;
    expect(original.outfit.buttonColor).toBe("#eddbc7");
    const crew = tailorCartoon(original, { outfit: { top: "crew" } });
    expect(crew.outfit.buttons).toBeUndefined();
    expect(crew.outfit.buttonColor).toBeUndefined();
    expect(crew.outfit.placketDepth).toBeUndefined();
    file.design.outfit.top = "crew";
    expect(() => readAvatarFile(file)).toThrow();
});

test("the fitted bob uses the same editable eye sockets as the household", () => {
    const file = JSON.parse(
        readFileSync(
            join(
                __dirname,
                "../../scripts/avatar_authoring/targets/holdout-v1/candidates/lark.recipe"
            ),
            "utf8"
        )
    );
    const { recipe } = readAvatarFile(file);
    const design = recipe.cartoon;
    expect(design.household.measuredBob.sections).not.toHaveProperty("eyes");
    const repaint = tailorCartoon(design, { outfit: { color: "#26757b" } });
    expect(repaint.household.measuredBob).toEqual(design.household.measuredBob);
    const taller = tailorCartoon(design, {
        head: [design.head[0], design.head[1] * 1.12],
    });
    expect(taller.fit.sections.mouth).toEqual(design.fit.sections.mouth);
    const headPositions = (cartoon: typeof design) => {
        const rig = buildCharacter({ ...recipe, cartoon });
        try {
            const mesh = rig.scene.getObjectByProperty(
                "isSkinnedMesh",
                true
            ) as T.SkinnedMesh;
            const { position, skinIndex } = mesh.geometry.attributes;
            const head = mesh.skeleton.bones.findIndex(
                (b) => b.name === "head"
            );
            const result = [];
            for (let i = 0; i < position.count; i++) {
                if (skinIndex.getX(i) === head)
                    result.push(position.getX(i), position.getY(i));
            }
            expect(result.length).toBeGreaterThan(100);
            expect(mesh.geometry.index.count / 3).toBeLessThanOrEqual(4000);
            return result;
        } finally {
            disposeAvatarGraph(rig.scene);
        }
    };
    const sized = tailorCartoon(design, {
        face: { eyeRadius: design.face.eyeRadius * 1.15 },
    });
    expect(headPositions(sized)).not.toEqual(headPositions(design));
    delete file.design.household.measuredBob.sections.nape;
    expect(() => readAvatarFile(file)).toThrow();
});

test.each(["full", "crowd"] as const)(
    "a traced shoe closes around the ankle on the animated %s mesh",
    (detail) => {
        const file = readFileSync(
            join(
                __dirname,
                "../../scripts/avatar_authoring/targets/holdout-v1/candidates/lark.recipe"
            ),
            "utf8"
        );
        const { recipe } = readAvatarFile(JSON.parse(file));
        const rig = buildCharacter(recipe, detail);
        try {
            const mesh = rig.scene.getObjectByProperty(
                "isSkinnedMesh",
                true
            ) as T.SkinnedMesh;
            const geometry = mesh.geometry;
            const { position, skinIndex, skinWeight } = geometry.attributes;
            for (const side of ["leftFoot", "rightFoot"]) {
                const foot = mesh.skeleton.bones.findIndex(
                    (b) => b.name === side
                );
                expect(foot).toBeGreaterThan(-1);
                const edges = new Map<string, number>();
                const box = new T.Box3();
                const point = new T.Vector3();
                const edgesAt = (vertex: number) => {
                    point.fromBufferAttribute(position, vertex);
                    box.expandByPoint(point);
                    return point
                        .toArray()
                        .map((v) => Math.round(v * 100000))
                        .join(",");
                };
                for (let i = 0; i < geometry.index.count; i += 3) {
                    const tri = [0, 1, 2].map((j) =>
                        geometry.index.getX(i + j)
                    );
                    if (
                        !tri.every(
                            (v) =>
                                skinIndex.getX(v) === foot &&
                                skinWeight.getX(v) > 0.999
                        )
                    )
                        continue;
                    const vertices = tri.map(edgesAt);
                    for (let j = 0; j < 3; j++) {
                        const edge = [vertices[j], vertices[(j + 1) % 3]]
                            .sort()
                            .join("/");
                        edges.set(edge, (edges.get(edge) ?? 0) + 1);
                    }
                }
                expect(edges.size).toBeGreaterThan(70);
                // Check physical edges across pigment boundaries as well as within each color.
                expect([...edges.values()].filter((n) => n !== 2)).toHaveLength(
                    0
                );
                const size = box.getSize(point);
                expect(size.z).toBeGreaterThan(size.x * 0.7);
            }
        } finally {
            disposeAvatarGraph(rig.scene);
        }
    }
);

test("the branch crowd reproduces 100 distinct shapes from two seed families", () => {
    const seeds = [
        JSON.stringify(jessica),
        JSON.stringify({
            version: 1,
            name: "Sunshine",
            style: "family",
            family: "sunshine",
            paints: {},
            proportions: {},
        }),
    ];
    const geometry = new Set<string>();
    for (let i = 0; i < 100; i++) {
        const recipe = studyCrowdMember(seeds[i % 2], i);
        geometry.add(
            JSON.stringify([
                recipe.template,
                recipe.cartoon?.head ?? recipe.headWidth,
            ])
        );
    }
    expect(geometry.size).toBe(100);
    expect(studyCrowdMember(seeds[0], 0)).toEqual(
        studyCrowdMember(seeds[0], 0)
    );
});

test("Jessica's upper teeth follow the lip and can give way to a closed smile", () => {
    const d = readAvatarFile(jessica).recipe.cartoon;
    expect(d.household.headband.color).toBe(
        jessica.design.household.headband.color
    );
    const rows = d.fit.sections.openMouth.rows;
    expect(rows.some(([, top, teeth]) => teeth - top > 2)).toBe(true);
    expect(
        rows.every((row) => row.slice(2).every((y, i) => y >= row[i + 1]))
    ).toBe(true);
    const smile = tailorCartoon(d, { mouth: "smile" });
    expect(smile.fit.sections.openMouth).toBeUndefined();
    expect(smile.household.mouthPaint).toBeUndefined();
    expect(smile.household.headband).toEqual(d.household.headband);
});

test("crowd detail keeps the pupil offsets baked into the household cornea", () => {
    const model = buildCharacter(readAvatarFile(morty).recipe, "crowd");
    try {
        const mesh = model.scene.getObjectByProperty(
            "isSkinnedMesh",
            true
        ) as T.SkinnedMesh;
        const { uv, normal } = mesh.geometry.attributes;
        expect(mesh.geometry.userData.hasCorneas).toBe(true);
        const copy = mesh.geometry.clone();
        copy.computeVertexNormals();
        const surface = copy.attributes.normal;
        let difference = 0;
        for (let i = 0; i < uv.count; i++) {
            if (uv.getX(i) >= 256)
                difference = Math.max(
                    difference,
                    Math.hypot(
                        normal.getX(i) - surface.getX(i),
                        normal.getY(i) - surface.getY(i),
                        normal.getZ(i) - surface.getZ(i)
                    )
                );
        }
        copy.dispose();
        expect(difference).toBeGreaterThan(0.7);
    } finally {
        disposeAvatarGraph(model.scene);
    }
});

test("household files reject a collapsed skull, a zero-width nose and a folded orbit", () => {
    for (const invalidate of [
        (d: typeof morty.design) => {
            d.household.widths[6] = 0;
        },
        (d: typeof morty.design) => {
            d.household.noseStroke.forEach((p) => {
                p[0] = 0;
            });
        },
        (d: typeof morty.design) => {
            d.household.orbits[0].rim.reverse();
        },
    ]) {
        const file = JSON.parse(JSON.stringify(morty));
        invalidate(file.design);
        expect(() => readAvatarFile(file)).toThrow();
    }
});

const scientist = {
    version: 1,
    style: "family",
    family: "rick-classic",
    name: "Scientist",
    proportions: { headWidth: 1.13, legLength: 0.86 },
    paints: { skin: "#905028", hair: "#ab701d" },
};
const mark = {
    color: "#4c33c0",
    outline: [
        [0.25, 0.2],
        [0.75, 0.27],
        [0.63, 0.42],
        [0.87, 0.42],
        [0.31, 0.78],
    ],
};

test("family members retain a single skinned mesh, both grips and their own cloth art at both detail levels", () => {
    for (const lod of ["crowd", "full"] as const) {
        const plain = readAvatarFile(scientist).recipe;
        const painted = readAvatarFile({
            ...scientist,
            shirtMark: mark,
        }).recipe;
        expect(painted.palette["#dfbca2"]).toBe("#905028");
        expect(painted.palette["#d9b499"]).not.toBe(painted.palette["#dfbca2"]);
        const actors = [plain, painted, plain].map((recipe) =>
            buildCharacter(recipe, lod)
        );
        try {
            const counts = actors.map((actor) => {
                const mesh = actor.scene.getObjectByProperty(
                    "isSkinnedMesh",
                    true
                ) as T.SkinnedMesh;
                expect(mesh.geometry.groups).toHaveLength(0);
                expect(
                    mesh.geometry.attributes.position.array.every(
                        Number.isFinite
                    )
                ).toBe(true);
                for (const hand of ["left", "right"] as const) {
                    const item = new T.Group();
                    actor.equipItem(hand, item);
                    expect(item.parent).not.toBeNull();
                    actor.releaseItems();
                }
                return mesh.geometry.index.count / 3;
            });
            expect(counts[0]).toEqual(counts[2]);
            expect(counts[1]).toBeGreaterThan(counts[0]);
            expect(counts[1]).toBeLessThan(4000);
        } finally {
            actors.forEach((actor) => disposeAvatarGraph(actor.scene));
        }
    }
});

test("disconnected shirt strokes add skinned fabric detail in the same material", () => {
    const islands = [
        [
            [0.2, 0.86],
            [0.76, 0.76],
            [0.55, 0.94],
        ],
    ];
    const build = (shirtMark: unknown) =>
        buildCharacter(
            readAvatarFile({ ...scientist, shirtMark }).recipe,
            "crowd"
        );
    const actors = [build(mark), build({ ...mark, islands })];
    try {
        const meshes = actors.map(
            (actor) =>
                actor.scene.getObjectByProperty(
                    "isSkinnedMesh",
                    true
                ) as T.SkinnedMesh
        );
        expect(meshes[1].geometry.index.count).toBeGreaterThan(
            meshes[0].geometry.index.count
        );
        expect(meshes[1].geometry.groups).toHaveLength(0);
        expect(Array.isArray(meshes[1].material)).toBe(false);
        expect(() =>
            readAvatarFile({
                ...scientist,
                shirtMark: { ...mark, islands: Array(4).fill(islands[0]) },
            })
        ).toThrow();
    } finally {
        actors.forEach((actor) => disposeAvatarGraph(actor.scene));
    }
});

test("a narrower Sunshine jersey carries the shoulder socket with its sleeve", () => {
    const transform = recipeTransform(
        {
            template: "sunshine",
            kitFit: {
                collar: 0,
                shoulders: 0,
                waist: 0,
                hem: 0,
                sock: 0,
                width: 1,
                chestWidth: 0.8,
            },
        },
        350,
        690,
        [350, 167, 0],
        [350, 380, 0]
    );
    const before: Point = [447, 211, 0],
        wrist: Point = [635, 211, 0];
    expect(transform(before)[0]).toBeLessThan(before[0]);
    expect(transform(wrist)[0] - transform(before)[0]).toBeCloseTo(
        wrist[0] - before[0]
    );
    expect(transform([402, 106, 0], true)).toEqual([402, 106, 0]);
    expect(transform([389, 530, 0])).toEqual([389, 530, 0]);
});

test("a crown edit extends rays beyond the scalp while preserving their roots and the face", () => {
    const transform = recipeTransform(
        { template: "sunshine", crownLength: 1.5 },
        350,
        600,
        [350, 167, 0],
        [350, 380, 0]
    );
    const root: Point = [350, 55, -2];
    const tip: Point = [350, 10, -2];
    expect(transform(root, true, false, true)).toEqual(root);
    expect(transform(tip, true, false, false)).toEqual(tip);
    expect(transform(tip, true, false, true)[1]).toBeCloseTo(-7.4);
    expect(transform(tip, true, false, true)[2]).toBe(tip[2]);
});

test("fitting the jersey collar moves the wrist and cuff by the shoulder displacement", () => {
    const transform = recipeTransform(
        {
            template: "sunshine",
            kitFit: {
                collar: -0.04,
                shoulders: 0.015,
                waist: -0.02,
                hem: 0,
                sock: 0,
                width: 1,
            },
        },
        350,
        690,
        [350, 147, 0],
        [350, 358, 0]
    );
    for (const x of [101, 599]) {
        const top = transform([x, 201, 5]),
            bottom = transform([x, 220, 5]);
        expect(bottom[1] - top[1]).toBeCloseTo(19);
        expect(top[1] - 201).toBeCloseTo(0.015 * 680);
    }
    expect(transform([350, 171, 0])[1] - 171).toBeCloseTo(-0.04 * 680);
});

test("an asymmetric crown changes its marked tips at both detail levels and preserves the scalp", () => {
    const crownProfile = [1.5, 1.2, 1, 0.8, 0.5, 0.8, 1, 1.2];
    const doc = { ...scientist, proportions: { crownProfile } };
    const recipe = readAvatarFile(doc).recipe;
    expect(() =>
        readAvatarFile({ ...doc, proportions: { crownProfile: [1] } })
    ).toThrow();
    const warp = recipeTransform(
        recipe,
        650.74,
        720,
        [650.74, 166, 0],
        [650.74, 387, 0]
    );
    for (const dx of [-72, 72]) {
        const tip: Point = [650.74 + dx, 95, -5];
        expect(warp(tip, true, false, true)[0]).toBeCloseTo(tip[0] + 11.5);
        expect(warp(tip, true)).toEqual(tip);
    }
    const root: Point = [654, 87, 9];
    expect(warp(root, true, false, true)).toEqual(root);
    for (const lod of ["full", "crowd"] as const) {
        const heads = [recipe, { template: recipe.template }, recipe].map((r) =>
            buildCharacter(r, lod)
        );
        try {
            const positions = heads.map(
                (actor) =>
                    (
                        actor.scene.getObjectByProperty(
                            "isSkinnedMesh",
                            true
                        ) as T.SkinnedMesh
                    ).geometry.attributes.position.array
            );
            const maxX = (p: (typeof positions)[number]) => {
                let max = -Infinity;
                for (let k = 0; k < p.length; k += 3) max = Math.max(max, p[k]);
                return max;
            };
            expect(positions[0]).toEqual(positions[2]);
            // Hand span stays the same. Several crown-tip positions must move.
            expect(maxX(positions[0])).toBeCloseTo(maxX(positions[1]), 4);
            expect(positions[0]).not.toEqual(positions[1]);
        } finally {
            heads.forEach((actor) => disposeAvatarGraph(actor.scene));
        }
    }
});

test("measured shorts own their cut at both detail levels and preserve the shared template", () => {
    const base = readAvatarFile(vesper).recipe;
    const shortsCut = { rise: 0.88, hemSpan: 1.14 };
    const cut = readAvatarFile({ ...vesper, shortsCut }).recipe;
    expect(() => readAvatarFile({ ...scientist, shortsCut })).toThrow();
    expect(() =>
        readAvatarFile({ ...vesper, shortsCut: { ...shortsCut, rise: 1 } })
    ).toThrow();
    for (const lod of ["full", "crowd"] as const) {
        const actors = [base, cut, base].map((r) => buildCharacter(r, lod));
        try {
            const positions = actors.map(({ scene }) => {
                const mesh = scene.getObjectByProperty(
                    "isSkinnedMesh",
                    true
                ) as T.SkinnedMesh;
                expect(mesh.geometry.groups).toHaveLength(0);
                return mesh.geometry.getAttribute("position").array;
            });
            expect(positions[0]).not.toEqual(positions[1]);
            expect(positions[0]).toEqual(positions[2]);
        } finally {
            actors.forEach(({ scene }) => disposeAvatarGraph(scene));
        }
    }
});

test("a measured jersey collar builds a separate throat only on mascot recipes", () => {
    const orbCollar = {
        radius: 0.28,
        drop: 0.16,
        band: 0.06,
        binding: "#dda555",
        skin: "#76b699",
    };
    expect(() => readAvatarFile({ ...scientist, orbCollar })).toThrow();
    expect(() =>
        readAvatarFile({ ...vesper, orbCollar: { ...orbCollar, radius: -1 } })
    ).toThrow();
    const plain = readAvatarFile(vesper).recipe;
    const fitted = readAvatarFile({ ...vesper, orbCollar }).recipe;
    for (const lod of ["full", "crowd"] as const) {
        const avatars = [plain, fitted, plain].map((recipe) =>
            buildCharacter(recipe, lod)
        );
        try {
            const triangles = avatars.map(({ scene }) => {
                const mesh = scene.getObjectByProperty(
                    "isSkinnedMesh",
                    true
                ) as T.SkinnedMesh;
                expect(mesh.skeleton.getBoneByName("neck")).toBeDefined();
                expect(Array.isArray(mesh.material)).toBe(false);
                return mesh.geometry.index.count / 3;
            });
            expect(triangles[1]).toBeGreaterThan(triangles[0]);
            expect(triangles[1]).toBeLessThan(triangles[0] + 200);
            expect(triangles[2]).toBe(triangles[0]);
        } finally {
            avatars.forEach(({ scene }) => disposeAvatarGraph(scene));
        }
    }
});

test("a single orb rig keeps its closed ray facets, two pigments and grips in both meshes", () => {
    const doc = { ...vesper, orbPaint: { top: "#7bd0a6", bottom: "#15675d" } };
    const fit = readAvatarFile(doc).recipe;
    expect(fit.palette["#ff2e90"]).toBe(doc.orbPaint.top);
    expect(fit.palette["#c21b59"]).toBe(doc.orbPaint.bottom);
    expect(() => readAvatarFile({ ...doc, eyeInk: "#111111" })).toThrow();
    expect(() => readAvatarFile({ ...doc, shirtMark: mark })).toThrow();
    const customKit = readAvatarFile({
        ...doc,
        plainJersey: true,
        shirtMark: mark,
    }).recipe;
    expect(customKit.plainJersey).toBe(true);
    expect(customKit.shirtMark).toEqual(mark);
    expect(() =>
        readAvatarFile({
            ...doc,
            sunRays: doc.sunRays.map(() => [
                [1, 0],
                [1, 0],
                [1, 0],
            ]),
        })
    ).toThrow();
    expect(() =>
        readAvatarFile({ ...scientist, orbPaint: doc.orbPaint })
    ).toThrow();
    for (const lod of ["full", "crowd"] as const) {
        const short = buildCharacter(
            { ...fit, sunRays: fit.sunRays.slice(0, -1) },
            lod
        );
        const full = buildCharacter(fit, lod);
        try {
            const mesh = (actor: typeof full) =>
                actor.scene.getObjectByProperty(
                    "isSkinnedMesh",
                    true
                ) as T.SkinnedMesh;
            const regular = mesh(full),
                fewer = mesh(short);
            expect(regular.geometry.groups).toHaveLength(0);
            expect(regular.geometry.index.count).toBeGreaterThan(
                fewer.geometry.index.count
            );
            expect(regular.geometry.index.count / 3).toBeLessThan(1600);
            expect(
                regular.geometry
                    .getAttribute("color")
                    .array.every(Number.isFinite)
            ).toBe(true);
            for (const hand of ["left", "right"] as const) {
                const item = new T.Group();
                full.equipItem(hand, item);
                expect(item.parent).toBeTruthy();
                full.releaseItems();
            }
        } finally {
            [short, full].forEach((actor) => disposeAvatarGraph(actor.scene));
        }
    }
});

test("the lens, strap and crosses follow the orb through a turn", () => {
    const fit = readAvatarFile(vesper).recipe;
    const patches: Point[][] = [];
    const recorder = { s: { triangles: (p: Point[]) => patches.push([...p]) } };
    drawOrbVisor(
        recorder as unknown as Drawing,
        fit.visor,
        "#141414",
        "#ffffff"
    );
    const radius = ([x, y, z]: Point) =>
        Math.hypot((x - 350) / 60.5, (y - 106) / 61.2, (z + 5) / 60.4);
    expect(patches).toHaveLength(2);
    expect(Math.max(...patches[0].map(radius))).toBeLessThan(1.061);
    expect(Math.min(...patches[0].map(radius))).toBeGreaterThan(1);
    expect(Math.min(...patches[0].map((p) => p[2]))).toBeLessThan(-61);
    expect(Math.min(...patches[1].map(radius))).toBeGreaterThan(
        Math.max(...patches[0].map(radius))
    );
    expect(patches[1].some(([x, , z]) => x > 365 && z > 30)).toBe(true);
    expect(patches[1].some(([x, , z]) => x < 335 && z > 30)).toBe(true);
});

test("tailoring a coat keeps its lining inside the outer cloth and closes both front hems", () => {
    const raw: Point[] = [
        [100, 360, -30],
        [142, 360, -10],
        [143, 360, 7],
        [136, 360, 18],
        [145, 360, 4],
        [144, 360, -12],
        [100, 360, -33],
    ];
    const small = fitCoatRow(raw, 360, 100, Array(7).fill(0.49));
    const wide = fitCoatRow(raw, 360, 100, Array(7).fill(0.8));
    expect(small).toHaveLength(17);
    expect(small[0][2]).toBeGreaterThan(small[16][2]);
    expect(small[4][0]).toBeLessThan(small[12][0]);
    expect(small[8][0]).toBeLessThan(wide[8][0]);
    expect(small[8][2]).toBeGreaterThan(18);
    expect(small[4][0]).toEqual(wide[4][0]);
});

test("the remote loader resolves a compact family recipe to its rig and rejects unknown features", async () => {
    const url = "/models/procedural/drawn-family-file-test";
    const original = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(scientist),
    });
    try {
        const recipe = await loadRecipeForUrl(url);
        expect(recipe.template).toBe("rick-classic");
        expect(proceduralCharacter(url)).toBe("rick-classic");
        expect(await loadRecipeForUrl(url)).toBe(recipe);
        expect(global.fetch).toHaveBeenCalledTimes(1);
    } finally {
        global.fetch = original;
    }
    expect(() =>
        readAvatarFile({ ...scientist, paints: { shorts: "#abcdef" } })
    ).toThrow();
    expect(() =>
        readAvatarFile({ ...scientist, proportions: { headWidth: 20 } })
    ).toThrow();
    expect(() =>
        readAvatarFile({ ...scientist, family: "__proto__" })
    ).toThrow();
});

test("both anatomical bases keep a source jaw and finite front and rear attachments", () => {
    const { design } = readCartoonFile(tess);
    for (const family of ["classic", "sunshine"] as const) {
        const g = { ...design, parts: { ...design.parts, skull: family } };
        const outline = headSections(g),
            rows = cranialStations(g, outline);
        expect(rows.map((r) => r.slice(0, 3))).toEqual(
            outline.map((r) => r.slice(0, 3))
        );
        const front = cranialDepth(rows, 1),
            rear = cranialDepth(rows, -1);
        for (const [y, l, r, rad, cz] of rows) {
            const x = (l + r) / 2;
            expect(front(x, y)).toBeCloseTo(cz + rad, 3);
            expect(rear(x, y)).toBeCloseTo(cz - rad, 3);
            expect(Number.isFinite(front(l - 10, y))).toBe(true);
        }
    }
});
