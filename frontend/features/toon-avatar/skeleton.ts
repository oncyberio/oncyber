import type { ToonAvatarRecipe } from "./recipe";
import { lerp, type Vec3 } from "./mesh/vec";

/**
 * Bones use the VRM humanoid names and rest in a T-pose with no rotation,
 * facing +Z. Clips written for a normalized VRM humanoid drive this skeleton
 * unchanged, which is how the lobby's locomotion and emotes play on it.
 */
export const TOON_BONES = [
    "hips",
    "spine",
    "chest",
    "upperChest",
    "neck",
    "head",
    "leftShoulder",
    "leftUpperArm",
    "leftLowerArm",
    "leftHand",
    "rightShoulder",
    "rightUpperArm",
    "rightLowerArm",
    "rightHand",
    "leftUpperLeg",
    "leftLowerLeg",
    "leftFoot",
    "leftToes",
    "rightUpperLeg",
    "rightLowerLeg",
    "rightFoot",
    "rightToes",
    // Not humanoid: swings hair tails and coat tails a little behind motion.
    "hairTail",
    "coatTail",
] as const;

export type ToonBone = (typeof TOON_BONES)[number];

export const TOON_BONE_PARENT: Record<ToonBone, ToonBone | null> = {
    hips: null,
    spine: "hips",
    chest: "spine",
    upperChest: "chest",
    neck: "upperChest",
    head: "neck",
    leftShoulder: "upperChest",
    leftUpperArm: "leftShoulder",
    leftLowerArm: "leftUpperArm",
    leftHand: "leftLowerArm",
    rightShoulder: "upperChest",
    rightUpperArm: "rightShoulder",
    rightLowerArm: "rightUpperArm",
    rightHand: "rightLowerArm",
    leftUpperLeg: "hips",
    leftLowerLeg: "leftUpperLeg",
    leftFoot: "leftLowerLeg",
    leftToes: "leftFoot",
    rightUpperLeg: "hips",
    rightLowerLeg: "rightUpperLeg",
    rightFoot: "rightLowerLeg",
    rightToes: "rightFoot",
    hairTail: "head",
    coatTail: "hips",
};

export const boneIndex = (name: ToonBone) => TOON_BONES.indexOf(name);

export type ToonLayout = {
    /** Rest position of every bone, in metres, feet on y = 0. */
    joints: Record<ToonBone, Vec3>;
    /** Standing height to the top of the skull (hair and hats go above). */
    height: number;
    /** Ink line width in metres. */
    ink: number;
    head: {
        center: Vec3;
        /** Base size every face measurement is a multiple of. */
        size: number;
        halfWidth: number;
        halfDepth: number;
        up: number;
        down: number;
    };
    neck: { radius: number; top: number; bottom: number };
    torso: {
        bottom: number;
        top: number;
        shoulder: number;
        chest: number;
        waist: number;
        hips: number;
        belly: number;
        /** Forward lean of the upper spine, baked into the rest shape. */
        lean: number;
    };
    arm: { radius: number; upper: number; lower: number; hand: number };
    leg: { radius: number; upper: number; lower: number; spread: number };
    foot: { length: number; height: number; width: number };
};

/** Turns the body and head sliders into measurements and joint positions. */
export function layoutSkeleton(recipe: ToonAvatarRecipe): ToonLayout {
    const { body, head: headShape, look } = recipe;
    const height = lerp(1.2, 1.95, body.height);
    const build = lerp(0.86, 1.1, body.height);

    const size = lerp(0.125, 0.205, body.head);
    const up = size * lerp(0.92, 1.4, headShape.height);
    const down =
        size *
        lerp(0.9, 1.3, headShape.height) *
        lerp(0.92, 1.22, headShape.chin);
    const halfWidth = size * lerp(0.82, 1.24, headShape.width);
    const halfDepth = size * lerp(0.86, 1.18, headShape.depth);

    const lean = lerp(0, 0.16, body.slouch) * build;
    const headCenter: Vec3 = [0, height - up, lean * 1.05];
    const chinY = headCenter[1] - down;

    const armRadius = build * lerp(0.02, 0.05, body.limbs);
    const legRadius = armRadius * 1.2;
    const neckRadius = Math.min(halfWidth * 0.5, armRadius * 1.25 + 0.012);
    const neckLength = lerp(0.012, 0.11, body.neck) * build;
    const torsoTop = chinY - neckLength;

    const footHeight = build * lerp(0.05, 0.075, body.feet);
    const torsoLength = torsoTop * lerp(0.34, 0.5, body.torso);
    const torsoBottom = torsoTop - torsoLength;

    const shoulder = build * lerp(0.08, 0.2, body.shoulders);
    const chest = build * lerp(0.085, 0.2, body.chest);
    const waist = build * lerp(0.07, 0.2, body.waist);
    const hips = build * lerp(0.085, 0.2, body.hips);
    const belly = build * lerp(0, 0.13, body.belly);

    const spread = Math.max(hips * 0.48, legRadius * 1.15);
    const hipY = torsoBottom + torsoLength * 0.1;
    const kneeY = lerp(footHeight, hipY, 0.5);

    const armLength = torsoTop * lerp(0.36, 0.5, body.arms);
    const hand = build * lerp(0.075, 0.125, body.hands);
    const shoulderX = Math.max(shoulder, chest * 0.85);
    const shoulderY = torsoTop - Math.max(armRadius * 1.9, torsoLength * 0.13);
    const footLength = build * lerp(0.17, 0.27, body.feet);

    // The spine leans forward as it rises; the lean is part of the rest shape.
    const spineZ = (t: number) => lean * t * t;
    const spine = (t: number): Vec3 => [
        0,
        torsoBottom + torsoLength * t,
        spineZ(t),
    ];
    const shoulderZ = spineZ(0.9);

    const side = (x: number, y: number, z: number, sign: number): Vec3 => [
        x * sign,
        y,
        z,
    ];
    const joints = {
        hips: spine(0.12),
        spine: spine(0.32),
        chest: spine(0.54),
        upperChest: spine(0.74),
        neck: [0, torsoTop - 0.01, spineZ(1)] as Vec3,
        head: [0, chinY + down * 0.22, headCenter[2] - halfDepth * 0.1] as Vec3,
        hairTail: [0, headCenter[1], headCenter[2] - halfDepth * 0.8] as Vec3,
        coatTail: spine(0.05),
    } as Record<ToonBone, Vec3>;
    for (const [name, sign] of [
        ["left", 1],
        ["right", -1],
    ] as const) {
        joints[`${name}Shoulder`] = side(
            shoulderX * 0.45,
            shoulderY + armRadius * 0.4,
            shoulderZ,
            sign
        );
        joints[`${name}UpperArm`] = side(shoulderX, shoulderY, shoulderZ, sign);
        joints[`${name}LowerArm`] = side(
            shoulderX + armLength * 0.5,
            shoulderY,
            shoulderZ,
            sign
        );
        joints[`${name}Hand`] = side(
            shoulderX + armLength,
            shoulderY,
            shoulderZ,
            sign
        );
        joints[`${name}UpperLeg`] = side(spread, hipY, 0, sign);
        joints[`${name}LowerLeg`] = side(spread, kneeY, 0, sign);
        joints[`${name}Foot`] = side(spread, footHeight, 0, sign);
        joints[`${name}Toes`] = side(
            spread,
            footHeight * 0.45,
            footLength * 0.5,
            sign
        );
    }

    return {
        joints,
        height,
        ink: lerp(0.0035, 0.013, look.line) * build,
        head: { center: headCenter, size, halfWidth, halfDepth, up, down },
        neck: { radius: neckRadius, top: chinY + down * 0.3, bottom: torsoTop },
        torso: {
            bottom: torsoBottom,
            top: torsoTop,
            shoulder,
            chest,
            waist,
            hips,
            belly,
            lean,
        },
        arm: {
            radius: armRadius,
            upper: armLength * 0.5,
            lower: armLength * 0.5,
            hand,
        },
        leg: {
            radius: legRadius,
            upper: hipY - kneeY,
            lower: kneeY - footHeight,
            spread,
        },
        foot: {
            length: footLength,
            height: footHeight,
            width: Math.max(legRadius * 1.5, footLength * 0.36),
        },
    };
}
