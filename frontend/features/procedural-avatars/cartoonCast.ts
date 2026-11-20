import evilMorty from "../../public/lobby/procedural/recipes/evil-morty.json";
import jessica from "../../public/lobby/procedural/recipes/jessica.json";
import beth from "../../public/lobby/procedural/recipes/beth-smith.json";
import morty from "../../public/lobby/procedural/recipes/morty-smith.json";
import summer from "../../public/lobby/procedural/recipes/summer-smith.json";
import jerry from "../../public/lobby/procedural/recipes/jerry-smith.json";
import { prepareHousehold } from "./householdBody";
import { proportions } from "./cartoonProportions";
export { proportions } from "./cartoonProportions";
import { fittedArmPlane, referenceBends, type PartFit } from "./humanoidParts";
import type { AvatarRecipe } from "./recipes";
import type { Point } from "./sculpt";
import type { ReferenceLayout } from "./referenceProportions";

export type Seam = {
    points: [number, number][];
    color: string;
    radius: number;
};
export type EyeDepth = {
    eyeSpan?: number;
    eyeCenter?: number;
    pupilDepth?: number;
    lidSpan?: [number, number];
    eyeRows?: [number, number, number][];
};

export type OpenCoat = {
    /** Height, left silhouette, left opening, right opening, right silhouette. */
    rows: [number, number, number, number, number][];
    color: string;
    sleeves: string;
};

import type { Pinna } from "./pinna";
import type { ShirtMark } from "./shirtMark";
import type { RoundedSection } from "./roundedProfile";

export interface CartoonDesign {
    height: number;
    household?: {
        /** Visible shirt half-width beneath the sleeves in head-height units. */
        shirtHalfWidth?: number;
        /** Short-sleeve cuff distance, arm center below the chin and bare radius in head heights. */
        portraitArm?: { cuff: number; level: number; radius: number };
        portraitPreset?: "child" | "lean-teen" | "adult" | "adult-casual";
        /** Skull widths from crown to chin, as fractions of its largest width. */
        widths: number[];
        /** Knots of the visible hairline in skull widths and crown-to-chin heights. */
        fringe?: [number, number][];
        /** Lateral hair limits along the upper 44% of the skull, in skull widths. */
        crownSides?: [number, number][];
        /** Ordered outer contours from a shared summit to the two temples. */
        crownEdges?: [[number, number][], [number, number][]];
        /** Skin widths at 60%, 65%, …, 95% of crown-to-chin height. */
        jawWidths?: number[];
        /** Front-view lobe centers and radii in fractions of skull width and height. */
        ears?: [number, number, number, number][];
        pinnae?: Pinna[];
        /** Angle of the visible helix from the sagittal plane toward the face. */
        earTurn?: number;
        penOutline?: boolean;
        nape?: number;
        /** Inferred posterior hairline on a measured short cap, in skull heights. */
        rearHairline?: number;
        /** Sagittal offsets in skull widths, independent of the wardrobe and rig. */
        depth?: { chin: number; forehead: number; cheek: number };
        body?: Omit<
            NonNullable<CartoonDesign["fit"]>,
            "triangleBudget" | "hairWidth" | "hairLength"
        > & { palmRoll?: number; handPitch?: number };
        noseStroke?: [number, number][];
        lips?: [number, number, number][];
        lipInk?: string;
        lipColor?: string;
        mouthPaint?: {
            teeth: string;
            tongue?: string;
            /** Opening, upper teeth, tongue, lower teeth, and lower rim within each lip column. */
            bands: [number, number, number, number, number][];
            seams?: number[];
        };
        /** Width is the angular half-width of the strip on the skull. */
        headband?: { color: string; width: number; tilt: number };
        eyePatch?: {
            side: "left" | "right";
            color: string;
            strap: string;
            width: number;
            height: number;
            lift: number;
        };
        /** Height, outside radius and inner-front edge of a shoulder-length cut, in skull units. */
        fallRows?: [number, number, number][];
        measuredBob?: {
            frame: [number, number];
            skullWidth: number;
            eyeAxis: number;
            sections: Pick<
                NonNullable<NonNullable<CartoonDesign["fit"]>["sections"]>,
                | "hair"
                | "nape"
                | "sidePart"
                | "chin"
                | "jaw"
                | "locks"
                | "ears"
                | "nose"
            >;
        };
        creases?: [number, number][][];
        /** Visible eye rims and pupils in the local orbital frame, left to right. */
        orbits: {
            rim: [number, number][];
            pupil: [number, number];
            lift?: number;
            observedGaze?: [number, number];
            /** Pigment laid just outside the measured white. Width is a fraction of eye radius. */
            rimInk?: { width: number; color: string };
            browOccluded?: boolean;
            browRim?: [number, number][];
            browColor?: string;
            lid?: [number, number][];
            brow?: [number, number][];
        }[];
    };
    parts?: PartFit;
    /** Front-view measurements in the same units as height and head dimensions. */
    fit?: {
        triangleBudget?: number;
        neckline: number;
        hem: number;
        shoulder: number;
        waist: number;
        armLength: number;
        armRadius: number;
        legRadius: number;
        hipOffset: number;
        cuffHeight: number;
        sleeveFraction: number;
        hairWidth: number;
        hairLength: number;
        sections?: {
            /** Registered skull stations in this drawing frame. */
            cranium?: RoundedSection[];
            coat?: OpenCoat;
            leftReach?: number;
            pelvisX?: number;
            hemRise?: number;
            shirtCut?: {
                /** Attachment station on the measured sleeve and center of each torso row. */
                station: number;
                shoulderTop: number;
                centers: number[];
                /** Skin opening sampled from the standing collar to its point: Y, left X, right X. */
                opening?: [number, number, number][];
                wings?: [number, number][][];
            };
            garmentEdges?: {
                /** Front hem offsets sampled left to right, in torso lengths. */
                frontHem?: number[];
                /** Width of the turned cuff in drawing units. */
                rolledCuff?: number;
            };
            seams?: { shirt?: Seam[]; trousers?: Seam[] };
            creases?: {
                points: [number, number][];
                radius: number;
                color: string;
            }[];
            foreheadLock?: [number, number, number][];
            shirtMark?: ShirtMark & { box: [number, number, number, number] };
            crew?: {
                center: number;
                top: number;
                radius: number;
                drop: number;
                binding: number;
                ink?: string;
            };
            nose?: {
                /** Measured open contour from bridge around the tip. */
                stroke: [number, number][];
                radius: number;
                ink: string;
            };
            mouth?: {
                expression: "smile" | "uncertain" | "neutral" | "lips";
                /** Image x, lip seam y, upper border y, lower border y. */
                rows: [number, number, number, number][];
                ink: string;
                radius: number;
                color?: string;
            };
            eyes?: {
                rim: [number, number][];
                brow?: [number, number][];
                lid?: [number, number][];
                browWidth?: number;
                rimInk?: { width: number; color: string };
                browRim?: [number, number][];
                browOccluded?: boolean;
                browColor?: string;
                pupil: [number, number, number];
            }[];
            /** Visible ear centers and radii in the drawing plane. */
            ears?: [number, number, number, number][];
            /** Height fraction, back of hair, leading lock, and face in sagittal depth. */
            sideGuide?: EyeDepth & {
                /** Set at build time when a lone T-pose supplies the depth estimate. */
                inferred?: true;
                rows: [number, number, number, number][];
                noseRise: number;
                frontalNoseInk?: boolean;
                noseProfile?: [number, number][];
                mouthProfile?: [number, number][];
                mouthTick?: [number, number];
                templeEdge?: {
                    side: 1 | -1;
                    rows: [number, number][];
                    roll?: [number, number, number][];
                };
                browProfile?: [number, number][];
                chinFloor?: [number, number][];
                jawEdge?: [number, number, number?][];
                turnedEar?: number;
                turnedNose?: [number, number][];
                turnedMouth?: [number, number][];
                mouthCorner?: [number, number];
                hem?: [number, number][];
                /** Pupil positions across the two visible whites in the +35° expression. */
                turnedPupils?: [number, number];
                forelockSide?: -1 | 1;
                turnedCrown?: [number, number, number][];
                turnedBack?: [number, number][];
                turnedHair?: [number, number][];
                ear?: [number, number, number, number];
                locks?: [number, number][][];
            };
            outsole?: {
                ink?: string;
                laces?: Seam[];
                collar?: { tops: number[]; color: string };
                rows: [number, number, number, number][];
                color: string;
            };
            nape?: [number, number][];
            chin?: [number, number][];
            locks?: [number, number][][];
            sidePart?: [number, number, number];
            radialCrown?: { center: [number, number]; rim: [number, number][] };
            openMouth?: {
                rows: [number, number, number, number, number, number][];
                interior: string;
                teeth: string;
                tongue?: string;
            };
            crown?: { base: number; rim: [number, number][] };
            jaw?: [number, number, number][];
            hair?: [number, number, number, number, number][];
            arm: [number, number, number][];
            torso: [number, number][];
            leg: [number, number, number][];
            pelvis: [number, number][];
            shoe: [number, number, number][];
            ankle?: [number, number, number][];
            sleeve: number;
            handScale: number;
            openHands?: ReferenceLayout["landmarks"]["openHands"];
            palmContours?: [Point[] | null, Point[] | null];
        };
    };
    stance: "relaxed" | "guarded" | "hip" | "open";
    build: "child" | "lean" | "regular" | "broad";
    portraitStudy?: "morty" | "summer";
    skull: "round" | "oval" | "long" | "square";
    head: [number, number];
    skin: string;
    eyes: "wide" | "relaxed" | "half-lidded";
    gaze: number;
    /** Height and pigment radius in eye radii, and the pigment height/width ratio. */
    pupil?: { height: number; radius: number; aspect: number };
    brow: "worried" | "level" | "arched" | "knit";
    nose: "button" | "straight" | "hooked";
    mouth: "uncertain" | "smile" | "neutral" | "speaking" | "lips";
    hair: {
        cut:
            | "crop"
            | "waves"
            | "bob"
            | "part"
            | "ponytail"
            | "bun"
            | "curls"
            | "quiff"
            | "spikes";
        color: string;
        /** How far the free ponytail hangs below its swept reference pose. */
        fall?: number;
        fringeDepthScale?: number;
    };
    outfit: {
        top: "crew" | "polo" | "tank" | "cardigan";
        color: string;
        trim: string;
        trousers: string;
        shoes: string;
        footwear?: "sneaker" | "flat" | "boot";
        stripes?: string[];
        bands?: { start: number; end: number; color: string; bend?: number }[];
        /** Fraction of torso length below the throat for the polo opening. */
        placketDepth?: number;
        placketEnd?: number;
        /** Fastener heights along a button-front shirt, measured from throat to hem. */
        buttons?: number[];
        buttonColor?: string;
    };
    face?: Partial<{
        eyeHeight: number;
        eyeRadius: number;
        eyeAspect: number;
        eyeDepthScale: number;
        eyeSpacing: number;
        noseBase: number;
        mouthHeight: number;
        mouthWidth: number;
        chinTaper: number;
        jawWidth: number;
        noseWidth: number;
        noseProjection: number;
    }>;
    /** Front hairline heights from the left temple to the right, in fractions of skull height. */
    hairline?: number[];
    lashes?: boolean;
    freckles?: boolean;
    spectacles?: boolean;
    frames?: "round" | "square";
}

export type CartoonChanges = Omit<
    Partial<CartoonDesign>,
    "hair" | "outfit" | "portraitStudy"
> & {
    hair?: Partial<CartoonDesign["hair"]>;
    outfit?: Partial<CartoonDesign["outfit"]>;
};

/** Preserve measured portrait contours for wardrobe, proportion and color edits.
 * Editing individual facial features or the haircut selects the parametric head. */
export function tailorCartoon(
    base: CartoonDesign,
    changes: CartoonChanges
): CartoonDesign {
    const facialFeatures = [
        "face",
        "hairline",
        "eyes",
        "nose",
        "freckles",
        "spectacles",
        "lashes",
        "skull",
    ] as const;
    const haircutChanged =
        changes.hair?.cut !== undefined && changes.hair.cut !== base.hair.cut;
    const changesMouth =
        changes.mouth !== undefined && changes.mouth !== base.mouth;
    const measuredMouth =
        !!base.portraitStudy &&
        (changes.mouth === "speaking" ||
            (base.portraitStudy === "morty"
                ? changes.mouth === "uncertain"
                : changes.mouth === "neutral"));
    const redrawHead =
        haircutChanged ||
        (changesMouth && !measuredMouth) ||
        facialFeatures.some(
            (key) => changes[key] !== undefined && changes[key] !== base[key]
        );
    const tailored: CartoonDesign = {
        ...base,
        ...changes,
        portraitStudy: redrawHead ? undefined : base.portraitStudy,
        hair: { ...base.hair, ...changes.hair },
        hairline:
            changes.hairline ?? (haircutChanged ? undefined : base.hairline),
        outfit: { ...base.outfit, ...changes.outfit },
        face: changes.face ? { ...base.face, ...changes.face } : base.face,
    };
    if (tailored.outfit.top !== "polo") {
        delete tailored.outfit.buttons;
        delete tailored.outfit.placketDepth;
        delete tailored.outfit.placketEnd;
        delete tailored.outfit.buttonColor;
    } else if (!tailored.outfit.buttons) {
        delete tailored.outfit.buttonColor;
        delete tailored.outfit.placketEnd;
    }
    if (!base.household) return tailored;
    // Other silhouettes use the existing parametric hair builder.
    if (
        !["crop", "part", "ponytail"].includes(tailored.hair.cut) &&
        !(
            tailored.hair.cut === "waves" &&
            (tailored.household.fallRows || tailored.household.measuredBob)
        )
    ) {
        return { ...tailored, household: undefined, fit: undefined };
    }
    if (
        base.household.body &&
        (changes.height !== undefined ||
            changes.build !== undefined ||
            changes.head !== undefined)
    ) {
        tailored.household = { ...tailored.household, body: undefined };
    }
    if (changesMouth && tailored.household.lips) {
        tailored.household = {
            ...tailored.household,
            lips: undefined,
            mouthPaint: undefined,
        };
    }
    return prepareHousehold(tailored);
}

export const cartoonCast = [
    { id: "rick-classic", name: "Rick Sanchez", series: true, study: true },
    {
        id: "morty-smith",
        name: "Morty Smith",
        series: true,
        design: prepareHousehold(morty.design as CartoonDesign),
    },
    {
        id: "summer-smith",
        name: "Summer Smith",
        series: true,
        design: prepareHousehold(summer.design as CartoonDesign),
    },
    {
        id: "beth-smith",
        name: "Beth Smith",
        series: true,
        design: prepareHousehold(beth.design as CartoonDesign),
    },
    {
        id: "jerry-smith",
        name: "Jerry Smith",
        series: true,
        design: prepareHousehold(jerry.design as CartoonDesign),
    },
    {
        id: "evil-morty",
        name: "Evil Morty",
        series: true,
        design: prepareHousehold(evilMorty.design as CartoonDesign),
    },
    {
        id: "jessica",
        name: "Jessica",
        series: true,
        design: prepareHousehold(jessica.design as CartoonDesign),
    },
    {
        id: "inez-vale",
        name: "Inez Vale",
        series: false,
        design: {
            height: 608,
            stance: "open",
            build: "regular",
            skull: "round",
            head: [113, 124],
            skin: "#a56e50",
            eyes: "relaxed",
            gaze: -0.17,
            brow: "arched",
            nose: "button",
            mouth: "smile",
            spectacles: true,
            hair: { cut: "curls", color: "#3e3031" },
            outfit: {
                top: "cardigan",
                color: "#227d7b",
                trim: "#eed19c",
                trousers: "#354a55",
                shoes: "#98643d",
            },
        },
    },
    {
        id: "oren-pike",
        name: "Oren Pike",
        series: false,
        design: {
            height: 663,
            stance: "relaxed",
            build: "lean",
            skull: "long",
            head: [95, 154],
            skin: "#e2b290",
            face: { noseProjection: 1.2, jawWidth: 0.91 },
            eyes: "half-lidded",
            gaze: -0.17,
            brow: "knit",
            nose: "hooked",
            mouth: "neutral",
            hair: { cut: "quiff", color: "#8e5142" },
            outfit: {
                top: "crew",
                color: "#b66534",
                trim: "#855034",
                trousers: "#43584b",
                shoes: "#40383b",
                footwear: "boot",
                stripes: ["#e1b577"],
            },
        },
    },
    {
        id: "mai-calder",
        name: "Mai Calder",
        series: false,
        design: {
            height: 563,
            stance: "open",
            build: "lean",
            skull: "oval",
            head: [104, 123],
            skin: "#e6be95",
            eyes: "wide",
            gaze: -0.25,
            brow: "level",
            nose: "button",
            mouth: "smile",
            freckles: true,
            hair: { cut: "bob", color: "#383444" },
            outfit: {
                top: "tank",
                color: "#6c65a3",
                trim: "#4d4877",
                trousers: "#69748d",
                shoes: "#eee0c5",
                footwear: "sneaker",
            },
        },
    },
    {
        id: "nell-torres",
        name: "Nell Torres",
        series: false,
        design: {
            height: 588,
            stance: "hip",
            build: "regular",
            skull: "oval",
            head: [110, 133],
            skin: "#b98267",
            frames: "square",
            face: { jawWidth: 0.94, noseProjection: 1.1 },
            eyes: "relaxed",
            gaze: 0.12,
            brow: "arched",
            nose: "hooked",
            mouth: "lips",
            spectacles: true,
            hair: { cut: "bun", color: "#afa8aa" },
            outfit: {
                top: "cardigan",
                color: "#a1484f",
                trim: "#c3a4aa",
                trousers: "#4f4859",
                shoes: "#644947",
            },
        },
    },
    {
        id: "otis-reed",
        name: "Otis Reed",
        series: false,
        design: {
            height: 604,
            stance: "open",
            build: "broad",
            skull: "square",
            head: [132, 130],
            skin: "#895c48",
            face: {
                jawWidth: 1.17,
                noseWidth: 1.35,
                noseProjection: 1.28,
                eyeSpacing: 0.209,
                eyeAspect: 0.91,
            },
            eyes: "wide",
            gaze: 0.18,
            brow: "worried",
            nose: "button",
            mouth: "speaking",
            hair: { cut: "crop", color: "#393234" },
            outfit: {
                top: "polo",
                color: "#477a96",
                trim: "#a8c5cb",
                trousers: "#a39371",
                shoes: "#4a3c31",
                stripes: ["#315b73"],
            },
        },
    },
] as const satisfies readonly {
    id: string;
    name: string;
    series: boolean;
    study?: boolean;
    design?: CartoonDesign;
}[];
export type CastMember = (typeof cartoonCast)[number]["id"];

/** Signed image-space joint or ring coordinate, measured from the neck axis. */
export function fittedArmX(d: CartoonDesign, side: number, x: number) {
    const scale = side < 0 ? d.fit?.sections?.leftReach ?? 1 : 1;
    return side * (x + Math.max(0, x - (d.fit?.shoulder ?? x)) * (scale - 1));
}
export function cartoonLayout(d: CartoonDesign): ReferenceLayout {
    const { jaw, neck, hip, shoulder, waist } = proportions(d);
    const sections = d.fit?.sections;
    const pelvisX = sections?.pelvisX ?? 0;
    const arm = (side: number): [Point, Point, Point] => {
        if (sections) {
            const rows = sections.arm;
            const z = fittedArmPlane(shoulder, hip - neck);
            const last = rows.at(-1);
            const elbow = referenceBends(d.parts?.hands).elbow;
            const elbowX = shoulder + (last[0] - shoulder) * elbow;
            return [
                [side * shoulder, rows[0][1], z[0]],
                [
                    fittedArmX(d, side, elbowX),
                    rows[0][1] + (last[1] - rows[0][1]) * elbow,
                    z[1],
                ],
                [fittedArmX(d, side, last[0]), last[1], z[2]],
            ];
        }
        const gesture =
            d.stance === "hip" && side === 1
                ? [0.37, -0.56, 0.16, 0.48]
                : d.stance === "guarded"
                ? [
                      side === 1 ? 0.12 : 0.19,
                      side === 1 ? -0.12 : -0.34,
                      0.04,
                      0.51,
                  ]
                : d.stance === "open"
                ? [
                      side === 1 ? 0.17 : 0.25,
                      side === 1 ? 0.04 : -0.05,
                      0.03,
                      0.16,
                  ]
                : [0.12, side === 1 ? -0.05 : -0.11, 0.01, 0.16];
        const upper = d.fit ? d.fit.armLength * 0.52 : (hip - neck) * 0.6,
            fore = d.fit ? d.fit.armLength * 0.48 : (hip - neck) * 0.51,
            [a, b, za, zb] = gesture;
        const move = (
            p: Point,
            length: number,
            angle: number,
            z: number
        ): Point => [
            p[0] + side * length * Math.sin(angle) * Math.sqrt(1 - z * z),
            p[1] + length * Math.cos(angle) * Math.sqrt(1 - z * z),
            p[2] + z * length,
        ];
        const root: Point = [side * shoulder, neck + 9, 0],
            elbow = move(root, upper, a, za);
        return [root, elbow, move(elbow, fore, b, zb)];
    };
    const spread = d.fit?.hipOffset;
    const leg = (s: number): [Point, Point, Point] => {
        if (sections) {
            const thigh = pelvisX + s * sections.leg[0][1];
            const [ankleY, ankleOffset] = sections.outsole?.collar
                ? sections.ankle?.[0] ?? sections.leg.at(-1)
                : sections.shoe[0];
            const ankle = pelvisX + s * ankleOffset;
            const knee = referenceBends(d.parts?.legs).knee;
            return [
                [thigh, hip, 0],
                [
                    thigh + (ankle - thigh) * knee,
                    hip + (ankleY - hip) * knee,
                    2,
                ],
                [ankle, ankleY, 0],
            ];
        }
        return [
            [s * (spread ?? waist * 0.52), hip, 0],
            [s * (spread ?? waist * 0.62), hip + (d.height - hip) * 0.49, 2],
            [
                s * (spread ?? waist * 0.72),
                d.height - (d.fit?.cuffHeight ?? 20),
                0,
            ],
        ];
    };
    const toe = (s: number): Point => [
        pelvisX +
            s *
                ((sections?.pelvisX != null
                    ? sections.shoe.at(-1)[1]
                    : spread ?? waist * 0.72) +
                    3),
        d.height - 8,
        22,
    ];
    return {
        origin: { x: 0, floor: d.height },
        eyeLine: 12 + d.head[1] * 0.48,
        landmarks: {
            hip: [pelvisX, hip, 0],
            neck: [sections?.crew?.center ?? 0, neck, 0],
            jaw: [0, jaw - 5, 0],
            headYaw: 0,
            torsoYaw: 0,
            arms: [arm(-1), arm(1)],
            legs: [leg(-1), leg(1)],
            feet: [toe(-1), toe(1)],
            handScale: sections?.handScale,
            openHands: sections?.openHands,
            palmRoll: sections ? d.parts?.palmRoll : undefined,
            fingers: sections
                ? [
                      [
                          -1,
                          Math.tan(((d.parts?.handPitch ?? 0) * Math.PI) / 180),
                          0,
                      ],
                      [
                          1,
                          Math.tan(((d.parts?.handPitch ?? 0) * Math.PI) / 180),
                          0,
                      ],
                  ]
                : [
                      [-0.11, 0.99, 0.05],
                      [0.11, 0.99, 0.05],
                  ],
            grip: [false, false],
        },
    };
}
const designs = new Map<string, AvatarRecipe>();
const castKeys = new WeakMap<CartoonDesign, string>();

export function cartoonRecipe(id: string): AvatarRecipe | undefined {
    const cached = designs.get(id);
    if (cached) return cached;
    const member = cartoonCast.find((c) => c.id === id);
    if (!member) return;
    const design: CartoonDesign =
        "design" in member ? member.design : undefined;
    const recipe: AvatarRecipe = design
        ? {
              template: design.household ? "rick-classic" : "morty",
              cartoon: design,
              layout: cartoonLayout(design),
          }
        : { template: "rick-classic" };
    designs.set(id, recipe);
    if (design) castKeys.set(design, id);
    return recipe;
}

// Authored layouts outside the catalogue retain their own topology and motion.
export function castCacheKey(recipe: AvatarRecipe) {
    const id = recipe.cartoon && castKeys.get(recipe.cartoon);
    if (
        id &&
        recipe.layout === designs.get(id).layout &&
        !recipe.shapes &&
        !recipe.garments
    )
        return "cast-" + id;
}
