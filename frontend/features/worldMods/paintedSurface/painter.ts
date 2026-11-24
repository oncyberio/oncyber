// Three-free: builds the numbers a painted surface is drawn from, so it can
// be tested on its own and run before any renderer exists.

export type Vec3 = readonly [number, number, number];
/** sRGB, 0–1 per channel. */
export type Colour = readonly [number, number, number];

/** How a surface is painted. Every field has a default. */
export type PaintStyle = {
    /** The colours strokes are picked from; the first is picked most. */
    palette: readonly Colour[];
    /** The flat colour under the strokes, seen in the gaps between them. */
    under?: Colour;
    /** Stroke direction, in radians from the surface's first edge. */
    flow?: number | ((along: number, across: number) => number);
    /** Stroke length and width, in the surface's units. */
    length?: number;
    width?: number;
    /** How far a stroke may turn off the flow, in radians either way. */
    wobble?: number;
    /** Strokes per area: 1 just covers, more overlaps. */
    density?: number;
    /** How much a stroke's brightness varies, 0–1. */
    vary?: number;
};

export type LineStyle = {
    colour: Colour;
    width?: number;
    /** Longest single stroke; the line is split into strokes this long. */
    reach?: number;
};

/** A multiplier per channel for the paint at a point facing `normal`. */
export type Light = (position: Vec3, normal: Vec3) => Vec3;

export type Painted = {
    /** Flat underpaint: indexed triangles with a colour per vertex. */
    base: {
        position: Float32Array;
        colour: Float32Array;
        index: Uint32Array;
    };
    /** One brush stroke per instance, four floats per attribute. */
    strokes: {
        count: number;
        /** xyz centre, w length. */
        centre: Float32Array;
        /** xyz unit direction head to tail, w width. */
        axis: Float32Array;
        /** xyz unit surface normal, w lift off the surface. */
        normal: Float32Array;
        /** linear rgb, w bend. */
        colour: Float32Array;
    };
    /** Everything painted fits in this box. */
    bounds: { min: Vec3; max: Vec3 };
};

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
];
const norm = (a: Vec3): Vec3 => {
    const length = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / length, a[1] / length, a[2] / length];
};

/** sRGB to linear, the space the renderer works in. */
export const toLinear = (value: number) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;

/** "#rrggbb" to a colour. */
export function hex(value: string): Colour {
    const n = parseInt(value.replace("#", ""), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** A small seeded generator (mulberry32): the same seed paints the same. */
export function seeded(seed: number) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Clips the 2D segment a→b to a convex polygon (counter-clockwise).
 * Returns the part inside as [from, to] along the segment (0–1), or null.
 */
function clipToConvex(
    polygon: readonly (readonly [number, number])[],
    a: readonly [number, number],
    b: readonly [number, number]
): [number, number] | null {
    let from = 0;
    let to = 1;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    for (let i = 0; i < polygon.length; i++) {
        const p = polygon[i];
        const q = polygon[(i + 1) % polygon.length];
        // inward normal of a counter-clockwise edge
        const nx = -(q[1] - p[1]);
        const ny = q[0] - p[0];
        const start = (a[0] - p[0]) * nx + (a[1] - p[1]) * ny;
        const change = dx * nx + dy * ny;
        if (Math.abs(change) < 1e-12) {
            if (start < 0) return null;
            continue;
        }
        const t = -start / change;
        if (change > 0) from = Math.max(from, t);
        else to = Math.min(to, t);
        if (from >= to) return null;
    }
    return [from, to];
}

type Placement = { at: Vec3; cos: number; sin: number };

const DEFAULT_STYLE = {
    flow: 0,
    length: 0.9,
    width: 0.2,
    wobble: 0.22,
    density: 1.5,
    vary: 0.14,
};

/**
 * Paints surfaces the way the sky is painted: a flat underpaint, then loose
 * brush strokes laid along a flow, each its own instance of the procedural
 * brush (`../brush/brush.ts`). Describe the surfaces (`poly`, `box`,
 * `prism`), the contours (`line`) and single touches (`dab`), then `build`
 * the arrays a mesh is made from.
 */
export function createPainter({
    seed = 1,
    light,
    density = 1,
}: { seed?: number; light?: Light; density?: number } = {}) {
    const random = seeded(seed);
    const positions: number[] = [];
    const colours: number[] = [];
    const indices: number[] = [];
    const centre: number[] = [];
    const axis: number[] = [];
    const normal: number[] = [];
    const tint: number[] = [];
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    const placements: Placement[] = [];

    /** A point as written, moved by the placements it sits inside. */
    const point = (p: Vec3): Vec3 => {
        let [x, y, z] = p;
        for (let i = placements.length - 1; i >= 0; i--) {
            const { at, cos, sin } = placements[i];
            [x, z] = [cos * x + sin * z, -sin * x + cos * z];
            x += at[0];
            y += at[1];
            z += at[2];
        }
        return [x, y, z];
    };
    const grow = (p: Vec3) => {
        for (let i = 0; i < 3; i++) {
            if (p[i] < min[i]) min[i] = p[i];
            if (p[i] > max[i]) max[i] = p[i];
        }
    };
    const lit = (colour: Colour, at: Vec3, facing: Vec3, gain = 1): Vec3 => {
        const shine = light ? light(at, facing) : ([1, 1, 1] as const);
        return [
            toLinear(colour[0]) * shine[0] * gain,
            toLinear(colour[1]) * shine[1] * gain,
            toLinear(colour[2]) * shine[2] * gain,
        ];
    };
    const pick = (palette: readonly Colour[]) => {
        // the first colour about half the time, the rest share the other half
        if (palette.length === 1 || random() < 0.5) return palette[0];
        return palette[1 + Math.floor(random() * (palette.length - 1))];
    };

    /** One stroke, already in place (no placement applied). */
    function stroke(
        at: Vec3,
        along: Vec3,
        facing: Vec3,
        length: number,
        width: number,
        colour: Vec3,
        lift: number,
        bend: number
    ) {
        centre.push(at[0], at[1], at[2], length);
        axis.push(along[0], along[1], along[2], width);
        normal.push(facing[0], facing[1], facing[2], lift);
        tint.push(colour[0], colour[1], colour[2], bend);
        const reach = length / 2 + width;
        grow([at[0] - reach, at[1] - reach, at[2] - reach]);
        grow([at[0] + reach, at[1] + reach, at[2] + reach]);
    }

    const painter = {
        /**
         * Everything painted inside `paint` is turned by `yaw` (radians
         * about the up axis) and moved to `at`. Placements nest.
         */
        place(at: Vec3, yaw: number, paint: () => void) {
            placements.push({ at, cos: Math.cos(yaw), sin: Math.sin(yaw) });
            try {
                paint();
            } finally {
                placements.pop();
            }
        },

        /**
         * A flat convex shape, its corners given counter-clockwise as seen
         * from the side it is looked at. Strokes run along its first edge
         * unless `flow` turns them.
         */
        poly(corners: readonly Vec3[], style: PaintStyle) {
            const points = corners.map(point);
            const s = { ...DEFAULT_STYLE, ...style };
            const origin = points[0];
            const u = norm(sub(points[1], origin));
            const facing = norm(
                cross(sub(points[1], origin), sub(points[2], origin))
            );
            const v = cross(facing, u);
            const flat = points.map((p) => {
                const d = sub(p, origin);
                return [dot(d, u), dot(d, v)] as const;
            });
            const middle = flat.reduce(
                (sum, p) => [sum[0] + p[0], sum[1] + p[1]] as const,
                [0, 0] as const
            );
            const to3 = (a: number, b: number): Vec3 =>
                add(origin, add(scale(u, a), scale(v, b)));

            // underpaint
            const under = s.under ?? s.palette[0].map((c) => c * 0.45);
            const first = positions.length / 3;
            for (const p of points) {
                positions.push(p[0], p[1], p[2]);
                colours.push(...lit(under as Colour, p, facing));
                grow(p);
            }
            for (let i = 1; i < points.length - 1; i++)
                indices.push(first, first + i, first + i + 1);

            // strokes: rows across the flow, a stroke every step along it
            const flowAt =
                typeof s.flow === "function" ? s.flow : () => s.flow as number;
            const turn = flowAt(
                middle[0] / flat.length,
                middle[1] / flat.length
            );
            const fx = Math.cos(turn);
            const fy = Math.sin(turn);
            let alongMin = Infinity;
            let alongMax = -Infinity;
            let acrossMin = Infinity;
            let acrossMax = -Infinity;
            for (const [a, b] of flat) {
                const along = a * fx + b * fy;
                const across = -a * fy + b * fx;
                alongMin = Math.min(alongMin, along);
                alongMax = Math.max(alongMax, along);
                acrossMin = Math.min(acrossMin, across);
                acrossMax = Math.max(acrossMax, across);
            }
            const cover = Math.sqrt(Math.max(0.05, s.density * density));
            const span = acrossMax - acrossMin;
            // narrow shapes are painted with strokes their own width
            const width = Math.min(s.width, span * 0.9);
            const rows = Math.max(
                1,
                Math.round((span / (width * 0.74)) * cover)
            );
            const step = (s.length * 0.68) / cover;
            for (let row = 0; row < rows; row++) {
                const across =
                    rows === 1
                        ? (acrossMin + acrossMax) / 2
                        : acrossMin +
                          width * 0.4 +
                          ((span - width * 0.8) * row) / (rows - 1);
                for (
                    let along = alongMin - random() * step;
                    along < alongMax;
                    along += step * (0.8 + random() * 0.4)
                ) {
                    const sway = (random() - 0.5) * width * 0.5;
                    const a = along * fx - (across + sway) * fy;
                    const b = along * fy + (across + sway) * fx;
                    const angle =
                        flowAt(a, b) + (random() - 0.5) * 2 * s.wobble;
                    const dx = Math.cos(angle);
                    const dy = Math.sin(angle);
                    const length = s.length * (0.75 + random() * 0.5);
                    const from = [
                        a - (dx * length) / 2,
                        b - (dy * length) / 2,
                    ] as const;
                    const to = [
                        a + (dx * length) / 2,
                        b + (dy * length) / 2,
                    ] as const;
                    const inside = clipToConvex(flat, from, to);
                    if (!inside) continue;
                    const kept = (inside[1] - inside[0]) * length;
                    if (kept < Math.min(s.length * 0.3, width)) continue;
                    const mid = (inside[0] + inside[1]) / 2;
                    const at = to3(
                        from[0] + (to[0] - from[0]) * mid,
                        from[1] + (to[1] - from[1]) * mid
                    );
                    const gain = 1 + (random() - 0.5) * 2 * s.vary;
                    stroke(
                        at,
                        add(scale(u, dx), scale(v, dy)),
                        facing,
                        kept,
                        width * (0.8 + random() * 0.4),
                        lit(pick(s.palette), at, facing, gain),
                        0.004 + random() * 0.014,
                        (random() - 0.5) * 0.3
                    );
                }
            }
            return painter;
        },

        /**
         * An upright box from `min` to `max`. `faces` names the sides to
         * paint: x and X (low and high), y, Y, z, Z. `grain` is the axis the
         * strokes follow on the sides that contain it.
         */
        box(
            lo: Vec3,
            hi: Vec3,
            style: PaintStyle & {
                faces?: string;
                grain?: "x" | "y" | "z";
            }
        ) {
            const [x0, y0, z0] = lo;
            const [x1, y1, z1] = hi;
            const grain = style.grain ?? "y";
            // each side's corners, counter-clockwise from outside, written so
            // the first edge runs along the first axis listed
            const sides: Record<string, { run: string; corners: Vec3[] }[]> = {
                x: [
                    {
                        run: "z",
                        corners: [
                            [x0, y0, z0],
                            [x0, y0, z1],
                            [x0, y1, z1],
                            [x0, y1, z0],
                        ],
                    },
                    {
                        run: "y",
                        corners: [
                            [x0, y0, z1],
                            [x0, y1, z1],
                            [x0, y1, z0],
                            [x0, y0, z0],
                        ],
                    },
                ],
                X: [
                    {
                        run: "z",
                        corners: [
                            [x1, y0, z1],
                            [x1, y0, z0],
                            [x1, y1, z0],
                            [x1, y1, z1],
                        ],
                    },
                    {
                        run: "y",
                        corners: [
                            [x1, y0, z0],
                            [x1, y1, z0],
                            [x1, y1, z1],
                            [x1, y0, z1],
                        ],
                    },
                ],
                y: [
                    {
                        run: "x",
                        corners: [
                            [x0, y0, z0],
                            [x1, y0, z0],
                            [x1, y0, z1],
                            [x0, y0, z1],
                        ],
                    },
                    {
                        run: "z",
                        corners: [
                            [x1, y0, z0],
                            [x1, y0, z1],
                            [x0, y0, z1],
                            [x0, y0, z0],
                        ],
                    },
                ],
                Y: [
                    {
                        run: "x",
                        corners: [
                            [x0, y1, z1],
                            [x1, y1, z1],
                            [x1, y1, z0],
                            [x0, y1, z0],
                        ],
                    },
                    {
                        run: "z",
                        corners: [
                            [x0, y1, z0],
                            [x0, y1, z1],
                            [x1, y1, z1],
                            [x1, y1, z0],
                        ],
                    },
                ],
                z: [
                    {
                        run: "x",
                        corners: [
                            [x1, y0, z0],
                            [x0, y0, z0],
                            [x0, y1, z0],
                            [x1, y1, z0],
                        ],
                    },
                    {
                        run: "y",
                        corners: [
                            [x0, y0, z0],
                            [x0, y1, z0],
                            [x1, y1, z0],
                            [x1, y0, z0],
                        ],
                    },
                ],
                Z: [
                    {
                        run: "x",
                        corners: [
                            [x0, y0, z1],
                            [x1, y0, z1],
                            [x1, y1, z1],
                            [x0, y1, z1],
                        ],
                    },
                    {
                        run: "y",
                        corners: [
                            [x1, y0, z1],
                            [x1, y1, z1],
                            [x0, y1, z1],
                            [x0, y0, z1],
                        ],
                    },
                ],
            };
            const size = { x: x1 - x0, y: y1 - y0, z: z1 - z0 };
            for (const face of style.faces ?? "xXYzZ") {
                const [a, b] = sides[face];
                // along the grain where the side has it, else its longer edge
                const chosen =
                    a.run === grain
                        ? a
                        : b.run === grain
                        ? b
                        : size[a.run as "x"] >= size[b.run as "x"]
                        ? a
                        : b;
                painter.poly(chosen.corners, style);
            }
            return painter;
        },

        /**
         * A beam from `a` to `b`: the face looking along `facing` (which is
         * square to the beam) and the two sides next to it, `depth` proud
         * of the line a→b. `back` paints the fourth side as well. Strokes
         * run along the beam.
         */
        beam(
            a: Vec3,
            b: Vec3,
            facing: Vec3,
            width: number,
            depth: number,
            style: PaintStyle & { back?: boolean }
        ) {
            const along = norm(sub(b, a));
            const front = norm(facing);
            const side = scale(cross(front, along), width / 2);
            const out = scale(front, depth);
            const corner = (end: Vec3, sideways: number, proud: number) =>
                add(add(end, scale(side, sideways)), scale(out, proud));
            painter.poly(
                [
                    corner(a, -1, 1),
                    corner(b, -1, 1),
                    corner(b, 1, 1),
                    corner(a, 1, 1),
                ],
                style
            );
            painter.poly(
                [
                    corner(a, 1, 1),
                    corner(b, 1, 1),
                    corner(b, 1, 0),
                    corner(a, 1, 0),
                ],
                style
            );
            painter.poly(
                [
                    corner(a, -1, 0),
                    corner(b, -1, 0),
                    corner(b, -1, 1),
                    corner(a, -1, 1),
                ],
                style
            );
            if (style.back)
                painter.poly(
                    [
                        corner(a, 1, 0),
                        corner(b, 1, 0),
                        corner(b, -1, 0),
                        corner(a, -1, 0),
                    ],
                    style
                );
            return painter;
        },

        /**
         * An upright column with `sides` flat sides around (x, z), from
         * `y0` to `y1`, with a painted top. A different top radius makes it
         * a cone or a jug.
         */
        prism(
            at: readonly [number, number],
            radius: number,
            y0: number,
            y1: number,
            style: PaintStyle & {
                sides?: number;
                topRadius?: number;
                top?: boolean;
            }
        ) {
            const sides = style.sides ?? 8;
            const upper = style.topRadius ?? radius;
            const ring = (r: number, y: number, i: number): Vec3 => {
                const angle = (i / sides) * Math.PI * 2;
                return [
                    at[0] + Math.cos(angle) * r,
                    y,
                    at[1] + Math.sin(angle) * r,
                ];
            };
            for (let i = 0; i < sides; i++) {
                // counter-clockwise from outside, first edge going up
                painter.poly(
                    [
                        ring(radius, y0, i),
                        ring(upper, y1, i),
                        ring(upper, y1, i + 1),
                        ring(radius, y0, i + 1),
                    ],
                    style
                );
            }
            if (style.top !== false && upper > 0.01) {
                const top: Vec3[] = [];
                for (let i = sides - 1; i >= 0; i--)
                    top.push(ring(upper, y1, i));
                painter.poly(top, style);
            }
            return painter;
        },

        /**
         * A contour: dark strokes end to end from `a` to `b`, lying on the
         * surface that faces `facing`.
         */
        line(a: Vec3, b: Vec3, facing: Vec3, style: LineStyle) {
            const from = point(a);
            const to = point(b);
            const front = norm(sub(point(add(a, facing)), from));
            const total = Math.hypot(...sub(to, from));
            if (total < 1e-6) return painter;
            const along = scale(sub(to, from), 1 / total);
            const width = style.width ?? 0.07;
            const pieces = Math.max(1, Math.ceil(total / (style.reach ?? 1.3)));
            const each = total / pieces;
            const side = cross(front, along);
            for (let i = 0; i < pieces; i++) {
                const at = add(
                    add(from, scale(along, each * (i + 0.5))),
                    scale(side, (random() - 0.5) * width * 0.4)
                );
                stroke(
                    at,
                    // every other stroke is pulled the other way, as a hand
                    // going over a line twice does
                    i % 2 ? scale(along, -1) : along,
                    front,
                    each * 1.14,
                    width * (0.85 + random() * 0.3),
                    lit(style.colour, at, front, 0.9 + random() * 0.2),
                    0.02 + random() * 0.006,
                    (random() - 0.5) * 0.12
                );
            }
            return painter;
        },

        /** A single stroke at `at`, heading `along`, on a surface facing `facing`. */
        dab(
            at: Vec3,
            along: Vec3,
            facing: Vec3,
            length: number,
            width: number,
            colour: Colour,
            { bend = 0, lift = 0.024, glow = false } = {}
        ) {
            const centred = point(at);
            const front = norm(sub(point(add(at, facing)), centred));
            const heading = norm(sub(point(add(at, along)), centred));
            stroke(
                centred,
                heading,
                front,
                length,
                width,
                // a glowing dab keeps its own colour whatever the light
                glow
                    ? [
                          toLinear(colour[0]),
                          toLinear(colour[1]),
                          toLinear(colour[2]),
                      ]
                    : lit(colour, centred, front),
                lift,
                bend
            );
            return painter;
        },

        build(): Painted {
            const count = centre.length / 4;
            const empty = !Number.isFinite(min[0]);
            return {
                base: {
                    position: new Float32Array(positions),
                    colour: new Float32Array(colours),
                    index: new Uint32Array(indices),
                },
                strokes: {
                    count,
                    centre: new Float32Array(centre),
                    axis: new Float32Array(axis),
                    normal: new Float32Array(normal),
                    colour: new Float32Array(tint),
                },
                bounds: empty
                    ? { min: [0, 0, 0], max: [0, 0, 0] }
                    : {
                          min: [min[0], min[1], min[2]],
                          max: [max[0], max[1], max[2]],
                      },
            };
        },
    };

    return painter;
}

export type Painter = ReturnType<typeof createPainter>;
