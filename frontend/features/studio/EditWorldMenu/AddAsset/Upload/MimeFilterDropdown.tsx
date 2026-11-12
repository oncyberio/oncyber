import styled from "styled-components";

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

export function MimeFilterDropdown({
    value,
    onChange,
    addTogglerRef,
}: MimeFilterDropdownProps) {
    return (
        <Filter ref={addTogglerRef}>
            <select
                aria-label="Filter uploads"
                value={value}
                onChange={(e) => onChange(e.target.value as MimeFilterOpt)}
            >
                {mimeFilterOpts.map((it) => (
                    <option key={it.value} value={it.value}>
                        {it.title}
                    </option>
                ))}
            </select>
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
        </Filter>
    );
}

const Filter = styled.div`
    position: relative;
    color: var(--studio-muted);

    & > select {
        appearance: none;
        min-height: 36px;
        padding: 5px 25px 5px 10px;
        border: 1px solid var(--studio-line);
        border-radius: var(--studio-radius-control);
        background: var(--studio-surface, #1c1c1f);
        color: var(--studio-secondary);
        font: inherit;
        font-size: 11px;
        cursor: pointer;
        color-scheme: dark;

        &:focus-visible {
            outline: 2px solid var(--studio-muted);
            // Keep the ring inside the control at the scroll viewport's edge.
            outline-offset: -2px;
        }
    }
    & > svg {
        position: absolute;
        right: 8px;
        top: 11px;
        pointer-events: none;
    }
`;
