/**
 * Custom shaders for world scripts, as data. A script never sends shader
 * text: raw GLSL or WGSL would be compiled and run by the page on every
 * visitor's GPU, where one heavy loop freezes the tab and nothing can stop
 * it. Instead it describes a surface as a small tree of building blocks,
 * (tokens-ok: an example of a 3D surface)
 *     ["mix", "#102a6b", "#ffd60a", ["smoothstep", 0.4, 0.6, ["noise", ["mul", "position", 3]]]]
 *
 * and the host builds the real shader from it (looks.ts). The blocks have
 * no loops and the tree is capped, so the cost of any shader is bounded.
 * This file is the check: what comes out is a tree of known blocks with
 * the right number of inputs, finite numbers and known names.
 */
import { cleanColor } from "./protocol";

/** Blocks and how many inputs each takes ([min, max]). */
export const SHADER_OPS: Record<string, [number, number]> = {
    add: [2, 4],
    sub: [2, 2],
    mul: [2, 4],
    div: [2, 2],
    min: [2, 2],
    max: [2, 2],
    mix: [3, 3],
    clamp: [3, 3],
    saturate: [1, 1],
    abs: [1, 1],
    sign: [1, 1],
    floor: [1, 1],
    fract: [1, 1],
    sin: [1, 1],
    cos: [1, 1],
    pow: [2, 2],
    sqrt: [1, 1],
    step: [2, 2],
    smoothstep: [3, 3],
    length: [1, 1],
    distance: [2, 2],
    dot: [2, 2],
    normalize: [1, 1],
    vec3: [3, 3],
    x: [1, 1],
    y: [1, 1],
    z: [1, 1],
    /** Smooth noise, 0–1, of a point. */
    noise: [1, 1],
    /** Layered noise (clouds, paint), 0–1. */
    fbm: [1, 1],
    /** Cell noise (scales, cracks, stars), 0–1. */
    cells: [1, 1],
    /** Shifts a colour's hue by a turn fraction. */
    hue: [2, 2],
};

/** Values the host supplies. */
export const SHADER_INPUTS = [
    "time",
    /** The point on the object, in its own space (about -0.5 to 0.5). */
    "position",
    /** The point in the world, in metres. */
    "world",
    "normal",
    "uv",
    /** 0 facing the camera, 1 at the silhouette. */
    "fresnel",
    /** The thing's own colours. */
    "color",
    "color2",
    /** The world style's palette. */
    "palette0",
    "palette1",
    "palette2",
    "palette3",
    "palette4",
] as const;

export type ShaderExpr = number | string | [string, ...ShaderExpr[]];

export interface ShaderGraph {
    /** The surface colour (lit by the thing's look). */
    color?: ShaderExpr;
    /** Light the surface gives off. */
    glow?: ShaderExpr;
    /** 0–1 coverage; below 1 the surface is see-through. */
    opacity?: ShaderExpr;
    /** Metres the surface moves along its normal (−0.5 to 0.5). */
    offset?: ShaderExpr;
}

export const SHADER_LIMITS = { nodes: 96, depth: 14, number: 10_000 } as const;

function cleanExpr(
    raw: unknown,
    budget: { nodes: number },
    depth: number
): ShaderExpr | null {
    if (--budget.nodes < 0 || depth > SHADER_LIMITS.depth) return null;
    if (typeof raw === "number") {
        if (!Number.isFinite(raw)) return null;
        return Math.min(
            SHADER_LIMITS.number,
            Math.max(-SHADER_LIMITS.number, raw)
        );
    }
    if (typeof raw === "string") {
        if ((SHADER_INPUTS as readonly string[]).includes(raw)) return raw;
        return cleanColor(raw) ?? null;
    }
    if (!Array.isArray(raw) || typeof raw[0] !== "string") return null;
    const arity = Object.prototype.hasOwnProperty.call(SHADER_OPS, raw[0])
        ? SHADER_OPS[raw[0]]
        : null;
    const count = raw.length - 1;
    if (!arity || count < arity[0] || count > arity[1]) return null;
    const out: [string, ...ShaderExpr[]] = [raw[0]];
    for (let i = 1; i < raw.length; i++) {
        const input = cleanExpr(raw[i], budget, depth + 1);
        if (input == null) return null;
        out.push(input);
    }
    return out;
}

/** A shader from a script, checked. Null when any part of it is refused. */
export function cleanShader(raw: unknown): ShaderGraph | null {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const input = raw as Record<string, unknown>;
    const budget = { nodes: SHADER_LIMITS.nodes };
    const graph: ShaderGraph = {};
    for (const key of ["color", "glow", "opacity", "offset"] as const) {
        if (input[key] == null) continue;
        const expr = cleanExpr(input[key], budget, 0);
        if (expr == null) return null;
        graph[key] = expr;
    }
    return Object.keys(graph).length ? graph : null;
}
