import type { ServerResponse } from "http";
import { notFoundQuery } from "@features/landing-carousel/notFound";
import type { LandingPageProps } from "@features/landing-carousel/types";
import { landingFeedProps } from "./landingServerSideProps";

/**
 * Props for a page whose link found nothing (no such space or profile): a
 * real 404 for search engines, and for visitors the landing, with the link's
 * words in the search and the usual worlds to explore.
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
    return {
        ...(await landingFeedProps(filters)),
        notFound: { query: notFoundQuery(path) },
    };
}
