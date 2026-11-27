import type { Look } from "./kernel/build";
import { BODY, Proportions } from "./rig";
import { BUILD, Build, FACE, FaceSpec } from "./parts/skinField";
import type { SkinPalette } from "./parts/skin";
import type { BrowStyle, EyeStyle } from "./parts/face";
import type { FacePaint } from "./paint/faceTexture";
import type { HairPalette } from "./parts/hair";
import type { AnyHairStyle } from "./parts/hairStyles";
import type { ShirtStyle, Waist } from "./parts/shirt";
import type { SkirtStyle } from "./parts/skirt";
import type { BeltStyle } from "./parts/belt";
import type { TieStyle } from "./parts/tie";
import type { SockStyle } from "./parts/socks";
import type { ShoeStyle } from "./parts/shoes";
import type {
    BadgeStyle,
    GlassesStyle,
    HeadphoneStyle,
    RadioStyle,
} from "./parts/accessories";
import type { TrouserStyle } from "./parts/trousers";

/** Everything that makes one procedural character. */
export interface CharacterSpec {
    id: string;
    name: string;
    proportions: Proportions;
    build: Build;
    face: FaceSpec;
    skin: SkinPalette;
    eyes: EyeStyle;
    brows: BrowStyle;
    facePaint: FacePaint;
    hair: { palette: HairPalette; style: AnyHairStyle; seed: number };
    waist: Waist;
    shirt: ShirtStyle;
    bottom: SkirtStyle | TrouserStyle;
    belt: BeltStyle;
    tie: TieStyle;
    socks: SockStyle;
    shoes: ShoeStyle;
    badge: BadgeStyle;
    glasses?: GlassesStyle;
    earrings?: { colour: string; size: number };
    /** A belt radio with an earpiece worn loose round the collar. */
    radio?: RadioStyle;
    /** Headphones round the neck, wired to a player on the belt. */
    headphones?: HeadphoneStyle;
    /** A band ring on the right ring finger. */
    ring?: string;
    /**
     * "studio" builds the character without textures, for shaders that
     * light it themselves; the default bakes shading into plain materials.
     */
    look?: Look;
    /** Mesh density relative to the default; 2 is twice as fine. */
    density?: number;
}

export const RUNNER: CharacterSpec = {
    id: "runner",
    name: "Runner",
    proportions: { ...BODY, headScale: 1.2 },
    build: { ...BUILD, waist: [0.114, 0.084] },
    face: FACE,
    skin: {
        base: "#f0cfbe",
        shade: "#c08a7a",
        flush: "#eda39c",
        underTop: "#d9d6d2",
        underBottom: "#2c3140",
    },
    eyes: {
        iris: "#3a2620",
        irisLight: "#6b4634",
        pupil: "#0c0908",
        white: "#f3ece6",
        irisRadius: 0.0086,
        gaze: [5, 1],
        lash: "#17110f",
        lashWidth: 0.0016,
        lashWing: 0.0042,
    },
    brows: {
        colour: "#231b19",
        path: [
            [0.0115, 1.5755],
            [0.022, 1.579],
            [0.035, 1.581],
            [0.0465, 1.5795],
            [0.0545, 1.5755],
        ],
        width: [0.0034, 0.003, 0.001],
    },
    facePaint: {
        lip: "#c97a76",
        lipLine: "#7d4543",
        blush: "#f0a3a2",
        blushStrength: 0.62,
        hatch: 0.5,
        eyeShade: "#dcaa9f",
        eyeShadeStrength: 0.34,
        freckle: "#b97e68",
        freckles: 0.22,
    },
    hair: {
        palette: { base: "#1d1a1b", sheen: "#6d7385", tip: "#3a2c28" },
        seed: 7,
        style: {
            kind: "ponytail",
            hairline: {
                centre: [0, 1.6, -0.012],
                front: [0, 1.633, 0.078],
                slope: 0.82,
                napeY: 1.5,
                temples: 0.006,
            },
            tie: [0, -0.66, -0.75],
            part: 0.004,
            tailLength: [0.15, 0.25],
            mess: 1,
            band: "#d5d9dc",
        },
    },
    waist: { y: 1.0, rx: 0.142, rz: 0.11, z: -0.002 },
    shirt: {
        cloth: "#e9e5df",
        shadow: "#9d9ba8",
        button: "#e4dfd6",
        ease: 0.04,
        sleeve: 0.56,
        rolled: true,
        folds: 1,
        open: 1,
        pocket: true,
        blouse: 1,
    },
    bottom: {
        kind: "skirt",
        cloth: "#2c303d",
        shadow: "#15171f",
        edge: "#565c6e",
        lining: "#121217",
        hemY: 0.625,
        hem: [0.268, 0.232],
        pleats: 22,
        depth: 0.023,
    },
    belt: {
        leather: "#1b1a1c",
        buckle: "#8d9199",
        loops: "#2c303d",
        height: 0.028,
    },
    tie: {
        colour: "#8ea7dc",
        stripe: "#eef1f8",
        back: "#1b1c22",
        length: 0.46,
        width: 0.036,
        loosen: 0.022,
        skew: 0.03,
        paired: true,
    },
    socks: {
        colour: "#f4f2ec",
        shadow: "#aeb0b8",
        top: 0.345,
        slouch: 1,
        ribs: 26,
        thickness: 0.004,
    },
    shoes: {
        leather: "#19181a",
        shine: "#8c93a6",
        sole: "#171617",
        lace: "#121113",
        sole_height: 0.03,
        chunk: 1,
        size: 1,
    },
    badge: {
        card: "#f4f3ef",
        holder: "#dfe3e6",
        ink: "#5a5d66",
        accent: "#7e9bd6",
        clip: "#8d9199",
        photo: false,
    },
    glasses: { frame: "#b9bcc4", radius: 0.0265, wire: 0.00085, drop: 0.004 },
    earrings: { colour: "#c8a04a", size: 0.0105 },
    radio: {
        body: "#1c1c1f",
        detail: "#2e2f34",
        cable: "#151517",
        angle: -0.95,
    },
};

export const STAGEHAND: CharacterSpec = {
    id: "stagehand",
    name: "Stagehand",
    proportions: {
        hips: [0, 1.025, 0],
        spine: [0, 1.095, 0.002],
        chest: [0, 1.195, 0.002],
        upperChest: [0, 1.31, 0],
        neck: [0, 1.458, -0.012],
        head: [0, 1.528, -0.002],
        shoulder: [0.026, 1.438, -0.008],
        upperArm: [0.188, 1.436, -0.014],
        lowerArm: [0.46, 1.436, -0.014],
        hand: [0.706, 1.436, -0.014],
        upperLeg: [0.1, 0.968, 0],
        lowerLeg: [0.1, 0.52, 0.002],
        foot: [0.1, 0.1, -0.014],
        toes: [0.1, 0.038, 0.105],
        handLength: 0.185,
        handScale: 1.1,
        headScale: 1.13,
    },
    build: {
        hips: [0.152, 0.104],
        waist: [0.124, 0.094],
        chest: [0.157, 0.104],
        bust: 0.12,
        seat: 0.9,
        neck: 0.051,
        arm: 1.03,
        thigh: 1.04,
        calf: 1.08,
        foot: 1.1,
    },
    face: {
        ...FACE,
        eye: [0.0305, 1.5555, 0],
        eyeRadius: 0.0162,
        lidRadius: 0.0176,
        upperLid: 15,
        lowerLid: -12,
        eyeTilt: 9,
        mouthY: 1.506,
        mouthWidth: 0.0138,
        lips: 0.82,
        noseTip: [0, 1.5265, 0],
        nose: 0.84,
        jaw: 0.049,
        jawRadius: 0,
        jawCone: 0.0575,
        chin: 0.0175,
        chinY: 1.4875,
        cheek: 0.8,
        brow: 0.0048,
        socket: 0.35,
        lowerLid_rim: 0,
    },
    skin: {
        base: "#d6a283",
        shade: "#a9705a",
        flush: "#d88f7c",
        underTop: "#d9d6d2",
        underBottom: "#2c3140",
    },
    eyes: {
        iris: "#2c1d18",
        irisLight: "#5b3a2b",
        pupil: "#0c0908",
        white: "#f1eae4",
        irisRadius: 0.0068,
        gaze: [0, 3],
        lash: "#17110f",
        lashWidth: 0.0019,
        lashWing: 0.0028,
    },
    brows: {
        colour: "#1b1514",
        path: [
            [0.008, 1.5685],
            [0.02, 1.5745],
            [0.034, 1.5795],
            [0.047, 1.5805],
            [0.055, 1.578],
        ],
        width: [0.0048, 0.0042, 0.0014],
    },
    facePaint: {
        lip: "#b47466",
        lipStrength: 0.6,
        lipLine: "#70453c",
        blush: "#dd9584",
        blushStrength: 0.28,
        hatch: 0,
        eyeShade: "#c08f7a",
        eyeShadeStrength: 0.12,
        freckle: "#a9705a",
        freckles: 0,
    },
    hair: {
        palette: { base: "#1e1a1a", sheen: "#74605a", tip: "#3b2a26" },
        seed: 11,
        style: {
            kind: "quiff",
            hairline: {
                centre: [0, 1.6, -0.012],
                front: [0, 1.631, 0.079],
                slope: 0.82,
                napeY: 1.505,
                temples: 0.004,
            },
            part: 0.012,
            top: [0.075, 0.12],
            lift: 0.036,
            sides: [0.022, 0.04],
            mess: 1,
        },
    },
    waist: { y: 1.09, rx: 0.136, rz: 0.106, z: -0.002 },
    shirt: {
        cloth: "#e6e5ec",
        shadow: "#8d96c6",
        button: "#e4dfd6",
        ease: 0.03,
        sleeve: 1,
        rolled: false,
        folds: 1.7,
        open: 0,
        pocket: true,
        blouse: 0.35,
    },
    bottom: {
        kind: "trousers",
        cloth: "#2d3142",
        shadow: "#161822",
        edge: "#5a6074",
        hemY: 0.3,
        hem: [0.135, 0.115],
        stance: 0.33,
        folds: 1,
    },
    belt: {
        leather: "#1b1a1c",
        buckle: "#8d9199",
        loops: "#2d3142",
        height: 0.03,
    },
    tie: {
        colour: "#3f6fd6",
        stripe: "#b9cdf4",
        back: "#1b2a55",
        length: 0.45,
        width: 0.04,
        loosen: 0,
        skew: 0.004,
        paired: true,
    },
    socks: {
        colour: "#f4f2ec",
        shadow: "#aeb0b8",
        top: 0.36,
        slouch: 0,
        ribs: 26,
        thickness: 0.003,
    },
    shoes: {
        leather: "#19181a",
        shine: "#8c93a6",
        sole: "#171617",
        lace: "#121113",
        sole_height: 0.024,
        chunk: 0.35,
        size: 1.1,
    },
    badge: {
        card: "#f4f3ef",
        holder: "#dfe3e6",
        ink: "#5a5d66",
        accent: "#7fb0e8",
        clip: "#8d9199",
        photo: true,
    },
    headphones: {
        shell: "#19191b",
        cushion: "#111113",
        cable: "#151517",
        player: 0.72,
    },
    ring: "#18181a",
    look: "studio",
    density: 1.8,
};

/** The built-in procedural characters, by id. */
export const CHARACTERS: Record<string, CharacterSpec> = {
    [RUNNER.id]: RUNNER,
    [STAGEHAND.id]: STAGEHAND,
};
