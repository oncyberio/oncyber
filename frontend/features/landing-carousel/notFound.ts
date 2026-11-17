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

/**
 * Narrower searches to offer when a search of several words finds nothing
 * (every word has to match): one per distinctive word, so "frahm genesis"
 * offers "frahm" and "genesis".
 */
export function searchWordSuggestions(query: string, max = 3): string[] {
    const words = (query || "").toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length < 2) return [];
    return [...new Set(words)]
        .filter((word) => word.length >= 3 && !/^\d+$/.test(word))
        .slice(0, max);
}

/**
 * Close matches for a search of several words that found nothing, from one
 * search per word: the rarest word's matches first (it says the most about
 * what was meant), without repeats, a few per word.
 */
export function closeMatches<T extends { id: string }>(
    groups: T[][],
    { perWord = 12, max = 24 } = {}
): T[] {
    const seen = new Set<string>();
    return [...groups]
        .filter((group) => group.length)
        .sort((a, b) => a.length - b.length)
        .flatMap((group) => group.slice(0, perWord))
        .filter((card) => !seen.has(card.id) && !!seen.add(card.id))
        .slice(0, max);
}
