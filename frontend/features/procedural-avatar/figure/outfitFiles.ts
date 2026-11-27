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
    /** What it is made of, for menus. */
    pieces: string[];
}

export const OUTFIT_FILES: Record<string, OutfitFile> = {
    stagehand: {
        id: "stagehand",
        name: "Stagehand",
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

/** The outfit a figure wears unless told otherwise. */
export const DEFAULT_OUTFIT = "stagehand";

/** Where an outfit's file is served from. */
export const outfitUrl = (id: string) => `/models/clothes/${id}.glb`;
