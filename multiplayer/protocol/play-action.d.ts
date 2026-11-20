/** A position in the person's own space, in metres: x to their right, y up from the floor, z the way they face. */
export type ActionPoint = [number, number, number];
export type ActionEase = "in-out" | "in" | "out" | "linear";

/** One moment of an action: where some parts of the body should be by then. Parts left out carry on to their next mention. */
export interface PlayMoment {
    /** When, as a share of the action from 0 to 1. */
    at: number;
    /** How the body arrives here from the moment before. */
    ease: ActionEase;
    /** "target" sends the hand to the thing being hit, wherever it is. */
    rightHand?: ActionPoint | "target";
    leftHand?: ActionPoint | "target";
    rightFoot?: ActionPoint;
    leftFoot?: ActionPoint;
    hips?: ActionPoint;
    /** Forward bend of the torso, in degrees. */
    lean?: number;
    /** Turn of the torso to the person's left, in degrees. */
    twist?: number;
}

/** How a person moves for a moment. Data, never code. */
export interface PlayAction {
    name: string;
    seconds: number;
    /** The instant a hit lands, as a share of the action, or null when nothing is hit. */
    contact: number | null;
    moments: PlayMoment[];
}

export const ACTION_PARTS: readonly ["rightHand", "leftHand", "rightFoot", "leftFoot", "hips", "lean", "twist"];
export const ACTION_REST: Readonly<{
    rightHand: Readonly<ActionPoint>;
    leftHand: Readonly<ActionPoint>;
    rightFoot: Readonly<ActionPoint>;
    leftFoot: Readonly<ActionPoint>;
    hips: Readonly<ActionPoint>;
    lean: number;
    twist: number;
}>;
export const ACTION_LIMITS: Readonly<{
    seconds: readonly [number, number];
    moments: number;
    hand: readonly (readonly [number, number])[];
    foot: readonly (readonly [number, number])[];
    hips: readonly (readonly [number, number])[];
    lean: readonly [number, number];
    twist: readonly [number, number];
}>;

export function readPlayAction(value: unknown): PlayAction | null;
