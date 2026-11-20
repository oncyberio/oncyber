import * as T from "three/webgpu";
import {
    Drawing,
    ellipse,
    frontOfLoft,
    lift,
    type Depth,
    type XY,
} from "./drawing";
import type { Point } from "./sculpt";
import { finish } from "./surfaces";
import { measuredStreetHead } from "./measuredStreetHead";
import {
    type StreetPattern,
    sheetScale,
    streetShade,
} from "./streetwearPattern";

const tau = 2 * Math.PI,
    mix = T.MathUtils.lerp;
const ring = (count: number, at: (angle: number) => Point) =>
    Array.from({ length: count + 1 }, (_, i) =>
        at((tau * (i % count)) / count)
    );
const signed = (v: number, p: number) =>
    Math.sign(v) * Math.pow(Math.abs(v), p);
const frame = () =>
    new T.Matrix4()
        .makeScale(sheetScale, sheetScale, sheetScale)
        .setPosition(350, 0, 0);
function horizontal(
    y: number,
    width: number,
    front: number,
    back: number,
    slope = 0,
    warp = 0
) {
    return ring(24, (a) => {
        const x = width * signed(Math.sin(a), 0.91),
            c = Math.cos(a);
        const z = (front - back) / 2 + ((front + back) / 2) * signed(c, 0.9);
        return [x, y + x * slope + warp * Math.sin(3 * a + 0.4), z];
    });
}
function line(d: Drawing, xy: XY[], depth: Depth, r: number, paint: string) {
    d.s.ribbon(
        xy.map(([x, y]) => [x, y, depth(x, y) + 1.15] as Point),
        r,
        paint
    );
}

/** Bake the fitted light across the garment vertices. Back-facing cloth has
 * its own continuous folded shading as the front samples fall out of view. */
function clothTone(
    stations: number[][],
    rear: (x: number, y: number, z: number) => number
) {
    function across(row: number[], x: number) {
        const t =
            T.MathUtils.clamp((x - row[1]) / (row[2] - row[1]), 0, 1) * 12;
        const i = Math.min(11, Math.floor(t));
        return mix(row[3 + i], row[4 + i], t - i) / 128;
    }
    return (x: number, y: number, z: number) => {
        let j = 1;
        while (j < stations.length - 1 && y > stations[j][0]) j++;
        const a = stations[j - 1],
            b = stations[j];
        const t = T.MathUtils.clamp((y - a[0]) / (b[0] - a[0]), 0, 1);
        const light = mix(across(a, x), across(b, x), t);
        return mix(
            rear(x, y, z),
            T.MathUtils.clamp(light, 0.59, 1.34) ** 1.55,
            T.MathUtils.smoothstep(z, 8, 63)
        );
    };
}

/** Keep the fold's pigment and raised ridge on the same free-moving panel. */
function foldRings(
    rings: Point[][],
    spacing: number,
    tone: (x: number, y: number, z: number) => number
) {
    const result: Point[][] = [rings[0]];
    for (let i = 1; i < rings.length; i++) {
        const previous = rings[i - 1],
            next = rings[i];
        const count = Math.max(
            1,
            Math.ceil(Math.abs(next[0][1] - previous[0][1]) / spacing)
        );
        for (let j = 1; j <= count; j++) {
            const t = j / count;
            result.push(
                next.map(([x, y, z], k): Point => {
                    const a = previous[k],
                        px = mix(a[0], x, t),
                        py = mix(a[1], y, t),
                        pz = mix(a[2], z, t);
                    return [
                        px,
                        py,
                        pz +
                            T.MathUtils.smoothstep(pz, 14, 66) *
                                5 *
                                (tone(px, py, pz) - 1),
                    ];
                })
            );
        }
    }
    return result;
}
function shirt(d: Drawing, p: StreetPattern) {
    d.torso();
    const first = p.shirt[0],
        last = p.shirt.at(-1);
    const top = ring(24, (a) => [
        29 * Math.sin(a),
        first[0] - 12 + 15 * Math.max(0, Math.cos(a)),
        20 + 24 * Math.cos(a),
    ]);
    const body = [
        top,
        ...p.shirt.map(([y, w, f, b], i) => {
            const t = i / (p.shirt.length - 1);
            return horizontal(
                y,
                w,
                f,
                b,
                -0.115 * Math.pow(t, 3.6),
                5 * t * t
            ).map(([x, h, z], j): Point => {
                const a = (tau * j) / 24;
                return [
                    x,
                    h,
                    z +
                        Math.cos(a) *
                            t *
                            (4 * Math.sin(5 * a + 1.7 * t) +
                                3 * Math.cos(8 * a - t)),
                ];
            });
        }),
    ];
    const tint = clothTone(
        p.panels.tee,
        (x, y, z) =>
            0.94 +
            0.1 * Math.cos(0.07 * x + 0.013 * y + 0.02 * z) -
            0.07 * Math.cos(0.05 * x - 0.015 * y)
    );
    const rows = foldRings(body, d.s.detail === "full" ? 14 : 27, tint);
    d.s.tone = tint;
    d.s.surface(rows, p.colors.tee, false, "perimeter");
    d.s.tone = undefined;
    const cloth = frontOfLoft(rows);
    const binding = top.map(
        ([x, y, z]): Point => [x * 1.22, y + 4, (z - 20) * 1.23 + 20]
    );
    d.s.surface(
        [
            top.map(
                ([x, y, z]): Point => [x * 0.91, y + 4, (z - 20) * 0.91 + 20]
            ),
            top,
            binding,
        ],
        streetShade(p.colors.tee, "#2b2426", "#231e21"),
        true
    );
    for (const [i, mark] of p.print.entries()) {
        d.s.fineDetail = true;
        d.decal(mark.edge as XY[], lift(cloth, 2.8 + i * 0.026), mark.paint);
    }
    d.s.fineDetail = false;
    const edge = rows.at(-1);
    d.s.surface(
        [edge, edge.map(([x, y, z]): Point => [x * 0.974, y - 0.8, z * 0.97])],
        streetShade(p.colors.tee, "#2b2426", "#211b20")
    );
    const under = [
        horizontal(last[0] - 25, last[1] - 5, last[2] - 7, last[3] - 6, -0.1),
        horizontal(
            last[0] + 6,
            last[1] - 8,
            last[2] - 5,
            last[3] - 7,
            -0.11,
            3
        ),
        horizontal(p.belt.height + 1, 106, 92, 37, p.belt.slope, 2),
    ];
    d.s.tone = (x, y, z) =>
        0.9 + 0.12 * Math.sin(x * 0.045 + 0.23 * y + 0.02 * z);
    d.s.surface(under, p.colors.under);
    d.s.tone = undefined;
    d.s.endTorso();
}

function arms(d: Drawing, p: StreetPattern) {
    const { shoulder, elbow, wrist, height, cuff, hem } = p.arm;
    for (const s of [-1, 1]) {
        const side = s < 0 ? "right" : "left",
            arm = side + "UpperArm",
            fore = side + "LowerArm";
        d.bind(arm);
        d.s.drape = {
            name: "upperChest",
            matrix: d.matrixFor("upperChest"),
            start: 0,
            end: 1,
            weight: (x) =>
                1 -
                T.MathUtils.smoothstep(
                    Math.abs(x),
                    shoulder - 23,
                    shoulder + 36
                ),
        };
        const sleeve = [
            [shoulder - 24, 220, 344, 46],
            [shoulder + 13, 215, 357, 53],
            [shoulder + 32, 222, 346, 52],
            [cuff - 37, 228, 349, 46],
            [cuff, 232, hem, 43],
        ];
        const rings = sleeve.map(([x, top, bot, depth], i) =>
            ring(16, (a) => {
                const end = i === sleeve.length - 1 ? 1 : 0,
                    c = Math.cos(a),
                    h = (bot - top) / 2;
                return [
                    s * (x - (15 * end * (1 - Math.sin(a))) / 2),
                    (top + bot) / 2 - h * Math.sin(a),
                    depth * c + 5 + 4 * Math.sin(2 * a + i * 0.6),
                ];
            })
        );
        d.s.tone = (x, y, z) =>
            0.88 + 0.09 * Math.sin(y * 0.029 - Math.abs(x) * 0.039 + 0.025 * z);
        d.s.surface(rings, p.colors.tee);
        d.s.tone = undefined;
        const rim = rings.at(-1);
        d.s.surface(
            [
                rim,
                rim.map(
                    ([x, y, z]): Point => [
                        x - s * 4,
                        mix(y, (hem + 232) / 2, 0.08),
                        z * 0.91,
                    ]
                ),
            ],
            streetShade(p.colors.tee, "#2b2426", "#19171b")
        );
        d.s.surface(
            [
                rim.map(
                    ([x, y, z]): Point => [
                        x - s * 4,
                        mix(y, (hem + 232) / 2, 0.08),
                        z * 0.91,
                    ]
                ),
                rim.map((): Point => [s * (cuff - 8), height + 8, 4]),
            ],
            streetShade(p.colors.tee, "#2b2426", "#292327")
        );
        d.bind(arm);
        d.s.drape = {
            name: fore,
            matrix: d.matrixFor(fore),
            start: 0,
            end: 1,
            weight: (x) =>
                T.MathUtils.smoothstep(Math.abs(x), elbow - 22, elbow + 24),
        };
        const armRows = [
            [shoulder + 13, 14, 17, 0],
            [cuff - 14, 17, 17, 0],
            [elbow + 17, 17.5, 18, 1],
            [mix(elbow, wrist, 0.63), 12.6, 14, 2],
            [wrist + 3, 9.6, 12, 3],
        ].map(([x, r, rz, dy]) =>
            ring(12, (a) => [
                s * x,
                height + dy + r * Math.sin(a),
                1 + rz * Math.cos(a),
            ])
        );
        d.s.gradient = {
            top: height - 10,
            bottom: height + 19,
            from: p.colors.skin,
            to: streetShade(p.colors.skin, "#fdd8b6", "#e8b48c"),
        };
        d.s.surface(armRows, p.colors.skin);
        d.s.gradient = undefined;
        // The native phalanges keep their own skin weights and grip/release.
        d.bind(side + "Hand");
        d.s.referenceFrame = undefined;
        const w = d.sourceJoints.get(side + "Hand").point;
        const tip = d.sourceJoints.get(side + "MiddleProximal").point;
        d.s.surface(
            [0, 0.43, 1].map((t, i) =>
                ring(12, (a) => [
                    mix(w[0], tip[0], t),
                    mix(w[1], tip[1], t) + [6.7, 8, 5.2][i] * Math.sin(a),
                    mix(w[2], tip[2], t) + [8.3, 13.6, 12.4][i] * Math.cos(a),
                ])
            ),
            p.colors.skin
        );
        d.fingers(side, p.colors.skin, 3.75, d.s.detail === "full");
        d.s.referenceFrame = frame();
    }
}

function footwear(d: Drawing, p: StreetPattern, sign: number) {
    const foot = p.shoe,
        cx = sign * foot.center;
    d.bind(sign < 0 ? "rightFoot" : "leftFoot");
    const section = (y: number, w: number, front: number, back: number) =>
        ring(20, (a) => [
            cx + w * signed(Math.sin(a), 0.7),
            y,
            (front - back) / 2 +
                ((front + back) / 2) * signed(Math.cos(a), 0.65),
        ]);
    const f = foot.toe,
        b = foot.heel,
        w = foot.width;
    const sole = [
        section(969, w - 1, f - 1, b - 1),
        section(974, w + 1, f + 1, b),
        section(1002, w, f, b),
        section(1008, w - 3, f - 2, b - 3),
    ];
    d.s.surface(
        [...sole, sole.at(-1).map((): Point => [cx, 1008, (f - b) / 2])],
        "#c8bca5"
    );
    d.s.surface(
        [section(972, w + 1.1, f + 1.3, b), section(975, w + 1.4, f + 1.4, b)],
        "#978d7e"
    );
    d.s.gradient = {
        top: 914,
        bottom: 971,
        from: streetShade(p.colors.shoe, "#f5e8d3", "#ffefd8"),
        to: p.colors.shoe,
    };
    d.s.surface(
        [
            ring(20, () => [cx, 906, 25]),
            section(909, 18, 58, 14),
            section(914, 34, 89, 22),
            section(926, 46, 129, 30),
            section(949, w - 3, f - 3, b - 1),
            sole[0],
        ],
        p.colors.shoe
    );
    d.s.gradient = undefined;
}

function trousers(d: Drawing, p: StreetPattern) {
    const split = 665,
        knee = 771,
        belt = p.belt;
    // A continuous seat starts under the tilted belt. The fly extends down
    // between the two leg tubes, even when one thigh swings forward.
    d.bind("hips");
    const waist = p.jeans[1][2];
    const seat = [
        horizontal(521, waist - 8, 90, 36, belt.slope),
        horizontal(560, waist - 4, 91, 35, belt.slope),
        horizontal(591, waist + 1, 94, 37),
        horizontal(618, waist + 1, 91, 34),
        horizontal(642, 81, 89, 29),
        horizontal(660, 38, 83, 26),
        horizontal(670, 6, 69, 18),
    ];
    const seatFront = frontOfLoft(seat);
    d.s.surface(seat, p.colors.denim);
    const fronts = [seatFront];
    for (const s of [-1, 1]) {
        const side = s < 0 ? "right" : "left";
        const cuff = s < 0 ? p.cuffs.rightLeg : p.cuffs.leftLeg;
        const hemAt = (x: number) => {
            let i = 1;
            while (i < cuff.length - 1 && cuff[i][0] < x) i++;
            const [lo, y0] = cuff[i - 1],
                [hi, y1] = cuff[i];
            return mix(y0, y1, T.MathUtils.clamp((x - lo) / (hi - lo), 0, 1));
        };
        const garment = p.jeans.map(([y, inner, outer, f, b, tilt], i) =>
            ring(d.s.detail === "full" ? 20 : 16, (a) => {
                const leg = T.MathUtils.smoothstep(y, split - 55, split + 15),
                    u = Math.sin(a),
                    c = Math.cos(a);
                const hipWidth =
                    i === 0 ? Math.max(outer, p.jeans[1][2] - 3) : outer;
                const low = i >= p.jeans.length - 2;
                const outside =
                    i === p.jeans.length - 1
                        ? Math.max(outer, p.shoe.center + p.shoe.width + 1)
                        : hipWidth;
                const inside = low ? Math.min(inner, 26) : inner;
                const x = mix(
                    hipWidth * Math.max(0, u),
                    (inside + outside) / 2 + ((outside - inside) / 2) * u,
                    leg
                );
                const rear = b,
                    fore =
                        y >= 898
                            ? Math.max(
                                  f,
                                  102 + 25 * T.MathUtils.smoothstep(y, 898, 955)
                              )
                            : f;
                const hem = hemAt(x);
                const frontHem =
                    T.MathUtils.smoothstep(y, 834, 983) *
                    (983 - hem) *
                    T.MathUtils.smoothstep(c, -0.15, 0.27);
                const ridge =
                    tilt *
                    c *
                    (1.25 * Math.sin(a + 0.4) - 0.75 * c) *
                    (1 - T.MathUtils.smoothstep(y, 940, 983));
                const height = y + ridge - frontHem;
                const gap = hem - height;
                const fold = (at: number, spread: number) =>
                    Math.exp(-(((gap - at) / spread) ** 2));
                const overlap =
                    T.MathUtils.smoothstep(c, -0.1, 0.48) *
                    (12 * fold(7, 6) -
                        10 * fold(15, 5) +
                        15 * fold(31, 8) -
                        11 * fold(42, 6));
                return [
                    s * x,
                    height,
                    (fore - rear) / 2 +
                        ((fore + rear) / 2) * c +
                        overlap +
                        leg * c * 5 * Math.sin(2 * a + (y - 650) * 0.027),
                ];
            })
        );
        const sampled = clothTone(
            s < 0 ? p.panels.rightLeg : p.panels.leftLeg,
            (x, y, z) =>
                0.97 +
                0.1 * Math.cos(0.042 * x - 0.011 * y) +
                0.14 *
                    Math.sin(0.052 * y + 0.045 * Math.abs(x) + 0.014 * z) *
                    T.MathUtils.smoothstep(y, 640, 870)
        );
        const tint = (x: number, y: number, z: number) => {
            const d = hemAt(Math.abs(x)) - y;
            const contact =
                0.21 * Math.exp(-(((d - 15) / 6) ** 2)) +
                0.25 * Math.exp(-(((d - 41) / 8) ** 2));
            return (
                sampled(x, y, z) *
                (1 - contact * T.MathUtils.smoothstep(z, 32, 88))
            );
        };
        const splitRow = p.jeans.findIndex((r) => r[0] >= knee);
        const upper = foldRings(
                garment.slice(0, splitRow + 1),
                d.s.detail === "full" ? 14 : 29,
                tint
            ),
            lower = foldRings(
                garment.slice(splitRow),
                d.s.detail === "full" ? 12 : 24,
                tint
            );
        lower[0] = upper.at(-1);
        const face = frontOfLoft([...upper, ...lower.slice(1)]);
        const color = p.colors.denim;
        d.s.tone = tint;
        // Hold the color extrema at the knee and cuff through edge collapse.
        d.s.preserveVertex = (x, y, z) =>
            z > 35 && y > 630 && (tint(x, y, z) < 0.78 || tint(x, y, z) > 1.12);
        d.drape("hips", side + "UpperLeg", belt.height + 10, knee - 35);
        d.s.surface(upper, color, false, "perimeter");
        d.drape(
            side + "UpperLeg",
            side + "LowerLeg",
            p.jeans[splitRow][0],
            p.jeans[splitRow][0] + 54
        );
        const bottom = lower.at(-1);
        d.s.surface(
            [
                ...lower,
                bottom.map(
                    ([x, y, z]): Point => [
                        mix(x, s * p.shoe.center, 0.045),
                        y - 1,
                        z * 0.96,
                    ]
                ),
            ],
            color,
            false,
            "perimeter"
        );
        d.s.tone = undefined;
        d.s.preserveVertex = undefined;
        fronts.push(face);
        const shadow = new T.Color(color).multiplyScalar(0.62).getStyle();
        const creases = s < 0 ? p.creases.rightLeg : p.creases.leftLeg;
        // Clip the fitted fold to each half of the moving knee. Both halves
        // use the exact drape weights of the cloth they touch.
        for (const below of [false, true]) {
            const yCut = p.jeans[splitRow][0];
            if (below)
                d.drape(side + "UpperLeg", side + "LowerLeg", yCut, yCut + 54);
            else
                d.drape("hips", side + "UpperLeg", belt.height + 10, knee - 35);
            for (const loop of creases) {
                if (d.s.detail === "crowd" && loop.length < 9) continue;
                const edge: XY[] = [];
                for (let i = 0; i < loop.length; i++) {
                    const a = loop[i],
                        b = loop[(i + 1) % loop.length];
                    if (a[1] >= yCut === below) edge.push([a[0], a[1]]);
                    if (a[1] >= yCut !== b[1] >= yCut)
                        edge.push([
                            mix(a[0], b[0], (yCut - a[1]) / (b[1] - a[1])),
                            yCut,
                        ]);
                }
                if (
                    edge.length >= 3 &&
                    edge.every(([x, y]) => Number.isFinite(face(x, y)))
                ) {
                    d.decal(edge, lift(face, 0.85), shadow);
                }
            }
        }
        footwear(d, p, s);
    }
    d.bind("hips");
    const denim: Depth = (x, y) => Math.max(...fronts.map((f) => f(x, y)));
    line(
        d,
        [
            [0, 574],
            [1, 600],
            [0, 630],
            [-2, 644],
        ],
        denim,
        1.1,
        "#3b3945"
    );
    line(
        d,
        [
            [22, 569],
            [24, 588],
            [23, 611],
            [16, 620],
            [1, 625],
        ],
        denim,
        0.84,
        "#403c49"
    );
    for (const s of [-1, 1]) {
        line(
            d,
            [
                [s * 76, 564],
                [s * 83, 577],
                [s * 95, 582],
                [s * 105, 585],
            ],
            denim,
            1.05,
            "#44404d"
        );
    }
    const h = belt.height,
        w = p.jeans[1][2] + 4;
    const loops = [
        horizontal(h - belt.width / 2, w, 106, 43, belt.slope),
        horizontal(h - 12, w + 1, 107, 44, belt.slope),
        horizontal(h + 12, w + 2, 107, 45, belt.slope),
        horizontal(h + belt.width / 2, w + 1, 106, 44, belt.slope),
    ];
    d.s.surface(loops, "#302a2d");
    const beltFront = frontOfLoft(loops);
    // Loops and charms overhang the strip. Carry them on the local belt
    // curvature at their attachment instead of projecting onto empty space.
    const leather: Depth = (x, y) =>
        beltFront(
            x,
            T.MathUtils.clamp(
                y,
                h + x * belt.slope - belt.width / 2 + 2,
                h + x * belt.slope + belt.width / 2 - 2
            )
        );
    for (let x = -w + 10; x < w - 2; x += 15) {
        for (const offset of [-6.4, 6.4]) {
            const y = h + x * belt.slope + offset;
            d.decal(ellipse(x, y, 3, 3), lift(leather, 1), "#d8d0be");
            d.decal(
                ellipse(x - 0.7, y - 1, 1.25, 1),
                lift(leather, 1.5),
                "#ffefda"
            );
        }
    }
    for (const x of [-48, 62, 98]) {
        const y = h + x * belt.slope;
        d.decal(
            [
                [x - 5, y - 18],
                [x + 6, y - 17],
                [x + 5, y + 17],
                [x - 5, y + 18],
            ],
            lift(leather, 1.9),
            x === 62 ? "#b9b0a3" : "#52505e"
        );
    }
    for (const [x, dy, r] of [
        [0, -3, 7],
        [22, -15, 9],
        [25, 3, 7],
        [7, 12, 7],
    ]) {
        const y = h + dy;
        d.decal(
            Array.from(
                { length: 10 },
                (_, i): XY => [
                    x + Math.sin((tau * i) / 10) * r * (i % 2 ? 0.45 : 1),
                    y - Math.cos((tau * i) / 10) * r * (i % 2 ? 0.45 : 1),
                ]
            ),
            lift(leather, 4),
            "#f3d277"
        );
    }
    const z = leather(12, h) + 5;
    for (const x of [4, 24]) {
        d.s.sweep(
            [
                [x, h + 10, z],
                [x + 3, h + 21, z + 3],
                [x + 6, h + 33, z + 4],
            ],
            [2.8, 4.8, 3.9],
            "#445d79",
            6
        );
        d.s.oval([x + 5, h + 34, z + 5], [3.8, 3.6, 2.6], "#d5caba");
    }
}

export function drawMeasuredStreetwear(d: Drawing, p: StreetPattern) {
    d.s.referenceFrame = frame();
    d.s.illustrationInk = false;
    d.s.sculptedCartoon = true;
    d.s.thinSkinOutline = true;
    d.s.palette({
        [p.colors.skin]: finish.skin,
        [p.colors.hair]: finish.fiber,
        [p.colors.denim]: finish.cloth,
        [p.colors.tee]: finish.cloth,
        [p.colors.under]: finish.cloth,
    });
    d.drape("head", "upperChest", 176, 212);
    d.s.gradient = {
        top: 178,
        bottom: 214,
        from: streetShade(p.colors.skin, "#fdd8b6", "#dfaa87"),
        to: p.colors.skin,
    };
    d.s.surface(
        [
            horizontal(164, 18, 39, 12),
            horizontal(183, 17, 36, 13),
            horizontal(202, 21, 36, 18),
            horizontal(219, 30, 37, 22),
        ],
        p.colors.skin
    );
    d.s.gradient = undefined;
    trousers(d, p);
    shirt(d, p);
    arms(d, p);
    measuredStreetHead(d, p);
    d.s.referenceFrame = undefined;
}
