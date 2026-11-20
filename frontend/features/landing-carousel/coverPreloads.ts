import {
    hasDefaultGalleryCover,
    previewForRoom,
} from "@utils/destinationPreviews";
import { coverSources } from "./coverSources";
import type { DiscoveryFilters, LandingCard } from "./types";

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
 * The cards are placed by a script that arrives after the page. Naming the
 * first covers in the HTML lets the browser download them while the scripts
 * load, so each picture is already there when its card appears. Cards fill
 * a column before the next one: a phone shows the first two, a wider screen
 * the first four.
 */
export function firstScreenCovers(
    cards: Pick<
        LandingCard,
        "id" | "imageUrls" | "collage" | "room" | "buildStatus"
    >[] = [],
    filters?: Partial<DiscoveryFilters>
): CoverPreload[] {
    // The server sends a category's feed. A search or a chain, owner or
    // collection filter replaces it in the browser, so its first cards are
    // not the ones the visitor will see.
    if (filters?.q || filters?.chain || filters?.owner || filters?.collection)
        return [];
    const seen = new Set<string>();
    return cards.slice(0, 4).flatMap((card, index) => {
        // A collage shows several smaller covers instead.
        if (card.collage?.length >= 2) return [];
        const href = firstCover(card);
        if (!href || seen.has(href)) return [];
        seen.add(href);
        return [{ href, ...(index >= 2 ? { media: WIDE_GRID_QUERY } : {}) }];
    });
}

/**
 * The cover the grid shows first for a card. A world that only has its
 * room's stock picture shows the room's own cover instead (see
 * hooks/useDestinationPreviews): the one shipped with the site when there
 * is one, else one from a catalog the browser fetches later, which cannot
 * be named here.
 */
function firstCover(
    card: Pick<LandingCard, "id" | "imageUrls" | "room" | "buildStatus">
): string | undefined {
    if (
        card.room &&
        !card.buildStatus &&
        hasDefaultGalleryCover(card.imageUrls)
    )
        return previewForRoom({}, card.room)[0];
    return coverSources(card)[0];
}
