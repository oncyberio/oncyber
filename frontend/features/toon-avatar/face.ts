import type { FaceLayout } from "./mesh/head";
import { lerp } from "./mesh/vec";
import type { ToonAvatarRecipe } from "./recipe";
import type { ToonLayout } from "./skeleton";

/**
 * The drawn face as numbers. The material paints the mouth, brows, lids and
 * marks from these in the fragment shader, so one shader serves every avatar
 * and a face can change (blink, talk, smile) without touching the mesh.
 *
 * Lengths are in head sizes from the head centre; eye values are in eye
 * radii. Arrays are vec4 uniforms.
 */
export type ToonFaceParams = {
    /** x, y, radius, aspect */
    eye: number[];
    /** radius x, radius y, star amount, ring width (0 = filled) */
    pupil: number[];
    /** highlight, lid droop, bags, lash count */
    eyeStyle: number[];
    /** lash length, wing, 0, 0 */
    lash: number[];
    /** inner x, outer x, y, half thickness */
    brow: number[];
    /** tilt, arch, enabled, 0 */
    browShape: number[];
    /** y, half width, curve, smirk */
    mouth: number[];
    /** wave, open above, open below, teeth (0 none, 1 top row, 2 clenched) */
    mouthOpen: number[];
    /** tongue, lips, 0, 0 */
    mouthStyle: number[];
    /** blush, freckles, forehead lines, stubble */
    marks: number[];
    /** mole, half width at the ears, chin depth, ink line width */
    head: number[];
    /** enabled, half width, half thickness, curl */
    mustache: number[];
    /** enabled, centre y, radius x, radius y */
    chinHair: number[];
    /** full beard, chinstrap, upper lip y (where a mustache sits), 0 */
    beard: number[];
    /** Lower skull outline, as the mesh shapes it: power, jaw taper, cheeks, 0 */
    skull: number[];
    skin: string;
    ink: string;
    browColor: string;
    lipColor: string;
    facialColor: string;
};

export function faceParams(
    recipe: ToonAvatarRecipe,
    layout: ToonLayout,
    face: FaceLayout
): ToonFaceParams {
    const { eyes, mouth, marks, hair, look } = recipe;
    const line = face.line;
    const { radius, aspect } = face.eye;

    const size = lerp(0.07, 0.26, eyes.pupilSize);
    const pupil = {
        dot: [size, size, 0, 0],
        spark: [size * 1.15, size * 1.15, 0.5, 0],
        slit: [size * 0.42, size * 1.7, 0, 0],
        ring: [
            size * 1.35,
            size * 1.35,
            0,
            Math.max(0.05, (line / radius) * 0.9),
        ],
        wide: [size * 1.9, size * 1.9, 0, 0],
    }[eyes.pupil];

    const weight = lerp(0.6, 3.4, eyes.browWeight) * line * 0.5;
    const tilt = lerp(-0.14, 0.14, eyes.browTilt);
    const browSpan = radius * 0.8;
    const brow = {
        none: { x0: 0, x1: 0, k: 1, tilt: 0, arch: 0, on: 0 },
        line: {
            x0: face.eye.x - browSpan,
            x1: face.eye.x + browSpan,
            k: 1,
            tilt,
            arch: 0.01,
            on: 1,
        },
        arched: {
            x0: face.eye.x - browSpan,
            x1: face.eye.x + browSpan,
            k: 1,
            tilt,
            arch: 0.1,
            on: 1,
        },
        thick: {
            x0: face.eye.x - browSpan,
            x1: face.eye.x + browSpan,
            k: 2.2,
            tilt,
            arch: 0.04,
            on: 1,
        },
        unibrow: {
            x0: -0.02,
            x1: face.eye.x + browSpan,
            k: 1.3,
            tilt: tilt * 0.5,
            arch: 0.03,
            on: 1,
        },
        angled: {
            x0: face.eye.x - browSpan,
            x1: face.eye.x + browSpan,
            k: 1.2,
            tilt: tilt + 0.14,
            arch: 0,
            on: 1,
        },
    }[eyes.brows];

    const bend = (mouth.curve - 0.5) * 0.22;
    const gape = lerp(0.05, 0.3, mouth.open);
    let halfWidth = face.mouth.halfWidth;
    const shape = {
        line: {
            curve: bend,
            smirk: 0,
            wave: 0,
            above: 0,
            below: 0,
            teeth: 0,
            tongue: 0,
        },
        smile: {
            curve: 0.13 + bend,
            smirk: 0,
            wave: 0,
            above: 0,
            below: 0,
            teeth: 0,
            tongue: 0,
        },
        frown: {
            curve: -0.11 + bend,
            smirk: 0,
            wave: 0,
            above: 0,
            below: 0,
            teeth: 0,
            tongue: 0,
        },
        smirk: {
            curve: 0.05 + bend,
            smirk: 0.14,
            wave: 0,
            above: 0,
            below: 0,
            teeth: 0,
            tongue: 0,
        },
        open: {
            curve: 0.06 + bend,
            smirk: 0,
            wave: 0,
            above: 0.02,
            below: gape,
            teeth: 1,
            tongue: 1,
        },
        grin: {
            curve: 0.1 + bend,
            smirk: 0,
            wave: 0,
            above: 0.03,
            below: gape * 0.75,
            teeth: 2,
            tongue: 0,
        },
        oh: {
            curve: 0,
            smirk: 0,
            wave: 0,
            above: gape * 0.6,
            below: gape * 0.6,
            teeth: 0,
            tongue: 0,
        },
        wavy: {
            curve: bend,
            smirk: 0,
            wave: 0.035,
            above: 0,
            below: 0,
            teeth: 0,
            tongue: 0,
        },
    }[mouth.style];
    if (mouth.style === "oh") halfWidth = Math.max(0.08, halfWidth * 0.42);

    const facial = hair.facial;
    const upperLip = face.mouth.y + 0.13;
    const chinDepth = layout.head.down / layout.head.size;
    return {
        eye: [face.eye.x, face.eye.y, radius, aspect],
        pupil,
        eyeStyle: [
            eyes.pupil === "wide" ? 1 : 0,
            eyes.lids,
            eyes.bags,
            eyes.lashes === "upper" ? 3 : eyes.lashes === "wing" ? 1 : 0,
        ],
        lash: [
            eyes.lashes === "wing" ? 0.42 : 0.24,
            eyes.lashes === "wing" ? 1 : 0,
            0,
            0,
        ],
        brow: [brow.x0, brow.x1, face.brow.y, weight * brow.k],
        browShape: [brow.tilt, brow.arch, brow.on, 0],
        mouth: [face.mouth.y, halfWidth, shape.curve, shape.smirk],
        mouthOpen: [shape.wave, shape.above, shape.below, shape.teeth],
        mouthStyle: [shape.tongue, mouth.lips, 0, 0],
        marks: [
            marks.blush,
            marks.freckles,
            Math.round(marks.wrinkles * 3),
            marks.stubble,
        ],
        head: [
            marks.mole,
            layout.head.halfWidth / layout.head.size,
            chinDepth,
            line,
        ],
        mustache: [
            facial === "mustache" ||
            facial === "handlebar" ||
            facial === "goatee"
                ? 1
                : 0,
            facial === "handlebar"
                ? halfWidth + 0.16
                : Math.max(0.16, halfWidth * 0.9),
            facial === "handlebar" ? 0.035 : 0.05,
            facial === "handlebar" ? 0.22 : -0.06,
        ],
        chinHair: [
            facial === "goatee" || facial === "soulpatch" ? 1 : 0,
            facial === "soulpatch" ? face.mouth.y - 0.13 : face.mouth.y - 0.2,
            facial === "soulpatch" ? 0.07 : Math.max(0.2, halfWidth * 0.75),
            facial === "soulpatch" ? 0.07 : 0.2,
        ],
        beard: [
            facial === "beard" ? 1 : 0,
            facial === "chinstrap" ? 1 : 0,
            upperLip,
            0,
        ],
        skull: [
            lerp(2, 4.6, recipe.head.square),
            lerp(-0.14, 0.52, recipe.head.jaw),
            lerp(0, 0.16, recipe.head.cheeks),
            0,
        ],
        skin: look.skin,
        ink: look.ink,
        browColor: eyes.browColor,
        lipColor: mouth.lipColor,
        facialColor: hair.facialColor,
    };
}

/** What changes from frame to frame: the avatar's expression. */
export type ToonExpression = {
    /** 0 open, 1 closed. */
    blinkLeft: number;
    blinkRight: number;
    /** -1..1, where the pupils point. */
    lookX: number;
    lookY: number;
    /** 0..1, opens the mouth for speech. */
    talk: number;
    /** -1..1, bends the mouth down or up. */
    smile: number;
    /** -1..1, lowers or raises the brows. */
    brows: number;
};

export const NEUTRAL_EXPRESSION: ToonExpression = {
    blinkLeft: 0,
    blinkRight: 0,
    lookX: 0,
    lookY: 0,
    talk: 0,
    smile: 0,
    brows: 0,
};
