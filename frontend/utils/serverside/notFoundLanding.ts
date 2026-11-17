import type { ServerResponse } from "http";
import { notFoundQuery } from "@features/landing-carousel/notFound";
import type { LandingPageProps } from "@features/landing-carousel/types";
import { landingFeedProps } from "./landingServerSideProps";

/**
 * Props for a page whose link found nothing (no such space or profile): a
 * real 404 for search engines, and for visitors a search for the link's
 * words ("/frahm-genesis" searches "frahm genesis"). It looks like any other
 * search: what matches, or the usual "No worlds found" with ways to explore.
 * A link without words (a bare space id) opens the landing's worlds.
 */
export async function notFoundLanding(
    res: ServerResponse,
    query: Record<string, unknown>,
    path: string
): Promise<
    Omit<LandingPageProps, "notFound"> & { notFound: { query: string } }
> {
    res.statusCode = 404;
    // The landing reads filters (q, category, ...) from the query; the page's
    // own route parameters are not filters.
    const { slug, id, ...filters } = query;
    const words = notFoundQuery(path);
    const search = words && !filters.q ? { ...filters, q: words } : filters;
    return {
        ...(await landingFeedProps(search, { readFeed: !search.q })),
        notFound: { query: words },
    };
}
