import styled from "styled-components";
import { useCyberTranslation } from "@components/context/I18nContext";
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES } from "locales/language";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";

/**
 * A compact language picker: shows the current language code and opens the
 * browser's own list, so it works the same with a mouse, keyboard or phone.
 */
export default function LanguageSwitch({ className }: { className?: string }) {
    const { i18n, switchI18n, t } = useCyberTranslation();
    return (
        <Wrapper className={className}>
            <span className="code" aria-hidden="true">
                {i18n.toUpperCase()}
            </span>
            <select
                aria-label={t("Language")}
                value={i18n}
                onChange={(event) => {
                    amplitude_logAnalyticsEvent("language_changed", {
                        from: i18n,
                        to: event.target.value,
                    });
                    switchI18n(event.target.value);
                }}
            >
                {SUPPORTED_LANGUAGES.map((language) => (
                    <option key={language} value={language} lang={language}>
                        {LANGUAGE_NAMES[language]}
                    </option>
                ))}
            </select>
        </Wrapper>
    );
}

const Wrapper = styled.label`
    position: relative;
    display: inline-flex;
    align-items: center;
    padding: 10px 0;
    color: var(--oc-secondary);
    font: 12px/1 var(--oc-mono);
    letter-spacing: 0.04em;
    cursor: pointer;
    &:hover {
        color: var(--oc-ink);
    }
    &:focus-within {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
        border-radius: var(--oc-radius-control);
    }
    select {
        position: absolute;
        inset: 0;
        width: 100%;
        opacity: 0;
        cursor: pointer;
        font-size: 16px;
    }
`;
