/**
 * What a figure file holds, shared by the tool that builds one and the
 * code that draws it. Kept free of imports so the builder (plain Node) can
 * load it as is.
 *
 * A figure is a ready-made humanoid that characters are made from: a
 * skeleton, bare skin, and a face with its expressions. It carries no
 * images. What a texture would have held is either stored on the vertices
 * (what each triangle is, how open it is to the light, how sharply the
 * surface turns there, how thin the flesh is) or drawn by the shader from
 * the character's style, so one small file serves every character and
 * stays sharp at any distance.
 *
 * The file is an ordinary VRM 0.x model, so anything that plays a VRM can
 * pose it and drive its expressions. It has three primitives:
 *
 * - the body's skin;
 * - the face: its skin, the whites of the eyes and the inside of the mouth;
 * - the face's ink: flat pieces lying just off the face that the irises,
 *   lid lines, lashes and brows are drawn on, blended over what is behind.
 */

export const FIGURE_FORMAT = 3;

/** What a triangle is. A primitive holds several, told apart by this. */
export const FIGURE_PARTS = [
    "skin",
    "teeth",
    "tongue",
    "mouth",
    "eyeWhite",
    "iris",
    "lidLine",
    "lash",
    "brow",
] as const;

export type FigurePart = (typeof FIGURE_PARTS)[number];

export const partId = (part: FigurePart): number => FIGURE_PARTS.indexOf(part);

/** The primitives' material names, which is how a loader finds them. */
export const FIGURE_MATERIALS = {
    body: "Figure_Body",
    face: "Figure_Face",
    ink: "Figure_Ink",
} as const;

/**
 * What the skin knows about itself: four bytes a vertex, read as 0–1.
 *
 * - `open`: 1 in the open, 0 buried in a crease (ambient occlusion).
 * - `sky`: how much of the light from above and in front reaches it: 0
 *   under the chin, the nose, the brow.
 * - `round`: how the surface turns, 0.5 where it is flat, more where it
 *   bulges (a nose, a knuckle) and less in a hollow.
 * - `thin`: 1 where there is hardly any flesh behind (an ear, a finger).
 *
 * The body and the face have it; the ink does not need it.
 */
export const BAKE_ATTRIBUTE = "_BAKE";

/**
 * Which part a vertex belongs to: four bytes, the first the part's index
 * over 255, the rest spare. The body has none: it is all skin.
 */
export const PART_ATTRIBUTE = "_PART";

/** Where the light the `sky` channel measures comes from: [up, forward]. */
export const SKY_DIRECTION: [number, number] = [0.94, 0.34];

/** Curvature that fills the `round` channel, per metre. */
export const ROUND_RANGE = 160;
/** Depth of flesh that empties the `thin` channel, metres. */
export const THIN_RANGE = 0.035;

const unit = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Curvature (per metre, bulges positive) to the `round` channel. */
export const encodeRound = (curvature: number) =>
    unit(0.5 + curvature / (2 * ROUND_RANGE));
export const decodeRound = (stored: number) => (stored - 0.5) * 2 * ROUND_RANGE;

/** Depth of flesh (metres) to the `thin` channel. */
export const encodeThin = (depth: number) => unit(1 - depth / THIN_RANGE);
export const decodeThin = (stored: number) => (1 - stored) * THIN_RANGE;

/**
 * Expressions that base models store whole although they are sums of
 * others: a blink is the left eye's and the right's, an angry face is
 * angry brows, eyes and mouth. Where a model's own numbers bear that out
 * exactly, a figure file leaves the whole out and keeps its parts; the
 * file says which (`composites`), and anything that asks for a whole by
 * name is given the sum.
 */
export const FIGURE_COMPOSITES: Record<string, string[]> = {
    ALL_Neutral: ["MTH_Natural"],
    ALL_Fun: ["BRW_Fun", "EYE_Fun", "MTH_Fun"],
    ALL_Sorrow: ["BRW_Sorrow", "EYE_Sorrow", "MTH_Sorrow"],
    ALL_Angry: ["BRW_Angry", "EYE_Angry", "MTH_Angry"],
    ALL_Joy: ["BRW_Joy", "EYE_Joy", "MTH_Joy"],
    ALL_Surprised: ["BRW_Surprised", "EYE_Surprised", "MTH_Surprised"],
    EYE_Close: ["EYE_Close_L", "EYE_Close_R"],
    EYE_Joy: ["EYE_Joy_L", "EYE_Joy_R"],
    MTH_SkinFung: ["MTH_SkinFung_L", "MTH_SkinFung_R"],
    HA_Fung1: ["HA_Fung1_Up", "HA_Fung1_Low"],
    HA_Fung2: ["HA_Fung2_Up", "HA_Fung2_Low"],
    HA_Fung3: ["HA_Fung3_Up", "HA_Fung3_Low"],
    HA_Short: ["HA_Short_Up", "HA_Short_Low"],
};

/** A morph's name as models give it, without what comes before it. */
export const morphName = (full: string) => full.replace(/^.*Fcl_/, "");

/** A ring of vertices round an opening in the face's skin. */
export interface FigureRim {
    /**
     * Vertices of the face primitive, in order round the opening: from
     * one corner along the upper edge to the other corner, then back
     * along the lower edge.
     */
    loop: number[];
    /** Where in `loop` the far corner is. */
    turn: number;
}

/** An ear: its vertices, and those of them that join it to the head. */
export interface FigureEar {
    all: number[];
    root: number[];
}

/**
 * Places on the face, as vertices of the face primitive, so that they
 * can still be found after a character has reshaped it.
 */
export interface FigureLandmarks {
    /** Each eye's opening, from its inner corner. Left is the figure's. */
    eyes: { left: FigureRim; right: FigureRim };
    /** The mouth, from the corner on the figure's right. */
    mouth: FigureRim;
    ears: { left: FigureEar; right: FigureEar };
}

/** Stored with the scene (`extras.figure`): what the file is. */
export interface FigureInfo {
    format: number;
    /** The model it was built from, as that model describes itself. */
    source: { title: string; author: string; license: string };
    landmarks: FigureLandmarks;
    /** Triangles in each primitive. */
    triangles: { body: number; face: number; ink: number };
    /**
     * Expressions left out of the file because they are exactly the sum
     * of others it holds: each by name, with the names of its parts.
     */
    composites: Record<string, string[]>;
}
