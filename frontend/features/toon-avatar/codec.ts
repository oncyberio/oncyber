import {
    TOON_AVATAR_FIELDS,
    normalizeRecipe,
    type ToonAvatarRecipe,
} from "./recipe";

/**
 * Text form of a recipe: `toon1.` followed by base64url bytes. One byte per
 * slider or choice, three per colour, in schema order. About 120 characters,
 * safe in a URL, a Firestore string field and a multiplayer message.
 */
export const TOON_AVATAR_PREFIX = "toon1.";

/** Longest code this version can produce, plus headroom for future fields. */
export const TOON_AVATAR_CODE_MAX_LENGTH = 512;

const ALPHABET =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function toBase64Url(bytes: number[]) {
    let out = "";
    for (let i = 0; i < bytes.length; i += 3) {
        const a = bytes[i];
        const b = bytes[i + 1];
        const c = bytes[i + 2];
        out += ALPHABET[a >> 2];
        out += ALPHABET[((a & 3) << 4) | ((b ?? 0) >> 4)];
        if (b === undefined) break;
        out += ALPHABET[((b & 15) << 2) | ((c ?? 0) >> 6)];
        if (c === undefined) break;
        out += ALPHABET[c & 63];
    }
    return out;
}

function fromBase64Url(text: string): number[] | null {
    const bytes: number[] = [];
    let buffer = 0;
    let bits = 0;
    for (const char of text) {
        const value = ALPHABET.indexOf(char);
        if (value < 0) return null;
        buffer = (buffer << 6) | value;
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            bytes.push((buffer >> bits) & 255);
        }
    }
    return bytes;
}

export function isToonAvatarCode(value: unknown): value is string {
    return typeof value === "string" && value.startsWith(TOON_AVATAR_PREFIX);
}

export function encodeRecipe(recipe: ToonAvatarRecipe): string {
    const valid = normalizeRecipe(recipe);
    const bytes: number[] = [];
    for (const { group, key, field } of TOON_AVATAR_FIELDS) {
        const value = valid[group][key];
        if (field.kind === "unit") bytes.push(Math.round(value * 255));
        else if (field.kind === "choice")
            bytes.push(field.options.indexOf(value));
        else {
            const rgb = parseInt(value.slice(1), 16);
            bytes.push((rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255);
        }
    }
    return TOON_AVATAR_PREFIX + toBase64Url(bytes);
}

/**
 * Reads a code back into a recipe, or returns null when the text isn't one.
 * A code from an older schema (fewer bytes) fills the rest with defaults; an
 * unknown choice index falls back to that field's default.
 */
export function decodeRecipe(code: unknown): ToonAvatarRecipe | null {
    if (!isToonAvatarCode(code)) return null;
    if (code.length > TOON_AVATAR_CODE_MAX_LENGTH) return null;
    const bytes = fromBase64Url(code.slice(TOON_AVATAR_PREFIX.length));
    if (!bytes) return null;
    const raw: Record<string, Record<string, unknown>> = {};
    let at = 0;
    for (const { group, key, field } of TOON_AVATAR_FIELDS) {
        const size = field.kind === "color" ? 3 : 1;
        if (at + size > bytes.length) break;
        let value: unknown;
        if (field.kind === "unit") value = bytes[at] / 255;
        else if (field.kind === "choice") value = field.options[bytes[at]];
        else
            value =
                "#" +
                ((bytes[at] << 16) | (bytes[at + 1] << 8) | bytes[at + 2])
                    .toString(16)
                    .padStart(6, "0");
        (raw[group] ||= {})[key] = value;
        at += size;
    }
    return normalizeRecipe(raw);
}
