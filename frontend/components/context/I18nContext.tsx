import React, { useCallback, useContext, useMemo, useState } from "react";
import { useIsoLayoutEffect } from "@components/hooks/useIsoLayoutEffect";
import { useRouter } from "next/router";
import {
    Language,
    LANGUAGE_STORAGE_KEY,
    isLanguage,
    pickLanguage,
    translate,
} from "locales/language";

export interface I18nContextState {
    i18n: Language;
    switchI18n: (key: string) => void;
    /**
     * Translates a key. Works as a tag (t`SETTINGS`) or a call
     * (t("My spaces"), t("Use {name} template", { name })).
     */
    t: (
        key: TemplateStringsArray | string,
        values?: Record<string, string | number>
    ) => string;
}

export const I18nContext = React.createContext<I18nContextState>(null);

// The language the provider last rendered with, for `tx`.
let activeLanguage: Language = "en";

/**
 * Translates outside a hook, in the language of the current render. For
 * screens that mount after the language is known (Studio); components that
 * must follow a live language switch use `useCyberTranslation`.
 */
export function tx(
    key: string,
    values?: Record<string, string | number>
): string;
export function tx<T>(key: T, values?: Record<string, string | number>): T;
export function tx(key: unknown, values?: Record<string, string | number>) {
    // Labels can arrive as elements; only text is looked up.
    return typeof key === "string"
        ? translate(activeLanguage, key, values)
        : key;
}

function readStored() {
    try {
        return localStorage.getItem(LANGUAGE_STORAGE_KEY);
    } catch {
        return null;
    }
}

function browserLanguages(): string[] {
    if (typeof navigator === "undefined") return [];
    if (navigator.languages?.length) return [...navigator.languages];
    return navigator.language ? [navigator.language] : [];
}

export default function I18nProvider({ children }) {
    const router = useRouter();
    const query = router?.query?.lang;

    // The server always renders English; the visitor's language is applied
    // before the first paint so hydration matches.
    const [i18n, setI18n] = useState<Language>("en");

    useIsoLayoutEffect(() => {
        setI18n(
            pickLanguage({
                query,
                stored: readStored(),
                browser: browserLanguages(),
            })
        );
    }, [query]);

    useIsoLayoutEffect(() => {
        // Next.js writes its own routing locale ("en") to <html lang> after
        // each navigation, so keep putting the visitor's language back.
        const html = document.documentElement;
        const apply = () => {
            if (html.lang !== i18n) html.lang = i18n;
        };
        apply();
        const observer = new MutationObserver(apply);
        observer.observe(html, { attributes: true, attributeFilter: ["lang"] });
        return () => observer.disconnect();
    }, [i18n]);

    activeLanguage = i18n;

    const switchI18n = useCallback((lang: string) => {
        const next = isLanguage(lang) ? lang : "en";
        try {
            localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
        } catch {
            // Private windows can refuse storage; the switch still applies.
        }
        setI18n(next);
    }, []);

    const value = useMemo<I18nContextState>(
        () => ({
            i18n,
            switchI18n,
            t: (key, values) =>
                translate(
                    i18n,
                    Array.isArray(key) ? key.join("") : (key as string),
                    values
                ),
        }),
        [i18n, switchI18n]
    );

    return (
        <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
    );
}

// Outside the provider (tests, isolated renders) the interface is English.
const ENGLISH: I18nContextState = {
    i18n: "en",
    switchI18n: () => {},
    t: (key, values) =>
        translate(
            "en",
            Array.isArray(key) ? key.join("") : (key as string),
            values
        ),
};

export function useCyberTranslation() {
    return useContext(I18nContext) || ENGLISH;
}
