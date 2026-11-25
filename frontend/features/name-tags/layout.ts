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
