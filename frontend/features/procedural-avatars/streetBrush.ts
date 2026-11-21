import * as T from "three/webgpu";

/** Family brush coordinates are in the orthographic drawing's units. Ink is
 * sampled after interpolation, so its edge is independent of the mesh diagonals. */
type RGB = [number, number, number];
type XY = [number, number];
type Line = number[][];
const clamp = T.MathUtils.clamp,
    mix = T.MathUtils.lerp;
const blend = (a: RGB, b: RGB, t: number): RGB => [
    mix(a[0], b[0], t),
    mix(a[1], b[1], t),
    mix(a[2], b[2], t),
];
const wash = (
    x: number,
    y: number,
    cx: number,
    cy: number,
    rx: number,
    ry: number
) => Math.exp(-(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2));
const dark: RGB = [22, 16, 16];

// Smooth interpolation of hand-drawn feature margins, with a flat tangent at
// a local extremum. Fits retain these curves through the lid and temple turn.
export function margin(path: Line, x: number) {
    let k = 1;
    while (k < path.length - 1 && x > path[k][0]) k++;
    const a = path[k - 1],
        b = path[k],
        p = path[Math.max(0, k - 2)],
        q = path[Math.min(path.length - 1, k + 1)];
    const w = b[0] - a[0],
        t = clamp((x - a[0]) / w, 0, 1),
        v = t * t;
    const slope = (ax: number, ay: number, bx: number, by: number) => {
        const l = ay / (ax || 1),
            r = by / (bx || 1);
        return l * r > 0 ? (2 * l * r) / (l + r) : 0;
    };
    const d0 =
        p === a
            ? (b[1] - a[1]) / w
            : slope(a[0] - p[0], a[1] - p[1], w, b[1] - a[1]);
    const d1 =
        q === b
            ? (b[1] - a[1]) / w
            : slope(w, b[1] - a[1], q[0] - b[0], q[1] - b[1]);
    return (
        (2 * t * v - 3 * v + 1) * a[1] +
        (t * v - 2 * v + t) * w * d0 +
        (-2 * t * v + 3 * v) * b[1] +
        (t * v - v) * w * d1
    );
}
export const upperLid = [
    [11.1, 131.5],
    [14.5, 128.1],
    [19, 126.1],
    [25, 125.2],
    [31, 125.2],
    [35.5, 126.3],
    [39.6, 127.3],
];
export const lowerLid = [
    [11.1, 131.5],
    [14.4, 132.6],
    [18.7, 136.2],
    [22.9, 137.65],
    [27.4, 137.6],
    [31.5, 135.75],
    [35.4, 129.6],
    [39.6, 127.3],
];
const innerLid = [
    [11.1, 131.5],
    [15, 130.7],
    [19.5, 129.0],
    [25, 128.45],
    [30.5, 128.35],
    [35.5, 129.05],
    [39.6, 127.3],
];
const brow = [
    [9.4, 121.6],
    [14, 118.3],
    [22, 116.4],
    [29, 116.65],
    [35.6, 118.35],
];
const mouth = [
    [-8.0, 167.9],
    [-4.5, 167.35],
    [-1.1, 167.3],
    [2.8, 167.48],
    [7.2, 167.05],
];
function stroke(path: Line, x: number, y: number, r: number) {
    if (x < path[0][0] || x > path.at(-1)[0]) return 0;
    const t = (x - path[0][0]) / (path.at(-1)[0] - path[0][0]);
    return (
        1 -
        T.MathUtils.smoothstep(
            Math.abs(y - margin(path, x)),
            0.05,
            r * Math.sqrt(Math.sin(Math.PI * t)) + 0.18
        )
    );
}
const ala = [
    [-4.3, 152.2],
    [-2.8, 153.3],
    [-1.1, 153.8],
    [0, 153.9],
    [2.4, 153.0],
    [3.8, 150.8],
];
function complexion(x: number, y: number): RGB {
    const a = Math.abs(x);
    let c: RGB = [255, 228, 199];
    c = blend(
        c,
        [235, 164, 123],
        0.27 * wash(a, y, 30, 142, 16, 10) + 0.13 * wash(a, y, 29, 150, 20, 19)
    );
    c = blend(
        c,
        [224, 161, 122],
        0.49 * wash(a, y, 24, 124, 18, 6.6) + 0.25 * wash(a, y, 35, 123, 8, 20)
    );
    c = blend(c, [255, 239, 210], 0.48 * wash(x, y, -5, 150, 12, 21));
    c = blend(
        c,
        [227, 161, 123],
        0.53 * wash(a, y, 3.5, 154.6, 3.3, 2.1) +
            0.18 * wash(x, y, 4, 149, 3.9, 5)
    );
    c = blend(c, [255, 242, 218], 0.67 * wash(x, y, -1.55, 150.45, 1.45, 3.6));
    // The light breaks across the bridge and the tucked-under tip. Keep
    // the two alar creases separate across the columella through a turn.
    const bridge = 2.1 + 2.4 * T.MathUtils.smoothstep(y, 139, 151);
    c = blend(c, [215, 149, 111], 0.42 * wash(x, y, bridge, 146.8, 2.5, 7.9));
    c = blend(c, [227, 174, 138], 0.34 * wash(x, y, -bridge, 146.5, 2, 6.7));
    const underside = 153.8 - 1.55 * (a / 4.4) ** 2;
    c = blend(c, [199, 133, 98], 0.58 * wash(x, y, 0.6, underside, 4.6, 1.35));
    c = blend(c, [149, 93, 65], 0.78 * stroke(ala, x, y, 0.72));
    c = blend(c, [132, 83, 60], 0.65 * wash(a, y, 3.55, 153.2, 0.95, 0.68));
    c = blend(c, [239, 187, 159], 0.8 * wash(x, y, 0, 169.3, 5.8, 1.55));
    c = blend(c, [67, 45, 42], stroke(mouth, x, y, 0.95));
    c = blend(c, [255, 235, 211], 0.76 * wash(x, y, -0.25, 170.3, 3.1, 0.58));
    c = blend(c, [100, 64, 43], 0.98 * stroke(brow, a, y, 1.12));
    const fold = margin(upperLid, clamp(a, 12, 38)) - 2.18;
    c = blend(c, [172, 124, 90], 0.53 * wash(a, y, 23, fold, 11.8, 0.66));
    return c;
}
// The two charts are mirrored over the sagittal plane.
export const streetIrisX = 22.45;
function eyeBrush(x: number, y: number): RGB {
    const top = margin(innerLid, x),
        bottom = margin(lowerLid, x);
    let c: RGB = blend(
        [254, 248, 232],
        [176, 151, 141],
        0.43 * Math.exp(-Math.max(0, y - top) / 1.35)
    );
    // The dark upper iris disappears into the lash. The lower half opens
    // into a blue crescent and closes against a narrow, desaturated limbus.
    const irisX = x + (23.55 - streetIrisX);
    const radius = Math.hypot((irisX - 23.55) / 6.85, (y - 130.3) / 7.08);
    if (radius < 1.07) {
        const lower = T.MathUtils.smoothstep(y, 130.3, 135.55);
        let iris = blend([9, 34, 66], [78, 148, 207], lower);
        iris = blend(
            iris,
            [103, 175, 222],
            0.65 * wash(irisX, y, 23.8, 134.55, 4.2, 1.4)
        );
        iris = blend(
            iris,
            [21, 44, 65],
            T.MathUtils.smoothstep(radius, 0.78, 0.98)
        );
        const pupil = Math.hypot((irisX - 23.6) / 3.23, (y - 129.7) / 3.98);
        iris = blend(
            iris,
            [13, 13, 19],
            1 - T.MathUtils.smoothstep(pupil, 0.74, 1.05)
        );
        iris = blend(
            iris,
            [145, 180, 204],
            0.78 * wash(irisX, y, 27.35, 130.0, 2.3, 1.11)
        );
        iris = blend(
            iris,
            [221, 240, 246],
            0.94 * wash(irisX, y, 27.47, 129.75, 1.02, 0.65)
        );
        iris = blend(
            iris,
            [118, 148, 165],
            0.78 * wash(irisX, y, 20.3, 129.67, 1.65, 0.98)
        );
        c = blend(c, iris, 1 - T.MathUtils.smoothstep(radius, 0.96, 1.06));
    }
    c = blend(
        c,
        [103, 77, 68],
        0.86 * (1 - T.MathUtils.smoothstep(bottom - y, 0.12, 0.79))
    );
    return blend(c, dark, 1 - T.MathUtils.smoothstep(y - top, -0.12, 0.17));
}
// Spline margins of the antihelix and conchal bowl from the registered
// profile. Their pigment can stay crisp on the relatively shallow ear shell.
const conchaLeft = [
    [-0.32, 0.43],
    [-0.22, 0.25],
    [-0.14, -0.02],
    [-0.06, -0.18],
    [0.12, -0.32],
    [0.24, -0.36],
    [0.43, -0.24],
    [0.51, -0.04],
    [0.57, 0.25],
    [0.65, 0.51],
];
const conchaRight = [
    [-0.32, 0.45],
    [-0.17, 0.56],
    [0.0, 0.5],
    [0.17, 0.32],
    [0.25, 0.35],
    [0.43, 0.58],
    [0.53, 0.64],
    [0.65, 0.51],
];
const upperHelix = [
    [-0.65, -0.26],
    [-0.48, -0.49],
    [-0.2, -0.69],
    [0.02, -0.74],
    [0.22, -0.67],
    [0.42, -0.49],
    [0.51, -0.27],
];
function earBrush(u: number, v: number): RGB {
    const rim = Math.hypot(u, v);
    let c: RGB = blend(
        [255, 224, 188],
        [230, 166, 122],
        0.65 * wash(u, v, -0.12, -0.32, 0.62, 0.5)
    );
    c = blend(
        c,
        [255, 237, 206],
        0.72 * Math.exp(-(((rim - 0.8) / 0.11) ** 2))
    );
    const left = margin(conchaLeft, v),
        right = margin(conchaRight, v);
    if (v >= -0.32 && v <= 0.65) {
        const sd = Math.min(
            u - left,
            right - u,
            (v + 0.32) * 2,
            (0.65 - v) * 2
        );
        c = blend(
            c,
            [228, 155, 107],
            T.MathUtils.smoothstep(sd, -0.035, 0.045)
        );
        const boundary = Math.min(Math.abs(u - left), Math.abs(u - right));
        const line =
            (1 - T.MathUtils.smoothstep(boundary, 0.015, 0.085)) *
            T.MathUtils.smoothstep(sd, -0.075, -0.005);
        c = blend(
            c,
            [105, 64, 44],
            line * (u > (left + right) * 0.5 ? 0.92 : 0.54)
        );
    }
    const helix = margin(upperHelix, u);
    c = blend(
        c,
        [115, 71, 45],
        0.89 *
            (1 - T.MathUtils.smoothstep(Math.abs(v - helix), 0.02, 0.085)) *
            T.MathUtils.smoothstep(u, -0.67, -0.49) *
            (1 - T.MathUtils.smoothstep(u, 0.48, 0.54))
    );
    c = blend(
        c,
        [219, 146, 102],
        0.53 * wash(u, v, 0.16, helix + 0.12, 0.25, 0.1)
    );
    c = blend(c, [138, 89, 60], 0.72 * wash(u, v, 0.18, -0.54, 0.15, 0.13));
    return blend(c, [161, 111, 76], T.MathUtils.smoothstep(rim, 0.94, 1));
}
// A fold has a soft plane facing the light and a narrow occlusion at the
// overlap. All coordinates belong to the cut of the garment in the rest pose.
const denimFolds = [
    [[18, 662], [40, 640], [61, 625], 5, 0.32],
    [[23, 707], [44, 683], [75, 652], 8, 0.17],
    [[144, 741], [127, 766], [60, 824], 9, 0.66],
    [[148, 753], [120, 779], [79, 800], 6, 0.39],
    [[22, 748], [37, 774], [28, 809], 7, 0.42],
    [[159, 829], [122, 834], [77, 858], 12, 0.63],
    [[145, 866], [120, 850], [76, 852], 7, 0.43],
    [[35, 878], [53, 869], [92, 861], 8, 0.34],
    [[159, 920], [131, 901], [92, 893], 11, 0.65],
    [[151, 940], [125, 931], [96, 919], 7, 0.43],
    [[24, 926], [49, 910], [61, 904], 8, 0.59],
    [[29, 957], [52, 939], [85, 932], 10, 0.46],
] as const;
const shirtFolds = [
    [[52, 219], [73, 253], [95, 298], 5, 0.3],
    [[118, 239], [107, 267], [100, 310], 7, 0.46],
    [[181, 238], [164, 266], [153, 307], 8, 0.35],
    [[204, 251], [189, 270], [180, 297], 5, 0.22],
    [[97, 342], [112, 380], [103, 446], 7, 0.35],
    [[95, 405], [82, 452], [48, 493], 8, 0.4],
    [[108, 458], [76, 476], [51, 505], 5, 0.24],
    [[113, 479], [105, 490], [93, 510], 5, 0.38],
] as const;
type Fold = (typeof denimFolds)[number] | (typeof shirtFolds)[number];
function foldedLight(x: number, y: number, folds: readonly Fold[]) {
    let light = 1;
    for (const [p, c, q, w, strength] of folds) {
        const dx = q[0] - p[0],
            dy = q[1] - p[1],
            t = clamp(
                ((x - p[0]) * dx + (y - p[1]) * dy) / (dx * dx + dy * dy),
                0,
                1
            );
        const h = 1 - t,
            bx = h * h * p[0] + 2 * h * t * c[0] + t * t * q[0],
            by = h * h * p[1] + 2 * h * t * c[1] + t * t * q[1];
        const tx = h * (c[0] - p[0]) + t * (q[0] - c[0]),
            ty = h * (c[1] - p[1]) + t * (q[1] - c[1]);
        const dist =
            ((x - bx) * ty - (y - by) * tx) / (Math.hypot(tx, ty) || 1);
        const fade = Math.sin(pi * t) ** 0.65,
            width = w * (0.52 + 0.48 * fade);
        light +=
            strength *
            fade *
            (0.47 * Math.exp(-(((dist + width * 0.9) / (1.2 * width)) ** 2)) -
                0.72 * Math.exp(-((dist / (width * 0.49)) ** 2)) -
                0.23 *
                    Math.exp(-(((dist - width * 0.55) / (width * 1.3)) ** 2)));
    }
    return light;
}
const pi = Math.PI;
function fabric(x: number, y: number, tee: boolean): RGB {
    const light = foldedLight(
        tee ? Math.abs(x) : x,
        y,
        tee ? shirtFolds : denimFolds
    );
    const value = 128 * clamp(light, 0.54, 1.33);
    return [value, value, value + 1];
}
const charts = {
    skin: {
        x: 0,
        y: 736,
        w: 224,
        h: 256,
        left: -54,
        right: 54,
        top: 93,
        bottom: 188,
    },
    eye: {
        x: 224,
        y: 736,
        w: 164,
        h: 92,
        left: 10,
        right: 41,
        top: 122,
        bottom: 141,
    },
    ear: {
        x: 388,
        y: 736,
        w: 124,
        h: 92,
        left: -1.05,
        right: 1.05,
        top: -1.05,
        bottom: 1.05,
    },
    denim: {
        x: 224,
        y: 828,
        w: 148,
        h: 164,
        left: 0,
        right: 183,
        top: 543,
        bottom: 982,
    },
    tee: {
        x: 372,
        y: 828,
        w: 140,
        h: 164,
        left: -235,
        right: 235,
        top: 175,
        bottom: 550,
    },
};
export type StreetChart = keyof typeof charts;
export const streetSkinTile = 51,
    streetEyeTile = 52,
    streetHairTile = 53,
    streetClothTile = 55;
export const brushAtlasHeight = 992;
export function streetPaintUV(name: StreetChart, x: number, y: number): XY {
    const t = charts[name],
        tile =
            name === "eye"
                ? streetEyeTile
                : name === "denim" || name === "tee"
                ? streetClothTile
                : streetSkinTile;
    return [
        tile +
            (t.x +
                2.5 +
                clamp((x - t.left) / (t.right - t.left), 0, 1) * (t.w - 5)) /
                512,
        (t.y +
            2.5 +
            clamp((y - t.top) / (t.bottom - t.top), 0, 1) * (t.h - 5)) /
            brushAtlasHeight,
    ];
}
export function paintStreetBrushes(pixels: Uint8Array) {
    for (const [name, t] of Object.entries(charts)) {
        const sample =
            name === "eye"
                ? eyeBrush
                : name === "ear"
                ? earBrush
                : name === "skin"
                ? complexion
                : (x: number, y: number) => fabric(x, y, name === "tee");
        for (let j = 0; j < t.h; j++)
            for (let i = 0; i < t.w; i++) {
                const x = mix(
                        t.left,
                        t.right,
                        clamp((i - 2) / (t.w - 5), 0, 1)
                    ),
                    y = mix(t.top, t.bottom, clamp((j - 2) / (t.h - 5), 0, 1));
                const c = sample(x, y),
                    k = ((t.y + j) * 512 + t.x + i) * 4;
                pixels[k] = Math.round(c[0]);
                pixels[k + 1] = Math.round(c[1]);
                pixels[k + 2] = Math.round(c[2]);
                pixels[k + 3] = 255;
            }
    }
}
