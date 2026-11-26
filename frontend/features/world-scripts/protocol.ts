/**
 * tokens-ok-file: the colours here are what scripts draw 3D things with
 * (named colours, defaults), not interface colours.
 *
 * What a world script may ask the host to do, and the checks every request
 * passes before it touches the scene. The script runs in an opaque sandbox
 * (see sandboxDocument.ts); nothing it sends is trusted. Every value is
 * clamped or dropped here, so the engine adapter only ever sees clean,
 * bounded data.
 */

import {
    WORLD_SCRIPT_LIMITS,
    THING_LOOKS,
    cleanColor,
    cleanText,
    byteLength,
    type ThingLook,
} from "./basics";
import { cleanShader } from "./shaderGraph";
import {
    cleanLamp,
    cleanParts,
    type ModelLamp,
    type PartCommand,
} from "./parts";

export {
    WORLD_SCRIPT_LIMITS,
    THING_LOOKS,
    cleanColor,
    cleanText,
    byteLength,
    type ThingLook,
};

export const THING_SHAPES = [
    "box",
    "sphere",
    "cylinder",
    "cone",
    "torus",
    "plane",
    "ring",
    "capsule",
    "star",
    "lathe",
    "extrude",
    "text",
    // An object built from flat shapes, boxes, beams and columns, drawn
    // the way the world's style says (parts.ts).
    "model",
    // Nothing to see: boxes and walls a visitor cannot walk through.
    "solid",
    // A box-shaped hole in the world's own model, for as long as it exists.
    "opening",
    // One of Oncyber's avatars, standing in the world.
    "avatar",
] as const;
export type ThingShape = (typeof THING_SHAPES)[number];

/** Shapes a script may have only a few of (WORLD_SCRIPT_LIMITS). */
export const SCARCE_SHAPES: Partial<Record<ThingShape, number>> = {
    model: WORLD_SCRIPT_LIMITS.maxModels,
    opening: WORLD_SCRIPT_LIMITS.maxOpenings,
    avatar: WORLD_SCRIPT_LIMITS.maxAvatars,
};

/** What an avatar is doing. */
export const AVATAR_MOTIONS = [
    "idle",
    "wave",
    "dance",
    "shuffle",
    "pray",
    "sit",
] as const;
export type AvatarMotion = (typeof AVATAR_MOTIONS)[number];

/** A wall of a "solid": four corners, counter-clockwise from the side it stops. */
export type SolidWall = [Vec3, Vec3, Vec3, Vec3];

export const THING_PATTERNS = [
    "none",
    "noise",
    "stripes",
    "swirl",
    "dots",
    "gradient",
] as const;
export type ThingPattern = (typeof THING_PATTERNS)[number];

/** Points a lathe profile or an extrude outline may have. */
export const MAX_SHAPE_POINTS = 64;

export const SOUND_NAMES = [
    "coin",
    "click",
    "jump",
    "hit",
    "win",
    "lose",
    "beep",
] as const;
export type SoundName = (typeof SOUND_NAMES)[number];

export type Vec3 = [number, number, number];

/**
 * Properties a script can set on its own objects. Each has a rule in
 * THING_PROPS below (how it is checked, what it changes, how the SDK sends
 * it); the two cannot drift apart, the table is typed by this.
 */
export interface ThingProps {
    shape?: ThingShape;
    position?: Vec3;
    rotation?: Vec3;
    scale?: Vec3;
    size?: Vec3;
    color?: string;
    opacity?: number;
    glow?: boolean;
    visible?: boolean;
    text?: string;
    textColor?: string;
    background?: string;
    billboard?: boolean;
    look?: ThingLook;
    pattern?: ThingPattern;
    /** Second colour for patterns and painted strokes. */
    color2?: string;
    /** 0–1: the surface sways a little, like something alive or painted. */
    wobble?: number;
    /** Another thing of the same script this one is a part of. */
    parent?: string | null;
    /** lathe: [radius, height] pairs, bottom to top. */
    profile?: Array<[number, number]>;
    /** extrude: [x, y] outline. */
    outline?: Array<[number, number]>;
    depth?: number;
    bevel?: number;
    /** star: number of points. */
    points?: number;
    /** A custom surface as a tree of building blocks (shaderGraph.ts). */
    shader?: import("./shaderGraph").ShaderGraph | null;
    /** A box, cylinder or plane a visitor cannot walk through. */
    solid?: boolean;
    /** model: what it is made of, in the thing's own frame (parts.ts). */
    parts?: PartCommand[];
    /** model: a lamp whose light is worked into its colours. */
    lamp?: ModelLamp | null;
    /** solid: boxes ([min, max]) and one-sided walls, in the thing's frame. */
    boxes?: Array<[Vec3, Vec3]>;
    walls?: SolidWall[];
    /** avatar: which of Oncyber's avatars, by id. */
    avatar?: string;
    /** avatar: the name shown over its head. */
    name?: string;
    /** avatar: what it is saying now ("" for nothing). */
    say?: string;
    /**
     * avatar: what it does while standing. Walking and running come from
     * moving it: the avatar steps along as its position changes.
     */
    motion?: AvatarMotion;
}

/** A door of the world's own model, as a script is told about it. */
export interface DoorInfo {
    id: string;
    /** The middle of the doorway, on the ground. */
    position: Vec3;
    /** The way out through the door, as a turn about the up axis. */
    yaw: number;
    width: number;
    height: number;
    /** The space has made this door a portal: a script cannot open it. */
    portal: boolean;
    /** How far it stands open now: 0 shut, 1 fully open. */
    open: number;
    /** The building behind it, roughly: its middle on the ground and its size. */
    building: { position: Vec3; size: Vec3 } | null;
}

/** What a script may change on one of the space's artworks (not saved). */
export interface ArtworkProps {
    position?: Vec3;
    rotation?: Vec3;
    scale?: Vec3;
    visible?: boolean;
}

export type HudCorner = "top" | "top-left" | "top-right" | "bottom";

export type WorldScriptOp =
    | { op: "add"; id: string; props: ThingProps }
    | { op: "set"; id: string; props: ThingProps }
    | { op: "remove"; id: string }
    | { op: "artwork"; id: string; props: ArtworkProps }
    | { op: "hud"; key: string; text: string | null; corner: HudCorner }
    | { op: "toast"; text: string; seconds: number }
    | { op: "banner"; text: string | null; seconds: number }
    | { op: "sound"; name: SoundName; volume: number }
    | { op: "log"; level: "log" | "warn" | "error"; text: string }
    | { op: "hud-clear" }
    | { op: "player"; position: Vec3 }
    /** Swings one of the world's doors: 0 shut, 1 fully open. */
    | { op: "door"; id: string; open: number };

const ID = /^[a-zA-Z0-9_.:-]+$/;
function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function finite(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

export function cleanId(value: unknown): string | null {
    if (typeof value !== "string") return null;
    if (!value || value.length > WORLD_SCRIPT_LIMITS.maxIdLength) return null;
    return ID.test(value) ? value : null;
}

function cleanVec(value: unknown, min: number, max: number): Vec3 | undefined {
    if (finite(value)) {
        const v = clamp(value, min, max);
        return [v, v, v];
    }
    if (Array.isArray(value) && value.length === 3 && value.every(finite)) {
        return value.map((v: number) => clamp(v, min, max)) as Vec3;
    }
    const object = value as { x?: unknown; y?: unknown; z?: unknown };
    if (
        object &&
        typeof object === "object" &&
        finite(object.x) &&
        finite(object.y) &&
        finite(object.z)
    ) {
        return [
            clamp(object.x, min, max),
            clamp(object.y, min, max),
            clamp(object.z, min, max),
        ];
    }
    return undefined;
}

const ANGLE = 1e4;
const AVATAR_ID = /^[a-zA-Z0-9_-]{1,40}$/;

const oneOf =
    <T extends string>(list: readonly T[]) =>
    (value: unknown) =>
        list.includes(value as T) ? (value as T) : undefined;
const flag = (value: unknown) =>
    typeof value === "boolean" ? value : undefined;
const between = (min: number, max: number) => (value: unknown) =>
    finite(value) ? clamp(value, min, max) : undefined;
const vector = (min: number, max: number) => (value: unknown) =>
    cleanVec(value, min, max);
const words = (max?: number) => (value: unknown) =>
    value == null ? undefined : cleanText(value, max);
/** Null takes it away; anything else is `check`ed. */
const orNone =
    <T>(check: (value: unknown) => T | null | undefined) =>
    (value: unknown) =>
        value === null
            ? null
            : value == null
            ? undefined
            : check(value) || undefined;

/** What the scene does when a property of a thing changes. */
export type ThingPropDraws = "place" | "geometry" | "look" | "special";

export interface ThingPropRule<T> {
    /** The checked value, or undefined when it is refused. */
    clean(value: unknown): T | undefined;
    /**
     * What a change of it means in the scene: the thing is put elsewhere
     * ("place"), its geometry is built again ("geometry"), its surface or
     * text is drawn again ("look"), or what stands behind a model, a
     * solid, an opening or an avatar is told ("special").
     */
    draws: readonly ThingPropDraws[];
    /**
     * How the SDK sends it: "live" whenever the script changes it, "given"
     * once, from what the thing was made with, or in a way of its "own"
     * (the shape, the parent, a model's parts).
     */
    travels: "live" | "given" | "own";
    /** Whether the model's brief tells of it (brief.ts). */
    briefed: boolean;
}

const L = WORLD_SCRIPT_LIMITS;

/**
 * Every property a thing has, once: the check it passes on the way in,
 * what it changes in the scene, how it travels from the script, and
 * whether the model is told of it. `cleanThingProps`, the engine's lists of
 * what to rebuild or redraw (engine/things.ts), and the lists the SDK sends
 * by (sdk.ts) are all made from this; scriptApi.test.ts holds the brief
 * and the SDK's own code to it.
 */
export const THING_PROPS: {
    [K in keyof Required<ThingProps>]: ThingPropRule<ThingProps[K]>;
} = {
    shape: {
        clean: oneOf(THING_SHAPES),
        draws: [],
        travels: "own",
        briefed: true,
    },
    position: {
        clean: vector(-L.maxCoordinate, L.maxCoordinate),
        draws: ["place"],
        travels: "live",
        briefed: true,
    },
    rotation: {
        clean: vector(-ANGLE, ANGLE),
        draws: ["place"],
        travels: "live",
        briefed: true,
    },
    scale: {
        clean: vector(L.minScale, L.maxScale),
        draws: ["place"],
        travels: "live",
        briefed: true,
    },
    size: {
        clean: vector(L.minScale, L.maxSize),
        draws: ["geometry", "special"],
        travels: "given",
        briefed: true,
    },
    color: {
        clean: cleanColor,
        draws: ["look"],
        travels: "live",
        briefed: true,
    },
    opacity: {
        clean: between(0, 1),
        draws: ["look"],
        travels: "live",
        briefed: true,
    },
    glow: { clean: flag, draws: ["look"], travels: "live", briefed: true },
    visible: { clean: flag, draws: ["look"], travels: "live", briefed: true },
    text: { clean: words(), draws: ["look"], travels: "live", briefed: true },
    textColor: {
        clean: cleanColor,
        draws: ["look"],
        travels: "live",
        briefed: true,
    },
    background: {
        clean: cleanColor,
        draws: ["look"],
        travels: "live",
        briefed: true,
    },
    billboard: {
        clean: flag,
        draws: ["geometry"],
        travels: "given",
        briefed: true,
    },
    look: {
        clean: oneOf(THING_LOOKS),
        draws: ["look"],
        travels: "live",
        briefed: true,
    },
    pattern: {
        clean: oneOf(THING_PATTERNS),
        draws: ["look"],
        travels: "live",
        briefed: true,
    },
    color2: {
        clean: cleanColor,
        draws: ["look"],
        travels: "live",
        briefed: true,
    },
    wobble: {
        clean: between(0, 1),
        draws: ["look"],
        travels: "live",
        briefed: true,
    },
    parent: {
        clean: orNone(cleanId),
        draws: [],
        travels: "own",
        briefed: false,
    },
    profile: {
        clean(value) {
            const profile = cleanPoints(value, 0, L.maxSize);
            return profile && profile.length >= 2 ? profile : undefined;
        },
        draws: ["geometry"],
        travels: "given",
        briefed: true,
    },
    outline: {
        clean(value) {
            const outline = cleanPoints(value, -L.maxSize, L.maxSize);
            return outline && outline.length >= 3 ? outline : undefined;
        },
        draws: ["geometry"],
        travels: "given",
        briefed: true,
    },
    depth: {
        clean: between(0.001, L.maxSize),
        draws: ["geometry"],
        travels: "given",
        briefed: true,
    },
    bevel: {
        clean: between(0, 1),
        draws: ["geometry"],
        travels: "given",
        briefed: true,
    },
    points: {
        clean: (value) =>
            finite(value) ? Math.round(clamp(value, 3, 24)) : undefined,
        draws: ["geometry"],
        travels: "given",
        briefed: true,
    },
    shader: {
        clean: orNone(cleanShader),
        draws: ["look"],
        travels: "live",
        briefed: true,
    },
    solid: { clean: flag, draws: [], travels: "live", briefed: false },
    parts: {
        clean: (value) =>
            Array.isArray(value) ? cleanParts(value, cleanColor) : undefined,
        draws: ["special"],
        travels: "own",
        briefed: false,
    },
    lamp: {
        clean: orNone(cleanLamp),
        draws: ["special"],
        travels: "own",
        briefed: false,
    },
    boxes: {
        clean: (value) =>
            cleanCorners(value, 2) as Array<[Vec3, Vec3]> | undefined,
        draws: ["special"],
        travels: "given",
        briefed: false,
    },
    walls: {
        clean: (value) => cleanCorners(value, 4) as SolidWall[] | undefined,
        draws: ["special"],
        travels: "given",
        briefed: false,
    },
    avatar: {
        clean: (value) =>
            typeof value === "string" && AVATAR_ID.test(value)
                ? value
                : undefined,
        draws: ["special"],
        travels: "live",
        briefed: false,
    },
    name: {
        clean: words(L.maxNameLength),
        draws: ["special"],
        travels: "live",
        briefed: false,
    },
    say: {
        clean: words(L.maxSpeechLength),
        draws: ["special"],
        travels: "live",
        briefed: false,
    },
    motion: {
        clean: oneOf(AVATAR_MOTIONS),
        draws: ["special"],
        travels: "live",
        briefed: false,
    },
};

export type ThingPropKey = keyof ThingProps;
export const THING_PROP_KEYS = Object.keys(THING_PROPS) as ThingPropKey[];

const keysThat = (holds: (rule: ThingPropRule<unknown>) => boolean) =>
    THING_PROP_KEYS.filter((key) => holds(THING_PROPS[key]));

/**
 * What a plain shape's geometry is built from, besides its shape: a thing
 * is built again when one of these changes (engine/things.ts), and replaced
 * when a new version makes it without one it had (host.ts).
 */
export const BUILT_FROM_KEYS = keysThat((rule) =>
    rule.draws.includes("geometry")
);
/** A change of one of these draws the thing's surface or text again. */
export const LOOK_KEYS = keysThat((rule) => rule.draws.includes("look"));
/** What a model, a solid, an opening or an avatar is made from. */
export const SPECIAL_KEYS = keysThat((rule) => rule.draws.includes("special"));
/** Where a thing is, which way it is turned and how big. */
export const PLACE_KEYS = keysThat((rule) => rule.draws.includes("place"));
/** What the SDK sends whenever the script changes it. */
export const LIVE_KEYS = keysThat((rule) => rule.travels === "live");
/** What the SDK sends once, from what the thing was made with. */
export const GIVEN_KEYS = keysThat((rule) => rule.travels === "given");

/** The properties in `raw` that pass their check, from `keys`. */
function cleanProps<K extends ThingPropKey>(
    raw: Record<string, unknown>,
    keys: readonly K[]
): Pick<ThingProps, K> {
    const props: ThingProps = {};
    for (const key of keys) {
        const value = (THING_PROPS[key] as ThingPropRule<unknown>).clean(
            raw[key]
        );
        if (value !== undefined)
            (props as Record<string, unknown>)[key] = value;
    }
    return props as Pick<ThingProps, K>;
}

export function cleanThingProps(raw: unknown): ThingProps {
    if (!raw || typeof raw !== "object") return {};
    return cleanProps(raw as Record<string, unknown>, THING_PROP_KEYS);
}

const DOOR_ID = /^[a-zA-Z0-9_ .:-]{1,60}$/;

/** A list of point groups (a box's two corners, a wall's four), checked. */
function cleanCorners(value: unknown, corners: number): Vec3[][] | undefined {
    if (!Array.isArray(value)) return undefined;
    const L = WORLD_SCRIPT_LIMITS;
    const out: Vec3[][] = [];
    for (const item of value.slice(0, L.maxSolidParts)) {
        if (!Array.isArray(item) || item.length !== corners) continue;
        const points = item.map((point) =>
            cleanVec(point, -L.maxSize, L.maxSize)
        );
        if (points.every((point) => point && Array.isArray(point)))
            out.push(points as Vec3[]);
    }
    return out;
}

function cleanPoints(
    value: unknown,
    min: number,
    max: number
): Array<[number, number]> | undefined {
    if (!Array.isArray(value)) return undefined;
    const points: Array<[number, number]> = [];
    for (const point of value.slice(0, MAX_SHAPE_POINTS)) {
        if (!Array.isArray(point) || !finite(point[0]) || !finite(point[1]))
            return undefined;
        points.push([clamp(point[0], min, max), clamp(point[1], -max, max)]);
    }
    return points;
}

export function cleanArtworkProps(raw: unknown): ArtworkProps {
    if (!raw || typeof raw !== "object") return {};
    const input = raw as Record<string, unknown>;
    return cleanProps(input, ["position", "rotation", "scale", "visible"]);
}

function seconds(value: unknown, fallback: number) {
    return finite(value)
        ? clamp(value, 0.2, WORLD_SCRIPT_LIMITS.maxSeconds)
        : fallback;
}

export const HUD_CORNERS: HudCorner[] = [
    "top",
    "top-left",
    "top-right",
    "bottom",
];
const CORNERS = HUD_CORNERS;

/** One raw request from the sandbox, checked. Null when it is refused. */
export function cleanOp(raw: unknown): WorldScriptOp | null {
    if (!raw || typeof raw !== "object") return null;
    const input = raw as Record<string, unknown>;
    switch (input.op) {
        case "add": {
            const id = cleanId(input.id);
            if (!id) return null;
            const props = cleanThingProps(input.props);
            if (!props.shape) props.shape = "box";
            return { op: "add", id, props };
        }
        case "set": {
            const id = cleanId(input.id);
            if (!id) return null;
            const props = cleanThingProps(input.props);
            delete props.shape;
            return { op: "set", id, props };
        }
        case "remove": {
            const id = cleanId(input.id);
            return id ? { op: "remove", id } : null;
        }
        case "artwork": {
            const id =
                typeof input.id === "string" ? input.id.slice(0, 200) : null;
            if (!id) return null;
            return { op: "artwork", id, props: cleanArtworkProps(input.props) };
        }
        case "hud": {
            const key = cleanId(input.key);
            if (!key) return null;
            const corner = CORNERS.includes(input.corner as HudCorner)
                ? (input.corner as HudCorner)
                : "top-left";
            return {
                op: "hud",
                key,
                text: input.text == null ? null : cleanText(input.text),
                corner,
            };
        }
        case "toast":
            return {
                op: "toast",
                text: cleanText(input.text),
                seconds: seconds(input.seconds, 3),
            };
        case "banner":
            return {
                op: "banner",
                text: input.text == null ? null : cleanText(input.text, 60),
                seconds: seconds(input.seconds, 3),
            };
        case "sound":
            if (!SOUND_NAMES.includes(input.name as SoundName)) return null;
            return {
                op: "sound",
                name: input.name as SoundName,
                volume: finite(input.volume) ? clamp(input.volume, 0, 1) : 0.6,
            };
        case "hud-clear":
            return { op: "hud-clear" };
        case "player": {
            const L = WORLD_SCRIPT_LIMITS;
            const position = cleanVec(
                input.position,
                -L.maxCoordinate,
                L.maxCoordinate
            );
            return position ? { op: "player", position } : null;
        }
        case "door": {
            const id =
                typeof input.id === "string" && DOOR_ID.test(input.id)
                    ? input.id
                    : null;
            if (!id || !finite(input.open)) return null;
            return { op: "door", id, open: clamp(input.open, 0, 1) };
        }
        case "log": {
            const level =
                input.level === "warn" || input.level === "error"
                    ? input.level
                    : "log";
            return { op: "log", level, text: cleanText(input.text, 500) };
        }
        default:
            return null;
    }
}

/**
 * A batch from the sandbox: at most `limit` clean requests (what is left of
 * the frame's maxOpsPerTick). The rest is counted and never looked at.
 */
export function cleanOps(
    raw: unknown,
    limit: number = WORLD_SCRIPT_LIMITS.maxOpsPerTick
): {
    ops: WorldScriptOp[];
    dropped: number;
} {
    if (!Array.isArray(raw)) return { ops: [], dropped: 0 };
    const most = Math.max(
        0,
        Math.min(limit, WORLD_SCRIPT_LIMITS.maxOpsPerTick)
    );
    const ops: WorldScriptOp[] = [];
    let dropped = Math.max(0, raw.length - most);
    for (const item of raw.slice(0, most)) {
        const op = cleanOp(item);
        if (op) ops.push(op);
        else dropped++;
    }
    return { ops, dropped };
}

/** Saved script record on a space (`exhibits/{id}.worldScripts`). */
export interface WorldScriptRecord {
    id: string;
    name: string;
    source: string;
    /**
     * False switches the script off for everyone without taking it away.
     * Nothing in the interface sets it; it is how a space's script is
     * turned off by hand (the save procedure takes it, and so does the
     * space's record).
     */
    enabled: boolean;
    updatedAt?: number;
}
