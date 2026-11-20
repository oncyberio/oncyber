import * as T from "three/webgpu";
import { Drawing } from "./drawing";
import { streetYoke } from "./streetShoulder";
import type { Point } from "./sculpt";
import {
    streetShade,
    type StreetPattern,
    sheetScale,
} from "./streetwearPattern";

export const streetFrame = () =>
    new T.Matrix4()
        .makeScale(sheetScale, sheetScale, sheetScale)
        .setPosition(350, 0, 0);
export const ring = (n: number, at: (angle: number) => Point): Point[] =>
    Array.from({ length: n + 1 }, (_, i) => at((2 * Math.PI * (i % n)) / n));
const mix = T.MathUtils.lerp;

function core(d: Drawing, p: StreetPattern) {
    // Stations follow the rib cage, waist, iliac crest and pelvic floor. The
    // neck continues below the clavicles, preserving overlap during head turns.
    const { skin } = p.colors;
    const neck = ring(16, (a) => [
        20 * Math.sin(a),
        211 + 4 * Math.cos(a),
        12 + 21 * Math.cos(a),
    ]);
    const levels = [
        [273, 83, 49, -34],
        [294, 81, 54, -36],
        [319, 78, 55, -36],
        [340, 75, 51, -33],
        [359, 71, 46, -32],
        [384, 65, 43, -30],
        [411, 59, 41, -28],
        [436, 57, 40, -26],
        [465, 60, 42, -27],
        [487, 67, 43, -33],
        [509, 75, 44, -39],
        [534, 82, 46, -40],
        [560, 83, 45, -33],
    ];
    // Keep the sternum, rib margin and pelvis on one smooth front surface.
    // Their shape and soft pigment cues remain legible without painted muscle lines.
    const bulge = (
        x: number,
        y: number,
        cx: number,
        cy: number,
        rx: number,
        ry: number
    ) => Math.exp(-(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2));
    const rows = levels.map(([y, w, f, b]) =>
        ring(16, (a) => {
            const x = w * Math.sin(a),
                c = Math.cos(a),
                side = Math.abs(x);
            const front =
                c > 0
                    ? 4.2 * bulge(side, y, 38, 311, 25, 32) -
                      2.9 * bulge(side, y, 0, 315, 14, 49) +
                      2.4 * bulge(side, y, 23, 412, 21, 56) -
                      3.6 * bulge(side, y, 0, 440, 11, 15)
                    : 0;
            const back =
                c < 0
                    ? 3.4 * bulge(side, y, 0, 368, 12, 92) -
                      2.3 * bulge(side, y, 42, 316, 20, 45)
                    : 0;
            return [
                x,
                y,
                (f + b) / 2 + ((f - b) * c) / 2 + (front + back) * Math.abs(c),
            ];
        })
    );
    d.s.tone = (x, y, z) => {
        const side = Math.abs(x);
        const front = T.MathUtils.smoothstep(z, 5, 31),
            back = T.MathUtils.smoothstep(-z, 8, 29);
        const clavicle = 249 - 0.17 * side,
            ribs = 351 - 0.2 * side,
            iliac = 496 + 0.37 * (58 - side);
        return (
            1.015 -
            front *
                (0.17 * bulge(side, y, 37, clavicle, 34, 7) +
                    0.09 * bulge(side, y, 38, ribs, 36, 14) +
                    0.075 * bulge(side, y, 49, 398, 17, 44) +
                    0.1 * bulge(side, y, 50, iliac, 27, 11) +
                    0.16 * bulge(side, y, 0, 438, 9, 8)) -
            back * 0.09 * bulge(side, y, 4, 360, 15, 75)
        );
    };
    d.s.coverage = (_x, y) => (y > 552 ? 2 : 1);
    streetYoke(d, neck, rows[0], (s) => shoulderSocket(p, s), skin);
    d.torso();
    d.s.surface(rows, skin, false, "perimeter");
    d.s.tone = undefined;
    d.s.endTorso();
    d.s.coverage = undefined;
    d.drape("head", "upperChest", 177, 216);
    d.s.gradient = {
        top: 178,
        bottom: 214,
        from: streetShade(skin, "#fdd8b6", "#e5b490"),
        to: skin,
    };
    d.s.surface(
        [
            [167, 14, 35, 2],
            [179, 16, 37, 0],
            [190, 17, 35, -5],
            [203, 18, 33, -9],
            [216, 26, 32, -13],
            [221, 33, 39, -18],
        ].map(([y, w, f, b]) =>
            ring(16, (a) => [
                w * Math.sin(a),
                y,
                (f + b) / 2 + ((f - b) * Math.cos(a)) / 2,
            ])
        ),
        skin
    );
    d.s.gradient = undefined;
}

function shoulderSocket(p: StreetPattern, s: number): Point[] {
    return ring(16, (a) => [
        s * (p.arm.shoulder + 10),
        p.arm.height - 24 * Math.cos(a),
        1 + 23 * Math.sin(a),
    ]);
}
function arm(d: Drawing, p: StreetPattern, s: number) {
    const { shoulder, elbow, wrist, height } = p.arm,
        side = s < 0 ? "right" : "left",
        skin = p.colors.skin;
    const rows = [
        [shoulder + 24, 24.8, 24, 0],
        [shoulder + 46, 21.8, 22, 1],
        [elbow - 30, 19.6, 20.2, 1],
        [elbow - 8, 16, 18, 0],
        [elbow + 3, 15.7, 17.6, 0],
        [elbow + 20, 17, 18, 1],
        [mix(elbow, wrist, 0.43), 16.5, 16.8, 2],
        [mix(elbow, wrist, 0.74), 12, 14.1, 2.5],
        [wrist + 4, 9.5, 11, 3],
    ];
    // Put a real ring just inside the sleeve. Simplification must never stretch an
    // exposed elbow triangle all the way to a hidden shoulder on the same arm.
    const seam = p.arm.cuff - 18;
    const next = rows.findIndex((row) => row[0] >= seam);
    if (next > 0 && rows[next][0] > seam) {
        const lo = rows[next - 1],
            hi = rows[next],
            t = (seam - lo[0]) / (hi[0] - lo[0]);
        rows.splice(
            next,
            0,
            lo.map((value, i) => mix(value, hi[i], t))
        );
    }
    const skinRows = [
        shoulderSocket(p, s),
        ...rows.map(([x, r, rz, dy]) =>
            ring(16, (a) => [
                s * x,
                height + dy - r * Math.cos(a),
                1 + rz * Math.sin(a),
            ])
        ),
    ];
    d.s.gradient = {
        top: height - 16,
        bottom: height + 22,
        from: skin,
        to: streetShade(skin, "#fdd8b6", "#edc3a1"),
    };
    d.bind(side + "UpperArm");
    d.s.drape = {
        name: side + "LowerArm",
        matrix: d.matrixFor(side + "LowerArm"),
        start: 0,
        end: 1,
        weight: (x) =>
            T.MathUtils.smoothstep(Math.abs(x), elbow - 23, elbow + 26),
    };
    d.s.coverage = (x) =>
        Math.abs(x) <= seam + 0.001
            ? 1
            : Math.abs(x) < p.arm.cuff - 4
            ? 0.75
            : 0;
    d.s.tone = (x, y, z) =>
        1.01 -
        0.12 *
            Math.exp(
                -(((Math.abs(x) - elbow + 3) / 15) ** 2 + ((z - 10) / 10) ** 2)
            ) -
        0.07 * T.MathUtils.smoothstep(y, height + 2, height + 19);
    if (next > 0) {
        const cut = next + 1;
        d.s.surface(skinRows.slice(0, cut + 1), skin, false, "both");
        d.s.surface(skinRows.slice(cut), skin, false, "both");
    } else d.s.surface(skinRows, skin, false, "both");
    d.s.tone = undefined;
    d.s.coverage = undefined;
    d.s.gradient = undefined;
    d.bind(side + "Hand");
    d.s.referenceFrame = undefined;
    const w = d.sourceJoints.get(side + "Hand").point,
        tip = d.sourceJoints.get(side + "MiddleProximal").point;
    const knuckles = [0, 0.36, 0.76, 1].map((t, i) =>
        ring(12, (a) => [
            mix(w[0], tip[0], t),
            mix(w[1], tip[1], t) + [6.8, 8.2, 6.5, 4.9][i] * Math.sin(a),
            mix(w[2], tip[2], t) + [8, 12, 13.1, 12.2][i] * Math.cos(a),
        ])
    );
    d.s.surface([...knuckles, knuckles.at(-1).map((): Point => tip)], skin);
    d.fingers(side, skin, 3.75, d.s.detail === "full");
    d.s.referenceFrame = streetFrame();
}

function leg(d: Drawing, p: StreetPattern, s: number) {
    const side = s < 0 ? "right" : "left",
        skin = p.colors.skin;
    const thigh = side + "UpperLeg",
        shin = side + "LowerLeg",
        foot = side + "Foot",
        cx = p.shoe.center;
    d.s.coverage = () => 2;
    const stations = [
        [605, 48, 40, 39, 3],
        [636, 57, 36.5, 37, 3],
        [671, 65, 31, 32.5, 3],
        [713, 72, 24, 26.5, 4],
        [749, 80, 18, 20, 5],
        [770, 82, 18.2, 21.7, 6.5],
        [787, 84, 15.8, 17, 4],
        [817, 87, 19.2, 22, 0],
        [848, 90, 21.2, 24, -5],
        [881, 93, 17, 18, -6],
        [923, cx - 2, 11.5, 13, -7],
        [953, cx, 10.4, 12, -6],
        [970, cx, 12.5, 13.5, -2],
    ];
    const root = ring(16, (a) => {
        const u = Math.sin(a),
            w = Math.max(0, u);
        return [s * 83 * w, 560 + 34 * Math.max(0, -u), 6 + 39 * Math.cos(a)];
    });
    const rows = [
        root,
        ...stations.map(([y, x, rx, rz, z]) =>
            ring(16, (a) => [
                s * (x + rx * Math.sin(a)),
                y,
                z + rz * Math.cos(a),
            ])
        ),
    ];
    d.bind("hips");
    d.s.drape = {
        name: thigh,
        matrix: d.matrixFor(thigh),
        start: 0,
        end: 1,
        weight: (x, y) =>
            T.MathUtils.smoothstep(y, 560, 626) *
            T.MathUtils.smoothstep(Math.abs(x), 0, 26),
    };
    d.s.tone = (x, y, z) =>
        1.014 -
        0.12 * Math.exp(-(((y - 780) / 13) ** 2 + ((z - 21) / 16) ** 2)) -
        0.085 *
            Math.exp(
                -(((Math.abs(x) - 74) / 22) ** 2 + ((y - 812) / 27) ** 2)
            ) *
            T.MathUtils.smoothstep(-z, 1, 14);
    d.s.surface(rows.slice(0, 4), skin, false, "perimeter");
    d.drape(thigh, shin, 738, 803);
    d.s.surface(rows.slice(3, 11), skin, false, "both");
    d.drape(shin, foot, 927, 965);
    d.s.surface(rows.slice(10), skin, false, "start");
    d.s.tone = undefined;
    d.bind(foot);
    // Longitudinal cross sections describe a heel pad, instep, ball and
    // sloping toe box. Lift the medial arch off the floor in profile.
    const heelToToe = [
        [-26, 4, 980, 987],
        [-22, 14, 971, 991],
        [-12, 16.8, 957, 992],
        [0, 15, 953, 991],
        [16, 15.4, 964, 989],
        [36, 19, 974, 989],
        [62, 23.2, 979, 991],
        [81, 24.6, 980.2, 993],
        [97, 21.5, 981.6, 992],
        [106, 13, 984.4, 991],
        [111, 1, 987, 989],
    ];
    const sole = heelToToe.map(([z, w, top, bottom]) =>
        ring(16, (a) => {
            const lateral = Math.sin(a),
                height = (1 - Math.cos(a)) / 2;
            const medial = Math.max(0, -lateral),
                arch = 5.5 * Math.exp(-(((z - 30) / 25) ** 2));
            return [
                s * (cx + w * lateral - 4 * T.MathUtils.smoothstep(z, 45, 105)),
                mix(top, bottom, height) - arch * height * medial,
                z + (z > 81 ? -lateral * 3.4 : 0),
            ];
        })
    );
    d.s.tone = (_x, y, z) =>
        1.02 -
        0.1 * T.MathUtils.smoothstep(y, 983, 993) -
        0.07 * Math.exp(-(((z - 14) / 18) ** 2 + ((y - 964) / 7) ** 2));
    d.s.surface(
        [
            sole[0].map((): Point => [s * cx, 984, -26]),
            ...sole,
            sole.at(-1).map((): Point => [s * (cx - 4), 988, 111]),
        ],
        skin,
        false,
        "both"
    );
    d.s.tone = undefined;
    d.s.coverage = undefined;
}

export function drawStreetBody(d: Drawing, p: StreetPattern) {
    d.s.thinSkinOutline = false;
    d.s.ambientByPaint[p.colors.skin] = 0.95;
    core(d, p);
    for (const s of [-1, 1]) {
        arm(d, p, s);
        leg(d, p, s);
    }
}
