import { z } from "zod";
import type { ReferenceLayout } from "./referenceProportions";
import type { Point } from "./sculpt";

const measure = z.number().finite().min(-1100).max(1100);
const xy = z.tuple([measure, measure]);
const paint = z.string().regex(/^#[\da-f]{6}$/i);
const near = (low: number, high: number) =>
    z.number().finite().min(low).max(high);
const positive = z.number().positive().max(600);
const shirtRing = z.tuple([measure, positive, positive, positive]);
const jeanRing = z.tuple([
    measure,
    measure,
    positive,
    positive,
    positive,
    measure,
]);
const ordered = (rows: number[][]) =>
    rows.every((r, i) => !i || r[0] > rows[i - 1][0]);
const fabricInk = z
    .array(
        z
            .array(measure)
            .length(16)
            .refine(
                (r) =>
                    r[2] > r[1] && r.slice(3).every((v) => v >= 32 && v <= 224)
            )
    )
    .min(2)
    .max(64)
    .refine(ordered);

/** A registered front and profile use the same standing height and depth units.
 * Only the sparse print outlines and garment stations reach the renderer. */
export const streetwearFile = z.strictObject({
    version: z.literal(1),
    style: z.literal("streetwear"),
    name: z.string().min(1).max(64),
    colors: z.strictObject({
        skin: paint,
        hair: paint,
        iris: paint,
        denim: paint,
        tee: paint,
        under: paint,
        shoe: paint,
    }),
    shirt: z
        .array(shirtRing)
        .min(4)
        .max(24)
        .refine(ordered)
        .refine((r) => r[0][0] <= 231 && r.at(-1)[0] >= 440),
    jeans: z
        .array(jeanRing)
        .min(6)
        .max(32)
        .refine(ordered)
        .refine(
            (rows) =>
                rows[0][0] < 633 &&
                rows[0][0] > 500 &&
                rows.at(-1)[0] > 930 &&
                rows.every((r) => r[1] >= 0 && r[2] > r[1])
        ),
    print: z
        .array(z.strictObject({ paint, edge: z.array(xy).min(3).max(96) }))
        .max(160),
    cuffs: z.strictObject({
        rightLeg: z.array(xy).min(4).max(64).refine(ordered),
        leftLeg: z.array(xy).min(4).max(64).refine(ordered),
    }),
    creases: z.strictObject({
        rightLeg: z.array(z.array(xy).min(3).max(32)).max(12),
        leftLeg: z.array(z.array(xy).min(3).max(32)).max(12),
    }),
    panels: z.strictObject({
        tee: fabricInk,
        rightLeg: fabricInk,
        leftLeg: fabricInk,
    }),
    arm: z
        .strictObject({
            shoulder: positive,
            elbow: positive,
            wrist: positive,
            height: positive,
            cuff: positive,
            hem: positive,
        })
        .refine(
            (v) =>
                v.shoulder < v.elbow &&
                v.elbow < v.wrist &&
                v.shoulder < v.cuff &&
                v.cuff < v.wrist &&
                v.hem > v.height
        ),
    head: z
        .strictObject({
            width: near(42, 57),
            chin: near(178, 197),
            eyeLine: near(125, 138),
            eyeGap: near(35, 51),
            depth: near(43, 64),
        })
        .refine((v) => v.chin > v.eyeLine && v.eyeGap < 2 * v.width),
    hair: z.strictObject({
        spikes: z
            .array(
                z.tuple([
                    measure,
                    measure,
                    measure,
                    measure,
                    measure,
                    measure,
                    positive,
                ])
            )
            .min(3)
            .max(18),
        fringe: z
            .array(xy)
            .min(5)
            .max(45)
            .refine((v) => v.every((p, i) => !i || p[0] > v[i - 1][0])),
        nape: near(337, 450),
    }),
    belt: z.strictObject({
        height: near(521, 567),
        slope: near(-0.25, 0.25),
        width: near(24, 39),
    }),
    shoe: z.strictObject({
        center: positive,
        width: positive,
        toe: positive,
        heel: positive,
    }),
});
export type StreetPattern = z.infer<typeof streetwearFile>;
/** Carry the calibrated highlight/ink ratio onto a new recipe's swatch.
 * The authoring photo supplies the reference dye for each material. */
export function streetShade(dye: string, reference: string, accent: string) {
    if (dye === reference) return accent;
    let hex = "#";
    for (const offset of [1, 3, 5]) {
        const channel = (paint: string) =>
            parseInt(paint.slice(offset, offset + 2), 16);
        const value =
            (channel(dye) * channel(accent)) / Math.max(1, channel(reference));
        hex += Math.min(255, Math.round(value)).toString(16).padStart(2, "0");
    }
    return hex;
}
export const sheetScale = 0.68;
export function streetLayout(p: StreetPattern): ReferenceLayout {
    const point = (x: number, y: number, z: number): Point => [
        350 + sheetScale * x,
        y * sheetScale,
        z * sheetScale,
    ];
    const signs = [-1, 1],
        a = p.arm,
        hip = p.belt.height + 23;
    return {
        origin: { x: 350, floor: 1008 * sheetScale },
        eyeLine: p.head.eyeLine * sheetScale,
        landmarks: {
            hip: point(0, hip, 0),
            neck: point(0, 206, 0),
            jaw: point(0, p.head.chin, 8),
            headYaw: 0,
            torsoYaw: 0,
            arms: signs.map((s) => [
                point(s * a.shoulder, a.height, 0),
                point(s * a.elbow, a.height + 1, 1),
                point(s * a.wrist, a.height + 3, 2),
            ]) as ReferenceLayout["landmarks"]["arms"],
            legs: signs.map((s) => [
                point(s * 61, hip + 9, 0),
                point(s * 82, 771, 5),
                point(s * p.shoe.center, 959, -7),
            ]) as ReferenceLayout["landmarks"]["legs"],
            feet: signs.map((s) =>
                point(s * p.shoe.center, 994, p.shoe.toe - 12)
            ) as [Point, Point],
            fingers: [
                [-1, 0, 0],
                [1, 0, 0],
            ],
            grip: [false, false],
            handScale: 1.83,
            palmRoll: 9,
        },
    };
}
