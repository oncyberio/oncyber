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
const printOutline = z
    .array(
        z.tuple([z.number().min(-0.5).max(1.5), z.number().min(-0.5).max(1.5)])
    )
    .min(3)
    .max(32);
const familyFile = z.strictObject({
    version: z.literal(1),
    name: z.string().trim().min(1).max(60),
    style: z.literal("family"),
    plainJersey: z.literal(true).optional(),
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
        headWidth: z.number().min(0.65).max(1.8).optional(),
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
    jerseySleeve: z
        .strictObject({
            span: z.number().min(55).max(190),
            armhole: z
                .tuple([
                    z.number().min(-1.8).max(-0.3),
                    z.number().min(0.3).max(1.8),
                ])
                .optional(),
            rows: z
                .array(
                    z.tuple([
                        z.number().min(-0.55).max(-0.055),
                        z.number().min(0.055).max(0.55),
                    ])
                )
                .length(5),
            tilt: z.number().min(-0.09).max(0.09),
            bands: z
                .array(
                    z.strictObject({
                        start: z.number().min(0.68).max(1),
                        end: z.number().min(0.68).max(1),
                        color: swatch,
                    })
                )
                .max(3)
                .refine((bands) =>
                    bands.every(
                        (b, i) =>
                            b.end - b.start >= 0.009 &&
                            (i === 0 || b.start >= bands[i - 1].end)
                    )
                ),
        })
        .optional(),
    kitFootwear: z
        .strictObject({
            knit: swatch,
            bands: z
                .array(
                    z.strictObject({
                        start: z.number().min(0.07).max(0.94),
                        end: z.number().min(0.08).max(0.95),
                        color: swatch,
                    })
                )
                .max(3)
                .refine((rows) =>
                    rows.every(
                        (b, i) =>
                            b.end > b.start &&
                            (!i || b.start >= rows[i - 1].end)
                    )
                ),
            rise: z.number().min(0.1).max(0.63),
            laceInk: swatch.optional(),
            spread: z
                .tuple([
                    z.number().min(1).max(1.65),
                    z.number().min(1).max(1.85),
                ])
                .optional(),
            widths: z.array(z.number().min(0.14).max(0.85)).length(5),
            upper: swatch,
            sole: swatch,
            laces: z
                .array(z.number().min(0.08).max(0.46))
                .max(4)
                .refine((rows) => rows.every((t, i) => !i || t > rows[i - 1])),
        })
        .optional(),
    kitHand: z
        .strictObject({
            wristRadius: z.number().min(0.006).max(0.023),
            padRadius: z.number().min(0.002).max(0.022),
            light: z
                .tuple([
                    z.number().min(0.2).max(1.8),
                    z.number().min(0.2).max(1.8),
                ])
                .optional(),
            band: z
                .strictObject({
                    center: z.number().min(0.71).max(0.86),
                    width: z.number().min(0.008).max(0.062),
                    color: swatch,
                    side: z.enum(["left", "right"]).optional(),
                })
                .optional(),
        })
        .refine((h) => h.padRadius < h.wristRadius)
        .optional(),
    shortsCut: z
        .strictObject({
            rise: z.number().min(0.2).max(0.93),
            hemSpan: z.number().min(0.75).max(1.32),
        })
        .optional(),
    kitFit: z
        .strictObject({
            collar: z.number().min(-0.045).max(0.045),
            shoulders: z.number().min(-0.045).max(0.045),
            waist: z.number().min(-0.045).max(0.045),
            hem: z.number().min(-0.045).max(0.045),
            sock: z.number().min(-0.045).max(0.045),
            width: z.number().min(0.78).max(1.25),
            chestWidth: z.number().min(0.7).max(1.3).optional(),
        })
        .optional(),
    visor: z
        .strictObject({
            strap: z.literal(false).optional(),
            rim: z
                .strictObject({
                    columns: z
                        .array(
                            z.tuple([
                                z.number().min(-1.11).max(1.11),
                                z.number().min(-0.8).max(0.8),
                                z.number().min(-0.8).max(0.8),
                            ])
                        )
                        .min(4)
                        .max(36)
                        .refine((rows) =>
                            rows.every(
                                ([x, t, b], i) =>
                                    b > t && (!i || x > rows[i - 1][0])
                            )
                        ),
                    upper: swatch,
                    lower: swatch,
                    glyph: swatch,
                })
                .optional(),
            contact: z
                .strictObject({
                    strength: z.number().min(0.2).max(0.92),
                    width: z.number().min(0.075).max(0.26),
                })
                .optional(),
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
    orbPaint: z
        .strictObject({
            top: swatch,
            bottom: swatch,
            light: z
                .tuple([
                    z.number().min(-2).max(2),
                    z.number().min(-2).max(2),
                    z.number().min(-2).max(2),
                ])
                .optional(),
        })
        .optional(),
    orbCollar: z
        .strictObject({
            radius: z.number().min(0.16).max(0.43),
            drop: z.number().min(0.04).max(0.24),
            band: z.number().min(0.02).max(0.12),
            skin: swatch,
            binding: swatch,
        })
        .optional(),
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
    orbScale: z.number().min(1).max(1.5).optional(),
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
                .min(3)
                .max(6)
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
            outline: printOutline,
            islands: z.array(printOutline).min(1).max(4).optional(),
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
        if (family.template !== "sunshine" && file.proportions.headWidth > 1.5)
            throw new Error(
                "Household and scientist head widths must be at most 1.5"
            );
        if (file.plainJersey && family.template !== "sunshine")
            throw new Error("A plain jersey requires the Sunshine kit");
        if (file.shirtMark && !family.plainShirt && !file.plainJersey)
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
            (file.orbScale ||
                file.orbOffset ||
                file.kitFit ||
                file.kitHand ||
                file.kitFootwear ||
                file.shortsCut ||
                file.jerseySleeve ||
                file.orbPaint ||
                file.visor ||
                file.orbCollar) &&
            family.template !== "sunshine"
        )
            throw new Error("Only the mascot has a floating head");
        if (
            file.sunRays &&
            (family.template !== "sunshine" ||
                file.sunRays.some((rim) => {
                    const sides = rim.flatMap(([ax, ay], i) => {
                        const next = (i + 1) % rim.length;
                        const [bx, by] = rim[next];
                        return rim.flatMap(([x, y], j) =>
                            i === j || next === j
                                ? []
                                : [(bx - ax) * (y - ay) - (by - ay) * (x - ax)]
                        );
                    });
                    return (
                        !(
                            sides.every((v) => v >= 0.00001) ||
                            sides.every((v) => v <= -0.00001)
                        ) ||
                        Math.max(...sides.map(Math.abs)) < 0.001 ||
                        rim.some(
                            ([x, y]) =>
                                Math.hypot(x, y) < 0.92 ||
                                Math.hypot(x, y) > 2.8
                        )
                    );
                }))
        )
            throw new Error(
                "Sun rays require a convex outline outside the mascot orb"
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
                ...(file.kitHand && {
                    kitHand: file.kitHand as AvatarRecipe["kitHand"],
                }),
                ...(file.kitFootwear && {
                    kitFootwear:
                        file.kitFootwear as AvatarRecipe["kitFootwear"],
                }),
                ...(file.jerseySleeve && {
                    jerseySleeve:
                        file.jerseySleeve as AvatarRecipe["jerseySleeve"],
                }),
                ...(file.shortsCut && {
                    shortsCut: file.shortsCut as AvatarRecipe["shortsCut"],
                }),
                ...(file.kitFit && {
                    kitFit: file.kitFit as AvatarRecipe["kitFit"],
                }),
                ...(file.visor && {
                    visor: file.visor as AvatarRecipe["visor"],
                }),
                ...(file.orbPaint && {
                    orbPaint: file.orbPaint as AvatarRecipe["orbPaint"],
                }),
                ...(file.orbCollar && {
                    orbCollar: file.orbCollar as AvatarRecipe["orbCollar"],
                }),
                ...(file.limbWidth && {
                    limbWidth: file.limbWidth as AvatarRecipe["limbWidth"],
                }),
                ...(file.sleeveCut && { sleeveCut: file.sleeveCut }),
                ...(file.coatPanels && { coatPanels: file.coatPanels }),
                ...(file.coatFit && {
                    coatFit: file.coatFit as AvatarRecipe["coatFit"],
                }),
                ...(file.orbScale && { orbScale: file.orbScale }),
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
                ...(file.plainJersey && { plainJersey: true }),
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
