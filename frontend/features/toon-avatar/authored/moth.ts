import type { Vec3 } from "../mesh/vec";
import type { AuthoredAvatar } from "./types";

const PI = Math.PI;

/** A small kid lost in a huge quilted jacket, with wobbly antennae and a backpack. */
const moth: AuthoredAvatar = {
    id: "moth",
    name: "Moth",
    recipe: {
        body: {
            height: 0.12,
            head: 0.92,
            limbs: 0.4,
            shoulders: 0.3,
            chest: 0.4,
            waist: 0.5,
            hips: 0.45,
            neck: 0.15,
            slouch: 0.2,
            torso: 0.55,
            arms: 0.35,
            feet: 0.7,
        },
        head: {
            width: 0.72,
            height: 0.3,
            jaw: 0.25,
            cheeks: 0.8,
            nose: "button",
            noseSize: 0.35,
            ears: "round",
        },
        eyes: {
            size: 0.85,
            spacing: 0.25,
            height: 0.4,
            pupil: "wide",
            pupilSize: 0.55,
            brows: "line",
            browWeight: 0.25,
            browHeight: 0.7,
            browColor: "#5a3a26",
        },
        mouth: { style: "open", width: 0.28, open: 0.25, height: 0.55 },
        marks: { freckles: 1, blush: 0.5 },
        hair: { style: "short", color: "#5a3a26", volume: 0.75, length: 0.7 },
        outfit: {
            top: "hoodie",
            topColor: "#f2a23a",
            bottom: "shorts",
            bottomColor: "#35506b",
            shoes: "sneakers",
            shoeColor: "#d94f4f",
        },
        look: { skin: "#f6d3b8", line: 0.45 },
    },
    build(k) {
        const { head, layout } = k;
        const size = head.size;
        const quilt = k.hex("#f2a23a");
        const length = layout.torso.top - layout.torso.bottom;

        // The jacket: fat quilted rolls stacked up the body and down the arms.
        for (const t of [0.3, 0.44, 0.58, 0.72, 0.85]) {
            const roll: Vec3[] = [];
            for (let j = 0; j < 20; j++)
                roll.push(k.torsoPoint(t, (j / 20) * PI * 2, 1.2));
            k.ring(roll, {
                ru: length * 0.085,
                color: quilt,
                weights: k.torsoWeights(t),
            });
        }
        const { radius, upper, lower } = layout.arm;
        for (const side of ["left", "right"] as const) {
            const sign = side === "left" ? 1 : -1;
            const shoulder = k.joint(`${side}UpperArm`);
            const arm = upper + lower;
            for (const f of [0.1, 0.27, 0.44, 0.62, 0.8]) {
                const roll: Vec3[] = [];
                for (let j = 0; j < 12; j++) {
                    const a = (j / 12) * PI * 2 * sign;
                    roll.push([
                        shoulder[0] + sign * arm * f,
                        shoulder[1] + Math.cos(a) * radius * 1.7,
                        shoulder[2] + Math.sin(a) * radius * 1.7,
                    ]);
                }
                k.ring(roll, {
                    ru: radius * 1.05,
                    color: quilt,
                    weights: k.chainWeights(
                        arm * f,
                        [
                            [0, `${side}UpperArm`],
                            [upper, `${side}LowerArm`],
                        ],
                        upper * 0.3
                    ),
                });
            }
        }

        // Antennae on a band; the tips ride the hair bone, so they wobble.
        const band = k.hex("#2b2f3a");
        k.cap({
            color: band,
            edge: () => 0.78,
            top: () => 0.92,
            thickness: () => size * 0.13,
            rows: 2,
        });
        for (const sign of [1, -1]) {
            const root = head.at(1.0, sign * 0.55, size * 0.1);
            const stalk = [0, 0.35, 0.7, 1].map((f) => ({
                at: [
                    root[0] + sign * size * 0.45 * f * f,
                    root[1] + size * 0.75 * f,
                    root[2] + size * 0.12 * Math.sin(f * PI),
                ] as Vec3,
                ru: size * 0.03,
                color: band,
                outline: 0.6,
                weights: k.mix(["head", 1 - f * 0.7], ["hairTail", f * 0.7]),
            }));
            k.tube(stalk, { segments: 6, start: "open" });
            k.blob({
                center: stalk[3].at,
                radii: [size * 0.11, size * 0.11, size * 0.11],
                color: k.hex("#f7e25b"),
                weights: k.mix(["head", 0.3], ["hairTail", 0.7]),
            });
        }

        // Backpack and its two straps.
        const back = k.torso(0.6);
        const teal = k.hex("#2f9e8f");
        k.blob({
            center: [
                0,
                back.center[1],
                back.center[2] - back.depth * 1.2 - 0.08,
            ],
            radii: [back.width * 0.95, length * 0.36, 0.1],
            color: teal,
            weights: k.torsoWeights(0.6),
            deform: (d) => [
                Math.sign(d[0]) * Math.pow(Math.abs(d[0]), 0.6),
                Math.sign(d[1]) * Math.pow(Math.abs(d[1]), 0.6),
                d[2],
            ],
        });
        for (const sign of [1, -1])
            k.tube(
                [0.3, 0.12, -0.12, -0.3].map((turn, i) => {
                    const t = [0.42, 0.9, 0.93, 0.8][i];
                    return {
                        at: k.torsoPoint(
                            t,
                            sign * (PI / 2 - turn * PI) * 0.62 +
                                (i > 1 ? sign * PI * 0.38 : 0),
                            1.42
                        ),
                        ru: 0.022,
                        rv: 0.008,
                        color: k.hex("#1f6e64"),
                        weights: k.torsoWeights(t),
                    };
                }),
                { segments: 6, side: [0, 0, 1] }
            );
    },
    face: (params) => ({
        ...params,
        mouthStyle: [0, params.mouthStyle[1], 0, 0],
    }),
};

export default moth;
