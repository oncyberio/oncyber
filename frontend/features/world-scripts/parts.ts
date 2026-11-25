/**
 * Models for world scripts: objects a script builds from flat shapes, boxes,
 * beams, columns and lines, each with a colour. The script says what the
 * object is made of; how it is drawn belongs to the world's style
 * (style.ts). In a painted world every surface becomes brush strokes (the
 * sky's brush, `features/worldMods/paintedSurface`); in any other look the
 * same parts are one mesh with that look's surface.
 *
 * The script sends a list of parts, never triangles, strokes or shader
 * code. The host builds the object itself, with caps on parts, strokes and
 * the work one model may take, so the cost is bounded whatever is asked.
 *
 * Three-free: the checks run before anything touches the scene.
 */
import {
    createPainter,
    hex,
    type Colour,
    type Light,
    type Painted,
    type PaintStyle,
    type Vec3,
} from "@features/worldMods/paintedSurface/painter";

export const PART_LIMITS = {
    /** Parts in one model, counting those inside placements. */
    maxParts: 2000,
    /** Corners of one flat shape. */
    maxCorners: 12,
    /** Placements inside placements. */
    maxDepth: 4,
    /** Furthest a point can be from the model's own origin. */
    maxExtent: 200,
    /** Brush strokes in one painted model; the rest are left out. */
    maxStrokes: 40_000,
    /** Stroke placements tried for one model (bounds the time it takes). */
    maxWork: 2_000_000,
    maxColours: 8,
} as const;

/** The direction of a surface's grain: an angle, a turn about a point, or a wave. */
export type PartFlow =
    | number
    | ["around", number, number]
    | ["wave", number, number, number, number];

/** How one part looks, as a script writes it. Only `color` is needed. */
export interface PartSpec {
    color: string;
    /** More tones of the same surface, for looks that mix several. */
    colors?: string[];
    /** The colour showing through between strokes, in painted looks. */
    under?: string;
    /** Which way the surface's grain runs (boards, brushwork, weave). */
    flow?: PartFlow;
    /** box: the axis the grain follows. */
    along?: "x" | "y" | "z";
    /** The size of the surface's detail, in metres: smaller for small things. */
    fine?: number;
    /** 0–1: how loosely the grain keeps to its direction. */
    loose?: number;
    /** How thickly the surface is covered: 1 is the usual. */
    density?: number;
    /** Lit from within: keeps its colour whatever the lamp does. */
    glow?: boolean;
    /** box: the sides to make, from "xXyYzZ". */
    faces?: string;
    /** prism */
    sides?: number;
    topRadius?: number;
    top?: boolean;
    /** beam: make the fourth side too. */
    back?: boolean;
}

export interface LineSpec {
    color: string;
    width?: number;
    glow?: boolean;
}

export type PartCommand =
    | ["poly", Vec3[], PartSpec]
    | ["box", Vec3, Vec3, PartSpec]
    | ["beam", Vec3, Vec3, Vec3, number, number, PartSpec]
    | ["prism", [number, number], number, number, number, PartSpec]
    | ["line", Vec3, Vec3, Vec3, LineSpec]
    | ["place", Vec3, number, PartCommand[]];

/** A lamp whose light is worked into a model's colours: warm near, cool far. */
export interface ModelLamp {
    at: Vec3;
    /** Distance at which the lamp's light has halved. */
    reach: number;
    /** What the lamp adds at its brightest, per channel. */
    warm: Vec3;
    /** What everything has without it, per channel. */
    cool: Vec3;
}

const finite = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value);
const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

function vec(value: unknown, extent: number): Vec3 | null {
    if (!Array.isArray(value) || value.length !== 3 || !value.every(finite))
        return null;
    return [
        clamp(value[0], -extent, extent),
        clamp(value[1], -extent, extent),
        clamp(value[2], -extent, extent),
    ];
}

function num(value: unknown, min: number, max: number): number | undefined {
    return finite(value) ? clamp(value, min, max) : undefined;
}

type ColourCheck = (value: unknown) => string | undefined;

/** Three or six hex digits to six. tokens-ok: an example, not a colour */
function sixDigits(colour: string) {
    return colour.length === 4
        ? "#" + [...colour.slice(1)].map((c) => c + c).join("")
        : colour;
}

function cleanFlow(value: unknown): PartFlow | undefined {
    if (finite(value)) return clamp(value, -100, 100);
    if (!Array.isArray(value)) return undefined;
    const E = PART_LIMITS.maxExtent;
    if (value[0] === "around" && finite(value[1]) && finite(value[2]))
        return ["around", clamp(value[1], -E, E), clamp(value[2], -E, E)];
    if (value[0] === "wave" && value.slice(1, 5).every(finite))
        return [
            "wave",
            clamp(value[1], -100, 100),
            clamp(value[2], 0, Math.PI),
            clamp(value[3], -50, 50),
            clamp(value[4], -50, 50),
        ];
    return undefined;
}

function cleanSpec(raw: unknown, colour: ColourCheck): PartSpec | null {
    if (!raw || typeof raw !== "object") return null;
    const input = raw as Record<string, unknown>;
    const colors = (Array.isArray(input.colors) ? input.colors : [])
        .slice(0, PART_LIMITS.maxColours)
        .map(colour)
        .filter((value): value is string => !!value)
        .map(sixDigits);
    const main = colour(input.color);
    const color = main ? sixDigits(main) : colors[0];
    if (!color) return null;
    const spec: PartSpec = { color };
    if (colors.length) spec.colors = colors;
    const under = colour(input.under);
    if (under) spec.under = sixDigits(under);
    const flow = cleanFlow(input.flow);
    if (flow !== undefined) spec.flow = flow;
    if (input.along === "x" || input.along === "y" || input.along === "z")
        spec.along = input.along;
    const fine = num(input.fine, 0.02, 5);
    if (fine !== undefined) spec.fine = fine;
    const loose = num(input.loose, 0, 1);
    if (loose !== undefined) spec.loose = loose;
    const density = num(input.density, 0.1, 4);
    if (density !== undefined) spec.density = density;
    if (typeof input.glow === "boolean") spec.glow = input.glow;
    if (typeof input.faces === "string" && /^[xXyYzZ]{1,6}$/.test(input.faces))
        spec.faces = input.faces;
    if (finite(input.sides)) spec.sides = Math.round(clamp(input.sides, 3, 24));
    const topRadius = num(input.topRadius, 0, PART_LIMITS.maxExtent);
    if (topRadius !== undefined) spec.topRadius = topRadius;
    if (typeof input.top === "boolean") spec.top = input.top;
    if (typeof input.back === "boolean") spec.back = input.back;
    return spec;
}

/**
 * A model's parts, checked. Anything malformed is dropped; a model with
 * more than its share of parts loses the rest.
 */
export function cleanParts(raw: unknown, colour: ColourCheck): PartCommand[] {
    let budget: number = PART_LIMITS.maxParts;
    const E = PART_LIMITS.maxExtent;

    const list = (value: unknown, depth: number): PartCommand[] => {
        const out: PartCommand[] = [];
        if (!Array.isArray(value)) return out;
        for (const item of value) {
            if (budget <= 0) break;
            if (!Array.isArray(item)) continue;
            budget--;
            const command = one(item, depth);
            if (command) out.push(command);
        }
        return out;
    };

    const one = (c: unknown[], depth: number): PartCommand | null => {
        switch (c[0]) {
            case "poly": {
                if (!Array.isArray(c[1])) return null;
                const corners = c[1]
                    .slice(0, PART_LIMITS.maxCorners)
                    .map((p) => vec(p, E));
                const spec = cleanSpec(c[2], colour);
                if (corners.length < 3 || corners.includes(null) || !spec)
                    return null;
                return ["poly", corners as Vec3[], spec];
            }
            case "box": {
                const lo = vec(c[1], E);
                const hi = vec(c[2], E);
                const spec = cleanSpec(c[3], colour);
                if (!lo || !hi || !spec) return null;
                return [
                    "box",
                    [
                        Math.min(lo[0], hi[0]),
                        Math.min(lo[1], hi[1]),
                        Math.min(lo[2], hi[2]),
                    ],
                    [
                        Math.max(lo[0], hi[0]),
                        Math.max(lo[1], hi[1]),
                        Math.max(lo[2], hi[2]),
                    ],
                    spec,
                ];
            }
            case "beam": {
                const a = vec(c[1], E);
                const b = vec(c[2], E);
                const facing = vec(c[3], 1);
                const width = num(c[4], 0.01, E);
                const depthOf = num(c[5], 0, E);
                const spec = cleanSpec(c[6], colour);
                if (!a || !b || !facing || !spec) return null;
                if (width === undefined || depthOf === undefined) return null;
                return ["beam", a, b, facing, width, depthOf, spec];
            }
            case "prism": {
                const at = c[1];
                const radius = num(c[2], 0.005, E);
                const y0 = num(c[3], -E, E);
                const y1 = num(c[4], -E, E);
                const spec = cleanSpec(c[5], colour);
                if (
                    !Array.isArray(at) ||
                    !finite(at[0]) ||
                    !finite(at[1]) ||
                    radius === undefined ||
                    y0 === undefined ||
                    y1 === undefined ||
                    !spec
                )
                    return null;
                return [
                    "prism",
                    [clamp(at[0], -E, E), clamp(at[1], -E, E)],
                    radius,
                    y0,
                    y1,
                    spec,
                ];
            }
            case "line": {
                const a = vec(c[1], E);
                const b = vec(c[2], E);
                const facing = vec(c[3], 1);
                const input = (c[4] || {}) as Record<string, unknown>;
                const tint = colour(input.color);
                if (!a || !b || !facing || !tint) return null;
                const line: LineSpec = { color: sixDigits(tint) };
                const width = num(input.width, 0.01, 2);
                if (width !== undefined) line.width = width;
                if (typeof input.glow === "boolean") line.glow = input.glow;
                return ["line", a, b, facing, line];
            }
            case "place": {
                if (depth >= PART_LIMITS.maxDepth) return null;
                const at = vec(c[1], E);
                const yaw = num(c[2], -1e4, 1e4);
                if (!at || yaw === undefined) return null;
                return ["place", at, yaw, list(c[3], depth + 1)];
            }
            default:
                return null;
        }
    };

    return list(raw, 0);
}

/** A lamp, checked, or nothing when it is not one. */
export function cleanLamp(raw: unknown): ModelLamp | undefined {
    if (!raw || typeof raw !== "object") return undefined;
    const input = raw as Record<string, unknown>;
    const at = vec(input.at, PART_LIMITS.maxExtent);
    if (!at) return undefined;
    const channel = (value: unknown, fallback: Vec3): Vec3 =>
        Array.isArray(value) && value.length === 3 && value.every(finite)
            ? [
                  clamp(value[0], 0, 3),
                  clamp(value[1], 0, 3),
                  clamp(value[2], 0, 3),
              ]
            : fallback;
    return {
        at,
        reach: num(input.reach, 0.5, 200) ?? 5.5,
        warm: channel(input.warm, [1.2, 0.98, 0.58]),
        cool: channel(input.cool, [0.44, 0.48, 0.62]),
    };
}

/** How many parts a model holds, counting those inside placements. */
export function countParts(commands: PartCommand[]): number {
    let count = 0;
    for (const command of commands) {
        count++;
        if (command[0] === "place") count += countParts(command[3]);
    }
    return count;
}

/**
 * The lamp's light: warm and bright near it, cool and dim far away, a
 * little more on what faces it. Worked into the colours, not computed
 * while drawing.
 */
export function lampLight(lamp: ModelLamp): Light {
    return (at, facing) => {
        const x = lamp.at[0] - at[0];
        const y = lamp.at[1] - at[1];
        const z = lamp.at[2] - at[2];
        const far = Math.hypot(x, y, z) || 1;
        const towards = (x * facing[0] + y * facing[1] + z * facing[2]) / far;
        const near = 1 / (1 + (far / lamp.reach) ** 2);
        const lit = near * (0.62 + 0.38 * Math.max(0, towards));
        return [
            lamp.cool[0] + lamp.warm[0] * lit,
            lamp.cool[1] + lamp.warm[1] * lit,
            lamp.cool[2] + lamp.warm[2] * lit,
        ];
    };
}

function flowOf(flow: PartFlow | undefined): PaintStyle["flow"] {
    if (flow === undefined) return undefined;
    if (typeof flow === "number") return flow;
    if (flow[0] === "around") {
        const [, a, b] = flow;
        // the grain circles the point, as a sky turns about its swirls
        return (along, across) =>
            Math.atan2(across - b, along - a) + Math.PI / 2;
    }
    const [, base, amplitude, alongRate, acrossRate] = flow;
    return (along, across) =>
        base + amplitude * Math.sin(along * alongRate + across * acrossRate);
}

const shade = (colour: Colour, by: number): Colour => [
    Math.min(1, Math.max(0, colour[0] * by)),
    Math.min(1, Math.max(0, colour[1] * by)),
    Math.min(1, Math.max(0, colour[2] * by)),
];

/**
 * The tones a painter mixes for a surface of one colour: the colour, a
 * lighter and a darker one, and one leaning warm and one cool.
 */
export function tonesOf(colour: Colour): Colour[] {
    return [
        colour,
        shade(colour, 1.1),
        shade(colour, 0.88),
        [
            Math.min(1, colour[0] * 1.08),
            colour[1],
            Math.max(0, colour[2] * 0.9),
        ],
        [
            Math.max(0, colour[0] * 0.9),
            colour[1] * 0.97,
            Math.min(1, colour[2] * 1.08),
        ],
    ];
}

export type BuildOptions = {
    /** Brush strokes on every surface, or plain coloured faces. */
    painted: boolean;
    /** Worked into the colours when given. */
    lamp?: ModelLamp;
    /** Thins the strokes (phones). */
    density?: number;
    /** 0–1, from the world's style: how lively the brushwork is. */
    strokes?: number;
    /** The same parts and seed build the same object every time. */
    seed?: number;
};

/**
 * Builds a model from its checked parts: flat faces with a colour per
 * corner (`base`) and, when painted, the brush strokes laid over them.
 */
export function buildParts(
    commands: PartCommand[],
    { painted, lamp, density = 1, strokes = 0.5, seed = 1 }: BuildOptions
): Painted {
    const light = lamp ? lampLight(lamp) : undefined;
    const paint = createPainter({
        seed,
        density,
        light,
        // plain faces: the painter lays the faces and no strokes
        maxStrokes: painted ? PART_LIMITS.maxStrokes : 0,
        maxWork: PART_LIMITS.maxWork,
    });
    const vary = 0.06 + 0.16 * strokes;

    const styleOf = (spec: PartSpec): PaintStyle & Record<string, unknown> => {
        const colour = hex(spec.color);
        const { faces, sides, topRadius, top, back } = spec;
        return {
            palette: spec.colors?.length
                ? (spec.colors.map(hex) as Colour[])
                : tonesOf(colour),
            // painted: the darker ground between strokes; plain: the colour
            under: painted
                ? spec.under
                    ? hex(spec.under)
                    : shade(colour, 0.45)
                : colour,
            ...(spec.flow !== undefined ? { flow: flowOf(spec.flow) } : {}),
            vary,
            ...(spec.fine !== undefined
                ? { width: spec.fine, length: spec.fine * 3.8 }
                : {}),
            ...(spec.loose !== undefined ? { wobble: spec.loose * 0.6 } : {}),
            ...(spec.density !== undefined ? { density: spec.density } : {}),
            ...(spec.along ? { grain: spec.along } : {}),
            ...(faces ? { faces } : {}),
            ...(sides ? { sides } : {}),
            ...(topRadius !== undefined ? { topRadius } : {}),
            ...(top !== undefined ? { top } : {}),
            ...(back !== undefined ? { back } : {}),
            ...(spec.glow ? { glow: true } : {}),
        };
    };

    const run = (list: PartCommand[]) => {
        for (const command of list) {
            if (painted && paint.full) return;
            switch (command[0]) {
                case "poly":
                    paint.poly(command[1], styleOf(command[2]));
                    break;
                case "box":
                    paint.box(command[1], command[2], styleOf(command[3]));
                    break;
                case "beam":
                    paint.beam(
                        command[1],
                        command[2],
                        command[3],
                        command[4],
                        command[5],
                        styleOf(command[6])
                    );
                    break;
                case "prism":
                    paint.prism(
                        command[1],
                        command[2],
                        command[3],
                        command[4],
                        styleOf(command[5])
                    );
                    break;
                case "line": {
                    const [, a, b, facing, spec] = command;
                    const style = {
                        colour: hex(spec.color),
                        width: spec.width,
                        glow: spec.glow,
                    };
                    if (painted) paint.line(a, b, facing, style);
                    else paint.ribbon(a, b, facing, style);
                    break;
                }
                case "place":
                    paint.place(command[1], command[2], () => run(command[3]));
                    break;
            }
        }
    };
    run(commands);
    return paint.build();
}
