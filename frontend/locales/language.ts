import locales from "locales";

/**
 * The languages the interface speaks, and how a visitor's language is
 * chosen. Kept free of React so the provider and tests share one rule.
 *
 * Keys: the older in-space strings use UPPER_SNAKE keys that every locale
 * defines. Newer strings (landing, sign-in, Studio) use the English text
 * itself as the key, so a missing translation shows the English.
 */
export const SUPPORTED_LANGUAGES = ["en", "es", "ja", "ko", "zh"] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

/** Names shown in a language switch, each in its own language. */
export const LANGUAGE_NAMES: Record<Language, string> = {
    en: "English",
    es: "Español",
    ja: "日本語",
    ko: "한국어",
    zh: "中文",
};

export const LANGUAGE_STORAGE_KEY = "i18n";

export function isLanguage(value: unknown): value is Language {
    return (
        typeof value === "string" &&
        (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
    );
}

/**
 * Maps a browser tag such as "es-MX" or "zh-Hant-TW" to a supported
 * language, or null.
 */
export function matchLanguage(tag: unknown): Language | null {
    if (typeof tag !== "string") return null;
    const base = tag.trim().toLowerCase().split(/[-_]/)[0];
    return isLanguage(base) ? base : null;
}

/**
 * Picks the language: an explicit ?lang= first, then the visitor's saved
 * choice, then the first supported browser language, then English.
 */
export function pickLanguage({
    query,
    stored,
    browser = [],
}: {
    query?: unknown;
    stored?: unknown;
    browser?: readonly string[];
}): Language {
    const fromQuery = matchLanguage(Array.isArray(query) ? query[0] : query);
    if (fromQuery) return fromQuery;
    if (isLanguage(stored)) return stored;
    for (const tag of browser) {
        const match = matchLanguage(tag);
        if (match) return match;
    }
    return "en";
}

type Dictionary = Record<string, string>;

/**
 * Looks a key up in the language, then in English, then returns the key
 * itself. `{name}` placeholders are filled from `values`.
 */
export function translate(
    language: Language,
    key: string,
    values?: Record<string, string | number>
): string {
    // Callers pass optional fields straight through; give those back as is.
    if (typeof key !== "string" || !key) return key;
    const dictionaries = locales as unknown as Record<Language, Dictionary>;
    // Own keys only, so "constructor" or "toString" never reach the prototype.
    const lookup = (dict?: Dictionary) =>
        dict && Object.prototype.hasOwnProperty.call(dict, key)
            ? dict[key]
            : undefined;
    const text =
        lookup(dictionaries[language]) ?? lookup(dictionaries.en) ?? key;
    if (!values) return text;
    return text.replace(/\{(\w+)\}/g, (match, name) =>
        name in values ? String(values[name]) : match
    );
}
