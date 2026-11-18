import {
    decodeRecipe,
    encodeRecipe,
    TOON_AVATAR_CODE_MAX_LENGTH,
} from "./codec";
import type { ToonAvatarRecipe } from "./recipe";

/** Where the maker lives. An avatar's address is a link to itself in the maker. */
export const TOON_AVATAR_PATH = "/studio/avatar";

/**
 * The address a toon avatar travels under wherever Oncyber expects a model
 * URL (saved settings, the lobby's multiplayer profile). It is a same-site
 * path, so it passes the checks model URLs already go through, and opening
 * it shows the avatar in the maker.
 */
export function toonAvatarUrl(recipe: ToonAvatarRecipe | string): string {
    const code = typeof recipe === "string" ? recipe : encodeRecipe(recipe);
    return `${TOON_AVATAR_PATH}?a=${code}`;
}

/** The avatar code in a toon avatar address, absolute or site-relative; else null. */
export function toonAvatarCode(url: unknown): string | null {
    if (
        typeof url !== "string" ||
        url.length > TOON_AVATAR_CODE_MAX_LENGTH + 256
    )
        return null;
    let parsed: URL;
    try {
        parsed = new URL(url, "https://oncyber.invalid");
    } catch {
        return null;
    }
    if (parsed.pathname !== TOON_AVATAR_PATH) return null;
    const code = parsed.searchParams.get("a");
    return code && decodeRecipe(code) ? code : null;
}

export const isToonAvatarUrl = (url: unknown) => toonAvatarCode(url) !== null;

export function toonRecipeFromUrl(url: unknown): ToonAvatarRecipe | null {
    const code = toonAvatarCode(url);
    return code ? decodeRecipe(code) : null;
}
