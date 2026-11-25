import { resize } from "@utils/urlUtils";

/** A card is at most 146 px wide; this covers it on a 2× screen. */
export const AVATAR_THUMB_SIZE = 288;

/**
 * An avatar's picture at card size. Hosts that resize send a small WebP
 * instead of the original (wallet pictures are often thousands of pixels
 * wide); a picture from any other host is used as it is.
 */
export function avatarThumb(url?: string): string | undefined {
    if (!url) return undefined;
    try {
        return resize(url, AVATAR_THUMB_SIZE, AVATAR_THUMB_SIZE, "webp");
    } catch {
        return url;
    }
}

const warmed = new Set<string>();

/** Fetch pictures ahead of the cards that show them. Each is asked for once. */
export function warmAvatarThumbs(urls: readonly (string | undefined)[]) {
    if (typeof Image !== "function") return;
    for (const url of urls) {
        const src = avatarThumb(url);
        if (!src || warmed.has(src)) continue;
        warmed.add(src);
        const image = new Image();
        image.decoding = "async";
        image.src = src;
    }
}
