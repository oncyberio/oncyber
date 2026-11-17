import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import styled from "styled-components";
import { useCyberTranslation } from "@components/context/I18nContext";
import {
    LANGUAGE_NAMES,
    SUPPORTED_LANGUAGES,
    type Language,
} from "locales/language";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import Icon from "./Icon";

/**
 * The header's language picker: the current language code, which opens a
 * small menu of languages, each named in its own language.
 */
export default function LanguageSwitch({ className }: { className?: string }) {
    const { i18n, switchI18n, t } = useCyberTranslation();
    const [open, setOpen] = useState(false);
    const root = useRef<HTMLDivElement>(null);
    const button = useRef<HTMLButtonElement>(null);
    const items = useRef<(HTMLButtonElement | null)[]>([]);
    const menuId = useId();

    const close = (refocus = false) => {
        setOpen(false);
        if (refocus) button.current?.focus();
    };

    useEffect(() => {
        if (!open) return;
        const current = SUPPORTED_LANGUAGES.indexOf(i18n);
        items.current[current]?.focus();
        const onPointerDown = (event: PointerEvent) => {
            if (!root.current?.contains(event.target as Node)) close();
        };
        document.addEventListener("pointerdown", onPointerDown);
        return () => document.removeEventListener("pointerdown", onPointerDown);
        // Focus moves to the current language only when the menu opens.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const choose = (language: Language) => {
        if (language !== i18n) {
            amplitude_logAnalyticsEvent("language_changed", {
                from: i18n,
                to: language,
            });
            switchI18n(language);
        }
        close(true);
    };

    const onMenuKeyDown = (event: KeyboardEvent) => {
        const index = items.current.indexOf(
            document.activeElement as HTMLButtonElement
        );
        const last = SUPPORTED_LANGUAGES.length - 1;
        const move = (next: number) => {
            event.preventDefault();
            items.current[next]?.focus();
        };
        if (event.key === "ArrowDown") move(index >= last ? 0 : index + 1);
        else if (event.key === "ArrowUp") move(index <= 0 ? last : index - 1);
        else if (event.key === "Home") move(0);
        else if (event.key === "End") move(last);
        else if (event.key === "Escape") {
            event.preventDefault();
            close(true);
        } else if (event.key === "Tab") close();
    };

    return (
        <Wrapper ref={root} className={className}>
            <button
                ref={button}
                type="button"
                className="language-button"
                aria-label={`${t("Language")}: ${LANGUAGE_NAMES[i18n]}`}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? menuId : undefined}
                onClick={() => setOpen((value) => !value)}
                onKeyDown={(event) => {
                    if (event.key === "ArrowDown" && !open) {
                        event.preventDefault();
                        setOpen(true);
                    }
                }}
            >
                {i18n.toUpperCase()}
                <Icon name="chevron" size={10} />
            </button>
            {open && (
                <div
                    id={menuId}
                    className="language-menu"
                    role="menu"
                    aria-label={t("Language")}
                    onKeyDown={onMenuKeyDown}
                >
                    <div className="menu-label" aria-hidden="true">
                        {t("Language")}
                    </div>
                    {SUPPORTED_LANGUAGES.map((language, index) => (
                        <button
                            key={language}
                            ref={(element) => {
                                items.current[index] = element;
                            }}
                            type="button"
                            role="menuitemradio"
                            aria-checked={language === i18n}
                            lang={language}
                            tabIndex={language === i18n ? 0 : -1}
                            onClick={() => choose(language)}
                        >
                            <span className="name">
                                {LANGUAGE_NAMES[language]}
                            </span>
                            {language === i18n ? (
                                <Icon name="check" size={14} />
                            ) : (
                                <span className="code" aria-hidden="true">
                                    {language.toUpperCase()}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </Wrapper>
    );
}

const Wrapper = styled.div`
    position: relative;
    display: inline-flex;

    .language-button {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 10px 2px;
        border: 0;
        background: none;
        color: var(--oc-secondary);
        font: 12px/1 var(--oc-mono);
        letter-spacing: 0.04em;
        cursor: pointer;
        transition: color 0.15s ease;
        svg {
            transition: transform 0.15s ease;
        }
        &:hover,
        &[aria-expanded="true"] {
            color: var(--oc-ink);
        }
        &[aria-expanded="true"] svg {
            transform: rotate(180deg);
        }
        &:focus-visible {
            outline: 2px solid var(--accent);
            outline-offset: 2px;
            border-radius: var(--oc-radius-control);
        }
    }

    .language-menu {
        position: absolute;
        top: calc(100% + 8px);
        right: -12px;
        z-index: 20;
        min-width: 192px;
        padding: 8px;
        border: 1px solid var(--oc-line);
        /* Desktop popovers: 24 px corners; their rows: 8 px. */
        border-radius: 24px;
        background: var(--oc-panel);
        box-shadow: 0 16px 40px #0006, 0 2px 8px #0003;
        animation: language-menu-in 0.14s ease-out;
    }

    .menu-label {
        padding: 8px 12px 4px;
        color: var(--oc-muted);
        font: 11px/1 var(--oc-mono);
        letter-spacing: 0.04em;
        text-transform: uppercase;
    }

    .language-menu button {
        display: flex;
        width: 100%;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        min-height: 40px;
        padding: 8px 12px;
        border: 0;
        border-radius: 8px;
        background: none;
        color: var(--oc-secondary);
        font: 14px/1.2 var(--oc-font);
        text-align: left;
        cursor: pointer;
        &:hover,
        &:focus-visible {
            background: var(--oc-hover);
            color: var(--oc-ink);
            outline: none;
        }
        &[aria-checked="true"] {
            color: var(--oc-ink);
        }
        .code {
            color: var(--oc-muted);
            font: 11px/1 var(--oc-mono);
            letter-spacing: 0.04em;
        }
        svg {
            color: var(--oc-ink);
        }
    }

    @keyframes language-menu-in {
        from {
            opacity: 0;
            transform: translateY(-4px);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .language-menu {
            animation: none;
        }
    }
`;
