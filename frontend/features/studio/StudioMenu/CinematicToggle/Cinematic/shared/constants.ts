import { LAYOUT_TYPES } from "@components/_3DExhibit-v2/three/modules/cinematic/composer/constants";

export const LAYOUTS = {
    [LAYOUT_TYPES.SQUARE]: {
        width: 382,
        height: 382,
        format: "1440×1440",
        type: LAYOUT_TYPES.SQUARE,
    },
    [LAYOUT_TYPES.LANDSCAPE]: {
        width: 530,
        height: 299,
        format: "1920×1090",
        type: LAYOUT_TYPES.LANDSCAPE,
    },
    [LAYOUT_TYPES.PORTRAIT]: {
        width: 226,
        height: 400.6,
        format: "810×1440",
        type: LAYOUT_TYPES.PORTRAIT,
    },
};
