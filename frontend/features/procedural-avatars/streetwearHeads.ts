import * as T from "three/webgpu";
import {
    Drawing,
    ellipse,
    lift,
    type Depth,
    type Section,
    type XY,
} from "./drawing";
import type { StreetLook } from "./streetwearRecipes";
import type { Point } from "./sculpt";

// Canonical face coordinates. Y increases from the crown toward the chin.
// The head joint orients the entire sculpt, including ears and eyes, together.
const skull: Section[] = [
    [-94, -2, 2, 3, -4],
    [-90, -20, 20, 19, -4],
    [-81, -34, 34, 31, -4],
    [-68, -43, 43, 40, -3],
    [-51, -47, 47, 44, -2],
    [-36, -46, 46, 43, 0],
    [-23, -42, 42, 39, 2],
    [-12, -35, 35, 33, 4],
    [-3, -24, 24, 24, 5],
    [3, -12, 12, 13, 5],
    [5, -2, 2, 3, 5],
];
function eyelid(d: Drawing, face: Depth, side: number, l: StreetLook) {
    const loc = l.hairStyle === "locs",
        gold = l.hairStyle === "star";
    const x = side * 18.5,
        y = -37,
        h = gold ? 4.5 : 7.2,
        w = 12.4;
    const xy = (u: number, v: number): XY => [
        x + side * u * w,
        y + v * h - u * (loc ? 3 : gold ? 1.3 : 1.9),
    ];
    if (gold) {
        const narrow = [
            xy(-0.82, -0.2),
            xy(-0.25, -0.36),
            xy(0.72, -0.42),
            xy(1, -0.63),
            xy(0.8, 0.23),
            xy(0.36, 0.44),
            xy(-0.49, 0.37),
        ];
        d.decal(narrow, lift(face, 1.65), "#352b28");
        d.stroke(
            [xy(-0.72, 0.63), xy(-0.24, 0.78), xy(0.38, 0.6)],
            lift(face, 1.4),
            0.5,
            "#bd8c54"
        );
        return;
    }
    const outline: XY[] = [
        xy(-1, 0.12),
        xy(-0.78, -0.45),
        xy(-0.31, -0.87),
        xy(0.28, -0.99),
        xy(0.88, -0.63),
        xy(1, -0.16),
        xy(0.67, 0.46),
        xy(0.02, 0.72),
        xy(-0.58, 0.56),
    ];
    const white = d.patch(
        outline,
        [x, y],
        lift(face, 1.1),
        2.3,
        loc ? "#f6e6d8" : "#fff7e1",
        { sharp: true }
    );
    const ix = x + (loc ? 3.5 : 3.1),
        iy = y - (loc ? 2.1 : 1.1),
        rx = gold ? 3.1 : 4.4,
        ry = gold ? 3.5 : 5.3;
    d.decal(
        ellipse(ix, iy, rx, ry),
        lift(white, 0.85),
        loc ? "#975f43" : gold ? "#a98845" : "#6595ac"
    );
    d.decal(
        ellipse(ix + 0.3, iy - 0.25, rx * 0.55, ry * 0.79),
        lift(white, 1.18),
        "#28232b"
    );
    d.decal(ellipse(ix - 1, iy - 1.7, 1.2, 1.25), lift(white, 1.55), "#fffbec");
    d.decal(
        [
            xy(-1, 0.12),
            xy(-0.74, -0.62),
            xy(-0.25, -1.07),
            xy(0.37, -1.17),
            xy(0.91, -0.86),
            xy(1.25, -1.1),
            xy(1, -0.12),
            xy(0.47, -0.63),
            xy(-0.12, -0.72),
            xy(-0.66, -0.32),
        ],
        lift(white, 2.25),
        l.ink
    );
    d.stroke(
        [xy(0.96, 0.03), xy(0.61, 0.54), xy(0, 0.79)],
        lift(white, 0.72),
        0.5,
        l.ink
    );
    d.decal(
        [
            xy(-0.97, -1.68),
            xy(-0.31, -2.22),
            xy(0.39, -2.24),
            xy(0.96, -2.12),
            xy(0.27, -1.81),
            xy(-0.48, -1.7),
        ],
        lift(face, 1.5),
        l.ink
    );
}
const hairColors = {
    star: { root: "#cc9d4c", tip: "#fff1a6", edge: "#916b40" },
    fringe: { root: "#c39b72", tip: "#fff0c7", edge: "#967450" },
    locs: { root: "#271e22", tip: "#392a29", edge: "#493732" },
};
function hair(d: Drawing, l: StreetLook) {
    const loc = l.hairStyle === "locs",
        gold = l.hairStyle === "star",
        colors = hairColors[l.hairStyle];
    const rz = 47,
        rx = 50,
        cy = -50;
    // A closed hemispherical hairline wraps through the temples and the nape.
    const cap = Array.from({ length: 8 }, (_, row) =>
        Array.from({ length: 29 }, (_, i): Point => {
            const a = (i * Math.PI) / 14,
                front = Math.cos(a);
            const edge = 1.87 - 0.65 * front + 0.07 * Math.sin(3 * a + 0.5),
                lat = 0.015 + ((edge - 0.015) * row) / 7;
            return [
                rx * Math.sin(lat) * Math.sin(a),
                cy - 48 * Math.cos(lat),
                -3 + rz * Math.sin(lat) * front,
            ];
        })
    );
    d.s.gradient = { top: -88, bottom: -18, from: l.hair, to: colors.root };
    d.s.surface(cap, l.hair);
    d.s.gradient = undefined;
    if (loc) {
        // Cylindrical locs leave the scalp in several depth planes. Rounded tips
        // and a bare central neck keep the rear and profile silhouettes legible.
        const locks: [Point, Point, Point, number][] = [
            [[-21, -81, -3], [-51, -88, -12], [-63, -99, -17], 7],
            [[-35, -72, -5], [-56, -72, -15], [-68, -77, -22], 7.8],
            [[-39, -60, -6], [-54, -56, -21], [-64, -56, -33], 8],
            [[-40, -50, -8], [-52, -41, -26], [-59, -43, -39], 8.2],
            [[-31, -47, -28], [-40, -27, -37], [-47, -24, -41], 7.5],
            [[-15, -49, -40], [-21, -29, -47], [-25, -14, -45], 8],
            [[3, -51, -43], [5, -29, -51], [1, -15, -47], 8],
            [[24, -55, -34], [34, -32, -44], [38, -23, -40], 8],
            [[41, -55, -14], [50, -39, -22], [52, -31, -17], 7.5],
            [[37, -72, 0], [48, -65, 5], [51, -59, 12], 7.5],
            [[13, -87, 20], [-7, -84, 37], [-21, -68, 40], 8.4],
            [[0, -89, 20], [-18, -77, 40], [-30, -46, 36], 7.9],
            [[-16, -85, 17], [-33, -69, 32], [-39, -37, 27], 8.4],
            [[-24, -79, 11], [-41, -59, 21], [-45, -31, 12], 8],
        ];
        locks.forEach(([start, mid, end, r], i) => {
            const v = new T.Vector3(...end)
                .sub(new T.Vector3(...mid))
                .normalize();
            const tip = (n: number) =>
                new T.Vector3(...end).addScaledVector(v, n).toArray() as Point;
            d.s.sweep(
                [start, mid, end, tip(3), tip(4.4)],
                [r * 1.05, r, r * 0.82, r * 0.62, 0],
                i % 4 === 2 ? colors.tip : l.hair,
                8
            );
        });
        return;
    }
    const crown = l.crown;
    if (crown) {
        const headFrame = d.s.referenceFrame;
        d.s.referenceFrame = undefined;
        const steps = [0, 0.44, 0.72, 0.9, 1];
        d.s.gradient = {
            top: crown.center[1] - 70,
            bottom: crown.center[1] + 43,
            from: l.hair,
            to: colors.root,
        };
        d.crown(
            crown.center,
            crown.rim,
            steps,
            (i, j, front) => {
                const t = steps[j];
                const thickness = Math.sqrt(1 - t * t) * crown.depth;
                return (
                    -18 +
                    (front ? 0.34 : -0.94) * thickness +
                    t * 5 * Math.sin(i * 1.78)
                );
            },
            l.hair
        );
        d.s.referenceFrame = headFrame;
        d.s.gradient = undefined;
    }
    if (gold) {
        d.lock([-31, -62, 25], [-38, -42, 36], 10, 6, l.hair);
        d.lock([26, -72, 29], [37, -39, 33], 11, 7, l.hair);
        // The small four-point highlight is confined to the hair above the brow.
        const forehead: Depth = (x, y) =>
            -3 +
            rz *
                Math.sqrt(
                    Math.max(0.02, 1 - (x / rx) ** 2 - ((y - cy) / 48) ** 2)
                ) +
            1;
        d.decal(
            [
                [7, -90],
                [10, -75],
                [19, -72],
                [11, -69],
                [10, -57],
                [7, -68],
                [-2, -70],
                [6, -74],
            ],
            forehead,
            colors.tip
        );
    } else {
        [
            [-30, -55],
            [-18, -50],
            [-4, -53],
            [10, -48],
            [23, -51],
            [35, -52],
        ].forEach(([x, end], i) => {
            const z = 43 * Math.sqrt(1 - (x / 49) ** 2);
            d.lock(
                [x + 5, -73, z - 10],
                [x - 3, end, z + 3.2],
                10.5,
                6.5,
                i % 3 === 0 ? "#f3deaf" : l.hair
            );
        });
        d.lock([-42, -51, 12], [-45, -17, 10], 9, 8, l.hair);
        d.lock([42, -52, 9], [44, -18, 6], 9, 8, l.hair);
    }
}
export function drawStreetHead(d: Drawing, l: StreetLook) {
    d.bind("head");
    const [width, height, depth] = l.head;
    const joint = l.landmarks.jaw;
    d.s.referenceFrame = new T.Matrix4()
        .makeTranslation(...joint)
        .multiply(new T.Matrix4().makeScale(1, -1, 1))
        .multiply(
            new T.Matrix4().makeRotationFromQuaternion(
                d.rig.joints.get("head").orientation
            )
        )
        .multiply(
            new T.Matrix4().makeScale(width / 94, -height / 99, depth / 88)
        );
    d.s.cheeks = [-1, 1].map((k) => ({ x: k * 27, y: -23, rx: 12, ry: 8 }));
    d.s.skinShadows = [
        { center: [0, -55, 35], radii: [36, 10, 22], opacity: 0.27 },
        { center: [0, 0, 16], radii: [27, 10, 18], opacity: 0.19 },
    ];
    d.s.ambientByPaint[l.skin] = 0.77;
    if (l.hairStyle === "star")
        d.s.gradient = { top: -75, bottom: -20, from: l.hair, to: l.skin };
    const face = d.body(skull, l.skin, false, 24);
    d.s.gradient = undefined;
    for (const k of [-1, 1]) {
        d.s.oval([k * 44, -30, 0], [8.2, 11.5, 7.5], l.skin, k * 0.15);
        d.stroke(
            [
                [k * 47, -35],
                [k * 50, -34],
                [k * 50, -30],
                [k * 46, -27],
            ],
            () => 6,
            0.8,
            l.ink
        );
        if (l.hairStyle === "locs")
            d.s.oval([k * 46, -21, 5], [2.4, 2.7, 2.1], "#e6e0d7");
        eyelid(d, face, k, l);
    }
    const nose = d.patch(
        [
            [-4, -39],
            [2, -40],
            [5, -27],
            [7, -23],
            [6, -20],
            [1, -18],
            [-5, -20],
            [-6, -23],
        ],
        [0, -24],
        lift(face, 0.45),
        7,
        l.skin,
        { sharp: true }
    );
    d.stroke(
        [
            [-4, -21],
            [0, -19.7],
            [4, -21],
        ],
        lift(nose, 0.8),
        0.66,
        l.ink
    );
    const tilt =
        l.hairStyle === "locs" ? -1.1 : l.hairStyle === "star" ? 1.7 : 0.5;
    d.stroke(
        [
            [-8, -8 + tilt],
            [-4, -9],
            [1, -8.8],
            [6, -8.4],
            [8, -9 - tilt * 0.3],
        ],
        lift(face, 1.1),
        0.92,
        l.ink
    );
    d.stroke(
        [
            [-3, -6],
            [1, -5.6],
            [4, -6.2],
        ],
        lift(face, 1.2),
        0.62,
        l.hairStyle === "locs" ? "#c98c70" : "#e1ac89"
    );
    if (l.hairStyle === "fringe")
        d.s.sweep(
            [
                [6, -8, face(6, -8) + 0.7],
                [13, -4.6, face(6, -8) + 3],
                [22, 1, face(6, -8) + 9],
            ],
            [0.85, 0.73, 0.35],
            "#4d423b",
            4
        );
    hair(d, l);
    d.s.referenceFrame = undefined;
}
