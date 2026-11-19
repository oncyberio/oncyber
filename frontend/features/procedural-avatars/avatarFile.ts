import { z } from "zod";
import { cartoonLayout } from "./cartoonCast";
import {
    readCartoonFile,
    readHouseholdFile,
    shirtMarkSchema,
} from "./cartoonFile";
import families from "./families.json";
import type { Character } from "./catalog";
import type { ShirtMark } from "./shirtMark";
import type { AvatarRecipe } from "./recipes";

const scale = z.number().min(0.65).max(1.5).optional();
const swatch = z.string().regex(/^#[0-9a-f]{6}$/i);
const familyFile = z.strictObject({
    version: z.literal(1),
    name: z.string().trim().min(1).max(60),
    style: z.literal("family"),
    family: z
        .string()
        .refine((key) => Object.hasOwn(families, key), "Unknown avatar family"),
    proportions: z.strictObject({
        build: scale,
        armSpan: z.number().min(0.8).max(1.25).optional(),
        crownProfile: z
            .array(z.number().min(0.5).max(1.5))
            .length(8)
            .optional(),
        crownLength: z.number().min(0.45).max(1.65).optional(),
        legLength: scale,
        headWidth: scale,
        headHeight: scale,
        jaw: scale,
        eyes: scale,
        depth: scale,
    }),
    crownOutline: z
        .array(z.tuple([z.number().min(-4).max(4), z.number().min(-4).max(4)]))
        .min(8)
        .max(80)
        .optional(),
    kitFit: z
        .strictObject({
            collar: z.number().min(-0.045).max(0.045),
            shoulders: z.number().min(-0.045).max(0.045),
            waist: z.number().min(-0.045).max(0.045),
            hem: z.number().min(-0.045).max(0.045),
            sock: z.number().min(-0.045).max(0.045),
            width: z.number().min(0.78).max(1.25),
        })
        .optional(),
    visor: z
        .strictObject({
            center: z.number().min(-0.13).max(0.13),
            span: z.number().min(0.65).max(1.15),
            rows: z
                .array(
                    z
                        .tuple([
                            z.number().min(-0.8).max(0.82),
                            z.number().min(-0.8).max(0.82),
                        ])
                        .refine(([a, b]) => b - a >= 0.13)
                )
                .length(17),
            marks: z
                .array(
                    z.tuple([
                        z.number().min(-0.87).max(0.87),
                        z.number().min(-0.5).max(0.5),
                        z.number().min(0.07).max(0.28),
                        z.number().min(0.07).max(0.28),
                    ])
                )
                .length(2)
                .refine(
                    (marks) =>
                        marks.length === 2 && marks[0][0] < 0 && marks[1][0] > 0
                ),
        })
        .optional(),
    orbPaint: z.strictObject({ top: swatch, bottom: swatch }).optional(),
    limbWidth: z
        .strictObject({
            arms: z.number().min(0.72).max(1.4),
            legs: z.number().min(0.72).max(1.4),
        })
        .optional(),
    sleeveCut: z
        .strictObject({
            radius: z.number().min(0.72).max(1.32),
            lift: z.number().min(-5).max(5),
        })
        .optional(),
    coatPanels: z
        .strictObject({
            opening: z.array(z.number().min(0.24).max(0.9)).length(7),
            lining: swatch,
        })
        .optional(),
    coatFit: z
        .strictObject({
            hem: z.number().min(0.85).max(1.18),
            widths: z.array(z.number().min(0.75).max(1.35)).length(4),
        })
        .optional(),
    orbOffset: z
        .tuple([
            z.number().min(-0.35).max(0.35),
            z.number().min(-0.35).max(0.35),
        ])
        .optional(),
    sunRays: z
        .array(
            z
                .array(
                    z.tuple([
                        z.number().min(-2.8).max(2.8),
                        z.number().min(-2.8).max(2.8),
                    ])
                )
                .length(3)
        )
        .min(5)
        .max(24)
        .optional(),
    lapels: z
        .strictObject({
            color: swatch,
            paths: z
                .array(
                    z
                        .array(
                            z.tuple([
                                z.number().min(-1).max(1),
                                z.number().min(0).max(0.65),
                            ])
                        )
                        .min(3)
                        .max(18)
                )
                .length(2),
        })
        .optional(),
    penOutline: z.boolean().optional(),
    eyeInk: swatch.optional(),
    eyeShape: z
        .strictObject({
            width: z.number().min(0.7).max(1.5),
            height: z.number().min(0.7).max(1.5),
            lift: z.number().min(-0.55).max(0.55),
            pupil: z.number().min(0.65).max(2.2),
        })
        .optional(),
    shirtMark: shirtMarkSchema
        .extend({
            outline: z
                .array(
                    z.tuple([
                        z.number().min(-0.5).max(1.5),
                        z.number().min(-0.5).max(1.5),
                    ])
                )
                .min(3)
                .max(32),
        })
        .optional(),
    paints: z.record(z.string().max(16), swatch),
});

const channel = (color: string, k: number) =>
    parseInt(color.slice(k, k + 2), 16);

/** Preserve related swatches such as Rick's hands and Sunshine's fabric folds. */
function shade(base: string, source: string, target: string) {
    if (source === base) return target;
    return (
        "#" +
        [1, 3, 5]
            .map((k) =>
                Math.max(
                    0,
                    Math.min(
                        255,
                        channel(target, k) +
                            channel(source, k) -
                            channel(base, k)
                    )
                )
                    .toString(16)
                    .padStart(2, "0")
            )
            .join("")
    );
}

export function readAvatarFile(input: unknown): {
    name: string;
    recipe: AvatarRecipe;
} {
    if (
        input &&
        typeof input === "object" &&
        "style" in input &&
        input.style === "family"
    ) {
        if ("construction" in input && input.construction === "household") {
            const { name, design } = readHouseholdFile(input);
            return {
                name,
                recipe: {
                    template: "rick-classic",
                    cartoon: design,
                    layout: cartoonLayout(design),
                },
            };
        }
        const file = familyFile.parse(input);
        const family = families[file.family as keyof typeof families];
        if (file.shirtMark && !family.plainShirt)
            throw new Error("This family uses its printed jersey");
        if (
            file.proportions.eyes !== undefined &&
            family.template === "sunshine"
        )
            throw new Error("The visor is attached to the mascot orb");
        if (file.crownOutline) {
            if (family.template !== "rick-classic")
                throw new Error("This family has no fitted hair sections");
            const angles = file.crownOutline.map(([x, y]) => Math.atan2(y, x));
            let wraps = 0;
            for (let i = 0; i < angles.length; i++) {
                const delta = angles[(i + 1) % angles.length] - angles[i];
                if (delta < 0) wraps++;
                const arc = (delta + 2 * Math.PI) % (2 * Math.PI);
                if (
                    arc < 0.0001 ||
                    arc > Math.PI / 2 ||
                    Math.hypot(...(file.crownOutline[i] as [number, number])) <
                        0.15
                )
                    throw new Error(
                        "Invalid angular spacing in the fitted hair outline"
                    );
            }
            if (wraps !== 1)
                throw new Error("Hair outline must make one clockwise turn");
        }
        if (file.penOutline !== undefined && family.template !== "rick-classic")
            throw new Error("Only the illustrated scientist has contour ink");
        if (
            (file.eyeShape || file.eyeInk) &&
            family.template !== "rick-classic"
        )
            throw new Error("This family has no separate eye globes");
        if (
            (file.coatFit ||
                file.lapels ||
                file.coatPanels ||
                file.sleeveCut) &&
            family.template !== "rick-classic"
        )
            throw new Error("This family has no lab coat");
        if (
            (file.orbOffset || file.kitFit || file.orbPaint || file.visor) &&
            family.template !== "sunshine"
        )
            throw new Error("Only the mascot has a floating head");
        if (
            file.sunRays &&
            (family.template !== "sunshine" ||
                file.sunRays.some((tri) => {
                    const [a, b, c] = tri;
                    return (
                        Math.abs(
                            (b[0] - a[0]) * (c[1] - a[1]) -
                                (b[1] - a[1]) * (c[0] - a[0])
                        ) < 0.001 ||
                        tri.some(
                            ([x, y]) =>
                                Math.hypot(x, y) < 0.92 ||
                                Math.hypot(x, y) > 2.8
                        )
                    );
                }))
        )
            throw new Error(
                "Sun rays require distinct triangle corners outside the mascot orb"
            );
        const roles: Record<string, string[]> = family.paints;
        const palette: Record<string, string> = {};
        for (const [key, target] of Object.entries(file.paints)) {
            if (!Object.hasOwn(roles, key))
                throw new Error("Unknown family paint " + key);
            const sources = roles[key];
            for (const source of sources)
                palette[source] = shade(sources[0], source, target);
        }
        if (file.orbPaint) {
            palette["#ff2e90"] = file.orbPaint.top;
            palette["#c21b59"] = file.orbPaint.bottom;
        }
        return {
            name: file.name,
            recipe: {
                template: family.template as Character,
                ...file.proportions,
                palette,
                ...(file.kitFit && {
                    kitFit: file.kitFit as AvatarRecipe["kitFit"],
                }),
                ...(file.visor && {
                    visor: file.visor as AvatarRecipe["visor"],
                }),
                ...(file.orbPaint && {
                    orbPaint: file.orbPaint as AvatarRecipe["orbPaint"],
                }),
                ...(file.limbWidth && {
                    limbWidth: file.limbWidth as AvatarRecipe["limbWidth"],
                }),
                ...(file.sleeveCut && { sleeveCut: file.sleeveCut }),
                ...(file.coatPanels && { coatPanels: file.coatPanels }),
                ...(file.coatFit && {
                    coatFit: file.coatFit as AvatarRecipe["coatFit"],
                }),
                ...(file.orbOffset && {
                    orbOffset: file.orbOffset as [number, number],
                }),
                ...(file.sunRays && {
                    sunRays: file.sunRays as [number, number][][],
                }),
                ...(file.lapels && {
                    lapels: file.lapels as AvatarRecipe["lapels"],
                }),
                ...(file.penOutline && { penOutline: true }),
                ...(file.eyeInk && { eyeInk: file.eyeInk }),
                ...(file.eyeShape && {
                    eyeShape: file.eyeShape as AvatarRecipe["eyeShape"],
                }),
                ...(file.crownOutline && {
                    crownOutline: file.crownOutline as [number, number][],
                }),
                ...(file.shirtMark && {
                    shirtMark: file.shirtMark as ShirtMark,
                }),
            },
        };
    }
    const { name, design } = readCartoonFile(input);
    return {
        name,
        recipe: {
            template: "morty",
            cartoon: design,
            layout: cartoonLayout(design),
        },
    };
}
