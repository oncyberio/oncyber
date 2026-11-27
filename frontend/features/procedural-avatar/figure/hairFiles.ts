/**
 * The hair a figure can wear, each a small prebuilt file in
 * `public/models/hair/`, made by `tasks/avatar-figure`'s `hair` command
 * from another model's hair: set on the figure's head, cut down to a few
 * thousand triangles, with no images.
 *
 * A cut is made once, on the figure, and shared: every figure of that
 * shape wearing it wears the same mesh, riding the head bone. Its colours
 * are light and shade only; the colour is given when it is worn, so one
 * file serves every hair colour. Kept free of imports, so menus and the
 * build can list cuts without loading anything.
 */
export interface HairFile {
    id: string;
    name: string;
    /** The model file it is taken from, by name (see LICENSE.md there). */
    model: string;
    /** At most this many triangles once cut down. */
    triangles: number;
}

export const HAIR_FILES: Record<string, HairFile> = {
    sakurada: {
        id: "sakurada",
        name: "Sakurada",
        model: "Sakurada Fumiriya.vrm",
        triangles: 6000,
    },
    bob: {
        id: "bob",
        name: "Bob",
        model: "AvatarSample_A.vrm",
        triangles: 5000,
    },
    short: {
        id: "short",
        name: "Short",
        model: "AvatarSample_C.vrm",
        triangles: 5000,
    },
};

/** The cut a figure wears unless told otherwise. */
export const DEFAULT_HAIR = "sakurada";

/** Where a cut's file is served from. */
export const hairUrl = (id: string) => `/models/hair/${id}.glb`;
