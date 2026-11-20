import * as T from "three/webgpu";
import { Drawing, frontOfLoft, lift, type Depth, type XY } from "./drawing";
import type { Point } from "./sculpt";
import { finish } from "./surfaces";
import { streetYoke } from "./streetShoulder";
import { drawStreetBody, streetFrame, ring } from "./streetBody";
import { measuredStreetHead } from "./measuredStreetHead";
import { type StreetPattern, streetShade } from "./streetwearPattern";

const tau = 2 * Math.PI,
    mix = T.MathUtils.lerp;
const signed = (v: number, p: number) =>
    Math.sign(v) * Math.pow(Math.abs(v), p);
function horizontal(
    y: number,
    width: number,
    front: number,
    back: number,
    slope = 0,
    warp = 0,
    segments = 24
) {
    return ring(segments, (a) => {
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
function shirtSocket(p: StreetPattern, s: number) {
    return ring(16, (a) => [
        s * (p.arm.shoulder + 45),
        p.arm.height + 28 - 65 * Math.cos(a),
        6 + 54 * Math.sin(a),
    ]);
}
function shirt(d: Drawing, p: StreetPattern) {
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
    const join = body.findIndex((row, i) => i > 0 && row[0][1] >= 330);
    const rows = foldRings(
        body.slice(join),
        d.s.detail === "full" ? 14 : 27,
        tint
    );
    d.s.tone = tint;
    const upperFront = streetYoke(
        d,
        top,
        rows[0],
        (s) => shirtSocket(p, s),
        p.colors.tee,
        p.arm.shoulder
    );
    d.drape("chest", "hips", 345, last[0] + 19);

    d.s.tone = tint;
    d.s.surface(rows, p.colors.tee, false, "perimeter");
    d.s.tone = undefined;
    const lowerFront = frontOfLoft(rows);
    const cloth: Depth = (x, y) => Math.max(upperFront(x, y), lowerFront(x, y));
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
}

/** Each open cuff has a hem bone at the arm axis. Its local correction
 * keeps the underside hanging when the shoulder rotates, without dragging
 * the shirt front or bending the sleeve with the fingers. */
function sleeves(d: Drawing, p: StreetPattern) {
    const { shoulder, height, cuff, hem } = p.arm;
    const settle: (() => void)[] = [];
    for (const s of [-1, 1]) {
        const side = s < 0 ? "right" : "left",
            arm = side + "UpperArm",
            hemBone = side + "SleeveHem";
        const upper = d.s.bones.find((b) => b.name === arm);
        const end = d.rig.joints.get(side + "LowerArm").rest,
            start = d.rig.joints.get(arm).rest;
        const pivot = start
            .clone()
            .lerp(end, (cuff - shoulder) / (p.arm.elbow - shoulder));
        const bone = d.s.bone(hemBone, arm, pivot.toArray() as Point, false);
        const relative = new T.Quaternion(),
            identity = new T.Quaternion();
        settle.push(() => {
            relative
                .copy(upper.parent.quaternion)
                .multiply(upper.quaternion)
                .invert();
            bone.quaternion.copy(identity).slerp(relative, 0.61);
        });
        d.bind(arm);
        d.s.drape = {
            name: hemBone,
            matrix: d.matrixFor(arm),
            start: 0,
            end: 1,
            weight: (x, y) =>
                T.MathUtils.smoothstep(Math.abs(x), shoulder + 46, cuff - 6) *
                T.MathUtils.smoothstep(y, height - 6, hem - 9),
        };
        const ringAt = (x: number, t: number) =>
            ring(16, (a) => {
                const c = Math.cos(a),
                    sn = Math.sin(a),
                    top = height - 32 + 5 * t;
                const bottom = mix(height + 94, hem, t);
                return [
                    s * (x - (12 * t * (1 - c)) / 2),
                    mix(top, bottom, (1 - c) / 2),
                    6 + (49 - 6 * t) * sn + 2.3 * t * Math.sin(3 * a + 0.6),
                ];
            });
        const root = shirtSocket(p, s);
        const rows = [
            root,
            ringAt(mix(shoulder + 45, cuff, 0.35), 0.35),
            ringAt(mix(shoulder + 45, cuff, 0.72), 0.72),
            ringAt(cuff, 1),
        ];
        d.s.tone = (x, y, z) =>
            0.94 + 0.09 * Math.sin(y * 0.028 - Math.abs(x) * 0.044 + 0.026 * z);
        d.s.surface(rows, p.colors.tee, false, "both");
        d.s.tone = undefined;
        const rim = rows.at(-1);
        const turned = rim.map(
            ([x, y, z]): Point => [
                x - s * 2,
                mix(y, height + 35, 0.033),
                z * 0.964,
            ]
        );
        const inner = turned.map(
            ([x, y, z]): Point => [
                x - s * 11,
                mix(y, height + 32, 0.087),
                z * 0.92,
            ]
        );
        d.s.surface(
            [rim, turned],
            streetShade(p.colors.tee, "#2b2426", "#19171b"),
            false,
            "both"
        );
        // The loose cuff narrows to the inner armscye around the actual biceps.
        // Looking down the open sleeve reveals fabric in shadow and the forearm.
        const lining = ring(16, (a) => [
            s * (shoulder + 40),
            height + 2 - 25 * Math.cos(a),
            1 + 25 * Math.sin(a),
        ]);
        d.s.surface(
            [turned, inner, lining],
            streetShade(p.colors.tee, "#2b2426", "#30282b"),
            false,
            "both"
        );
    }
    d.s.afterPose = () => {
        for (const update of settle) update();
    };
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
    const cuts = d.s.detail === "full" ? 20 : 16;
    const seat = [
        horizontal(521, waist - 8, 90, 36, belt.slope, 0, cuts),
        horizontal(560, waist - 4, 91, 35, belt.slope, 0, cuts),
        horizontal(591, waist + 1, 94, 48, 0, 0, cuts),
        horizontal(618, waist + 1, 91, 48, 0, 0, cuts),
    ];
    const seatFront = frontOfLoft(seat);
    d.s.surface(seat, p.colors.denim, false, "end");
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
            ring(cuts, (a) => {
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
                const rear = b + 13 * (1 - T.MathUtils.smoothstep(y, 679, 744)),
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
        // Both halves inherit the exact hip ring and share a curved inseam
        // across the saddle. The pelvis stays inside even in a wide stride.
        const socket = ring(cuts, (a) => {
            const u = Math.sin(a),
                c = Math.cos(a);
            return [
                s * (waist + 1) * signed(Math.max(0, u), 0.91),
                618 + 43 * Math.max(0, -u),
                21.5 + 69.5 * signed(c, 0.9),
            ];
        });
        const splitRow = p.jeans.findIndex((r) => r[0] >= 670);
        const kneeRow = p.jeans.findIndex((r) => r[0] >= 705);
        const bootRow = p.jeans.findIndex((r) => r[0] >= 857);
        const upper = foldRings(
            [socket, ...garment.slice(splitRow, kneeRow + 1)],
            18,
            tint
        );
        const middle = foldRings(
            garment.slice(kneeRow, bootRow + 1),
            d.s.detail === "full" ? 14 : 26,
            tint
        );
        const lower = foldRings(
            garment.slice(bootRow),
            d.s.detail === "full" ? 13 : 25,
            tint
        );
        middle[0] = upper.at(-1);
        lower[0] = middle.at(-1);
        const panels = [upper, middle, lower],
            face = frontOfLoft([
                ...upper,
                ...middle.slice(1),
                ...lower.slice(1),
            ]);
        const bindPanel = (i: number) => {
            if (i === 0) {
                d.bind("hips");
                d.s.drape = {
                    name: side + "UpperLeg",
                    matrix: d.matrixFor(side + "UpperLeg"),
                    start: 0,
                    end: 1,
                    weight: (x, y) =>
                        T.MathUtils.smoothstep(y, 618, 696) *
                        mix(
                            T.MathUtils.smoothstep(Math.abs(x), 0, 28),
                            1,
                            T.MathUtils.smoothstep(y, 663, 697)
                        ),
                };
            } else if (i === 1)
                d.drape(
                    side + "UpperLeg",
                    side + "LowerLeg",
                    knee - 43,
                    knee + 53
                );
            else {
                d.drape(side + "LowerLeg", side + "Foot", 910, 984);
                d.s.drape.weight = (_x, y, z) =>
                    0.7 *
                    T.MathUtils.smoothstep(y, 905, 978) *
                    T.MathUtils.smoothstep(z, -48, 82);
            }
        };
        const color = p.colors.denim;
        d.s.tone = tint;
        d.s.preserveVertex = (x, y, z) =>
            z > 42 && y > 695 && (tint(x, y, z) < 0.71 || tint(x, y, z) > 1.19);
        for (const [i, panel] of panels.entries()) {
            bindPanel(i);
            const hem = panel.at(-1);
            d.s.surface(
                i === 2
                    ? [
                          ...panel,
                          hem.map(
                              ([x, y, z]): Point => [
                                  mix(x, s * p.shoe.center, 0.045),
                                  y - 1,
                                  z * 0.96,
                              ]
                          ),
                      ]
                    : panel,
                color,
                false,
                "perimeter"
            );
        }
        d.s.tone = undefined;
        d.s.preserveVertex = undefined;
        fronts.push(face);
        const shadow = new T.Color(color).multiplyScalar(0.62).getStyle();
        const creases = s < 0 ? p.creases.rightLeg : p.creases.leftLeg;
        for (const [i, [lo, hi]] of [
            [0, p.jeans[kneeRow][0]],
            [p.jeans[kneeRow][0], p.jeans[bootRow][0]],
            [p.jeans[bootRow][0], 1008],
        ].entries()) {
            bindPanel(i);
            for (const loop of creases) {
                if (d.s.detail === "crowd" && loop.length < 9) continue;
                let edge = loop as XY[];
                for (const [limit, dir] of [
                    [lo, 1],
                    [hi, -1],
                ]) {
                    const clipped: XY[] = [];
                    for (let j = 0; j < edge.length; j++) {
                        const a = edge[j],
                            b = edge[(j + 1) % edge.length],
                            keep = (a[1] - limit) * dir >= 0;
                        if (keep) clipped.push(a);
                        if (keep !== (b[1] - limit) * dir >= 0)
                            clipped.push([
                                mix(a[0], b[0], (limit - a[1]) / (b[1] - a[1])),
                                limit,
                            ]);
                    }
                    edge = clipped;
                }
                if (
                    edge.length >= 3 &&
                    edge.every(([x, y]) => Number.isFinite(face(x, y)))
                )
                    d.decal(edge, lift(face, 0.85), shadow);
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
            const stud = Array.from(
                { length: 8 },
                (_, j): XY => [
                    x + 3 * Math.cos((tau * j) / 8),
                    y + 3 * Math.sin((tau * j) / 8),
                ]
            );
            d.decal(stud, lift(leather, 1), "#d8d0be");
            if (d.s.detail === "full")
                d.decal(
                    [
                        [x - 1.85, y - 0.51],
                        [x - 0.93, y - 1.94],
                        [x + 0.48, y - 1.08],
                    ],
                    lift(leather, 1.38),
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
    d.s.triangleBudget = d.s.detail === "full" ? 5450 : 4000;
    d.s.referenceFrame = streetFrame();
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
    drawStreetBody(d, p);
    const mouthAccessory = measuredStreetHead(d, p);
    d.s.endLayer("body");
    d.s.sourcePaint = false;
    d.s.sculptedCartoon = true;
    trousers(d, p);
    d.s.endLayer("bottoms");
    shirt(d, p);
    sleeves(d, p);
    mouthAccessory();
    d.s.referenceFrame = undefined;
}
