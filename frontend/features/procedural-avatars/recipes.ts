import type { OrbVisor } from "./orbVisor";
import families from "./families.json";
import {
    cartoonLayout,
    cartoonRecipe,
    tailorCartoon,
    type CartoonChanges,
    type CartoonDesign,
    type CastMember,
} from "./cartoonCast";
import type { ShirtMark } from "./shirtMark";
import type { OrbCollar, ShapeRecipe } from "./shapeRecipe";
import type { ReferenceLayout } from "./referenceProportions";
import type { Character } from "./catalog";
import { styleOf, type avatarStyles } from "./styles";
import type { Point } from "./sculpt";
import type { StreetLook } from "./streetwearRecipes";

/** All values are unitless proportions of the template. Swatches are sRGB. */
export interface AvatarRecipe {
    template: Character;
    shirtMark?: ShirtMark;
    plainJersey?: true;
    /** Hair rim in the fitted scalp plane, normalized by the family scalp radii. */
    crownOutline?: [number, number][];
    kitFit?: {
        collar: number;
        shoulders: number;
        waist: number;
        hem: number;
        sock: number;
        chestWidth?: number;
        width: number;
    };
    visor?: OrbVisor;
    orbPaint?: { top: string; bottom: string };
    orbCollar?: OrbCollar;
    armSpan?: number;
    limbWidth?: { arms: number; legs: number };
    sleeveCut?: { radius: number; lift: number };
    coatPanels?: { opening: number[]; lining: string };
    coatFit?: { hem: number; widths: number[] };
    orbOffset?: [number, number];
    sunRays?: [number, number][][];
    lapels?: { color: string; paths: [number, number][][] };
    eyeInk?: string;
    penOutline?: boolean;
    eyeShape?: { width: number; height: number; lift: number; pupil: number };
    cartoon?: CartoonDesign;
    shapes?: ShapeRecipe;
    inspectPaint?: boolean;
    layout?: ReferenceLayout;
    /** Tailor the existing streetwear patterns in their template's reference coordinates. */
    garments?: Partial<
        Pick<
            StreetLook,
            | "neckline"
            | "shirt"
            | "hemTilt"
            | "jeans"
            | "belt"
            | "folds"
            | "shoes"
            | "tee"
            | "denim"
            | "dye"
            | "print"
        >
    >;
    build?: number;
    legLength?: number;
    headWidth?: number;
    headHeight?: number;
    crownLength?: number;
    /** Radial tip length at eight clockwise directions, starting at image right. */
    crownProfile?: number[];
    jaw?: number;
    eyes?: number;
    depth?: number;
    palette?: Record<string, string>;
}
type Style = keyof typeof avatarStyles;
type TemplateFor<S extends Style> = {
    [K in Character]: (typeof styleOf)[K] extends S ? K : never;
}[Character];

/** Select a coherent rig, wardrobe and eye construction before applying proportions.
 * Low-level ShapeRecipe remains available for authoring an entirely new shape. */
export type StyleRecipe = {
    [S in Style]: Omit<
        AvatarRecipe,
        | "template"
        | "garments"
        | "shapes"
        | "layout"
        | "inspectPaint"
        | "cartoon"
    > & {
        style: S;
        character?: S extends "cartoon" ? CastMember : never;
        design?: S extends "cartoon" ? CartoonDesign : never;
        changes?: S extends "cartoon" ? CartoonChanges : never;
        template?: TemplateFor<S>;
        garments?: S extends "streetwear" ? AvatarRecipe["garments"] : never;
    };
}[Style];
const defaultLook = {
    cartoon: "morty",
    sunshine: "sunshine",
    streetwear: "remy",
} as const;
export function defineLook(input: StyleRecipe): AvatarRecipe {
    const {
        style,
        character,
        design,
        changes,
        template = defaultLook[style],
        ...options
    } = input;
    if (!Object.hasOwn(defaultLook, style) || styleOf[template] !== style)
        throw new Error(
            `Template ${template} does not belong to style ${style}`
        );
    if (options.garments && String(style) !== "streetwear")
        throw new Error(
            "Streetwear garment patterns require the streetwear style"
        );
    if (character || design || changes) {
        if (
            style !== "cartoon" ||
            input.template ||
            (character && design) ||
            (changes && !character)
        )
            throw new Error(
                "Select one cartoon character or supply its complete design"
            );
        if (design)
            return {
                template: "morty",
                cartoon: design,
                layout: cartoonLayout(design),
                ...options,
            };
        const cast = cartoonRecipe(character);
        if (!cast)
            throw new Error(`Unrecognized cartoon character ${character}`);
        if (!changes) return { ...cast, ...options };
        if (!cast.cartoon)
            throw new Error(
                "The fitted Rick accepts proportion and palette overrides"
            );
        const tailored = tailorCartoon(cast.cartoon, changes);
        return {
            template: cast.template,
            cartoon: tailored,
            layout: cartoonLayout(tailored),
            ...options,
        };
    }
    return { template, ...options };
}
export const bodyPaint = {
    lux: ["#ffdc8c", "#fff0a6", "#252328", "#485a62"],
    remy: ["#935b43", "#282121", "#28262a", "#595654"],
    vale: ["#ffdfb5", "#fff0cc", "#25232a", "#51566a"],
    morty: ["#f7b899", "#78502f", "#ffd65d", "#342b3b"],
    summer: ["#f6bd99", "#e78335", "#d859a4", "#f4e9e3"],
    "rick-classic": ["#dfbca2", "#b2d8e6", "#a4d2c3", "#93693f"],
    rick: ["#d5b8a1", "#b1d6e5", "#fff0cb", "#966137"],
    sunshine: ["#f32685", "#df2076", "#fffff7", "#18213a"],
};
export function studyRecipe(template: Character, seed?: number): AvatarRecipe {
    if (seed === undefined) return { template };
    let state = Math.imul(seed ^ 0x85ebca6b, 0x9e3779b1) >>> 0;
    state ^= state >>> 16;
    const random = () =>
        (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296;
    const range = (min: number, max: number) => min + random() * (max - min);
    const hue = () =>
        `hsl(${Math.round(range(0, 360))}, ${Math.round(
            range(42, 85)
        )}%, ${Math.round(range(32, 67))}%)`;
    const palette = Object.fromEntries(
        bodyPaint[template].map((color, i) => [
            color,
            i === 0 && template !== "sunshine"
                ? ["#935d44", "#ba805c", "#e2ac8a", "#f4c4a0", "#754a39"][
                      Math.floor(random() * 5)
                  ]
                : hue(),
        ])
    );
    return {
        template,
        build: range(0.78, 1.28),
        legLength: range(0.8, 1.18),
        headWidth: range(0.82, 1.25),
        headHeight: range(0.83, 1.18),
        jaw: range(0.79, 1.21),
        eyes: range(0.84, 1.16),
        depth: range(0.88, 1.18),
        palette,
    };
}
export function recipeTransform(
    recipe: AvatarRecipe,
    origin: number,
    floor: number,
    jaw: Point,
    hip: Point,
    customEyeLine?: number
) {
    const {
        build = 1,
        legLength = 1,
        headWidth = 1,
        headHeight = 1,
        depth = 1,
    } = recipe;
    const eyeLine =
        customEyeLine ??
        {
            morty: 255,
            summer: 183,
            rick: 88,
            "rick-classic": families["rick-classic"].eyeLine,
            sunshine: families.sunshine.eyeLine,
            lux: 185,
            remy: 82,
            vale: 126,
        }[recipe.template];
    const crownRoot =
        families[recipe.template as keyof typeof families]?.crownRoot;
    const kit = recipe.template === "sunshine" && recipe.kitFit;
    const stations = kit && [148, 171, 211, 336, 452, 543, floor];
    const shifts = kit && [
        0,
        kit.collar,
        kit.shoulders,
        kit.waist,
        kit.hem,
        kit.sock,
        0,
    ];
    return (
        point: Point,
        head = false,
        eyes = false,
        crown = false,
        pupil = false
    ): Point => {
        let [x, y, z] = point;
        if (
            crown &&
            crownRoot &&
            (recipe.crownLength !== undefined || recipe.crownProfile)
        ) {
            // Extend the part beyond its scalp ellipse, preserving its roots
            // and front-to-back sculpt. The brow and head keep their own shape.
            const [cx, cy, rx, ry] = crownRoot;
            const u = (x - cx) / rx,
                v = (y - cy) / ry;
            const radius = Math.hypot(u, v);
            if (radius > 1) {
                let length = recipe.crownLength ?? 1;
                if (recipe.crownProfile) {
                    const angle = ((Math.atan2(v, u) * 4) / Math.PI + 8) % 8;
                    const sector = Math.floor(angle);
                    const a = recipe.crownProfile[sector];
                    const b = recipe.crownProfile[(sector + 1) % 8];
                    length = Math.max(
                        0.45,
                        Math.min(
                            1.65,
                            length * (a + (b - a) * (angle - sector))
                        )
                    );
                }
                const scale = (length - 1) * (1 - 1 / radius);
                x += (x - cx) * scale;
                y += (y - cy) * scale;
            }
        }
        if (recipe.armSpan && !head && crownRoot) {
            // Extend both bone chains and their fabric from the upper chest.
            // Vertices inside the torso and on either leg keep their registration.
            const root = recipe.template === "sunshine" ? 56 : 38;
            const reach = Math.max(0, Math.abs(x - origin) - root);
            if (
                reach > 0 &&
                Math.abs(y - (recipe.template === "sunshine" ? 211 : 195)) < 54
            )
                x += Math.sign(x - origin) * reach * (recipe.armSpan - 1);
        }
        if (kit && !head && y > stations[0] && y < floor) {
            const span = Math.max(0, stations.findIndex((v) => v >= y) - 1);
            const t =
                (y - stations[span]) / (stations[span + 1] - stations[span]);
            const taper = Math.max(
                0,
                Math.min(1, (y - 219) / 67, (484 - y) / 122)
            );
            if (kit.chestWidth !== undefined) {
                // Move the shoulder socket and attached sleeve together. The
                // forearm keeps its length and the shorts have their own width.
                const chest = Math.max(
                    0,
                    Math.min(1, (y - 161) / 30, (376 - y) / 44)
                );
                const shoulder = Math.max(-84, Math.min(84, x - origin));
                x += shoulder * (kit.chestWidth - 1) * chest;
            }
            x += (x - origin) * (kit.width - 1) * taper;
            const trunkShift = shifts[span] * (1 - t) + shifts[span + 1] * t;
            // Across the shoulder seam, carry the arm by its socket. Mapping
            // the wrist through the collar-to-waist stretch would also scale
            // its thickness and tilt the grip as the collar moves.
            const sleeve = Math.max(
                0,
                Math.min(
                    1,
                    (Math.abs(point[0] - origin) - 56) / 50,
                    (271 - point[1]) / 25
                )
            );
            y +=
                (trunkShift + sleeve * (kit.shoulders - trunkShift)) *
                (floor - 10);
        }
        if (eyes && recipe.eyeShape && recipe.template === "rick-classic") {
            const [offset, cy, radius, irisOffset, irisY] =
                families["rick-classic"].orbit;
            const sign = x < jaw[0] ? -1 : 1;
            const cx = jaw[0] + sign * offset;
            const shape = recipe.eyeShape;
            if (pupil) {
                const irisX = jaw[0] + sign * irisOffset;
                x = irisX + (x - irisX) * shape.pupil;
                y = irisY + (y - irisY) * shape.pupil;
            }
            x = cx + (x - cx) * shape.width;
            y = cy + (y - cy) * shape.height + radius * shape.lift;
        }
        if (head && recipe.orbOffset && recipe.template === "sunshine") {
            x += recipe.orbOffset[0] * families.sunshine.crownRoot[2];
            y += recipe.orbOffset[1] * families.sunshine.crownRoot[3];
        }
        if (head) {
            const t = Math.max(
                0,
                Math.min(1, (y - eyeLine) / Math.max(1, jaw[1] - eyeLine))
            );
            x =
                jaw[0] +
                (x - jaw[0]) *
                    headWidth *
                    (1 + t * ((recipe.jaw ?? 1) - 1)) *
                    (eyes ? recipe.eyes ?? 1 : 1);
            y = jaw[1] + (y - jaw[1]) * headHeight;
        }
        return [
            origin + (x - origin) * build,
            floor -
                (floor - Math.max(hip[1], y)) * legLength +
                Math.min(0, y - hip[1]),
            z * depth,
        ];
    };
}
