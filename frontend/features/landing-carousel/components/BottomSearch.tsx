import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import Icon from "./Icon";
import { useCyberTranslation } from "@components/context/I18nContext";

export default function BottomSearch({
    value,
    onSearch,
    onChange,
    scope = "worlds",
    withSpaces = false,
    liveMs,
}: {
    value: string;
    /** Create also lists the visitor's own spaces, so search covers them. */
    withSpaces?: boolean;
    scope?: "worlds" | "templates" | "destinations" | "game" | "gaussian";
    /** `typed` is true for a search sent while typing (see `liveMs`). */
    onSearch: (query: string, typed?: boolean) => void;
    /**
     * Search while typing, this long after the last keystroke, with no need
     * for Enter. For lists that filter in place.
     */
    liveMs?: number;
    onChange?: (query: string) => void;
}) {
    const [query, setQuery] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);
    // What this field last searched for. The page's value catching up with
    // it must not overwrite what has been typed since.
    const sent = useRef<string>(null);
    const typing = useRef<ReturnType<typeof setTimeout>>();
    useEffect(() => {
        if (value !== sent.current) setQuery(value);
        sent.current = null;
    }, [value, scope]);
    useEffect(() => () => clearTimeout(typing.current), []);
    const search = (text: string, typed = false) => {
        clearTimeout(typing.current);
        sent.current = text.trim();
        onSearch(sent.current, typed);
    };
    const templates = scope === "templates";
    const destinations = scope === "destinations";
    const creating = scope === "game" || scope === "gaussian";
    const { t } = useCyberTranslation();
    const contextLabel = t(scope === "game" ? "Game idea" : "Gallery name");
    const question = t(
        scope === "game"
            ? "What kind of game do you want to build?"
            : "What would you like to name your gallery?"
    );

    return (
        <Search
            role={creating ? "form" : "search"}
            aria-label={
                creating
                    ? contextLabel
                    : templates
                    ? withSpaces
                        ? t("Search your worlds and templates")
                        : t("Search templates")
                    : destinations
                    ? t("Search my destinations")
                    : t("Search worlds")
            }
            onSubmit={(event) => {
                event.preventDefault();
                search(query);
            }}
        >
            {!creating && <Icon name="search" size={18} />}
            <input
                ref={inputRef}
                id="landing-search"
                type={creating ? "text" : "search"}
                maxLength={
                    scope === "game"
                        ? 12000
                        : scope === "gaussian"
                        ? 64
                        : undefined
                }
                aria-label={
                    creating
                        ? contextLabel
                        : templates
                        ? withSpaces
                            ? t("Search your worlds and gallery templates")
                            : t("Search gallery templates")
                        : destinations
                        ? t("Search my destinations")
                        : t("Search worlds, artists, and creators")
                }
                placeholder={
                    creating
                        ? question
                        : templates
                        ? withSpaces
                            ? t("Search your worlds and templates…")
                            : t("Search templates, artists, styles…")
                        : destinations
                        ? t("Search destinations…")
                        : t("Search worlds, artists, creators…")
                }
                aria-description={
                    scope === "worlds"
                        ? t(
                              "Type / to choose Popular, Latest, or another world feed."
                          )
                        : templates
                        ? t("Type / to choose a template category.")
                        : undefined
                }
                enterKeyHint={creating ? "done" : "search"}
                autoComplete="off"
                value={query}
                onChange={(event) => {
                    const text = event.target.value;
                    setQuery(text);
                    onChange?.(text);
                    if (liveMs == null || creating) return;
                    clearTimeout(typing.current);
                    typing.current = setTimeout(
                        () => search(text, true),
                        liveMs
                    );
                }}
                onKeyDown={(event) => {
                    if (event.nativeEvent.isComposing || event.keyCode === 229)
                        return;
                    if (event.key === "Escape") event.currentTarget.blur();
                }}
            />
            {query ? (
                <button
                    type="button"
                    aria-label={
                        creating
                            ? t("Clear {name}", {
                                  name: contextLabel.toLowerCase(),
                              })
                            : templates
                            ? withSpaces
                                ? t("Clear search")
                                : t("Clear template search")
                            : destinations
                            ? t("Clear destination search")
                            : t("Clear world search")
                    }
                    onClick={() => {
                        setQuery("");
                        if (creating) onChange?.("");
                        else search("");
                        inputRef.current?.focus();
                    }}
                >
                    <Icon name="close" size={14} />
                </button>
            ) : (
                <kbd aria-hidden="true">/</kbd>
            )}
        </Search>
    );
}

export const Search = styled.form`
    position: absolute;
    z-index: 4;
    left: 50%;
    bottom: calc(max(17.8svh, 76px) / 2 - var(--landing-control-height) / 2);
    transform: translateX(-50%);
    /* Reserve room for the pager and lobby button within the 7% gutters. */
    width: clamp(160px, min(34vw, calc(86vw - 440px)), 440px);
    height: var(--landing-control-height);
    display: flex;
    align-items: center;
    gap: var(--landing-control-gap);
    padding: 0 clamp(10px, 1.25vw, 16px);
    border: 1px solid var(--oc-line-strong);
    border-radius: var(--landing-control-radius);
    background: var(--oc-panel);
    color: var(--oc-muted);
    box-shadow: 0 4px 20px #00000014;
    transition: border-color var(--oc-standard), background var(--oc-standard);
    &:focus-within {
        border-color: #ffffff50;
        background: #1d1d1d;
    }
    > svg {
        flex-shrink: 0;
        width: clamp(16px, 1.40625vw, 18px);
        height: clamp(16px, 1.40625vw, 18px);
    }
    input {
        width: 100%;
        min-width: 0;
        padding: 0;
        border: 0;
        background: none;
        color: var(--oc-ink);
        font-size: var(--landing-control-font-size);
        outline: none !important;
        &::placeholder {
            color: var(--oc-muted);
        }
        &::-webkit-search-cancel-button {
            display: none;
        }
    }
    kbd {
        font-family: var(--oc-mono);
        font-size: 11px;
        padding: 1px 5px;
        border: 1px solid var(--oc-line);
        border-radius: 5px;
    }
    button {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        padding: 0;
        border: 0;
        border-radius: 9px;
        background: none;
        color: var(--oc-muted);
        cursor: pointer;
        transition: color var(--oc-fast), background var(--oc-fast);
    }
    button:hover {
        color: var(--oc-ink);
        background: var(--oc-hover);
    }
    @media (max-width: 700px) {
        /* Full width within the page gutters, clear of the controls below. */
        width: calc(100% - 40px);
        bottom: 100px;
        input {
            /* The viewport disables zoom, so iOS does not zoom into 14px. */
            font-size: 14px;
        }
    }
`;
