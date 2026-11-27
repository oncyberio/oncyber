/**
 * Outfits, each a set of garments cut to the figure.
 *
 * A garment is a solid: everything between the skin and the cloth, as a
 * distance field (negative inside). Its surface is the cloth. It is built
 * from the body's own field (see bodyField.ts), so it fits whatever the
 * figure is, plus shapes of its own where it stands off the body (wide
 * trousers, shoes), and folds pushed in and out of it.
 *
 * The figure faces -z, its left is -x, and it stands in a T-pose with its
 * feet at y = 0.
 */
import {
    type Shape,
    field,
    halfSpace,
    roundBox,
    ellipsoid,
    capsule,
    torus,
    euler,
    IDENTITY,
} from "../../../frontend/features/procedural-avatar/kernel/sdf";
import {
    fbm,
    noise3,
} from "../../../frontend/features/procedural-avatar/kernel/noise";
import type { BodyField } from "./bodyField";
import type { Figure, V3 } from "./figure";

export type Rgb = [number, number, number];

export interface Garment {
    name: string;
    shape: Shape;
    /** Where to look for its surface. */
    box: [V3, V3];
    /** Grid step to find the surface with, metres. */
    cell: number;
    /** Triangles to keep. */
    triangles: number;
    /** Its colour at a point of its surface, sRGB 0..1. */
    colour(p: V3): Rgb;
    /** Take skin only from this side of the body (-1 left, 1 right). */
    side?(p: V3): -1 | 1 | 0;
}

export interface Outfit {
    id: string;
    garments: Garment[];
}

const hex = (value: string): Rgb => {
    const n = parseInt(value.replace("#", ""), 16);
    return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const smooth = (a: number, b: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
};
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
];

/** A shape from a function, with no pruning. */
const shape = (fn: (x: number, y: number, z: number) => number): Shape => ({
    eval: fn,
});

/** Grow a shape by an amount that varies over space. */
const grow = (
    source: Shape,
    amount: (x: number, y: number, z: number) => number
): Shape => shape((x, y, z) => source.eval(x, y, z) - amount(x, y, z));

/** Where a ray from `from` along `dir` first leaves a shape. */
export function surfaceAlong(s: Shape, from: V3, dir: V3, reach = 0.5): V3 {
    let t = 0;
    for (let i = 0; i < 400 && t < reach; i++) {
        const p: V3 = [
            from[0] + dir[0] * t,
            from[1] + dir[1] * t,
            from[2] + dir[2] * t,
        ];
        const d = s.eval(...p);
        if (d >= 0) return p;
        t += Math.max(0.0005, -d * 0.5);
    }
    return [from[0] + dir[0] * t, from[1] + dir[1] * t, from[2] + dir[2] * t];
}

/** The outfit in the reference: shirt, wide trousers, belt, socks, shoes. */
export function stagehandOutfit(figure: Figure, body: BodyField): Outfit {
    const hips = figure.joint("hips");
    const neck = figure.joint("neck");
    const hipL = figure.joint("leftUpperLeg");
    const ankleL = figure.joint("leftFoot");
    const toesL = figure.joint("leftToes");
    const handL = figure.joint("leftHand");
    const elbowL = figure.joint("leftLowerArm");
    const shoulderL = figure.joint("leftUpperArm");

    const waistTop = hips[1] + 0.085;
    const crotch = hipL[1] - 0.115;
    const hem = 0.165;
    const cuff = Math.abs(handL[0]) - 0.035;

    // --- Shirt -------------------------------------------------------------
    const shirtDrape = body.draped(0.012);
    const neckSkin = body.draped(0.006);
    // Where the shirt's body meets the collar: round the base of the neck,
    // lower at the front.
    const neckline = (z: number) =>
        neck[1] - 0.002 - smooth(0.0, -0.07, z - neck[2]) * 0.03;
    const cuffStart = cuff - 0.055;
    const arm = (ax: number) => smooth(0.17, 0.26, ax);
    const shirtEase = (x: number, y: number, z: number) => {
        const ax = Math.abs(x);
        const a = arm(ax);
        // Tucked in: tight under the waistband, a little full above it.
        const tuck = smooth(waistTop - 0.01, waistTop + 0.015, y);
        const blouse =
            (1 - a) *
            Math.exp(-(((y - (waistTop + 0.035)) / 0.035) ** 2)) *
            0.006;
        const torso = 0.004 + 0.009 * tuck + blouse;
        const sleeve = 0.016 - 0.004 * smooth(0.3, 0.5, ax);
        const cuffBand = smooth(cuffStart - 0.004, cuffStart, ax);
        const ease =
            (1 - a) * torso + a * (sleeve * (1 - cuffBand) + 0.0075 * cuffBand);
        return ease + shirtFolds(x, y, z, a, ax, cuffBand);
    };
    function shirtFolds(
        x: number,
        y: number,
        z: number,
        a: number,
        ax: number,
        cuffBand: number
    ) {
        // Sleeves: twisting creases, bunched at the elbow and above the cuff.
        const angle = Math.atan2(z - elbowL[2], y - elbowL[1]);
        const elbow = Math.exp(-(((ax - Math.abs(elbowL[0])) / 0.08) ** 2));
        const wrist = smooth(cuffStart - 0.14, cuffStart - 0.02, ax);
        const twist = Math.sin(
            ax / 0.026 + angle * 1.2 + noise3(x * 14, y * 14, z * 14) * 2.2
        );
        const sleeve =
            a *
            (1 - cuffBand) *
            twist *
            (0.0012 + 0.0024 * elbow + 0.003 * wrist);
        // A droop under the sleeve, the cloth hanging from the arm.
        const under =
            a *
            (1 - cuffBand) *
            smooth(Math.abs(shoulderL[0]), Math.abs(shoulderL[0]) + 0.12, ax) *
            smooth(shoulderL[1] - 0.02, shoulderL[1] - 0.08, y) *
            0.003;
        // Body: long soft folds from the chest into the waistband.
        const drape =
            (1 - a) *
            Math.sin(x * 34 + fbm(x * 5, y * 5, z * 5) * 3) *
            smooth(waistTop + 0.22, waistTop + 0.03, y) *
            smooth(waistTop - 0.005, waistTop + 0.02, y) *
            0.0028;
        // The placket down the front, and its seams.
        const front = smooth(-0.02, -0.06, z);
        const placket =
            (1 - a) *
            front *
            (smooth(0.0135, 0.0115, Math.abs(x)) * 0.0012 -
                Math.exp(-(((Math.abs(x) - 0.0128) / 0.0012) ** 2)) * 0.0009);
        // The cuff's edges stand proud.
        const cuffEdge =
            a *
            (Math.exp(-(((ax - cuffStart) / 0.003) ** 2)) +
                Math.exp(-(((ax - cuff) / 0.003) ** 2)) * 0.6) *
            0.0015;
        const grain = fbm(x * 18, y * 18, z * 18) * 0.001;
        return sleeve + under + drape + placket + cuffEdge + grain;
    }
    const shirtBody = field()
        .add(grow(shirtDrape, shirtEase))
        // Never closer to the skin than this, even over the shoulders and
        // elbows, where the blur pulls the drape in.
        .add(
            grow(
                body.skin,
                (x, y, z) =>
                    0.006 +
                    shirtFolds(x, y, z, arm(Math.abs(x)), Math.abs(x), 0) * 0.5
            ),
            0.004
        )
        // Tucked in below the waistband; cut at the wrists and the neck.
        .clip(halfSpace([0, waistTop - 0.05, 0], [0, -1, 0]))
        .clip(shape((x) => Math.abs(x) - cuff))
        // Round the neck only: the shoulders may rise above the line.
        .clip(
            shape((x, y, z) =>
                Math.min(
                    y - neckline(z),
                    0.085 - Math.hypot(x - neck[0], (z - neck[2]) * 1.1)
                )
            )
        );
    // Buttons down the placket.
    const buttons = field();
    for (let i = 0; i < 6; i++) {
        const y = neckline(-1) - 0.025 - i * 0.075;
        if (y < waistTop + 0.01) break;
        const at = surfaceAlong(shirtBody, [0, y, neck[2]], [0, 0, -1]);
        buttons.add(
            ellipsoid(
                [0, y, at[2] + 0.0005],
                [0.0055, 0.0055, 0.0022],
                IDENTITY
            )
        );
    }
    const shirtShape = field().add(shirtBody).add(buttons, 0.001);
    const shirt: Garment = {
        name: "Shirt",
        shape: shirtShape,
        box: [
            [-cuff - 0.02, waistTop - 0.07, -0.2],
            [cuff + 0.02, neck[1] + 0.02, 0.16],
        ],
        cell: 0.004,
        triangles: 5000,
        colour: (p) => {
            const white = hex("#f3f1f3");
            const button =
                Math.abs(p[0]) < 0.006 && p[2] < neck[2] - 0.05 ? 0.12 : 0;
            return mix(
                mix(
                    white,
                    hex("#e3e6f3"),
                    0.35 + 0.35 * noise3(p[0] * 9, p[1] * 9, p[2] * 9)
                ),
                hex("#cfcdd2"),
                button
            );
        },
    };

    // The collar: a band standing round the neck, and the fall folded over
    // it, its points spread at the front.
    const collarTop = (z: number) =>
        neck[1] + 0.03 - smooth(0.0, -0.07, z - neck[2]) * 0.022;
    const shell = (
        source: Shape,
        at: (x: number, y: number, z: number) => number,
        half: number
    ) =>
        shape((x, y, z) => Math.abs(source.eval(x, y, z) - at(x, y, z)) - half);
    const neckRound = (radius: number) =>
        shape(
            (x, y, z) => Math.hypot(x - neck[0], (z - neck[2]) * 1.05) - radius
        );
    const band = field()
        .add(shell(neckSkin, () => 0.012, 0.0016))
        .clip(shape((x, y, z) => y - collarTop(z)))
        .clip(shape((x, y, z) => neckline(z) - 0.004 - y))
        .clip(neckRound(0.08))
        // Open at the front, where the knot sits.
        .carve(
            shape((x, y, z) =>
                Math.max(Math.abs(x) - 0.006, z - neck[2] + 0.02)
            )
        );
    const fall = field()
        .add(
            shell(
                neckSkin,
                (x, y, z) => 0.0155 + Math.max(0, collarTop(z) - y) * 0.22,
                0.0016
            )
        )
        .clip(shape((x, y, z) => y - collarTop(z) - 0.002))
        // Round the neck, not out over the shoulders.
        .clip(neckRound(0.088))
        .clip(
            shape((x, y, z) => {
                // Deeper at the front, where the points are.
                const front = smooth(-0.02, -0.07, z - neck[2]);
                return collarTop(z) - (0.026 + front * 0.036) - y;
            })
        )
        .carve(
            shape((x, y, z) =>
                Math.max(
                    Math.abs(x) - 0.004 - Math.max(0, collarTop(z) - y) * 0.9,
                    z - neck[2] + 0.02
                )
            )
        );
    const collar: Garment = {
        name: "Collar",
        shape: field().add(band).add(fall),
        box: [
            [-0.11, neck[1] - 0.09, neck[2] - 0.12],
            [0.11, neck[1] + 0.05, neck[2] + 0.11],
        ],
        cell: 0.0016,
        triangles: 1600,
        colour: () => hex("#f3f1f3"),
    };

    // --- Trousers ----------------------------------------------------------
    const legX = (y: number) => {
        const t = smooth(crotch + 0.05, hem, y);
        return Math.abs(hipL[0]) + 0.004 + t * 0.03;
    };
    const legR = (y: number) => {
        const t = smooth(crotch + 0.12, hem, y);
        return 0.09 + t * 0.03;
    };
    const legZ = (y: number) =>
        hips[2] + 0.012 + smooth(hips[1], hem, y) * 0.018;
    const leg = shape((x, y, z) => {
        const dx = Math.abs(x) - legX(y);
        const dz = (z - legZ(y)) / 0.93;
        return Math.hypot(dx, dz) - legR(y);
    });
    const trouserDrape = body.draped(0.02);
    const trouserCore = field()
        .add(
            grow(trouserDrape, (x, y) => {
                const seat = smooth(crotch - 0.05, crotch + 0.12, y);
                return 0.014 + 0.004 * seat;
            })
        )
        .add(
            grow(body.skin, () => 0.007),
            0.004
        )
        .add(
            field()
                .add(leg)
                .clip(halfSpace([0, crotch + 0.16, 0], [0, 1, 0])),
            0.05
        );
    const trouserShape = field()
        .add(grow(trouserCore, (x, y, z) => trouserFolds(x, y, z)))
        // The legs part below the crotch.
        .carve(
            shape((x, y) =>
                y > crotch ? 1 : Math.abs(x) - 0.004 - (crotch - y) * 0.01
            )
        )
        .clip(halfSpace([0, waistTop, 0], [0, 1, 0]))
        .clip(halfSpace([0, hem, 0], [0, -1, 0]));
    function trouserFolds(x: number, y: number, z: number) {
        const side = Math.sign(x) || 1;
        const lx = x - side * legX(y);
        const front = smooth(0.01, -0.05, z - legZ(y));
        // The pressed crease down the front of each leg.
        const crease =
            front *
            Math.exp(-((lx / 0.007) ** 2)) *
            smooth(waistTop, waistTop - 0.12, y) *
            0.004;
        // Pleats from the waistband, falling into the crease.
        const pleat =
            front *
            smooth(crotch - 0.05, waistTop - 0.03, y) *
            (Math.exp(-(((lx + side * 0.035) / 0.006) ** 2)) * 0.004 -
                Math.exp(-(((lx + side * 0.045) / 0.008) ** 2)) * 0.002);
        // Long soft folds round the leg, and a break above the hem.
        const angle = Math.atan2(z - legZ(y), lx);
        const folds =
            smooth(crotch, hem + 0.1, y) *
            Math.sin(angle * 5 + fbm(x * 4, y * 2, z * 4) * 4) *
            0.004;
        const grain = fbm(x * 25, y * 25, z * 25) * 0.0012;
        return crease + pleat + folds + grain;
    }
    const trousers: Garment = {
        name: "Trousers",
        shape: trouserShape,
        box: [
            [-0.3, hem - 0.01, -0.22],
            [0.3, waistTop + 0.01, 0.22],
        ],
        cell: 0.005,
        triangles: 4500,
        colour: (p) => {
            const navy = hex("#2b3146");
            return mix(
                navy,
                hex("#363d57"),
                0.5 + 0.5 * noise3(p[0] * 40, p[1] * 40, p[2] * 40)
            );
        },
        side: (p) => (p[1] < crotch + 0.02 ? (p[0] < 0 ? -1 : 1) : 0),
    };

    // --- Belt --------------------------------------------------------------
    const beltTop = waistTop - 0.012;
    const beltBottom = beltTop - 0.032;
    const front = surfaceAlong(
        trouserCore,
        [0, beltTop - 0.016, 0],
        [0, 0, -1]
    );
    const beltShape = field()
        .add(
            field()
                .add(grow(trouserCore, () => 0.004))
                .clip(halfSpace([0, beltTop, 0], [0, 1, 0]))
                .clip(halfSpace([0, beltBottom, 0], [0, -1, 0]))
        )
        .add(
            roundBox(
                [front[0], beltTop - 0.016, front[2] - 0.005],
                [0.024, 0.02, 0.005],
                0.003,
                IDENTITY
            )
        );
    const belt: Garment = {
        name: "Belt",
        shape: beltShape,
        box: [
            [-0.25, beltBottom - 0.01, -0.22],
            [0.25, beltTop + 0.01, 0.22],
        ],
        cell: 0.003,
        triangles: 600,
        colour: (p) => {
            const buckle =
                p[2] < front[2] - 0.002 &&
                Math.abs(p[0]) < 0.026 &&
                Math.abs(p[1] - (beltTop - 0.016)) < 0.021;
            return buckle ? hex("#6f6a66") : hex("#141416");
        },
    };

    // --- Tie, badge, headphones ---------------------------------------------
    // The shirt's front down the middle, to lay things on.
    const frontAt = new Map<number, number>();
    const frontZ = (y: number) => {
        const key = Math.round(y / 0.004);
        if (!frontAt.has(key))
            frontAt.set(
                key,
                surfaceAlong(
                    shirtBody,
                    [0, key * 0.004, neck[2]],
                    [0, 0, -1]
                )[2]
            );
        return frontAt.get(key);
    };
    const knotY = collarTop(-1) - 0.014;
    const tipY = waistTop + 0.012;
    const tieWidth = (y: number) =>
        0.036 + smooth(knotY - 0.02, tipY + 0.03, y) * 0.034;
    const blade = shape((x, y, z) => {
        const half = tieWidth(y) / 2;
        // A point at the bottom.
        const tip = tipY + Math.abs(x) * 0.9 - y;
        const outline = Math.max(Math.abs(x) - half, tip, y - knotY);
        // It hangs a little off the shirt, more lower down.
        const lie = frontZ(y) - 0.004 - smooth(knotY, tipY, y) * 0.004;
        const sheet = Math.abs(z - lie) - 0.0022;
        return Math.max(outline, sheet);
    });
    const knotZ = frontZ(knotY) - 0.008;
    const knot = field()
        .add(
            roundBox(
                [0, knotY + 0.002, knotZ],
                [0.017, 0.016, 0.009],
                0.007,
                IDENTITY
            )
        )
        .clip(
            shape((x, y) => Math.abs(x) - (0.019 - (knotY + 0.018 - y) * 0.25))
        );
    const tie: Garment = {
        name: "Tie",
        shape: field().add(blade).add(knot, 0.006),
        box: [
            [-0.05, tipY - 0.01, neck[2] - 0.2],
            [0.05, knotY + 0.03, neck[2] - 0.02],
        ],
        cell: 0.0014,
        triangles: 1400,
        colour: (p) => {
            // Wide pale stripes, on the slant.
            const u = (p[0] * 0.7 + p[1] * 0.7) / 0.028;
            const f = u - Math.floor(u);
            const stripe = smooth(0.0, 0.04, f) * smooth(0.42, 0.38, f);
            return mix(hex("#4f86de"), hex("#e9edf6"), stripe);
        },
    };

    // An ID card on the left of the chest, on a clip.
    const badgeY = neck[1] - 0.16;
    const badgeX = -0.075;
    const badgeZ = surfaceAlong(
        shirtBody,
        [badgeX, badgeY, neck[2]],
        [0, 0, -1]
    )[2];
    const badge: Garment = {
        name: "Badge",
        shape: field()
            .add(
                roundBox(
                    [badgeX, badgeY, badgeZ - 0.003],
                    [0.019, 0.026, 0.0015],
                    0.0015,
                    IDENTITY
                )
            )
            .add(
                roundBox(
                    [badgeX, badgeY + 0.03, badgeZ - 0.004],
                    [0.005, 0.008, 0.002],
                    0.001,
                    IDENTITY
                )
            ),
        box: [
            [badgeX - 0.03, badgeY - 0.035, badgeZ - 0.015],
            [badgeX + 0.03, badgeY + 0.045, badgeZ + 0.004],
        ],
        cell: 0.001,
        triangles: 160,
        colour: (p) =>
            p[1] > badgeY + 0.022 ? hex("#9a9ca3") : hex("#f6f6f4"),
    };

    // Headphones resting round the neck: the band behind, a cup on each
    // collarbone, a cable down to a player on the belt.
    const cupY = neck[1] - 0.055;
    const cups = ([-1, 1] as const).map((s) => {
        const cx = s * 0.075;
        const cz =
            surfaceAlong(shirtBody, [cx, cupY, neck[2]], [0, 0, -1])[2] - 0.016;
        return [cx, cupY, cz] as V3;
    });
    const phones = field();
    for (const [cx, cy, cz] of cups) {
        const turn = euler(Math.PI / 2 - 0.35, 0, Math.sign(cx) * 0.25);
        phones.add(torus([cx, cy, cz], 0.022, 0.011, turn));
        phones.add(
            roundBox([cx, cy, cz + 0.004], [0.026, 0.026, 0.009], 0.009, turn),
            0.004
        );
    }
    // The band: an arc round the back of the neck.
    const bandArc: V3[] = [];
    for (let i = 0; i <= 12; i++) {
        const a = Math.PI * (i / 12);
        bandArc.push([
            -Math.cos(a) * 0.078,
            cupY + 0.04 + Math.sin(a) * 0.012,
            neck[2] + 0.01 + Math.sin(a) * 0.062,
        ]);
    }
    bandArc[0] = [cups[0][0], cups[0][1] + 0.02, cups[0][2] + 0.02];
    bandArc[12] = [cups[1][0], cups[1][1] + 0.02, cups[1][2] + 0.02];
    for (let i = 0; i < bandArc.length - 1; i++)
        phones.add(capsule(bandArc[i], bandArc[i + 1], 0.0065), 0.003);
    // The cable, from the right cup down to the player on the belt.
    const playerAt: V3 = [
        0.115,
        waistTop - 0.03,
        surfaceAlong(trouserCore, [0.115, waistTop - 0.03, 0], [0, 0, -1])[2] -
            0.008,
    ];
    const cable: V3[] = [];
    const from = cups[1];
    for (let i = 0; i <= 14; i++) {
        const t = i / 14;
        const y = from[1] - 0.02 + (playerAt[1] + 0.03 - (from[1] - 0.02)) * t;
        const x =
            from[0] +
            (playerAt[0] - from[0]) * t +
            Math.sin(t * Math.PI) * 0.015;
        const z =
            y > waistTop
                ? surfaceAlong(shirtBody, [x, y, neck[2]], [0, 0, -1])[2] -
                  0.004
                : playerAt[2];
        cable.push([x, y, z]);
    }
    for (let i = 0; i < cable.length - 1; i++)
        phones.add(capsule(cable[i], cable[i + 1], 0.0018), 0.001);
    phones.add(
        roundBox(
            playerAt,
            [0.02, 0.02, 0.007],
            0.007,
            euler(Math.PI / 2, 0, 0)
        ),
        0.002
    );
    const headphones: Garment = {
        name: "Headphones",
        shape: phones,
        box: [
            [-0.14, waistTop - 0.07, neck[2] - 0.16],
            [0.16, neck[1] + 0.03, neck[2] + 0.1],
        ],
        cell: 0.0018,
        triangles: 1400,
        colour: (p) => {
            const near = cups.some(
                (c) => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) < 0.012
            );
            return near ? hex("#2a2a2e") : hex("#121214");
        },
    };

    // --- Socks -------------------------------------------------------------
    const sockTop = hem + 0.07;
    const sockShape = field()
        .add(
            grow(body.draped(0.006), (x, y, z) => {
                const a = Math.atan2(
                    z - ankleL[2],
                    Math.abs(x) - Math.abs(ankleL[0])
                );
                // Ribbed, and slouched in a few rings above the shoe.
                return (
                    0.005 +
                    Math.sin(a * 34) * 0.0006 +
                    Math.sin(y / 0.009 + a) *
                        smooth(0.08, 0.14, y) *
                        smooth(sockTop, sockTop - 0.06, y) *
                        0.0018
                );
            })
        )
        .clip(halfSpace([0, sockTop, 0], [0, 1, 0]))
        .clip(halfSpace([0, 0.03, 0], [0, -1, 0]));
    const socks: Garment = {
        name: "Socks",
        shape: sockShape,
        box: [
            [-0.2, 0.02, -0.2],
            [0.2, sockTop + 0.01, 0.15],
        ],
        cell: 0.0035,
        triangles: 700,
        colour: () => hex("#efedea"),
        side: (p) => (p[0] < 0 ? -1 : 1),
    };

    // --- Shoes -------------------------------------------------------------
    // Derbies: an upper shaped on the foot, a toe box, a welt and a heel.
    const footDrape = body.draped(0.008);
    // `s` is the side: -1 the left foot (at -x), 1 the right.
    const shoeOf = (s: number) => {
        const ax = s * Math.abs(ankleL[0]);
        const tx = s * Math.abs(toesL[0]);
        const upper = field()
            .add(grow(footDrape, () => 0.007))
            .add(
                ellipsoid(
                    [tx, 0.031, toesL[2] - 0.022],
                    [0.045, 0.031, 0.072],
                    IDENTITY
                ),
                0.025
            )
            .clip(
                shape((x, y, z) => {
                    // Low at the heel and the sides, higher over the tongue.
                    const tongue = smooth(
                        ankleL[2] - 0.01,
                        ankleL[2] - 0.07,
                        z
                    );
                    return y - (0.074 + tongue * 0.024);
                })
            )
            // This foot only.
            .clip(shape((x) => -s * x));
        const sole = field()
            .add(grow(upper, () => 0.0045))
            .clip(halfSpace([0, 0.02, 0], [0, 1, 0]));
        const heel = roundBox(
            [ax, 0.014, ankleL[2] + 0.03],
            [0.034, 0.014, 0.04],
            0.006,
            IDENTITY
        );
        return field()
            .add(upper)
            .add(sole, 0.003)
            .add(heel, 0.004)
            .clip(halfSpace([0, 0, 0], [0, -1, 0]));
    };
    const shoesShape = field().add(shoeOf(1)).add(shoeOf(-1));
    const shoes: Garment = {
        name: "Shoes",
        shape: shoesShape,
        box: [
            [-0.2, -0.005, -0.25],
            [0.2, 0.13, 0.16],
        ],
        cell: 0.0035,
        triangles: 2000,
        colour: (p) => (p[1] < 0.021 ? hex("#221c18") : hex("#141010")),
        side: (p) => (p[0] < 0 ? -1 : 1),
    };

    return {
        id: "stagehand",
        garments: [
            shirt,
            collar,
            tie,
            badge,
            headphones,
            trousers,
            belt,
            socks,
            shoes,
        ],
    };
}
