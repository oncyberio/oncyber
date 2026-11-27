import {
    RIM_POINTS,
    eyeWarp,
    faceWarp,
    layBrow,
    levelsWarp,
    measureBrow,
    monotone,
    openingFrame,
    outlineWarp,
    renewNormals,
    resample,
    roundEar,
    roundOff,
    silhouette,
    smoothCurve,
    warpGeometry,
    wearMorphs,
    type FaceMarks,
    type V2,
} from "./shape";

/** A rim like an eye's: an ellipse in a plane turned about the upright. */
function eyeRim(turnDegrees: number, count = 16) {
    const turn = (turnDegrees * Math.PI) / 180;
    const position: number[] = [];
    const normal: number[] = [];
    for (let i = 0; i < count; i++) {
        // From the inner corner over the top to the outer, then back below.
        const angle = Math.PI - (i / count) * Math.PI * 2;
        const u = Math.cos(angle) * 0.02;
        const v = Math.sin(angle) * 0.01;
        // The figure faces -z; its left eye is at +x here.
        position.push(
            0.045 + u * Math.cos(turn),
            1.6 + v,
            -0.09 + u * Math.sin(turn)
        );
        normal.push(Math.sin(turn), 0, -Math.cos(turn));
    }
    return {
        position,
        normal,
        rim: {
            loop: position.map((_, i) => i).slice(0, count),
            turn: count / 2,
        },
    };
}

describe("an opening's own frame", () => {
    const { position, normal, rim } = eyeRim(20);
    const frame = openingFrame(position, normal, rim, -1);

    it("faces out of the face, runs corner to corner and has up upwards", () => {
        expect(frame.out[2]).toBeLessThan(-0.9);
        // Tilted with the rim's plane, not straight ahead.
        expect(Math.abs(frame.out[0])).toBeGreaterThan(0.3);
        expect(frame.across[0]).toBeGreaterThan(0.9);
        expect(frame.up[1]).toBeCloseTo(1, 6);
        const dot =
            frame.across[0] * frame.out[0] +
            frame.across[1] * frame.out[1] +
            frame.across[2] * frame.out[2];
        expect(dot).toBeCloseTo(0, 6);
    });

    it("describes the edge by a set number of points: above, then below", () => {
        expect(frame.rim).toHaveLength(RIM_POINTS);
        const half = RIM_POINTS / 2;
        // Corners at the two ends of the long axis.
        expect(frame.rim[0][0]).toBeCloseTo(-0.02, 4);
        expect(frame.rim[half][0]).toBeCloseTo(0.02, 4);
        for (let i = 1; i < half; i++) {
            expect(frame.rim[i][1]).toBeGreaterThan(0);
            expect(frame.rim[half + i][1]).toBeLessThan(0);
        }
        // Rounded off, it stays inside the mesh's own polygon.
        expect(frame.rim[half / 2][1]).toBeLessThan(0.01);
        expect(frame.rim[half / 2][1]).toBeGreaterThan(0.009);
    });

    it("takes the skin's own facing where the opening is shut", () => {
        // A mouth closed to a line: no area to be square to.
        const line = eyeRim(0);
        for (let i = 0; i < 16; i++) line.position[i * 3 + 1] = 1.5;
        const shut = openingFrame(line.position, line.normal, line.rim, -1);
        expect(shut.out[2]).toBeCloseTo(-1, 6);
        expect(shut.up[1]).toBeCloseTo(1, 6);
    });
});

describe("lines of points", () => {
    it("spaces points evenly along a line, keeping its ends", () => {
        const even = resample(
            [
                [0, 0],
                [1, 0],
                [1, 3],
            ],
            5
        );
        expect(even).toHaveLength(5);
        expect(even[0]).toEqual([0, 0]);
        expect(even[4]).toEqual([1, 3]);
        expect(even[1]).toEqual([1, 0]);
        expect(even[2][1]).toBeCloseTo(1, 9);
    });

    it("rounds a corner off without moving the ends", () => {
        const corner: V2[] = [
            [0, 0],
            [1, 0],
            [1, 1],
        ];
        const round = roundOff(corner, 2);
        expect(round[0]).toEqual([0, 0]);
        expect(round[round.length - 1]).toEqual([1, 1]);
        // Nothing reaches the corner itself any more.
        for (const p of round)
            expect(Math.hypot(p[0] - 1, p[1]) > 0.1).toBe(true);
    });
});

describe("an eye's own outline", () => {
    // A rim as a figure has it: an ellipse 40 mm wide, level.
    const rim: [number, number, number][] = [];
    for (let i = 0; i < 16; i++) {
        const angle = Math.PI - (i / 16) * Math.PI * 2;
        rim.push([
            0.045 + Math.cos(angle) * 0.02,
            1.6 + Math.sin(angle) * 0.01,
            -0.09,
        ]);
    }
    // Flat on top, its outer corner raised.
    const outline = {
        upper: [
            [0, 0],
            [0.3, 0.28],
            [1, 0.34],
        ] as V2[],
        lower: [
            [0, 0],
            [0.5, -0.12],
            [1, 0.34],
        ] as V2[],
    };
    const fit = {
        rim,
        turn: 8,
        side: 1,
        forwardZ: -1,
        outline,
        size: 1.2,
        inset: [-0.1, 0.05] as V2,
    };
    const warp = eyeWarp(fit);
    const inner = rim[0];
    /** A point seen from the front, in the new eye's widths. */
    const seen = (p: number[]): V2 => [
        (p[0] - inner[0] - -0.1 * 0.04) / (0.04 * 1.2),
        (p[1] - inner[1] - 0.05 * 0.04) / (0.04 * 1.2),
    ];

    it("draws a smooth curve through its points", () => {
        const curve = smoothCurve(outline.upper, 8);
        expect(curve[0]).toEqual([0, 0]);
        expect(curve[8]).toEqual([0.3, 0.28]);
        expect(curve[curve.length - 1]).toEqual([1, 0.34]);
        // It turns the corner at a point gradually: just past it, it is
        // still rising faster than the straight line to the next point.
        expect(curve[12][1]).toBeGreaterThan(0.32);
        const slope = (i: number) =>
            (curve[i + 1][1] - curve[i][1]) / (curve[i + 1][0] - curve[i][0]);
        // Straight lines between the points would turn by 0.85 there.
        expect(Math.abs(slope(7) - slope(8))).toBeLessThan(0.3);
    });

    it("puts the corners where the style says, at the size it says", () => {
        // To within a few microns: each vertex goes with all the rim,
        // its own place counting for nearly everything.
        const [ix, iy] = seen(warp(rim[0]));
        const [ox, oy] = seen(warp(rim[8]));
        expect(ix).toBeCloseTo(0, 3);
        expect(iy).toBeCloseTo(0, 3);
        expect(ox).toBeCloseTo(1, 3);
        expect(oy).toBeCloseTo(0.34, 3);
    });

    it("lays every vertex of the rim on the outline", () => {
        const upper = smoothCurve(outline.upper, 32);
        const lower = smoothCurve(outline.lower, 32);
        const off = (p: V2, curve: V2[]) =>
            Math.min(...curve.map((c) => Math.hypot(c[0] - p[0], c[1] - p[1])));
        for (let i = 0; i <= 8; i++)
            expect(off(seen(warp(rim[i])), upper)).toBeLessThan(0.02);
        for (let i = 8; i < 16; i++)
            expect(off(seen(warp(rim[i])), lower)).toBeLessThan(0.02);
        // The lower edge stays below the upper.
        expect(warp(rim[12])[1]).toBeLessThan(warp(rim[4])[1]);
    });

    it("moves what is inside with the rim, and nothing far off or across the face", () => {
        // The middle of the opening, a little behind it (the eye itself).
        const middle = warp([0.045, 1.6, -0.085]);
        expect(middle[1]).toBeGreaterThan(1.6);
        expect(middle[2]).toBe(-0.085);
        expect(warp([0.045, 1.7, -0.09])).toEqual([0.045, 1.7, -0.09]);
        expect(warp([0.045, 1.6, 0.05])).toEqual([0.045, 1.6, 0.05]);
        expect(warp([-0.045, 1.6, -0.09])).toEqual([-0.045, 1.6, -0.09]);
        expect(warp([0, 1.6, -0.1])).toEqual([0, 1.6, -0.1]);
    });

    it("mirrors for the other eye", () => {
        const other = eyeWarp({
            ...fit,
            rim: rim.map((p) => [-p[0], p[1], p[2]]),
            side: -1,
        });
        const a = warp(rim[5]);
        const b = other([-rim[5][0], rim[5][1], rim[5][2]]);
        expect(b[0]).toBeCloseTo(-a[0], 9);
        expect(b[1]).toBeCloseTo(a[1], 9);
    });
});

describe("a head's levels and outline", () => {
    it("draws a curve through points that never turns back", () => {
        const curve = monotone([0, 1, 2, 4], [0, 1, 3, 4]);
        for (const [x, y] of [
            [0, 0],
            [1, 1],
            [2, 3],
            [4, 4],
        ])
            expect(curve(x)).toBeCloseTo(y, 9);
        let last = -Infinity;
        for (let x = -1; x <= 5; x += 0.05) {
            expect(curve(x)).toBeGreaterThanOrEqual(last);
            last = curve(x);
        }
        // Beyond its ends it only moves things along.
        expect(curve(-3)).toBeCloseTo(-3, 9);
        expect(curve(9) - curve(8)).toBeCloseTo(1, 9);
    });

    it("moves features to new heights and what lies beyond with them", () => {
        // A mouth at 1.50 goes to 1.48 and a chin at 1.46 to 1.43;
        // nothing above 1.58 moves.
        const warp = levelsWarp([1.58, 1.5, 1.46], [1.58, 1.48, 1.43]);
        expect(warp([0.01, 1.5, 0.02])).toEqual([0.01, 1.48, 0.02]);
        expect(warp([0, 1.46, 0])[1]).toBeCloseTo(1.43, 9);
        expect(warp([0, 1.7, 0])[1]).toBeCloseTo(1.7, 9);
        // Below the chin everything is 3 cm lower, and in between the
        // order of things is kept.
        expect(warp([0, 1.4, 0])[1]).toBeCloseTo(1.37, 9);
        expect(warp([0, 1.55, 0])[1]).toBeGreaterThan(warp([0, 1.54, 0])[1]);
    });

    // A diamond in the plane z = 0: 8 cm wide at y = 1, coming to
    // points 10 cm above and below.
    const diamond = {
        position: [0, 1.1, 0, 0.04, 1, 0, 0, 0.9, 0, -0.04, 1, 0],
        indices: [0, 1, 3, 1, 2, 3],
    };

    it("measures how wide surfaces are at each height", () => {
        const width = silhouette([diamond], 0);
        expect(width(1)).toBeCloseTo(0.04, 6);
        expect(width(1.05)).toBeCloseTo(0.02, 6);
        expect(width(0.925)).toBeCloseTo(0.01, 6);
        expect(width(1.2)).toBe(0);
        // Off its middle line, it is the furthest reach that counts.
        expect(silhouette([diamond], 0.01)(1)).toBeCloseTo(0.05, 6);
        // Triangles can be left out.
        const upper = silhouette(
            [{ ...diamond, keep: (a: number) => a === 0 }],
            0
        );
        expect(upper(0.95)).toBe(0);
    });

    it("gives a head another outline and leaves its middle alone", () => {
        const warp = outlineWarp({
            centre: 0,
            width: () => 0.08,
            widen: (y) => (y > 1 ? 0.9 : 1.2),
            core: () => 0.5,
        });
        // The edge goes to the new width, on both sides.
        expect(warp([0.08, 1.1, 0])[0]).toBeCloseTo(0.072, 9);
        expect(warp([-0.08, 1.1, 0])[0]).toBeCloseTo(-0.072, 9);
        expect(warp([0.08, 0.9, 0])[0]).toBeCloseTo(0.096, 9);
        // The core does not move; between, less than the edge does.
        expect(warp([0.03, 1.1, 0.01])).toEqual([0.03, 1.1, 0.01]);
        // Halfway from the core to the edge, half as much as the edge.
        expect(warp([0.06, 1.1, 0])[0]).toBeCloseTo(0.056, 9);
        // An ear, outside the edge, goes with it and keeps its size.
        expect(warp([0.1, 1.1, 0])[0]).toBeCloseTo(0.092, 9);
        // Nothing folds: further out stays further out.
        let last = 0;
        for (let x = 0; x <= 0.1; x += 0.002) {
            const to = warp([x, 1.1, 0])[0];
            expect(to).toBeGreaterThanOrEqual(last);
            last = to;
        }
    });

    it("narrows without folding even when little is held back", () => {
        const warp = outlineWarp({
            centre: 0,
            width: () => 0.08,
            widen: () => 0.75,
            core: () => 0.9,
        });
        let last = 0;
        for (let x = 0; x <= 0.09; x += 0.001) {
            const to = warp([x, 1, 0])[0];
            expect(to).toBeGreaterThanOrEqual(last);
            last = to;
        }
        expect(warp([0.08, 1, 0])[0]).toBeCloseTo(0.06, 9);
    });
});

describe("reshaping by degrees, with normals", () => {
    it("moves each vertex by its own share, expressions too", () => {
        const geometry = {
            position: Float32Array.from([0, 1, 0, 0, 1, 0, 0, 1, 0]),
            morphs: [Float32Array.from([0, 0.5, 0, 0, 0.5, 0, 0, 0, 0])],
        };
        // Twice as tall.
        warpGeometry(geometry, (p) => [p[0], p[1] * 2, p[2]], [1, 0.5, 0]);
        expect([...geometry.position]).toEqual([0, 2, 0, 0, 1.5, 0, 0, 1, 0]);
        // What the expression added is stretched by the same share.
        expect(geometry.morphs[0][1]).toBeCloseTo(1, 6);
        expect(geometry.morphs[0][4]).toBeCloseTo(0.75, 6);
        expect(geometry.morphs[0][7]).toBe(0);
    });

    it("turns normals as the surface turns", () => {
        // A slope at 45 degrees, squeezed to half its width: it gets
        // steeper, and its normal leans over further.
        const lean = Math.SQRT1_2;
        const geometry = {
            position: Float32Array.from([0.1, 1, 0]),
            morphs: [],
            normal: Float32Array.from([lean, lean, 0]),
        };
        warpGeometry(geometry, (p) => [p[0] * 0.5, p[1], p[2]]);
        const [nx, ny, nz] = geometry.normal;
        expect(nx / ny).toBeCloseTo(2, 4);
        expect(nz).toBeCloseTo(0, 6);
        expect(Math.hypot(nx, ny, nz)).toBeCloseTo(1, 6);
        // Moving a surface along turns nothing.
        const moved = {
            position: Float32Array.from([0.1, 1, 0]),
            morphs: [],
            normal: Float32Array.from([lean, lean, 0]),
        };
        warpGeometry(moved, (p) => [p[0] + 0.02, p[1] - 0.01, p[2]]);
        expect(moved.normal[0]).toBeCloseTo(lean, 6);
        expect(moved.normal[1]).toBeCloseTo(lean, 6);
    });
});

describe("rounding an ear", () => {
    // A flap standing off the side of the head: a diamond, 100 mm tall
    // and 33 mm deep, leaning out at 45 degrees. A ring of vertices
    // round its outline, two more inside, one in the middle, and a root
    // where it joins the head at the front.
    const make = () => {
        const outline: [number, number][] = [];
        for (let i = 0; i < 24; i++) {
            const angle = (i / 24) * Math.PI * 2;
            // A diamond: far out along its axes, drawn in between them.
            const r =
                0.03 /
                (Math.abs(Math.cos(angle)) + Math.abs(Math.sin(angle)) * 0.6);
            outline.push([Math.cos(angle) * r * 0.55, Math.sin(angle) * r]);
        }
        const flat: [number, number][] = [];
        for (const ring of [1, 0.66, 0.33])
            for (const p of outline) flat.push([p[0] * ring, p[1] * ring]);
        flat.push([0, 0]);
        // In the flap's plane: u towards the back and out, v up.
        const lean = Math.SQRT1_2;
        const position = new Float32Array(flat.length * 3);
        flat.forEach(([u, v], i) => {
            position.set(
                [0.08 + (u + 0.0165) * lean, 1.6 + v, (u + 0.0165) * lean],
                i * 3
            );
        });
        const all = flat.map((_, i) => i);
        // The front edge of the outline is where it joins the head.
        const root = all.filter((i) => i < 24 && flat[i][0] < -0.012);
        return { position, all, root, flat };
    };
    /** How far from round an outline is: the spread of its radii. */
    const unevenness = (position: Float32Array, ids: number[]) => {
        const lean = Math.SQRT1_2;
        const pts = ids.map((i) => [
            (position[i * 3] - 0.08) * lean + position[i * 3 + 2] * lean,
            position[i * 3 + 1] - 1.6,
        ]);
        const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
        const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
        // Along the outline's own long and short axes, as an oval would be.
        const radii = pts.map((p) =>
            Math.hypot((p[0] - cx) / 0.0165, (p[1] - cy) / 0.05)
        );
        const mean = radii.reduce((a, b) => a + b, 0) / radii.length;
        return Math.sqrt(
            radii.reduce((a, r) => a + (r - mean) ** 2, 0) / radii.length
        );
    };
    const rim = Array.from({ length: 24 }, (_, i) => i);

    it("draws the outline towards an oval, and leaves the join alone", () => {
        const ear = make();
        const before = Float32Array.from(ear.position);
        const frame = roundEar(ear.position, ear, -1, 1);
        expect(frame).not.toBeNull();
        expect(unevenness(ear.position, rim)).toBeLessThan(
            unevenness(before, rim) * 0.6
        );
        for (const v of ear.root)
            for (let k = 0; k < 3; k++)
                expect(ear.position[v * 3 + k]).toBe(before[v * 3 + k]);
        // The point at the top has come down.
        expect(ear.position[6 * 3 + 1]).toBeLessThan(before[6 * 3 + 1] - 0.002);
        // It stayed in its own plane: out and back still move together.
        for (const v of rim) {
            const out = ear.position[v * 3] - 0.08;
            const back = ear.position[v * 3 + 2];
            expect(out).toBeCloseTo(back, 5);
        }
    });

    it("does nothing at 0, and less than everything in between", () => {
        const ear = make();
        const before = Float32Array.from(ear.position);
        roundEar(ear.position, ear, -1, 0);
        for (let i = 0; i < before.length; i++)
            expect(ear.position[i]).toBeCloseTo(before[i], 7);
        const half = make();
        roundEar(half.position, half, -1, 0.5);
        const whole = make();
        roundEar(whole.position, whole, -1, 1);
        const top = (e: { position: Float32Array }) => e.position[6 * 3 + 1];
        expect(top(half)).toBeLessThan(before[6 * 3 + 1]);
        expect(top(half)).toBeGreaterThan(top(whole));
    });

    it("hollows it towards the head, deepest in the middle", () => {
        const ear = make();
        const before = Float32Array.from(ear.position);
        const frame = roundEar(ear.position, ear, -1, 0, 1, 0.3);
        // Out of the face that shows: away from the head, and forwards.
        expect(frame.out[0]).toBeGreaterThan(0.5);
        expect(frame.out[2]).toBeLessThan(-0.5);
        const sunk = (v: number) =>
            (before[v * 3] - ear.position[v * 3]) * frame.out[0] +
            (before[v * 3 + 2] - ear.position[v * 3 + 2]) * frame.out[2];
        const middle = ear.all.length - 1;
        expect(sunk(middle)).toBeGreaterThan(0.003);
        // The far rim stays where it was.
        expect(Math.abs(sunk(0))).toBeLessThan(0.0005);
        // What shades it finds the bowl at its middle, the rim at 1.
        const along = (v: number, axis: number[]) =>
            [0, 1, 2].reduce(
                (sum, k) =>
                    sum + (before[v * 3 + k] - frame.centre[k]) * axis[k],
                0
            );
        const far = (v: number) =>
            Math.hypot(along(v, frame.long), along(v, frame.short));
        expect(far(middle)).toBeLessThan(0.35);
        expect(far(6)).toBeGreaterThan(0.8);
    });

    it("makes it larger about where it joins", () => {
        const ear = make();
        const before = Float32Array.from(ear.position);
        roundEar(ear.position, ear, -1, 0, 1.2);
        const height = (p: Float32Array) =>
            Math.max(...rim.map((v) => p[v * 3 + 1])) -
            Math.min(...rim.map((v) => p[v * 3 + 1]));
        expect(height(ear.position)).toBeGreaterThan(height(before) * 1.1);
        for (const v of ear.root)
            expect(ear.position[v * 3 + 1]).toBe(before[v * 3 + 1]);
    });

    it("gives a turned surface the normals of its triangles", () => {
        // Two triangles folded along an edge, their normals all stale.
        const position = Float32Array.from([
            0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 1,
        ]);
        const normal = Float32Array.from([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]);
        renewNormals(position, normal, [0, 1, 2, 1, 3, 2], [0, 3]);
        // The corner only the flat triangle touches faces straight out.
        expect([...normal.slice(0, 3)]).toEqual([0, 0, 1]);
        // The far corner belongs to the tilted one.
        expect(normal[11]).toBeGreaterThan(0.5);
        expect(normal[9]).toBeLessThan(-0.3);
        // Vertices that were not asked for are left as they were.
        expect([...normal.slice(3, 6)]).toEqual([0, 1, 0]);
    });
});

describe("wearing an expression as the resting face", () => {
    const names = [
        "Fcl_EYE_Angry",
        "Fcl_EYE_Close",
        "Fcl_EYE_Sorrow",
        "Fcl_MTH_A",
        "Fcl_MTH_Close",
        "Fcl_EYE_Close_R",
    ];
    // Vertex 0: an upper lid, 10 mm above where it shuts. Vertex 1: a lip.
    // Vertex 2: the corner of that eye, which a blink leaves alone.
    // Vertex 3: the other eye's upper lid.
    const make = () => ({
        position: Float32Array.from([
            0.04, 0.01, 0, 0, -0.05, 0, 0.02, 0.005, 0, -0.04, 0.01, 0,
        ]),
        morphs: [
            Float32Array.from([
                0, -0.002, 0, 0, 0, 0, 0, -0.001, 0, 0, -0.002, 0,
            ]),
            Float32Array.from([0, -0.01, 0, 0, 0, 0, 0, 0, 0, 0, -0.01, 0]),
            Float32Array.from([
                0, -0.004, 0.001, 0, 0, 0, 0, 0, 0, 0, -0.004, 0.001,
            ]),
            Float32Array.from([0, 0, 0, 0, -0.006, 0, 0, 0, 0, 0, 0, 0]),
            Float32Array.from([0, 0, 0, 0, 0.001, 0, 0, 0, 0, 0, 0, 0]),
            // A wink, with a trace of movement on the other side.
            Float32Array.from([0, -0.01, 0, 0, 0, 0, 0, 0, 0, 0, -0.00001, 0]),
        ],
    });
    const wornFace = { EYE_Angry: 1, EYE_Close: 0.3, MTH_Close: 1 };

    it("moves the resting face", () => {
        const g = make();
        wearMorphs(g, names, wornFace);
        // 2 mm of the angry lid and 3 mm of the blink.
        expect(g.position[1]).toBeCloseTo(0.005, 6);
        expect(g.position[7]).toBeCloseTo(0.004, 6);
        expect(g.position[4]).toBeCloseTo(-0.049, 6);
    });

    it("still shuts the eye exactly as the figure does, corners and all", () => {
        const g = make();
        wearMorphs(g, names, wornFace);
        const shut = (v: number) =>
            g.position[v * 3 + 1] + g.morphs[1][v * 3 + 1];
        // The lid ends where it always did, at 0; the corner, which the
        // worn face had lowered, goes back to its own place as it shuts.
        expect(shut(0)).toBeCloseTo(0, 6);
        expect(shut(2)).toBeCloseTo(0.005, 6);
        // The mouth stays as worn through a blink.
        expect(shut(1)).toBeCloseTo(-0.049, 6);
    });

    it("shuts one eye without touching the other", () => {
        const g = make();
        wearMorphs(g, names, wornFace);
        const wink = (v: number) =>
            g.position[v * 3 + 1] + g.morphs[5][v * 3 + 1];
        expect(wink(0)).toBeCloseTo(0, 6);
        expect(wink(2)).toBeCloseTo(0.005, 6);
        // The other eye rests as worn.
        expect(wink(3)).toBeCloseTo(0.005, 4);
    });

    it("lets other expressions lower a lid only by what travel is left", () => {
        const g = make();
        wearMorphs(g, names, wornFace);
        // The lid rests half shut, so the sad lid lowers half as far;
        // what it does across the travel is kept.
        expect(g.morphs[2][1]).toBeCloseTo(-0.002, 6);
        expect(g.morphs[2][2]).toBeCloseTo(0.001, 6);
        // The mouth has nothing to do with it.
        expect(g.morphs[3][4]).toBeCloseTo(-0.006, 6);
    });

    it("wears an expression the file keeps only as its parts", () => {
        // No blink of both eyes here: only each eye's own.
        const parts = ["Fcl_EYE_Close_L", "Fcl_EYE_Close_R"];
        const make2 = () => ({
            position: Float32Array.from([0.04, 0.01, 0, -0.04, 0.01, 0]),
            morphs: [
                Float32Array.from([0, 0, 0, 0, -0.01, 0]),
                Float32Array.from([0, -0.01, 0, 0, 0, 0]),
            ],
        });
        const g = make2();
        wearMorphs(
            g,
            parts,
            { EYE_Close: 0.5 },
            { EYE_Close: ["EYE_Close_L", "EYE_Close_R"] }
        );
        expect(g.position[1]).toBeCloseTo(0.005, 6);
        expect(g.position[4]).toBeCloseTo(0.005, 6);
        // And each eye's own blink still shuts it where it did.
        expect(g.position[4] + g.morphs[0][4]).toBeCloseTo(0, 6);
        // One that is nowhere to be found is an error, not a shrug.
        expect(() => wearMorphs(make2(), parts, { EYE_Wink: 1 })).toThrow(
            /no expression called EYE_Wink/
        );
    });

    it("changes nothing when nothing is worn", () => {
        const g = make();
        wearMorphs(g, names, {});
        expect([...g.position]).toEqual([...make().position]);
        expect([...g.morphs[1]]).toEqual([...make().morphs[1]]);
    });
});

describe("reshaping a face", () => {
    const marks: FaceMarks = {
        eye: [0.045, 1.6, -0.09],
        nose: [0, 1.56, -0.12],
        mouth: [0, 1.53, -0.1],
        chin: [0, 1.5, -0.095],
        jaw: [0.07, 1.52, -0.05],
        ear: [0.1, 1.59, 0.01],
    };

    it("scales about a landmark on both sides of the face alike", () => {
        const warp = faceWarp(
            [
                {
                    name: "big eyes",
                    at: "eye",
                    radius: 0.05,
                    scale: [1.5, 1.5, 1],
                },
            ],
            marks,
            -1
        );
        const left = warp([0.055, 1.6, -0.09]);
        const right = warp([-0.055, 1.6, -0.09]);
        expect(left[0]).toBeGreaterThan(0.058);
        expect(right[0]).toBeCloseTo(-left[0], 6);
        // The landmark itself stays, and so does anything out of reach.
        expect(warp([0.045, 1.6, -0.09])).toEqual([0.045, 1.6, -0.09]);
        expect(warp([0.045, 1.2, -0.09])).toEqual([0.045, 1.2, -0.09]);
    });

    it("moves forwards whichever way the figure faces, and never across the middle", () => {
        const feature = [
            {
                name: "nose",
                at: "nose" as const,
                radius: 0.03,
                move: [0.01, 0, 0.004] as [number, number, number],
            },
        ];
        const moved = faceWarp(feature, marks, -1)([0, 1.56, -0.12]);
        expect(moved.slice(0, 2)).toEqual([0, 1.56]);
        expect(moved[2]).toBeCloseTo(-0.124, 9);
        const facingPlus: FaceMarks = { ...marks, nose: [0, 1.56, 0.12] };
        expect(
            faceWarp(feature, facingPlus, 1)([0, 1.56, 0.12])[2]
        ).toBeCloseTo(0.124, 6);
    });

    it("turns the outer side up", () => {
        const warp = faceWarp(
            [{ name: "tilt", at: "eye", radius: 0.05, turn: 10 }],
            marks,
            -1
        );
        expect(warp([0.06, 1.6, -0.09])[1]).toBeGreaterThan(1.601);
        expect(warp([0.03, 1.6, -0.09])[1]).toBeLessThan(1.599);
        expect(warp([-0.06, 1.6, -0.09])[1]).toBeGreaterThan(1.601);
    });

    it("carries expressions along: lids that met still meet", () => {
        // An upper and a lower lid vertex that a blink brings together.
        const geometry = {
            position: Float32Array.from([
                0.05, 1.608, -0.09, 0.05, 1.592, -0.09,
            ]),
            morphs: [Float32Array.from([0, -0.014, 0, 0, 0.002, 0])],
        };
        const warp = faceWarp(
            [
                {
                    name: "eyes",
                    at: "eye",
                    radius: 0.05,
                    scale: [1.3, 1.4, 1],
                    move: [-0.004, 0.001, 0],
                    turn: 8,
                },
            ],
            marks,
            -1
        );
        warpGeometry(geometry, warp);
        const shut = (v: number, k: number) =>
            geometry.position[v * 3 + k] + geometry.morphs[0][v * 3 + k];
        for (let k = 0; k < 3; k++)
            expect(shut(0, k)).toBeCloseTo(shut(1, k), 6);
        // And the eye did open wider.
        expect(geometry.position[1] - geometry.position[4]).toBeGreaterThan(
            0.02
        );
    });
});

describe("room for a brow's shadow", () => {
    it("widens the strip below the line only, and says where the line is", () => {
        const coords: number[] = [];
        const position = new Float32Array(15 * 3);
        for (let c = 0; c < 5; c++)
            for (let r = 0; r < 3; r++) coords.push(c / 4, r / 2);
        const args = {
            position,
            coords,
            vertices: Array.from({ length: 15 }, (_, i) => i),
            side: 1,
            path: [
                [0.02, 1.61],
                [0.04, 1.61],
                [0.06, 1.61],
            ] as V2[],
            widths: [0.008, 0.008, 0.008],
            eyeLine: 0,
            depth: () => -0.1,
            forwardZ: -1,
        };
        const plain = layBrow(args);
        const top = position[(2 * 3 + 2) * 3 + 1];
        const bottom = position[(2 * 3 + 0) * 3 + 1];
        const roomy = layBrow({ ...args, shadow: 0.006 });
        expect(roomy.height).toBeCloseTo(plain.height + 0.006, 6);
        // The top edge is where it was; the bottom is 6 mm lower.
        expect(position[(2 * 3 + 2) * 3 + 1]).toBeCloseTo(top, 6);
        expect(position[(2 * 3 + 0) * 3 + 1]).toBeCloseTo(bottom - 0.006, 6);
        // The line itself has not moved: it is further up the strip.
        const up = roomy.knots[1].up;
        expect(up).toBeGreaterThan(0.5);
        expect(bottom - 0.006 + up * roomy.height).toBeCloseTo(1.61, 6);
    });
});

describe("laying a brow", () => {
    // A strip of 5 columns and 3 rows, wherever it was before.
    const coords: number[] = [];
    const position = new Float32Array(15 * 3);
    for (let c = 0; c < 5; c++)
        for (let r = 0; r < 3; r++) {
            coords.push(c / 4, r / 2);
            position.set(
                [0.03 + c * 0.01, 1.63 + r * 0.01, -0.1],
                (c * 3 + r) * 3
            );
        }
    const vertices = Array.from({ length: 15 }, (_, i) => i);
    const path: V2[] = [
        [0.02, 1.61],
        [0.04, 1.63],
        [0.06, 1.62],
    ];

    it("measures the strip as the figure has it", () => {
        const size = measureBrow(position, coords, vertices);
        expect(size.length).toBeCloseTo(0.04, 6);
        expect(size.height).toBeCloseTo(0.02, 6);
    });

    it("runs the strip along the path, a column at each of its points", () => {
        const laid = Float32Array.from(position);
        const morph = new Float32Array(15 * 3);
        // An expression that lifts the whole brow 5 mm.
        for (let v = 0; v < 15; v++) morph[v * 3 + 1] = 0.005;
        const line = layBrow({
            position: laid,
            coords,
            vertices,
            side: -1,
            path,
            widths: [0.006, 0.008, 0.002],
            eyeLine: 0,
            // A face that slopes back towards its sides and its top.
            depth: (x, y) => -0.1 + Math.abs(x) * 0.5 + (y - 1.6) * 0.2,
            forwardZ: -1,
            morphs: [morph],
        });
        expect(line.knots.map((k) => k.up)).toEqual([0.5, 0.5, 0.5]);
        expect(line.knots.map((k) => k.along)).toEqual([0.25, 0.5, 0.75]);
        expect(line.knots.map((k) => k.width)).toEqual([0.006, 0.008, 0.002]);
        expect(line.height).toBeCloseTo(0.008 + 0.007, 6);
        // The middle row of each of those columns is on the path, on the
        // strip's own side of the face.
        [1, 2, 3].forEach((column, i) => {
            const v = column * 3 + 1;
            expect(laid[v * 3]).toBeCloseTo(-path[i][0], 6);
            expect(laid[v * 3 + 1]).toBeCloseTo(path[i][1], 6);
        });
        for (let v = 0; v < 15; v++) {
            const skin =
                -0.1 +
                Math.abs(laid[v * 3]) * 0.5 +
                (laid[v * 3 + 1] - 1.6) * 0.2;
            // Just in front of the skin, at rest and with the brow raised.
            expect(laid[v * 3 + 2]).toBeCloseTo(skin - 0.0009, 6);
            expect(laid[v * 3 + 2] + morph[v * 3 + 2]).toBeCloseTo(
                skin + 0.005 * 0.2 - 0.0009,
                6
            );
        }
    });
});
