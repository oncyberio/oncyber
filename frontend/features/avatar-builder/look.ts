export const bases = ["atelier", "relay"] as const;
export const expressionLabels = {
    neutral: "Neutral",
    happy: "Smile",
    surprised: "Surprise",
    angry: "Angry",
} as const;
export type Expression = keyof typeof expressionLabels;
export type Base = (typeof bases)[number];
export const palettes = {
    skin: [
        ["Porcelain", "#fff8f1"],
        ["Peach", "#ffdfc9"],
        ["Honey", "#eeb78f"],
        ["Bronze", "#c68766"],
        ["Umber", "#986344"],
        ["Espresso", "#694639"],
    ],
    hair: [
        ["Ink", "#373445"],
        ["Chestnut", "#875743"],
        ["Copper", "#d58158"],
        ["Shell", "#efb8c2"],
        ["Lilac", "#b3a4dc"],
        ["Ice", "#d6e1ee"],
        ["Teal", "#629eac"],
        ["Sable", "#595371"],
    ],
    eyes: [
        ["Honey", "#e4aa53"],
        ["Sea glass", "#70c8b3"],
        ["Cobalt", "#759fdf"],
        ["Amethyst", "#bc91dd"],
        ["Rose", "#d28eac"],
        ["Graphite", "#919cb4"],
    ],
    fabric: [
        ["Chalk", "#f8f4e9"],
        ["Sky", "#aac9ed"],
        ["Petal", "#ebadba"],
        ["Acid", "#d3ee7c"],
        ["Slate", "#9296b8"],
        ["Ink", "#545568"],
    ],
} as const;
export type Dye = keyof typeof palettes;
export type Look = {
    base: Base;
    skin: number;
    hair: number;
    eyes: number;
    fabric: number;
    cut: number;
    kit: number;
    jaw: number;
    eyeSize: number;
    frame: number;
    cheeks: number;
    nose: number;
    spacing: number;
};
export const cuts: Record<Base, string[]> = {
    atelier: ["Long layers", "Lob", "Bob"],
    relay: ["Long tail", "Short tail", "Crop"],
};
export const kits: Record<Base, string[]> = {
    atelier: ["Studio tee", "Club jersey", "Track tee"],
    relay: ["Field uniform", "Flight pack", "Full rig"],
};
export const starters: { name: string; look: Look }[] = [
    {
        name: "Sora",
        look: {
            base: "atelier",
            skin: 1,
            hair: 4,
            eyes: 3,
            fabric: 0,
            cut: 0,
            kit: 1,
            jaw: 47,
            eyeSize: 65,
            frame: 48,
            cheeks: 61,
            nose: 40,
            spacing: 48,
        },
    },
    {
        name: "Ren",
        look: {
            base: "relay",
            skin: 2,
            hair: 0,
            eyes: 0,
            fabric: 1,
            cut: 2,
            kit: 0,
            jaw: 66,
            eyeSize: 45,
            frame: 70,
            cheeks: 35,
            nose: 68,
            spacing: 56,
        },
    },
    {
        name: "Mika",
        look: {
            base: "atelier",
            skin: 3,
            hair: 3,
            eyes: 1,
            fabric: 1,
            cut: 2,
            kit: 2,
            jaw: 69,
            eyeSize: 72,
            frame: 58,
            cheeks: 69,
            nose: 48,
            spacing: 46,
        },
    },
    {
        name: "Yuki",
        look: {
            base: "relay",
            skin: 0,
            hair: 5,
            eyes: 2,
            fabric: 4,
            cut: 0,
            kit: 1,
            jaw: 35,
            eyeSize: 60,
            frame: 42,
            cheeks: 42,
            nose: 61,
            spacing: 53,
        },
    },
];
const fields = [
    "skin",
    "hair",
    "eyes",
    "fabric",
    "cut",
    "kit",
    "jaw",
    "eyeSize",
    "frame",
    "cheeks",
    "nose",
    "spacing",
] as const;
const limits = [
    palettes.skin.length - 1,
    palettes.hair.length - 1,
    palettes.eyes.length - 1,
    palettes.fabric.length - 1,
    2,
    2,
    100,
    100,
    100,
    100,
    100,
    100,
];
export function encodeLook(look: Look) {
    return ["v1", look.base, ...fields.map((k) => look[k])].join("-");
}
export function decodeLook(code: unknown): Look | undefined {
    if (typeof code !== "string" || code.length > 60) return;
    const [v, base, ...parts] = code.split("-");
    if (parts.length === fields.length - 3) parts.push("50", "50", "50");
    if (
        v !== "v1" ||
        !bases.includes(base as Base) ||
        parts.length !== fields.length
    )
        return;
    if (
        parts.some(
            (n, i) => !/^(0|[1-9]\d{0,2})$/.test(n) || Number(n) > limits[i]
        )
    )
        return;
    return {
        base: base as Base,
        ...Object.fromEntries(fields.map((k, i) => [k, Number(parts[i])])),
    } as Look;
}
export const modelUrl = (look: Look) => "/api/avatar-kit/" + encodeLook(look);
export const editUrl = (base: Base) => "/api/avatar-kit/edit-" + base;
export type Surface = {
    studioColor?: Dye;
    studioKit?: number;
    studioGear?: number;
    studioTail?: boolean;
};
export function visiblePart(part: Surface, look: Look) {
    return (
        (part.studioKit === undefined || part.studioKit === look.kit) &&
        (part.studioGear === undefined || part.studioGear <= look.kit) &&
        (!part.studioTail || look.cut !== 2)
    );
}
export function shapeWeights(look: Look): Record<string, number> {
    return {
        StudioCheeks: (look.cheeks - 50) / 50,
        StudioNose: (look.nose - 50) / 50,
        StudioSpacing: (look.spacing - 50) / 50,
        StudioJaw: (look.jaw - 50) / 50,
        StudioEyes: (look.eyeSize - 50) / 50,
        StudioFrame: (look.frame - 50) / 50,
        StudioHair:
            look.base === "atelier"
                ? [0, 0.62, 1][look.cut]
                : [0, 1, 0][look.cut],
    };
}
export function linearDye(dye: Dye, look: Look) {
    const hex = palettes[dye][look[dye]][1];
    return [1, 3, 5].map((i) => {
        const v = parseInt(hex.slice(i, i + 2), 16) / 255;
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
}
