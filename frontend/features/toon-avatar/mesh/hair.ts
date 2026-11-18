import { boneIndex } from "../skeleton";
import {
    blob,
    tube,
    type Rgb,
    type Row,
    type VertexStyle,
    type Weights,
} from "./builder";
import { rigid, type ToonContext } from "./context";
import type { HeadShape } from "./head";
import {
    add,
    addScaled,
    clamp,
    curve,
    lerp,
    normalize,
    scale,
    smoothstep,
    sub,
    type Vec3,
} from "./vec";

const SEGMENTS = 72;
const PI = Math.PI;

export type CapOptions = {
    color: Rgb;
    /** Lower edge of the cap: latitude for each longitude (0 is the face). */
    edge: (longitude: number) => number;
    /** Upper edge for a band (headband, balding ring). Default: closed top. */
    top?: (longitude: number) => number;
    /** Height above the scalp in metres; `f` is 0 at the edge, 1 at the top. */
    thickness: (f: number, longitude: number) => number;
    /** Flat ceiling in metres above the head centre (flat top). */
    ceiling?: number;
    rows?: number;
};

/**
 * A layer that hugs the skull from an edge line upward: hair, beanies and
 * bands are all caps. The edge gets an ink line and dips under the skin, so
 * the cap is sealed and outlined all the way round.
 */
export function cap(ctx: ToonContext, head: HeadShape, options: CapOptions) {
    const { builder, colors, layout } = ctx;
    const { color, edge, top, thickness, ceiling } = options;
    const count = options.rows ?? 9;
    const weights = rigid("head");
    const inkStep = (layout.ink / head.size) * 0.7;
    const limit = (longitude: number) => (top ? top(longitude) : PI / 2 - 0.02);
    const ring = (place: (longitude: number) => Vec3, rgb: Rgb): Row => {
        const points: Vec3[] = [];
        for (let j = 0; j < SEGMENTS; j++) {
            const p = place((j / SEGMENTS) * PI * 2);
            if (ceiling !== undefined)
                p[1] = Math.min(p[1], head.center[1] + ceiling);
            points.push(p);
        }
        return { color: rgb, weights, points };
    };
    const lift = (f: number, longitude: number) => {
        const t = thickness(f, longitude);
        // A cap with no thickness here hides under the skin instead.
        return t <= 1e-4 ? -layout.ink * 2 : t;
    };
    const rows: Row[] = [
        ring((l) => head.at(edge(l), l, -layout.ink * 2), colors.ink),
        ring((l) => head.at(edge(l), l, lift(0, l)), colors.ink),
    ];
    for (let i = 0; i <= count; i++) {
        const f = i / count;
        rows.push(
            ring((l) => {
                const from = edge(l) + inkStep;
                const latitude = lerp(
                    from,
                    Math.max(from, limit(l) - (top ? inkStep : 0)),
                    f
                );
                return head.at(latitude, l, lift(f, l));
            }, color)
        );
    }
    if (top) {
        rows[rows.length - 1].color = colors.ink;
        rows.push(ring((l) => head.at(limit(l), l, lift(1, l)), colors.ink));
        rows.push(
            ring((l) => head.at(limit(l), l, -layout.ink * 2), colors.ink)
        );
        builder.loft(rows, null, null);
    } else {
        const apex = head.at(PI / 2, 0, lift(1, 0));
        if (ceiling !== undefined)
            apex[1] = Math.min(apex[1], head.center[1] + ceiling);
        builder.loft(rows, null, apex);
    }
}

/** The usual hairline: high on the forehead, down past the ears, low at the nape. */
export function hairline(
    front: number,
    nape: number,
    scallop = 0,
    waves = 5,
    sides = 0
) {
    return (longitude: number) => {
        const wrapped = Math.atan2(Math.sin(longitude), Math.cos(longitude));
        const a = Math.abs(wrapped) / PI;
        const base = curve(
            [
                [0, front],
                [0.2, front - 0.08],
                [0.33, 0.42 + sides * 0.5],
                [0.44, 0.2 + sides],
                [0.56, 0.1 + sides],
                [1, nape],
            ],
            a
        );
        const frontness = 1 - smoothstep(0.2, 0.4, a);
        return (
            base -
            scallop * frontness * (0.5 - 0.5 * Math.cos(wrapped * waves * 2))
        );
    };
}

/** A tapering cone of hair pointing away from the skull. */
export function spike(
    ctx: ToonContext,
    head: HeadShape,
    latitude: number,
    longitude: number,
    length: number,
    radius: number,
    bend: Vec3 = [0, 0, 0],
    weights: Weights = rigid("head")
) {
    const base = head.at(latitude, longitude, -radius * 0.3);
    const outward = normalize(
        sub(head.at(latitude, longitude, 0.05), head.at(latitude, longitude))
    );
    const style: VertexStyle = { color: ctx.colors.hair, weights };
    tube(
        ctx.builder,
        [0, 0.35, 0.7, 1].map((f) => ({
            ...style,
            at: add(
                addScaled(base, outward, length * f),
                scale(bend, f * f * length)
            ),
            ru: Math.max(radius * (1 - f) * (1 - f * 0.25), radius * 0.04),
        })),
        { segments: 8, start: "open", bulge: 0.6 }
    );
}

/** A hanging lock: ponytail or pigtail. Swings on the hair bone. */
export function tail(
    ctx: ToonContext,
    root: Vec3,
    away: Vec3,
    length: number,
    radius: number
) {
    const { builder, colors } = ctx;
    const stations = [];
    const count = 7;
    for (let i = 0; i <= count; i++) {
        const f = i / count;
        // Out from the head first, then gravity takes over.
        const out = Math.sin(Math.min(1, f * 1.6) * PI * 0.5) * length * 0.42;
        const drop = f * f * length * 0.9 - Math.sin(f * PI) * length * 0.12;
        const swing = smoothstep(0.1, 0.8, f);
        stations.push({
            color: colors.hair,
            weights: [
                [boneIndex("head"), 1 - swing],
                [boneIndex("hairTail"), swing],
            ] as Weights,
            at: [
                root[0] + away[0] * out,
                root[1] + away[1] * out - drop,
                root[2] + away[2] * out,
            ] as Vec3,
            ru:
                radius *
                (0.55 + 0.75 * Math.sin(lerp(0.12, 1, f) * PI) ** 0.7) *
                (1 - f * 0.25),
        });
    }
    tube(builder, stations, { segments: 10, bulge: 1.4 });
    // Hair tie.
    tube(
        builder,
        [0.02, 0.1].map((f) => ({
            color: colors.ink,
            weights: rigid("head"),
            outline: 0,
            at: addScaled(root, away, length * f),
            ru: radius * 0.72,
        })),
        { segments: 10, start: "flat", end: "flat" }
    );
}

/** Hair that hangs past the skull: a thick sheet around the back and sides. */
export function curtain(
    ctx: ToonContext,
    head: HeadShape,
    bottomY: number,
    offset: number,
    curl: number
) {
    const { builder, colors, layout } = ctx;
    const { center, halfWidth, halfDepth, up, down } = layout.head;
    const topY = center[1] + up * 0.3;
    const chinY = center[1] - down;
    const half = 14;
    const count = Math.max(6, Math.round((topY - bottomY) / 0.035));
    const rows: (VertexStyle & { outer: Vec3[]; inner: Vec3[] })[] = [];
    const edges: Vec3[][] = [[], []];
    for (let i = 0; i <= count; i++) {
        const f = i / count;
        const y = lerp(bottomY, topY, f);
        const s = clamp((y - center[1]) / up, 0, 0.95);
        // Narrower under the cap, and slightly tucked in at the tips.
        const fit = Math.sqrt(1 - s * s) * (1 - curl * smoothstep(0.35, 0, f));
        // Past the jaw the sheet falls behind the shoulders.
        const reach = lerp(
            1.15,
            1.95,
            smoothstep(chinY - 0.1, chinY + 0.02, y)
        );
        const arc = (grow: number) => {
            const points: Vec3[] = [];
            for (let j = 0; j <= half * 2; j++) {
                const angle = PI - reach + (j / (half * 2)) * reach * 2;
                points.push([
                    center[0] + Math.sin(angle) * (halfWidth * fit + grow),
                    y,
                    center[2] +
                        Math.cos(angle) * (halfDepth * 1.04 * fit + grow),
                ]);
            }
            return points;
        };
        const outer = arc(offset);
        const swing = smoothstep(chinY, bottomY - 0.02, y) * 0.85;
        rows.push({
            color: colors.hair,
            outer,
            inner: arc(Math.max(0.004, offset * 0.3)),
            weights: [
                [boneIndex("head"), 1 - swing],
                [boneIndex("hairTail"), swing],
            ],
        });
        edges[0].push(outer[0]);
        edges[1].push(outer[half * 2]);
    }
    builder.shell(rows);
    for (const edge of edges)
        tube(
            builder,
            edge.map((at, i) => ({
                at,
                ru: layout.ink * 0.55,
                color: colors.ink,
                outline: 0,
                weights: rows[i].weights,
            })),
            { segments: 6 }
        );
}

function buildHat(ctx: ToonContext, head: HeadShape, under: number) {
    const { builder, colors, recipe } = ctx;
    const style = recipe.extras.hat;
    const size = head.size;
    const fabric = under + size * 0.03;
    if (style === "headband") {
        cap(ctx, head, {
            color: colors.hat,
            edge: () => 0.52,
            top: () => 0.7,
            thickness: () => under + size * 0.02,
            rows: 2,
        });
        return;
    }
    if (style === "beanie") {
        cap(ctx, head, {
            color: colors.hat,
            edge: hairline(0.6, 0.12),
            thickness: (f) => fabric + (f < 0.2 ? size * 0.035 : 0),
            rows: 10,
        });
        blob(builder, {
            color: colors.hat,
            weights: rigid("head"),
            center: head.at(PI / 2, 0, fabric + size * 0.08),
            radii: [size * 0.15, size * 0.15, size * 0.15],
        });
        return;
    }
    if (style === "cap") {
        cap(ctx, head, {
            color: colors.hat,
            edge: hairline(0.68, 0.18),
            thickness: () => fabric,
            rows: 8,
        });
        const brim = head.at(0.62, 0, fabric * 0.5);
        blob(builder, {
            color: colors.hat,
            weights: rigid("head"),
            center: [brim[0], brim[1] - size * 0.03, brim[2] + size * 0.32],
            radii: [size * 0.62, size * 0.035, size * 0.5],
            deform: (d) => [
                d[0] * (1 - Math.max(0, d[2]) * 0.35),
                d[1] - d[2] * 0.6,
                d[2],
            ],
            rings: 6,
            segments: 16,
        });
        blob(builder, {
            color: colors.hat,
            weights: rigid("head"),
            outline: 0.5,
            center: head.at(PI / 2, 0, fabric),
            radii: [size * 0.06, size * 0.03, size * 0.06],
            rings: 5,
            segments: 8,
        });
    }
}

export function buildHair(ctx: ToonContext, head: HeadShape) {
    const { colors, layout, recipe } = ctx;
    const { style, volume, length } = recipe.hair;
    const hat = recipe.extras.hat;
    const covered = hat === "beanie" || hat === "cap";
    const size = head.size;
    const color = colors.hair;
    // Under a hat, hair lies flat and tall shapes are left off.
    const flat = size * 0.03;
    const fit = (thickness: number) =>
        covered ? Math.min(thickness, flat) : thickness;
    const rounded = (thickness: number) => (f: number) =>
        fit(thickness) * lerp(0.45, 1, smoothstep(0, 0.28, f));
    let under = 0;

    switch (style) {
        case "bald":
            break;
        case "short": {
            under = lerp(0.035, 0.1, volume) * size;
            cap(ctx, head, {
                color,
                edge: hairline(
                    lerp(1.0, 0.8, length),
                    -0.25,
                    covered ? 0 : 0.09
                ),
                thickness: rounded(under),
            });
            break;
        }
        case "curly": {
            under = lerp(0.08, 0.2, volume) * size;
            cap(ctx, head, {
                color,
                edge: hairline(
                    lerp(0.95, 0.7, length),
                    -0.3,
                    covered ? 0 : 0.14,
                    7
                ),
                thickness: (f, l) =>
                    rounded(under)(f) *
                    (covered
                        ? 1
                        : 1 + 0.28 * Math.sin(l * 9) * Math.sin(f * 11 + 1)),
                rows: 12,
            });
            break;
        }
        case "afro": {
            under = lerp(0.28, 0.62, volume) * size;
            cap(ctx, head, {
                color,
                edge: hairline(
                    0.86,
                    -0.45,
                    covered ? 0 : 0.1,
                    6,
                    covered ? 0 : -0.3
                ),
                thickness: (f, l) =>
                    fit(under) *
                    lerp(covered ? 0.45 : 0.72, 1, smoothstep(0, 0.22, f)) *
                    (covered
                        ? 1
                        : 1 + 0.07 * Math.sin(l * 10) * Math.sin(f * 9 + 0.5)),
                rows: 12,
            });
            break;
        }
        case "flattop": {
            under = lerp(0.1, 0.24, volume) * size;
            cap(ctx, head, {
                color,
                edge: hairline(0.9, -0.2),
                thickness: (f) =>
                    fit(under) *
                    lerp(0.4, 1, smoothstep(0, 0.2, f)) *
                    (covered ? 1 : 1 + f * 1.4),
                ceiling: covered
                    ? undefined
                    : layout.head.up + under * lerp(0.7, 1.6, length),
                rows: 10,
            });
            break;
        }
        case "swoop": {
            under = lerp(0.05, 0.12, volume) * size;
            cap(ctx, head, {
                color,
                edge: hairline(0.92, -0.25),
                thickness: (f, l) => {
                    const wrapped = Math.atan2(
                        Math.sin(l - 0.35),
                        Math.cos(l - 0.35)
                    );
                    const quiff =
                        Math.exp(-Math.pow(wrapped / 0.75, 2)) *
                        Math.sin(clamp(f * 1.5) * PI) *
                        lerp(1.2, 3.2, length);
                    return rounded(under)(f) * (covered ? 1 : 1 + quiff);
                },
                rows: 12,
            });
            break;
        }
        case "balding": {
            under = lerp(0.04, 0.1, volume) * size;
            cap(ctx, head, {
                color,
                edge: hairline(0.3, -0.25),
                top: () => lerp(0.62, 0.95, length),
                // Nothing over the forehead: only the sides and back.
                thickness: (f, l) =>
                    Math.abs(Math.atan2(Math.sin(l), Math.cos(l))) < 1.0
                        ? 0
                        : fit(under) * (0.5 + 0.5 * Math.sin(f * PI)),
                rows: 5,
            });
            break;
        }
        case "spikes": {
            under = 0.035 * size;
            cap(ctx, head, {
                color,
                edge: hairline(1.12, -0.2),
                thickness: rounded(under),
            });
            if (!covered) {
                const reach = lerp(0.32, 0.85, length) * size;
                const base = lerp(0.15, 0.25, volume) * size;
                for (let i = 0; i < 9; i++) {
                    const l = lerp(1.05, PI * 2 - 1.05, i / 8);
                    spike(ctx, head, 0.28, l, reach, base, [0, 0.25, 0]);
                }
                for (let i = 0; i < 5; i++) {
                    const l = lerp(1.5, PI * 2 - 1.5, i / 4);
                    spike(ctx, head, 0.95, l, reach * 0.9, base * 0.95);
                }
            }
            break;
        }
        case "mohawk": {
            under = 0.012 * size;
            if (!covered) {
                const reach = lerp(0.25, 0.75, length) * size;
                const base = lerp(0.1, 0.17, volume) * size;
                for (let i = 0; i < 7; i++) {
                    const theta = lerp(0.95, PI + 0.15, i / 6);
                    const over = theta > PI / 2;
                    spike(
                        ctx,
                        head,
                        over ? PI - theta : theta,
                        over ? PI : 0,
                        reach,
                        base
                    );
                }
            }
            break;
        }
        case "ponytail": {
            under = lerp(0.035, 0.08, volume) * size;
            cap(ctx, head, {
                color,
                edge: hairline(0.95, -0.35),
                thickness: rounded(under),
            });
            const root = head.at(0.75, PI, under * 0.5);
            tail(
                ctx,
                root,
                normalize([0, 0.75, -1]),
                lerp(0.45, 1.5, length) * size * 1.4,
                lerp(0.1, 0.17, volume) * size
            );
            break;
        }
        case "pigtails": {
            under = lerp(0.035, 0.08, volume) * size;
            cap(ctx, head, {
                color,
                edge: hairline(0.95, -0.35),
                thickness: rounded(under),
            });
            for (const sign of [1, -1])
                tail(
                    ctx,
                    head.at(0.35, sign * PI * 0.62, under * 0.5),
                    normalize([sign, 0.35, -0.35]),
                    lerp(0.4, 1.2, length) * size * 1.3,
                    lerp(0.09, 0.15, volume) * size
                );
            break;
        }
        case "buns": {
            under = lerp(0.035, 0.08, volume) * size;
            cap(ctx, head, {
                color,
                edge: hairline(0.95, -0.35),
                thickness: rounded(under),
            });
            if (!covered) {
                const radius = lerp(0.2, 0.36, volume) * size;
                for (const sign of [1, -1])
                    blob(ctx.builder, {
                        color,
                        weights: rigid("head"),
                        center: head.at(0.95, sign * 0.95, radius * 0.6),
                        radii: [radius, radius, radius],
                    });
            }
            break;
        }
        case "bob":
        case "long": {
            under = lerp(0.045, 0.1, volume) * size;
            cap(ctx, head, {
                color,
                edge: hairline(0.9, 0.05, 0, 0),
                thickness: rounded(under * 1.05),
            });
            const chin = layout.head.center[1] - layout.head.down;
            const bottom =
                style === "bob"
                    ? chin + lerp(0.5, -0.15, length) * layout.head.down
                    : lerp(
                          layout.torso.top,
                          layout.torso.bottom,
                          lerp(0.05, 0.75, length)
                      );
            curtain(ctx, head, bottom, under, style === "bob" ? 0.14 : 0.05);
            break;
        }
    }
    if (hat !== "none")
        buildHat(ctx, head, Math.min(under, covered ? flat : under));
}
