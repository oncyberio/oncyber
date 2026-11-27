/**
 * How to turn a VRoid base model into a character: the base keeps its
 * triangles, its skeleton and its face morphs, and is reshaped and
 * recoloured by these numbers. A new character is a new recipe.
 */
export interface VroidRecipe {
    id: string;
    name: string;
    /**
     * Scale of each bone's own segment, by VRM bone name or node name:
     * [across the body, up, front to back]. A limb bone's "up" is its
     * thickness too; its length is whichever axis it lies along. Children
     * move with their parent's scale, so the whole figure stays joined.
     */
    bones: Record<string, [number, number, number]>;
    face: {
        /** Height of the skull above the eye line, and of the face below. */
        above: number;
        below: number;
        /** Width of the jaw at the chin, relative to the base. */
        jaw: number;
        /** Width of the whole face. */
        width: number;
    };
    /**
     * The chest: 1 pulls the front of the ribcage back to the profile of
     * the breastbone, 0 leaves the base's bust. `curve` is how quickly
     * that profile falls away to the sides (per metre, squared).
     */
    chest: { flatten: number; curve: number };
    /**
     * Local changes to the face, applied in order. Each is a soft-edged
     * region round a landmark found on the base itself, so a recipe does
     * not depend on which base it is applied to.
     */
    features: FaceFeature[];
    /**
     * The brows, drawn rather than inherited: points from the nose to the
     * temple, each [across from the middle of the face, up from the eye
     * line] in metres, and the thickness at each.
     */
    brow: { path: [number, number][]; width: number[] };
    /** Face morphs (VRoid's `Fcl_*` names) baked in as the resting face. */
    morphs: Record<string, number>;
    palette: {
        skin: string;
        skinShade: string;
        iris: string;
        brow: string;
        lash: string;
        hair: string;
        underwear: string;
    };
}

/** A place on the face every VRoid base has. */
export type FaceLandmark = "eye" | "nose" | "mouth" | "chin" | "jaw" | "ear";

export interface FaceFeature {
    /** What it is for; not used by the code. */
    name: string;
    at: FaceLandmark;
    /** Moved from the landmark: [outwards, up, forwards], metres. */
    offset?: [number, number, number];
    /** How far the change reaches; it fades to nothing at this distance. */
    radius: number;
    /** Scale about that point: [across, up, front to back]. */
    scale?: [number, number, number];
    /** Shift: [outwards, up, forwards], metres. */
    move?: [number, number, number];
    /**
     * Which parts of the face it acts on, by material name; all of them
     * if left out. Leaving the iris out of a change to the eye keeps it
     * round behind lids that have moved.
     */
    parts?: RegExp;
}

/** VRoid's base skin tone, which the recipe's skin replaces. */
export const VROID_SKIN = "#f9e8da";

export const STAGEHAND_RECIPE: VroidRecipe = {
    id: "stagehand",
    name: "Stagehand",
    bones: {
        // Longer legs, a longer and squarer torso, wide shoulders.
        hips: [0.9, 1, 0.96],
        leftUpperLeg: [1.03, 1.21, 1.06],
        rightUpperLeg: [1.03, 1.21, 1.06],
        leftLowerLeg: [1.1, 1.06, 1.1],
        rightLowerLeg: [1.1, 1.06, 1.1],
        leftFoot: [1.12, 1, 1.12],
        rightFoot: [1.12, 1, 1.12],
        spine: [1.24, 1.14, 1.14],
        chest: [1.18, 1.12, 1.08],
        upperChest: [1.14, 1.14, 1.04],
        leftShoulder: [1.5, 1, 1],
        rightShoulder: [1.5, 1, 1],
        leftUpperArm: [1.16, 1.12, 1.12],
        rightUpperArm: [1.16, 1.12, 1.12],
        leftLowerArm: [1.13, 1.1, 1.1],
        rightLowerArm: [1.13, 1.1, 1.1],
        leftHand: [1.1, 1.1, 1.1],
        rightHand: [1.1, 1.1, 1.1],
        neck: [1.18, 1.5, 1.18],
        head: [0.97, 0.97, 0.97],
    },
    face: { above: 0.82, below: 1.26, jaw: 1.08, width: 0.97 },
    features: [
        {
            // Narrow eyes: the lids close in on an iris that stays round.
            name: "narrow eyes",
            at: "eye",
            radius: 0.034,
            scale: [0.96, 0.7, 1],
            parts: /Face_00_SKIN|Eyeline|Eyelash|EyeWhite/,
        },
        {
            name: "outer corners up",
            at: "eye",
            offset: [0.016, 0, 0],
            radius: 0.02,
            move: [0, 0.0035, 0],
            parts: /Face_00_SKIN|Eyeline|Eyelash|EyeWhite/,
        },
        {
            // A real nose: longer, and standing further off the face.
            name: "nose",
            at: "nose",
            offset: [0, 0.004, -0.004],
            radius: 0.03,
            scale: [1.15, 1.2, 1],
            move: [0, -0.004, 0.006],
        },
        {
            name: "square jaw",
            at: "jaw",
            radius: 0.045,
            scale: [1.08, 1, 1.03],
            move: [0.002, -0.002, 0],
        },
        {
            name: "broad chin",
            at: "chin",
            radius: 0.03,
            scale: [1.22, 0.92, 1],
        },
        {
            name: "ears stand out",
            at: "ear",
            radius: 0.04,
            scale: [1.5, 1.08, 1.1],
        },
    ],
    brow: {
        path: [
            [0.0128, 0.006],
            [0.036, 0.0145],
            [0.053, 0.0226],
            [0.063, 0.0208],
        ],
        width: [0.0088, 0.008, 0.006, 0.0014],
    },
    chest: { flatten: 1, curve: 2.4 },
    morphs: {
        Fcl_BRW_Angry: 1,
        Fcl_EYE_Angry: 0.85,
        Fcl_EYE_Close: 0.22,
        Fcl_MTH_Angry: 0.7,
    },
    palette: {
        skin: "#d58d70",
        skinShade: "#a45c49",
        iris: "#3a241c",
        brow: "#17110f",
        lash: "#120d0c",
        hair: "#231c1f",
        underwear: "#3d4a66",
    },
};
