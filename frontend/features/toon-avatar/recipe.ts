/**
 * A toon avatar is a recipe: a small plain object of sliders, choices and
 * colours. Everything else (skeleton, mesh, face, motion) is built from it at
 * runtime, so an avatar travels as about a hundred characters of text instead
 * of a model file.
 *
 * The schema below is the single source for defaults, validation, the text
 * codec, random avatars and the maker's controls. Two rules keep saved
 * avatars readable forever:
 *
 * - Add new fields at the END of the last group, or in a new group after the
 *   last one. The codec writes fields in declaration order and fills fields
 *   an older code doesn't carry with their defaults.
 * - Add new choices at the END of a choice list. The codec stores the index.
 */

export type UnitField = { kind: "unit"; def: number; label: string };
export type ChoiceField<T extends string = string> = {
    kind: "choice";
    options: readonly T[];
    def: T;
    label: string;
};
export type ColorField = { kind: "color"; def: string; label: string };
export type Field = UnitField | ChoiceField | ColorField;

const unit = (def: number, label: string): UnitField => ({
    kind: "unit",
    def,
    label,
});
const choice = <T extends string>(
    options: readonly T[],
    def: T,
    label: string
): ChoiceField<T> => ({ kind: "choice", options, def, label });
const color = (def: string, label: string): ColorField => ({
    kind: "color",
    def,
    label,
});

export const EAR_STYLES = ["round", "none", "pointed", "big"] as const;
export const NOSE_STYLES = [
    "button",
    "none",
    "long",
    "pointed",
    "bulb",
    "snub",
] as const;
export const PUPIL_STYLES = ["dot", "spark", "slit", "ring", "wide"] as const;
export const LASH_STYLES = ["none", "upper", "wing"] as const;
export const BROW_STYLES = [
    "none",
    "line",
    "arched",
    "thick",
    "unibrow",
    "angled",
] as const;
export const MOUTH_STYLES = [
    "line",
    "smile",
    "frown",
    "smirk",
    "open",
    "grin",
    "oh",
    "wavy",
] as const;
export const HAIR_STYLES = [
    "short",
    "bald",
    "spikes",
    "ponytail",
    "bob",
    "long",
    "mohawk",
    "afro",
    "buns",
    "swoop",
    "flattop",
    "pigtails",
    "curly",
    "balding",
] as const;
export const FACIAL_HAIR_STYLES = [
    "none",
    "mustache",
    "handlebar",
    "goatee",
    "beard",
    "chinstrap",
    "soulpatch",
] as const;
export const TOP_STYLES = [
    "tee",
    "longsleeve",
    "tank",
    "hoodie",
    "turtleneck",
    "crop",
] as const;
export const TOP_PATTERNS = ["plain", "stripes", "band", "split"] as const;
export const OUTER_STYLES = ["none", "coat", "vest", "jacket"] as const;
export const BOTTOM_STYLES = ["pants", "shorts", "skirt", "flares"] as const;
export const SHOE_STYLES = ["flats", "sneakers", "boots", "barefoot"] as const;
export const GLASSES_STYLES = [
    "none",
    "round",
    "square",
    "shades",
    "visor",
] as const;
export const HAT_STYLES = ["none", "beanie", "cap", "headband"] as const;
export const EARRING_STYLES = ["none", "studs", "hoops"] as const;
export const WRIST_STYLES = ["none", "band", "watch"] as const;

export const TOON_AVATAR_SCHEMA = {
    body: {
        height: unit(0.5, "Height"),
        head: unit(0.5, "Head size"),
        neck: unit(0.4, "Neck"),
        shoulders: unit(0.4, "Shoulders"),
        chest: unit(0.4, "Chest"),
        waist: unit(0.45, "Waist"),
        hips: unit(0.45, "Hips"),
        belly: unit(0.2, "Belly"),
        torso: unit(0.5, "Torso length"),
        arms: unit(0.5, "Arm length"),
        limbs: unit(0.4, "Limb thickness"),
        hands: unit(0.5, "Hands"),
        feet: unit(0.5, "Feet"),
        slouch: unit(0.25, "Slouch"),
    },
    head: {
        width: unit(0.5, "Width"),
        height: unit(0.5, "Length"),
        depth: unit(0.5, "Depth"),
        jaw: unit(0.45, "Jaw"),
        chin: unit(0.4, "Chin"),
        crown: unit(0.4, "Crown"),
        square: unit(0.2, "Squareness"),
        cheeks: unit(0.3, "Cheeks"),
        ears: choice(EAR_STYLES, "round", "Ears"),
        earSize: unit(0.5, "Ear size"),
        nose: choice(NOSE_STYLES, "button", "Nose"),
        noseSize: unit(0.5, "Nose size"),
        noseHeight: unit(0.5, "Nose height"),
    },
    eyes: {
        size: unit(0.55, "Size"),
        spacing: unit(0.3, "Spacing"),
        height: unit(0.5, "Height"),
        tall: unit(0.3, "Tallness"),
        pupil: choice(PUPIL_STYLES, "dot", "Pupils"),
        pupilSize: unit(0.35, "Pupil size"),
        lids: unit(0.0, "Eyelids"),
        lashes: choice(LASH_STYLES, "none", "Lashes"),
        bags: unit(0.0, "Under-eye lines"),
        brows: choice(BROW_STYLES, "line", "Brows"),
        browWeight: unit(0.35, "Brow weight"),
        browHeight: unit(0.5, "Brow height"),
        browTilt: unit(0.5, "Brow tilt"),
        browColor: color("#2a211d", "Brow colour"),
    },
    mouth: {
        style: choice(MOUTH_STYLES, "smile", "Mouth"),
        width: unit(0.45, "Width"),
        height: unit(0.5, "Height"),
        curve: unit(0.5, "Curve"),
        open: unit(0.5, "Openness"),
        lips: unit(0.0, "Lip colour amount"),
        lipColor: color("#c2475a", "Lip colour"),
    },
    marks: {
        blush: unit(0.0, "Blush"),
        freckles: unit(0.0, "Freckles"),
        wrinkles: unit(0.0, "Forehead lines"),
        stubble: unit(0.0, "Stubble"),
        mole: unit(0.0, "Beauty mark"),
    },
    hair: {
        style: choice(HAIR_STYLES, "swoop", "Hair"),
        color: color("#2a211d", "Hair colour"),
        volume: unit(0.5, "Volume"),
        length: unit(0.5, "Length"),
        facial: choice(FACIAL_HAIR_STYLES, "none", "Facial hair"),
        facialColor: color("#2a211d", "Facial hair colour"),
    },
    outfit: {
        top: choice(TOP_STYLES, "tee", "Top"),
        topColor: color("#2f9e8f", "Top colour"),
        pattern: choice(TOP_PATTERNS, "plain", "Pattern"),
        accentColor: color("#ffffff", "Pattern colour"),
        outer: choice(OUTER_STYLES, "none", "Layer"),
        outerColor: color("#eef1f4", "Layer colour"),
        bottom: choice(BOTTOM_STYLES, "pants", "Bottom"),
        bottomColor: color("#3a3f4c", "Bottom colour"),
        shoes: choice(SHOE_STYLES, "flats", "Shoes"),
        shoeColor: color("#f2f2f2", "Shoe colour"),
    },
    extras: {
        glasses: choice(GLASSES_STYLES, "none", "Glasses"),
        glassesColor: color("#1c1c1c", "Frame colour"),
        hat: choice(HAT_STYLES, "none", "Headwear"),
        hatColor: color("#d94f4f", "Headwear colour"),
        earrings: choice(EARRING_STYLES, "none", "Earrings"),
        wrist: choice(WRIST_STYLES, "none", "Wrist"),
        metalColor: color("#e8c15a", "Jewellery colour"),
    },
    look: {
        skin: color("#e9b48c", "Skin"),
        ink: color("#241a17", "Ink"),
        line: unit(0.4, "Line weight"),
        shade: unit(0.35, "Shading"),
    },
} as const;

type Schema = typeof TOON_AVATAR_SCHEMA;
type FieldValue<F> = F extends ChoiceField<infer T>
    ? T
    : F extends UnitField
    ? number
    : string;

export type ToonAvatarRecipe = {
    -readonly [G in keyof Schema]: {
        -readonly [K in keyof Schema[G]]: FieldValue<Schema[G][K]>;
    };
};
export type ToonAvatarGroup = keyof Schema;

/** A recipe with any part left out; `normalizeRecipe` fills the rest. */
export type ToonAvatarRecipeInput = {
    [G in keyof ToonAvatarRecipe]?: Partial<ToonAvatarRecipe[G]>;
};

type FieldEntry = { group: string; key: string; field: Field };

/** Every field in declaration order. The codec depends on this order. */
export const TOON_AVATAR_FIELDS: readonly FieldEntry[] = Object.entries(
    TOON_AVATAR_SCHEMA
).flatMap(([group, fields]) =>
    Object.entries(fields).map(([key, field]) => ({
        group,
        key,
        field: field as Field,
    }))
);

const HEX = /^#[0-9a-f]{6}$/;

/** `#rgb`, `#RRGGBB` or `rrggbb` to lower-case `#rrggbb`; anything else is null. */
export function normalizeHex(value: unknown): string | null {
    if (typeof value !== "string") return null;
    let hex = value.trim().toLowerCase();
    if (!hex.startsWith("#")) hex = `#${hex}`;
    if (/^#[0-9a-f]{3}$/.test(hex))
        hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    return HEX.test(hex) ? hex : null;
}

function normalizeField(field: Field, value: unknown) {
    switch (field.kind) {
        case "unit": {
            const n = typeof value === "number" ? value : NaN;
            const clamped = Number.isFinite(n)
                ? Math.min(1, Math.max(0, n))
                : field.def;
            // One byte of precision, so a recipe equals its decoded code.
            return Math.round(clamped * 255) / 255;
        }
        case "choice":
            return field.options.includes(value as string) ? value : field.def;
        case "color":
            return normalizeHex(value) ?? field.def;
    }
}

/**
 * Returns a complete, valid recipe from anything: missing groups and fields
 * take their defaults, numbers clamp to 0..1, unknown choices and malformed
 * colours fall back. Safe to call on untrusted input (another visitor's
 * avatar); the result never carries extra keys.
 */
export function normalizeRecipe(input?: unknown): ToonAvatarRecipe {
    const source = (input && typeof input === "object" ? input : {}) as Record<
        string,
        Record<string, unknown> | undefined
    >;
    const out: Record<string, Record<string, unknown>> = {};
    for (const { group, key, field } of TOON_AVATAR_FIELDS) {
        const from = source[group];
        const value = from && typeof from === "object" ? from[key] : undefined;
        (out[group] ||= {})[key] = normalizeField(field, value);
    }
    return out as ToonAvatarRecipe;
}

export function defaultRecipe(): ToonAvatarRecipe {
    return normalizeRecipe();
}

export function cloneRecipe(recipe: ToonAvatarRecipe): ToonAvatarRecipe {
    return normalizeRecipe(recipe);
}

export function recipesEqual(a: ToonAvatarRecipe, b: ToonAvatarRecipe) {
    for (const { group, key } of TOON_AVATAR_FIELDS)
        if (a[group][key] !== b[group][key]) return false;
    return true;
}

/** A copy of `recipe` with one field changed (and validated). */
export function setRecipeField<G extends ToonAvatarGroup>(
    recipe: ToonAvatarRecipe,
    group: G,
    key: keyof ToonAvatarRecipe[G],
    value: unknown
): ToonAvatarRecipe {
    const field = (TOON_AVATAR_SCHEMA[group] as Record<string, Field>)[
        key as string
    ];
    return {
        ...recipe,
        [group]: { ...recipe[group], [key]: normalizeField(field, value) },
    };
}
