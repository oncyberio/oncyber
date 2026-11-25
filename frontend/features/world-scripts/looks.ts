/**
 * The surfaces a world script's objects can have, made from code with TSL
 * node materials, so they draw the same on WebGPU and on the WebGL2
 * fallback and never need a texture: painted brushwork from the world's
 * palette, toon, glossy, matte, metal, glow and flat, each optionally with
 * a pattern (noise, stripes, swirl, dots, gradient) and a gentle wobble.
 *
 * Materials are shared: every object with the same look, colours, pattern
 * and wobble uses one material, so a hundred coins compile one shader.
 */
import {
    Color,
    DoubleSide,
    FrontSide,
    MeshBasicNodeMaterial,
    MeshPhysicalNodeMaterial,
    MeshStandardNodeMaterial,
    MeshToonNodeMaterial,
    NodeMaterial,
} from "three/webgpu";
import {
    abs,
    atan,
    attribute,
    clamp,
    color as tslColor,
    cos,
    dot,
    floor,
    hue,
    max,
    min,
    mx_worley_noise_float,
    normalize,
    normalView,
    positionViewDirection,
    positionWorld,
    pow,
    sign,
    sqrt,
    uv,
    float as tslFloat,
    fract,
    length,
    mix,
    mx_fractal_noise_float,
    mx_noise_float,
    normalLocal,
    positionLocal,
    saturate,
    sin,
    smoothstep,
    step,
    time,
    vec3,
} from "three/tsl";
import type { ThingLook, ThingPattern } from "./protocol";
import type { ShaderExpr, ShaderGraph } from "./shaderGraph";
import type { WorldStyle } from "./style";

export interface LookSpec {
    look: Exclude<ThingLook, "style">;
    color: string;
    color2: string;
    pattern: ThingPattern;
    wobble: number;
    strokes: number;
    opacity: number;
    doubleSided: boolean;
    shader?: ShaderGraph | null;
    palette?: string[];
    /**
     * The colour comes from the geometry, one per corner: a model built
     * from parts of different colours shares one surface.
     */
    perVertex?: boolean;
}

/** A thing's look, with "style" and missing values filled in from the world. */
export function resolveLook(
    props: {
        look?: ThingLook;
        color?: string;
        color2?: string;
        pattern?: ThingPattern;
        wobble?: number;
        opacity?: number;
        glow?: boolean;
        shader?: ShaderGraph | null;
    },
    style: WorldStyle,
    doubleSided = false
): LookSpec {
    const look =
        props.glow === true
            ? "glow"
            : !props.look || props.look === "style"
            ? style.look
            : props.look;
    const main = props.color || style.palette[0];
    const second =
        props.color2 ||
        style.palette.find((colour) => colour !== main) ||
        style.palette[1] ||
        main;
    return {
        look,
        color: main,
        color2: second,
        pattern: props.pattern || "none",
        wobble: props.wobble ?? style.wobble,
        strokes: style.strokes,
        opacity: props.opacity ?? 1,
        doubleSided,
        shader: props.shader || null,
        palette: props.shader ? style.palette : undefined,
    };
}

export function lookKey(spec: LookSpec) {
    return [
        spec.look,
        spec.color,
        spec.color2,
        spec.pattern,
        spec.wobble.toFixed(2),
        spec.strokes.toFixed(2),
        spec.opacity.toFixed(2),
        spec.doubleSided ? 2 : 1,
        spec.perVertex ? "v" : "",
        spec.shader
            ? JSON.stringify(spec.shader) + (spec.palette || []).join()
            : "",
    ].join("|");
}

type Node = any;

function patternColour(spec: LookSpec, p: Node): Node {
    const a = tslColor(new Color(spec.color));
    const b = tslColor(new Color(spec.color2));
    switch (spec.pattern) {
        case "noise":
            return mix(
                a,
                b,
                saturate(mx_fractal_noise_float(p.mul(2.2)).mul(0.6).add(0.5))
            );
        case "stripes":
            return mix(a, b, step(0.5, fract(p.y.mul(4))));
        case "dots": {
            const cell = fract(p.mul(4)).sub(0.5);
            return mix(b, a, smoothstep(0.22, 0.26, length(cell)));
        }
        case "swirl": {
            const angle = atan(p.z, p.x);
            const radius = length(vec3(p.x, 0, p.z));
            const wave = sin(
                angle
                    .mul(3)
                    .add(radius.mul(9))
                    .add(p.y.mul(2))
                    .sub(time.mul(0.6))
            );
            return mix(a, b, smoothstep(-0.25, 0.25, wave));
        }
        case "gradient":
            return mix(a, b, saturate(p.y.mul(0.5).add(0.5)));
        default:
            return a;
    }
}

/**
 * Brushwork laid over a colour: long streaks (noise stretched along one
 * axis, bent by a slower noise so they flow), darker in the troughs and
 * lighter on the crests, with a little of the second colour picked up in
 * the stroke, as wet paint does.
 */
function brushed(base: Node, spec: LookSpec, p: Node): Node {
    const flow = mx_noise_float(p.mul(0.9)).mul(1.6);
    const along = vec3(
        p.x.mul(3).add(flow),
        p.y.mul(16).add(flow.mul(3)),
        p.z.mul(3)
    );
    const streak = mx_noise_float(along).mul(0.5).add(0.5);
    const fine = mx_noise_float(along.mul(vec3(2.3, 3.1, 2.3)))
        .mul(0.5)
        .add(0.5);
    const amount = tslFloat(spec.strokes);
    const second = tslColor(new Color(spec.color2));
    const picked = mix(
        base,
        second,
        smoothstep(0.62, 0.9, fine).mul(0.35).mul(amount)
    );
    const light = mix(tslFloat(1), mix(0.78, 1.16, streak), amount);
    return picked.mul(light);
}

/** Builds the TSL node for one checked expression (shaderGraph.ts). */
function buildExpr(expr: ShaderExpr, spec: LookSpec): Node {
    if (typeof expr === "number") return tslFloat(expr);
    if (typeof expr === "string") {
        switch (expr) {
            case "time":
                return time;
            case "position":
                return positionLocal;
            case "world":
                return positionWorld;
            case "normal":
                return normalLocal;
            case "uv":
                return vec3(uv(), 0);
            case "fresnel":
                return saturate(
                    tslFloat(1).sub(abs(dot(normalView, positionViewDirection)))
                );
            case "color":
                return tslColor(new Color(spec.color));
            case "color2":
                return tslColor(new Color(spec.color2));
        }
        if (expr.startsWith("palette")) {
            const palette = spec.palette || [];
            const index = Number(expr.slice(7)) || 0;
            return tslColor(
                new Color(
                    palette[index % Math.max(1, palette.length)] || spec.color
                )
            );
        }
        return tslColor(new Color(expr));
    }
    const [op, ...inputs] = expr;
    const a: Node[] = inputs.map((input) => buildExpr(input, spec));
    const point = (node: Node) => vec3(node);
    switch (op) {
        case "add":
            return a.slice(1).reduce((sum, node) => sum.add(node), a[0]);
        case "mul":
            return a
                .slice(1)
                .reduce((product, node) => product.mul(node), a[0]);
        case "sub":
            return a[0].sub(a[1]);
        case "div":
            // Never by zero: the divisor keeps its sign and a floor.
            return a[0].div(
                sign(a[1])
                    .add(0.5)
                    .sign()
                    .mul(max(abs(a[1]), 1e-4))
            );
        case "min":
            return min(a[0], a[1]);
        case "max":
            return max(a[0], a[1]);
        case "mix":
            return mix(a[0], a[1], a[2]);
        case "clamp":
            return clamp(a[0], a[1], a[2]);
        case "saturate":
            return saturate(a[0]);
        case "abs":
            return abs(a[0]);
        case "sign":
            return sign(a[0]);
        case "floor":
            return floor(a[0]);
        case "fract":
            return fract(a[0]);
        case "sin":
            return sin(a[0]);
        case "cos":
            return cos(a[0]);
        case "pow":
            return pow(abs(a[0]), a[1]);
        case "sqrt":
            return sqrt(abs(a[0]));
        case "step":
            return step(a[0], a[1]);
        case "smoothstep":
            return smoothstep(a[0], a[1], a[2]);
        case "length":
            return length(point(a[0]));
        case "distance":
            return length(point(a[0]).sub(point(a[1])));
        case "dot":
            return dot(point(a[0]), point(a[1]));
        case "normalize":
            return normalize(point(a[0]).add(1e-6));
        case "vec3":
            return vec3(a[0], a[1], a[2]);
        case "x":
            return point(a[0]).x;
        case "y":
            return point(a[0]).y;
        case "z":
            return point(a[0]).z;
        case "noise":
            return mx_noise_float(point(a[0])).mul(0.5).add(0.5);
        case "fbm":
            return saturate(
                mx_fractal_noise_float(point(a[0])).mul(0.6).add(0.5)
            );
        case "cells":
            return saturate(mx_worley_noise_float(point(a[0])));
        case "hue":
            return hue(point(a[0]), a[1].mul(Math.PI * 2));
        default:
            return tslFloat(0);
    }
}

export function createLookMaterial(spec: LookSpec): NodeMaterial {
    const p = positionLocal;
    let colour = spec.perVertex
        ? attribute("color", "vec3")
        : patternColour(spec, p);
    const shader = spec.shader;
    if (shader?.color != null) colour = vec3(buildExpr(shader.color, spec));
    let material: NodeMaterial;
    switch (spec.look) {
        case "painted":
            colour = brushed(colour, spec, p);
            material = new MeshStandardNodeMaterial({
                roughness: 0.92,
                metalness: 0,
            });
            break;
        case "toon":
            material = new MeshToonNodeMaterial();
            break;
        case "glossy":
            material = new MeshPhysicalNodeMaterial({
                roughness: 0.18,
                clearcoat: 1,
                clearcoatRoughness: 0.08,
            });
            break;
        case "metal":
            material = new MeshStandardNodeMaterial({
                roughness: 0.28,
                metalness: 1,
            });
            break;
        case "glow": {
            const glow = new MeshStandardNodeMaterial({ roughness: 0.5 });
            glow.emissiveNode = colour.mul(1.2);
            material = glow;
            break;
        }
        case "flat":
            material = new MeshBasicNodeMaterial();
            break;
        default:
            material = new MeshStandardNodeMaterial({
                roughness: 0.7,
                metalness: 0.02,
            });
    }
    material.colorNode = colour;
    let seeThrough = spec.opacity < 1;
    if (shader?.glow != null && "emissiveNode" in material)
        (material as any).emissiveNode = vec3(buildExpr(shader.glow, spec));
    if (shader?.opacity != null) {
        material.opacityNode = saturate(buildExpr(shader.opacity, spec)).mul(
            spec.opacity
        );
        seeThrough = true;
    }
    if (shader?.offset != null) {
        const offset = clamp(buildExpr(shader.offset, spec), -0.5, 0.5);
        material.positionNode = p.add(normalLocal.mul(offset));
    } else if (spec.wobble > 0) {
        const sway = sin(
            time.mul(2.2).add(p.y.mul(5)).add(p.x.mul(3)).add(abs(p.z).mul(2))
        ).mul(spec.wobble * 0.045);
        material.positionNode = p.add(normalLocal.mul(sway));
    }
    material.side = spec.doubleSided ? DoubleSide : FrontSide;
    material.opacity = spec.opacity;
    material.transparent = seeThrough;
    material.name = `world-script:${spec.look}`;
    return material;
}

/** Dark inverted hull drawn behind a shape: a drawn outline. */
export function createOutlineMaterial(): NodeMaterial {
    const material = new MeshBasicNodeMaterial();
    material.colorNode = tslColor(new Color("#141418"));
    material.positionNode = positionLocal.add(normalLocal.mul(0.025));
    material.side = 1; // BackSide
    material.name = "world-script:outline";
    return material;
}

/** Different surfaces one world's scripts can have at once. */
export const MAX_LOOKS = 48;

/** Materials shared by key, freed when the last user lets go. */
export function createLookCache() {
    const entries = new Map<
        string,
        { material: NodeMaterial; users: number }
    >();
    return {
        take(spec: LookSpec) {
            const key = lookKey(spec);
            let entry = entries.get(key);
            if (!entry && entries.size >= MAX_LOOKS) {
                // Too many different surfaces: reuse the plain one for this
                // colour instead of compiling yet another shader.
                spec = { ...spec, shader: null, pattern: "none", wobble: 0 };
                return this.takePlain(spec);
            }
            if (!entry) {
                entry = { material: createLookMaterial(spec), users: 0 };
                entries.set(key, entry);
            }
            entry.users++;
            return { key, material: entry.material };
        },
        takePlain(spec: LookSpec) {
            const key = "plain|" + spec.look;
            let entry = entries.get(key);
            if (!entry) {
                entry = { material: createLookMaterial(spec), users: 0 };
                entries.set(key, entry);
            }
            entry.users++;
            return { key, material: entry.material };
        },
        release(key: string) {
            const entry = entries.get(key);
            if (!entry) return;
            if (--entry.users <= 0) {
                entry.material.dispose();
                entries.delete(key);
            }
        },
        dispose() {
            entries.forEach((entry) => entry.material.dispose());
            entries.clear();
        },
        get size() {
            return entries.size;
        },
    };
}
