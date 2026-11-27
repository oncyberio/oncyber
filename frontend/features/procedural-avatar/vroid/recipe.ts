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
    /** The brows: how much thicker than the base's, and raised by how much. */
    brow: { thickness: number; lift: number };
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
        // A flat chest.
        J_Sec_L_Bust1: [0.9, 0.6, 0.04],
        J_Sec_R_Bust1: [0.9, 0.6, 0.04],
        J_Sec_L_Bust2: [0.9, 0.6, 0.04],
        J_Sec_R_Bust2: [0.9, 0.6, 0.04],
    },
    face: { above: 0.82, below: 1.26, jaw: 1.08, width: 0.97 },
    brow: { thickness: 3.2, lift: -0.003 },
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
