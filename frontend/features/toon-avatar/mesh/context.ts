import type { ToonAvatarRecipe } from "../recipe";
import {
    boneIndex,
    layoutSkeleton,
    type ToonBone,
    type ToonLayout,
} from "../skeleton";
import {
    hexToLinear,
    MeshBuilder,
    type Rgb,
    type Row,
    type Weights,
} from "./builder";
import { smoothstep } from "./vec";

export type ToonColors = {
    skin: Rgb;
    ink: Rgb;
    hair: Rgb;
    top: Rgb;
    accent: Rgb;
    outer: Rgb;
    bottom: Rgb;
    shoe: Rgb;
    sole: Rgb;
    glasses: Rgb;
    hat: Rgb;
    metal: Rgb;
    white: Rgb;
};

/** Everything a part builder needs: the mesh, the sliders and the measurements. */
export type ToonContext = {
    builder: MeshBuilder;
    recipe: ToonAvatarRecipe;
    layout: ToonLayout;
    colors: ToonColors;
};

export function createContext(recipe: ToonAvatarRecipe): ToonContext {
    const { outfit, hair, extras, look } = recipe;
    return {
        builder: new MeshBuilder(),
        recipe,
        layout: layoutSkeleton(recipe),
        colors: {
            skin: hexToLinear(look.skin),
            ink: hexToLinear(look.ink),
            hair: hexToLinear(hair.color),
            top: hexToLinear(outfit.topColor),
            accent: hexToLinear(outfit.accentColor),
            outer: hexToLinear(outfit.outerColor),
            bottom: hexToLinear(outfit.bottomColor),
            shoe: hexToLinear(outfit.shoeColor),
            sole: hexToLinear("#f4f1ea"),
            glasses: hexToLinear(extras.glassesColor),
            hat: hexToLinear(extras.hatColor),
            metal: hexToLinear(extras.metalColor),
            white: hexToLinear("#ffffff"),
        },
    };
}

export const rigid = (bone: ToonBone): Weights => [[boneIndex(bone), 1]];

/**
 * Weights along a chain of bones. `stops` are the positions where each bone
 * starts (its joint). Around a joint the two bones blend over `soft`, which
 * is what makes elbows and knees bend like a noodle instead of a hinge.
 */
export function chainWeights(
    at: number,
    stops: [number, ToonBone][],
    soft: number
): Weights {
    for (let i = stops.length - 1; i >= 1; i--) {
        const joint = stops[i][0];
        if (at >= joint + soft) return rigid(stops[i][1]);
        if (at > joint - soft) {
            const w = smoothstep(joint - soft, joint + soft, at);
            return [
                [boneIndex(stops[i - 1][1]), 1 - w],
                [boneIndex(stops[i][1]), w],
            ];
        }
    }
    return rigid(stops[0][1]);
}

export type Span = {
    from: number;
    to: number;
    color: Rgb;
    /** Radius multiplier, so cloth sits proud of skin. */
    grow?: number;
    /** Radius multiplier at the far end, for flares and tapers. */
    growEnd?: number;
};

/**
 * Rows for a surface cut into coloured spans along its length (sleeve, skin,
 * cuff). Where the radius steps between spans the step itself is drawn in
 * ink, which gives hems their line.
 */
export function spanRows(
    spans: Span[],
    step: number,
    ink: Rgb,
    makeRow: (at: number, grow: number) => Omit<Row, "color">
): Row[] {
    const rows: Row[] = [];
    spans.forEach((span, index) => {
        const length = span.to - span.from;
        const count = Math.max(1, Math.ceil(length / step - 1e-6));
        const g0 = span.grow ?? 1;
        const g1 = span.growEnd ?? g0;
        const next = spans[index + 1];
        for (let i = 0; i <= count; i++) {
            const f = i / count;
            const at = span.from + length * f;
            if (i < count || !next) {
                rows.push({
                    ...makeRow(at, g0 + (g1 - g0) * f),
                    color: span.color,
                });
                continue;
            }
            const nextGrow = next.grow ?? 1;
            // Same radius: the next span's first row closes this one.
            if (nextGrow === g1) break;
            // A step. Its face is ink, and the inner edge of the step carries
            // no ink hull, or the hull would float off it as a second line.
            rows.push({ ...makeRow(at, g1), color: ink });
            rows.push({
                ...makeRow(at, Math.min(g1, nextGrow)),
                color: ink,
                outline: 0,
            });
        }
    });
    return rows;
}

/** Inserts an ink line of width `width` at the start of every span after the first. */
export function withInkLines(spans: Span[], ink: Rgb, width: number): Span[] {
    const out: Span[] = [];
    spans.forEach((span, index) => {
        if (span.to - span.from <= 1e-6) return;
        const previous = spans[index - 1];
        if (index === 0 || !previous) {
            out.push(span);
            return;
        }
        // The line sits on whichever side is proud, so it reads as the hem.
        const onPrevious =
            (previous.growEnd ?? previous.grow ?? 1) >= (span.grow ?? 1);
        if (onPrevious) {
            const last = out[out.length - 1];
            const cut = Math.max(last.from, last.to - width);
            const grow = last.growEnd ?? last.grow ?? 1;
            last.to = cut;
            out.push({ from: cut, to: span.from, color: ink, grow });
            out.push(span);
        } else {
            const cut = Math.min(span.to, span.from + width);
            out.push({ from: span.from, to: cut, color: ink, grow: span.grow });
            out.push({ ...span, from: cut });
        }
    });
    return out.filter((span) => span.to - span.from > 1e-6);
}
