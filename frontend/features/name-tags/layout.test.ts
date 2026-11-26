import { lobbyTokens } from "@styles/tokens/lobby";
import {
    KIND_CHIP,
    KIND_GLYPH,
    KIND_PHOTO,
    chipSize,
    drawnDepth,
    emMetres,
    fitName,
    layoutTag,
    needsShaping,
    tagName,
} from "./layout";
import { coverageToSdf } from "./sdf";

const T = lobbyTokens.nameTag;
const glyph = {
    u: 0,
    v: 0,
    du: 0.1,
    dv: 0.1,
    left: -0.1,
    top: 0.8,
    width: 0.6,
    height: 1,
};

test("guest names read Anon and blanks read Guest", () => {
    expect(tagName("Anon-1234")).toBe("Anon");
    expect(tagName("  ")).toBe("Guest");
    expect(tagName("rayan")).toBe("rayan");
});

test("a long name ends in an ellipsis that fits", () => {
    const measure = (text: string) => text.length * 0.5;
    const fitted = fitName(Array.from("a".repeat(40)), measure, 5);
    expect(fitted.endsWith("…")).toBe(true);
    expect(measure(fitted)).toBeLessThanOrEqual(5);
    expect(fitName(Array.from("short"), measure, 5)).toBe("short");
});

test("the chip holds the picture, then the name, centred on the head", () => {
    const text = { glyphs: [{ glyph, x: 0 }], width: 2 };
    const photo = { u: 0.5, v: 0.5, du: 0.125, dv: 0.125 };
    const quads = layoutTag(text, 0.7, photo);
    expect(quads.map((q) => q.kind)).toEqual([
        KIND_CHIP,
        KIND_PHOTO,
        KIND_GLYPH,
    ]);
    const { width } = chipSize(2, true);
    expect(quads[0].r0).toBeCloseTo(width);
    expect(quads[0].x).toBe(0);
    // Picture inside the left end, name to its right.
    expect(quads[1].x).toBeLessThan(quads[2].x);
    expect(quads[1].x - T.photoEm / 2).toBeGreaterThan(-width / 2);
    expect(quads[1].r0).toBe(0.5);
});

test("a name alone gets even padding", () => {
    const quads = layoutTag({ glyphs: [], width: 2 }, 0.7, null);
    expect(quads).toHaveLength(1);
    expect(quads[0].r0).toBeCloseTo(chipSize(2, false).width);
});

test("tags keep a readable size on screen and their world size in VR", () => {
    // 540 px per unit: half of a 1080 px viewport at a 90 degree field.
    const far = emMetres(60, 540);
    expect(far * (540 / 60)).toBeCloseTo(T.minPx);
    const near = emMetres(0.5, 540);
    expect(near * (540 / 0.5)).toBeCloseTo(T.maxPx);
    expect(emMetres(5, 0)).toBe(T.fontMetres);
});

test("the distance field is 128 on the outline, high inside, low outside", () => {
    const size = 16;
    const alpha = new Uint8Array(size * size);
    for (let y = 4; y < 12; y++)
        for (let x = 4; x < 12; x++) alpha[y * size + x] = 255;
    const field = coverageToSdf(alpha, size, size, 4);
    expect(field[8 * size + 8]).toBeGreaterThan(200);
    expect(field[0]).toBe(0);
    // Just inside and just outside the left edge straddle the cut.
    expect(field[8 * size + 4]).toBeGreaterThan(128);
    expect(field[8 * size + 3]).toBeLessThan(128);
});

describe("needsShaping", () => {
    it("sends joining, reordering and combining text to the shaped path", () => {
        for (const name of [
            "ريان",
            "שלום",
            "ܫܠܡܐ",
            "नमस्ते",
            "สวัสดี",
            "ᠮᠣᠩᠭᠣᠯ",
            "élodie",
            "👩‍🎨",
        ])
            expect(needsShaping(name)).toBe(true);
    });
    it("keeps the cached glyph path for plain names", () => {
        for (const name of [
            "rayan",
            "ÉLODIE",
            "kō",
            "Mfer #4212",
            "0x8f3…a91c",
            "日本",
        ])
            expect(needsShaping(name)).toBe(false);
    });
});

describe("drawnDepth", () => {
    it("pulls an off-axis tag closer by less than the bias", () => {
        // 0.36 m ahead and 0.33 m to the side: about 0.139 m once drawn.
        const range = Math.hypot(0.36, 0.33);
        expect(drawnDepth(0.36, range, 0.3)).toBeCloseTo(0.1386, 3);
        // On the axis the whole bias applies.
        expect(drawnDepth(2, 2, 0.3)).toBeCloseTo(1.7, 6);
        expect(drawnDepth(0.2, 0.2, 0.3)).toBe(0.05);
    });
    it("keeps an off-axis tag inside the screen size limits", () => {
        const ppu = 800;
        const depth = 0.36;
        const drawn = drawnDepth(depth, Math.hypot(depth, 0.33), 0.3);
        const px = (emMetres(drawn, ppu) * ppu) / drawn;
        expect(px).toBeGreaterThanOrEqual(T.minPx - 1e-6);
        expect(px).toBeLessThanOrEqual(T.maxPx + 1e-6);
    });
});
