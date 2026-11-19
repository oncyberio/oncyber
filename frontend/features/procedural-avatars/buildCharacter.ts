import { castCacheKey } from "./cartoonCast";
import { drawCartoonHumanoid } from "./cartoonHumanoid";
import { avatarStyles } from "./styles";
import classicLook from "./rick-paint.json";
import classic from "./rick-classic.json";
import { drawFittedAvatar } from "./fittedAvatar";
import * as T from "three/webgpu";
import {
    Drawing,
    ellipse,
    ink,
    level,
    profileDepth,
    lift,
    type Depth,
    type Section,
    type XY,
} from "./drawing";
import { paintStrip } from "./garmentPrint";
import { drawHead, paint } from "./heads";
import { finish } from "./surfaces";
import type { Character } from "./catalog";
import { defineLook, type AvatarRecipe, type StyleRecipe } from "./recipes";
import {
    drawShapeRecipe,
    trouserLeg,
    trouserShin,
    type GarmentPrints,
    type ShapeRecipe,
} from "./shapeRecipe";
import { isStreet, looks } from "./streetwearRecipes";
import { drawStreetwear } from "./streetwear";
import sunshine from "./sunshine.json";
import sunshinePrint from "./sunshine-print.json";
import type { Point, TemplateSource } from "./sculpt";

const cloth = {
    tee: "#ffd65d",
    vest: "#43251e",
    badge: "#5b4564",
    denim: "#342b3b",
    socks: "#f8e4dc",
    sneaker: "#e0cce4",
    tank: "#d859a4",
    pants: "#f4e9e3",
    flats: "#272023",
    coat: "#fff0cb",
    lining: "#c6ad8b",
    shirt: "#c9ca9b",
    armor: "#3e2c38",
    leather: "#60414b",
    slacks: "#966137",
    belt: "#513923",
    shoes: "#3c3039",
};
const lerp = (a: Point, b: Point, t: number): Point =>
    a.map((v, i) => T.MathUtils.lerp(v, b[i], t)) as Point;
function capsule(
    d: Drawing,
    a: Point,
    b: Point,
    r1: number,
    r2: number,
    color: string
) {
    d.s.sweep(
        [lerp(a, b, -0.05), a, lerp(a, b, 0.5), b, lerp(a, b, 1.065)],
        [r1 * 0.5, r1, (r1 + r2) * 0.5, r2, r2 * 0.52],
        color,
        10
    );
}
function patch(
    d: Drawing,
    path: XY[],
    center: XY,
    surface: Depth,
    color: string,
    edge = 0.74
) {
    return d.patch(path, center, surface, 0.85, color, { edge });
}
function mortyTorso(d: Drawing) {
    d.torso();
    const rows: Section[] = [
        [322, 125, 164, 17],
        [329, 119, 174, 20],
        [344, 115, 186, 24],
        [373, 114, 187, 25],
        [404, 113, 190, 25],
        [441, 111, 194, 26],
        [463, 114, 195, 26],
        [491, 114, 196, 25],
    ];
    d.crewUnderlayer(
        rows[0],
        avatarStyles.cartoon.neckline,
        cloth.tee,
        "#d2a449",
        paint.morty.skin
    );
    const vestTop = (a: number) => {
        const x = Math.abs(Math.sin(a));
        if (Math.cos(a) < 0) return 334;
        return 346 - 23 * Math.exp(-(((x - 0.69) / 0.2) ** 4));
    };
    const vestHem = (a: number) => 444 + 2 * Math.cos(a);
    d.wrap(rows, () => 322, vestTop, cloth.tee, 0, false, "end");
    const uv = paintStrip("vest", (u, v) => {
        const x = Math.sin(u * 2 * Math.PI),
            front = Math.cos(u * 2 * Math.PI) > 0;
        if (!front) return;
        if (x > -0.91 && x < 0.2 && v > 0.15 && v < 0.32) return cloth.badge;
        if (x > 0.45 && x < 0.92 && v > 0.81 && v < 0.91) return "#36231e";
    });
    d.s.printUV = (x, y, a) => uv(a, (y - 334) / 110);
    d.wrap(rows, vestTop, vestHem, cloth.vest, 0, false, "both");
    d.s.printUV = undefined;
    d.wrap(rows, vestHem, () => 491, cloth.tee, 0, false, "start");
    d.s.endTorso();
}
function summerTorso(d: Drawing) {
    const { skin } = paint.summer;
    d.torso();
    const sections: Section[] = [
        [260, 367, 392, 11],
        [271, 367, 392, 12],
        [277, 357, 403, 15],
        [282, 346, 414, 18],
        [291, 344, 417, 21],
        [305, 343, 418, 22],
        [326, 344, 413, 25],
        [338, 344, 415, 26],
        [348, 350, 411, 25],
        [359, 353, 405, 24],
        [377, 351, 406, 24],
        [401, 345, 414, 27],
        [428, 338, 420, 29],
        [433, 340, 418, 27],
    ];
    const top = profileDepth(sections);
    const neckline = (a: number) => {
        const x = Math.abs(Math.sin(a)),
            front = Math.cos(a) > 0;
        const inner = front ? 313 : 299;
        if (x < 0.6) return inner - (inner - 279) * Math.pow(x / 0.6, 3.6);
        if (x < 0.79) return 279 + (x - 0.6) * 12;
        return 281 + 47 * Math.pow((x - 0.79) / 0.21, 2);
    };
    d.wrap(sections, () => 260, neckline, skin, 0, false, "end");
    d.wrap(sections, neckline, () => 433, cloth.tank, 0, false, "start");
    d.stroke(
        [
            [374, 346],
            [382, 345.4],
            [390, 346],
        ],
        lift(top, 3.2),
        0.64
    );
    d.s.endTorso();
}
function coat(d: Drawing) {
    // Each row sweeps around the back from the far front edge to the near one.
    // Variable hem height across the sweep gives the windblown coat its opening.
    // One two-sided shell keeps the lining registered throughout the swing.
    const rails: Point[][] = [
        [
            [645, 151, 29],
            [628, 165, 13],
            [625, 161, -21],
            [669, 148, -39],
            [715, 143, -19],
            [721, 146, 8],
            [695, 145, 31],
        ],
        [
            [637, 199, 31],
            [619, 193, 10],
            [622, 195, -27],
            [665, 194, -42],
            [724, 189, -23],
            [733, 193, 8],
            [691, 194, 36],
        ],
        [
            [620, 253, 30],
            [604, 249, 9],
            [617, 248, -31],
            [661, 247, -48],
            [735, 245, -27],
            [745, 247, 7],
            [700, 247, 36],
        ],
        [
            [592, 309, 28],
            [570, 313, 8],
            [589, 310, -33],
            [652, 305, -49],
            [746, 303, -28],
            [758, 307, 7],
            [713, 309, 35],
        ],
        [
            [555, 376, 27],
            [540, 371, 7],
            [562, 367, -36],
            [644, 358, -52],
            [755, 359, -28],
            [774, 373, 6],
            [723, 380, 34],
        ],
        [
            [524, 445, 24],
            [516, 431, 6],
            [540, 422, -36],
            [631, 412, -51],
            [767, 421, -28],
            [786, 442, 5],
            [735, 445, 32],
        ],
        [
            [506, 505, 21],
            [502, 488, 4],
            [525, 470, -34],
            [626, 451, -49],
            [772, 458, -24],
            [790, 493, 5],
            [755, 510, 29],
        ],
        [
            [499, 550, 18],
            [499, 545, 4],
            [526, 519, -33],
            [629, 482, -46],
            [737, 513, -26],
            [782, 557, 5],
            [768, 588, 25],
        ],
    ];
    const rows = rails.map((row) =>
        new T.CatmullRomCurve3(
            row.map((p) => new T.Vector3(...p)),
            false,
            "catmullrom",
            0.38
        ).getPoints(48)
    );
    d.s.lined = true;
    // Preserve the coat opening and curved hem, especially against the lining.
    d.s.preserveVertex = (x, y, z) =>
        rows.at(-1).some((p) => Math.hypot(x - p.x, y - p.y, z - p.z) < 0.03);
    d.s.tone = (x, y, z) =>
        0.98 -
        0.11 * Math.exp(-(((x - 711 - (y - 230) * 0.09) / 14) ** 2)) +
        0.035 * Math.sin(x * 0.048 + y * 0.016);
    d.s.surface(
        rows.map((row) => row.map((p) => p.toArray() as Point).reverse()),
        cloth.coat
    );
    d.s.lined = false;
    d.s.preserveVertex = undefined;
    d.s.tone = undefined;
    for (const col of [0, 48])
        d.s.ribbon(
            rows.map((row) => row[col].toArray() as Point),
            1,
            ink
        );
    d.s.ribbon(
        rows.at(-1).map((p) => p.toArray() as Point),
        0.85,
        ink
    );
    d.stroke(
        [
            [640, 162],
            [617, 213],
            [631, 217],
            [617, 236],
            [629, 236],
            [608, 279],
        ],
        level(35),
        0.9
    );
    d.stroke(
        [
            [706, 161],
            [719, 207],
            [706, 214],
            [720, 229],
            [723, 278],
        ],
        level(39),
        0.75
    );
}
function rickTorso(d: Drawing) {
    d.torso();
    coat(d);
    const sections: Section[] = [
        [150, 642, 691, 20],
        [162, 642, 695, 25],
        [170, 637, 700, 28],
        [190, 632, 701, 29],
        [228, 630, 699, 30],
        [264, 632, 703, 31],
        [293, 636, 708, 32],
        [316, 642, 713, 29],
        [328, 646, 716, 28],
        [338, 649, 716, 27],
    ];
    d.crewUnderlayer(
        sections[0],
        avatarStyles.cartoon.neckline,
        cloth.shirt,
        "#9c9c78",
        paint.rick.skin
    );
    const shirt = profileDepth(sections);
    const uv = paintStrip("armor", (t) => {
        const y = 163 + t * 153;
        return [
            [186, 202],
            [276, 293],
            [296, 312],
        ].some(([a, b]) => y >= a && y <= b)
            ? cloth.leather
            : undefined;
    });
    d.wrap(
        sections,
        () => 150,
        () => 163,
        cloth.shirt,
        0,
        false,
        "end"
    );
    d.s.printUV = (x, y, a) =>
        uv((y + 1.7 * Math.sin(2 * Math.PI * a) - 163) / 153);
    d.wrap(
        sections,
        () => 163,
        () => 316,
        cloth.armor,
        0,
        false,
        "both"
    );
    d.s.printUV = undefined;
    d.wrap(
        sections,
        () => 316,
        () => 338,
        cloth.shirt,
        0,
        false,
        "start"
    );
    d.body(
        [
            [328, 648, 716, 29, 1],
            [333, 650, 719, 30, 1],
            [340, 650, 719, 29, 1],
        ],
        cloth.belt,
        true
    );
    patch(
        d,
        [
            [668, 330],
            [682, 330],
            [683, 339],
            [669, 340],
        ],
        [675, 335],
        lift(shirt, 4),
        "#efc467",
        0.5
    );
    d.s.endTorso();
}
type LegPattern = {
    upper: Section[];
    lower: Section[];
    foot: Section[];
    sock?: Section[];
};
const legs: Record<keyof typeof paint, LegPattern[]> = {
    morty: [
        {
            upper: [
                [492, 117, 151, 13, -5],
                [516, 115, 144, 12, -5],
                [546, 114, 140, 12, -7],
                [581, 112, 138, 12, -9],
            ],
            lower: [
                [572, 113, 139, 12, -9],
                [604, 112, 138, 12, -11],
                [636, 112, 138, 12, -14],
                [662, 114, 140, 12, -17],
                [666, 119, 137, 9, -17],
            ],
            sock: [
                [661, 121, 135, 6, -17],
                [677, 128, 142, 7, -14],
                [685, 123, 146, 7, -10],
            ],
            foot: [
                [678, 129, 142, 7, -15],
                [683, 118, 144, 9, -12],
                [689, 104, 147, 12, -7],
                [694, 95, 148, 13, -4],
                [697, 94, 147, 12, -4],
            ],
        },
        {
            upper: [
                [491, 153, 185, 14, 4],
                [513, 159, 184, 12, 6],
                [551, 158, 182, 12, 6],
                [583, 159, 184, 12, 8],
            ],
            lower: [
                [574, 158, 183, 12, 8],
                [605, 163, 188, 12, 11],
                [640, 170, 194, 12, 13],
                [666, 177, 199, 12, 15],
                [672, 178, 191, 9, 15],
            ],
            sock: [
                [666, 177, 192, 7, 16],
                [682, 181, 197, 8, 18],
                [688, 180, 201, 9, 20],
            ],
            foot: [
                [680, 182, 194, 7, 17],
                [687, 181, 198, 9, 22],
                [696, 178, 204, 13, 28],
                [703, 183, 209, 15, 33],
                [709, 196, 206, 8, 34],
            ],
        },
    ],
    summer: [
        {
            upper: [
                [431, 338, 378, 19, -3],
                [456, 339, 378, 18, -4],
                [493, 345, 376, 16, -5],
                [548, 351, 376, 13, -7],
            ],
            lower: [
                [539, 350, 376, 13, -7],
                [573, 354, 376, 12, -7],
                [607, 357, 376, 10, -8],
                [630, 360, 376, 9, -9],
                [635, 364, 375, 7, -9],
            ],
            sock: [
                [630, 364, 375, 6, -9],
                [656, 365, 374, 5, -9],
                [678, 363, 373, 5, -6],
                [684, 363, 374, 5, -3],
            ],
            foot: [
                [674, 364, 368, 5, -6],
                [681, 362, 375, 7, -3],
                [687, 364, 380, 9, 0],
                [691, 368, 381, 8, 1],
            ],
        },
        {
            upper: [
                [431, 374, 419, 19, 2],
                [455, 375, 422, 18, 4],
                [494, 378, 413, 17, 4],
                [549, 378, 406, 14, 5],
            ],
            lower: [
                [540, 378, 407, 14, 5],
                [579, 378, 403, 12, 7],
                [610, 377, 400, 12, 8],
                [631, 377, 398, 10, 10],
                [638, 380, 394, 7, 10],
            ],
            sock: [
                [635, 382, 394, 7, 10],
                [658, 381, 391, 5, 11],
                [680, 379, 393, 7, 15],
                [688, 377, 398, 8, 21],
            ],
            foot: [
                [678, 380, 390, 5, 15],
                [683, 378, 395, 8, 21],
                [690, 376, 399, 10, 27],
                [695, 375, 403, 13, 31],
                [700, 382, 405, 10, 32],
            ],
        },
    ],
    rick: [
        {
            upper: [
                [339, 649, 686, 18, -6],
                [376, 644, 669, 13, -7],
                [430, 637, 662, 13, -8],
                [502, 630, 655, 13, -10],
            ],
            lower: [
                [492, 631, 655, 13, -10],
                [527, 632, 657, 13, -13],
                [566, 641, 665, 13, -17],
                [608, 654, 677, 13, -21],
                [646, 666, 688, 12, -27],
            ],
            sock: [
                [643, 669, 685, 8, -26],
                [660, 674, 692, 9, -21],
                [671, 671, 694, 10, -19],
            ],
            foot: [
                [658, 680, 691, 7, -23],
                [666, 672, 695, 11, -22],
                [677, 654, 696, 15, -19],
                [688, 633, 697, 18, -17],
                [698, 619, 698, 20, -15],
                [704, 622, 697, 19, -15],
            ],
        },
        {
            upper: [
                [338, 681, 718, 17, 8],
                [370, 685, 720, 16, 10],
                [417, 692, 721, 14, 16],
                [492, 694, 722, 14, 34],
            ],
            lower: [
                [483, 694, 721, 14, 33],
                [527, 697, 724, 14, 39],
                [569, 704, 730, 14, 46],
                [622, 713, 736, 12, 52],
                [629, 716, 731, 9, 53],
            ],
            sock: [
                [624, 714, 731, 9, 52],
                [639, 716, 730, 7, 55],
                [647, 717, 729, 6, 58],
            ],
            foot: [
                [630, 715, 722, 6, 55],
                [641, 713, 734, 10, 59],
                [660, 715, 735, 13, 69],
                [680, 720, 731, 12, 78],
                [688, 724, 728, 5, 82],
            ],
        },
    ],
};
function drawLegs(d: Drawing) {
    const id = d.id,
        trousers = {
            morty: cloth.denim,
            summer: cloth.pants,
            rick: cloth.slacks,
        }[id],
        shoes = {
            morty: cloth.sneaker,
            summer: cloth.flats,
            rick: cloth.shoes,
        }[id];
    // The waistband and inner saddle are common to both limbs. A shared
    // knee ring keeps the upper and lower pattern joined through flexion.
    const fits = {
        morty: { waist: [485, 117, 185, 23], fork: 151, drop: 26 },
        summer: { waist: [429, 338, 419, 26], fork: 377, drop: 30 },
        rick: { waist: [338, 649, 718, 26], fork: 677, drop: 37 },
    } satisfies Record<
        keyof typeof paint,
        { waist: Section; fork: number; drop: number }
    >;
    const { waist, fork, drop } = fits[id];
    legs[id].forEach(({ upper, lower, sock, foot }, i) => {
        const side = i ? "left" : "right";
        const row: Section = [
            waist[0],
            i ? fork : waist[1],
            i ? waist[2] : fork,
            waist[3],
        ];
        const forkY = waist[0] + drop + 2;
        const next = upper.findIndex((v) => v[0] >= forkY);
        const a = upper[Math.max(0, next - 1)],
            b = upper[next];
        const t = T.MathUtils.clamp(
            (forkY - a[0]) / Math.max(1, b[0] - a[0]),
            0,
            1
        );
        const thigh = a.map((v, k) => T.MathUtils.lerp(v, b[k], t)) as Section;
        thigh[0] = forkY;
        const knee = lower[0],
            upperBone = side + "UpperLeg",
            lowerBone = side + "LowerLeg";
        const profile = [
            row,
            thigh,
            ...upper.filter((r) => r[0] > forkY && r[0] < knee[0]),
            knee,
        ];
        trouserLeg(
            d,
            { bone: upperBone, profile, inseam: { center: fork, drop } },
            trousers,
            true
        );
        if (id === "summer" && !i)
            d.stroke(
                [
                    [369, 459],
                    [373, 459],
                    [377, 458],
                ],
                (x, y) => waist[3] * (1 - (0.2 * Math.abs(x - fork)) / 32),
                0.69,
                "#ad8e87"
            );
        d.bind(side + "LowerLeg").body(
            sock,
            id === "summer" ? paint.summer.skin : cloth.socks,
            true,
            20
        );
        const surface = trouserShin(
            d,
            lower,
            upperBone,
            lowerBone,
            trousers,
            25
        );
        if (id === "summer" && !i)
            d.stroke(
                [
                    [354, 539],
                    [357, 546],
                    [361, 550],
                ],
                lift(surface, 0.8),
                0.56
            );
        d.bind(side + "Foot");
        const shoe = d.body(foot, shoes, true, 24);
        if (id === "morty") {
            const row = foot.at(-2);
            d.stroke(
                [
                    [row[1], row[0]],
                    [0.65 * row[1] + 0.35 * row[2], row[0] + 1],
                    [row[2] - 1, row[0] + 0.4],
                ],
                lift(shoe, 0.7),
                1.15,
                "#9d75ac"
            );
        }
    });
}
function cuff(d: Drawing, a: Point, b: Point, r: number, color: string) {
    const dir = new T.Vector3(...b).sub(new T.Vector3(...a)).normalize();
    const axis = new T.Vector3(0, 0, 1);
    if (Math.abs(axis.dot(dir)) > 0.94) axis.set(1, 0, 0);
    const across = dir.clone().cross(axis).normalize(),
        up = dir.clone().cross(across);
    const ring = Array.from(
        { length: 19 },
        (_, i) =>
            new T.Vector3(...a)
                .addScaledVector(across, r * Math.cos((i * Math.PI) / 9))
                .addScaledVector(up, r * Math.sin((i * Math.PI) / 9))
                .toArray() as Point
    );
    d.s.ribbon(ring, 0.8, color);
}
function hands(d: Drawing, side: string) {
    const joint = (name: string) => d.sourceJoints.get(side + name).point;
    const wrist = joint("Hand"),
        knuckles = joint("MiddleProximal"),
        color = paint[d.id].skin;
    const size = d.id === "morty" ? 0.86 : 1;
    d.bind(side + "Hand");
    d.s.sweep(
        [wrist, lerp(wrist, knuckles, 0.55), knuckles],
        [5.5 * size, 7.7 * size, 5.8 * size],
        color,
        8
    );
    d.fingers(side, color, 2.1 * size);
}
/** Shape the belly of the muscle and the narrower wrist in planes normal
 * to the limb. The end rings intersect the adjacent joint during flexion. */
function limb(
    d: Drawing,
    a: Point,
    b: Point,
    r1: number,
    r2: number,
    color: string,
    forearm = false
) {
    const from = new T.Vector3(...a),
        to = new T.Vector3(...b),
        axis = to.clone().sub(from).normalize();
    const side = axis.clone().cross(new T.Vector3(0, 0, 1)).normalize(),
        forward = axis.clone().cross(side);
    const section = forearm
        ? [
              [-0.075, 0.2],
              [-0.025, 0.83],
              [0.04, 1.01],
              [0.19, 1.14],
              [0.42, 1.02],
              [0.7, 0.91],
              [0.95, 0.91],
              [1.02, 0.88],
              [1.07, 0.18],
          ]
        : [
              [-0.055, 0.39],
              [-0.025, 0.86],
              [0.04, 1.04],
              [0.16, 1.06],
              [0.34, 1.01],
              [0.67, 0.95],
              [0.93, 0.91],
              [1.01, 0.91],
              [1.065, 0.22],
          ];
    const rows = section.map(([t, belly]) =>
        Array.from({ length: 21 }, (_, i): Point => {
            const angle = (i * Math.PI) / 10,
                r = T.MathUtils.lerp(r1, r2, Math.max(0, t)) * belly;
            return from
                .clone()
                .lerp(to, t)
                .addScaledVector(side, r * Math.cos(angle))
                .addScaledVector(forward, 0.93 * r * Math.sin(angle))
                .toArray() as Point;
        })
    );
    d.s.surface(rows, color);
}
function drawArms(d: Drawing) {
    const id = d.id,
        color = paint[id].skin;
    d.rig.landmarks.arms.forEach(([shoulder, elbow, wrist], i) => {
        const side = i ? "left" : "right",
            upper = side + "UpperArm",
            lower = side + "LowerArm";
        const r = id === "rick" ? 11 : id === "summer" ? 8.1 : 9.2;
        d.bind(upper);
        const sleeve =
            id === "rick" ? cloth.coat : id === "morty" ? cloth.tee : color;
        if (id !== "morty")
            limb(d, shoulder, elbow, id === "rick" ? 15 : r + 1.9, r, sleeve);
        if (id === "morty") {
            const hem = lerp(shoulder, elbow, i ? 0.99 : 0.58);
            d.s.tube(
                shoulder,
                hem,
                i ? 13 : 11.5,
                i ? 10.8 : 9.4,
                cloth.tee,
                18
            );
            cuff(d, hem, shoulder, i ? 10.8 : 9.4, ink);
            if (!i)
                capsule(
                    d,
                    lerp(shoulder, elbow, 0.59),
                    elbow,
                    r,
                    r - 1.2,
                    color
                );
        }
        d.bind(lower);
        const thick = id === "rick" ? 10.8 : id === "morty" ? 8.2 : 6.6;
        if (id !== "rick") limb(d, elbow, wrist, thick, 5.45, color, true);
        if (id === "rick") {
            const hem = lerp(elbow, wrist, 0.72);
            d.s.tube(elbow, hem, i ? 13 : 12, i ? 13.8 : 11.4, cloth.coat, 18);
            cuff(d, hem, elbow, i ? 13.8 : 11.4, ink);
            d.s.tube(hem, wrist, 8.8, 7.5, color, 16);
        }
        if ((id === "morty" && i) || (id === "summer" && i)) {
            const a = lerp(elbow, wrist, 0.9),
                b = lerp(elbow, wrist, 1.02);
            d.s.tube(
                a,
                b,
                7.1,
                6.7,
                id === "morty" ? "#714350" : "#5f5456",
                16
            );
            if (id === "morty") {
                const mid = lerp(a, b, 0.6);
                mid[2] += 5.5;
                d.s.oval(mid, [5.9, 6.8, 2.8], "#513843", 0.38);
                mid[2] += 2;
                d.s.oval(mid, [3.5, 4.6, 2], "#85c5de", 0.38);
                mid[2] += 1.9;
                d.s.oval(mid, [1.2, 1.9, 0.8], "#d7e2c9");
            }
        }
        hands(d, side);
    });
}
function extras(d: Drawing) {
    if (d.id === "summer") {
        d.bind("leftHand");
        const rings: [XY[], number][] = [
            [
                [
                    [440, 457],
                    [445, 465],
                    [450, 468],
                    [456, 473],
                    [457, 477],
                ],
                12,
            ],
            [
                [
                    [455, 474],
                    [461, 477],
                    [463, 482],
                    [458, 486],
                    [454, 484],
                ],
                14,
            ],
            [
                [
                    [459, 485],
                    [468, 485],
                    [473, 491],
                    [472, 501],
                    [467, 508],
                    [462, 508],
                ],
                14,
            ],
            [
                [
                    [466, 508],
                    [471, 514],
                    [471, 523],
                    [465, 530],
                    [457, 531],
                    [451, 527],
                ],
                14,
            ],
        ];
        for (const [path, z] of rings) {
            d.stroke(path, level(z), 2.2, "#64494a");
            d.stroke(path, level(z + 1.2), 0.92, "#baaba1");
        }
    } else if (d.id === "morty") {
        d.bind("leftHand");
        const a: Point = [83, 517, 57],
            b: Point = [37, 603, 73],
            p = (t: number) => lerp(a, b, t);
        const bands: [number, string][] = [
            [0, "#244e4b"],
            [0.05, "#73c7b5"],
            [0.09, "#30695e"],
            [0.15, "#3aaf94"],
            [0.4, "#356f6c"],
            [0.45, "#42aa91"],
            [0.67, "#316c73"],
            [0.72, "#5bb5aa"],
            [0.81, "#96d9ba"],
            [0.85, "#41677a"],
            [0.93, "#786343"],
        ];
        const uv = paintStrip(
            "barrel",
            (t) => [...bands].reverse().find(([start]) => t >= start)[1]
        );
        d.s.printUV = (x, y) => uv((y - a[1]) / (b[1] - a[1]));
        const ts = [0, 0.04, 0.12, 0.18, 0.63, 0.77, 0.82, 0.9, 0.96, 1];
        d.s.sweep(
            ts.map(p),
            [8.6, 11, 10, 9, 8.5, 10, 9, 8, 5.5, 3],
            "#36ae96",
            10
        );
        d.s.printUV = undefined;
        patch(
            d,
            [
                [68, 534],
                [71, 532],
                [74, 534],
                [69, 550],
                [62, 562],
                [59, 560],
            ],
            [67, 548],
            level(71),
            "#a5e8c0",
            0.55
        );
        d.s.line(
            Array.from({ length: 32 }, (_, i): Point => {
                const t = i / 31,
                    turn = t * Math.PI * 6;
                return [
                    36 - 17 * t + 5 * Math.cos(turn),
                    600 + 25 * t + 2.4 * Math.sin(turn),
                    75 + 4 * Math.sin(turn),
                ];
            }),
            0.95,
            "#77562b"
        );
    } else {
        d.bind("rightHand");
        const front = level(125);
        d.patch(
            [
                [616, 149],
                [636, 146],
                [645, 150],
                [644, 177],
                [638, 193],
                [619, 193],
                [614, 180],
            ],
            [630, 169],
            front,
            3.3,
            "#9d7769",
            { edge: 1.2, back: 15 }
        );
        patch(
            d,
            [
                [619, 151],
                [638, 149],
                [642, 151],
                [622, 154],
            ],
            [630, 151.5],
            level(128),
            "#c1937f",
            0.6
        );
        patch(
            d,
            [
                [620, 182],
                [637, 181],
                [636, 199],
                [626, 200],
            ],
            [629, 189],
            level(127),
            "#ad8576",
            0.85
        );
        const uv = paintStrip("lens", (r) =>
            r < 0.32
                ? "#49333c"
                : r < 0.45
                ? "#906e6c"
                : r < 0.55
                ? "#44353d"
                : r < 0.67
                ? "#765954"
                : r < 0.73
                ? "#413139"
                : r < 0.86
                ? "#b08d7b"
                : "#694a45"
        );
        d.s.printUV = (x, y) => uv(Math.hypot((x - 628) / 12, (y - 171) / 13));
        d.patch(
            ellipse(628, 171, 12, 13),
            [628, 171],
            level(129),
            5,
            "#855d5b",
            { back: 3 }
        );
        d.s.printUV = undefined;
    }
}
const sunshineShape = {
    palette: sunshine.palette,
    parts: sunshine.parts,
} as ShapeRecipe;
const sunshineInk = Object.fromEntries(
    Array.from(new Set(sunshinePrint.map((p) => p.on))).map((name) => [
        name,
        sunshinePrint
            .filter((p) => p.on === name)
            .map((p) => ({
                outline: p.decal,
                holes: p.holes,
                rear: "rear" in p && p.rear,
                color:
                    (
                        {
                            blue: "#009af4",
                            cyan: "#41ceff",
                            pink: "#ff179c",
                            cotton: "#fffff6",
                            printHighlight: "#21a7ed",
                        } as Record<string, string>
                    )[p.paint] ?? sunshine.palette[p.paint].color,
            })),
    ])
) as GarmentPrints;
export function drawCharacter(d: Drawing, recipe?: AvatarRecipe) {
    if (recipe?.cartoon) {
        drawCartoonHumanoid(d, recipe.cartoon);
        return;
    }
    if (recipe?.shapes) {
        drawShapeRecipe(d, recipe.shapes);
        return;
    }
    const id = d.id;
    if (id === "rick-classic") {
        d.s.penOutline = recipe?.penOutline === true;
        drawFittedAvatar(
            d,
            classic,
            classicLook,
            recipe?.shirtMark,
            recipe?.crownOutline,
            recipe?.eyeInk,
            recipe?.lapels,
            recipe?.coatPanels,
            recipe?.sleeveCut
        );
        return;
    }
    if (id === "sunshine") {
        drawShapeRecipe(
            d,
            sunshineShape,
            sunshineInk,
            recipe?.shirtMark,
            recipe?.sunRays,
            recipe?.visor
        );
        return;
    }
    if (isStreet(id)) {
        drawStreetwear(
            d,
            recipe?.garments ? { ...looks[id], ...recipe.garments } : looks[id]
        );
        return;
    }
    d.s.palette({
        ...Object.fromEntries(
            Object.values(cloth).map((c) => [c, finish.cloth])
        ),
        [paint[id].skin]: finish.skin,
        [paint[id].hair]: finish.fiber,
    });
    drawLegs(d);
    ({ morty: mortyTorso, summer: summerTorso, rick: rickTorso })[id](d);
    drawArms(d);
    drawHead(d, id);
    d.s.beginReferenceItem(id === "rick" ? "right" : "left");
    extras(d);
}

// The topology, ink paths and source paint are identical across variations of a
// template. Compile the visible crowd templates once, then fit each recipe in a
// single vertex pass. Native closeups retain the full-detail construction.
const templates = new Map<string, TemplateSource>();
const markedTemplates = new Map<string, TemplateSource>();
function compiled(id: Character, recipe: AvatarRecipe) {
    // Layouts compiled from different pictures can share a rig identifier.
    const fixed =
        !recipe.shapes && !recipe.layout && !recipe.garments && !recipe.cartoon;
    const customParts =
        fixed &&
        (recipe.shirtMark ||
            recipe.crownOutline ||
            recipe.sunRays ||
            recipe.eyeInk ||
            recipe.lapels ||
            recipe.penOutline ||
            recipe.visor ||
            recipe.coatPanels ||
            recipe.sleeveCut);
    const cache = customParts ? markedTemplates : templates;
    const key =
        castCacheKey(recipe) ??
        (customParts
            ? JSON.stringify([
                  id,
                  recipe.shirtMark,
                  recipe.crownOutline,
                  recipe.sunRays,
                  recipe.eyeInk,
                  recipe.lapels,
                  recipe.penOutline,
                  recipe.visor,
                  recipe.coatPanels,
                  recipe.sleeveCut,
              ])
            : fixed
            ? id
            : undefined);
    let template = key ? cache.get(key) : undefined;
    if (template) return template;
    const d = new Drawing(
        id,
        recipe.layout ? { template: id, layout: recipe.layout } : undefined
    );
    d.s.detail = "crowd";
    d.s.record = { points: [], runs: [] };
    drawCharacter(d, recipe);
    template = {
        geometry: d.s.geometry(),
        points: Float32Array.from(d.s.record.points),
        runs: d.s.record.runs,
    };
    if (key) {
        if (customParts && cache.size >= 16) {
            const first = cache.keys().next().value;
            cache.get(first).geometry.dispose();
            cache.delete(first);
        }
        cache.set(key, template);
    }
    return template;
}
function fit(d: Drawing, recipe: AvatarRecipe, template: TemplateSource) {
    const g = new T.BufferGeometry(),
        src = template.geometry;
    // Attribute wrappers belong to the instance. Immutable arrays can be shared.
    for (const name of ["uv", "skinIndex", "skinWeight"]) {
        const a = src.getAttribute(name) as T.BufferAttribute;
        g.setAttribute(
            name,
            new T.BufferAttribute(a.array, a.itemSize, a.normalized)
        );
    }
    g.setIndex(new T.BufferAttribute(src.index.array, 1));
    g.userData.referenceItem = src.userData.referenceItem;
    const colors = (src.getAttribute("color") as T.BufferAttribute).clone();
    const position = new T.BufferAttribute(
        new Float32Array(template.points.length),
        3
    );
    const second = new T.Vector3();
    const scratch = new T.Vector3(),
        paint = new T.Color(),
        base = new T.Color();
    const matrices = new Map(
        d.s.bones.map((b) => [b.name, d.matrixFor(b.name)])
    );
    for (const run of template.runs) {
        const matrix = matrices.get(run.bone),
            override = recipe.palette?.[run.color];
        if (override) {
            paint.set(override);
            base.set(run.color);
        }
        const g = run.gradient;
        const gradient = g &&
            recipe.palette?.[g.from] &&
            recipe.palette?.[g.to] && {
                from: new T.Color(g.from),
                to: new T.Color(g.to),
                targetFrom: new T.Color(recipe.palette[g.from]),
                targetTo: new T.Color(recipe.palette[g.to]),
            };
        for (let i = run.start; i < run.start + run.count; i++) {
            scratch.fromArray(template.points, i * 3);
            const p = d.rig.transform(
                [scratch.x, scratch.y, scratch.z],
                run.bone === "head",
                run.eyes,
                run.crown,
                run.pupil,
                run.familyPart ?? run.bone
            );
            scratch.set(...p).applyMatrix4(matrix);
            if (run.drape) {
                const other = src.attributes.skinIndex.getY(i);
                scratch.lerp(
                    second
                        .set(...p)
                        .applyMatrix4(matrices.get(d.s.bones[other].name)),
                    src.attributes.skinWeight.getY(i)
                );
            }
            scratch.multiplyScalar(0.01);
            position.setXYZ(i, scratch.x, scratch.y, scratch.z);
            if (gradient) {
                const t = T.MathUtils.smoothstep(
                    template.points[i * 3 + 1],
                    g.top,
                    g.bottom
                );
                base.lerpColors(gradient.from, gradient.to, t);
                paint.lerpColors(gradient.targetFrom, gradient.targetTo, t);
                // Recover baked light from its strongest channel. Division by
                // a near-zero channel magnifies the old hue's tiny highlight.
                const brightest = Math.max(base.r, base.g, base.b);
                const shaded =
                    brightest === base.r
                        ? colors.getX(i)
                        : brightest === base.g
                        ? colors.getY(i)
                        : colors.getZ(i);
                const light = shaded / Math.max(0.002, brightest);
                colors.setXYZ(
                    i,
                    paint.r * light,
                    paint.g * light,
                    paint.b * light
                );
            } else if (override)
                colors.setXYZ(
                    i,
                    (colors.getX(i) * paint.r) / Math.max(0.002, base.r),
                    (colors.getY(i) * paint.g) / Math.max(0.002, base.g),
                    (colors.getZ(i) * paint.b) / Math.max(0.002, base.b)
                );
        }
    }
    g.setAttribute("position", position);
    g.setAttribute("color", colors);
    g.computeVertexNormals();
    return g;
}
export function buildCharacter(
    input: Character | AvatarRecipe | StyleRecipe,
    detail: "full" | "crowd" = "full"
) {
    const recipe =
            typeof input === "string"
                ? { template: input }
                : "style" in input
                ? defineLook(input)
                : input,
        d = new Drawing(recipe.template, recipe);
    d.s.detail = detail;
    if (recipe.inspectPaint && detail === "full") d.s.referenceColors = [];
    // Traced corneas encode pupil offsets in their normals. Build these unique
    // layouts at crowd LOD so template refitting cannot replace the offsets.
    if (
        detail === "crowd" &&
        !recipe.cartoon?.household &&
        !recipe.cartoon?.fit?.sections?.eyes?.length
    )
        return d.s.finish(fit(d, recipe, compiled(recipe.template, recipe)));
    drawCharacter(d, recipe);
    return d.s.finish();
}
