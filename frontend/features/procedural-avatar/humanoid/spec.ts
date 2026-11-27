import type { Shape, Vec3 } from "../kernel/sdf";
import type { Build } from "../parts/skinField";
import type { Proportions, Rig } from "../rig";
import type {
    Sculpt,
    SculptFace,
    SculptHairSegment,
    SculptLayer,
} from "../sculpts/types";

/**
 * A toon humanoid, described: a body by its measurements, with a head,
 * hair and an outfit of its own. `buildHumanoid` turns one into a sculpt,
 * which is then traced or cut into meshes.
 *
 * The body is plain data: change the numbers and a different figure comes
 * out, standing in a T-pose on y = 0 and facing +z, complete under its
 * clothes. The head, the hair and the outfit are still builders written for
 * each character; their numbers are to move into this description too.
 */
export interface HumanoidSpec {
    id: string;
    name: string;
    /** Top of the hair, metres. */
    height: number;
    /** Where the joints are, in the T-pose. */
    proportions: Proportions;
    /** Girths of the torso and limbs. */
    build: Build;
    /** What the figure wears with nothing else on. */
    underwear: {
        /** Heights of the waistband and of the hem of the legs. */
        waist: number;
        hem: number;
    };
    palette: Sculpt["palette"];
    head(): HumanoidHead;
    hair(): HumanoidHair;
    outfit(rig: Rig): HumanoidOutfit;
}

export interface HumanoidHead {
    /** The whole head, placed on the body's neck. */
    shape: Shape;
    /** The eyes, a layer of their own. */
    eye: SculptLayer;
    /** Where the painted features go. */
    face: SculptFace;
}

export interface HumanoidHair {
    layer: SculptLayer;
    cap: Shape;
    segments: SculptHairSegment[];
}

export interface HumanoidOutfit {
    layers: SculptLayer[];
    /**
     * What of the body still shows when dressed: the rest is left out, as
     * nothing of it could be seen.
     */
    uncovered: Shape;
    badge: { centre: Vec3; half: [number, number] };
    buckle: { centre: Vec3; half: [number, number] };
}

export interface BuildOptions {
    /** False for the figure in its underwear. Default true. */
    dressed?: boolean;
}
