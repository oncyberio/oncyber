import type { Shape, Vec3 } from "../kernel/sdf";

/** What a layer of a sculpt is made of; the tracer shades each its own way. */
export type SculptMaterial =
    | "skin"
    | "eye"
    | "hair"
    | "cotton"
    | "tie"
    | "wool"
    | "knit"
    | "black"
    | "badge";

/** One surface of a sculpt, with a box that is known to contain it. */
export interface SculptLayer {
    material: SculptMaterial;
    shape: Shape;
    min: Vec3;
    max: Vec3;
}

/** A piece of a lock of hair: a round cone, and which way is "out". */
export interface SculptHairSegment {
    a: Vec3;
    b: Vec3;
    ra: number;
    rb: number;
    /**
     * Unit vectors square to the piece, pointing away from the scalp, at
     * its start and its end: the ribbon twists from one to the other.
     */
    out: Vec3;
    outEnd: Vec3;
    /** Thickness as a fraction of width: 1 is a round tube. */
    flat: number;
    /** Direction of the lock at each end of the piece. */
    ta: Vec3;
    tb: Vec3;
    /** Across the lock, in its flat plane, at each end of the piece. */
    sa: Vec3;
    sb: Vec3;
    /** Which lock the piece belongs to. */
    lock: number;
    /** How softly it joins its neighbours. */
    blend: number;
}

/** The plane an eyelid's edge lies in, through the centre of the eye. */
export interface SculptLid {
    normal: Vec3;
    across: Vec3;
}

/** Where the painted features of the face go (left side; x is mirrored). */
export interface SculptFace {
    eye: Vec3;
    eyeRadius: number;
    lidRadius: number;
    irisRadius: number;
    /** Degrees the eyes look outwards and down. */
    gaze: [number, number];
    upperLid: SculptLid;
    lowerLid: SculptLid;
    brow: {
        /** Points of the brow seen from the front, nose to temple. */
        path: [number, number][];
        /** Thickness at each point. */
        width: number[];
        /** The brow is only painted in front of this depth. */
        frontZ: number;
    };
    mouth: { y: number; z: number; halfWidth: number };
    cheek: Vec3;
    noseTip: Vec3;
    ear: Vec3;
    chinY: number;
}

/**
 * A whole character as distance fields, ready to be traced per pixel or
 * handed to the mesher. Metres, standing on y = 0, facing +z, T-pose.
 */
export interface Sculpt {
    id: string;
    height: number;
    layers: SculptLayer[];
    hair: { cap: Shape; segments: SculptHairSegment[] };
    face: SculptFace;
    badge: { centre: Vec3; half: [number, number] };
    buckle: { centre: Vec3; half: [number, number] };
    palette: Record<
        | "skin"
        | "skinShade"
        | "blush"
        | "lip"
        | "lipLine"
        | "brow"
        | "lash"
        | "iris"
        | "irisLight"
        | "white"
        | "hair"
        | "hairSheen"
        | "cotton"
        | "cottonShade"
        | "tie"
        | "tieStripe"
        | "wool"
        | "woolShade"
        | "black"
        | "knit"
        | "metal"
        | "card"
        | "cardInk",
        string
    >;
}
