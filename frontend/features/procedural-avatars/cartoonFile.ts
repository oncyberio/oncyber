import { z } from "zod";
import type { CartoonDesign } from "./cartoonCast";
import { prepareHousehold } from "./householdBody";

const n = (min: number, max: number) => z.number().min(min).max(max);
const crownEdge = z
    .array(z.tuple([n(-0.78, 0.78), n(0, 0.445)]))
    .min(3)
    .max(15);
const fraction = n(0, 1);
const paint = z.string().regex(/^#[\da-f]{6}$/i);
export const shirtMarkSchema = z.strictObject({
    color: paint,
    outline: z
        .array(z.tuple([fraction, fraction]))
        .min(3)
        .max(32),
});
const openHand = z
    .array(
        z.union([
            z.tuple([n(0, 140), n(-140, 140), n(0, 190), n(-190, 190)]),
            z.tuple([
                n(0, 140),
                n(-140, 140),
                n(0, 190),
                n(-190, 190),
                n(0.2, 30),
            ]),
        ])
    )
    .length(5)
    .refine((rows) => rows.every(([root, , tip]) => root < tip))
    .nullable();
const palmContour = z
    .array(z.tuple([n(0, 140), n(-140, 140), n(-140, 140)]))
    .length(5)
    .refine((rows) =>
        rows.every(
            ([x, top, bottom], i) =>
                top < bottom && (i === 0 ? x === 0 : x > rows[i - 1][0])
        )
    )
    .nullable();
const band = z.strictObject({
    start: fraction,
    end: fraction,
    color: paint,
    bend: n(-0.22, 0.22).optional(),
});
const pair = z.tuple([n(0, 950), n(1, 150)]);
const transverse = z.tuple([n(0, 950), n(0, 950), n(0.2, 150)]);
const ordered = <S extends z.ZodType<[number?, ...unknown[]]>>(
    schema: S,
    limit = 32
) =>
    z
        .array(schema)
        .min(3)
        .max(limit)
        .refine(
            (rows) => rows.every((r, i) => i === 0 || r[0] > rows[i - 1][0]),
            "Sections must be ordered along the limb"
        );
const seams = z
    .array(
        z.strictObject({
            points: z
                .array(z.tuple([n(-350, 350), n(0, 950)]))
                .min(3)
                .max(16),
            radius: n(0.3, 1.6),
            color: paint,
        })
    )
    .max(6);
const fit = z.strictObject({
    triangleBudget: z.number().int().positive().optional(),
    sections: z
        .strictObject({
            cranium: ordered(
                z
                    .tuple([
                        n(0, 360),
                        n(-300, 300),
                        n(-300, 300),
                        n(0, 300),
                        n(-300, 300),
                        n(0.02, 0.98),
                        n(1, 5),
                    ])
                    .refine(
                        (r) => r[1] <= r[2],
                        "The cranium must enclose its midline"
                    )
            ).optional(),
            coat: z
                .strictObject({
                    color: paint,
                    sleeves: paint,
                    rows: ordered(
                        z
                            .tuple([
                                n(0, 900),
                                n(-350, 0),
                                n(-350, 0),
                                n(0, 350),
                                n(0, 350),
                            ])
                            .refine(
                                ([, left, a, b, right]) =>
                                    left < a && b < right,
                                "Coat edges must enclose the opening"
                            )
                    ),
                })
                .optional(),
            seams: z
                .strictObject({
                    shirt: seams.optional(),
                    trousers: seams.optional(),
                })
                .optional(),
            hemRise: n(0, 75).optional(),
            shirtCut: z
                .strictObject({
                    station: n(5, 195),
                    shoulderTop: n(15, 500),
                    wings: z
                        .array(
                            z
                                .array(z.tuple([n(-100, 100), n(15, 530)]))
                                .length(5)
                        )
                        .length(2)
                        .optional(),
                    centers: z.array(n(-42, 42)).min(2).max(64),
                    opening: ordered(
                        z.tuple([n(15, 530), n(-55, 48), n(-48, 55)])
                    )
                        .refine(
                            (rows) =>
                                rows.length === 7 &&
                                rows.every(([, l, r], i) =>
                                    i === 6 ? l === r : l < r
                                )
                        )
                        .optional(),
                })
                .optional(),
            garmentEdges: z
                .strictObject({
                    frontHem: z.array(n(-0.24, 0.24)).length(25).optional(),
                    rolledCuff: n(0.5, 90).optional(),
                })
                .optional(),
            leftReach: n(0.65, 1.45).optional(),
            pelvisX: n(-42, 42).optional(),
            creases: z
                .array(
                    z.strictObject({
                        points: ordered(z.tuple([n(-200, 200), n(0, 400)])),
                        radius: n(0.3, 1.6),
                        color: paint,
                    })
                )
                .max(5)
                .optional(),
            foreheadLock: ordered(
                z.tuple([n(0, 600), n(-200, 200), n(-200, 200)]),
                16
            )
                .refine((rows) => rows.every(([, a, b]) => a < b))
                .optional(),
            shirtMark: shirtMarkSchema
                .extend({
                    box: z
                        .tuple([
                            n(-400, 400),
                            n(0, 950),
                            n(-400, 400),
                            n(0, 950),
                        ])
                        .refine(([x0, y0, x1, y1]) => x0 < x1 && y0 < y1),
                })
                .optional(),
            crew: z
                .strictObject({
                    center: n(-90, 90),
                    top: n(0, 600),
                    radius: n(0.5, 100),
                    drop: n(0.1, 120),
                    binding: n(0.05, 60),
                    ink: paint.optional(),
                })
                .optional(),
            nose: z
                .strictObject({
                    stroke: z
                        .array(z.tuple([n(-200, 200), n(0, 400)]))
                        .min(6)
                        .max(20),
                    radius: n(0.32, 1.8),
                    ink: paint,
                })
                .optional(),
            openMouth: z
                .strictObject({
                    rows: ordered(
                        z.tuple([
                            n(-200, 200),
                            n(0, 400),
                            n(0, 400),
                            n(0, 400),
                            n(0, 400),
                            n(0, 400),
                        ]),
                        48
                    ).refine(
                        (rows) =>
                            rows.every(
                                ([, top, upper, tongue, lower, bottom]) =>
                                    top <= upper &&
                                    upper <= tongue &&
                                    tongue <= lower &&
                                    lower <= bottom
                            ),
                        "The cavity and teeth must meet in vertical order"
                    ),
                    interior: paint,
                    teeth: paint,
                    tongue: paint.optional(),
                })
                .optional(),
            mouth: z
                .strictObject({
                    expression: z.enum([
                        "smile",
                        "uncertain",
                        "neutral",
                        "lips",
                    ]),
                    rows: ordered(
                        z.tuple([n(-200, 200), n(0, 400), n(0, 400), n(0, 400)])
                    ).refine(
                        (rows) =>
                            rows.every(
                                ([, middle, top, bottom]) =>
                                    top <= middle && middle <= bottom
                            ),
                        "Lip contours must enclose their seam"
                    ),
                    ink: paint,
                    radius: n(0.3, 2.3),
                    color: paint.optional(),
                })
                .optional(),
            eyes: z
                .array(
                    z.strictObject({
                        rim: z
                            .array(z.tuple([n(-200, 200), n(0, 400)]))
                            .min(8)
                            .max(32),
                        lid: ordered(
                            z.tuple([n(-200, 200), n(0, 400)])
                        ).optional(),
                        brow: z
                            .array(z.tuple([n(-200, 200), n(0, 400)]))
                            .min(3)
                            .max(18)
                            .optional(),
                        browWidth: n(0.3, 3).optional(),
                        rimInk: z
                            .strictObject({ width: n(0.2, 5), color: paint })
                            .optional(),
                        browRim: z
                            .array(z.tuple([n(-200, 200), n(0, 400)]))
                            .min(6)
                            .max(24)
                            .optional(),
                        browColor: paint.optional(),
                        browOccluded: z.boolean().optional(),
                        pupil: z.tuple([n(-200, 200), n(0, 400), n(0.2, 8)]),
                    })
                )
                .length(2)
                .optional(),
            sideGuide: z
                .strictObject({
                    rows: ordered(
                        z.tuple([
                            fraction,
                            n(-400, 400),
                            n(-400, 400),
                            n(-400, 400),
                        ])
                    ).refine((rows) =>
                        rows.every(([, back, edge]) => back <= edge)
                    ),
                    noseRise: n(0, 100),
                    frontalNoseInk: z.boolean().optional(),
                    noseProfile: ordered(
                        z.tuple([fraction, n(0, 100)])
                    ).optional(),
                    eyeSpan: n(0, 175).optional(),
                    eyeCenter: n(-350, 350).optional(),
                    pupilDepth: n(-350, 350).optional(),
                    lidSpan: z
                        .tuple([n(-400, 400), n(-400, 400)])
                        .refine(([a, b]) => a < b)
                        .optional(),
                    eyeRows: ordered(
                        z.tuple([fraction, n(-400, 400), n(-400, 400)])
                    )
                        .refine((rows) =>
                            rows.every(([, back, front]) => back <= front)
                        )
                        .optional(),
                    mouthProfile: ordered(
                        z.tuple([n(-400, 400), n(0, 600)])
                    ).optional(),
                    mouthTick: z.tuple([n(-100, 0), n(0, 100)]).optional(),
                    templeEdge: z
                        .object({
                            side: z.union([z.literal(1), z.literal(-1)]),
                            roll: ordered(
                                z
                                    .tuple([
                                        fraction,
                                        n(-400, 400),
                                        n(-400, 400),
                                    ])
                                    .refine(
                                        (r) => r[2] >= r[1],
                                        "The hair must enclose its inner edge"
                                    )
                            ).optional(),
                            rows: ordered(z.tuple([fraction, n(-400, 400)])),
                        })
                        .strict()
                        .optional(),
                    browProfile: ordered(
                        z.tuple([n(-400, 400), n(0, 600)])
                    ).optional(),
                    chinFloor: ordered(
                        z.tuple([n(-400, 400), n(0, 600)])
                    ).optional(),
                    jawEdge: ordered(
                        z.union([
                            z.tuple([fraction, n(-400, 400)]),
                            z.tuple([fraction, n(-400, 400), n(-400, 400)]),
                        ])
                    ).optional(),
                    turnedEar: n(-400, 400).optional(),
                    turnedNose: z
                        .array(z.tuple([n(-300, 300), n(0, 400)]))
                        .min(3)
                        .max(32)
                        .optional(),
                    turnedMouth: ordered(
                        z.tuple([n(-400, 400), n(0, 600)])
                    ).optional(),
                    mouthCorner: z.tuple([n(-400, 400), n(0, 600)]).optional(),
                    turnedPupils: z.tuple([fraction, fraction]).optional(),
                    forelockSide: z
                        .union([z.literal(-1), z.literal(1)])
                        .optional(),
                    turnedCrown: ordered(
                        z.tuple([fraction, n(-400, 400), n(-400, 400)])
                    )
                        .refine((rows) =>
                            rows.every(([, left, right]) => left <= right)
                        )
                        .optional(),
                    turnedBack: ordered(
                        z.tuple([fraction, n(-400, 400)])
                    ).optional(),
                    turnedHair: ordered(
                        z.tuple([fraction, n(-400, 400)])
                    ).optional(),
                    hem: ordered(z.tuple([n(-400, 400), n(0, 600)])).optional(),
                    ear: z
                        .tuple([
                            n(-400, 400),
                            n(0, 600),
                            n(0.01, 200),
                            n(0.01, 200),
                        ])
                        .optional(),
                    locks: z
                        .array(
                            z
                                .array(z.tuple([n(-400, 400), n(-100, 600)]))
                                .min(3)
                                .max(16)
                        )
                        .max(4)
                        .optional(),
                })
                .optional(),
            ears: z
                .array(
                    z.tuple([n(-200, 200), n(0, 400), n(0.3, 65), n(0.3, 85)])
                )
                .max(2)
                .refine(
                    (ears) =>
                        ears.length < 2 ||
                        Math.sign(ears[0][0]) !== Math.sign(ears[1][0]),
                    "Expected at most one ear on each side"
                )
                .optional(),
            outsole: z
                .strictObject({
                    ink: paint.optional(),
                    laces: seams.optional(),
                    collar: z
                        .strictObject({
                            tops: z.array(n(0, 950)).min(3).max(32),
                            color: paint,
                        })
                        .optional(),
                    rows: ordered(
                        z.tuple([n(-100, 300), n(0, 950), n(0, 950), n(0, 950)])
                    ).refine((rows) =>
                        rows.every(
                            ([, top, seam, base]) => top <= seam && seam <= base
                        )
                    ),
                    color: paint,
                })
                .refine(
                    ({ collar, rows }) =>
                        !collar ||
                        (collar.tops.length === rows.length &&
                            collar.tops.every((y, i) => y <= rows[i][1]))
                )
                .optional(),
            nape: ordered(z.tuple([n(-350, 350), n(-100, 500)])).optional(),
            chin: ordered(z.tuple([n(-200, 200), n(0, 400)])).optional(),
            locks: z
                .array(
                    z
                        .array(z.tuple([n(-350, 350), n(-100, 500)]))
                        .min(3)
                        .max(16)
                )
                .max(4)
                .optional(),
            sidePart: z
                .tuple([n(-350, 350), n(0, 400), n(0.05, 80)])
                .optional(),
            radialCrown: z
                .strictObject({
                    center: z.tuple([n(-350, 350), n(-200, 400)]),
                    rim: z
                        .array(z.tuple([n(-350, 350), n(-200, 400)]))
                        .min(8)
                        .max(180),
                })
                .optional(),
            crown: z
                .strictObject({
                    base: z.number().int().min(2).max(30),
                    rim: ordered(z.tuple([n(-350, 350), n(-100, 400)])),
                })
                .optional(),
            jaw: ordered(
                z.tuple([n(0, 400), n(-150, 0), n(0, 150)])
            ).optional(),
            hair: ordered(
                z
                    .tuple([
                        n(-100, 600),
                        n(-350, 350),
                        n(-350, 350),
                        n(-350, 350),
                        n(-350, 350),
                    ])
                    .refine(
                        ([_, left, right, openingLeft, openingRight]) =>
                            left < right &&
                            left <= openingLeft &&
                            openingLeft <= openingRight &&
                            openingRight <= right,
                        "Hair opening must lie within the silhouette"
                    )
            ).optional(),
            torso: ordered(pair),
            pelvis: ordered(pair),
            arm: ordered(transverse),
            leg: ordered(transverse),
            shoe: ordered(transverse),
            ankle: ordered(transverse).optional(),
            sleeve: n(0, 450),
            openHands: z.tuple([openHand, openHand]).optional(),
            palmContours: z.tuple([palmContour, palmContour]).optional(),
            handScale: n(0.65, 2.4),
        })
        .optional(),
    neckline: n(30, 540),
    hem: n(80, 800),
    shoulder: n(12, 120),
    waist: n(10, 120),
    armLength: n(45, 430),
    armRadius: n(2, 36),
    legRadius: n(3, 55),
    hipOffset: n(4, 85),
    cuffHeight: n(8, 85),
    sleeveFraction: n(0.15, 0.97),
    hairWidth: n(0.65, 2.6),
    hairLength: n(0.45, 2),
});

/** A sewn shoulder must meet a real sleeve ring and the corresponding torso sections. */
function validShirtCut(
    sections: Pick<
        z.infer<typeof fit>["sections"],
        "shirtCut" | "torso" | "arm" | "sleeve"
    >
) {
    const cut = sections?.shirtCut;
    if (!cut) return true;
    const socket = sections.arm.find(
        ([x]) => x === cut.station && x <= sections.sleeve
    );
    return (
        !!socket &&
        cut.centers.length === sections.torso.length &&
        Math.abs(cut.shoulderTop - (socket[1] - socket[2])) <= socket[2] &&
        (!cut.wings || !!cut.opening)
    );
}
const shirtCutError =
    "A fitted shirt must join its sleeve and torso, with collar wings attached to an opening.";

const partSource = z.enum(["classic", "sunshine"]);
const design = z
    .strictObject({
        height: n(300, 950),
        stance: z.enum(["relaxed", "guarded", "hip", "open"]),
        build: z.enum(["child", "lean", "regular", "broad"]),
        skull: z.enum(["round", "oval", "long", "square"]),
        head: z.tuple([n(35, 260), n(45, 300)]),
        skin: paint,
        eyes: z.enum(["wide", "relaxed", "half-lidded"]),
        pupil: z
            .strictObject({
                height: n(-0.68, 0.68),
                radius: n(0.06, 0.24),
                aspect: n(0.65, 1.5),
            })
            .optional(),
        gaze: n(-0.7, 0.7),
        brow: z.enum(["worried", "level", "arched", "knit"]),
        nose: z.enum(["button", "straight", "hooked"]),
        mouth: z.enum(["uncertain", "smile", "neutral", "speaking", "lips"]),
        hair: z.strictObject({
            cut: z.enum([
                "crop",
                "waves",
                "bob",
                "part",
                "ponytail",
                "bun",
                "curls",
                "quiff",
                "spikes",
            ]),
            color: paint,
            fall: fraction.optional(),
            fringeDepthScale: n(0.75, 1.2).optional(),
        }),
        outfit: z
            .strictObject({
                top: z.enum(["crew", "polo", "tank", "cardigan"]),
                color: paint,
                trim: paint,
                trousers: paint,
                shoes: paint,
                footwear: z.enum(["sneaker", "flat", "boot"]).optional(),
                bands: z.array(band).max(3).optional(),
                placketDepth: n(0.1, 0.4).optional(),
                placketEnd: n(0.1, 1).optional(),
                buttonColor: paint.optional(),
                buttons: z
                    .array(n(0.1, 0.96))
                    .min(1)
                    .max(6)
                    .refine(
                        (positions) =>
                            positions.every(
                                (p, i) => !i || p - positions[i - 1] >= 0.035
                            ),
                        "Shirt buttons must run from the collar to the hem"
                    )
                    .optional(),
            })
            .refine(
                (o) => !o.buttons || o.top === "polo",
                "Shirt buttons require a collared shirt"
            )
            .refine(
                (o) =>
                    (!o.buttonColor || !!o.buttons) &&
                    (o.placketEnd === undefined ||
                        (!!o.buttons && o.placketEnd >= o.buttons.at(-1))) &&
                    (o.placketDepth === undefined || o.top === "polo"),
                "Measured fastener paint and opening depth require the matching garment"
            ),
        parts: z
            .strictObject({
                skull: partSource.optional(),
                jaw: partSource.optional(),
                legs: partSource.optional(),
                feet: partSource.optional(),
                hands: partSource.optional(),
                palmRoll: n(-90, 90).optional(),
                handPitch: n(-30, 30).optional(),
            })
            .optional(),
        face: z.strictObject({
            eyeAspect: n(0.52, 1.18).optional(),
            eyeDepthScale: n(0.7, 1.4).optional(),
            eyeHeight: n(0.2, 0.65),
            eyeRadius: n(0.085, 0.24),
            eyeSpacing: n(0.12, 0.33),
            noseBase: n(0.42, 0.84),
            mouthHeight: n(0.55, 0.92),
            mouthWidth: n(0.075, 0.33),
            chinTaper: n(0, 0.28),
            jawWidth: n(0.75, 1.35).optional(),
            noseWidth: n(0.75, 1.5).optional(),
            noseProjection: n(0.72, 1.55).optional(),
        }),
        hairline: z.array(n(0.03, 0.95)).min(2).max(24).optional(),
        lashes: z.boolean(),
        freckles: z.boolean(),
        spectacles: z.boolean(),
        frames: z.enum(["round", "square"]).optional(),
        fit,
    })
    .superRefine((value, ctx) => {
        const sections = value.fit.sections;
        if (!validShirtCut(sections))
            ctx.addIssue({
                code: "custom",
                path: ["fit", "sections", "shirtCut"],
                message: shirtCutError,
            });
        const coat = sections?.coat;
        if (
            coat &&
            (coat.rows[0][0] >= value.fit.hem ||
                coat.rows.at(-1)[0] <= value.fit.hem ||
                value.outfit.top !== "crew")
        )
            ctx.addIssue({
                code: "custom",
                path: ["fit", "sections", "coat"],
                message:
                    "An open coat must cross the waist over its crew shirt",
            });
        const crown = sections?.radialCrown;
        if (crown) {
            const angles = crown.rim.map(([x, y]) =>
                Math.atan2(y - crown.center[1], x - crown.center[0])
            );
            const steps = angles.map((a, i) => {
                const delta = angles[(i + 1) % angles.length] - a;
                return Math.atan2(Math.sin(delta), Math.cos(delta));
            });
            const rotation = steps.reduce((a, b) => a + b, 0);
            if (
                crown.rim.some(
                    ([x, y]) => x === crown.center[0] && y === crown.center[1]
                ) ||
                steps.some((step) => Math.sign(step) !== Math.sign(rotation)) ||
                Math.abs(Math.abs(rotation) - 2 * Math.PI) > 0.001
            )
                ctx.addIssue({
                    code: "custom",
                    message:
                        "The crown rim must circle its center once in order.",
                });
        }
        if (sections?.openMouth && value.mouth !== "speaking")
            ctx.addIssue({
                code: "custom",
                message: "A measured open mouth needs the speaking expression.",
            });
        if ((value.hair.cut === "spikes") !== !!sections?.radialCrown)
            ctx.addIssue({
                code: "custom",
                message: "A radial haircut needs its traced crown.",
            });
        if (
            sections?.crown &&
            (!sections.hair || sections.crown.base >= sections.hair.length - 1)
        )
            ctx.addIssue({
                code: "custom",
                message: "The crown must join an existing scalp ring.",
            });
        const { neckline, hem } = value.fit;
        if (
            neckline <= 12 + value.head[1] ||
            hem <= neckline + 25 ||
            hem >= value.height - 55
        )
            ctx.addIssue({
                code: "custom",
                message:
                    "Expected the chin, neckline, hem and ankles in descending order.",
            });
        let last = 0;
        for (const b of value.outfit.bands ?? []) {
            if (b.start < last || b.start >= b.end)
                ctx.addIssue({
                    code: "custom",
                    message: "Shirt bands must be ordered and disjoint.",
                });
            last = b.end;
        }
    });
const file = z.strictObject({
    version: z.literal(1),
    name: z.string().trim().min(1).max(60),
    style: z.literal("cartoon"),
    design,
});
const orbitalPoint = z.tuple([n(-1.35, 1.35), n(-1.35, 1.35)]);
const householdOrbit = z.strictObject({
    lift: n(-0.06, 0.06).optional(),
    observedGaze: z.tuple([n(-80, 80), n(0, 1)]).optional(),
    rim: z
        .array(orbitalPoint)
        .min(8)
        .max(32)
        .refine((points) => {
            let sweep = 0,
                area = 0;
            for (let i = 0; i < points.length; i++) {
                const [x, y] = points[i],
                    [nx, ny] = points[(i + 1) % points.length];
                const cross = x * ny - nx * y;
                const turn = Math.atan2(cross, x * nx + y * ny);
                if (turn < -0.01 || turn > Math.PI / 2) return false;
                sweep += turn;
                area += cross;
            }
            return area > 2 && Math.abs(sweep - 2 * Math.PI) < 0.01;
        }, "The eye rim must enclose its socket once in order"),
    pupil: z.tuple([n(-0.8, 0.8), n(-0.8, 0.8)]),
    rimInk: z.strictObject({ width: n(0.018, 0.28), color: paint }).optional(),
    browOccluded: z.literal(true).optional(),
    browRim: z
        .array(z.tuple([n(-1.3, 1.3), n(-4.7, -0.7)]))
        .min(6)
        .max(24)
        .optional(),
    browColor: paint.optional(),
    lid: z
        .array(z.tuple([n(-1, 1), n(-3, -0.45)]))
        .min(3)
        .max(12)
        .optional(),
    brow: z
        .array(z.tuple([n(-2, 2), n(-6.5, 0.1)]))
        .min(2)
        .max(12)
        .optional(),
});
// A front T-pose can supply observed cross-sections of the clothes and limbs.
const householdBodyFit = fit
    .omit({ triangleBudget: true, hairWidth: true, hairLength: true })
    .extend({
        sections: fit.shape.sections.unwrap().pick({
            torso: true,
            pelvis: true,
            arm: true,
            leg: true,
            shoe: true,
            ankle: true,
            sleeve: true,
            handScale: true,
            leftReach: true,
            pelvisX: true,
            hemRise: true,
            garmentEdges: true,
            shirtCut: true,
            crew: true,
            outsole: true,
            openHands: true,
            palmContours: true,
            seams: true,
        }),
        palmRoll: n(-90, 90).optional(),
        handPitch: n(-30, 30).optional(),
    })
    .refine((body) => validShirtCut(body.sections), shirtCutError);
const householdFile = file.extend({
    style: z.literal("family"),
    family: z.literal("rick-classic"),
    construction: z.literal("household"),
    design: z
        .strictObject({
            ...design.shape,
            face: design.shape.face.extend({
                eyeAspect: n(0.28, 1.18).optional(),
            }),
            fit: z.never().optional(),
            parts: z.never().optional(),
            hair: design.shape.hair.extend({
                cut: z.enum(["crop", "part", "ponytail", "waves"]),
            }),
            household: z.strictObject({
                fringe: z
                    .array(z.tuple([n(-0.55, 0.55), n(0.06, 0.73)]))
                    .min(2)
                    .max(16)
                    .refine(
                        (points) =>
                            points.length >= 2 &&
                            points[0][0] < 0 &&
                            points.at(-1)[0] > 0 &&
                            points.every(([x], i) => !i || x > points[i - 1][0])
                    )
                    .optional(),
                crownEdges: z
                    .tuple([crownEdge, crownEdge])
                    .refine(
                        ([left, right]) =>
                            left.length >= 3 &&
                            right.length >= 3 &&
                            left[0][0] === right[0][0] &&
                            left[0][1] === right[0][1] &&
                            Math.abs(left[0][0]) < 0.35 &&
                            left[0][1] < 0.07 &&
                            left.at(-1)[0] < -0.24 &&
                            right.at(-1)[0] > 0.24 &&
                            [left, right].every(
                                (path, side) =>
                                    path.at(-1)[1] === 0.44 &&
                                    path.every(
                                        ([x, y], i) =>
                                            (!i ||
                                                x !== path[i - 1][0] ||
                                                y !== path[i - 1][1]) &&
                                            (side
                                                ? x >= path[0][0]
                                                : x <= path[0][0])
                                    )
                            )
                    )
                    .optional(),
                crownSides: z
                    .array(z.tuple([n(-0.85, 0.85), n(-0.85, 0.85)]))
                    .length(12)
                    .refine((rows) =>
                        rows.every(([left, right]) => left <= right)
                    )
                    .optional(),
                jawWidths: z.array(n(0.04, 1.15)).length(8).optional(),
                shirtHalfWidth: n(0.17, 0.98).optional(),
                portraitArm: z
                    .strictObject({
                        cuff: n(0.33, 1.25),
                        level: n(0.03, 0.46),
                        radius: n(0.026, 0.14),
                    })
                    .optional(),
                portraitPreset: z
                    .enum(["child", "lean-teen", "adult", "adult-casual"])
                    .optional(),
                widths: z
                    .array(n(0, 1.15))
                    .min(9)
                    .max(31)
                    .refine(
                        (widths) =>
                            widths[0] === 0 &&
                            widths.at(-1) === 0 &&
                            widths.slice(1, -1).every((w) => w > 0),
                        "Only the crown and chin may collapse to a point"
                    ),
                orbits: z.tuple([householdOrbit, householdOrbit]),
                ears: z
                    .array(
                        z.tuple([
                            n(-0.7, 0.7),
                            n(0.35, 0.88),
                            n(0.01, 0.19),
                            n(0.02, 0.22),
                        ])
                    )
                    .min(1)
                    .max(2)
                    .refine(
                        (lobes) =>
                            lobes.every(([x]) => Math.abs(x) >= 0.22) &&
                            (lobes.length === 1 ||
                                lobes[0][0] * lobes[1][0] < 0),
                        "Expected one lobe per observed temple"
                    )
                    .optional(),
                pinnae: z
                    .array(
                        z.strictObject({
                            side: z.union([z.literal(-1), z.literal(1)]),
                            radii: z.array(n(0.38, 1.52)).length(16),
                            inkWidth: n(0.07, 0.28),
                            ink: paint,
                            folds: z
                                .array(
                                    z.strictObject({
                                        outline: z
                                            .array(
                                                z.tuple([
                                                    n(-0.9, 0.9),
                                                    n(-0.9, 0.9),
                                                ])
                                            )
                                            .min(3)
                                            .max(32),
                                        ink: paint,
                                    })
                                )
                                .min(1)
                                .max(2)
                                .optional(),
                        })
                    )
                    .min(1)
                    .max(2)
                    .refine(
                        (p) => new Set(p.map((x) => x.side)).size === p.length
                    )
                    .optional(),
                earTurn: n(0, 0.8).optional(),
                penOutline: z.boolean().optional(),
                nape: n(0.5, 0.97).optional(),
                depth: z
                    .strictObject({
                        chin: n(0, 0.35),
                        forehead: n(0, 0.2),
                        cheek: n(0, 0.15),
                    })
                    .optional(),
                noseStroke: z
                    .array(z.tuple([n(-0.25, 0.25), n(0.35, 0.85)]))
                    .min(3)
                    .max(24)
                    .refine(
                        (points) =>
                            Math.max(...points.map((p) => p[0])) -
                                Math.min(...points.map((p) => p[0])) >
                            0.003,
                        "The nose needs a visible tip"
                    )
                    .optional(),
                lips: ordered(
                    z.tuple([n(-0.4, 0.4), n(0.55, 0.97), n(0.55, 0.97)]),
                    24
                )
                    .refine(
                        (rows) => rows.every(([, a, b]) => a <= b),
                        "Lip rows must run from upper to lower"
                    )
                    .optional(),
                lipInk: paint.optional(),
                lipColor: paint.optional(),
                headband: z
                    .strictObject({
                        color: paint,
                        width: n(0.015, 0.24),
                        tilt: n(-0.65, 0.75),
                    })
                    .optional(),
                mouthPaint: z
                    .strictObject({
                        teeth: paint,
                        tongue: paint.optional(),
                        seams: z.array(n(0.03, 0.97)).max(10).optional(),
                        bands: z
                            .array(
                                z.tuple([
                                    n(0, 1),
                                    n(0, 1),
                                    n(0, 1),
                                    n(0, 1),
                                    n(0, 1),
                                ])
                            )
                            .min(3)
                            .max(24)
                            .refine((rows) =>
                                rows.every((row) =>
                                    row.every((v, i) => !i || v >= row[i - 1])
                                )
                            ),
                    })
                    .optional(),
                eyePatch: z
                    .strictObject({
                        side: z.enum(["left", "right"]),
                        color: paint,
                        strap: paint,
                        width: n(0.1, 0.3),
                        height: n(0.07, 0.26),
                        lift: n(-0.22, 0.16),
                    })
                    .optional(),
                fallRows: ordered(
                    z.tuple([n(0.03, 1.55), n(0.15, 0.95), n(0.04, 0.85)]),
                    16
                )
                    .refine(
                        (rows) =>
                            rows.length >= 4 &&
                            rows.every(([, outer, inner]) => inner < outer),
                        "The inner hair edge must sit inside its outer silhouette"
                    )
                    .optional(),
                measuredBob: z
                    .strictObject({
                        frame: z.tuple([n(1, 500), n(1, 500)]),
                        skullWidth: n(1, 500),
                        eyeAxis: n(-0.5, 0.5),
                        sections: fit.shape.sections
                            .unwrap()
                            .pick({
                                hair: true,
                                nape: true,
                                sidePart: true,
                                chin: true,
                                jaw: true,
                                locks: true,
                                ears: true,
                                nose: true,
                            })
                            .required({ hair: true, nape: true }),
                    })
                    .optional(),
                body: householdBodyFit.optional(),
                creases: z
                    .array(
                        z
                            .array(z.tuple([n(-0.46, 0.46), n(0.2, 0.96)]))
                            .min(2)
                            .max(14)
                    )
                    .max(8)
                    .optional(),
            }),
        })
        .refine(
            (d) =>
                !d.household.pinnae ||
                (!d.household.measuredBob &&
                    d.household.pinnae.every((p) =>
                        d.household.ears?.some(([x]) => Math.sign(x) === p.side)
                    )),
            "A frontal pinna requires a measured lobe on the same side of a household head"
        )
        .refine(
            (d) =>
                !d.household.mouthPaint ||
                (d.mouth === "speaking" &&
                    d.household.mouthPaint.bands.length ===
                        d.household.lips?.length),
            "Painted teeth require matching open-mouth columns"
        )
        .refine(
            (d) =>
                d.hair.cut !== "waves" ||
                !!d.household.fallRows ||
                !!d.household.measuredBob,
            "Shoulder-length hair requires a measured cap and nape or fall rows"
        ),
});
export function readHouseholdFile(input: unknown) {
    const parsed = householdFile.parse(input);
    return {
        name: parsed.name,
        design: prepareHousehold(parsed.design as unknown as CartoonDesign),
    };
}
export function readCartoonFile(input: unknown): {
    version: 1;
    name: string;
    style: "cartoon";
    design: CartoonDesign;
} {
    const parsed = file.parse(input);
    return {
        version: 1,
        name: parsed.name,
        style: "cartoon",
        design: parsed.design as CartoonDesign,
    };
}
