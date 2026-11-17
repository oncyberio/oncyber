export type FeedCategory = "most-visited" | "latest" | "staff" | "oncyberlabs";

/** A labelled part of the landing grid (see LandingCard.section). */
export type GridSection =
    | "results"
    | "staff"
    | "popular"
    /** In Create: the visitor's own spaces, then the template catalog. */
    | "spaces"
    | "templates";

export interface LandingCard {
    id: string;
    title: string;
    href: string;
    description: string;
    creator: string;
    artistNames?: string[];
    curatorNames?: string[];
    artistAddresses?: string[];
    owner: string;
    room: string;
    visits: number;
    chains: string[];
    collections: string[];
    tags: string[];
    imageUrls: string[];
    portrait: boolean;
    buildStatus?: string;
    actionLabel?: string;
    destinationStatus?: string;
    templateStatus?: "free" | "owned" | "uncollected" | "checking" | "scan";
    /** This template is being turned into a space; the card shows its progress. */
    opening?: boolean;
    /** What the card says while `opening`; defaults to creating a space. */
    openingLabel?: string;
    /** A card for one of the visitor's own spaces opens it in Studio. */
    spaceId?: string;
    /**
     * The labelled part of the grid a card belongs to: the popular worlds
     * after the staff picks in the staff feed, or, on a page answering a link
     * that found nothing, the search results, staff picks and popular worlds.
     * Each section starts a new column under its label.
     */
    section?: GridSection;
}

export interface DiscoveryFilters {
    q: string;
    category: FeedCategory;
    chain: string;
    owner: string;
    collection: string;
}

export interface LandingFeed {
    cards: LandingCard[];
    cursor: string;
    hasMore: boolean;
}

export interface LandingPageProps {
    initialFeed: LandingFeed;
    initialFilters: DiscoveryFilters;
    /** Feed opened by a URL without a category (staff picks once there are 5+). */
    defaultCategory?: FeedCategory;
    initialError: boolean;
    /**
     * Set when the page answers a link that found nothing (status 404): the
     * words read from that link, which the page opens searching for, and the
     * staff picks and popular worlds shown after the results.
     */
    notFound?: { query: string; sections: LandingCard[] };
}
