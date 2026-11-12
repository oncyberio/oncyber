/** @jest-environment node */
import {
    MAX_BEND,
    cellCentre,
    decodeStrokes,
    encodeStrokes,
    strokeInstances,
    strokesPerLayer,
    type StrokeSet,
} from "./strokeFormat";

const DEG = Math.PI / 180;

/** Two layers: three rows of a coarse band, then a sparse fine one. */
function sample(): StrokeSet {
    return {
        palette: Uint8Array.from([0, 0, 0, 255, 255, 255, 30, 60, 200]),
        layers: [
            {
                thetaMin: Math.fround(0),
                thetaMax: Math.fround(90 * DEG),
                length: Math.fround(6 * DEG),
                width: Math.fround(2 * DEG),
                rowCells: [3, 5, 6],
            },
            {
                thetaMin: Math.fround(10 * DEG),
                thetaMax: Math.fround(20 * DEG),
                length: Math.fround(2 * DEG),
                width: Math.fround(0.5 * DEG),
                rowCells: [4],
            },
        ],
        // the 14 coarse cells, then fine cells 0 and 3 (bits 14 and 17)
        occupancy: Uint8Array.from([0xff, 0x7f, 0x02]),
        angle: Uint8Array.from([
            0, 10, 60, 32, 7, 7, 7, 50, 3, 4, 5, 6, 63, 1, 16, 48,
        ]),
        shape: Uint8Array.from([
            0x03, 0x70, 0x06, 0x00, 0x73, 0x13, 0x23, 0x33, 0x43, 0x53, 0x63,
            0x73, 0x03, 0x14, 0x25, 0x36,
        ]),
        colour: Uint8Array.from([
            0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2, 2,
        ]),
    };
}

describe("painted sky stroke file", () => {
    test("decodes what it encodes", () => {
        const set = sample();
        const decoded = decodeStrokes(encodeStrokes(set));
        expect(decoded.palette).toEqual(set.palette);
        expect(decoded.layers).toEqual(set.layers);
        expect(decoded.occupancy).toEqual(set.occupancy);
        expect(decoded.angle).toEqual(set.angle);
        expect(decoded.shape).toEqual(set.shape);
        expect(decoded.colour).toEqual(set.colour);
        expect(strokesPerLayer(decoded)).toEqual([14, 2]);
    });

    test("stores angles as deltas, so a smooth flow packs small", () => {
        const set = sample();
        const bytes = encodeStrokes(set);
        const angles = bytes.slice(bytes.length - 48, bytes.length - 32);
        expect(Array.from(angles.slice(0, 4))).toEqual([0, 10, 50, 36]);
    });

    test("refuses other files, other versions and short ones", () => {
        const bytes = encodeStrokes(sample());
        const wrongMagic = bytes.slice();
        wrongMagic[0] = 0x47;
        expect(() => decodeStrokes(wrongMagic)).toThrow(/not one/);
        const wrongVersion = bytes.slice();
        wrongVersion[4] = 99;
        expect(() => decodeStrokes(wrongVersion)).toThrow(/version 99/);
        expect(() => decodeStrokes(bytes.slice(0, bytes.length - 1))).toThrow(
            /truncated/
        );
        expect(() => decodeStrokes(new Uint8Array(3))).toThrow(/too short/);
    });

    test("refuses a colour outside the palette", () => {
        const set = sample();
        set.colour[3] = 9;
        expect(() => decodeStrokes(encodeStrokes(set))).toThrow(/palette/);
    });

    test("places each stroke in its cell, the same way every time", () => {
        const set = sample();
        const layer = set.layers[0];
        const a = cellCentre(layer, 0, 1, 2, { theta: 0, phi: 0 });
        const b = cellCentre(layer, 0, 1, 2, { theta: 0, phi: 0 });
        expect(a).toEqual(b);
        // row 1 of 3 over 0–90°: 30–60°
        expect(a.theta).toBeGreaterThan(30 * DEG);
        expect(a.theta).toBeLessThan(60 * DEG);
    });

    test("builds unit directions and tangents for the GPU", () => {
        const set = sample();
        const all = strokeInstances(set);
        expect(all.count).toBe(16);
        const coarse = strokeInstances(set, 1);
        expect(coarse.count).toBe(14);
        expect(coarse.centre).toEqual(all.centre.slice(0, 14 * 4));
        for (let i = 0; i < all.count; i++) {
            const c = all.centre.slice(i * 4, i * 4 + 3);
            const a = all.axis.slice(i * 4, i * 4 + 3);
            expect(Math.hypot(...c)).toBeCloseTo(1, 5);
            expect(Math.hypot(...a)).toBeCloseTo(1, 5);
            // the tangent lies on the sphere
            expect(c[0] * a[0] + c[1] * a[1] + c[2] * a[2]).toBeCloseTo(0, 5);
            expect(Math.abs(all.colour[i * 4 + 3])).toBeLessThanOrEqual(
                MAX_BEND + 1e-6
            );
        }
        // the coarse layer's length is 6° × the length step's scale
        expect(all.centre[3]).toBeCloseTo(6 * DEG * 0.55, 5);
        // palette colours come out linear
        expect(Array.from(all.colour.slice(4, 7))).toEqual([1, 1, 1]);
    });

    test("puts a stroke where the dome shows its image pixel", () => {
        // a cell at image row theta/π·H, column phi/2π·W: the sharp sphere
        // shows that texel along (-sinθ·cosφ, cosθ, -sinθ·sinφ)
        const set = sample();
        const at = cellCentre(set.layers[0], 0, 0, 0, { theta: 0, phi: 0 });
        const all = strokeInstances(set);
        const [x, y, z] = all.centre.slice(0, 3);
        expect(Math.acos(y)).toBeCloseTo(at.theta, 5);
        const u = (Math.atan2(-z, -x) / (2 * Math.PI) + 1) % 1;
        expect(u).toBeCloseTo((at.phi / (2 * Math.PI)) % 1, 5);
    });
});
