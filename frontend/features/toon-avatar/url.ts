import {
    decodeRecipe,
    encodeRecipe,
    TOON_AVATAR_CODE_MAX_LENGTH,
} from "./codec";
import { isAuthoredAvatarId } from "./authored/catalogue";
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

/** An avatar written as code is addressed by its id: `/studio/avatar?id=tinker`. */
export function authoredAvatarUrl(id: string, code?: string): string {
    return `${TOON_AVATAR_PATH}?id=${id}${code ? `&a=${code}` : ""}`;
}

/** An authored avatar may carry a code too: its own sliders, changed. */
export type ToonAvatarSource = { code?: string; id?: string };

/** What a maker address points at: a recipe code, an authored avatar, or nothing. */
export function toonAvatarSource(url: unknown): ToonAvatarSource | null {
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
    const a = parsed.searchParams.get("a");
    const code = a && decodeRecipe(a) ? a : undefined;
    const param = parsed.searchParams.get("id");
    const id = isAuthoredAvatarId(param) ? param : undefined;
    return code || id ? { code, id } : null;
}

/** The avatar code in a toon avatar address, absolute or site-relative; else null. */
export function toonAvatarCode(url: unknown): string | null {
    const source = toonAvatarSource(url);
    return source?.code ?? null;
}

export const isToonAvatarUrl = (url: unknown) => toonAvatarSource(url) !== null;

export function toonRecipeFromUrl(url: unknown): ToonAvatarRecipe | null {
    const code = toonAvatarCode(url);
    return code ? decodeRecipe(code) : null;
}
