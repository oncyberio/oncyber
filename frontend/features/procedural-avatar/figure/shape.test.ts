import {
    RIM_POINTS,
    faceWarp,
    layBrow,
    measureBrow,
    openingFrame,
    resample,
    roundOff,
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
