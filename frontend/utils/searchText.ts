export function normalizeSearch(value: string) {
    return value
        .replace(/(?:№|n[°º]|no\.?\s*|n)(?=\s*\d)/gi, " ")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim()
        .replace(/\s+/g, " ");
}
/** Numbered editions match n1/№1/No.1 without accidentally matching №10. */
export function matchesSearchText(text: string, query: string) {
    const haystack = normalizeSearch(text);
    const words = normalizeSearch(query).split(" ").filter(Boolean);
    const tokens = haystack.split(" ");
    return words.every((word) =>
        words.length > 1 && /^\d+$/.test(word)
            ? tokens.includes(word)
            : haystack.includes(word)
    );
}
