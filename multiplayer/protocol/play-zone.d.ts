/** Budgets every recipe is clamped to. */
export const PLAY_LIMITS: Readonly<{
    bodies: number;
    people: number;
    seconds: readonly [number, number];
    half: readonly [number, number];
    size: readonly [number, number];
    gravity: readonly [number, number];
    frameBodies: number;
}>;

export type PlayThingKind = "ball" | "box";
/** Where things start: spread over the whole arena, in a column over the middle, or split between the two sides. */
export type PlayDrop = "rain" | "center" | "sides";
/**
 * How a game keeps score. `side-count`: the side holding fewer things is
 * ahead. `floor-touch`: a thing landing on your side's floor is a point for
 * the other side, as in volleyball.
 */
export type PlayScore = "none" | "side-count" | "floor-touch";

export interface PlayThing {
    kind: PlayThingKind;
    count: number;
    /** Radius of a ball, half the edge of a box, in metres. */
    size: number;
    bounce: number;
    /** Density; water is 1. */
    weight: number;
    drop: PlayDrop;
    /** Index into the client's palette of eight colours. */
    color: number;
}

/** One game, described from a fixed set of parts. Never code. */
export interface PlayRecipe {
    title: string;
    seconds: number;
    /** Downward, in metres a second squared. */
    gravity: number;
    arena: {
        halfX: number;
        halfZ: number;
        walls: boolean;
        /** Height of a net across the middle, or 0 for none. Side A is x < 0. */
        net: number;
    };
    things: PlayThing[];
    /** Lets a person hit the things in front of them. */
    hit: { reach: number; power: number; lift: number } | null;
    score: PlayScore;
}

export interface PlayBody {
    kind: PlayThingKind;
    size: number;
    color: number;
}
export interface PlayPerson {
    id: number;
    x: number;
    y: number;
    z: number;
    yaw: number;
}

export function readPlayRecipe(value: unknown): PlayRecipe | null;
export function playBodies(recipe: PlayRecipe): PlayBody[];
export function encodeBodies(tick: number, indices: ArrayLike<number>, poses: ArrayLike<number>, perFrame?: number): Uint8Array[];
export function decodeBodies(bytes: Uint8Array, poses: Float32Array | Float64Array | number[]): { tick: number; indices: number[] } | null;
export function encodePeople(tick: number, people: PlayPerson[]): Uint8Array;
export function decodePeople(bytes: Uint8Array): { tick: number; people: PlayPerson[] } | null;
