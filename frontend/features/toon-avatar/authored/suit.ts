import type { Vec3 } from "../mesh/vec";
import type { AuthoredAvatar } from "./types";

const PI = Math.PI;

/**
 * Written from a reference picture: a very tall, narrow figure in a black
 * suit and tie, dark glasses, stubble, and a heap of swept-up brown hair.
 */
const suit: AuthoredAvatar = {
    id: "suit",
    name: "Suit",
    recipe: {
        body: {
            height: 1,
            head: 0.02,
            neck: 0.5,
            shoulders: 0.6,
            chest: 0.42,
            waist: 0.32,
            hips: 0.3,
            belly: 0,
            torso: 0.42,
            arms: 0.52,
            limbs: 0.2,
            hands: 0.45,
            feet: 0.62,
            slouch: 0.08,
        },
        head: {
            width: 0.32,
            height: 0.78,
            depth: 0.5,
            jaw: 0.1,
            chin: 0.7,
            crown: 0.3,
            square: 0.55,
            cheeks: 0.05,
            ears: "round",
            earSize: 0.45,
            nose: "pointed",
            noseSize: 0.5,
            noseHeight: 0.55,
        },
        eyes: {
            size: 0.32,
            spacing: 0.4,
            height: 0.6,
            tall: 0,
            brows: "angled",
            browWeight: 0.75,
            browHeight: 0.75,
            browTilt: 0.55,
            browColor: "#4a2c1a",
        },
        mouth: { style: "smirk", width: 0.36, height: 0.5, curve: 0.45 },
        marks: { stubble: 0.75 },
        hair: {
            style: "bald",
            color: "#6e4426",
            facial: "none",
            facialColor: "#b08a6a",
        },
        outfit: {
            top: "longsleeve",
            topColor: "#f6f4ef",
            outer: "jacket",
            outerColor: "#2b2627",
            bottom: "pants",
            bottomColor: "#2b2627",
            shoes: "flats",
            shoeColor: "#1c1a1b",
        },
        extras: { glasses: "shades", glassesColor: "#141416" },
        look: { skin: "#f3c9a2", ink: "#1c1717", line: 0.34, shade: 0.6 },
    },
    build(k) {
        const { head, layout, colors } = k;
        const size = head.size;

        // Hair: a full cap, then big loose locks thrown up and across the crown.
        k.cap({
            color: colors.hair,
            edge: k.hairline(0.92, -0.15, 0.1, 4),
            rows: 12,
            thickness: (f, l) =>
                size *
                0.16 *
                (0.45 + 0.55 * Math.min(1, f * 3)) *
                (1 + 0.25 * Math.sin(l * 7) * Math.sin(f * 6)),
        });
        // Fat, curling locks: few and heavy, so the mass reads before the strands.
        const lock = (lat: number, lon: number, reach: number, lean: Vec3) => {
            const base = head.at(lat, lon, -size * 0.12);
            const away = head.at(lat, lon, size);
            const out: Vec3 = [
                away[0] - base[0],
                away[1] - base[1],
                away[2] - base[2],
            ];
            const span = size * reach;
            // Thick through the middle, curling over, with a round tip.
            k.tube(
                [0, 0.3, 0.6, 0.85, 1].map((f, n) => ({
                    at: [
                        base[0] +
                            (out[0] * f * 0.9 + lean[0] * f * f * 1.1) * span,
                        base[1] +
                            (out[1] * f * 0.9 + lean[1] * f * f * 0.9) * span,
                        base[2] +
                            (out[2] * f * 0.9 + lean[2] * f * f * 1.1) * span,
                    ] as Vec3,
                    ru: size * [0.36, 0.42, 0.36, 0.26, 0.15][n],
                    color: colors.hair,
                    weights: k.rigid("head"),
                })),
                { segments: 10, start: "open", bulge: 1 }
            );
        };
        for (const [lat, lon, reach, x, y] of [
            [0.95, -1.1, 0.75, -0.7, 0.2],
            [1.05, -0.45, 0.95, -0.35, 0.55],
            [1.1, 0.25, 1.1, 0.3, 0.6],
            [1.0, 0.95, 0.95, 0.75, 0.35],
            [1.3, 1.9, 0.9, 0.8, 0.3],
            [1.35, -2.0, 0.8, -0.6, 0.3],
            [1.4, 0.9, 1.15, 0.5, 0.6],
            [1.25, PI, 0.75, 0.2, 0.2],
        ])
            lock(lat, lon, reach, [x, y, -0.2]);
        // One lock falls forward over the brow.
        lock(0.95, -0.3, 0.5, [-0.4, -0.9, 0.3]);

        // A narrow black tie down the shirt front.
        const white = k.hex("#f6f4ef");
        const tie = k.hex("#17161a");
        k.tube(
            [0.975, 0.93, 0.8, 0.62, 0.52, 0.47].map((t, i) => ({
                at: k.torsoPoint(t, 0, 1.13),
                ru: [0.02, 0.014, 0.02, 0.025, 0.02, 0.004][i],
                rv: 0.006,
                color: tie,
                weights: k.torsoWeights(t),
                outline: 0.5,
            })),
            { segments: 8, side: [1, 0, 0], start: "flat", end: "flat" }
        );
        // Two jacket buttons on the closing edge.
        for (const t of [0.5, 0.38])
            k.blob({
                center: k.torsoPoint(t, 0.16, 1.22),
                radii: [0.011, 0.011, 0.006],
                color: tie,
                weights: k.torsoWeights(t),
                outline: 0.4,
                rings: 4,
                segments: 8,
            });

        // White shirt cuffs showing past the jacket sleeves.
        const { radius, upper, lower } = layout.arm;
        for (const side of ["left", "right"] as const) {
            const sign = side === "left" ? 1 : -1;
            const shoulder = k.joint(`${side}UpperArm`);
            const cuff: Vec3[] = [];
            for (let j = 0; j < 12; j++) {
                const a = (j / 12) * PI * 2 * sign;
                cuff.push([
                    shoulder[0] + sign * (upper + lower) * 0.95,
                    shoulder[1] + Math.cos(a) * radius * 1.12,
                    shoulder[2] + Math.sin(a) * radius * 1.12,
                ]);
            }
            k.ring(cuff, {
                ru: radius * 0.28,
                color: white,
                weights: k.rigid(`${side}LowerArm`),
                outline: 0.6,
            });
        }
    },
};

export default suit;
