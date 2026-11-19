import type { CartoonDesign } from "./cartoonCast";
import { composition, landmarks } from "./referenceLandmarks";
import { proportions } from "./cartoonProportions";

export function prepareHousehold(source: CartoonDesign): CartoonDesign {
    const design: CartoonDesign = {
        ...source,
        fit: undefined,
        parts: {
            skull: "classic",
            jaw: "classic",
            legs: "classic",
            hands: "classic",
            palmRoll: 64,
        },
    };
    const body = source.household.body;
    // Seed the proportions before generating the shared neckline and sockets.
    if (body) {
        design.fit = { ...body, hairWidth: 1, hairLength: 1 };
        design.parts.palmRoll = body.palmRoll ?? design.parts.palmRoll;
        design.parts.handPitch = body.handPitch;
    }
    const base = householdBody(design);
    design.fit = body
        ? { ...base, ...body, sections: { ...base.sections, ...body.sections } }
        : base;
    return design;
}

/** Lay out the garment, limb sections and native hand sockets in the same T-pose. */
function householdBody(g: CartoonDesign): CartoonDesign["fit"] {
    const proportionsFit = proportions(g);
    const { neck } = proportionsFit;
    // A portrait ends above the wrists and pelvis. Recover those proportions
    // from an authored full-body figure, scaled from neckline to floor.
    const preset = g.household.portraitPreset;
    const template =
        preset === "lean-teen"
            ? "summer"
            : preset === "child"
            ? "morty"
            : "rick-classic";
    const reference = landmarks[template];
    const scale =
        (g.height - neck) / (composition[template].floor - reference.neck[1]);
    const usePreset = !!preset && !g.household.body;
    const visibleWidth =
        usePreset && g.household.shirtHalfWidth
            ? g.household.shirtHalfWidth * g.head[1]
            : undefined;
    const shoulder =
        visibleWidth ??
        (usePreset
            ? ((reference.arms[1][0][0] - reference.arms[0][0][0]) * scale) / 2
            : proportionsFit.shoulder);
    const hip = usePreset
        ? neck + (reference.hip[1] - reference.neck[1]) * scale
        : proportionsFit.hip;
    const waist =
        visibleWidth != null
            ? visibleWidth / 1.08
            : usePreset
            ? Math.abs(reference.legs[1][0][0] - reference.legs[0][0][0]) *
              scale *
              0.71
            : proportionsFit.waist;
    const [width, skull] = g.head;
    const face = g.household;
    const lips = face.lips?.map(([x, upper, lower]) => [
        x * width,
        12 + upper * skull,
        12 + lower * skull,
    ]);
    type Sections = NonNullable<NonNullable<CartoonDesign["fit"]>["sections"]>;
    const section: Pick<
        Sections,
        "nose" | "mouth" | "openMouth" | "ears" | "creases"
    > = {};
    // The pinna emerges from the side of the measured jaw below the hairline.
    const earY = g.build === "child" ? 0.69 : 0.63;
    const position = earY * (face.widths.length - 1);
    const i = Math.floor(position),
        t = position - i;
    const temple =
        (face.widths[i] * (1 - t) + face.widths[i + 1] * t) * width * 0.495;
    section.ears =
        face.ears?.map(([x, y, rx, ry]) => [
            x * width,
            12 + y * skull,
            rx * width,
            ry * skull,
        ]) ??
        [-1, 1].map((side) => [
            side * temple,
            12 + earY * skull,
            width * 0.06,
            skull * (face.depth ? 0.099 : 0.066),
        ]);
    if (face.creases) {
        section.creases = face.creases.map((crease) => ({
            points: crease.map(([x, y]) => [x * width, 12 + y * skull]),
            radius: width * 0.006,
            color: face.lipInk ?? "#614a39",
        }));
    }
    if (face.noseStroke) {
        section.nose = {
            stroke: face.noseStroke.map(([x, y]) => [
                x * width,
                12 + y * skull,
            ]),
            radius: width * 0.0055,
            ink: "#634a3a",
        };
    }
    if (lips && g.mouth === "speaking") {
        // A short open mouth may expose only the cavity. The upper and lower
        // tooth rows coincide with its rim in that expression.
        section.openMouth = {
            rows: lips.map(([x, a, b], i) => {
                const bands = face.mouthPaint?.bands[i];
                const at = (u: number) => a + (b - a) * u;
                return bands
                    ? [
                          x,
                          at(bands[0]),
                          at(bands[1]),
                          at(bands[2]),
                          at(bands[3]),
                          at(bands[4]),
                      ]
                    : [x, a, a, b, b, b];
            }),
            interior: face.lipInk ?? "#602c2f",
            teeth: face.mouthPaint?.teeth ?? "#f5e7db",
            tongue: face.mouthPaint?.tongue,
        };
    } else if (
        lips &&
        (g.mouth === "uncertain" ||
            g.mouth === "neutral" ||
            g.mouth === "smile" ||
            g.mouth === "lips")
    ) {
        section.mouth = {
            expression: g.mouth,
            rows: lips.map(([x, a, b]) => [x, (a + b) / 2, a, b]),
            radius: width * 0.007,
            ink: face.lipInk ?? "#5c3f30",
            color: face.lipColor,
        };
    }
    const trunk = hip - neck,
        height = g.height,
        legLength = height - hip;
    const reach = reference.arms.map(
        ([root, elbow, hand]) =>
            Math.hypot(...root.map((v, i) => v - elbow[i])) +
            Math.hypot(...hand.map((v, i) => v - elbow[i]))
    );
    const upper = usePreset
        ? ((reach[0] + reach[1]) * scale) / 2
        : height * 0.447 - shoulder;

    const visibleArm = usePreset && g.household.portraitArm;
    const radius = visibleArm
        ? (visibleArm.radius * skull) / 0.89
        : usePreset
        ? scale * { "lean-teen": 8.1, child: 9.2, adult: 11 }[preset]
        : shoulder * (g.build === "lean" ? 0.17 : 0.21);
    const ankle = height - 16,
        leg = waist * (g.build === "lean" ? 0.38 : 0.42);
    const spread = waist * 0.67,
        cuff = visibleArm
            ? Math.min(
                  0.46,
                  Math.max(0.09, (visibleArm.cuff * skull - shoulder) / upper)
              )
            : 0.32,
        armY = visibleArm
            ? Math.min(
                  neck + trunk * 0.48,
                  Math.max(neck + 6, 12 + skull * (1 + visibleArm.level))
              )
            : neck + shoulder * 0.28;
    const xAt = (u: number) => shoulder + upper * u;
    const arm: [number, number, number][] = [
        [-0.085, 0.85],
        [0, 1.02],
        [cuff / 2, 1.04],
        [cuff, 1.01],
        [cuff + 0.02, 0.89],
        [0.5, 0.84],
        [0.62, 0.9],
        [0.8, 0.78],
        [1, 0.53],
    ].map(([u, r]) => [xAt(u), armY + radius * 0.14 * u, radius * r]);
    return {
        // Use low-error body edges for the last few collapses on a detailed
        // cut. The shared simplifier protects facial paint, hands and seams.
        triangleBudget: 3250,
        neckline: neck,
        hem: hip,
        shoulder,
        waist,
        armLength: upper,
        armRadius: radius,
        legRadius: leg,
        hipOffset: spread,
        cuffHeight: height - ankle,
        sleeveFraction: cuff,
        hairWidth: 1,
        hairLength: 1,
        sections: {
            ...section,
            torso: [
                [neck - 1, shoulder * 0.41],
                [neck + 5, shoulder * 0.8],
                [armY, shoulder],
                [
                    visibleArm
                        ? Math.max(neck + trunk * 0.23, armY + 1)
                        : neck + trunk * 0.23,
                    shoulder * 1.02,
                ],
                [
                    neck + trunk * 0.57,
                    waist * (g.build === "regular" ? 1.12 : 1),
                ],
                [hip - 6, waist * 1.1],
                [hip + 2, waist * 1.08],
            ],
            pelvis: [
                [hip - 5, waist],
                [hip + 6, waist * 1.02],
                [hip + leg * 0.95, waist * 0.94],
            ],
            leg: [
                [hip, spread * 0.76, leg * 1.12],
                [hip + leg * 1.45, spread * 0.9, leg * 1.06],
                [hip + legLength * 0.3, spread, leg * 0.9],
                [hip + legLength * 0.48, spread * 1.05, leg * 0.83],
                [hip + legLength * 0.66, spread * 1.11, leg * 0.87],
                [ankle + 2, spread * 1.17, leg * 0.68],
            ],
            shoe: [
                [ankle, spread * 1.17, leg * 0.6],
                [height - 10, spread * 1.18, leg * 0.8],
                [height - 4, spread * 1.21, leg],
                [height, spread * 1.21, leg * 0.94],
            ],
            arm,
            sleeve: xAt(cuff),
            handScale: Math.max(0.75, radius / 9.6),
            ...(g.outfit.top === "crew"
                ? {
                      crew: {
                          center: 0,
                          top: neck - 1,
                          radius: shoulder * 0.39,
                          drop: shoulder * 0.2,
                          binding: 1.8,
                      },
                  }
                : {}),
        },
    };
}
