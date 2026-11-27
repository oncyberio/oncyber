/**
 * What turns a figure into a character: colours, how its features are
 * drawn, and what of its face is reshaped. A figure file holds a bare
 * humanoid and nothing painted; a style is everything else, and it is a
 * few numbers. A new character is a new style.
 *
 * Colours are what the surface looks like in full light.
 */
export interface FigureStyle {
    id: string;
    name: string;
    skin: {
        tone: string;
        /**
         * The colour light takes on inside the skin: it warms the edge of
         * every shadow, the creases, and flesh thin enough to glow.
         */
        scatter: string;
        /** Flushed skin: cheeks, the tip of the nose, ears, knuckles. */
        blush: string;
        /** How much of the blush shows, 0–1. */
        flush: number;
        /** 0 is matte, 1 has a clear sheen on the nose and cheekbones. */
        sheen: number;
    };
    /**
     * The eyes. Lengths here and for the lids and brows are in eye
     * widths: 1 is the distance between an eye's two corners, seen from
     * the front, so the same numbers suit any figure.
     */
    eyes: {
        white: string;
        /** The iris at its rim and towards its middle, then the pupil. */
        iris: string;
        irisLight: string;
        pupil: string;
        /** Radius of the iris, and of the pupil as a part of it. */
        radius: number;
        pupilSize: number;
        /** The iris's middle: [out from the inner corner, up from it]. */
        at: [number, number];
        /**
         * Catchlights: [to the viewer's right, up, radius], each as a
         * part of the iris's radius. They sit the same way in both eyes.
         */
        glints: [number, number, number][];
        /** How deep the lid's shadow falls over the eye, 0–1. */
        shade: number;
    };
    lids: {
        colour: string;
        /**
         * Thickness of the line along the upper lid at the inner corner,
         * the middle and the outer corner; and the same below.
         */
        upper: [number, number, number];
        lower: [number, number, number];
        /**
         * A flick past the outer corner: how far the line runs on, and
         * how far its point lifts off the lid's own edge.
         */
        wing: [number, number];
        /** The fold above the lid: how far above, and how wide a line. */
        crease: [number, number];
    };
    brows: {
        colour: string;
        /**
         * The brow's centre line from the nose to the temple, each point
         * [out from the eye's inner corner, up from it]. Left out, the
         * brow stays where the figure has it and only takes `width`.
         */
        path?: [number, number][];
        /** Thickness at each point of the path, or at even steps along. */
        width: number[];
    };
    mouth: {
        /** The line between the lips. */
        line: string;
        /** Its thickness, as a part of the mouth's width. */
        lineWidth: number;
        /** The lips' own colour, and how much of it shows, 0–1. */
        lip: string;
        lipTint: number;
    };
    underwear: {
        colour: string;
        band: string;
        /**
         * Heights of the waistband and the hem, as parts of the height of
         * the hip joint off the floor.
         */
        waist: number;
        hem: number;
    };
    shape: FigureShape;
}

/** A place every figure's face has. */
export type FaceLandmark = "eye" | "nose" | "mouth" | "chin" | "jaw" | "ear";

/**
 * A local change to the face: a soft-edged region round a landmark found
 * on the figure itself, so a style does not depend on which figure it is
 * applied to. Everything in reach moves together (skin, lids, the eye
 * behind them), and every expression is carried along, so a reshaped eye
 * still closes.
 */
export interface FaceFeature {
    /** What it is for; not used by the code. */
    name: string;
    at: FaceLandmark;
    /** Moved from the landmark: [outwards, up, forwards]. */
    offset?: [number, number, number];
    /** How far the change reaches; it fades to nothing at this distance. */
    radius: number;
    /** Scale about that point: [across, up, front to back]. */
    scale?: [number, number, number];
    /** Shift: [outwards, up, forwards]. */
    move?: [number, number, number];
    /** Turn about the forward axis, degrees; outer side up is positive. */
    turn?: number;
}

export interface FigureShape {
    /**
     * Expressions of the figure (by the end of their morph's name, such
     * as `EYE_Angry`) that this character wears all the time.
     */
    morphs: Record<string, number>;
    features: FaceFeature[];
}

/** The figure as it comes: fair, brown-eyed, in plain shorts. */
export const PLAIN_STYLE: FigureStyle = {
    id: "plain",
    name: "Plain",
    skin: {
        tone: "#f3cdb6",
        scatter: "#e8502f",
        blush: "#f0a08e",
        flush: 0.5,
        sheen: 0.4,
    },
    eyes: {
        white: "#fbf7f4",
        iris: "#4a2c1c",
        irisLight: "#a56a3c",
        pupil: "#140c09",
        radius: 0.26,
        pupilSize: 0.42,
        at: [0.48, 0.07],
        glints: [
            [-0.36, 0.4, 0.26],
            [0.36, -0.4, 0.1],
        ],
        shade: 0.45,
    },
    lids: {
        colour: "#2a1a16",
        upper: [0.018, 0.042, 0.05],
        lower: [0, 0.008, 0.02],
        wing: [0.09, 0.03],
        crease: [0.11, 0.01],
    },
    brows: {
        colour: "#3a2620",
        width: [0.11, 0.12, 0.105, 0.075, 0.02],
    },
    mouth: {
        line: "#7d3f33",
        lineWidth: 0.015,
        lip: "#d98374",
        lipTint: 0.3,
    },
    underwear: {
        colour: "#e9e7ec",
        band: "#c9c6cf",
        waist: 0.985,
        hem: 0.8,
    },
    // The figure rests with its lips a hair apart.
    shape: { morphs: { MTH_Close: 1 }, features: [] },
};

/**
 * The Stagehand, from his character sheet: tan skin, small dark irises
 * under flat, slanted lids, and heavy brows that start low by the nose
 * and climb to a corner over the outside of each eye.
 */
export const STAGEHAND_STYLE: FigureStyle = {
    id: "stagehand",
    name: "Stagehand",
    skin: {
        tone: "#c98162",
        scatter: "#d2402a",
        blush: "#c45f4a",
        flush: 0.55,
        sheen: 0.2,
    },
    eyes: {
        white: "#f6f1ee",
        iris: "#2a1714",
        irisLight: "#4c2b21",
        pupil: "#120a09",
        radius: 0.215,
        pupilSize: 0.45,
        at: [0.4, 0.12],
        glints: [[-0.3, 0.42, 0.09]],
        shade: 0.55,
    },
    lids: {
        colour: "#1a1213",
        upper: [0.04, 0.06, 0.066],
        lower: [0.004, 0.006, 0.014],
        wing: [0.07, 0.035],
        crease: [0, 0],
    },
    brows: {
        colour: "#1d1517",
        path: [
            [-0.31, 0.27],
            [0.37, 0.53],
            [0.83, 0.76],
            [1.2, 0.74],
        ],
        width: [0.19, 0.23, 0.25, 0.02],
    },
    mouth: {
        line: "#6e3328",
        lineWidth: 0.02,
        lip: "#b9604f",
        lipTint: 0.22,
    },
    underwear: {
        colour: "#2d3550",
        band: "#1d2238",
        waist: 0.985,
        hem: 0.8,
    },
    shape: {
        // Lids lowered and slanted towards the nose; a set mouth.
        morphs: {
            MTH_Close: 1,
            EYE_Angry: 2,
            EYE_Close: 0.25,
            MTH_Sorrow: 0.7,
        },
        features: [
            {
                // Larger and closer set, tilted up at the outside.
                name: "eyes",
                at: "eye",
                radius: 0.05,
                scale: [1.3, 1.3, 1],
                move: [-0.004, 0, 0],
                turn: 10,
            },
            {
                // A real nose: broader, and standing further off the face.
                name: "nose",
                at: "nose",
                offset: [0, 0.004, -0.004],
                radius: 0.03,
                scale: [1.5, 1.1, 1.15],
                move: [0, -0.002, 0.003],
            },
            {
                name: "small mouth",
                at: "mouth",
                radius: 0.04,
                scale: [0.75, 1, 1],
            },
        ],
    },
};

/** The styles there are, by id. */
export const FIGURE_STYLES: Record<string, FigureStyle> = {
    [PLAIN_STYLE.id]: PLAIN_STYLE,
    [STAGEHAND_STYLE.id]: STAGEHAND_STYLE,
};
