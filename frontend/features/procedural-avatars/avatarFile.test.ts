import * as T from "three/webgpu";
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
