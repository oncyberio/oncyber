import React, { useContext } from "react";
import { useIsoLayoutEffect } from "@components/hooks/useIsoLayoutEffect";
import { useRouter } from "next/router";
import locales from "locales";

const SUPPORTED_LANGUAGES: Locales[] = ["en", "ja", "ko", "zh"];

type Locales = "en" | "ja" | "ko" | "zh";

export interface I18nContextState {
    i18n: Locales;
    switchI18n: (key: string) => void;
    t: (key: TemplateStringsArray | string) => string;
}

export const I18nContext = React.createContext<I18nContextState>(null);

let navigatorLanguage =
    typeof window !== "undefined"
        ? window?.navigator?.language?.toLowerCase()
        : "en";

navigatorLanguage =
    navigatorLanguage && ["ja", "ko", "zh"].includes(navigatorLanguage)
        ? navigatorLanguage
        : "en";

export default function I18nProvider({ children }) {
    const router = useRouter();

    const local =
        router.query?.lang ||
        (typeof window !== "undefined"
            ? localStorage.getItem("i18n")
            : navigatorLanguage);

    const [i18n, setI18n] = React.useState<Locales>(local as Locales);

    const switchI18n = (lang: Locales) => {
        const local = SUPPORTED_LANGUAGES.includes(lang) ? lang : "en";
        localStorage.setItem("i18n", local);
        setI18n(lang);
    };

    const t = (key: TemplateStringsArray | string) => {
        const lang = SUPPORTED_LANGUAGES.includes(i18n) ? i18n : "en";
        return locales?.[lang as string]?.[key];
    };

    const value = { i18n, switchI18n, t };

    return (
        <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
    );
}

export function useCyberTranslation() {
    const context = useContext(I18nContext);

    if (!context) {
        throw Error(
            "useCyberTranslation needs to be called within I18nContext."
        );
    }

    return context;
}
