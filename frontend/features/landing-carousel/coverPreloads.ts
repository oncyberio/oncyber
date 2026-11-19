import { coverSources } from "./coverSources";
import type { LandingCard } from "./types";

/** At this width and below the grid is one column of two cards. */
export const MOBILE_GRID_MAX_WIDTH = 700;
export const MOBILE_GRID_QUERY = `(max-width: ${MOBILE_GRID_MAX_WIDTH}px)`;
const WIDE_GRID_QUERY = `(min-width: ${MOBILE_GRID_MAX_WIDTH + 1}px)`;

export interface CoverPreload {
    href: string;
    /** Set on covers only a wide grid shows on its first screen. */
    media?: string;
}

/**
 * The covers on the first screen of the grid, for `<link rel="preload">`.
 *
 * The grid is drawn by a script that arrives after the page, and it fetches
 * each cover when it starts. Naming the first covers in the HTML lets the
 * browser download them while the scripts load, so they are already there
 * when the grid asks. Cards fill a column before the next one: a phone shows
 * the first two, a wider screen the first four.
 *
 * The grid fetches a cover with `fetch` in CORS mode and without
 * credentials (three's ImageBitmapLoader); the page's preload has to ask the
 * same way (`as="fetch"`, `crossOrigin="anonymous"`) to be the one it uses.
 */
export function firstScreenCovers(
    cards: Pick<LandingCard, "id" | "imageUrls" | "collage">[] = []
): CoverPreload[] {
    const seen = new Set<string>();
    return cards.slice(0, 4).flatMap((card, index) => {
        // A collage draws several covers through image elements instead.
        if (card.collage?.length >= 2) return [];
        const href = coverSources(card)[0];
        if (!href || seen.has(href)) return [];
        seen.add(href);
        return [{ href, ...(index >= 2 ? { media: WIDE_GRID_QUERY } : {}) }];
    });
}
