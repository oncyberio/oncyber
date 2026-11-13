import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import Icon from "./Icon";

export default function BottomSearch({
    value,
    onSearch,
    onChange,
    scope = "worlds",
}: {
    value: string;
    scope?: "worlds" | "templates" | "destinations" | "game" | "gaussian";
    onSearch: (query: string) => void;
    onChange?: (query: string) => void;
}) {
    const [query, setQuery] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => setQuery(value), [value, scope]);
    const templates = scope === "templates";
    const destinations = scope === "destinations";
    const creating = scope === "game" || scope === "gaussian";
    const contextLabel = scope === "game" ? "Game idea" : "Gallery name";
    const question =
        scope === "game"
            ? "What kind of game do you want to build?"
            : "What would you like to name your gallery?";

    return (
        <Search
            role={creating ? "form" : "search"}
            aria-label={
                creating
                    ? contextLabel
                    : templates
                    ? "Search templates"
                    : destinations
                    ? "Search my destinations"
                    : "Search worlds"
            }
            onSubmit={(event) => {
                event.preventDefault();
                onSearch(query.trim());
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
                        ? "Search gallery templates"
                        : destinations
                        ? "Search my destinations"
                        : "Search worlds, artists, and creators"
                }
                placeholder={
                    creating
                        ? question
                        : templates
                        ? "Search templates, artists, styles…"
                        : destinations
                        ? "Search destinations…"
                        : "Search worlds, artists, creators…"
                }
                aria-description={
                    scope === "worlds"
                        ? "Type / to choose Popular, Latest, or another world feed."
                        : templates
                        ? "Type / to choose a template category."
                        : undefined
                }
                enterKeyHint={creating ? "done" : "search"}
                autoComplete="off"
                value={query}
                onChange={(event) => {
                    setQuery(event.target.value);
                    onChange?.(event.target.value);
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
                            ? `Clear ${contextLabel.toLowerCase()}`
                            : templates
                            ? "Clear template search"
                            : destinations
                            ? "Clear destination search"
                            : "Clear world search"
                    }
                    onClick={() => {
                        setQuery("");
                        if (creating) onChange?.("");
                        else onSearch("");
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
