import { lobbyTokens } from "@styles/tokens/lobby";

/**
 * Where each piece of a name tag goes, in ems of its font size with the
 * origin at the tag's centre and y up: the chip behind, the picture on its
 * left, then one quad per glyph. Pure, so it is tested without a GPU.
 */

const T = lobbyTokens.nameTag;
/** Picture inset from the chip's edge. */
export const PHOTO_INSET_EM = 0.16;
/** Text inset from the chip's ends. */
export const PAD_EM = 0.72;
/** Room around the chip for its soft shadow. */
export const SHADOW_EM = 0.4;

export const KIND_CHIP = 0;
export const KIND_GLYPH = 1;
export const KIND_PHOTO = 2;

export type Glyph = {
    /** Atlas rectangle: u, v of its top left, then width and height. */
    u: number;
    v: number;
    du: number;
    dv: number;
    /** Box from the pen position on the baseline, in ems, y up. */
    left: number;
    top: number;
    width: number;
    height: number;
};

export type PlacedGlyph = { glyph: Glyph; x: number };

export type TagText = {
    glyphs: PlacedGlyph[];
    /** Advance width, in ems. */
    width: number;
};

export type Quad = {
    kind: number;
    x: number;
    y: number;
    w: number;
    h: number;
    /** Atlas rectangle, or for the chip its own width, height and margin. */
    r0: number;
    r1: number;
    r2: number;
    r3: number;
};

/** How a name reads on its tag: guests' generated names read "Anon". */
export function tagName(name: string) {
    const trimmed = (name || "").trim() || "Guest";
    return trimmed.startsWith("Anon-") ? "Anon" : trimmed;
}

/**
 * The longest start of `chars` that fits `maxEm`, with an ellipsis when
 * shortened. `measure` gives the advance width of a string in ems.
 */
export function fitName(
    chars: readonly string[],
    measure: (text: string) => number,
    maxEm: number = T.maxNameEm
) {
    const whole = chars.join("");
    if (measure(whole) <= maxEm) return whole;
    let low = 0;
    let high = chars.length;
    while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        if (measure(`${chars.slice(0, mid).join("").trimEnd()}…`) <= maxEm)
            low = mid;
        else high = mid - 1;
    }
    return `${chars.slice(0, low).join("").trimEnd()}…`;
}

/**
 * Scripts whose letters join, reorder or stack (Arabic, Hebrew, Syriac,
 * N'Ko, Indic, Southeast Asian, Tibetan, Mongolian, ...), combining marks
 * and joined emoji: a name with any is drawn as one shaped run, not letter
 * by letter.
 */
const SHAPED =
    /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}\p{Script=Mandaic}\p{Script=Samaritan}\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Gurmukhi}\p{Script=Gujarati}\p{Script=Oriya}\p{Script=Tamil}\p{Script=Telugu}\p{Script=Kannada}\p{Script=Malayalam}\p{Script=Sinhala}\p{Script=Thai}\p{Script=Lao}\p{Script=Tibetan}\p{Script=Myanmar}\p{Script=Khmer}\p{Script=Mongolian}\p{Script=Javanese}\p{Script=Balinese}\p{M}\u200c\u200d]/u;

export function needsShaping(name: string) {
    return SHAPED.test(name);
}

export function chipSize(textWidth: number, photo: boolean) {
    const height = T.photoEm + 2 * PHOTO_INSET_EM;
    const width = photo
        ? PHOTO_INSET_EM + T.photoEm + T.gapEm + textWidth + PAD_EM
        : PAD_EM + textWidth + PAD_EM;
    return { width, height };
}

/**
 * The quads of one tag, back to front. `photo` is the picture's atlas
 * rectangle, or null for a name alone.
 */
export function layoutTag(
    text: TagText,
    capHeight: number,
    photo: { u: number; v: number; du: number; dv: number } | null
): Quad[] {
    const { width, height } = chipSize(text.width, !!photo);
    const quads: Quad[] = [
        {
            kind: KIND_CHIP,
            x: 0,
            y: 0,
            w: width + 2 * SHADOW_EM,
            h: height + 2 * SHADOW_EM,
            r0: width,
            r1: height,
            r2: SHADOW_EM,
            r3: 0,
        },
    ];
    let pen = -width / 2;
    if (photo) {
        quads.push({
            kind: KIND_PHOTO,
            x: pen + PHOTO_INSET_EM + T.photoEm / 2,
            y: 0,
            w: T.photoEm,
            h: T.photoEm,
            r0: photo.u,
            r1: photo.v,
            r2: photo.du,
            r3: photo.dv,
        });
        pen += PHOTO_INSET_EM + T.photoEm + T.gapEm;
    } else pen += PAD_EM;
    // Capitals sit centred in the chip.
    const baseline = -capHeight / 2;
    for (const { glyph, x } of text.glyphs) {
        if (glyph.width <= 0 || glyph.height <= 0) continue;
        quads.push({
            kind: KIND_GLYPH,
            x: pen + x + glyph.left + glyph.width / 2,
            y: baseline + glyph.top - glyph.height / 2,
            w: glyph.width,
            h: glyph.height,
            r0: glyph.u,
            r1: glyph.v,
            r2: glyph.du,
            r3: glyph.dv,
        });
    }
    return quads;
}

/**
 * View depth of a tag drawn `bias` metres toward the camera from a point
 * `depth` in front of it and `range` away: off the view axis the pull
 * shortens the depth by less than `bias`.
 */
export function drawnDepth(depth: number, range: number, bias: number) {
    return Math.max(depth * (1 - bias / Math.max(range, 1e-3)), 0.05);
}

/**
 * Metres per em for a tag `depth` metres in front of the camera: its world
 * size, kept between the screen sizes the tokens allow so far tags stay
 * readable and near ones don't fill the view. `pixelsPerUnit` is half the
 * viewport height times the projection's vertical scale; 0 keeps the world
 * size (VR, where there is no single screen).
 */
export function emMetres(depth: number, pixelsPerUnit: number) {
    if (!(pixelsPerUnit > 0) || !(depth > 0)) return T.fontMetres;
    const pxPerMetre = pixelsPerUnit / depth;
    const px = T.fontMetres * pxPerMetre;
    const clamped = Math.min(T.maxPx, Math.max(T.minPx, px));
    return clamped / pxPerMetre;
}
