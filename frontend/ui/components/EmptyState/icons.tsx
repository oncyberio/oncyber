import React from "react";

/**
 * The few glyphs empty states use, drawn like the landing icons: 24 px grid,
 * 1.5 px round strokes in `currentColor`.
 */
const glyphs = {
    globe: (
        <>
            <circle cx="12" cy="12" r="9" />
            <ellipse cx="12" cy="12" rx="4" ry="9" />
            <path d="M3 12h18" />
        </>
    ),
    search: (
        <>
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m16 16 4 4" />
        </>
    ),
    /** History, activity and prices over time. */
    activity: <path d="M3 12h4l3-7 4 14 3-7h4" />,
    /** Listings, offers and other things for sale. */
    tag: (
        <>
            <path d="M3 12.5V4a1 1 0 0 1 1-1h8.5L21 11.5 12.5 20Z" />
            <circle cx="8" cy="8" r="1.5" />
        </>
    ),
};

export type EmptyStateIconName = keyof typeof glyphs;

export function EmptyStateIcon({
    name,
    size = 24,
}: {
    name: EmptyStateIconName;
    size?: number;
}) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            {glyphs[name]}
        </svg>
    );
}

export const isEmptyStateIconName = (
    value: unknown
): value is EmptyStateIconName =>
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(glyphs, value);
