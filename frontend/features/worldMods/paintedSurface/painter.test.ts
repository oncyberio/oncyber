/** @jest-environment node */
import { createPainter, hex, seeded, toLinear, type Vec3 } from "./painter";

const RED = hex("#ff0000");
const FLOOR: Vec3[] = [
    [0, 0, 0],
    [0, 0, 4],
    [3, 0, 4],
    [3, 0, 0],
];

/** Strokes as objects, easier to assert on than packed floats. */
function strokes(
    painted: ReturnType<ReturnType<typeof createPainter>["build"]>
) {
    const { count, centre, axis, normal, colour } = painted.strokes;
    return Array.from({ length: count }, (_, i) => ({
        at: [...centre.subarray(i * 4, i * 4 + 3)],
        length: centre[i * 4 + 3],
        along: [...axis.subarray(i * 4, i * 4 + 3)],
        width: axis[i * 4 + 3],
        facing: [...normal.subarray(i * 4, i * 4 + 3)],
        lift: normal[i * 4 + 3],
        colour: [...colour.subarray(i * 4, i * 4 + 3)],
    }));
}

test("a colour is read from hex and stored linear", () => {
    expect(hex("#ff8000")).toEqual([1, 128 / 255, 0]);
    expect(toLinear(1)).toBeCloseTo(1);
    expect(toLinear(0.5)).toBeCloseTo(0.214, 3);
});

test("the same seed gives the same numbers", () => {
    const a = seeded(7);
    const b = seeded(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(seeded(8)()).not.toBe(seeded(7)());
});

describe("poly", () => {
    const painted = createPainter({ seed: 3 })
        .poly(FLOOR, { palette: [RED], length: 0.8, width: 0.2 })
        .build();
    const all = strokes(painted);

    test("lays an underpaint the shape of the surface", () => {
        expect(painted.base.position.length).toBe(4 * 3);
        expect([...painted.base.index]).toEqual([0, 1, 2, 0, 2, 3]);
    });

    test("covers it with strokes that stay on it", () => {
        // 12 square units at about 0.16 a stroke, overlapping
        expect(all.length).toBeGreaterThan(80);
        for (const stroke of all) {
            const [x, y, z] = stroke.at;
            const reach = stroke.length / 2 + 1e-4;
            expect(y).toBeCloseTo(0);
            expect(x).toBeGreaterThanOrEqual(0);
            expect(x).toBeLessThanOrEqual(3);
            // ends, not just middles, are inside along the flow
            expect(z - reach * Math.abs(stroke.along[2])).toBeGreaterThan(
                -0.05
            );
            expect(z + reach * Math.abs(stroke.along[2])).toBeLessThan(4.05);
        }
    });

    test("faces the side its corners are counter-clockwise from", () => {
        for (const stroke of all) {
            expect(stroke.facing[1]).toBeCloseTo(1);
            expect(stroke.lift).toBeGreaterThan(0);
        }
    });

    test("runs its strokes along the first edge, give or take the wobble", () => {
        for (const stroke of all)
            expect(Math.abs(stroke.along[2])).toBeGreaterThan(0.9);
        const across = strokes(
            createPainter({ seed: 3 })
                .poly(FLOOR, { palette: [RED], flow: Math.PI / 2, wobble: 0 })
                .build()
        );
        for (const stroke of across)
            expect(Math.abs(stroke.along[0])).toBeCloseTo(1);
    });

    test("paints the same surface the same way every time", () => {
        const again = createPainter({ seed: 3 })
            .poly(FLOOR, { palette: [RED], length: 0.8, width: 0.2 })
            .build();
        expect(again.strokes.centre).toEqual(painted.strokes.centre);
        expect(again.strokes.colour).toEqual(painted.strokes.colour);
    });

    test("thins out when asked to (phones)", () => {
        const thin = createPainter({ seed: 3, density: 0.5 })
            .poly(FLOOR, { palette: [RED], length: 0.8, width: 0.2 })
            .build();
        expect(thin.strokes.count).toBeLessThan(painted.strokes.count * 0.75);
    });

    test("keeps a triangle's strokes inside the triangle", () => {
        const triangle = strokes(
            createPainter({ seed: 5 })
                .poly(
                    [
                        [0, 0, 0],
                        [4, 0, 0],
                        [2, 3, 0],
                    ],
                    {
                        palette: [RED],
                        length: 0.6,
                        width: 0.15,
                        flow: Math.PI / 2,
                    }
                )
                .build()
        );
        expect(triangle.length).toBeGreaterThan(20);
        for (const { at } of triangle) {
            // under both sloping edges
            expect(at[1]).toBeLessThanOrEqual(1.5 * at[0] + 1e-6);
            expect(at[1]).toBeLessThanOrEqual(1.5 * (4 - at[0]) + 1e-6);
        }
    });
});

test("light is painted into the colours", () => {
    const dim = createPainter({ seed: 1, light: () => [0.5, 0.5, 0.5] })
        .poly(FLOOR, { palette: [RED], under: RED, vary: 0 })
        .build();
    expect(dim.base.colour[0]).toBeCloseTo(0.5);
    expect(strokes(dim)[0].colour[0]).toBeCloseTo(0.5);
    expect(strokes(dim)[0].colour[1]).toBeCloseTo(0);
});

test("a box paints the sides it is asked for, each facing out", () => {
    const box = strokes(
        createPainter({ seed: 2 })
            .box([0, 0, 0], [1, 2, 3], { palette: [RED], faces: "XY" })
            .build()
    );
    const facings = new Set(
        box.map(({ facing }) => facing.map(Math.round).join())
    );
    expect([...facings].sort()).toEqual(["0,1,0", "1,0,0"]);
    for (const { at, facing } of box) {
        if (Math.round(facing[0]) === 1) expect(at[0]).toBeCloseTo(1);
        else expect(at[1]).toBeCloseTo(2);
    }
});

test("a beam shows the face it is given and the two beside it", () => {
    const beam = strokes(
        createPainter({ seed: 2 })
            .beam([0, 0, 0], [4, 0, 0], [0, -1, 0], 0.4, 0.3, {
                palette: [RED],
            })
            .build()
    );
    const facings = new Set(
        beam.map(({ facing }) => facing.map(Math.round).join())
    );
    expect([...facings].sort()).toEqual(["0,-1,0", "0,0,-1", "0,0,1"]);
    // the face it shows stands proud of the line by its depth
    for (const { at, facing } of beam)
        if (Math.round(facing[1]) === -1) expect(at[1]).toBeCloseTo(-0.3);
});

test("a column's sides face out and its top faces up", () => {
    const column = strokes(
        createPainter({ seed: 2 })
            .prism([0, 0], 1, 0, 2, {
                palette: [RED],
                sides: 6,
                length: 0.5,
                width: 0.2,
            })
            .build()
    );
    for (const { at, facing } of column) {
        if (facing[1] > 0.9) expect(at[1]).toBeCloseTo(2);
        else expect(at[0] * facing[0] + at[2] * facing[2]).toBeGreaterThan(0.5);
    }
});

test("a line is drawn end to end in overlapping strokes", () => {
    const line = strokes(
        createPainter({ seed: 4 })
            .line([0, 1, 0], [5, 1, 0], [0, 0, 1], { colour: RED, reach: 1 })
            .build()
    );
    expect(line).toHaveLength(5);
    expect(line.reduce((sum, { length }) => sum + length, 0)).toBeGreaterThan(
        5
    );
    for (const { at, facing } of line) {
        expect(at[1]).toBeCloseTo(1, 1);
        expect(facing[2]).toBeCloseTo(1);
    }
});

test("a placement turns and moves what is painted inside it", () => {
    const placed = createPainter({ seed: 1 });
    // a quarter turn takes +z to +x
    placed.place([10, 0, 0], Math.PI / 2, () =>
        placed.dab([0, 0, 2], [0, 0, 1], [0, 1, 0], 1, 0.2, RED)
    );
    const [dab] = strokes(placed.build());
    expect(dab.at[0]).toBeCloseTo(12);
    expect(dab.at[2]).toBeCloseTo(0);
    expect(dab.along[0]).toBeCloseTo(1);
    expect(dab.facing[1]).toBeCloseTo(1);
});

test("the bounds hold everything painted", () => {
    const painted = createPainter({ seed: 1 })
        .poly(FLOOR, { palette: [RED] })
        .build();
    expect(painted.bounds.min[0]).toBeLessThanOrEqual(0);
    expect(painted.bounds.max[2]).toBeGreaterThanOrEqual(4);
    expect(createPainter().build().bounds).toEqual({
        min: [0, 0, 0],
        max: [0, 0, 0],
    });
});
