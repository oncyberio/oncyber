import * as T from "three/webgpu";
import { cartoonLayout } from "./cartoonCast";
import classic from "./rick-classic.json";
import sunshine from "./sunshine.json";
import sunshineJoints from "./sunshine-rig.json";
import {
    classicPupilOffset,
    classicEyeProjection,
    fitEyeDepth,
    fitPartDepth,
    fittedArmPlane,
    fitSkullDepth,
    referenceSections,
} from "./humanoidParts";
import { readCartoonFile } from "./cartoonFile";
import {
    drawBobHead,
    headSections,
    mandibularEdge,
    coveredSmileWidth,
    fitBobDepth,
    bobTangent,
    scaleEyeDepth,
    fittedOrbits,
    hairBehindEars,
    fittedEar,
    turnBobLocks,
    turnCrown,
} from "./fittedHead";
import { seatFrontalPupil, seatPupil } from "./cartoonEye";
import { buildCharacter } from "./buildCharacter";
import { disposeAvatarGraph } from "../lobby/webgpu/avatarResources";
import type { Point } from "./sculpt";
import { frontOfLoft, type Drawing, type Section } from "./drawing";
import tess from "../../public/lobby/procedural/recipes/tess-brindle.json";
import nori from "../../public/lobby/procedural/recipes/nori-quill.json";
import { cranialStations } from "./cranialBase";

test("a T-pose clips the measured eye in depth while keeping its equator and scale", () => {
    const outline: [number, number][] = [
        [-16.75, 104],
        [0, 98],
        [16.75, 104],
        [0, 115],
    ];
    const rows = fitEyeDepth(outline, 98, 115, 41.25, 33.5);
    expect(rows).toHaveLength(4);
    // The center of Rick’s dark pupil sits just above the sampled white.
    expect(classicPupilOffset).toBeCloseTo(0.2843, 2);
    const expected = [
        [0, 25.5, 57],
        [6 / 17, 24.5, 58],
        [12 / 17, 25.6, 56.8],
        [1, 28.7, 53.8],
    ];
    rows.forEach((row, i) =>
        row.forEach((v, k) => expect(v).toBeCloseTo(expected[i][k], 6))
    );
    const scaled = outline.map(([x, y]): [number, number] => [
        x * 2 + 4,
        y * 2 - 6,
    ]);
    const moved = fitEyeDepth(scaled, 190, 224, 9, 67);
    moved.forEach(([t, rear, front], i) => {
        expect(t).toBeCloseTo(rows[i][0]);
        expect(rear).toBeCloseTo(9 + 2 * (rows[i][1] - 41.25));
        expect(front).toBeCloseTo(9 + 2 * (rows[i][2] - 41.25));
    });
    expect(fitEyeDepth(outline, 10, 10, 0, 20)).toBeUndefined();
    expect(
        fitEyeDepth(
            [
                [4, 0],
                [4, 8],
            ],
            0,
            8,
            0,
            20
        )
    ).toBeUndefined();
});

test("a T-pose bob borrows skull depth without mutating or replacing an observed side", () => {
    const { design } = readCartoonFile(tess);
    const { sideGuide, ...front } = design.fit.sections;
    const single = { ...design, fit: { ...design.fit, sections: front } };
    const fitted = fitBobDepth(single);
    expect(fitted.parts.skull).not.toBe("sunshine");
    expect(single.fit.sections).not.toHaveProperty("sideGuide");
    const inferred = fitted.fit.sections.sideGuide;
    expect(
        inferred.rows.every(
            ([t, b, z, f]) => [t, b, z, f].every(Number.isFinite) && b <= z
        )
    ).toBe(true);
    expect(inferred.eyeCenter).toBeDefined();
    const [, y, rx, ry] = front.ears[0];
    expect(inferred.ear.slice(1)).toEqual([y, Math.sqrt(rx * ry), ry]);
    expect(inferred.pupilDepth).toBeUndefined();
    expect(fitBobDepth(design).fit.sections.sideGuide).toBe(sideGuide);
});

test("a round human vault and a forward chin can be reused independently from one drawing", () => {
    const { design } = readCartoonFile(nori);
    const inferred = fitBobDepth(design);
    expect(inferred.parts).toMatchObject({ skull: "sunshine", jaw: "classic" });
    expect(design.parts.skull).toBeUndefined();
    const outline = headSections(design);
    const mix = cranialStations(inferred, outline);
    const pure = (["sunshine", "classic"] as const).map((skull) => {
        const explicit = fitBobDepth({
            ...design,
            parts: { ...design.parts, skull },
        });
        expect(explicit.parts.jaw).toBeUndefined();
        return cranialStations(explicit, outline);
    });
    expect(mix[3]).toEqual(pure[0][3]);
    expect(mix.at(-1)).toEqual(pure[1].at(-1));
    expect(mix.at(-1)[4]).toBeGreaterThan(pure[0].at(-1)[4]);
    const guide = inferred.fit.sections.sideGuide;
    const t = bobTangent(inferred, guide.ear[1], [0, -50, 40]);
    expect(t).toBeGreaterThanOrEqual(-5);
    expect(t).toBeLessThan(40);
    expect(
        bobTangent(readCartoonFile(tess).design, 80, [0, -50, 40])
    ).toBeUndefined();
});

test("a hidden mandibular angle can be reconstructed or inferred from the lobe and chin", () => {
    const { design } = readCartoonFile(tess);
    const { sideGuide, ...parts } = design.fit.sections;
    const head = headSections(design);
    const measured = mandibularEdge(design, head);
    expect(measured).toEqual(sideGuide.jawEdge);
    const front = fitBobDepth({
        ...design,
        fit: { ...design.fit, sections: parts },
    });
    const estimated = mandibularEdge(front, headSections(front));
    expect(estimated.length).toBeGreaterThan(2);
    expect(estimated.flat().every(Number.isFinite)).toBe(true);
    expect(Math.abs(estimated.at(-1)[2])).toBeLessThan(
        Math.abs(estimated[0][2])
    );
    const half = (parts.mouth.rows.at(-1)[0] - parts.mouth.rows[0][0]) / 2;
    expect(coveredSmileWidth(front, -1, half)).toBeGreaterThan(half);
    expect(coveredSmileWidth(front, 1, half)).toBe(half);
    expect(front.fit.sections.sideGuide).not.toHaveProperty("turnedMouth");
});

test("the bob passes behind the ear between its photographed roots in both projections", () => {
    const { design } = readCartoonFile(tess);
    const original = design.fit.sections;
    const shape = hairBehindEars(design).fit.sections;
    const visible = fittedEar(design, 1),
        opposite = fittedEar(design, -1);
    expect(visible.visible).toBeDefined();
    expect(opposite.visible).toBeUndefined();
    expect(opposite.z).toBe(visible.z);
    expect(shape.hair.some((row, i) => row[4] < original.hair[i][4])).toBe(
        true
    );
    expect(
        shape.sideGuide.rows.some(
            (row, i) => row[2] > original.sideGuide.rows[i][2]
        )
    ).toBe(true);
    for (const [i, row] of shape.hair.entries())
        expect(row.slice(0, 4)).toEqual(original.hair[i].slice(0, 4));
    expect(shape.hair[0]).toBe(original.hair[0]);
    expect(shape.hair.at(-1)).toBe(original.hair.at(-1));
    const noHair = {
        ...design,
        fit: { ...design.fit, sections: { ...original, hair: undefined } },
    };
    expect(hairBehindEars(noHair)).toBe(noHair);
});

test("the scalp starts under the open fringe and stays out of the closed crown", () => {
    const { design } = readCartoonFile(tess);
    const surfaces: Point[][][] = [];
    const drawing = {
        s: {
            surface: (rows: Point[][]) => {
                surfaces.push(rows);
                return rows;
            },
        },
    };
    drawBobHead(
        drawing as unknown as Drawing,
        design,
        headSections(design),
        fittedOrbits(design, () => 50)
    );
    const [face, scalp] = surfaces;
    const first = face[0];
    expect(first[0][1]).toBeGreaterThan(design.fit.sections.hair[1][0]);
    expect(first.at(-1)[0] - first[0][0]).toBeGreaterThanOrEqual(
        design.head[0] * 0.01
    );
    expect(scalp[0][0][1]).toBe(first[0][1]);
});

test("projected pigments keep the nearest hit on overlapping folded panels", () => {
    const depth = frontOfLoft([
        [
            [0, 0, 1],
            [4, 0, 1],
        ],
        [
            [0, 4, 3],
            [4, 4, 3],
        ],
        [
            [0, 0, 5],
            [4, 0, 5],
        ],
    ]);
    expect(depth(2, 2)).toBeCloseTo(4);
    expect(depth(2, 4)).toBe(3);
    expect(depth(5, 2)).toBe(-Infinity);
    expect(depth(2, -1)).toBe(-Infinity);
});

test("the oblique crown fit preserves both axial silhouettes and the hairline seam", () => {
    const { design } = readCartoonFile(tess);
    const y = 12 + 0.24 * design.head[1];
    const original = Array.from({ length: 33 }, (_, i): Point => {
        const theta = (2 * Math.PI * i) / 32;
        return [51 * Math.sin(theta), y, 39 * Math.cos(theta)];
    });
    const angle = (Math.PI * 35) / 180;
    const tangent = (ring: Point[]) =>
        ring.map(([x, , z]) => Math.cos(angle) * x + Math.sin(angle) * z);
    const first = Math.min(...tangent(original)),
        last = Math.max(...tangent(original));
    design.fit.sections.sideGuide.turnedCrown = [
        [0.1, first - 5, last - 5],
        [0.35, first - 5, last - 5],
    ];
    const outer = [original.map((p) => [...p] as Point)];
    const inside = [
        original.map(([x, y, z]): Point => [x * 0.94, y, z * 0.94]),
    ];
    const initialInside = inside[0].map((p) => [...p] as Point);
    turnCrown(design, outer, inside);
    const turned = outer[0];
    for (const axis of [0, 2]) {
        const values = (ps: Point[]) => ps.map((p) => p[axis]);
        expect(Math.min(...values(turned))).toBeCloseTo(
            Math.min(...values(original)),
            8
        );
        expect(Math.max(...values(turned))).toBeCloseTo(
            Math.max(...values(original)),
            8
        );
    }
    expect(Math.min(...tangent(turned))).toBeLessThan(first - 2);
    expect(Math.max(...tangent(turned))).toBeLessThan(last - 2);
    expect(turned[0]).toEqual(original[0]);
    expect(turned.at(-1)).toEqual(original.at(-1));
    for (let j = 0; j < turned.length; j++)
        for (const axis of [0, 1, 2])
            expect(turned[j][axis] - inside[0][j][axis]).toBeCloseTo(
                original[j][axis] - initialInside[j][axis],
                8
            );
});

test("the turned lock preserves the T-pose, near lock and sewn roots", () => {
    const { design } = readCartoonFile(tess);
    const guide = design.fit.sections.sideGuide;
    guide.turnedHair = [
        [0.54, 120],
        [0.96, 120],
    ];
    const outer = [116, 126, 136, 146, 156].map((y) =>
        Array.from({ length: 17 }, (_, i): [number, number, number] => {
            const a = (i * Math.PI) / 8;
            return [Math.sin(a) * 65, y, Math.cos(a) * 35];
        })
    );
    const copyRows = () =>
        outer.map((row) =>
            row.map(([x, y, z]): [number, number, number] => [x, y, z])
        );
    const inner = copyRows(),
        original = copyRows();
    turnBobLocks(design, outer, inner);
    expect(
        outer.some((r, i) => r.some((p, j) => p[2] > original[i][j][2] + 0.01))
    ).toBe(true);
    outer.forEach((r, i) =>
        r.forEach((p, j) => {
            expect(p.slice(0, 2)).toEqual(original[i][j].slice(0, 2));
            if (p[0] <= 0 || j === 0 || j === r.length - 1)
                expect(p).toEqual(original[i][j]);
            expect(inner[i][j]).toEqual(p);
        })
    );
});

test("a depth edit moves the globe and pigment from the posterior rim without shifting frontal landmarks", () => {
    const { design } = readCartoonFile(tess);
    const original = fittedOrbits(design, () => 70);
    expect(scaleEyeDepth(original)).toBe(original);
    const back = original.eyeCenter - original.eyeSpan / 2;
    for (const scale of [0.7, 1.4]) {
        const orbit = scaleEyeDepth(original, scale);
        expect(orbit.axis).toBe(original.axis);
        expect(orbit.height).toBe(original.height);
        expect(orbit.eyeCenter - orbit.eyeSpan / 2).toBeCloseTo(back);
        expect(orbit.pupilDepth).toBeCloseTo(
            back + (original.pupilDepth - back) * scale
        );
        expect(orbit.lidSpan).toEqual(
            original.lidSpan.map((z) => back + (z - back) * scale)
        );
        for (const [i, [y, rear, front]] of original.eyeRows.entries()) {
            expect(orbit.eyeRows[i]).toEqual([
                y,
                back + (rear - back) * scale,
                back + (front - back) * scale,
            ]);
        }
    }
});

test("incompatible frontal and side pupil marks stay on the visible globe as it turns", () => {
    const rim: [number, number][] = [
        [-12, 0],
        [-9, 7],
        [0, 11],
        [9, 7],
        [12, 0],
    ];
    const [gaze, depth] = seatFrontalPupil(rim, [-9, 12], 2);
    expect(gaze).toBe(-9);
    expect(depth).toBeLessThan(12);
    expect(seatPupil(rim, [1, 6], 1)).toEqual([1, 6]);
    const [x, z] = seatPupil(rim, [-11, 10.5], 1);
    expect(x).toBeLessThan(0);
    for (let degrees = -90; degrees <= 90; degrees += 5) {
        const angle = (degrees * Math.PI) / 180;
        const project = (a: number, b: number) =>
            a * Math.cos(angle) + b * Math.sin(angle);
        const bounds = rim.map(([a, b]) => project(a, b));
        expect(project(x, z) - Math.min(...bounds)).toBeGreaterThanOrEqual(
            0.99999
        );
        expect(Math.max(...bounds) - project(x, z)).toBeGreaterThanOrEqual(
            0.99999
        );
    }
});

test("cropped hair and unequal eyes use the projection of Rick’s eye above his nasal bridge", () => {
    const { design } = readCartoonFile(tess);
    const { nape, sideGuide, ...front } = design.fit.sections;
    const orbit = fittedOrbits(
        { ...design, fit: { ...design.fit, sections: front } },
        () => 50
    );
    // The OBJ's eye apex is 58, its central bridge 49.9 and its white 33.5 wide.
    expect(classicEyeProjection).toBeCloseTo((58 - 49.9) / 33.5, 5);
    expect(orbit.eyeCenter + orbit.eyeSpan / 2).toBeCloseTo(
        50 + orbit.width * classicEyeProjection
    );
});

test("two round openings constrain globe depth independently of the haircut", () => {
    const { design } = readCartoonFile(tess);
    for (const [i, eye] of design.fit.sections.eyes.entries()) {
        const center = i ? 17 : -17;
        eye.rim = Array.from({ length: 16 }, (_, j) => {
            const a = (j / 16) * Math.PI * 2;
            return [center + 15 * Math.cos(a), 62 + 15 * Math.sin(a)];
        });
    }
    expect(fittedOrbits(design, () => 43).roundPair).toBe(true);
    for (const p of design.fit.sections.eyes[0].rim)
        p[1] = 62 + 0.5 * (p[1] - 62);
    expect(fittedOrbits(design, () => 43).roundPair).toBe(false);
});

test("a side portrait refines the same sockets inferred from the frontal drawing", () => {
    const { design } = readCartoonFile(tess);
    const measured = fittedOrbits(design, () => 70);
    const { sideGuide, ...front } = design.fit.sections;
    const inferred = fittedOrbits(
        { ...design, fit: { ...design.fit, sections: front } },
        () => 70
    );
    expect(measured.axis).toBe(inferred.axis);
    expect(measured.halfSpacing).toBe(inferred.halfSpacing);
    expect(measured.pupilDepth).toBe(sideGuide.pupilDepth);
    expect(inferred.pupilDepth).toBeUndefined();
    expect(inferred.eyeSpan).toBeCloseTo(inferred.width * 0.75);
    expect(inferred.eyeCenter).toBeLessThan(70);
});

test("the fitted jaw projects in front of the neck and converges at the measured chin", () => {
    const sections: Section[] = [
        [0, 0, 0, 0],
        [22, -30, 33, 5],
        [60, -39, 37, 5],
        [96, -16, 19, 4],
        [100, 2, 2, 0],
    ];
    const fitted = fitSkullDepth(sections, 80);
    expect(fitted.map((row) => row.slice(0, 3))).toEqual(
        sections.map((row) => row.slice(0, 3))
    );
    const chin = fitted.at(-1);
    expect(chin[3]).toBe(0);
    expect(chin[4]).toBeGreaterThan(10);
    expect(fitted[2][4] + fitted[2][3]).toBeGreaterThan(chin[4]);
});

test.each([classic.joints, sunshineJoints])(
    "retains the measured shoulder, elbow and grip plane at each reference proportion",
    (rig) => {
        const shoulder = rig.leftUpperArm[0] - rig.neck[0];
        const trunk = rig.hips[1] - rig.neck[1];
        const depths = fittedArmPlane(shoulder, trunk);
        [rig.leftUpperArm, rig.leftLowerArm, rig.leftHand].forEach((p, i) => {
            expect(depths[i]).toBeCloseTo(p[2] - rig.neck[2]);
            expect(fittedArmPlane(shoulder * 2, trunk * 2)[i]).toBeCloseTo(
                depths[i] * 2
            );
        });
    }
);

test("fits either benchmark's foot depth to the same drawing and preserves the ankle anchor", () => {
    const drawing: Section[] = [
        [0, -3, 4, 1],
        [8, -5, 8, 2],
        [18, -7, 10, 3],
        [26, -6, 8, 2],
    ];
    const archive = JSON.stringify(drawing);
    const rick = referenceSections("classic", "foot");
    const first = classic.lofts.find((p) => p.name === "shoe").rows[0].slice(1);
    const depths = first.filter((_, i) => i % 2 === 1);
    expect(rick[0][3]).toEqual((Math.max(...depths) - Math.min(...depths)) / 2);
    const boot = sunshine.parts.find((p) => p.bone === "leftFoot" && p.profile);
    expect(referenceSections("sunshine", "foot")).toBe(boot.profile);
    const flat = fitPartDepth(drawing, "classic", "foot", 3);
    const sneaker = fitPartDepth(drawing, "sunshine", "foot", 3);
    for (const result of [flat, sneaker]) {
        expect(result.map((r) => r.slice(0, 3))).toEqual(
            drawing.map((r) => r.slice(0, 3))
        );
        expect(result[0][4]).toBe(3);
        expect(result.flat().every(Number.isFinite)).toBe(true);
    }
    expect(flat).not.toEqual(sneaker);
    expect(JSON.stringify(drawing)).toBe(archive);
});

test.each(["classic", "sunshine"] as const)(
    "recipe-only %s limb selection keeps one skinned draw and both grip chains",
    (source) => {
        const { design } = readCartoonFile({
            ...tess,
            design: {
                ...tess.design,
                parts: {
                    hands: source,
                    legs: source,
                    feet: source,
                    palmRoll: 35,
                    handPitch: 6,
                },
            },
        });
        const model = buildCharacter({ style: "cartoon", design }, "crowd");
        try {
            const meshes: T.SkinnedMesh[] = [];
            model.scene.traverse((o) => {
                if ((o as T.SkinnedMesh).isSkinnedMesh)
                    meshes.push(o as T.SkinnedMesh);
            });
            expect(meshes).toHaveLength(1);
            const mesh = meshes[0];
            expect(mesh.geometry.groups).toHaveLength(0);
            expect(
                mesh.geometry
                    .getAttribute("position")
                    .array.every(Number.isFinite)
            ).toBe(true);
            const item = new T.Group();
            for (const side of ["right", "left"] as const) {
                model.equipItem(side, item);
                expect(item.parent.parent).toBe(
                    mesh.skeleton.getBoneByName(side + "Hand")
                );
                expect(
                    mesh.skeleton.getBoneByName(side + "ThumbDistal")
                ).toBeDefined();
            }
            model.releaseItems();
            expect(item.parent).toBeNull();
        } finally {
            disposeAvatarGraph(model.scene);
        }
    }
);

test("adding garment sections preserves the anatomical elbow and knee", () => {
    const { design } = readCartoonFile(tess);
    const sections = design.fit.sections;
    const before = cartoonLayout(design).landmarks;
    const denser = {
        ...sections,
        arm: [sections.arm[0], sections.arm[1], ...sections.arm.slice(1)],
        leg: [sections.leg[0], sections.leg[1], ...sections.leg.slice(1)],
    };
    const after = cartoonLayout({
        ...design,
        fit: { ...design.fit, sections: denser },
    }).landmarks;
    expect(after.arms).toEqual(before.arms);
    expect(after.legs).toEqual(before.legs);
    const [shoulder, elbow, wrist] = before.arms[1];
    expect((elbow[0] - shoulder[0]) / (wrist[0] - shoulder[0])).toBeCloseTo(
        0.5,
        1
    );
});
