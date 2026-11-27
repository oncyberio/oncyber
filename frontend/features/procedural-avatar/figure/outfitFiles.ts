/**
 * The outfits a figure can wear, each one prebuilt file in
 * `public/models/clothes/`, made by `tasks/avatar-figure`'s `clothes`
 * command: every garment cut to the figure's own body, bound to its bones
 * and merged into one mesh, so an outfit is one draw. Kept free of
 * imports, so menus and the catalogue can list outfits without loading
 * anything.
 */
export interface OutfitFile {
    id: string;
    name: string;
    /** The mesh it wears, by file name: outfits may share one. */
    file: string;
    /** What it is made of, for menus. */
    pieces: string[];
    /** Stripes on what is striped (the tie): their colour, how far apart and how wide (a share of the gap). */
    stripes: ClothStripes;
}

export interface ClothStripes {
    colour: string;
    period: number;
    width: number;
}

export const OUTFIT_FILES: Record<string, OutfitFile> = {
    stagehand: {
        id: "stagehand",
        name: "Stagehand",
        file: "stagehand",
        // Fine pinstripes on the tie.
        stripes: { colour: "#e4ebf8", period: 0.0085, width: 0.16 },
        pieces: [
            "shirt",
            "tie",
            "badge",
            "headphones",
            "wide trousers",
            "belt",
            "socks",
            "shoes",
        ],
    },
};
/** The same clothes with a boldly striped tie. */
OUTFIT_FILES["stagehand-wide"] = {
    ...OUTFIT_FILES.stagehand,
    id: "stagehand-wide",
    name: "Stagehand, wide stripes",
    stripes: { colour: "#e9edf6", period: 0.028, width: 0.4 },
};

/** The outfit a figure wears unless told otherwise. */
export const DEFAULT_OUTFIT = "stagehand";

/** Where an outfit's file is served from. */
export const outfitUrl = (id: string) => `/models/clothes/${id}.glb`;

/**
 * What an outfit's vertices say about its cloth: the colour's alpha picks
 * one of these (see `tasks/avatar-figure/clothes`). Plain cloth; cloth
 * with stripes on the slant, worked out per pixel so they stay sharp
 * however few triangles carry them; and polished leather or plastic, with
 * a highlight. Polished sits next to plain, so where the two meet on one
 * piece (a shoe's upper and its welt) the alpha passes only between them.
 */
export const CLOTH_KINDS = {
    plain: 1,
    polished: 0.75,
    striped: 0.5,
    /** Striped the other way: a tie's knot. */
    crossStriped: 0.25,
} as const;
