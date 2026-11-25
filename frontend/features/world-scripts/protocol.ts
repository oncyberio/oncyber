/**
 * What a world script may ask the host to do, and the checks every request
 * passes before it touches the scene. The script runs in an opaque sandbox
 * (see sandboxDocument.ts); nothing it sends is trusted. Every value is
 * clamped or dropped here, so the engine adapter only ever sees clean,
 * bounded data.
 */

import { cleanShader } from "./shaderGraph";
import {
    cleanLamp,
    cleanParts,
    type ModelLamp,
    type PartCommand,
} from "./parts";

export const WORLD_SCRIPT_LIMITS = {
    /** Objects one script can have in the world at once. */
    maxThings: 300,
    /** Requests applied per frame; the rest of a batch is dropped. */
    maxOpsPerTick: 600,
    /** HUD lines shown at once. */
    maxHudLines: 8,
    maxTextLength: 160,
    maxIdLength: 40,
    /** Furthest an object can be placed from the world's origin, in metres. */
    maxCoordinate: 2000,
    minScale: 0.001,
    maxScale: 200,
    maxSize: 100,
    maxSeconds: 30,
    /** Source size the studio saves and the sandbox accepts. */
    maxSourceBytes: 48_000,
    /** Scripts one space can keep. */
    maxScriptsPerSpace: 3,
    /** Errors before the host stops a script for good. */
    maxErrors: 25,
    /** Models one script can have (a painted one is thousands of strokes). */
    maxModels: 8,
    /** Holes one script can open in the world's own model. */
    maxOpenings: 6,
    /** Longest side of one opening, in metres. */
    maxOpeningSize: 60,
    /** Avatars one script can have standing in the world. */
    maxAvatars: 12,
    /** Boxes and walls in one "solid". */
    maxSolidParts: 64,
    /** Characters of an avatar's name, and of what it says. */
    maxNameLength: 40,
    maxSpeechLength: 200,
} as const;

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

/**
 * How a thing's surface is drawn. "style" (the default) uses the world's own
 * look (style.ts); the others pick one. All are made on the device from
 * code, so a script never makes the page fetch a texture.
 */
export const THING_LOOKS = [
    "style",
    "painted",
    "toon",
    "glossy",
    "matte",
    "metal",
    "glow",
    "flat",
] as const;
export type ThingLook = (typeof THING_LOOKS)[number];

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

/** Properties a script can set on its own objects. */
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
const COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const NAMED_COLORS: Record<string, string> = {
    white: "#ffffff",
    black: "#000000",
    red: "#ff3b30",
    orange: "#ff9500",
    yellow: "#ffd60a",
    gold: "#ffc400",
    green: "#34c759",
    teal: "#30d5c8",
    blue: "#0a84ff",
    purple: "#bf5af2",
    pink: "#ff6fae",
    gray: "#8e8e93",
    grey: "#8e8e93",
};

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

export function cleanText(
    value: unknown,
    max: number = WORLD_SCRIPT_LIMITS.maxTextLength
) {
    if (value == null) return "";
    const text = typeof value === "string" ? value : String(value);
    // Control characters other than new lines are dropped.
    // eslint-disable-next-line no-control-regex
    return text
        .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "")
        .slice(0, max);
}

export function cleanColor(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const lower = value.trim().toLowerCase();
    if (NAMED_COLORS[lower]) return NAMED_COLORS[lower];
    return COLOR.test(lower) ? lower : undefined;
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

function cleanTransform(raw: Record<string, unknown>) {
    const L = WORLD_SCRIPT_LIMITS;
    const out: { position?: Vec3; rotation?: Vec3; scale?: Vec3 } = {};
    const position = cleanVec(raw.position, -L.maxCoordinate, L.maxCoordinate);
    if (position) out.position = position;
    const rotation = cleanVec(raw.rotation, -ANGLE, ANGLE);
    if (rotation) out.rotation = rotation;
    const scale = cleanVec(raw.scale, L.minScale, L.maxScale);
    if (scale) out.scale = scale;
    return out;
}

export function cleanThingProps(raw: unknown): ThingProps {
    if (!raw || typeof raw !== "object") return {};
    const input = raw as Record<string, unknown>;
    const L = WORLD_SCRIPT_LIMITS;
    const props: ThingProps = cleanTransform(input);
    if (THING_SHAPES.includes(input.shape as ThingShape))
        props.shape = input.shape as ThingShape;
    const size = cleanVec(input.size, L.minScale, L.maxSize);
    if (size) props.size = size;
    for (const key of ["color", "textColor", "background"] as const) {
        const color = cleanColor(input[key]);
        if (color) props[key] = color;
    }
    if (finite(input.opacity)) props.opacity = clamp(input.opacity, 0, 1);
    for (const key of ["glow", "visible", "billboard"] as const) {
        if (typeof input[key] === "boolean") props[key] = input[key] as boolean;
    }
    if (input.text != null) props.text = cleanText(input.text);
    if (THING_LOOKS.includes(input.look as ThingLook))
        props.look = input.look as ThingLook;
    if (THING_PATTERNS.includes(input.pattern as ThingPattern))
        props.pattern = input.pattern as ThingPattern;
    const color2 = cleanColor(input.color2);
    if (color2) props.color2 = color2;
    if (finite(input.wobble)) props.wobble = clamp(input.wobble, 0, 1);
    if (input.parent === null) props.parent = null;
    else if (input.parent != null) {
        const parent = cleanId(input.parent);
        if (parent) props.parent = parent;
    }
    const profile = cleanPoints(input.profile, 0, L.maxSize);
    if (profile && profile.length >= 2) props.profile = profile;
    const outline = cleanPoints(input.outline, -L.maxSize, L.maxSize);
    if (outline && outline.length >= 3) props.outline = outline;
    if (finite(input.depth)) props.depth = clamp(input.depth, 0.001, L.maxSize);
    if (finite(input.bevel)) props.bevel = clamp(input.bevel, 0, 1);
    if (finite(input.points))
        props.points = Math.round(clamp(input.points, 3, 24));
    if (input.shader === null) props.shader = null;
    else if (input.shader != null) {
        const shader = cleanShader(input.shader);
        if (shader) props.shader = shader;
    }
    if (typeof input.solid === "boolean") props.solid = input.solid;
    if (Array.isArray(input.parts))
        props.parts = cleanParts(input.parts, cleanColor);
    if (input.lamp === null) props.lamp = null;
    else if (input.lamp != null) {
        const lamp = cleanLamp(input.lamp);
        if (lamp) props.lamp = lamp;
    }
    const boxes = cleanCorners(input.boxes, 2);
    if (boxes) props.boxes = boxes as Array<[Vec3, Vec3]>;
    const walls = cleanCorners(input.walls, 4);
    if (walls) props.walls = walls as SolidWall[];
    if (typeof input.avatar === "string" && AVATAR_ID.test(input.avatar))
        props.avatar = input.avatar;
    if (input.name != null) props.name = cleanText(input.name, L.maxNameLength);
    if (input.say != null) props.say = cleanText(input.say, L.maxSpeechLength);
    if (AVATAR_MOTIONS.includes(input.motion as AvatarMotion))
        props.motion = input.motion as AvatarMotion;
    return props;
}

const AVATAR_ID = /^[a-zA-Z0-9_-]{1,40}$/;
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
    const props: ArtworkProps = cleanTransform(input);
    if (typeof input.visible === "boolean") props.visible = input.visible;
    return props;
}

function seconds(value: unknown, fallback: number) {
    return finite(value)
        ? clamp(value, 0.2, WORLD_SCRIPT_LIMITS.maxSeconds)
        : fallback;
}

const CORNERS: HudCorner[] = ["top", "top-left", "top-right", "bottom"];

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

/** A batch from the sandbox: at most maxOpsPerTick clean requests. */
export function cleanOps(raw: unknown): {
    ops: WorldScriptOp[];
    dropped: number;
} {
    if (!Array.isArray(raw)) return { ops: [], dropped: 0 };
    const ops: WorldScriptOp[] = [];
    let dropped = Math.max(0, raw.length - WORLD_SCRIPT_LIMITS.maxOpsPerTick);
    for (const item of raw.slice(0, WORLD_SCRIPT_LIMITS.maxOpsPerTick)) {
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
    enabled: boolean;
    /** The last request the creator made, kept to continue the conversation. */
    prompt?: string;
    updatedAt?: number;
}

export function byteLength(text: string) {
    return new TextEncoder().encode(text).length;
}
