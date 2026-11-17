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
