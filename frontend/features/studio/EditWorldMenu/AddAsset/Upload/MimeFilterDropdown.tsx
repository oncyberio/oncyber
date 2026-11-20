import styled from "styled-components";
import { tx } from "@components/context/I18nContext";
import { CustomDropdown } from "@features/studio/components/CustomDropdown";
import {
    brandMenuPanel,
    brandMenuRow,
} from "@features/studio/styles/brandMenu";

export const mimeFilterOpts = [
    { title: "All types", value: "all" },
    { title: "Images", value: "image" },
    { title: "Video", value: "video" },
    { title: "Audio", value: "audio" },
    { title: "3D models", value: "model" },
] as const;

export type MimeFilterOpt = (typeof mimeFilterOpts)[number]["value"];

export interface MimeFilterDropdownProps {
    value: MimeFilterOpt;
    onChange: (value: MimeFilterOpt) => unknown;
    addTogglerRef?: (el: HTMLDivElement) => void;
}

const Chevron = () => (
    <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <path d="m6 9 6 6 6-6" />
    </svg>
);

const Check = () => (
    <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
);

/** The uploads type filter: a brand menu, not the browser's select. */
export function MimeFilterDropdown({
    value,
    onChange,
    addTogglerRef,
}: MimeFilterDropdownProps) {
    const current =
        mimeFilterOpts.find((it) => it.value === value) ?? mimeFilterOpts[0];
    return (
        <CustomDropdown
            align="right"
            padding={6}
            addTogglerRef={addTogglerRef}
            caption={({ toggled }) => (
                <Filter
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={toggled}
                    aria-label={tx("Filter uploads")}
                >
                    {tx(current.title)}
                    <Chevron />
                </Filter>
            )}
        >
            {({ toggle }) => (
                <Menu
                    role="menu"
                    aria-label={tx("Filter uploads")}
                    onKeyDown={(e) => {
                        if (e.key !== "ArrowDown" && e.key !== "ArrowUp")
                            return;
                        e.preventDefault();
                        const rows = Array.from(
                            e.currentTarget.querySelectorAll<HTMLElement>(
                                "button"
                            )
                        );
                        const i = rows.indexOf(
                            document.activeElement as HTMLElement
                        );
                        const next =
                            e.key === "ArrowDown"
                                ? (i + 1) % rows.length
                                : (i - 1 + rows.length) % rows.length;
                        rows[next]?.focus();
                    }}
                >
                    {mimeFilterOpts.map((it) => (
                        <button
                            key={it.value}
                            type="button"
                            role="menuitemradio"
                            aria-checked={it.value === value}
                            autoFocus={it.value === value}
                            onClick={() => {
                                toggle(false);
                                onChange(it.value);
                            }}
                        >
                            {tx(it.title)}
                            {it.value === value && <Check />}
                        </button>
                    ))}
                </Menu>
            )}
        </CustomDropdown>
    );
}

const Filter = styled.button`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    box-sizing: border-box;
    min-height: 36px;
    padding: 0 10px 0 12px;
    border: 1px solid var(--studio-line);
    border-radius: var(--studio-radius-control);
    background: var(--studio-surface, #1c1c1f);
    color: var(--studio-secondary);
    font: 13px/1 var(--studio-font, sans-serif);
    white-space: nowrap;
    cursor: pointer;
    @media (max-width: 600px) {
        min-height: 40px;
    }
    > svg {
        color: var(--studio-muted);
        transition: transform 0.15s ease;
    }
    &[aria-expanded="true"] > svg {
        transform: rotate(180deg);
    }
    &:focus-visible {
        outline: 2px solid var(--studio-muted);
        // Keep the ring inside the control at the scroll viewport's edge.
        outline-offset: -2px;
    }
`;

const Menu = styled.div`
    ${brandMenuPanel}
    min-width: 168px;
    & > button {
        ${brandMenuRow}
    }
`;
