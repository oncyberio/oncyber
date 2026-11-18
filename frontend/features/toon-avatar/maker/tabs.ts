import {
    CLOTH_COLORS,
    HAIR_COLORS,
    INK_COLORS,
    LIP_COLORS,
    METAL_COLORS,
    SKIN_TONES,
} from "../palette";
import type { ToonAvatarGroup } from "../recipe";
import type { StageFocus } from "./stage";

export type FieldRef = [group: ToonAvatarGroup, key: string];
export type MakerSection = { title: string; fields: FieldRef[] };
export type MakerTab = {
    id: string;
    label: string;
    /** What the camera frames while this tab is open. */
    focus: StageFocus;
    /** Groups "Shuffle" rerolls on this tab. */
    groups: ToonAvatarGroup[];
    sections: MakerSection[];
};

/** The maker's tabs: which controls appear where, in reading order. */
export const MAKER_TABS: MakerTab[] = [
    {
        id: "starters",
        label: "Starters",
        focus: "body",
        groups: [],
        sections: [],
    },
    {
        id: "body",
        label: "Body",
        focus: "body",
        groups: ["body"],
        sections: [
            {
                title: "Frame",
                fields: [
                    ["body", "height"],
                    ["body", "head"],
                    ["body", "torso"],
                    ["body", "neck"],
                    ["body", "slouch"],
                ],
            },
            {
                title: "Build",
                fields: [
                    ["body", "shoulders"],
                    ["body", "chest"],
                    ["body", "waist"],
                    ["body", "hips"],
                    ["body", "belly"],
                ],
            },
            {
                title: "Limbs",
                fields: [
                    ["body", "limbs"],
                    ["body", "arms"],
                    ["body", "hands"],
                    ["body", "feet"],
                ],
            },
            { title: "Skin", fields: [["look", "skin"]] },
        ],
    },
    {
        id: "head",
        label: "Head",
        focus: "head",
        groups: ["head"],
        sections: [
            {
                title: "Shape",
                fields: [
                    ["head", "width"],
                    ["head", "height"],
                    ["head", "depth"],
                    ["head", "jaw"],
                    ["head", "chin"],
                    ["head", "crown"],
                    ["head", "square"],
                    ["head", "cheeks"],
                ],
            },
            {
                title: "Nose",
                fields: [
                    ["head", "nose"],
                    ["head", "noseSize"],
                    ["head", "noseHeight"],
                ],
            },
            {
                title: "Ears",
                fields: [
                    ["head", "ears"],
                    ["head", "earSize"],
                ],
            },
        ],
    },
    {
        id: "eyes",
        label: "Eyes",
        focus: "head",
        groups: ["eyes"],
        sections: [
            {
                title: "Eyes",
                fields: [
                    ["eyes", "size"],
                    ["eyes", "spacing"],
                    ["eyes", "height"],
                    ["eyes", "tall"],
                    ["eyes", "lids"],
                    ["eyes", "bags"],
                ],
            },
            {
                title: "Pupils",
                fields: [
                    ["eyes", "pupil"],
                    ["eyes", "pupilSize"],
                ],
            },
            { title: "Lashes", fields: [["eyes", "lashes"]] },
            {
                title: "Brows",
                fields: [
                    ["eyes", "brows"],
                    ["eyes", "browWeight"],
                    ["eyes", "browHeight"],
                    ["eyes", "browTilt"],
                    ["eyes", "browColor"],
                ],
            },
        ],
    },
    {
        id: "mouth",
        label: "Mouth",
        focus: "head",
        groups: ["mouth", "marks"],
        sections: [
            {
                title: "Mouth",
                fields: [
                    ["mouth", "style"],
                    ["mouth", "width"],
                    ["mouth", "height"],
                    ["mouth", "curve"],
                    ["mouth", "open"],
                ],
            },
            {
                title: "Lips",
                fields: [
                    ["mouth", "lips"],
                    ["mouth", "lipColor"],
                ],
            },
            {
                title: "Marks",
                fields: [
                    ["marks", "blush"],
                    ["marks", "freckles"],
                    ["marks", "wrinkles"],
                    ["marks", "stubble"],
                    ["marks", "mole"],
                ],
            },
        ],
    },
    {
        id: "hair",
        label: "Hair",
        focus: "head",
        groups: ["hair"],
        sections: [
            {
                title: "Hair",
                fields: [
                    ["hair", "style"],
                    ["hair", "color"],
                    ["hair", "volume"],
                    ["hair", "length"],
                ],
            },
            {
                title: "Facial hair",
                fields: [
                    ["hair", "facial"],
                    ["hair", "facialColor"],
                ],
            },
        ],
    },
    {
        id: "outfit",
        label: "Outfit",
        focus: "body",
        groups: ["outfit"],
        sections: [
            {
                title: "Top",
                fields: [
                    ["outfit", "top"],
                    ["outfit", "topColor"],
                    ["outfit", "pattern"],
                    ["outfit", "accentColor"],
                ],
            },
            {
                title: "Layer",
                fields: [
                    ["outfit", "outer"],
                    ["outfit", "outerColor"],
                ],
            },
            {
                title: "Bottom",
                fields: [
                    ["outfit", "bottom"],
                    ["outfit", "bottomColor"],
                ],
            },
            {
                title: "Shoes",
                fields: [
                    ["outfit", "shoes"],
                    ["outfit", "shoeColor"],
                ],
            },
        ],
    },
    {
        id: "extras",
        label: "Extras",
        focus: "torso",
        groups: ["extras"],
        sections: [
            {
                title: "Glasses",
                fields: [
                    ["extras", "glasses"],
                    ["extras", "glassesColor"],
                ],
            },
            {
                title: "Headwear",
                fields: [
                    ["extras", "hat"],
                    ["extras", "hatColor"],
                ],
            },
            {
                title: "Jewellery",
                fields: [
                    ["extras", "earrings"],
                    ["extras", "wrist"],
                    ["extras", "metalColor"],
                ],
            },
        ],
    },
    {
        id: "look",
        label: "Ink",
        focus: "body",
        groups: ["look"],
        sections: [
            {
                title: "Line and shade",
                fields: [
                    ["look", "ink"],
                    ["look", "line"],
                    ["look", "shade"],
                ],
            },
        ],
    },
];

const PALETTES: Record<string, string[]> = {
    "look.skin": SKIN_TONES,
    "look.ink": INK_COLORS,
    "hair.color": HAIR_COLORS,
    "hair.facialColor": HAIR_COLORS,
    "eyes.browColor": HAIR_COLORS,
    "mouth.lipColor": LIP_COLORS,
    "extras.metalColor": METAL_COLORS,
};

export const paletteFor = (group: string, key: string) =>
    PALETTES[`${group}.${key}`] || CLOTH_COLORS;

const OPTION_LABELS: Record<string, string> = {
    longsleeve: "Long sleeve",
    turtleneck: "Turtleneck",
    flattop: "Flat top",
    soulpatch: "Soul patch",
    chinstrap: "Chinstrap",
    handlebar: "Handlebar",
    unibrow: "Unibrow",
    oh: "Oh",
};

export const optionLabel = (option: string) =>
    OPTION_LABELS[option] || option.charAt(0).toUpperCase() + option.slice(1);
