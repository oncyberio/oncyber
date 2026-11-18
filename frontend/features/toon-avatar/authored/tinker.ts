import type { Vec3 } from "../mesh/vec";
import type { AuthoredAvatar } from "./types";

const PI = Math.PI;

/** A workshop mechanic: copper quiff, handlebar mustache, goggles on the brow, scarf, tool belt. */
const tinker: AuthoredAvatar = {
    id: "tinker",
    name: "Tinker",
    recipe: {
        body: {
            height: 0.62,
            head: 0.55,
            limbs: 0.42,
            shoulders: 0.55,
            chest: 0.55,
            waist: 0.45,
            hips: 0.4,
            neck: 0.4,
            slouch: 0.2,
            torso: 0.42,
            arms: 0.6,
        },
        head: {
            width: 0.6,
            height: 0.45,
            jaw: 0.3,
            chin: 0.5,
            square: 0.45,
            nose: "bulb",
            noseSize: 0.5,
            ears: "round",
            earSize: 0.5,
        },
        eyes: {
            size: 0.5,
            spacing: 0.15,
            lids: 0.15,
            bags: 0.3,
            brows: "arched",
            browTilt: 0.62,
            browColor: "#a8481f",
            pupilSize: 0.3,
        },
        mouth: { style: "smirk", width: 0.5, height: 0.45 },
        marks: { freckles: 0.6 },
        hair: {
            style: "bald",
            color: "#a8481f",
            facial: "handlebar",
            facialColor: "#a8481f",
        },
        outfit: {
            top: "longsleeve",
            topColor: "#6f7f8c",
            outer: "vest",
            outerColor: "#7a4f33",
            bottom: "pants",
            bottomColor: "#33373f",
            shoes: "boots",
            shoeColor: "#1d1f25",
        },
        look: { skin: "#dca077", line: 0.42 },
    },
    build(k) {
        const { head, layout, colors } = k;
        const size = head.size;
        const headBone = k.rigid("head");

        // Hair: one tall rolled quiff, highest over the forehead, tight at the sides.
        k.cap({
            color: colors.hair,
            edge: k.hairline(0.95, -0.25),
            rows: 12,
            thickness: (f, l) => {
                const front = Math.atan2(Math.sin(l), Math.cos(l)) / 0.9;
                const roll =
                    Math.exp(-front * front) *
                    Math.sin(Math.min(1, f * 1.4) * PI) *
                    3.4;
                return (
                    size * 0.06 * (0.5 + 0.5 * Math.min(1, f * 4)) * (1 + roll)
                );
            },
        });

        // Goggles pushed up onto the forehead, on a strap right round the head.
        const browY = k.face.brow.y + 0.2;
        const strap = Math.asin(
            Math.min(0.95, (browY * size) / layout.head.up)
        );
        const leather = k.hex("#2b2622");
        k.cap({
            color: leather,
            edge: () => strap - 0.09,
            top: () => strap + 0.09,
            thickness: () => size * 0.02,
            rows: 2,
        });
        for (const side of [1, -1]) {
            const x = side * 0.27;
            const normal = head.frontNormal(x, browY);
            const base = head.front(x, browY, size * 0.01);
            const out = (d: number): Vec3 => [
                base[0] + normal[0] * d,
                base[1] + normal[1] * d,
                base[2] + normal[2] * d,
            ];
            k.tube(
                [0, 0.09].map((d) => ({
                    at: out(size * d),
                    ru: size * 0.2,
                    color: k.hex("#b8873a"),
                    weights: headBone,
                })),
                { segments: 14, start: "flat", end: "flat" }
            );
            k.blob({
                center: out(size * 0.09),
                radii: [size * 0.15, size * 0.15, size * 0.035],
                color: k.hex("#8fd3e8"),
                weights: headBone,
                outline: 0,
                rings: 5,
                segments: 14,
            });
        }

        // Scarf: a fat loop on the shoulders and one end hanging down the chest.
        const wool = k.hex("#c8463c");
        const collar = k.mix(["upperChest", 0.6], ["neck", 0.4]);
        const r = layout.neck.radius;
        const loop: Vec3[] = [];
        for (let j = 0; j < 14; j++) {
            const a = (j / 14) * PI * 2;
            loop.push([
                Math.sin(a) * r * 1.9,
                layout.neck.bottom + r * 0.5 + Math.cos(a) * r * 0.25,
                layout.torso.lean + Math.cos(a) * r * 1.7,
            ]);
        }
        k.ring(loop, {
            ru: r * 0.85,
            rv: r * 0.6,
            color: wool,
            weights: collar,
        });
        k.tube(
            [0.97, 0.86, 0.72, 0.58].map((t, i) => ({
                at: k.torsoPoint(t, 0.5, 1.12 + i * 0.03),
                ru: r * 0.75,
                rv: r * 0.3,
                color: wool,
                weights: k.torsoWeights(t),
            })),
            { segments: 8, side: [1, 0, 0], end: "flat" }
        );

        // Tool belt with a buckle and a pouch on the left hip.
        const belt: Vec3[] = [];
        for (let j = 0; j < 22; j++)
            belt.push(k.torsoPoint(0.36, (j / 22) * PI * 2, 1.2));
        k.ring(belt, {
            ru: 0.02,
            rv: 0.008,
            color: leather,
            weights: k.torsoWeights(0.36),
        });
        k.blob({
            center: k.torsoPoint(0.36, 0, 1.26),
            radii: [0.028, 0.022, 0.01],
            color: colors.metal,
            weights: k.torsoWeights(0.36),
            outline: 0.5,
            rings: 5,
            segments: 8,
        });
        k.blob({
            center: k.torsoPoint(0.27, PI * 0.42, 1.35),
            radii: [0.035, 0.06, 0.045],
            color: k.hex("#5c3d28"),
            weights: k.mix(["hips", 0.7], ["leftUpperLeg", 0.3]),
            deform: (d) => [
                d[0],
                Math.sign(d[1]) * Math.pow(Math.abs(d[1]), 0.6),
                d[2],
            ],
        });
    },
};

export default tinker;
