import type { CartoonDesign } from "./cartoonCast";
import { drawCartoonBrow, drawCartoonEye } from "./cartoonEye";
import { CatmullRomCurve3, Matrix4, Vector3 } from "three/webgpu";
import portraits from "./cartoon-portraits.json";
import crown from "./rick-crown.json";
import {
    Drawing,
    curve,
    ellipse,
    profileDepth,
    sectionPoint,
    headDepth,
    lift,
    level,
    type Depth,
    type Section,
    type XY,
} from "./drawing";

import { portraitInk } from "./garmentPrint";
// Median RGB sampled from ZBrush polypaint on SubTool 2 (skin) and 11 (hair).
// Color-grade these swatches toward the warm light in the composition.
function warmPaint(rgb: number[], wash: number[], amount: number) {
    return (
        "#" +
        rgb
            .map((v, i) =>
                Math.round(v + (wash[i] - v) * amount)
                    .toString(16)
                    .padStart(2, "0")
            )
            .join("")
    );
}
export const paint = {
    morty: { skin: "#f7b899", hair: "#78502f" },
    summer: { skin: "#f6bd99", hair: "#e78335" },
    rick: {
        skin: warmPaint([197, 178, 164], [248, 198, 155], 0.31),
        hair: warmPaint([170, 212, 234], [225, 224, 193], 0.13),
    },
} as const;
const mouth = "#63312e",
    gum = "#bd6759",
    tooth = "#f4ddb4";
function ear(
    d: Drawing,
    x: number,
    y: number,
    z: number,
    rx: number,
    ry: number,
    skin: string
) {
    const surf = d.patch(
        ellipse(x, y, rx, ry, -0.18),
        [x, y],
        level(z),
        7,
        skin,
        { edge: 0.7, back: 6 }
    );
    d.stroke(
        [
            [x - rx * 0.46, y - ry * 0.38],
            [x + rx * 0.16, y - ry * 0.5],
            [x + rx * 0.48, y - ry * 0.07],
            [x + rx * 0.14, y + ry * 0.29],
        ],
        lift(surf, 0.35),
        0.51,
        "#c98066"
    );
}
function teeth(d: Drawing, teeth: [number, number, number, number, number][]) {
    for (const [x, y, w, h, slant] of teeth) {
        const pts: XY[] = [
            [x - w * 0.5, y],
            [x + w * 0.46, y + slant],
            [x + w * 0.41, y + h * 0.56 + slant * 0.75],
            [x + w * 0.23, y + h * 0.9 + slant * 0.55],
            [x - w * 0.05, y + h + slant * 0.45],
            [x - w * 0.32, y + h * 0.82],
            [x - w * 0.46, y + h * 0.34],
        ];
        d.portrait.polygon(pts, "#765043");
        const inset = pts.map(
            ([px, py]): XY => [
                x + (px - x) * 0.9,
                y + h * 0.36 + (py - y - h * 0.36) * 0.87,
            ]
        );
        d.portrait.polygon(inset, tooth);
    }
}
type Point = import("./sculpt").Point;
type Hair =
    | {
          type: "cap";
          center: Point;
          radii: Point;
          edge: [number, number, number, number];
          locks: { root: Point; tip: Point; width: number; depth: number }[];
      }
    | {
          type: "ponytail";
          crown: number;
          nape: number;
          inner: XY[];
          outer: XY[];
          sweeps: {
              path: Point[];
              radii: number[];
              paint?: string;
              sides: number;
          }[];
      }
    | { type: "measured" };
interface CartoonPortrait {
    sections: Section[];
    cheeks: { x: number; y: number; rx: number; ry: number }[];
    eyes: { path: XY[]; center: XY; pupil: XY; radius: number }[];
    ears: [number, number, number, number, number][];
    nose: { path: XY[]; center: XY; raise: number; depth: number };
    lines: { path: XY[]; on: "face" | "nose"; raise: number; width: number }[];
    brow?: {
        path: XY[];
        center: XY;
        raise: number;
        minimum: number;
        depth: number;
        edge: number;
    };
    mouth?: {
        path: XY[];
        center: XY;
        tongue?: XY[];
        teeth: [number, number, number, number, number][];
    };
    hair: Hair;
}
const crownDirections = crown.rim
    .map(([x, y], index) => ({
        index,
        angle: Math.atan2(y - crown.center[1], x - crown.center[0]),
    }))
    .sort((a, b) => a.angle - b.angle);

/** Rotate each drawn tip into the reference crown and interpolate the two
 * neighbouring depth profiles. Only the new outline lives in the recipe. */
export function drawRadialCrown(
    d: Drawing,
    shape: { center: XY; rim: XY[] },
    skull: Section[],
    paint: string
) {
    const scale =
        Math.max(...skull.map((row) => row[2] - row[1])) /
        Math.max(...portraits.rick.sections.map((row) => row[2] - row[1]));
    const centerZ = sectionPoint(skull, Math.PI / 2, shape.center[1])[2];
    const blends = shape.rim.map(([x, y]) => {
        const angle = Math.atan2(y - shape.center[1], x - shape.center[0]);
        const next = crownDirections.findIndex((p) => p.angle >= angle);
        const hi = next < 0 ? 0 : next;
        const b = crownDirections[hi],
            a =
                crownDirections[
                    (hi + crownDirections.length - 1) % crownDirections.length
                ];
        const turn = 2 * Math.PI;
        const span = (b.angle - a.angle + turn) % turn;
        return {
            a: a.index,
            b: b.index,
            t: ((angle - a.angle + turn) % turn) / span,
        };
    });
    d.crown(
        shape.center,
        shape.rim,
        crown.steps,
        (i, j, front) => {
            const rows = front ? crown.front : crown.back;
            const { a, b, t } = blends[i];
            return (
                centerZ + scale * (rows[a][j] + (rows[b][j] - rows[a][j]) * t)
            );
        },
        paint
    );
}

function hairstyle(
    d: Drawing,
    style: Hair,
    sections: Section[],
    face: Depth,
    color: string
) {
    if (style.type === "measured") {
        d.crown(
            crown.center as XY,
            crown.rim as XY[],
            crown.steps,
            (i, j, front) => (front ? crown.front : crown.back)[i][j] + 8,
            color
        );
    } else if (style.type === "cap") {
        const [x, y, z] = style.center,
            [rx, ry, rz] = style.radii,
            [tilt, front, side, ruffle] = style.edge;
        const cap = Array.from({ length: 8 }, (_, j) =>
            Array.from({ length: 31 }, (_, i): Point => {
                const a = (2 * Math.PI * i) / 30,
                    edge =
                        tilt +
                        front * Math.cos(a) +
                        side * Math.sin(a) +
                        ruffle * Math.sin(5 * a);
                const lat = 0.01 + ((edge - 0.01) * j) / 7;
                return [
                    x + rx * Math.sin(lat) * Math.sin(a),
                    y - ry * Math.cos(lat),
                    z + rz * Math.sin(lat) * Math.cos(a),
                ];
            })
        );
        d.s.surface(cap, color);
        for (const lock of style.locks)
            d.lock(lock.root, lock.tip, lock.width, lock.depth, color);
    } else {
        for (const s of style.sweeps)
            d.s.sweep(s.path, s.radii, s.paint ?? color, s.sides);
        d.wrap(
            sections,
            () => style.crown,
            (a) =>
                style.crown +
                (style.nape - style.crown) * Math.max(0, -Math.cos(a)) ** 0.55,
            color,
            1.9,
            false
        );
        const rows = Array.from({ length: 7 }, (_, j) =>
            style.inner.map(([x, y], i): Point => {
                const t = j / 6,
                    px = x + (style.outer[i][0] - x) * t,
                    py = y + (style.outer[i][1] - y) * t;
                return [
                    px,
                    py,
                    Math.max(6, face(px, py)) + 2.8 + 2 * Math.sin(t * Math.PI),
                ];
            })
        );
        d.s.surface(rows, color);
        d.s.line(rows[0], 0.69, "#9b5125");
    }
}
/** Envelope the same asymmetric skull used for skin, including its deeper
 * occiput. Both temples and the nape share a single continuous hairline. */
function fittedScalp(
    d: Drawing,
    style: Exclude<Hair, { type: "measured" }>,
    sections: Section[],
    color: string,
    fall = 0
) {
    const short = style.type === "cap",
        top = sections[0][0];
    const crown = short
        ? style.center[1] - style.radii[1]
        : Math.min(...style.outer.map((p) => p[1]));
    const layers = [0, 0.055, 0.12, 0.21, 0.33, 0.48, 0.65, 0.82, 0.94, 1];
    const ring = (t: number, tucked: boolean) =>
        Array.from({ length: 49 }, (_, i): Point => {
            const a = ((i % 48) * Math.PI) / 24,
                c = Math.cos(a),
                s = Math.sin(a);
            const lat = short
                ? style.edge[0] + style.edge[1] * c + 0.13 * s
                : 0;
            const hem = short
                ? style.center[1] - style.radii[1] * Math.cos(lat)
                : top +
                  3 +
                  65 * Math.pow(1 - Math.max(c, 0), 1.52) +
                  32 * Math.max(-c, 0) +
                  2 * s;
            const y = short
                ? style.center[1] - style.radii[1] * Math.cos(t * lat)
                : crown + (hem - crown) * t;
            const sampleY = short ? Math.max(top, y) : top + (hem - top) * t;
            let k = 1;
            while (k < sections.length - 1 && sections[k][0] < sampleY) k++;
            const l = sections[k - 1],
                r = sections[k],
                f = Math.min(1, Math.max(0, (sampleY - l[0]) / (r[0] - l[0])));
            const interp = (col: number) =>
                (l[col] ?? 0) + ((r[col] ?? 0) - (l[col] ?? 0)) * f;
            const mid = (interp(1) + interp(2)) * 0.5,
                width = (interp(2) - interp(1)) * 0.5;
            const puff = (short ? 5.5 : 4.3) * Math.sin((t * Math.PI) / 2);
            const root = Math.min(1, Math.sqrt(t / 0.08)),
                inset = tucked ? 0.91 : 1;
            if (style.type === "cap") {
                // A short cut keeps a continuous swept ellipse over the crown.
                // Extra room behind the ears accommodates the deeper occipital profile.
                const radius = Math.sin(t * lat);
                const rear = 1 + 0.42 * Math.max(-c, 0);
                return [
                    style.center[0] -
                        1.5 +
                        s * (style.radii[0] + 1.8) * radius * inset,
                    y + (tucked ? 1.5 : 0),
                    style.center[2] +
                        (style.radii[2] + 2) * rear * radius * c * inset,
                ];
            }
            return [
                mid + s * (width + puff) * root * inset,
                y + (tucked ? 1.5 : 0),
                interp(4) +
                    (headDepth(sampleY, sections, c >= 0 ? 1 : -1, c * c) *
                        interp(3) +
                        puff * c) *
                        root *
                        inset,
            ];
        });
    d.s.surface(
        [...layers.map((t) => ring(t, false)), ring(1, true)],
        color,
        true
    );
    if (style.type === "ponytail") {
        const [tail] = style.sweeps;
        const [root, ...length] = tail.path;
        // The elastic sits around the tied root on the back of the scalp.
        const tie: Point = [root[0] - 10, root[1] + 4, root[2] - 18];
        // Gravity rotates the free tail about its tied root. The cap and
        // elastic stay fixed when a recipe changes from windswept to hanging.
        const angle = fall * 0.74,
            c = Math.cos(angle),
            s = Math.sin(angle);
        const knots: Point[] = [
            root,
            tie,
            ...length.map(
                ([x, y, z]): Point => [
                    tie[0] + c * (x - tie[0]) + s * (y - tie[1]),
                    tie[1] - s * (x - tie[0]) + c * (y - tie[1]),
                    z - fall * 5,
                ]
            ),
        ];
        const widths = [
            6,
            7.8,
            ...tail.radii
                .slice(1)
                .map((r, i) => r * (i === 0 ? 0.49 : i === 1 ? 0.72 : 0.94)),
        ];
        const path = new CatmullRomCurve3(knots.map((p) => new Vector3(...p)));
        const samples = knots.length * 3;
        const spine = path.getPoints(samples).map((v) => v.toArray() as Point);
        const radii = spine.map((_, i) => {
            const u = (i * (widths.length - 1)) / samples,
                k = Math.min(widths.length - 2, Math.floor(u));
            return widths[k] + (widths[k + 1] - widths[k]) * (u - k);
        });
        d.s.sweep(spine, radii, color, 12);
        d.s.sweep(
            [
                [tie[0] + 1.5, tie[1], tie[2] + 0.7],
                [tie[0] - 1.5, tie[1], tie[2] - 0.7],
            ],
            [8.65, 8.65],
            "#af5830",
            12
        );
    }
}
export function drawHead(
    d: Drawing,
    id: keyof typeof paint,
    palette: { skin: string; hair: string } = paint[id],
    expression?: Pick<
        CartoonDesign,
        "gaze" | "pupil" | "brow" | "mouth" | "skull"
    > & {
        tailFall?: number;
        noseProjection?: number;
    }
) {
    const rounded = !!expression;
    const p = portraits[id] as CartoonPortrait;
    const sections = p.sections.map(([y, left, right, z, center]): Section => {
        const t =
            (y - p.sections[0][0]) / (p.sections.at(-1)[0] - p.sections[0][0]);
        const cheek =
            expression?.skull === "round"
                ? (right - left) * 0.057 * Math.exp(-((t - 0.81) ** 2) / 0.029)
                : 0;
        return [y, left - cheek, right + cheek, z, center];
    });
    const { skin, hair } = palette;
    d.bind("head");
    d.portrait = portraitInk(id);
    d.s.cheeks = p.cheeks;
    // Correct the perspective of the drawn pair before placing it on the
    // playable skull. The bake and the modeled features use the same centers.
    const eyeMid: XY = [
        (p.eyes[0].center[0] + p.eyes[1].center[0]) / 2,
        (p.eyes[0].center[1] + p.eyes[1].center[1]) / 2,
    ];
    const row = sections.reduce((best, r) =>
        Math.abs(r[0] - eyeMid[1]) < Math.abs(best[0] - eyeMid[1]) ? r : best
    );
    const shift = rounded ? (row[1] + row[2]) / 2 - eyeMid[0] : 0;
    const sockets = p.eyes.map(
        (e): XY =>
            rounded
                ? [
                      eyeMid[0] + (e.center[0] - eyeMid[0]) * 0.91,
                      eyeMid[1] + (e.center[1] - eyeMid[1]) * 0.33,
                  ]
                : e.center
    );
    if (rounded) {
        const front = profileDepth(sections, 1, true);
        d.s.skinShadows = sockets.flatMap(([x, y]) => [
            {
                center: [x + shift, y - 15, front(x + shift, y - 15)] as Point,
                radii: [19, 8, 13] as Point,
                opacity: 0.22,
            },
            {
                center: [x + shift, y + 14, front(x + shift, y + 14)] as Point,
                radii: [20, 7, 12] as Point,
                opacity: 0.18,
            },
        ]);
        const [nx, ny] = p.nose.center;
        d.s.skinShadows.push({
            center: [nx + shift, ny, front(nx + shift, ny)],
            radii: [10, 8, 14],
            opacity: 0.18,
        });
    }
    // Paint only the modeled relief in this version. Ink on the skull as well
    // would expose a second pupil or mouth when viewed obliquely.
    if (rounded) d.portrait = undefined;
    const skullFace = d.paintedHead(sections, skin);
    d.portrait = portraitInk(id);
    if (rounded && p.hair.type !== "measured")
        fittedScalp(d, p.hair, sections, hair, expression.tailFall);
    else hairstyle(d, p.hair, p.sections, skullFace, hair);
    for (const e of p.ears) ear(d, ...e, skin);
    const frame = d.s.referenceFrame;
    const skullShadows = d.s.skinShadows;
    if (shift) {
        d.s.referenceFrame = (frame?.clone() ?? new Matrix4()).multiply(
            new Matrix4().makeTranslation(shift, 0, 0)
        );
        d.s.skinShadows = skullShadows.map((shadow) => ({
            ...shadow,
            center: [
                shadow.center[0] - shift,
                shadow.center[1],
                shadow.center[2],
            ],
        }));
    }
    const face: Depth = (x, y) => skullFace(x + shift, y);
    p.eyes.forEach((e, i) => {
        const rx = Math.max(...e.path.map(([x]) => Math.abs(x - e.center[0])));
        const ry = Math.max(
            ...e.path.map(([, y]) => Math.abs(y - e.center[1]))
        );
        drawCartoonEye(d, face, {
            center: sockets[i],
            radii: [rx, ry],
            side: i ? 1 : -1,
            skin,
            aperture: "wide",
            brow: expression?.brow ?? "level",
            gaze: expression?.gaze ?? 0,
            pupilRadius: expression ? undefined : e.radius,
            pigment: expression?.pupil,
            pupil: expression ? undefined : e.pupil,
            opening: expression ? undefined : e.path,
        });
    });
    if (p.brow) {
        const b = p.brow;
        d.patch(
            b.path,
            b.center,
            (x, y) => Math.max(face(x, y) + b.raise, b.minimum),
            b.depth,
            hair,
            { edge: b.edge }
        );
    }
    const n = p.nose,
        nose = d.patch(
            n.path,
            n.center,
            lift(face, n.raise),
            n.depth * (expression?.noseProjection ?? 1),
            skin
        );
    for (const line of p.lines) {
        const actsAsBrow =
            expression &&
            line.on === "face" &&
            line.path.every((point) => point[1] < p.eyes[0].center[1] - 4);
        if (actsAsBrow) {
            drawCartoonBrow(d, face, line.path, line.width * 0.87, "#594332");
            continue;
        }
        if (
            !p.mouth &&
            expression?.mouth === "speaking" &&
            line.on === "face" &&
            line.path.every(
                ([, y]) =>
                    y >
                    sections[0][0] +
                        0.73 * (sections.at(-1)[0] - sections[0][0])
            )
        ) {
            // Open the existing lip line around its own center on the muzzle.
            const left = line.path[0],
                right = line.path.at(-1);
            const cx = (left[0] + right[0]) / 2,
                cy = (left[1] + right[1]) / 2;
            const rx = Math.abs(right[0] - left[0]) * 0.6,
                ry = rx * 0.26;
            const contour: XY[] = [
                [-1, 0.17],
                [-0.82, -0.49],
                [-0.31, -0.94],
                [0.3, -0.86],
                [0.82, -0.48],
                [1, 0.3],
                [0.65, 0.55],
                [-0.21, 0.59],
                [-0.75, 0.45],
            ].map(([x, y]) => [cx + x * rx, cy + y * ry]);
            d.patch(contour, [cx, cy], lift(face, 1.05), 0.48, mouth, {
                edge: 0.56,
                ink: "#6e4139",
            });
            d.stroke(
                [
                    [cx - rx * 0.6, cy + ry * 0.83],
                    [cx, cy + ry * 0.91],
                    [cx + rx * 0.46, cy + ry * 0.8],
                ],
                lift(face, 0.94),
                0.35,
                "#cb8c74"
            );
            continue;
        }
        d.stroke(
            line.path,
            lift(line.on === "nose" ? nose : face, line.raise),
            line.width
        );
    }
    if (p.mouth) {
        const m = p.mouth,
            path = curve(m.path, true, false),
            [cx, cy] = m.center;
        d.portrait.polygon(path, "#53372f");
        d.portrait.polygon(
            path.map(([x, y]) => [cx + 0.96 * (x - cx), cy + 0.93 * (y - cy)]),
            mouth
        );
        if (m.tongue) d.portrait.polygon(curve(m.tongue, true, false), gum);
        teeth(d, m.teeth);
        if (rounded && expression.mouth === "uncertain") {
            // Keep the character's reference lip position. A resting expression
            // draws a small downturned mouth on the rounded muzzle.
            const half =
                (Math.max(...path.map((p) => p[0])) -
                    Math.min(...path.map((p) => p[0]))) *
                0.39;
            const line: XY[] = [
                [-1, 1.8],
                [-0.58, -0.9],
                [-0.17, -1.8],
                [0.35, -1.45],
                [0.83, 0.2],
                [1, 1.6],
            ].map(([x, y]) => [cx + x * half, cy + y]);
            d.stroke(line, lift(face, 1.1), 0.88, "#674c40");
            d.stroke(
                [
                    [cx - half * 0.47, cy + 2.1],
                    [cx, cy + 1.2],
                    [cx + half * 0.35, cy + 1.4],
                ],
                lift(face, 0.8),
                0.45,
                "#d7977c"
            );
        } else if (rounded) {
            const ring = (scale: number, lift: number) =>
                path.map(([u, v]): Point => {
                    const x = cx + (u - cx) * scale,
                        y = cy + (v - cy) * scale;
                    return [x, y, face(x, y) + lift];
                });
            // The center is backed by solid skull; a raised lip and tooth surfaces
            // give depth from the side without an opening through the head.
            d.s.surface(
                [ring(1.09, 0.5), ring(1.015, 2.5), ring(0.93, 2.2)],
                skin,
                true
            );
            d.s.printUV = d.portrait.uv;
            d.s.surface(
                [
                    ring(0.97, 2.35),
                    ring(0.79, 0.9),
                    ring(0.45, 0.6),
                    ring(0, 0.6),
                ],
                mouth,
                true
            );
            d.s.printUV = undefined;
            for (const [x, y, w, h, slant] of m.teeth) {
                const shape: XY[] = [
                    [x - w * 0.46, y],
                    [x + w * 0.45, y + slant],
                    [x + w * 0.27, y + h * 0.78],
                    [x, y + h],
                    [x - w * 0.3, y + h * 0.72],
                ];
                d.patch(
                    shape,
                    [x, y + h * 0.45],
                    (u, v) => face(u, v) + 2.3,
                    1.0,
                    tooth,
                    { sharp: true }
                );
            }
            d.s.printUV = undefined;
        }
    }
    d.s.skinShadows = skullShadows;
    d.s.referenceFrame = frame;
    d.portrait.finish();
    d.portrait = undefined;
}
