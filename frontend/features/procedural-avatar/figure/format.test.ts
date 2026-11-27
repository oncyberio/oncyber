import {
    FIGURE_PARTS,
    ROUND_RANGE,
    THIN_RANGE,
    decodeRound,
    decodeThin,
    encodeRound,
    encodeThin,
    partId,
} from "./format";

describe("what a figure file stores on its vertices", () => {
    it("numbers its parts in an order files depend on", () => {
        // A file holds these numbers: adding a part goes at the end.
        expect(FIGURE_PARTS.slice(0, 9)).toEqual([
            "skin",
            "teeth",
            "tongue",
            "mouth",
            "eyeWhite",
            "iris",
            "lidLine",
            "lash",
            "brow",
        ]);
        expect(partId("skin")).toBe(0);
        expect(partId("brow")).toBe(8);
    });

    it("keeps curvature through a byte, flat in the middle", () => {
        expect(encodeRound(0)).toBe(0.5);
        for (const curvature of [-120, -30, 0, 45, 150]) {
            const stored = Math.round(encodeRound(curvature) * 255) / 255;
            expect(decodeRound(stored)).toBeGreaterThan(curvature - 1.5);
            expect(decodeRound(stored)).toBeLessThan(curvature + 1.5);
        }
        expect(encodeRound(ROUND_RANGE * 3)).toBe(1);
        expect(encodeRound(-ROUND_RANGE * 3)).toBe(0);
    });

    it("stores thin flesh as 1 and anything deep as 0", () => {
        expect(encodeThin(0)).toBe(1);
        expect(encodeThin(THIN_RANGE)).toBe(0);
        expect(encodeThin(1)).toBe(0);
        expect(decodeThin(encodeThin(0.01))).toBeCloseTo(0.01, 9);
    });
});
