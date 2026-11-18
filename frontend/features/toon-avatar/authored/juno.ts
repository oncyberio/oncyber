import type { Vec3 } from "../mesh/vec";
import type { AuthoredAvatar } from "./types";

const PI = Math.PI;

/** A bike courier: one long braid, headphones round the neck, a bag slung across. */
const juno: AuthoredAvatar = {
    id: "juno",
    name: "Juno",
    recipe: {
        body: {
            height: 0.58,
            head: 0.52,
            limbs: 0.36,
            shoulders: 0.34,
            chest: 0.36,
            waist: 0.3,
            hips: 0.58,
            neck: 0.5,
            slouch: 0.1,
            torso: 0.4,
        },
        head: {
            width: 0.5,
            height: 0.55,
            jaw: 0.55,
            chin: 0.35,
            cheeks: 0.4,
            nose: "snub",
            noseSize: 0.45,
            ears: "round",
            earSize: 0.4,
        },
        eyes: {
            size: 0.6,
            spacing: 0.3,
            tall: 0.55,
            lashes: "wing",
            brows: "arched",
            browWeight: 0.3,
            browColor: "#16242b",
            pupilSize: 0.4,
        },
        mouth: { style: "smile", width: 0.42, lips: 0.9, lipColor: "#a8324a" },
        marks: { mole: 1 },
        hair: { style: "bald", color: "#1f4a52" },
        outfit: {
            top: "crop",
            topColor: "#f4f1ea",
            pattern: "band",
            accentColor: "#e8672d",
            bottom: "flares",
            bottomColor: "#2b3350",
            shoes: "sneakers",
            shoeColor: "#e8672d",
        },
        extras: { earrings: "hoops", wrist: "band", metalColor: "#e8c15a" },
        look: { skin: "#8a5636", line: 0.4 },
    },
    build(k) {
        const { head, layout, colors } = k;
        const size = head.size;

        // Hair: a smooth cap swept to one side, then a single heavy braid down the back.
        k.cap({
            color: colors.hair,
            edge: (l) =>
                k.hairline(0.78, -0.3)(l) -
                0.22 *
                    Math.exp(
                        -Math.pow(
                            Math.atan2(Math.sin(l - 0.9), Math.cos(l - 0.9)) /
                                0.6,
                            2
                        )
                    ),
            thickness: (f) => size * 0.075 * (0.5 + 0.5 * Math.min(1, f * 3.5)),
            rows: 10,
        });
        const root = head.at(0.25, PI, size * 0.04);
        const reach = root[1] - (layout.torso.bottom + 0.05);
        const beads = 9;
        for (let i = 0; i < beads; i++) {
            const f = i / (beads - 1);
            const swing = Math.min(1, f * 1.3);
            k.blob({
                center: [
                    Math.sin(f * 5) * size * 0.04,
                    root[1] - reach * f,
                    root[2] - size * (0.12 + 0.3 * Math.sin(f * PI)),
                ],
                radii: [
                    size * 0.2 * (1 - f * 0.35),
                    (reach / beads) * 0.72,
                    size * 0.17 * (1 - f * 0.35),
                ],
                color: colors.hair,
                weights: k.mix(
                    ["head", 1 - swing * 0.85],
                    ["hairTail", swing * 0.85]
                ),
                rings: 6,
                segments: 10,
            });
        }
        k.blob({
            center: [0, root[1] - reach * 1.04, root[2] - size * 0.12],
            radii: [size * 0.09, size * 0.06, size * 0.09],
            color: k.hex("#e8672d"),
            weights: k.mix(["head", 0.15], ["hairTail", 0.85]),
            rings: 5,
            segments: 8,
        });

        // Headphones resting round the neck.
        const dark = k.hex("#1d1f25");
        const r = layout.neck.radius;
        const collar = k.mix(["upperChest", 0.7], ["neck", 0.3]);
        const band: Vec3[] = [];
        for (let j = 0; j <= 10; j++) {
            const a = PI / 2 + (j / 10) * PI;
            band.push([
                Math.sin(a) * r * 2.3,
                layout.neck.bottom + r * 0.2,
                layout.torso.lean + Math.cos(a) * r * 2.1,
            ]);
        }
        k.tube(
            band.map((at) => ({
                at,
                ru: 0.014,
                color: dark,
                weights: collar,
                outline: 0.6,
            })),
            { segments: 6 }
        );
        for (const sign of [1, -1])
            k.blob({
                center: [
                    sign * r * 2.3,
                    layout.neck.bottom + r * 0.1,
                    layout.torso.lean + r * 0.5,
                ],
                radii: [0.03, 0.055, 0.055],
                color: k.hex("#e8672d"),
                weights: collar,
                rings: 6,
                segments: 10,
            });

        // Messenger bag: a strap from the left shoulder to the right hip, all the way round.
        const strap: Vec3[] = [];
        for (let j = 0; j < 24; j++) {
            const a = (j / 24) * PI * 2;
            strap.push(
                k.torsoPoint(0.56 + 0.36 * Math.cos(a - PI / 2), a, 1.16)
            );
        }
        const canvas = k.hex("#3d7a4f");
        for (let j = 0; j < strap.length; j++) {
            const t = 0.56 + 0.36 * Math.cos((j / 24) * PI * 2 - PI / 2);
            k.tube(
                [strap[j], strap[(j + 1) % strap.length]].map((at) => ({
                    at,
                    ru: 0.024,
                    rv: 0.007,
                    color: canvas,
                    weights: k.torsoWeights(t),
                    outline: 0.6,
                })),
                { segments: 6, start: "open", end: "open", side: [0, 1, 0] }
            );
        }
        k.blob({
            center: k.torsoPoint(0.16, -PI * 0.55, 1.7),
            radii: [0.06, 0.1, 0.13],
            color: canvas,
            weights: k.mix(["hips", 0.75], ["rightUpperLeg", 0.25]),
            deform: (d) => [
                d[0],
                Math.sign(d[1]) * Math.pow(Math.abs(d[1]), 0.55),
                Math.sign(d[2]) * Math.pow(Math.abs(d[2]), 0.6),
            ],
        });
    },
};

export default juno;
