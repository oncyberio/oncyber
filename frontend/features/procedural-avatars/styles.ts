import type { Character } from "./catalog";
import type { Point } from "./sculpt";
import type { Section } from "./drawing";

export type CrewNeck = {
    kind: "crew";
    /** Opening radii relative to the first torso section. Drops are in reference units. */
    width: number;
    depth: number;
    frontDrop: number;
    backDrop: number;
};

export const avatarStyles = {
    cartoon: {
        eyes: "sclera-and-pupil",
        neckline: {
            kind: "crew",
            width: 0.71,
            depth: 0.77,
            frontDrop: 4.8,
            backDrop: 1.1,
        },
    },
    sunshine: {
        eyes: "painted-visor",
        neckline: {
            kind: "crew",
            width: 0.67,
            depth: 0.84,
            frontDrop: 4,
            backDrop: 1.4,
        },
    },
    streetwear: {
        eyes: "inked-lids",
        neckline: {
            kind: "crew",
            width: 0.76,
            depth: 0.76,
            frontDrop: 8.5,
            backDrop: 1.8,
        },
    },
} as const satisfies Record<string, { eyes: string; neckline: CrewNeck }>;

export const styleOf = {
    morty: "cartoon",
    summer: "cartoon",
    rick: "cartoon",
    "rick-classic": "cartoon",
    sunshine: "sunshine",
    lux: "streetwear",
    remy: "streetwear",
    vale: "streetwear",
} as const satisfies Record<Character, keyof typeof avatarStyles>;

export function crewOpening(
    top: Section,
    neck: CrewNeck,
    count: number,
    center = (top[1] + top[2]) / 2
): Point[] {
    return Array.from({ length: count + 1 }, (_, i) => {
        const a = ((i % count) * 2 * Math.PI) / count,
            c = Math.cos(a);
        return [
            center + (top[2] - top[1]) * 0.5 * neck.width * Math.sin(a),
            top[0] +
                Math.max(0, c) * neck.frontDrop +
                Math.max(0, -c) * neck.backDrop,
            (top[4] ?? 0) + top[3] * neck.depth * c,
        ];
    });
}
