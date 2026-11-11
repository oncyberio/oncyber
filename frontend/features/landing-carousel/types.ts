export type FeedCategory = "most-visited" | "latest" | "staff" | "oncyberlabs";

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
}
