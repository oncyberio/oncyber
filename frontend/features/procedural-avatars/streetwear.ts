import {
    Drawing,
    ellipse,
    profileDepth,
    type Section,
    type XY,
    type Depth,
} from "./drawing";
import { avatarStyles } from "./styles";
import { garmentMapping, type PrintPath } from "./garmentPrint";
import type { Point } from "./sculpt";
import { finish } from "./surfaces";
import { looks, type StreetLook } from "./streetwearRecipes";
import { drawStreetHead } from "./streetwearHeads";

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const between = (a: Point, b: Point, t: number): Point =>
    a.map((v, i) => mix(v, b[i], t)) as Point;
const silver = "#c6bfbb",
    pearl = "#eee7d0",
    steel = "#6d6b7a",
    sole = "#796d5c",
    cream = "#e6dbbd";
export function flat(d: Drawing, xy: XY[], z: Depth, paint: string) {
    // Ear clipping supports concave paint paths and tapered angular folds.
    d.decal(xy, z, paint);
}
function ribbon(
    d: Drawing,
    path: XY[],
    depth: Depth,
    r: number,
    color: string,
    raise = 1.3
) {
    const points: Point[] = [];
    for (let i = 0; i < path.length; i++) {
        const a = path[i],
            b = path[i + 1] ?? a,
            n =
                b === a
                    ? 1
                    : Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 6);
        for (let k = 0; k < n; k++) {
            const x = mix(a[0], b[0], k / n),
                y = mix(a[1], b[1], k / n);
            points.push([x, y, depth(x, y) + raise]);
        }
    }
    d.s.ribbon(points, r, color);
}
function printPaths(look: StreetLook): PrintPath[] {
    const center = (look.shirt[3][1] + look.shirt[3][2]) / 2;
    const half = (look.shirt[3][2] - look.shirt[3][1]) / 2;
    const top = look.shirt[0][0],
        h = look.shirt.at(-1)[0] - top;
    const xy = (x: number, y: number): XY => [center + x * half, top + y * h];
    const out: PrintPath[] = [];
    const dye = [
        "#e2dbc2",
        "#b5b4a1",
        "#ebc89c",
        "#c98d8e",
        "#91aaa8",
        "#d2cbd5",
        "#f4e9ce",
        "#a08c82",
    ];
    let state = 473;
    const random = () =>
        (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296;
    function brush(a: XY, b: XY, r: number, shade: string) {
        const dx = b[0] - a[0],
            dy = b[1] - a[1],
            len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len,
            ny = dx / len;
        const pts = [
            [0, 0.5],
            [0.12, 1.1],
            [0.36, 0.79],
            [0.52, 1.04],
            [0.73, 0.75],
            [0.94, 1],
            [1, -0.6],
            [0.78, -1.03],
            [0.53, -0.8],
            [0.23, -1.05],
            [0.04, -0.72],
        ];
        out.push({
            color: shade,
            outline: pts.map(([t, k]) => [
                a[0] + dx * t + nx * r * k,
                a[1] + dy * t + ny * r * k,
            ]),
        });
    }
    const strokes: [XY, XY][] = [];
    if (look.print === "crosses") {
        for (const x of [-0.36, 0.36]) {
            strokes.push(
                [xy(x, 0.235), xy(x - 0.1, 0.645)],
                [xy(x - 0.24, 0.395), xy(x + 0.22, 0.405)]
            );
        }
    } else {
        // Five oblique cut-paper letterforms in a single distressed print.
        const letters = [
            [
                [0, 1],
                [0.42, 0],
                [0.8, 1],
                [0.62, 0.55],
                [0.15, 0.58],
            ],
            [
                [0, 0],
                [0.18, 1],
                [0.53, 0.43],
                [0.67, 1],
                [1, 0],
            ],
            [
                [0, 1],
                [0.45, 0],
                [0.87, 1],
                [0.65, 0.59],
                [0.21, 0.58],
            ],
            [
                [0, 0],
                [0, 1],
                [0.08, 0.53],
                [0.85, 0],
                [0.15, 0.52],
                [0.9, 1],
            ],
            [
                [0.81, 0],
                [0.12, 0],
                [0, 1],
                [0.79, 1],
                [0.07, 0.96],
                [0.13, 0.54],
                [0.68, 0.5],
            ],
        ];
        letters.forEach((letter, i) => {
            const p = letter.map(([x, y]) =>
                xy(
                    -0.82 + i * 0.32 + x * 0.275 + 0.065 * (1 - y),
                    0.303 + y * 0.176 + 0.008 * Math.sin(i)
                )
            );
            for (let j = 1; j < p.length; j++) strokes.push([p[j - 1], p[j]]);
        });
    }
    for (const [a, b] of strokes) {
        const w = look.print === "crosses" ? 2.6 : 2.35;
        brush(a, b, w * 1.4, "#9f978a");
        brush(a, b, w, pearl);
        const n = Math.ceil(Math.hypot(a[0] - b[0], a[1] - b[1]) / 2);
        for (let k = 0; k < n; k++) {
            const t = random(),
                x = mix(a[0], b[0], t) + (random() - 0.5) * w * 2.1,
                y = mix(a[1], b[1], t) + (random() - 0.5) * w * 2.8;
            brush(
                [x, y],
                [x + (random() - 0.6) * 4, y + random() * 4],
                0.6 + random() * 1.8,
                dye[Math.floor(random() * dye.length)]
            );
        }
    }
    return out;
}
function star(
    d: Drawing,
    x: number,
    y: number,
    z: number,
    r: number,
    c: string,
    points = 6
) {
    const path: XY[] = Array.from({ length: 2 * points }, (_, i) => {
        const a = (i * Math.PI) / points - 0.5 * Math.PI,
            rr = i % 2 ? r * 0.51 : r;
        return [x + rr * Math.cos(a), y + rr * Math.sin(a)];
    });
    d.patch(path, [x, y], () => z, 2, c, { sharp: true, back: 2 });
}
function shirt(d: Drawing, l: StreetLook) {
    const rows = l.shirt,
        bot = rows.at(-1)[0],
        top = rows[0][0],
        cx = l.origin.x;
    const sleeve = l.landmarks.arms;
    d.torso();
    d.s.tone = (x, y, z) =>
        0.87 +
        0.12 * Math.cos((x - cx) * 0.049 + Math.sin(y * 0.037)) -
        0.13 * Math.exp(-(((y - top - 12) / 15) ** 2));
    const artwork = l.print === "crosses" ? looks.lux : looks.remy;
    d.s.printUV = garmentMapping(
        l.print,
        artwork.shirt,
        false,
        () => printPaths(artwork),
        rows
    );
    const base = d.body(rows, l.tee, false, 24, "both", l.hemTilt, {
        neckline: l.neckline ?? avatarStyles.streetwear.neckline,
        binding: "#17161b",
        interior: l.skin,
        center: l.landmarks.neck[0],
    });
    d.s.printUV = undefined;
    d.s.tone = undefined;
    const hem = rows.at(-1);
    const under: Section[] = [
        [bot - 31, hem[1] + 5, hem[2] - 5, hem[3] - 5],
        [bot + 9, hem[1] + 1, hem[2] - 2, hem[3] - 3],
        [
            l.belt[1][0] + 2,
            l.belt[1][1] + 3,
            l.belt[1][2] - 3,
            l.belt[1][3] - 3,
        ],
    ];
    d.body(
        under,
        l.hairStyle === "fringe" ? "#82404a" : "#26252a",
        false,
        16,
        "end",
        l.hemTilt * 0.55
    );
    const folds: XY[][] = [
        [
            [rows[2][1] + 4, top + 25],
            [rows[3][1] + 18, top + 53],
            [rows[4][1] + 12, top + 72],
        ],
        [
            [rows[4][2] - 4, top + 78],
            [rows[5][2] - 13, top + 107],
            [rows[5][2] - 11, top + 123],
        ],
        [
            [cx - 36, bot - 29],
            [cx - 19, bot - 16],
            [cx - 7, bot - 14],
        ],
    ];
    for (const path of folds) ribbon(d, path, base, 1.25, "#211e24", 1.7);
    d.s.endTorso();
    for (let i = 0; i < 2; i++) {
        const side = i ? "left" : "right";
        const [shoulder, elbow, wrist] = sleeve[i];
        d.bind(side + "UpperArm");
        const sleeveEnd = between(
            shoulder,
            elbow,
            l.hairStyle === "star" ? 0.73 : 0.81
        );
        // The first figure's arms reach up out of flared, down-facing sleeves.
        const bend = l.hairStyle === "star";
        const root: Point = [
            shoulder[0] + (i ? -17 : 17),
            shoulder[1] + 2,
            shoulder[2],
        ];
        const cap = bend
            ? ([
                  shoulder[0] + (i ? 16 : -16),
                  shoulder[1] + 44,
                  shoulder[2] + 1,
              ] as Point)
            : sleeveEnd;
        d.s.tone = (x, y, z) =>
            0.85 + 0.14 * Math.cos((x - shoulder[0]) * 0.084 + z * 0.038);
        d.s.sweep(
            [root, between(root, cap, 0.26), between(root, cap, 0.8), cap],
            [20, 29, 31, 30],
            l.tee,
            14
        );
        d.s.tone = undefined;
        d.s.sweep(
            [
                between(shoulder, elbow, bend ? 0.09 : 0.65),
                between(shoulder, elbow, 0.79),
                elbow,
            ],
            [10, 10, 9],
            l.skin,
            10
        );
        d.bind(side + "LowerArm");
        d.s.sweep(
            [elbow, between(elbow, wrist, 0.25), wrist],
            [9.6, 10.2, 6.8],
            l.skin,
            10
        );
        d.s.oval(elbow, [9.1, 9.1, 9], l.skin);
        d.bind(side + "Hand");
        const mid = d.sourceJoints.get(side + "MiddleProximal").point;
        d.s.sweep(
            [wrist, between(wrist, mid, 0.62), mid],
            [6.8, 9, 5.5],
            l.skin,
            9
        );
        d.fingers(side, l.skin, 2.3);
        if (l.hairStyle !== "fringe") {
            d.bind(side + "LowerArm");
            const c = between(elbow, wrist, 0.92);
            d.s.sweep(
                [between(elbow, wrist, 0.86), between(elbow, wrist, 0.98)],
                [8.8, 8.3],
                steel,
                8
            );
            for (let j = 0; j < 5; j++) {
                const a = (j * 2 * Math.PI) / 5;
                star(
                    d,
                    c[0] + 8 * Math.cos(a),
                    c[1] + 2 * Math.sin(a),
                    c[2] + 8 * Math.sin(a),
                    6.3,
                    j % 2 ? silver : "#e1dadd",
                    5
                );
            }
        }
    }
}
function lower(d: Drawing, l: StreetLook) {
    const b = l.belt;
    d.bind("hips");
    // The belt and upper denim under the floating shirt share the hip joint.
    d.body(
        b.map(([y, a, c, r, z]): Section => [y + 7, a, c, r - 1, z]),
        l.denim,
        false,
        16,
        "end"
    );
    const belt = d.body(b, "#29272e", false, 20);
    const last = b.at(-1),
        cx = l.origin.x;
    const buckleX = cx + (l.hairStyle === "locs" ? -5 : -12),
        y = b[1][0];
    for (let i = -5; i <= 5; i++) {
        const x = cx + i * 12.2;
        for (const dy of [-5, 5])
            if (x > last[1] + 4 && x < last[2] - 4)
                flat(
                    d,
                    ellipse(x, y + dy, 2, 2.3),
                    (px, py) => belt(px, py) + 1.6,
                    pearl
                );
        if (i % 3 === 0 && x > last[1] + 4 && x < last[2] - 4)
            flat(
                d,
                [
                    [x - 2, y - 13],
                    [x + 3, y - 14],
                    [x + 3, y + 15],
                    [x - 2, y + 14],
                ],
                (px, py) => belt(px, py) + 2.1,
                steel
            );
    }
    const seatTop = b[1],
        seatBottom =
            l.hairStyle === "locs" ? 476 : l.hairStyle === "star" ? 491 : 510;
    const seat: Section[] = [
        [seatTop[0], seatTop[1] + 0.8, seatTop[2] - 0.8, seatTop[3] - 1],
        [last[0] + 12, last[1] + 1, last[2] - 2, last[3] - 2],
        [seatBottom - 20, cx - 39, cx + 37, last[3] - 6],
        [seatBottom, cx - 15, cx + 12, last[3] - 12],
    ];
    const front = d.body(seat, l.denim, false, 16, "none");
    const zip = buckleX + 3;
    ribbon(
        d,
        [
            [zip, last[0] + 4],
            [zip - 1, seatBottom - 8],
            [zip - 9, seatBottom - 3],
        ],
        front,
        1,
        l.dye,
        1.8
    );
    ribbon(
        d,
        [
            [zip + 6, last[0] + 4],
            [zip + 7, seatBottom - 13],
            [zip + 4, seatBottom - 9],
        ],
        front,
        0.55,
        l.dye,
        1.6
    );
    const bz = belt(buckleX, y) + 4;
    star(d, buckleX, y, bz, 10, "#f6d76f", 7);
    d.s.ribbon(
        [
            [buckleX - 8, y + 3, bz + 1],
            [buckleX - 10, y + 15, bz + 3],
            [buckleX - 5, y + 21, bz + 4],
            [buckleX, y + 12, bz + 4],
            [buckleX + 5, y + 20, bz + 3],
            [buckleX + 10, y + 15, bz + 2],
            [buckleX + 8, y + 3, bz + 1],
        ],
        2.7,
        "#7890a0"
    );
    d.s.oval([buckleX, y + 9, bz + 2], [4.8, 5.2, 2.1], "#435168");
    d.s.oval([buckleX - 5, y + 19, bz + 5], [1.8, 2, 1.6], pearl);
    d.s.oval([buckleX + 5, y + 18, bz + 4], [1.8, 2, 1.6], pearl);
    for (let i = 0; i < 2; i++) {
        const side = i ? "left" : "right",
            rows = l.jeans[i],
            k = l.landmarks.legs[i][1][1];
        d.drape(side + "UpperLeg", side + "LowerLeg", k - 44, k + 48);
        d.s.tone = (x, y, z) => {
            let dye =
                0.91 +
                0.07 * Math.sin(x * 0.035 + z * 0.021 + Math.sin(y * 0.031)) +
                0.052 * Math.cos(y * 0.046 + x * 0.019);
            if (z <= 0) return dye;
            for (const [ax, ay, bx, by, width] of l.folds[i]) {
                const dx = bx - ax,
                    dy = by - ay,
                    length = Math.hypot(dx, dy);
                const t = ((x - ax) * dx + (y - ay) * dy) / (length * length);
                if (t <= 0 || t >= 1) continue;
                const h = ((y - ay) * dx - (x - ax) * dy) / (length * width);
                dye +=
                    Math.sin(t * Math.PI) *
                    (0.13 * Math.exp(-((h + 0.8) ** 2)) -
                        0.31 * Math.exp(-((h - 0.48) ** 2)));
            }
            return dye;
        };
        const face = d.body(rows, l.denim, false, 16);
        d.s.tone = undefined;
        // A few asymmetrical fold planes carry the weight of each leg. The
        // dark edge is deepest where the fold turns into the outer seam.
        for (const fold of l.folds[i]) {
            const [startX, startY, endX, endY, spread] = fold,
                dx = endX - startX;
            const xy: XY[] = [
                [startX, startY],
                [startX + dx * 0.38, mix(startY, endY, 0.38) - spread * 0.28],
                [endX, endY],
                [endX - dx * 0.18, endY + spread * 0.8],
                [startX + dx * 0.22, mix(startY, endY, 0.22) + spread * 0.45],
            ];
            flat(d, xy, (x, y) => face(x, y) + 1.2, l.dye);
            ribbon(
                d,
                [
                    [startX + dx * 0.36, mix(startY, endY, 0.36)],
                    [endX - dx * 0.1, endY + spread * 0.18],
                    [endX, endY],
                ],
                face,
                0.65,
                l.dye,
                1.65
            );
        }
        const [, a, b] = rows[0],
            fly = i === 0 ? b - 15 : a + 7,
            y0 = rows[0][0];
        ribbon(
            d,
            [
                [fly, y0 + 3],
                [fly - 1, y0 + 32],
                [fly - 7, y0 + 47],
            ],
            face,
            0.85,
            l.dye,
            2
        );
        const [sx, sy, rx, rz] = l.shoes[i];
        d.bind(side + "Foot");
        const end =
            l.origin.floor -
            (i === 0 && l.hairStyle === "star"
                ? 13
                : i === 1 && l.hairStyle === "locs"
                ? 27
                : i === 1 && l.hairStyle === "fringe"
                ? 7
                : 0);
        const y = Math.min(sy - 23, end - 40);
        const shoe: Section[] = [
            [y, sx - rx * 0.46, sx + rx * 0.54, rz * 0.48, -7],
            [y + 7, sx - rx * 0.74, sx + rx * 0.76, rz * 0.68, -1],
            [end - 21, sx - rx * 0.94, sx + rx * 0.96, rz, 13],
            [end - 12, sx - rx, sx + rx, rz * 1.12, 17],
            [end - 10, sx - rx, sx + rx, rz * 1.13, 17],
            [end - 5, sx - rx * 0.99, sx + rx * 0.99, rz * 1.13, 17],
            [end, sx - rx * 0.93, sx + rx * 0.93, rz * 1.08, 17],
        ];
        d.s.paintBand = { height: end - 10, color: sole };
        d.body(shoe, cream, false, 16);
        d.s.paintBand = undefined;
    }
}
export function drawStreetwear(d: Drawing, l: StreetLook) {
    d.s.palette({
        [l.skin]: finish.skin,
        [l.hair]: finish.fiber,
        [l.tee]: finish.cloth,
        [l.denim]: finish.cloth,
        [l.dye]: finish.cloth,
        [cream]: finish.cloth,
    });
    const [nx, ny, nz] = l.landmarks.neck,
        [jx, jy, jz] = l.landmarks.jaw;
    // The column's top sits inside the jaw and its flared base inside the collar.
    // Blend the first rings with the head so a nod cannot uncover the seam.
    d.drape("head", "neck", jy - 6, ny - 2);
    const neck: Section[] = [
        [jy - 12, jx - 11, jx + 11, 12, jz - 5],
        [jy - 3, jx - 13, jx + 13, 13, jz - 5],
        [
            (jy + ny) / 2,
            (jx + nx) / 2 - 11.5,
            (jx + nx) / 2 + 11.5,
            12,
            (jz + nz) / 2 - 4,
        ],
        [ny + 3, nx - 14, nx + 14, 15, nz - 3],
        [ny + 12, nx - 20, nx + 20, 18, nz - 2],
    ];
    d.body(neck, l.skin, false, 14, "none");
    for (const [s, e] of l.landmarks.arms) {
        const center = between(s, e, 0.76);
        d.s.skinShadows.push({ center, radii: [24, 16, 22], opacity: 0.28 });
    }
    lower(d, l);
    shirt(d, l);
    drawStreetHead(d, l);
}
