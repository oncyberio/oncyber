import type { ServerResponse } from "http";
import { notFoundQuery } from "@features/landing-carousel/notFound";
import type {
    FeedCategory,
    LandingCard,
    LandingPageProps,
} from "@features/landing-carousel/types";
import { landingFeedProps, readLandingFeed } from "./landingServerSideProps";

/** How many staff picks and popular worlds follow the results. */
export const NOT_FOUND_SECTION_SIZE = 12;

type NotFoundProps = Omit<LandingPageProps, "notFound"> & {
    notFound: NonNullable<LandingPageProps["notFound"]>;
};

/**
 * Props for a page whose link found nothing (no such space or profile): a
 * real 404 for search engines, and for visitors the landing searching for the
 * link's words ("/frahm-genesis" searches "frahm genesis"). Whatever matches
 * comes first, then the staff picks and the most popular worlds, each under
 * its label. A link without words (a bare space id) shows just those two.
 */
export async function notFoundLanding(
    res: ServerResponse,
    query: Record<string, unknown>,
    path: string,
    read: (category: FeedCategory) => Promise<{
        cards: LandingCard[];
    }> = readLandingFeed
): Promise<NotFoundProps> {
    res.statusCode = 404;
    // The landing reads filters (q, category, ...) from the query; the page's
    // own route parameters are not filters.
    const { slug, id, ...filters } = query;
    const words = notFoundQuery(path);
    const search = words && !filters.q ? { ...filters, q: words } : filters;
    // The browser runs the search; the sections come with the page.
    const [feedProps, staff, popular] = await Promise.all([
        landingFeedProps(search, { readFeed: false }),
        read("staff").then(
            ({ cards }) => cards.filter((card) => !card.section),
            () => [] as LandingCard[]
        ),
        read("most-visited").then(
            ({ cards }) => cards,
            () => [] as LandingCard[]
        ),
    ]);
    return {
        ...feedProps,
        notFound: {
            query: feedProps.initialFilters.q,
            sections: notFoundSections(staff, popular),
        },
    };
}

/** Staff picks, then popular worlds that are not already among them. */
export function notFoundSections(
    staff: LandingCard[],
    popular: LandingCard[],
    size = NOT_FOUND_SECTION_SIZE
): LandingCard[] {
    const picks = staff.slice(0, size);
    const picked = new Set(picks.map((card) => card.id));
    return [
        ...picks.map((card) => ({ ...card, section: "staff" as const })),
        ...popular
            .filter((card) => !picked.has(card.id))
            .slice(0, size)
            .map((card) => ({ ...card, section: "popular" as const })),
    ];
}
