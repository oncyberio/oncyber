import React from "react";
import styled, { css } from "styled-components";

export const libraryCard = css`
    min-width: 0;
    padding: 5px;
    border: 1px solid var(--studio-line);
    border-radius: var(--studio-radius-card);
    background: var(--studio-card);
    box-shadow: var(--studio-edge);
    color: var(--studio-ink);
    transition: background 120ms ease, border-color 120ms ease;
    &:hover {
        background: var(--studio-surface);
        border-color: var(--studio-line-strong);
    }
    &:focus-visible,
    &:focus-within {
        outline: 2px solid var(--studio-muted);
        outline-offset: 1px;
    }
    &[aria-pressed="true"] {
        border-color: var(--studio-muted);
        background: var(--studio-selected);
    }
`;

export const LibraryGrid = styled.div<{ $columns?: number }>`
    display: grid;
    grid-template-columns: repeat(${(p) => p.$columns ?? 4}, minmax(0, 1fr));
    align-content: start;
    gap: var(--studio-grid-gap);
    width: 100%;
`;

export const LibraryTabs = styled.div`
    display: flex;
    gap: 4px;
    padding: 3px;
    border: 1px solid var(--studio-line);
    border-radius: var(--studio-radius-control);
    background: var(--studio-inset);
    & > button {
        flex: 1;
        min-width: 0;
        min-height: 30px;
        padding: 4px 10px;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: var(--studio-muted);
        font: 500 12px/20px var(--studio-font);
        cursor: pointer;
        &[aria-pressed="true"] {
            color: var(--studio-ink);
            background: var(--studio-surface);
            box-shadow: var(--studio-edge), 0 1px 3px #00000033;
        }
        &:hover {
            color: var(--studio-ink);
        }
        &:focus-visible {
            outline: 2px solid var(--studio-ink);
            outline-offset: 1px;
        }
    }
    @media (max-width: 600px) {
        & > button {
            min-height: 44px;
        }
    }
`;

export function LibrarySearch({
    value,
    onChange,
    placeholder = "Search",
    children,
}: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    children?: React.ReactNode;
}) {
    return (
        <SearchRow>
            <div className="search-field">
                <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                >
                    <circle cx="10.5" cy="10.5" r="6.5" />
                    <path d="m16 16 5 5" />
                </svg>
                <input
                    type="search"
                    aria-label={placeholder}
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                />
            </div>
            {children}
        </SearchRow>
    );
}

const SearchRow = styled.div`
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    .search-field {
        position: relative;
        flex: 1;
        min-width: 0;
    }
    .search-field > svg {
        position: absolute;
        left: 10px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--studio-muted);
        pointer-events: none;
    }
    &&& input {
        width: 100%;
        height: 36px;
        min-height: 36px;
        padding: 7px 10px 7px 30px;
        border: 1px solid var(--studio-line);
        border-radius: var(--studio-radius-control);
        background: var(--studio-inset);
        color: var(--studio-ink);
        font: 400 12px/20px var(--studio-font);
        &::placeholder {
            color: var(--studio-muted);
        }
        &:focus {
            border-color: var(--studio-muted);
        }
    }
`;

export function LibraryCard({
    name,
    image,
    imageCrossOrigin,
    selected = false,
    disabled = false,
    onClick,
    onDragStart,
    onPointerEnter,
    onFocus,
}: {
    name: string;
    image?: string;
    imageCrossOrigin?: "anonymous";
    selected?: boolean;
    disabled?: boolean;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    onDragStart?: React.DragEventHandler<HTMLButtonElement>;
    onPointerEnter?: React.PointerEventHandler<HTMLButtonElement>;
    onFocus?: React.FocusEventHandler<HTMLButtonElement>;
}) {
    return (
        <Card
            type="button"
            title={name}
            aria-label={name}
            aria-pressed={selected}
            disabled={disabled}
            onClick={onClick}
            draggable={!!onDragStart}
            onDragStart={onDragStart}
            onPointerEnter={onPointerEnter}
            onFocus={onFocus}
        >
            <span className="thumbnail">
                {image && (
                    <img
                        crossOrigin={imageCrossOrigin}
                        src={image}
                        alt=""
                        loading="lazy"
                        draggable={false}
                    />
                )}
            </span>
            <span className="caption">{name}</span>
        </Card>
    );
}
const Card = styled.button`
    ${libraryCard}
    display: flex;
    flex-direction: column;
    text-align: left;
    cursor: pointer;
    .thumbnail {
        display: block;
        width: 100%;
        aspect-ratio: 1;
        overflow: hidden;
        border: 1px solid var(--studio-line);
        border-radius: var(--studio-radius-preview);
        background: var(--studio-inset);
    }
    img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    .caption {
        width: 100%;
        padding: 7px 2px 3px;
        font: 400 11px/15px var(--studio-font);
        color: var(--studio-secondary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    &:disabled {
        opacity: 0.45;
        cursor: default;
    }
`;
