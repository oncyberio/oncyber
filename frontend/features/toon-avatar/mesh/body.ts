import type { ToonBone } from "../skeleton";
import { boneIndex } from "../skeleton";
import {
    blob,
    ellipse,
    tube,
    type Rgb,
    type Row,
    type VertexStyle,
    type Weights,
} from "./builder";
import {
    chainWeights,
    rigid,
    spanRows,
    withInkLines,
    type Span,
    type ToonContext,
} from "./context";
import { addScaled, curve, lerp, smoothstep, type Vec3 } from "./vec";

const X: Vec3 = [1, 0, 0];
const Y: Vec3 = [0, 1, 0];
const Z: Vec3 = [0, 0, 1];

const TORSO_SEGMENTS = 28;
const LIMB_SEGMENTS = 12;

/** Torso cross-section at `t` (0 crotch, 1 neck base). */
export function torsoSection(ctx: ToonContext, t: number) {
    const { torso, neck } = ctx.layout;
    const length = torso.top - torso.bottom;
    const shoulderT =
        (ctx.layout.joints.leftUpperArm[1] - torso.bottom) / length;
    const shoulderX = ctx.layout.joints.leftUpperArm[0];
    const width = curve(
        [
            [-0.08, torso.hips * 0.45],
            [0.0, torso.hips * 0.9],
            [0.12, torso.hips],
            [0.45, torso.waist],
            [Math.min(0.7, shoulderT - 0.12), torso.chest],
            [shoulderT - 0.02, shoulderX * 0.98],
            [Math.min(0.985, shoulderT + 0.07), shoulderX * 0.8],
            [1.0, neck.radius * 1.5],
        ],
        t
    );
    const ratio = curve(
        [
            [0, 0.8],
            [0.45, 0.82],
            [0.75, 0.74],
            [1, 0.95],
        ],
        t
    );
    const bulge = Math.exp(-Math.pow((t - 0.36) / 0.2, 2)) * torso.belly;
    const depth = width * ratio + bulge * 0.55;
    const center: Vec3 = [
        0,
        torso.bottom + length * t,
        torso.lean * Math.max(0, t) * Math.max(0, t) + bulge * 0.5,
    ];
    return { center, width: width + bulge * 0.18, depth };
}

function torsoWeights(t: number): Weights {
    return chainWeights(
        t,
        [
            [0, "hips"],
            [0.3, "spine"],
            [0.52, "chest"],
            [0.74, "upperChest"],
        ],
        0.1
    );
}

function torsoRow(
    ctx: ToonContext,
    t: number,
    grow: number
): Omit<Row, "color"> {
    const { center, width, depth } = torsoSection(ctx, t);
    return {
        // z cross x = y: the loft climbs the spine.
        points: ellipse(
            center,
            Z,
            X,
            depth * grow,
            width * grow,
            TORSO_SEGMENTS,
            2.35
        ),
        weights: torsoWeights(t),
    };
}

/** Where each garment starts and stops on the torso, in torso `t`. */
function torsoPlan(ctx: ToonContext) {
    const { outfit } = ctx.recipe;
    const waistline = 0.4;
    // A skirt sits at the waist with the top tucked in; other tops hang over.
    const loose = outfit.top === "tank" ? 0.36 : 0.3;
    const hem =
        outfit.top === "crop"
            ? 0.62
            : outfit.bottom === "skirt"
            ? waistline
            : loose;
    const neckline =
        outfit.top === "tank" ? 0.86 : outfit.top === "crop" ? 0.92 : 1;
    return { waistline, hem, neckline };
}

function topColorAt(ctx: ToonContext, t: number, hem: number): Rgb {
    const { outfit } = ctx.recipe;
    const { top, accent } = ctx.colors;
    switch (outfit.pattern) {
        case "stripes":
            return Math.floor((t - hem) / 0.075) % 2 === 1 ? accent : top;
        case "band":
            return t > 0.58 && t < 0.7 ? accent : top;
        case "split":
            return t < 0.56 ? accent : top;
        default:
            return top;
    }
}

function buildTorso(ctx: ToonContext) {
    const { builder, colors, layout } = ctx;
    const { hem, waistline, neckline } = torsoPlan(ctx);
    const length = layout.torso.top - layout.torso.bottom;
    const line = layout.ink / length;
    const cloth = 1.05;

    const spans: Span[] = [];
    const lowerEnd = Math.min(hem, waistline);
    spans.push({ from: -0.08, to: lowerEnd, color: colors.bottom, grow: 1.02 });
    if (hem > waistline)
        spans.push({ from: waistline, to: hem, color: colors.skin });
    // The top, cut wherever its pattern changes colour.
    const cuts = new Set<number>([hem, neckline]);
    for (let t = hem; t < neckline; t += 0.075) cuts.add(Number(t.toFixed(4)));
    for (const t of [0.56, 0.58, 0.7]) if (t > hem && t < neckline) cuts.add(t);
    const ordered = [...cuts].sort((a, b) => a - b);
    for (let i = 0; i < ordered.length - 1; i++) {
        const color = topColorAt(ctx, (ordered[i] + ordered[i + 1]) / 2, hem);
        const last = spans[spans.length - 1];
        if (last.grow === cloth && last.color === color)
            last.to = ordered[i + 1];
        else
            spans.push({
                from: ordered[i],
                to: ordered[i + 1],
                color,
                grow: cloth,
            });
    }
    if (neckline < 1) spans.push({ from: neckline, to: 1, color: colors.skin });

    // Ink only where cloth meets skin or another garment, not between stripes.
    const lined: Span[] = [];
    spans.forEach((span, i) => {
        const previous = spans[i - 1];
        const samePiece =
            previous && previous.grow === cloth && span.grow === cloth;
        if (!previous || samePiece) lined.push({ ...span });
        else {
            const pair = withInkLines(
                [lined.pop() as Span, { ...span }],
                colors.ink,
                line
            );
            lined.push(...pair);
        }
    });

    const rows = spanRows(lined, 0.05, colors.ink, (t, grow) =>
        torsoRow(ctx, t, grow)
    );
    const bottom = torsoSection(ctx, -0.1).center;
    builder.loft(rows, bottom, "center");
}

function buildNeck(ctx: ToonContext) {
    const { builder, colors, layout, recipe } = ctx;
    const { neck, torso, head } = layout;
    const from = neck.bottom - 0.03;
    const to = neck.top;
    const length = to - from;
    const collarTop =
        recipe.outfit.top === "turtleneck"
            ? lerp(neck.bottom, layout.head.center[1] - head.down, 0.75)
            : neck.bottom + Math.min(0.012, length * 0.2);
    const hasCollar = !["tank", "crop"].includes(recipe.outfit.top);
    const spans: Span[] = hasCollar
        ? withInkLines(
              [
                  { from, to: collarTop, color: colors.top, grow: 1.22 },
                  { from: collarTop, to, color: colors.skin },
              ],
              colors.ink,
              layout.ink
          )
        : [{ from, to, color: colors.skin }];
    const z0 = torso.lean;
    const z1 = head.center[2] - head.halfDepth * 0.12;
    const rows = spanRows(spans, 0.03, colors.ink, (y, grow) => {
        const f = (y - from) / length;
        return {
            points: ellipse(
                [0, y, lerp(z0, z1, f)],
                Z,
                X,
                neck.radius * grow,
                neck.radius * grow,
                LIMB_SEGMENTS
            ),
            weights: chainWeights(
                y,
                [
                    [from, "upperChest"],
                    [neck.bottom, "neck"],
                    [layout.joints.head[1], "head"],
                ],
                length * 0.22
            ),
        };
    });
    builder.loft(rows, "center", "center");
}

function sleevePlan(ctx: ToonContext, armLength: number) {
    const { outfit } = ctx.recipe;
    const { top, outer } = ctx.colors;
    const coat = outfit.outer === "coat" || outfit.outer === "jacket";
    if (coat) return { end: armLength * 0.93, color: outer, grow: 1.5 };
    switch (outfit.top) {
        case "tee":
            return { end: armLength * 0.27, color: top, grow: 1.42 };
        case "crop":
            return { end: armLength * 0.16, color: top, grow: 1.4 };
        case "longsleeve":
        case "turtleneck":
            return { end: armLength * 0.93, color: top, grow: 1.22 };
        case "hoodie":
            return { end: armLength * 0.93, color: top, grow: 1.5 };
        default:
            return null;
    }
}

function buildArm(ctx: ToonContext, sideName: "left" | "right") {
    const { builder, colors, layout, recipe } = ctx;
    const sign = sideName === "left" ? 1 : -1;
    const direction: Vec3 = [sign, 0, 0];
    const shoulder = layout.joints[`${sideName}UpperArm`];
    const { radius, upper, lower } = layout.arm;
    const armLength = upper + lower;
    const from = -radius * 0.8;
    const sleeve = sleevePlan(ctx, armLength);
    const wrist = recipe.extras.wrist;

    let spans: Span[] = [];
    if (sleeve) {
        spans.push({
            from,
            to: sleeve.end,
            color: sleeve.color,
            grow: sleeve.grow,
        });
        spans.push({ from: sleeve.end, to: armLength, color: colors.skin });
    } else spans.push({ from, to: armLength, color: colors.skin });
    // One wristband, on the left, like a watch.
    if (wrist !== "none" && sideName === "left") {
        const at = armLength * 0.86;
        const width = wrist === "watch" ? radius * 1.5 : radius * 0.9;
        const color = wrist === "watch" ? colors.ink : colors.metal;
        const last = spans.pop() as Span;
        if (last.from < at)
            spans.push(
                { ...last, to: at },
                {
                    from: at,
                    to: at + width,
                    color,
                    grow: (last.grow ?? 1) * 1.32,
                },
                { ...last, from: at + width }
            );
        else spans.push(last);
    }
    spans = withInkLines(spans, colors.ink, layout.ink);

    const bones: [number, ToonBone][] = [
        [from, `${sideName}UpperArm`],
        [upper, `${sideName}LowerArm`],
        [armLength, `${sideName}Hand`],
    ];
    // u cross v must follow the arm: y cross z = +x, z cross y = -x.
    const u = sign > 0 ? Y : Z;
    const v = sign > 0 ? Z : Y;
    const rows = spanRows(spans, armLength / 14, colors.ink, (s, grow) => {
        const taper = lerp(1, 0.86, smoothstep(0, armLength, s));
        return {
            points: ellipse(
                addScaled(shoulder, direction, s),
                u,
                v,
                radius * taper * grow,
                radius * taper * grow,
                LIMB_SEGMENTS
            ),
            weights: chainWeights(s, bones, upper * 0.34),
        };
    });
    // A round shoulder: the arm starts as a dome inside the torso.
    const rootGrow = spans[0].grow ?? 1;
    const dome: Row[] = [0.86, 0.5].map((sine) => ({
        points: ellipse(
            addScaled(shoulder, direction, from - radius * rootGrow * sine),
            u,
            v,
            radius * rootGrow * Math.sqrt(1 - sine * sine),
            radius * rootGrow * Math.sqrt(1 - sine * sine),
            LIMB_SEGMENTS
        ),
        weights: rigid(`${sideName}UpperArm`),
        color: spans[0].color,
    }));
    builder.loft(
        [...dome, ...rows],
        addScaled(shoulder, direction, from - radius * rootGrow),
        "center"
    );
    buildHand(ctx, sideName, addScaled(shoulder, direction, armLength));
}

function buildHand(ctx: ToonContext, sideName: "left" | "right", wrist: Vec3) {
    const { builder, colors, layout } = ctx;
    const sign = sideName === "left" ? 1 : -1;
    const size = layout.arm.hand;
    const style = {
        color: colors.skin,
        weights: rigid(`${sideName}Hand`),
    };
    const palm: Vec3 = [wrist[0] + sign * size * 0.42, wrist[1], wrist[2]];
    blob(builder, {
        ...style,
        center: palm,
        radii: [size * 0.5, size * 0.27, size * 0.46],
        rings: 7,
        segments: 12,
    });
    // Three fingers and a thumb: chunky enough to read at a distance.
    const finger = size * 0.14;
    for (const [offset, reach] of [
        [-0.28, 0.8],
        [0, 1],
        [0.28, 0.85],
    ]) {
        const base: Vec3 = [
            palm[0] + sign * size * 0.28,
            palm[1],
            palm[2] + offset * size,
        ];
        tube(
            builder,
            [0, 0.5, 1].map((f) => ({
                ...style,
                outline: 0.7,
                at: [
                    base[0] + sign * size * 0.42 * reach * f,
                    base[1] - size * 0.05 * f * f,
                    base[2] + offset * size * 0.08 * f,
                ] as Vec3,
                ru: finger * (1 - f * 0.1),
            })),
            { segments: 8, start: "open" }
        );
    }
    const thumb: Vec3 = [
        palm[0] - sign * size * 0.05,
        palm[1],
        palm[2] + size * 0.3,
    ];
    tube(
        builder,
        [0, 0.5, 1].map((f) => ({
            ...style,
            outline: 0.6,
            at: [
                thumb[0] + sign * size * 0.26 * f,
                thumb[1] - size * 0.04 * f,
                thumb[2] + size * 0.3 * f,
            ] as Vec3,
            ru: finger * 1.05 * (1 - f * 0.1),
        })),
        { segments: 8, start: "open" }
    );
}

function legPlan(ctx: ToonContext, legLength: number, upper: number) {
    const { outfit } = ctx.recipe;
    switch (outfit.bottom) {
        case "pants":
            return { end: legLength * 0.95, grow: 1.3, growEnd: 1.24 };
        case "flares":
            return { end: legLength * 0.97, grow: 1.26, growEnd: 2.1 };
        case "shorts":
            return { end: upper * 0.72, grow: 1.5, growEnd: 1.6 };
        default:
            return null;
    }
}

function buildLeg(ctx: ToonContext, sideName: "left" | "right") {
    const { builder, colors, layout, recipe } = ctx;
    const hip = layout.joints[`${sideName}UpperLeg`];
    const { radius, upper, lower } = layout.leg;
    const legLength = upper + lower;
    const from = -radius * 1.4;
    const plan = legPlan(ctx, legLength, upper);
    const boots = recipe.outfit.shoes === "boots";
    const bootTop = legLength - lower * 0.5;

    let spans: Span[] = [];
    if (plan) {
        spans.push({
            from,
            to: plan.end,
            color: colors.bottom,
            grow: plan.grow,
            growEnd: plan.growEnd,
        });
        if (plan.end < legLength)
            spans.push({ from: plan.end, to: legLength, color: colors.skin });
    } else spans.push({ from, to: legLength, color: colors.skin });
    if (boots) {
        // Trousers tuck into boots; bare legs and shorts stop above them.
        spans = spans
            .filter((span) => span.from < bootTop)
            .map((span) => ({ ...span, to: Math.min(span.to, bootTop) }));
        spans.push({
            from: bootTop,
            to: legLength,
            color: colors.shoe,
            grow: 1.55,
        });
    }
    spans = withInkLines(spans, colors.ink, layout.ink);

    const bones: [number, ToonBone][] = [
        [from, `${sideName}UpperLeg`],
        [upper, `${sideName}LowerLeg`],
        [legLength + radius, `${sideName}Foot`],
    ];
    // Thighs fill the hips where they leave the torso, then slim down, so
    // trousers read as one garment instead of a bulb with two pipes.
    const seat = Math.max(layout.torso.hips * 0.53, radius);
    const rows = spanRows(spans, legLength / 16, colors.ink, (s, grow) => {
        const taper = lerp(1.08, 0.9, smoothstep(0, legLength, s));
        const slim = smoothstep(from, upper * 0.55, s);
        const r = radius * taper * grow;
        return {
            // x cross z = -y: the loft runs down the leg.
            points: ellipse(
                [hip[0], hip[1] - s, hip[2]],
                X,
                Z,
                lerp(Math.max(seat, r), r, slim),
                lerp(Math.max(seat * 1.25, r), r, slim),
                LIMB_SEGMENTS
            ),
            weights: chainWeights(s, bones, upper * 0.3),
        };
    });
    builder.loft(rows, [hip[0], hip[1] - from + radius, hip[2]], "center");
    buildFoot(ctx, sideName);
}

function buildFoot(ctx: ToonContext, sideName: "left" | "right") {
    const { builder, colors, layout, recipe } = ctx;
    const ankle = layout.joints[`${sideName}Foot`];
    const { length, height, width } = layout.foot;
    const style = recipe.outfit.shoes;
    const bare = style === "barefoot";
    const color = bare ? colors.skin : colors.shoe;
    const tall = height * (style === "boots" ? 1.5 : bare ? 1.05 : 1.25);
    const heel = -length * 0.3;
    const toe = length * 0.72;
    const toesAt = layout.joints[`${sideName}Toes`][2];
    const weights = (point: Vec3): Weights => {
        const w = smoothstep(
            toesAt - length * 0.12,
            toesAt + length * 0.12,
            point[2]
        );
        return [
            [boneIndex(`${sideName}Foot`), 1 - w],
            [boneIndex(`${sideName}Toes`), w],
        ];
    };
    const shoe = (grow: number, top: number, bottom: number, rgb: Rgb) => {
        const rows: Row[] = [];
        const count = 9;
        for (let i = 0; i <= count; i++) {
            const f = i / count;
            const z = lerp(heel, toe, f);
            // Round heel, full instep, lower rounded toe.
            const profile = Math.pow(
                Math.sin(Math.PI * lerp(0.08, 0.94, f)),
                0.55
            );
            const lift = lerp(1, bare ? 0.55 : 0.62, smoothstep(0.35, 1, f));
            const half = ((top - bottom) * lift) / 2;
            rows.push({
                color: rgb,
                weights,
                points: ellipse(
                    [ankle[0], bottom + half, ankle[2] + z],
                    X,
                    Y,
                    (width / 2) * profile * grow,
                    half * lerp(0.75, 1, profile),
                    LIMB_SEGMENTS,
                    2.8
                ),
            });
        }
        builder.loft(
            rows,
            [
                ankle[0],
                bottom + (top - bottom) * 0.5,
                ankle[2] + heel - length * 0.04,
            ],
            [
                ankle[0],
                bottom + (top - bottom) * 0.3,
                ankle[2] + toe + length * 0.05,
            ]
        );
    };
    if (style === "sneakers") {
        shoe(1.08, tall * 0.34, 0, colors.sole);
        shoe(1, tall, tall * 0.2, color);
    } else shoe(1, tall, 0, color);
}

function buildSkirt(ctx: ToonContext) {
    const { builder, colors, layout } = ctx;
    const { waistline } = torsoPlan(ctx);
    const top = torsoSection(ctx, waistline);
    const knee = layout.joints.leftLowerLeg[1];
    const bottomY = lerp(knee, layout.torso.bottom, 0.25);
    const flare = Math.max(layout.torso.hips * 1.45, layout.leg.spread * 2.1);
    const rows: Row[] = [];
    const count = 7;
    for (let i = 0; i <= count; i++) {
        const f = i / count;
        const y = lerp(top.center[1], bottomY, f);
        const width = lerp(top.width * 1.1, flare, Math.pow(f, 0.8));
        const depth = lerp(top.depth * 1.1, flare * 0.8, Math.pow(f, 0.8));
        const sway = smoothstep(0.15, 1, f);
        rows.push({
            color: colors.bottom,
            points: ellipse(
                [0, y, top.center[2] * (1 - f)],
                X,
                Z,
                width,
                depth,
                TORSO_SEGMENTS
            ),
            weights: (point) => {
                const left = smoothstep(-width * 0.5, width * 0.5, point[0]);
                return [
                    [boneIndex("hips"), 1 - sway * 0.45],
                    [boneIndex("leftUpperLeg"), sway * 0.45 * left],
                    [boneIndex("rightUpperLeg"), sway * 0.45 * (1 - left)],
                ];
            },
        });
    }
    // Insert a crisp ink hem as its own last segment.
    const last = rows[rows.length - 1];
    const hemY = bottomY + layout.ink;
    rows.splice(rows.length - 1, 0, {
        ...last,
        color: colors.ink,
        points: last.points.map((p) => [p[0], hemY, p[2]] as Vec3),
    });
    builder.loft(rows, "center", [0, bottomY + flare * 0.25, 0]);
}

/** Open-fronted layer over the torso: lab coat, jacket or vest. */
function buildOuter(ctx: ToonContext) {
    const { builder, colors, layout, recipe } = ctx;
    const style = recipe.outfit.outer;
    if (style === "none") return;
    const { torso } = layout;
    const length = torso.top - torso.bottom;
    const knee = layout.joints.leftLowerLeg[1];
    const bottomY =
        style === "coat"
            ? lerp(knee, torso.bottom, -0.15)
            : style === "jacket"
            ? torso.bottom + length * 0.16
            : torso.bottom + length * 0.3;
    const bottomT = (bottomY - torso.bottom) / length;
    const topT = 0.93;
    const half = 18;
    const count = style === "coat" ? 16 : 9;
    const thickness = 0.012;

    const outerRows: Vec3[][] = [];
    const rows: (VertexStyle & { outer: Vec3[]; inner: Vec3[] })[] = [];
    for (let i = 0; i <= count; i++) {
        const t = lerp(bottomT, topT, i / count);
        const section = torsoSection(ctx, Math.max(t, 0));
        const below = Math.max(0, -t);
        const flare = 1.14 + below * 0.55;
        const center: Vec3 = [
            0,
            torso.bottom + length * t,
            section.center[2] * (t < 0 ? 0.5 : 1),
        ];
        // The gap in front widens toward the hem so the coat hangs open.
        const gap = lerp(0.5, 0.2, smoothstep(bottomT, topT, t)) + below * 0.2;
        const arc = (grow: number) => {
            const points: Vec3[] = [];
            for (let j = 0; j <= half * 2; j++) {
                const angle = gap + (j / (half * 2)) * (Math.PI * 2 - gap * 2);
                const c =
                    Math.sign(Math.cos(angle)) *
                    Math.pow(Math.abs(Math.cos(angle)), 0.85);
                const s =
                    Math.sign(Math.sin(angle)) *
                    Math.pow(Math.abs(Math.sin(angle)), 0.85);
                // Angle 0 is straight ahead; the arc runs z toward x.
                points.push([
                    center[0] + s * (section.width * flare + grow),
                    center[1],
                    center[2] + c * (section.depth * flare + grow),
                ]);
            }
            return points;
        };
        const outer = arc(thickness);
        outerRows.push(outer);
        const sway = smoothstep(0.05, -0.5, t);
        rows.push({
            color: colors.outer,
            outer,
            inner: arc(0),
            weights:
                t >= 0.05
                    ? torsoWeights(t)
                    : (point) => {
                          const left = smoothstep(-0.1, 0.1, point[0]);
                          return [
                              [boneIndex("hips"), 1 - sway * 0.8],
                              [boneIndex("coatTail"), sway * 0.5],
                              [boneIndex("leftUpperLeg"), sway * 0.3 * left],
                              [
                                  boneIndex("rightUpperLeg"),
                                  sway * 0.3 * (1 - left),
                              ],
                          ];
                      },
        });
    }
    builder.shell(rows);
    const n = half * 2 + 1;
    // Ink piping down both front edges, and around the hem.
    const piping = layout.ink * 0.6;
    for (const edge of [0, n - 1]) {
        tube(
            builder,
            outerRows.map((outer, i) => ({
                at: outer[edge],
                ru: piping,
                color: colors.ink,
                outline: 0,
                weights:
                    typeof rows[i].weights === "function"
                        ? (rows[i].weights as (p: Vec3) => Weights)(outer[edge])
                        : rows[i].weights,
            })),
            { segments: 6 }
        );
    }
    const hem = outerRows[0];
    tube(
        builder,
        hem.map((at) => ({
            at,
            ru: piping,
            color: colors.ink,
            outline: 0,
            weights:
                typeof rows[0].weights === "function"
                    ? (rows[0].weights as (p: Vec3) => Weights)(at)
                    : rows[0].weights,
        })),
        { segments: 6 }
    );
}

function buildHood(ctx: ToonContext) {
    const { builder, colors, layout } = ctx;
    const { neck, torso } = layout;
    blob(builder, {
        color: colors.top,
        weights: [
            [boneIndex("upperChest"), 0.7],
            [boneIndex("neck"), 0.3],
        ],
        center: [0, neck.bottom + 0.005, torso.lean - neck.radius * 1.5],
        radii: [torso.shoulder * 0.8, neck.radius * 1.5, neck.radius * 1.7],
        rings: 7,
        segments: 14,
    });
}

export function buildBody(ctx: ToonContext) {
    buildTorso(ctx);
    buildNeck(ctx);
    buildArm(ctx, "left");
    buildArm(ctx, "right");
    buildLeg(ctx, "left");
    buildLeg(ctx, "right");
    if (ctx.recipe.outfit.bottom === "skirt") buildSkirt(ctx);
    if (ctx.recipe.outfit.top === "hoodie") buildHood(ctx);
    buildOuter(ctx);
}
