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
    euler,
    IDENTITY,
} from "../../../frontend/features/procedural-avatar/kernel/sdf";
import {
    fbm,
    noise3,
} from "../../../frontend/features/procedural-avatar/kernel/noise";
import type { BodyField } from "./bodyField";
import {
    type Cut,
    lengthen,
    slim,
    cutSleeves,
    paint,
    recolour,
    sample,
    rims,
    trimCutaway,
} from "./tailor";
import type { CLOTH_KINDS } from "../../../frontend/features/procedural-avatar/figure/outfitFiles";
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
    /**
     * What kind of cloth it is at a point: plain, striped or polished
     * (see CLOTH_KINDS in figure/shading.ts). Plain unless given.
     */
    finish?(p: V3): keyof typeof CLOTH_KINDS;
    /** Take skin only from this side of the body (-1 left, 1 right). */
    side?(p: V3): -1 | 1 | 0;
    /**
     * A pair, one each side of x = 0 (shoes, socks): found and bound as
     * two, so no cloth joins them where the feet nearly touch.
     */
    pair?: boolean;
    /**
     * Worn on the front of the shirt (a tie, a badge): moved forward, all
     * of a piece, until no part of it is behind the donor's clothes.
     * "wrap" (headphones round the neck): each part is pushed out from
     * the neck on its own, so the band lies on the collar and the cups
     * on the shirt; nearby vertices move together, so a cup stays whole.
     */
    over?: boolean | "wrap";
}

export interface Outfit {
    id: string;
    garments: Garment[];
    /**
     * Garments taken from a model on the same base (see donor.ts): the
     * model's file name, in the models folder given to the command, and
     * which of its materials to take.
     */
    donor?: {
        model: string;
        pick: RegExp;
        /** Body below this height is inside the shoes: never drawn. */
        feet?: number;
        /** Alter what was taken: trim, lengthen, widen, repaint. */
        tailor?(cut: Cut[]): Cut[];
    };
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

/** A drum round `axis` (unit), rounded at its edges. */
const disc = (
    c: V3,
    axis: V3,
    radius: number,
    half: number,
    round: number
): Shape =>
    shape((x, y, z) => {
        const d: V3 = [x - c[0], y - c[1], z - c[2]];
        const h = d[0] * axis[0] + d[1] * axis[1] + d[2] * axis[2];
        const r = Math.sqrt(
            Math.max(0, d[0] ** 2 + d[1] ** 2 + d[2] ** 2 - h * h)
        );
        const qx = r - (radius - round);
        const qy = Math.abs(h) - (half - round);
        return (
            Math.min(Math.max(qx, qy), 0) +
            Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) -
            round
        );
    });

/** A ring round `axis` (unit). */
const ring = (c: V3, axis: V3, major: number, minor: number): Shape =>
    shape((x, y, z) => {
        const d: V3 = [x - c[0], y - c[1], z - c[2]];
        const h = d[0] * axis[0] + d[1] * axis[1] + d[2] * axis[2];
        const r = Math.sqrt(
            Math.max(0, d[0] ** 2 + d[1] ** 2 + d[2] ** 2 - h * h)
        );
        return Math.hypot(r - major, h) - minor;
    });

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
            0.003;
        const torso = 0.004 + 0.007 * tuck + blouse;
        // Close over the shoulder, fuller down the arm.
        const sleeve =
            0.006 +
            0.006 * smooth(Math.abs(shoulderL[0]) + 0.02, 0.3, ax) -
            0.002 * smooth(0.3, 0.5, ax);
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
            ax / 0.03 + angle * 1.2 + noise3(x * 14, y * 14, z * 14) * 2.2
        );
        const sleeve =
            a *
            (1 - cuffBand) *
            twist *
            (0.002 + 0.0035 * elbow + 0.004 * wrist);
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
            0.0038;
        // Diagonal pulls from under the arms to the waist.
        const pull =
            (1 - a) *
            smooth(0.05, 0.13, ax) *
            Math.sin(
                (ax * 0.8 + y * 0.6) / 0.016 + noise3(x * 8, y * 8, z * 8)
            ) *
            smooth(waistTop + 0.02, waistTop + 0.12, y) *
            smooth(shoulderL[1] - 0.05, shoulderL[1] - 0.15, y) *
            0.0025;
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
        return sleeve + under + drape + pull + placket + cuffEdge + grain;
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
        // Round the neck only, up to the collar band: the shoulders may
        // rise above the line.
        .clip(
            shape((x, y, z) =>
                Math.min(
                    y - neckline(z),
                    0.08 - Math.hypot(x - neck[0], (z - neck[2]) * 1.05),
                    0.0125 - neckSkin.eval(x, y, z)
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
        .clip(neckRound(0.084))
        // Open at the front, where the knot sits.
        .carve(
            shape((x, y, z) =>
                Math.max(Math.abs(x) - 0.006, z - neck[2] + 0.02)
            )
        );
    // The fall: over the band at the back, lying on the shirt at the
    // front, cut to two points either side of the knot.
    const tipX = 0.03;
    const drop = (y: number, z: number) => Math.max(0, collarTop(z) - y);
    const fallBase = shape((x, y, z) =>
        Math.min(
            neckSkin.eval(x, y, z) - 0.0155 - drop(y, z) * 0.12,
            shirtBody.eval(x, y, z) - 0.0024
        )
    );
    const fall = field()
        .add(shape((x, y, z) => Math.abs(fallBase.eval(x, y, z)) - 0.0016))
        .clip(shape((x, y, z) => y - collarTop(z) - 0.002))
        // Round the neck, not out over the shoulders; the points reach
        // down the chest.
        .clip(
            shape(
                (x, y, z) =>
                    neckRound(0.095).eval(x, y, z) -
                    smooth(-0.02, -0.07, z - neck[2]) * 0.06
            )
        )
        .clip(
            shape((x, y, z) => {
                // Deeper at the front, where the points are.
                const front = smooth(-0.02, -0.06, z - neck[2]);
                const point = Math.exp(-(((Math.abs(x) - tipX) / 0.03) ** 2));
                return drop(y, z) - (0.03 + front * (0.008 + point * 0.028));
            })
        )
        // The gap at the front, widening down to the points.
        .carve(
            shape((x, y, z) =>
                Math.max(
                    Math.abs(x) - 0.006 - drop(y, z) * 0.4,
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
        triangles: 2200,
        colour: () => hex("#f3f1f3"),
    };

    // --- Trousers ----------------------------------------------------------
    const legX = (y: number) => {
        const t = smooth(crotch + 0.05, hem, y);
        return Math.abs(hipL[0]) + 0.004 + t * 0.036;
    };
    const legR = (y: number) => {
        const t = smooth(crotch + 0.12, hem, y);
        // Wide, but with a clear gap between the legs down to the hem.
        return 0.088 + t * 0.017;
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
            0.005;
        // Pleats from the waistband, falling into the crease.
        const pleat =
            front *
            smooth(crotch - 0.05, waistTop - 0.03, y) *
            (Math.exp(-(((lx + side * 0.035) / 0.006) ** 2)) * 0.006 -
                Math.exp(-(((lx + side * 0.045) / 0.008) ** 2)) * 0.003);
        // Long soft folds round the leg, and a break above the hem.
        const angle = Math.atan2(z - legZ(y), lx);
        const folds =
            smooth(crotch, hem + 0.1, y) *
            Math.sin(angle * 5 + fbm(x * 4, y * 2, z * 4) * 4) *
            0.006;
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
        finish: () => "polished",
    };

    // --- Tie, badge, headphones ---------------------------------------------
    // The shirt's front down the middle, to lay things on.
    const frontAt = new Map<number, number>();
    const frontZ = (at: number) => {
        // Above the shirt's opening, where the shirt was.
        const y = Math.min(at, neckline(-1) - 0.004);
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
        0.03 + smooth(knotY - 0.02, tipY + 0.03, y) * 0.04;
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
    // The knot: wider at the top, tucked up under the collar's points.
    const knotZ = frontZ(knotY) - 0.009;
    const knot = field()
        .add(
            roundBox(
                [0, knotY + 0.004, knotZ],
                [0.021, 0.019, 0.009],
                0.007,
                euler(-0.25, 0, 0)
            )
        )
        .clip(
            shape((x, y) => Math.abs(x) - (0.021 - (knotY + 0.022 - y) * 0.3))
        );
    const tie: Garment = {
        name: "Tie",
        over: true,
        shape: field().add(blade).add(knot, 0.006),
        box: [
            [-0.05, tipY - 0.01, neck[2] - 0.2],
            [0.05, knotY + 0.03, neck[2] - 0.02],
        ],
        cell: 0.0014,
        triangles: 1400,
        // Pale stripes on the slant, drawn per pixel by the cloth shader.
        colour: () => hex("#4f86de"),
        // The knot wraps the other way.
        finish: (p) => (p[1] > knotY - 0.015 ? "crossStriped" : "striped"),
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
        over: true,
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
        finish: () => "polished",
    };

    // Headphones resting round the neck: the band behind, a cup on each
    // collarbone, a cable down to a player on the belt.
    const cupY = neck[1] - 0.05;
    const cups = ([-1, 1] as const).map((s) => {
        const cx = s * 0.074;
        const cz =
            surfaceAlong(shirtBody, [cx, cupY, neck[2]], [0, 0, -1])[2] - 0.024;
        return [cx, cupY, cz] as V3;
    });
    // Each cup faces out from the chest, tipped up and to its side.
    const cupAxis = (cx: number): V3 => {
        const v: V3 = [Math.sign(cx) * 0.35, 0.45, -0.82];
        const l = Math.hypot(...v);
        return [v[0] / l, v[1] / l, v[2] / l];
    };
    const phones = field();
    const cushions = field();
    for (const c of cups) {
        const n = cupAxis(c[0]);
        const along = (t: number): V3 => [
            c[0] + n[0] * t,
            c[1] + n[1] * t,
            c[2] + n[2] * t,
        ];
        // The shell, a shallow drum with a cap on its face.
        phones.add(disc(along(0.002), n, 0.03, 0.008, 0.005));
        phones.add(disc(along(0.011), n, 0.022, 0.003, 0.002), 0.002);
        // The cushion against the chest.
        cushions.add(ring(along(-0.008), n, 0.024, 0.0085));
    }
    phones.add(cushions, 0.002);
    // The band: an arc round the back of the neck.
    const bandArc: V3[] = [];
    for (let i = 0; i <= 12; i++) {
        const a = Math.PI * (i / 12);
        bandArc.push([
            -Math.cos(a) * 0.078,
            cupY + 0.035 + Math.sin(a) * 0.04,
            neck[2] + 0.01 + Math.sin(a) * 0.055,
        ]);
    }
    bandArc[0] = [cups[0][0] - 0.012, cups[0][1] + 0.026, cups[0][2] + 0.012];
    bandArc[12] = [cups[1][0] + 0.012, cups[1][1] + 0.026, cups[1][2] + 0.012];
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
        over: "wrap",
        shape: phones,
        box: [
            [-0.14, waistTop - 0.07, neck[2] - 0.16],
            [0.16, neck[1] + 0.03, neck[2] + 0.1],
        ],
        cell: 0.0014,
        triangles: 2200,
        colour: (p) =>
            cushions.eval(...p) < 0.001 ? hex("#0d0d0f") : hex("#18181b"),
        // Leatherette cushions, the rest hard plastic.
        finish: (p) => (cushions.eval(...p) < 0.001 ? "plain" : "polished"),
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
                // Slouched in a few rings above the shoe (fine ribs
                // alias into fuzz at this cell size, so none).
                // Thin inside the shoe, so the shoe stays clear of it.
                return (
                    0.0025 +
                    0.0025 * smooth(0.075, 0.11, y) +
                    Math.sin(y / 0.009 + a) *
                        smooth(0.08, 0.14, y) *
                        smooth(sockTop, sockTop - 0.06, y) *
                        0.0018
                );
            })
        )
        .clip(halfSpace([0, sockTop, 0], [0, 1, 0]))
        .clip(halfSpace([0, 0.06, 0], [0, -1, 0]));
    const socks: Garment = {
        name: "Socks",
        shape: sockShape,
        box: [
            [-0.2, 0.02, -0.2],
            [0.2, sockTop + 0.01, 0.15],
        ],
        cell: 0.0025,
        triangles: 900,
        colour: () => hex("#efedea"),
        side: (p) => (p[0] < 0 ? -1 : 1),
        pair: true,
    };

    // --- Shoes -------------------------------------------------------------
    // Derbies: an upper shaped on the foot, a low rounded toe, a lace slit
    // with laces across it, a thin welt and a heel block.
    const footDrape = body.draped(0.008);
    const welt = 0.012;
    const laceZ = [0.0, -0.016, -0.032, -0.048];
    // `s` is the side: -1 the left foot (at -x), 1 the right.
    const shoeParts = (s: number) => {
        const ax = s * Math.abs(ankleL[0]);
        const tx = s * Math.abs(toesL[0]);
        const last = field()
            .add(grow(footDrape, () => 0.0075))
            .add(
                ellipsoid(
                    [tx, 0.027, toesL[2] - 0.02],
                    [0.041, 0.026, 0.06],
                    IDENTITY
                ),
                0.022
            )
            .clip(
                shape((x, y, z) => {
                    // Low at the heel and the sides, higher over the tongue.
                    const tongue = smooth(
                        ankleL[2] - 0.005,
                        ankleL[2] - 0.06,
                        z
                    );
                    return y - (0.072 + tongue * 0.022);
                })
            );
        const upper = field()
            .add(last)
            // The lace slit down the instep, between the facings.
            .carve(
                shape((x, y, z) => {
                    const along = Math.max(
                        z - (ankleL[2] - 0.022),
                        laceZ[3] - 0.012 - z
                    );
                    // Only through the leather, not into the foot.
                    return Math.max(
                        Math.abs(x - ax) - 0.005,
                        along,
                        -last.eval(x, y, z) - 0.002
                    );
                }),
                0.002
            );
        const top = (z: number) =>
            surfaceAlong(last, [ax, 0.03, z], [0, 1, 0], 0.1)[1];
        const laces = field();
        for (const dz of laceZ) {
            const z = ankleL[2] - 0.03 + dz;
            // Proud of the leather, across the slit.
            const y = top(z) - 0.0005;
            laces.add(capsule([ax - 0.012, y, z], [ax + 0.012, y, z], 0.0022));
        }
        const sole = field()
            .add(grow(upper, () => 0.003))
            .clip(halfSpace([0, welt, 0], [0, 1, 0]));
        const heel = roundBox(
            [ax, 0.012, ankleL[2] + 0.022],
            [0.03, 0.012, 0.032],
            0.005,
            IDENTITY
        );
        const shoe = field()
            .add(upper)
            .add(sole, 0.002)
            .add(heel, 0.003)
            .add(laces)
            .clip(halfSpace([0, 0, 0], [0, -1, 0]));
        return { shoe, laces };
    };
    const shoeL = shoeParts(-1);
    const shoeR = shoeParts(1);
    const shoesShape = field().add(shoeL.shoe).add(shoeR.shoe);
    const onLaces = (p: V3) =>
        (p[0] < 0 ? shoeL : shoeR).laces.eval(...p) < 0.0008;
    const shoes: Garment = {
        name: "Shoes",
        shape: shoesShape,
        box: [
            [-0.2, -0.005, -0.25],
            [0.2, 0.13, 0.16],
        ],
        cell: 0.003,
        triangles: 2400,
        colour: (p) =>
            p[1] < welt + 0.001
                ? hex("#231d19")
                : onLaces(p)
                ? hex("#2b2a2a")
                : hex("#141010"),
        finish: (p) =>
            p[1] < welt + 0.001 || onLaces(p) ? "plain" : "polished",
        side: (p) => (p[0] < 0 ? -1 : 1),
        pair: true,
    };

    // --- Tailoring the donor's clothes --------------------------------------
    const kneeL = figure.joint("leftLowerLeg");
    // Where the arm's axis is (y, z) at a distance along it, from the
    // shoulder through the elbow to the wrist.
    const armAxis = (x: number): [number, number] => {
        const ax = Math.abs(x);
        const [a, b] =
            ax < Math.abs(elbowL[0]) ? [shoulderL, elbowL] : [elbowL, handL];
        const t = (ax - Math.abs(a[0])) / (Math.abs(b[0]) - Math.abs(a[0]));
        return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    };
    const sleeveEase = (x: number) => {
        const ax = Math.abs(x);
        const cuffBand = smooth(cuff - 0.05, cuff - 0.045, ax);
        return 0.011 - 0.003 * smooth(0.35, 0.5, ax) - 0.002 * cuffBand;
    };
    // The shirt as paint: white, its folds and creases, the placket and
    // buttons down the front, cuffs at the wrists.
    const shirtPaint = (
        p: V3,
        n: V3,
        donorShade = 1
    ): [number, number, number, number] => {
        const [x, y, z] = p;
        const ax = Math.abs(x);
        const a = arm(ax);
        let shade = donorShade * (0.97 + 0.05 * fbm(x * 7, y * 7, z * 7));
        let line = 0;
        // Sleeves: twisting creases, bunched at the elbow and the cuff.
        if (a > 0) {
            const angle = Math.atan2(z - armAxis(x)[1], y - armAxis(x)[0]);
            const elbow = Math.exp(-(((ax - Math.abs(elbowL[0])) / 0.06) ** 2));
            const wrist = smooth(cuff - 0.16, cuff - 0.06, ax);
            const twist = Math.sin(
                ax / 0.022 + angle * 1.3 + noise3(x * 12, y * 12, z * 12) * 2.5
            );
            const crease =
                smooth(0.7, 0.97, twist) *
                (0.25 + 0.75 * Math.max(elbow, wrist));
            // Under the arm, the cloth hangs in soft folds.
            const under = smooth(0.2, -0.6, n[1]) * 0.08;
            shade *= 1 - 0.22 * crease * a - under * a;
            // A highlight running beside each crease.
            shade +=
                0.05 *
                smooth(0.2, 0.5, twist) *
                smooth(0.7, 0.5, twist) *
                a *
                Math.max(elbow, wrist);
            // The cuff: a seam line and a button.
            const cuffAt = cuff - 0.05;
            line = Math.max(
                line,
                Math.exp(-(((ax - cuffAt) / 0.0012) ** 2)) * a
            );
        }
        // Body: pulls from under the arms, folds into the waistband.
        const body = 1 - a;
        if (body > 0) {
            const pull =
                smooth(0.04, 0.14, ax) *
                smooth(
                    0.6,
                    0.95,
                    Math.sin(
                        (ax * 0.8 + y * 0.6) / 0.018 +
                            noise3(x * 8, y * 8, z * 8) * 2
                    )
                ) *
                smooth(waistTop + 0.02, waistTop + 0.12, y) *
                smooth(shoulderL[1] - 0.04, shoulderL[1] - 0.14, y);
            const tuck =
                smooth(waistTop + 0.12, waistTop + 0.02, y) *
                smooth(
                    0.55,
                    0.95,
                    Math.sin(x * 60 + fbm(x * 5, y * 5, z * 5) * 3)
                );
            shade *= 1 - body * (0.16 * pull + 0.14 * tuck);
            // The placket down the front: two seams, and the buttons.
            const front = smooth(-0.3, -0.7, n[2]);
            const placket = Math.exp(-(((ax - 0.013) / 0.0011) ** 2));
            line = Math.max(line, placket * front * body);
            for (let i = 0; i < 6; i++) {
                const by = neck[1] - 0.06 - i * 0.075;
                const d = Math.hypot(x, y - by);
                if (front > 0.5 && d < 0.0055) {
                    const ring =
                        smooth(0.0035, 0.0045, d) * smooth(0.0058, 0.005, d);
                    const holes = Math.min(
                        Math.hypot(Math.abs(x) - 0.0013, y - by),
                        1
                    );
                    shade *=
                        0.9 - 0.12 * ring - 0.2 * smooth(0.0011, 0.0006, holes);
                }
            }
        }
        // Seams and stitching: a cool grey line.
        const white = hex("#f5f3f6");
        const crease = hex("#bcc0d6");
        const lit = mix(
            crease,
            white,
            Math.min(1, Math.max(0, (shade - 0.6) / 0.4))
        );
        const col = mix(lit, hex("#a9adc4"), line * 0.8);
        return [...col, 1] as [number, number, number, number];
    };
    const tailor = (cut: Cut[]): Cut[] => {
        const out: Cut[] = [];
        for (const c of cut) {
            if (/Tops/.test(c.garment.name)) {
                const tops = cutSleeves(
                    trimCutaway(c.garment, c.texture),
                    0.03
                );
                slim(
                    tops,
                    armAxis,
                    Math.abs(shoulderL[0]) + 0.02,
                    body,
                    sleeveEase
                );
                const donor = c.texture;
                // The donor's collar keeps its painted shading, made white.
                const collarShade = (uv: [number, number]) => {
                    if (!(uv[1] < 0.24 && uv[0] > 0.32 && uv[0] < 0.68))
                        return 1;
                    const [r, g, b] = sample(donor, uv[0], uv[1]);
                    const l = 0.3 * r + 0.55 * g + 0.15 * b;
                    return 0.7 + 0.35 * Math.min(1, l / 0.75);
                };
                out.push({
                    ...c,
                    garment: tops,
                    texture: paint(tops, 1024, (p, n, uv) =>
                        shirtPaint(p, n, collarShade(uv))
                    ),
                    size: 1024,
                });
                // Long sleeves: each short sleeve carried on to the wrist.
                // Where each sleeve was cut off: its open rim, every
                // vertex of it, so the long sleeve meets it edge to edge.
                const loops = rims(tops);
                const meanX = (l: number[]) =>
                    l.reduce((s, v) => s + tops.positions[v * 3], 0) / l.length;
                const ends = [-1, 1].map((side) =>
                    loops.reduce((a, b) =>
                        meanX(b) * side > meanX(a) * side ? b : a
                    )
                );
                for (const loop of ends) {
                    // In order round the arm (a rim can double back on
                    // itself where VRoid's cloth folds).
                    const P = tops.positions;
                    const angle = (v: number) => {
                        const [ay, az] = armAxis(P[v * 3]);
                        return Math.atan2(P[v * 3 + 2] - az, P[v * 3 + 1] - ay);
                    };
                    const rim = [...loop].sort((a, b) => angle(a) - angle(b));
                    const side = Math.sign(tops.positions[rim[0] * 3]);
                    const sleeve = lengthen(
                        tops,
                        rim,
                        armAxis,
                        side * cuff,
                        body,
                        sleeveEase,
                        14
                    );
                    sleeve.name = `Sleeve ${side < 0 ? "left" : "right"}`;
                    console.log(`sleeve rim: ${rim.length} points`);
                    out.push({
                        garment: sleeve,
                        texture: paint(sleeve, 512, (p, n) => shirtPaint(p, n)),
                        size: 512,
                        rebind: true,
                        side: () => (side < 0 ? -1 : 1),
                    });
                }
            } else if (/Bottoms/.test(c.garment.name)) {
                const legs = trimCutaway(c.garment, c.texture);
                const q = legs.positions;
                let low = Infinity;
                for (let v = 0; v < q.length; v += 3)
                    low = Math.min(low, q[v + 1]);
                const top = crotch + 0.04;
                // Where each leg's middle is, at a height.
                const legCentre = (
                    y: number,
                    side: number
                ): [number, number] => {
                    const k = Math.min(
                        1,
                        Math.max(0, (y - hem) / (hipL[1] - hem))
                    );
                    return [
                        side *
                            (Math.abs(hipL[0]) * k +
                                Math.abs(kneeL[0]) * (1 - k) +
                                0.008 +
                                0.016 * (1 - k)),
                        hips[2] + 0.01,
                    ];
                };
                // Shorter: the leg ends above the ankle.
                for (let v = 0; v < q.length; v += 3)
                    if (q[v + 1] < top)
                        q[v + 1] =
                            top -
                            ((top - q[v + 1]) * (top - hem)) / (top - low);
                // How wide each leg is now, in 1 cm slabs: the mean
                // distance of its points from the middle.
                const slabs = new Map<string, [number, number]>();
                const slab = (v: number) =>
                    `${Math.sign(q[v]) || 1}:${Math.floor(q[v + 1] / 0.01)}`;
                const radius = (v: number) => {
                    const [cx, cz] = legCentre(q[v + 1], Math.sign(q[v]) || 1);
                    return Math.hypot(q[v] - cx, q[v + 2] - cz);
                };
                for (let v = 0; v < q.length; v += 3) {
                    if (q[v + 1] >= top) continue;
                    const e = slabs.get(slab(v)) || [0, 0];
                    slabs.set(slab(v), [e[0] + radius(v), e[1] + 1]);
                }
                // Wider: every layer of the leg (VRoid turns hems in)
                // scaled out together, to a straight wide leg.
                for (let v = 0; v < q.length; v += 3) {
                    const y = q[v + 1];
                    if (y >= top) continue;
                    // Smoothed over the slabs either side.
                    let sum = 0;
                    let n = 0;
                    const side = Math.sign(q[v]) || 1;
                    const at = Math.floor(y / 0.01);
                    for (let d = -3; d <= 3; d++) {
                        const e = slabs.get(`${side}:${at + d}`);
                        if (e) (sum += e[0]), (n += e[1]);
                    }
                    const mean = sum / n;
                    const t = smooth(kneeL[1], hem, y);
                    const wide = 0.092 + 0.014 * t;
                    const grow = smooth(top, crotch - 0.1, y);
                    const f =
                        1 + Math.max(0, wide / Math.max(mean, 0.03) - 1) * grow;
                    const [cx, cz] = legCentre(y, Math.sign(q[v]) || 1);
                    q[v] = cx + (q[v] - cx) * f;
                    q[v + 2] = cz + (q[v + 2] - cz) * f;
                }
                out.push({
                    ...c,
                    garment: legs,
                    // Navy, the belt as it was.
                    texture: recolour(
                        c.texture,
                        hex("#262c45"),
                        (u, v) => v < 0.045
                    ),
                    // The model's own weights: they part the legs well.
                    rebind: false,
                    side: (p) =>
                        p[1] < crotch + 0.02 ? (p[0] < 0 ? -1 : 1) : 0,
                });
            } else out.push(c);
        }
        return out;
    };

    return {
        id: "stagehand",
        // Shirt, trousers and shoes from a VRoid model; the rest our own.
        donor: {
            model: "Sakurada Fumiriya.vrm",
            pick: /Tops|Bottoms|Shoes/,
            feet: 0.075,
            tailor,
        },
        garments: [tie, badge, headphones, socks],
    };
    void [shirt, collar, trousers, belt, shoes];
}
