import type { LandingCard } from "./types";

/** Id of the card that says a link led nowhere. */
export const NOT_FOUND_CARD_ID = "not-found";

const SPACE_ID = /^[A-Za-z0-9]{16,}$/;

/**
 * Words to search for, read from a link that found nothing:
 * "/frahm-genesis" → "frahm genesis", "/@some_artist" → "some artist".
 * A bare space id ("/spaces/Gxy7Y4…") names nothing worth searching for.
 */
export function notFoundQuery(path: string): string {
    let segment = (path || "").split(/[?#]/)[0];
    try {
        segment = decodeURIComponent(segment);
    } catch {
        // A malformed escape: keep the raw text.
    }
    segment = segment.replace(/^\/+|\/+$/g, "");
    if (segment.startsWith("spaces/") || segment.startsWith("exhibits/")) {
        const id = segment.split("/")[1]?.trim() || "";
        if (!id || SPACE_ID.test(id)) return "";
        segment = id;
    }
    return segment
        .replace(/^@/, "")
        .replace(/[-_.+/]+/g, " ")
        .replace(/[^\p{L}\p{N} ]+/gu, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 60)
        .trim();
}

/** "frahm genesis" → "Frahm Genesis", for the card's title. */
function titleCase(words: string) {
    return words.replace(
        /(^|\s)(\p{L})/gu,
        (_, space, letter) => space + letter.toUpperCase()
    );
}

/**
 * The card that leads the grid when a link found nothing. It searches for the
 * link's words when there are some; without JavaScript it links to that
 * search.
 */
export function notFoundCard(query: string): LandingCard {
    const title = query
        ? `Could not find “${titleCase(query)}”`
        : "Could not find this world";
    const explanation = query
        ? "It may have moved. Search for it, or explore below."
        : "It may have moved or been removed. Explore below.";
    return {
        id: NOT_FOUND_CARD_ID,
        title,
        href: query ? `/?q=${encodeURIComponent(query)}` : "/",
        // Shown when the card is the large featured one.
        description: explanation,
        creator: "",
        owner: "",
        room: "",
        visits: 0,
        chains: [],
        collections: [],
        tags: [],
        imageUrls: [],
        portrait: false,
        buildStatus: explanation,
        actionLabel: query
            ? `${title}. Search for ${query}`
            : `${title}. Explore worlds`,
    };
}
