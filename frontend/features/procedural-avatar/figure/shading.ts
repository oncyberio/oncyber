import * as THREE from "three/webgpu";
import {
    Discard,
    Fn,
    If,
    Loop,
    abs,
    atan,
    attribute,
    cameraProjectionMatrix,
    clamp,
    cross,
    dFdx,
    dFdy,
    dot,
    exp,
    float as f32,
    floor,
    fract,
    fwidth,
    // As i32: the browser build leaves a bare `int` unbound.
    int as i32,
    ivec2,
    length,
    max,
    min,
    mix,
    normalGeometry,
    normalView,
    normalWorld,
    normalize,
    positionGeometry,
    positionLocal,
    positionView,
    pow,
    saturate,
    select,
    sin,
    smoothstep,
    texture,
    uniform,
    uniformArray,
    uv,
    vec2,
    vec3,
    vec4,
} from "three/tsl";
import { markCrowdMaterial } from "../../lobby/webgpu/crowdMaterial";
import { partId } from "./format";
export { CLOTH_KINDS } from "./outfitFiles";
import type { ClothStripes } from "./outfitFiles";
import { LOOK_CELLS, createFigureLooks, type FigureLooks } from "./looks";
import {
    RIM_POINTS,
    type BrowLine,
    type EarFrame,
    type OpeningFrame,
    type V3,
} from "./shape";
import type { FigureStyle } from "./style";

/**
 * How a figure is drawn. Nothing is looked up in a picture: the skin is
 * lit from what is stored on its vertices, and every feature (irises, lid
 * lines, brows, lips, underwear) is a shape worked out per pixel from
 * where the point is on the resting figure, so it stays sharp at any size
 * and follows the face as it moves.
 *
 * What a shader needs to know of a character comes two ways. Its shape
 * (where its eyes, mouth, brows and ears are) is measured once on the
 * figure and is the same for everything drawn with these materials. Its
 * look (colours, line weights) is a row of a small table of numbers, see
 * looks.ts, so that figures of one shape can be drawn together, each
 * with a look of its own.
 *
 * The light is the same wherever the figure stands and whichever way it is
 * seen from: a broad key from over the viewer's left shoulder, a cool fill
 * from the right, light from behind on its edges, sky above and warm floor
 * below.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Node = any;

/** Where a figure's features are, measured on the figure itself. */
export interface FigureFrames {
    /** Which way the figure faces along z in its own space: +1 or -1. */
    forwardZ: number;
    /** The sign of x on the figure's left. */
    leftSign: number;
    eyes: { left: OpeningFrame; right: OpeningFrame };
    mouth: OpeningFrame;
    brows: { left: BrowLine; right: BrowLine };
    /** Corner to corner of an eye, and of the mouth, seen from the front. */
    eyeWidth: number;
    mouthWidth: number;
    /** Each eye's inner corner, and its own width. */
    corners: Record<"left" | "right", { x: number; y: number; width: number }>;
    /** The bowl of each ear, where the style has shaped them. */
    ears: { left: EarFrame; right: EarFrame } | null;
    /** Middle of each cheek: [out from the middle of the face, y, z]. */
    cheek: V3;
    /** The tip of the nose. */
    nose: V3;
    /** Height of the hip joint off the floor, and how far forward it is. */
    hips: number;
    hipsZ: number;
}

/** Most points a brow's line can have. */
export const BROW_KNOTS = 6;
/** How far below a brow its shadow reaches, in eye widths. */
export const BROW_SHADOW_REACH = 0.2;

// Light directions, as the viewer sees them: x to the right, y up, z
// towards the viewer.
const KEY = normalize(vec3(-0.42, 0.56, 0.72));
const FILL = normalize(vec3(0.82, 0.02, 0.57));
const BEHIND = normalize(vec3(0.55, 0.4, -0.73));
const KEY_LIGHT = vec3(1.0, 0.97, 0.93);
const FILL_LIGHT = vec3(0.8, 0.86, 1.0);
const SKY = vec3(0.93, 0.93, 1.0);
const FLOOR = vec3(0.97, 0.87, 0.84);

const linear = (hex: string) => {
    const c = new THREE.Color(hex);
    return new THREE.Vector3(c.r, c.g, c.b);
};
const v3 = (v: readonly number[]) => new THREE.Vector3(v[0], v[1], v[2]);

/** A figure's measurements as values a shader reads: its shape. */
function shapeUniforms(style: FigureStyle, frames: FigureFrames) {
    const eyes = [frames.eyes.left, frames.eyes.right];
    const openings = [...eyes, frames.mouth];
    // Each rim, closed: its first point again at the end.
    const rims = openings.flatMap((o) =>
        [...o.rim, o.rim[0]].map((p) => new THREE.Vector2(p[0], p[1]))
    );
    const brows = [frames.brows.left, frames.brows.right];
    const knots = brows.flatMap((brow) =>
        Array.from({ length: BROW_KNOTS }, (_, i) => {
            const k = brow.knots[Math.min(i, brow.knots.length - 1)];
            return new THREE.Vector3(k.along, k.up, k.width / 2);
        })
    );
    const ears = [frames.ears?.left, frames.ears?.right];
    return {
        cheek: uniform(v3(frames.cheek)),
        nose: uniform(v3(frames.nose)),
        leftSign: uniform(frames.leftSign),
        forwardZ: uniform(frames.forwardZ),
        // Per opening: where it is, and its two axes.
        centres: uniformArray(openings.map((o) => v3(o.centre))),
        across: uniformArray(openings.map((o) => v3(o.across))),
        ups: uniformArray(openings.map((o) => v3(o.up))),
        rims: uniformArray(rims),
        eyeSpan: uniform(frames.eyeWidth),
        // Where light that entered the eye from the key's side comes out
        // again, in the iris's own axes: across from it and below.
        irisGlow: uniform(new THREE.Vector2(0.55 * frames.forwardZ, -0.83)),
        // Each ear's bowl; with no ears shaped, somewhere nothing is.
        earCentre: uniformArray(
            ears.map((e) => (e ? v3(e.centre) : new THREE.Vector3(0, -9, 0)))
        ),
        earLong: uniformArray(
            ears.map((e) => (e ? v3(e.long) : new THREE.Vector3()))
        ),
        earShort: uniformArray(
            ears.map((e) => (e ? v3(e.short) : new THREE.Vector3()))
        ),
        earOut: uniformArray(
            ears.map((e) => (e ? v3(e.out) : new THREE.Vector3()))
        ),
        earShade: uniform(
            frames.ears
                ? Math.min(1, (style.shape.ears?.cup ?? 0) / 0.3) * 0.5
                : 0
        ),
        browKnots: uniformArray(knots),
        browCount: uniform(
            new THREE.Vector2(
                Math.min(BROW_KNOTS, brows[0].knots.length),
                Math.min(BROW_KNOTS, brows[1].knots.length)
            )
        ),
        browSize: uniform(
            new THREE.Vector4(
                brows[0].length,
                brows[0].height,
                brows[1].length,
                brows[1].height
            )
        ),
        mouthSpan: uniform(frames.mouthWidth),
        hipsZ: uniform(frames.hipsZ),
    };
}

/**
 * One cell of a table kept in a texture, by its column and row: whole
 * numbers, so nothing of how a texture is placed on a surface applies,
 * and nothing about it changes from frame to frame.
 */
export function tableCell(table: Node, column: Node | number, row: Node): Node {
    const cell = table.load(
        ivec2(typeof column === "number" ? i32(column) : column, row)
    );
    cell.updateMatrix = false;
    cell.updateType = "none";
    return cell;
}

/**
 * A look as values a shader reads: one row of a table of looks. Each cell
 * is fetched once wherever it is used, by its place in the table.
 */
function lookNodes(looks: FigureLooks, row: Node) {
    const table = texture(looks.texture);
    const cell = (column: Node | number): Node => tableCell(table, column, row);
    const cells = LOOK_CELLS.map((_, column) => cell(column));
    const triple = (name: (typeof LOOK_CELLS)[number][0]): Node =>
        cells[LOOK_CELLS.findIndex((c) => c[0] === name)].xyz;
    const number = (name: (typeof LOOK_CELLS)[number][1]): Node =>
        cells[LOOK_CELLS.findIndex((c) => c[1] === name)].w;
    const firstGlint = LOOK_CELLS.findIndex((c) => c[0] === "glint0");
    return {
        tone: triple("tone"),
        scatter: triple("scatter"),
        blush: triple("blush"),
        flush: number("flush"),
        sheen: number("sheen"),
        white: triple("white"),
        iris: triple("iris"),
        irisLight: triple("irisLight"),
        pupil: triple("pupil"),
        irisRadius: number("irisRadius"),
        pupilSize: number("pupilSize"),
        // The catchlights follow one another in the table.
        glints: {
            element: (index: Node): Node =>
                cell(i32(firstGlint).add(index)).xyz,
        },
        eyeShade: number("eyeShade"),
        glintGlow: number("glintGlow"),
        lid: triple("lid"),
        lidUpper: triple("lidUpper"),
        lidLower: triple("lidLower"),
        wing: vec2(number("wingLength"), number("wingLift")),
        crease: vec2(number("creaseHeight"), number("creaseWidth")),
        brow: triple("brow"),
        browShadow: number("browShadow"),
        mouthLine: triple("mouthLine"),
        mouthWidth: number("mouthWidth"),
        lip: triple("lip"),
        lipTint: number("lipTint"),
        cloth: triple("cloth"),
        band: triple("band"),
        waist: number("waist"),
        hem: number("hem"),
    };
}

type Uniforms = ReturnType<typeof shapeUniforms> & ReturnType<typeof lookNodes>;

/** What the lighting needs to know about a pixel. */
const surface = () => {
    const n = normalize(normalView).toVar();
    const v = normalize(positionView.negate()).toVar();
    return {
        n,
        v,
        upward: normalize(normalWorld).y.toVar(),
        ndl: dot(n, KEY).toVar(),
        fresnel: pow(saturate(f32(1).sub(dot(n, v))), 3).toVar(),
        // How much of the figure a pixel covers, for soft edges on ink.
        pixel: length(fwidth(positionGeometry)).mul(0.7).toVar(),
    };
};
type Surface = ReturnType<typeof surface>;

/**
 * Skin in the light. The edge of the key light is not a line: light runs
 * on under the skin, red furthest, and further still where the surface
 * turns sharply, so shadows begin warm. Creases keep their red too, and
 * flesh thin enough to see through glows.
 */
function litSkin(u: Uniforms, s: Surface, albedo: Node, bake: Node): Node {
    const open = bake.x;
    const sky = bake.y;
    const round = bake.z.sub(0.5).mul(2);
    const thin = bake.w;
    const reach = u.scatter
        .mul(clamp(round.mul(0.8).add(0.7), 0.35, 1.5))
        .mul(0.45);
    const key = smoothstep(reach.negate(), vec3(1), vec3(s.ndl)).toVar();
    const creases = pow(vec3(open), vec3(0.85, 1.1, 1.2)).toVar();
    const fill = pow(saturate(dot(s.n, FILL).mul(0.5).add(0.5)), 2);
    // What stands in the key's way: red gets round it a little.
    const shadowed = pow(vec3(sky), vec3(0.9, 1.05, 1.1)).mul(
        mix(f32(1), open, 0.35)
    );
    // Under something, less comes back from round about as well.
    const sheltered = mix(f32(1), sky, 0.3);
    const light = key
        .mul(KEY_LIGHT)
        .mul(shadowed)
        .mul(0.64)
        .add(
            mix(FLOOR, SKY, s.upward.mul(0.5).add(0.5))
                .mul(creases)
                .mul(sheltered)
                .mul(0.4)
        )
        .add(FILL_LIGHT.mul(fill).mul(open).mul(0.14));
    const halfway = normalize(KEY.add(s.v));
    const nh = saturate(dot(s.n, halfway));
    const shine = pow(nh, 48)
        .mul(0.3)
        .add(pow(nh, 9).mul(0.07))
        .mul(u.sheen)
        .mul(open)
        .mul(key.x);
    const edge = s.fresnel
        .mul(saturate(dot(s.n, BEHIND).mul(0.5).add(0.6)))
        .mul(open);
    const glow = u.scatter
        .mul(thin)
        .mul(f32(0.25).add(f32(1).sub(key.x).mul(0.55)))
        .mul(0.3);
    // Turning away from the viewer the skin deepens, as under a broad
    // light from the front.
    const facing = smoothstep(0, 0.8, dot(s.n, s.v));
    const turned = mix(vec3(0.76, 0.7, 0.71), vec3(1), facing);
    return albedo
        .mul(light.mul(turned).add(edge.mul(0.12)).add(glow))
        .add(vec3(shine))
        .add(SKY.mul(edge).mul(0.04));
}

/** Anything matte in the same light: cloth, the inside of the mouth. */
function litMatte(
    s: { n: Node; upward: Node; ndl: Node; fresnel: Node },
    albedo: Node,
    open: Node
): Node {
    const key = smoothstep(-0.25, 1, s.ndl);
    const fill = pow(saturate(dot(s.n, FILL).mul(0.5).add(0.5)), 2);
    const light = KEY_LIGHT.mul(key)
        .mul(mix(f32(1), open, 0.5))
        .mul(0.6)
        .add(mix(FLOOR, SKY, s.upward.mul(0.5).add(0.5)).mul(open).mul(0.43))
        .add(FILL_LIGHT.mul(fill).mul(open).mul(0.15));
    return albedo.mul(light.add(s.fresnel.mul(0.1)));
}

/** A number from 0 to 1 that looks unrelated to the one it is made from. */
const hash = (x: Node) => fract(sin(x.mul(12.9898)).mul(43758.5453));

/** How much of a pixel lies within `width` of an edge `distance` away. */
const cover = (distance: Node, width: Node, pixel: Node) =>
    saturate(width.sub(distance).div(max(pixel, 1e-6)).add(0.5)).mul(
        smoothstep(0, 0.00005, width)
    );

/** A point in an opening's own flat frame, and how far in front of it. */
const inFrame = (u: Uniforms, p: Node, which: Node) => {
    const d = p.sub(u.centres.element(which)).toVar();
    return vec2(
        dot(d, u.across.element(which)),
        dot(d, u.ups.element(which))
    ).toVar();
};

/**
 * Distances from a point to an opening's upper and lower edges, and how
 * far along each the nearest point is (0 at the first corner, 1 at the
 * far one).
 */
function rimDistances(u: Uniforms, q: Node, which: Node) {
    const half = RIM_POINTS / 2;
    const base = which.mul(RIM_POINTS + 1);
    const upper = f32(1).toVar();
    const lower = f32(1).toVar();
    const along = f32(0).toVar();
    const alongLower = f32(0).toVar();
    // Height of the nearest point of the upper edge.
    const edgeY = f32(0).toVar();
    // -1 inside the opening, 1 outside: flips at every edge crossed.
    const outside = f32(1).toVar();
    Loop(RIM_POINTS, ({ i }: { i: Node }) => {
        const a = u.rims.element(base.add(i));
        const b = u.rims.element(base.add(i).add(1));
        const pa = q.sub(a);
        const ba = b.sub(a);
        If(
            a.y
                .greaterThan(q.y)
                .notEqual(b.y.greaterThan(q.y))
                .and(pa.x.lessThan(ba.x.mul(pa.y).div(ba.y))),
            () => {
                outside.assign(outside.negate());
            }
        );
        const h = clamp(dot(pa, ba).div(max(dot(ba, ba), 1e-12)), 0, 1);
        const d = length(pa.sub(ba.mul(h)));
        If(i.lessThan(half), () => {
            If(d.lessThan(upper), () => {
                upper.assign(d);
                along.assign(f32(i).add(h).div(half));
                edgeY.assign(a.y.add(ba.y.mul(h)));
            });
        }).Else(() => {
            If(d.lessThan(lower), () => {
                lower.assign(d);
                alongLower.assign(
                    f32(1).sub(f32(i).sub(half).add(h).div(half))
                );
            });
        });
    });
    return { upper, lower, along, alongLower, edgeY, outside };
}

/**
 * The lines drawn round an eye, at a point in its frame: along the upper
 * lid, along the lower, a flick past the outer corner and the fold above.
 * `over` is how far the lines reach in over the eye itself, as a part of
 * their thickness: skin stops at the lid's edge, the ink's own pieces
 * carry them on across it.
 */
function lidInk(
    u: Uniforms,
    q: Node,
    which: Node,
    rim: ReturnType<typeof rimDistances>,
    pixel: Node,
    over: number
) {
    const half = RIM_POINTS / 2;
    const base = which.mul(RIM_POINTS + 1);
    const at = (i: number) => u.rims.element(base.add(i));
    const inner = at(0);
    const outer = at(half);
    // Drawn with a soft edge, as lashes are.
    pixel = pixel.add(u.lidUpper.y.mul(0.14));
    // Which way each edge runs as it leaves and reaches the corners.
    const upperOut = normalize(at(1).sub(inner));
    const upperIn = normalize(outer.sub(at(half - 1)));
    const lowerOut = normalize(at(half + 1).sub(outer));
    const lowerIn = normalize(at(RIM_POINTS).sub(at(RIM_POINTS - 1)));
    /** 1 past a corner along `way`, 0 before it: lines end square. */
    const past = (corner: Node, way: Node) =>
        saturate(dot(q.sub(corner), way).div(max(pixel, 1e-6)).add(0.5));
    // How far a line reaches in over the eye: not at all at the corners,
    // where it would hang down inside them.
    const band = (distance: Node, width: Node, along: Node) =>
        cover(distance.mul(rim.outside), width, pixel).mul(
            over
                ? saturate(
                      distance
                          .mul(rim.outside)
                          .add(
                              width
                                  .mul(over)
                                  .add(min(width, 0.0004))
                                  .mul(smoothstep(0, 0.12, along))
                                  .mul(smoothstep(1, 0.88, along))
                          )
                          .div(max(pixel, 1e-6))
                          .add(0.5)
                  )
                : f32(1)
        );
    const upper = band(rim.upper, alongEdge(u.lidUpper, rim.along), rim.along)
        .mul(past(inner, upperOut))
        .mul(f32(1).sub(past(outer, upperIn)));
    // The lower lid is an edge more than a line: drawn fainter.
    const lower = band(
        rim.lower,
        alongEdge(u.lidLower, rim.alongLower),
        rim.alongLower
    )
        .mul(past(outer, lowerOut))
        .mul(f32(1).sub(past(inner, lowerIn)))
        .mul(0.5);
    // The flick: the upper line carried on past the corner, running out
    // to a point.
    const up = vec2(upperIn.y.negate(), upperIn.x);
    const outward = up.mul(select(up.y.lessThan(0), f32(-1), f32(1)));
    const from = outer.add(outward.mul(u.lidUpper.z.mul(0.5)));
    const run = upperIn.mul(u.wing.x).add(outward.mul(u.wing.y));
    const pf = q.sub(from);
    const h = clamp(dot(pf, run).div(max(dot(run, run), 1e-12)), 0, 1);
    const wing = cover(
        length(pf.sub(run.mul(h))),
        u.lidUpper.z.mul(0.5).mul(f32(1).sub(h)),
        pixel
    ).mul(smoothstep(0, 0.0005, u.wing.x));
    // The fold above the lid.
    const fold = cover(abs(rim.upper.sub(u.crease.x)), u.crease.y, pixel)
        .mul(smoothstep(0.08, 0.3, rim.along))
        .mul(smoothstep(0.98, 0.7, rim.along))
        .mul(smoothstep(0, 0.0002, u.crease.y))
        .mul(rim.outside.mul(0.5).add(0.5))
        .mul(0.45);
    return max(max(upper, lower), max(wing, fold));
}

/** A width that changes along an edge: at its start, middle and end. */
const alongEdge = (widths: Node, t: Node) =>
    mix(
        mix(widths.x, widths.y, smoothstep(0, 0.5, t)),
        widths.z,
        smoothstep(0.5, 1, t)
    );

/** The face: skin with its drawn features, eye whites, the mouth. */
function faceColour(u: Uniforms) {
    return Fn(() => {
        const p = positionGeometry;
        const bake = attribute("bake", "vec4");
        const part = attribute("part", "vec4").x.mul(255);
        const s = surface();
        const colour = vec3(0).toVar();
        // Which eye the point is nearer: 0 the left, 1 the right.
        const which = select(
            p.x.mul(u.leftSign).greaterThan(0),
            i32(0),
            i32(1)
        );

        If(part.lessThan(partId("skin") + 0.5), () => {
            const albedo = vec3(u.tone).toVar();
            const ink = f32(0).toVar();
            const round = bake.z.sub(0.5).mul(2);

            // Warmth: cheeks, and wherever the flesh comes to a point.
            const cheek = vec3(abs(p.x), p.y, p.z).sub(u.cheek);
            const nose = p.sub(u.nose);
            const flushed = max(
                max(
                    smoothstep(0.038, 0.004, length(cheek)),
                    smoothstep(0.024, 0.002, length(nose)).mul(0.8)
                ),
                smoothstep(0.45, 1, round).mul(0.35)
            ).mul(u.flush);
            albedo.assign(mix(albedo, u.blush, flushed));

            // What the nose keeps the light off: just under its tip.
            const under = vec3(nose.x.mul(0.55), nose.y.add(0.0075), nose.z);
            albedo.assign(
                mix(
                    albedo,
                    albedo.mul(vec3(0.66, 0.56, 0.56)),
                    smoothstep(0.011, 0.002, length(under)).mul(0.55)
                )
            );

            // In the bowl of each ear, on the side that shows: deeper.
            const fromEar = p.sub(u.earCentre.element(which));
            const inBowl = f32(1)
                .sub(
                    smoothstep(
                        0.2,
                        0.85,
                        length(
                            vec2(
                                dot(fromEar, u.earLong.element(which)),
                                dot(fromEar, u.earShort.element(which))
                            )
                        )
                    )
                )
                .mul(
                    smoothstep(
                        0,
                        0.5,
                        dot(normalGeometry, u.earOut.element(which))
                    )
                )
                .mul(smoothstep(0.03, 0.02, length(fromEar)));
            albedo.assign(
                mix(
                    albedo,
                    albedo.mul(vec3(0.74, 0.58, 0.56)),
                    inBowl.mul(u.earShade)
                )
            );

            // Round each eye.
            const q = inFrame(u, p, which);
            If(length(q).lessThan(0.04), () => {
                const rim = rimDistances(u, q, which);
                // The socket. Deepest by the inner corner, where the
                // brow and the bridge of the nose shut the light out; a
                // soft fold under the lower lid; a little all round.
                const span = u.eyeSpan;
                const corner = u.rims.element(which.mul(RIM_POINTS + 1));
                const nook = smoothstep(
                    span.mul(0.42),
                    span.mul(0.04),
                    length(
                        q.sub(corner).sub(vec2(span.mul(-0.04), span.mul(0.1)))
                    )
                );
                const fold = exp(rim.lower.div(span.mul(-0.07))).mul(
                    smoothstep(span.mul(0.005), span.mul(0.03), rim.lower)
                );
                const around = exp(
                    min(rim.upper, rim.lower).div(span.mul(-0.1))
                );
                albedo.assign(
                    mix(
                        albedo,
                        albedo.mul(vec3(0.72, 0.56, 0.54)),
                        saturate(
                            nook
                                .mul(0.65)
                                .add(fold.mul(0.1))
                                .add(around.mul(0.12))
                        )
                    )
                );
                ink.assign(lidInk(u, q, which, rim, s.pixel, 0));
            });

            // Round the mouth.
            const m = inFrame(u, p, i32(2));
            If(length(m).lessThan(0.05), () => {
                const rim = rimDistances(u, m, i32(2));
                const nearest = min(rim.upper, rim.lower);
                const t = select(
                    rim.upper.lessThan(rim.lower),
                    rim.along,
                    rim.alongLower
                );
                const middle = sin(t.mul(3.14159));
                // The lips: a shallow one above the line, a fuller below.
                const above = m.y.greaterThan(rim.edgeY);
                const depth = select(above, f32(0.0034), f32(0.0052)).mul(
                    middle.mul(0.75).add(0.25)
                );
                const lips = smoothstep(depth, depth.mul(0.35), nearest)
                    .mul(smoothstep(0.02, 0.2, t))
                    .mul(smoothstep(0.98, 0.8, t));
                albedo.assign(mix(albedo, u.lip, lips.mul(u.lipTint)));
                // The lower lip's own shadow, below it.
                const below = vec2(
                    m.x,
                    m.y.sub(rim.edgeY).add(u.mouthSpan.mul(0.27))
                );
                albedo.assign(
                    mix(
                        albedo,
                        albedo.mul(vec3(0.7, 0.6, 0.6)),
                        smoothstep(
                            1,
                            0.2,
                            length(
                                below.div(
                                    vec2(
                                        u.mouthSpan.mul(0.36),
                                        u.mouthSpan.mul(0.1)
                                    )
                                )
                            )
                        ).mul(0.4)
                    )
                );
                const line = cover(
                    nearest,
                    u.mouthWidth.mul(middle.mul(0.6).add(0.4)),
                    s.pixel
                );
                albedo.assign(mix(albedo, u.mouthLine, line.mul(0.9)));
            });

            colour.assign(litSkin(u, s, albedo, bake));
            colour.assign(mix(colour, u.lid, ink));
        })
            .ElseIf(part.lessThan(partId("eyeWhite") - 0.5), () => {
                // Inside the mouth: teeth, tongue, and the dark behind.
                const inward = saturate(
                    u.centres
                        .element(i32(2))
                        .z.sub(p.z)
                        .mul(u.forwardZ)
                        .div(0.03)
                );
                const flesh = select(
                    part.lessThan(partId("teeth") + 0.5),
                    vec3(0.93, 0.91, 0.87),
                    select(
                        part.lessThan(partId("tongue") + 0.5),
                        vec3(0.78, 0.3, 0.3),
                        vec3(0.32, 0.09, 0.09)
                    )
                );
                colour.assign(
                    litMatte(s, flesh, f32(1)).mul(
                        mix(f32(1), f32(0.45), inward)
                    )
                );
            })
            .Else(() => {
                // The white of the eye. It is a ball behind the lids,
                // not paper: shaded under the upper lid and into both
                // corners, a little warm where it meets the lower lid.
                const q = inFrame(u, p, which);
                const rim = rimDistances(u, q, which);
                const span = u.eyeSpan;
                const lidShadow = smoothstep(span.mul(0.2), 0, rim.upper)
                    .pow(1.25)
                    .mul(u.eyeShade);
                // The inner corner lies in the shadow of the brow and the
                // nose, and takes the skin's colour with it.
                const base = which.mul(RIM_POINTS + 1);
                const inner = smoothstep(
                    span.mul(0.42),
                    span.mul(0.02),
                    length(q.sub(u.rims.element(base)))
                );
                const outer = smoothstep(
                    span.mul(0.16),
                    0,
                    length(q.sub(u.rims.element(base.add(RIM_POINTS / 2))))
                );
                const white = u.white
                    .mul(mix(vec3(1), vec3(0.6, 0.58, 0.6), lidShadow))
                    .mul(mix(vec3(1), vec3(0.72, 0.62, 0.63), inner.mul(0.9)))
                    .mul(mix(vec3(1), vec3(0.8, 0.72, 0.72), outer.mul(0.5)));
                colour.assign(white);
            });
        return colour;
    })();
}

/** The body: skin, and underwear between the waist and the hem. */
function bodyColour(u: Uniforms) {
    return Fn(() => {
        const p = positionGeometry;
        const bake = attribute("bake", "vec4");
        const s = surface();
        const round = bake.z.sub(0.5).mul(2);
        const albedo = vec3(u.tone).toVar();
        albedo.assign(
            mix(
                albedo,
                u.blush,
                smoothstep(0.45, 1, round).mul(0.35).mul(u.flush)
            )
        );
        const colour = litSkin(u, s, albedo, bake).toVar();
        // Underwear: a band of the resting figure, by height. It sits
        // higher behind than in front.
        const pixel = max(fwidth(p.y), 1e-6);
        const behind = smoothstep(
            -0.07,
            0.08,
            u.hipsZ.sub(p.z).mul(u.forwardZ)
        );
        const waist = u.waist.add(behind.mul(0.035));
        const inside = saturate(waist.sub(p.y).div(pixel).add(0.5)).mul(
            saturate(p.y.sub(u.hem).div(pixel).add(0.5))
        );
        // Its hems: the waistband, and a narrow one round each leg.
        const waistband = saturate(
            p.y.sub(waist.sub(0.024)).div(pixel).add(0.5)
        );
        const legband = saturate(u.hem.add(0.007).sub(p.y).div(pixel).add(0.5));
        const ribs = sin(p.x.mul(2400))
            .mul(0.5)
            .add(0.5)
            .mul(0.08)
            .mul(waistband);
        const cloth = mix(u.cloth, u.band, max(waistband, legband)).mul(
            f32(1).sub(ribs)
        );
        // Skin is a little darker right beside the cloth's edge.
        const beside = max(
            exp(abs(p.y.sub(waist)).div(-0.002)),
            exp(abs(p.y.sub(u.hem)).div(-0.002))
        ).mul(0.16);
        colour.assign(
            mix(
                colour.mul(f32(1).sub(beside)),
                litMatte(s, cloth, bake.x.mul(0.5).add(0.5)),
                inside
            )
        );
        return colour;
    })();
}

/** The face's ink: irises and brows, with soft edges, over what is behind. */
function inkColour(u: Uniforms) {
    return Fn(() => {
        const p = positionGeometry;
        const part = attribute("part", "vec4").x.mul(255);
        const at = uv();
        const pixel = length(fwidth(p)).mul(0.7).toVar();
        const out = vec4(0).toVar();
        // The piece's own frame as the viewer sees it: the directions its
        // two coordinates grow in, and the way it faces. Worked out from
        // how those coordinates change across the screen, and here, before
        // anything is decided per part: rates of change may only be asked
        // for where every pixel takes the same path.
        const view = positionView;
        const [vx, vy, ax, ay] = [dFdx(view), dFdy(view), dFdx(at), dFdy(at)];
        const area = ax.x.mul(ay.y).sub(ax.y.mul(ay.x));
        const safe = select(abs(area).greaterThan(1e-20), area, f32(1));
        const alongX = normalize(
            vx.mul(ay.y).sub(vy.mul(ax.y)).div(safe)
        ).toVar();
        const alongY = normalize(
            vy.mul(ax.x).sub(vx.mul(ay.x)).div(safe)
        ).toVar();
        const eye = normalize(view.negate()).toVar();
        const facing = normalize(cross(alongX, alongY)).toVar();
        const toViewer = facing
            .mul(select(dot(facing, eye).lessThan(0), f32(-1), f32(1)))
            .toVar();
        // For the iris: how far its middle slides behind its rim.
        const slide = vec2(dot(eye, alongX), dot(eye, alongY))
            .div(max(abs(dot(eye, facing)), 0.4))
            .toVar();
        // 0 on the figure's left, 1 on its right.
        const right = select(
            p.x.mul(u.leftSign).greaterThan(0),
            i32(0),
            i32(1)
        );

        If(abs(part.sub(partId("iris"))).lessThan(0.5), () => {
            const edge = pixel.div(u.irisRadius);
            const flat = at.div(u.irisRadius).toVar();
            const far = length(flat);
            // The iris lies in the eye, under the clear front of it: seen
            // from the side its middle slides away behind its rim.
            const sunk = f32(1).sub(smoothstep(0.5, 1, far)).mul(0.22);
            const c = flat.sub(slide.mul(sunk)).toVar();
            const r = length(c);
            const ring = smoothstep(u.pupilSize, 1, r);
            // Lighter round the pupil, darker out to the rim.
            const tint = mix(u.irisLight, u.iris, ring.pow(0.8)).toVar();
            // Fine threads running out from the pupil.
            const turn = atan(c.y, c.x);
            const threads = sin(turn.mul(41))
                .mul(sin(turn.mul(17).add(1.3)))
                .mul(0.5)
                .add(sin(turn.mul(97)).mul(0.25));
            tint.mulAssign(
                f32(1).add(
                    threads
                        .mul(0.16)
                        .mul(smoothstep(0, 0.3, ring))
                        .mul(smoothstep(1, 0.6, r))
                )
            );
            // Light that came in at the top comes out below, across from
            // the catchlight: a soft glow in the lower iris.
            const glow = saturate(dot(c.div(max(r, 1e-4)), u.irisGlow))
                .pow(1.5)
                .mul(smoothstep(u.pupilSize, u.pupilSize.add(0.25), r))
                .mul(smoothstep(1, 0.7, r));
            tint.assign(mix(tint, u.irisLight.mul(1.6), glow.mul(0.45)));
            // The dark ring where the iris ends.
            tint.mulAssign(mix(f32(1), f32(0.4), smoothstep(0.7, 1, r)));
            tint.assign(
                mix(
                    tint,
                    u.pupil,
                    f32(1).sub(
                        smoothstep(
                            u.pupilSize.sub(0.07),
                            u.pupilSize.add(0.03),
                            r
                        )
                    )
                )
            );
            // The upper lid's shadow, where the lid is.
            const q = inFrame(u, p, right);
            const rim = rimDistances(u, q, right);
            const lidShadow = smoothstep(u.eyeSpan.mul(0.2), 0, rim.upper)
                .pow(1.4)
                .mul(u.eyeShade);
            tint.mulAssign(mix(f32(1), f32(0.35), lidShadow));
            // The whole front of the eye is wet: a breath of sky on it.
            tint.addAssign(
                vec3(0.55, 0.62, 0.75).mul(
                    smoothstep(-0.2, 0.9, flat.y)
                        .mul(0.05)
                        .mul(f32(1).sub(lidShadow))
                )
            );
            // Catchlights, soft at the edge; the lid's shadow dims them.
            Loop(2, ({ i }: { i: Node }) => {
                const g = u.glints.element(i);
                const lit = smoothstep(
                    g.z,
                    g.z.mul(0.45),
                    length(flat.sub(g.xy))
                )
                    .mul(smoothstep(0, 0.00001, g.z))
                    .mul(mix(u.glintGlow, u.glintGlow.mul(0.5), lidShadow));
                tint.assign(mix(tint, u.white, lit));
            });
            out.assign(
                vec4(
                    tint,
                    f32(1).sub(
                        smoothstep(f32(0.95).sub(edge), f32(1).add(edge), far)
                    )
                )
            );
        })
            .ElseIf(abs(part.sub(partId("brow"))).lessThan(0.5), () => {
                const first = right.mul(BROW_KNOTS);
                const count = select(
                    right.equal(0),
                    u.browCount.x,
                    u.browCount.y
                );
                const size = select(
                    right.equal(0),
                    u.browSize.xy,
                    u.browSize.zw
                );
                // The line's middle and half its thickness, here along it.
                const k0 = u.browKnots.element(first);
                const middle = f32(k0.y).toVar();
                const halfWidth = f32(k0.z).toVar();
                const start = f32(k0.x).toVar();
                const end = f32(k0.x).toVar();
                Loop(BROW_KNOTS - 1, ({ i }: { i: Node }) => {
                    If(f32(i).add(1.5).lessThan(count), () => {
                        const a = u.browKnots.element(first.add(i));
                        const b = u.browKnots.element(first.add(i).add(1));
                        const t = saturate(
                            at.x.sub(a.x).div(max(b.x.sub(a.x), 1e-5))
                        );
                        If(at.x.greaterThanEqual(a.x), () => {
                            middle.assign(mix(a.y, b.y, t));
                            halfWidth.assign(mix(a.z, b.z, t));
                        });
                        end.assign(b.x);
                    });
                });
                // Metres along the brow, and up from its middle line.
                const run = at.x.mul(size.x).toVar();
                const up = at.y.sub(middle).mul(size.y).toVar();
                // Its hairs lie along it and climb towards its tail. Each
                // has a shade of its own, in pieces along its length.
                const hairWidth = u.eyeSpan.mul(0.0065);
                const hair = floor(up.sub(run.mul(0.32)).div(hairWidth));
                const piece = floor(
                    run.div(u.eyeSpan.mul(0.09)).add(hash(hair).mul(7))
                );
                const shade = hash(hair.add(piece.mul(57.3))).toVar();
                // Too far off to tell hairs apart, they are not drawn.
                const fine = smoothstep(
                    hairWidth.mul(2.5),
                    hairWidth.mul(0.6),
                    pixel
                ).toVar();
                // Its outline: rounded at the nose, run out to nothing at
                // the temple, and ragged with the ends of its hairs.
                const corner = min(halfWidth, u.eyeSpan.mul(0.035));
                const box = vec2(
                    start.mul(size.x).add(corner).sub(run),
                    abs(up).sub(halfWidth.sub(corner))
                );
                const outline = max(
                    length(max(box, 0))
                        .add(min(max(box.x, box.y), 0))
                        .sub(corner),
                    run.sub(end.mul(size.x))
                ).sub(shade.sub(0.5).mul(u.eyeSpan.mul(0.022)).mul(fine));
                const soft = pixel.add(u.eyeSpan.mul(0.006));
                const alpha = saturate(f32(0.5).sub(outline.div(soft)));
                // It stands off the face like a soft ridge: its upper side
                // turns up to the light and its lower side away from it.
                const across = clamp(up.div(max(halfWidth, 1e-5)), -1, 1);
                const n = normalize(
                    toViewer.add(alongY.mul(across.mul(0.8)))
                ).toVar();
                const tone = u.brow
                    .mul(mix(f32(1), mix(f32(0.8), f32(1.28), shade), fine))
                    // Darker where it meets the skin below.
                    .mul(mix(f32(0.72), f32(1), smoothstep(-1, -0.2, across)));
                const lit = litMatte(
                    {
                        n,
                        upward: n.y,
                        ndl: dot(n, KEY),
                        fresnel: pow(saturate(f32(1).sub(dot(n, eye))), 3),
                    },
                    tone,
                    f32(1)
                );
                // A sheen runs along the hairs where they turn to the light.
                const sheen = pow(saturate(dot(n, normalize(KEY.add(eye)))), 10)
                    .mul(mix(f32(1), shade.mul(1.6), fine))
                    .mul(0.11);
                const colour = lit.add(vec3(0.62, 0.5, 0.46).mul(sheen));
                // The shadow it casts on the lid and the eye below it.
                const cast = smoothstep(
                    u.eyeSpan.mul(BROW_SHADOW_REACH),
                    0,
                    up.negate().sub(halfWidth)
                )
                    .pow(1.5)
                    // Below it only.
                    .mul(saturate(f32(0.5).sub(up.div(soft))))
                    .mul(smoothstep(0, u.eyeSpan.mul(0.05), halfWidth))
                    .mul(saturate(run.sub(start.mul(size.x)).div(soft.mul(4))))
                    .mul(saturate(end.mul(size.x).sub(run).div(soft.mul(4))))
                    .mul(smoothstep(0, 0.1, at.y))
                    .mul(u.browShadow);
                const both = alpha.add(cast.mul(f32(1).sub(alpha)));
                out.assign(
                    vec4(
                        mix(
                            u.tone.mul(vec3(0.3, 0.17, 0.16)),
                            colour,
                            alpha.div(max(both, 1e-4))
                        ),
                        both
                    )
                );
            })
            .ElseIf(abs(part.sub(partId("lidLine"))).lessThan(0.5), () => {
                // The lid's lines again, on a piece that lies over the
                // lid's edge: here they run on across it, so the edge of
                // the mesh never shows through them.
                const q = inFrame(u, p, right);
                const rim = rimDistances(u, q, right);
                out.assign(vec4(u.lid, lidInk(u, q, right, rim, pixel, 0.35)));
            });
        If(out.a.lessThan(0.004), () => {
            Discard();
        });
        return out;
    })();
}

/** How the three materials come by what differs from figure to figure. */
export interface FigureMaterialOptions {
    /**
     * The table of looks to draw from, where several figures share one.
     * Left out, a table of its own is made, holding the style's look.
     */
    looks?: FigureLooks;
    /**
     * Which row of the table a figure is drawn with, as a whole number:
     * the first if left out. Where many figures are drawn as one mesh, a
     * value each instance has.
     */
    row?: Node;
}

/** The three materials a figure is drawn with. */
export function createFigureMaterials(
    style: FigureStyle,
    frames: FigureFrames,
    options: FigureMaterialOptions = {}
) {
    let { looks } = options;
    let ownLooks = false;
    if (!looks) {
        looks = createFigureLooks(frames);
        looks.set(0, style);
        ownLooks = true;
    }
    const u: Uniforms = {
        ...shapeUniforms(style, frames),
        ...lookNodes(looks, options.row ?? i32(0)),
    };
    const body = new THREE.MeshBasicNodeMaterial();
    body.name = "figure-body";
    body.colorNode = bodyColour(u);
    const face = new THREE.MeshBasicNodeMaterial();
    face.name = "figure-face";
    face.colorNode = faceColour(u);
    const ink = new THREE.MeshBasicNodeMaterial();
    ink.name = "figure-ink";
    ink.colorNode = inkColour(u);
    ink.transparent = true;
    ink.depthWrite = false;
    // Its pieces face either way; they do not overlap themselves, so one
    // pass draws them.
    ink.side = THREE.DoubleSide;
    ink.forceSinglePass = true;
    // The ink lies a hair off the skin, and the skin moves under it with
    // every expression. Drawn as if a little nearer the viewer (and in
    // the same place on screen) it is never cut off by the face it is
    // on: the brows by more, as they have furthest to travel; the irises
    // not at all, as they belong behind the lids.
    const part = attribute("part", "vec4").x.mul(255);
    const nearer = select(
        abs(part.sub(partId("brow"))).lessThan(0.5),
        f32(0.008),
        select(abs(part.sub(partId("iris"))).lessThan(0.5), f32(0), f32(0.0015))
    );
    ink.vertexNode = cameraProjectionMatrix.mul(
        vec4(positionView.mul(f32(1).sub(nearer.div(length(positionView)))), 1)
    );
    // Everything above is worked out from the resting figure and from
    // where the surface ends up, however it got there: by its own bones,
    // or posed by a crowd.
    for (const material of [body, face, ink]) markCrowdMaterial(material);
    return {
        body,
        face,
        ink,
        looks,
        dispose() {
            body.dispose();
            face.dispose();
            ink.dispose();
            if (ownLooks) looks.dispose();
        },
    };
}

/**
 * Run a step on a material's vertices before anything else moves them:
 * before the mesh's own bones, and before any step added earlier. `name`
 * tells the material apart from one without the step.
 */
export function beforePosition(
    material: THREE.NodeMaterial,
    name: string,
    step: () => void
) {
    const base = material.setupPosition;
    material.setupPosition = function (builder) {
        step();
        return base.call(this, builder);
    };
    const baseKey = material.customProgramCacheKey.bind(material);
    material.customProgramCacheKey = () => `${name}-${baseKey()}`;
}

/** The names a figure in its basic form keeps its face's motion under. */
export const FACE_MOTION = { blink: "faceBlink", talk: "faceTalk" } as const;

/**
 * Give a material of the basic form its face's motion: how far each
 * vertex travels to shut the eyes and to open the mouth is stored on the
 * mesh, and `blink` and `talk` say how much of each to take, 0 to 1.
 */
export function moveFace(
    material: THREE.NodeMaterial,
    face: { blink: Node; talk: Node }
) {
    beforePosition(material, "figure-face-motion", () => {
        positionLocal.addAssign(
            attribute(FACE_MOTION.blink, "vec3")
                .mul(face.blink)
                .add(attribute(FACE_MOTION.talk, "vec3").mul(face.talk))
        );
    });
}

/** How a blink goes, seconds: how often, how long shutting and opening. */
const BLINK = { every: 3.7, shut: 0.07, open: 0.16 };

/**
 * How shut a figure's eyes are, 0 to 1, at a time in seconds. Each `seed`
 * (0 to 1) blinks at a pace and a moment of its own.
 */
export function blinkAt(seconds: number, seed = 0) {
    const cycle = BLINK.every * (0.75 + 0.5 * seed);
    const into = (((seconds + seed * 20) % cycle) + cycle) % cycle;
    const ease = (x: number) => {
        const t = Math.min(1, Math.max(0, x));
        return t * t * (3 - 2 * t);
    };
    return (
        ease(into / BLINK.shut) * (1 - ease((into - BLINK.shut) / BLINK.open))
    );
}

/** `blinkAt` in a shader: `seconds` and `seed` are values it reads. */
export function blinkNode(seconds: Node, seed: Node): Node {
    const cycle = seed.mul(0.5).add(0.75).mul(BLINK.every);
    const into = seconds.add(seed.mul(20)).mod(cycle);
    return smoothstep(0, BLINK.shut, into).mul(
        f32(1).sub(smoothstep(BLINK.shut, BLINK.shut + BLINK.open, into))
    );
}

/**
 * The material clothes are drawn with: lit by the same lights as the
 * figure's skin (they are fixed to the view, not taken from the scene),
 * so a dressed figure looks one piece wherever it stands. Colour and
 * creases come from the vertices.
 */
export function createClothMaterial(
    stripes: ClothStripes = { colour: "#e9edf6", period: 0.028, width: 0.4 },
    /**
     * The outfit's painted texture, if it has one: its colour multiplies
     * the vertices', and its alpha cuts the cloth's ragged edges away.
     */
    map?: THREE.Texture
) {
    const material = new THREE.MeshBasicNodeMaterial();
    material.name = "figure-cloth";
    if (map) {
        material.alphaTest = 0.5;
        // Painted garments are single sheets, seen from both sides.
        material.side = THREE.DoubleSide;
    }
    const stripeColour = uniform(linear(stripes.colour));
    const period = uniform(stripes.period);
    const width = uniform(stripes.width);
    material.colorNode = Fn(() => {
        const c = attribute("color", "vec4");
        const s = surface();
        const kind = c.w;
        const albedo = c.xyz.toVar();
        const painted = map ? texture(map, uv()) : vec4(1, 1, 1, 1);
        albedo.mulAssign(painted.rgb);
        // Stripes: by where the point is on the resting figure.
        const striped = smoothstep(0.6, 0.55, kind);
        const p = positionGeometry;
        const across = select(kind.lessThan(0.375), f32(-0.7), f32(0.7));
        const u = p.x.mul(across).add(p.y.mul(0.7)).div(period);
        const f = fract(u);
        const pixel = max(fwidth(u), 1e-4);
        // Soft by a pixel at its edges; far off, where a pixel spans a
        // stripe and its gap, the two blend to their average.
        const band = mix(
            saturate(min(f, width.sub(f)).div(pixel).add(0.5)),
            width,
            smoothstep(0.35, 0.9, pixel)
        );
        albedo.assign(mix(albedo, stripeColour, band.mul(striped)));
        const lit = litMatte(s, albedo, f32(1)).toVar();
        // Cloth catches light at its edges.
        lit.addAssign(SKY.mul(s.fresnel).mul(0.06).mul(albedo.add(0.2)));
        // Polish: a tight highlight from the key, and the sky at the edges.
        const polished = smoothstep(1, 0.75, kind).mul(
            smoothstep(0.55, 0.65, kind)
        );
        const halfway = normalize(KEY.add(s.v));
        const nh = saturate(dot(s.n, halfway));
        lit.addAssign(
            vec3(pow(nh, 70).mul(0.55).add(pow(nh, 12).mul(0.06)))
                .add(SKY.mul(s.fresnel).mul(0.18))
                .mul(polished)
        );
        return vec4(lit, painted.a);
    })();
    // Worked out from the resting figure and where the surface ends up.
    markCrowdMaterial(material);
    return material;
}
