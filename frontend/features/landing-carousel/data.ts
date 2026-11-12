import { matchesArtistNames } from "@utils/artistSearch";
import { matchesSearchText } from "@utils/searchText";
import { resize } from "@utils/urlUtils";
import {
    DiscoveryFilters,
    FeedCategory,
    LandingCard,
    LandingFeed,
} from "./types";

export const FEED_CATEGORIES: { value: FeedCategory; label: string }[] = [
    { value: "most-visited", label: "Popular" },
    { value: "latest", label: "Latest" },
    { value: "staff", label: "Staff picks" },
    { value: "oncyberlabs", label: "Oncyber Labs" },
];

export const DEFAULT_FILTERS: DiscoveryFilters = {
    q: "",
    category: "most-visited",
    chain: "",
    owner: "",
    collection: "",
};

/** Staff picks become the default feed once they hold this many spaces. */
export const STAFF_PICKS_DEFAULT_MIN = 5;

export function defaultCategoryFor(staffPickCount: number): FeedCategory {
    return staffPickCount >= STAFF_PICKS_DEFAULT_MIN ? "staff" : "most-visited";
}

/**
 * The default feed is global (same for every visitor), so it lives on
 * DEFAULT_FILTERS: the URL omits it, Reset returns to it and a URL without a
 * category opens it. Set from the server's staff pick count.
 */
export function setDefaultFeedCategory(category: FeedCategory | undefined) {
    if (category === "staff" || category === "most-visited")
        DEFAULT_FILTERS.category = category;
}

export function parseFilters(query: Record<string, unknown>): DiscoveryFilters {
    const value = (key: string) =>
        typeof query[key] === "string"
            ? (query[key] as string).slice(0, 300)
            : "";
    const category = value("category");
    return {
        q: value("q"),
        category: FEED_CATEGORIES.some((item) => item.value === category)
            ? (category as FeedCategory)
            : DEFAULT_FILTERS.category,
        chain: value("chain"),
        owner: value("owner"),
        collection: value("collection"),
    };
}

function imageUrl(value: unknown): string {
    if (typeof value !== "string") return "";
    if (value.startsWith("ipfs://")) {
        return `https://cyber.mypinata.cloud/ipfs/${value.slice(7)}`;
    }
    return /^https?:\/\//i.test(value) || /^\/(?!\/)/.test(value) ? value : "";
}

/** Accept both Firestore list documents and raw search index hits. */
export function toLandingCards(exhibits: any[]): LandingCard[] {
    const seen = new Set<string>();
    return exhibits.flatMap((exhibit) => {
        if (!exhibit) return [];
        const info = exhibit.info || exhibit;
        if (
            exhibit.mock ||
            exhibit.deleted ||
            exhibit.isPublic === false ||
            exhibit.published === false ||
            info.private ||
            ["private", "unlisted", "draft"].includes(
                exhibit.visibility || info.visibility
            )
        )
            return [];
        const id = exhibit.id || exhibit.objectID;
        if (typeof id !== "string" || !id || seen.has(id)) return [];
        seen.add(id);
        const imageUrls = Array.from(
            new Set(
                [info.cHeroImg, info.fHeroImg, info.heroImg]
                    .map(imageUrl)
                    .filter(Boolean)
                    .map((url) => resize(url, 1024))
            )
        );
        const customLink =
            typeof info.customLink === "string"
                ? info.customLink.replace(/^\/+/, "")
                : "";
        const owner = typeof exhibit.owner === "string" ? exhibit.owner : "";
        return [
            {
                id,
                title:
                    typeof info.headline === "string" && info.headline.trim()
                        ? info.headline.trim()
                        : "Untitled world",
                href: customLink
                    ? `/${encodeURIComponent(customLink)}`
                    : `/spaces/${encodeURIComponent(id)}`,
                description:
                    typeof info.description === "string"
                        ? info.description
                        : "",
                creator: cardCreator(info.curator, exhibit.ownerName, owner),
                owner,
                curatorNames: Array.isArray(exhibit.artistSearch?.curatorNames)
                    ? exhibit.artistSearch.curatorNames.filter(
                          (value) => typeof value === "string"
                      )
                    : [],
                artistNames: Array.isArray(exhibit.artistSearch?.names)
                    ? exhibit.artistSearch.names.filter(
                          (value) => typeof value === "string"
                      )
                    : [],
                artistAddresses: Array.isArray(exhibit.artistSearch?.addresses)
                    ? exhibit.artistSearch.addresses.filter(
                          (value) => typeof value === "string"
                      )
                    : [],
                room: typeof info.room === "string" ? info.room : "",
                visits: Number(exhibit.number_of_visits) || 0,
                chains: Array.isArray(exhibit.chains)
                    ? exhibit.chains.filter(
                          (value) => typeof value === "string"
                      )
                    : [],
                collections: Array.isArray(exhibit.collections)
                    ? exhibit.collections.filter(
                          (value) => typeof value === "string"
                      )
                    : [],
                tags: Array.isArray(exhibit.tags)
                    ? exhibit.tags
                          .map((tag) =>
                              typeof tag === "string" ? tag : tag?.title || ""
                          )
                          .filter(Boolean)
                    : [],
                imageUrls,
                portrait: info.thumbnailOrientation === "portrait",
            },
        ];
    });
}

export async function fetchLandingFeed(
    category: FeedCategory,
    cursor = "",
    signal?: AbortSignal,
    origin = ""
): Promise<LandingFeed> {
    const params = new URLSearchParams({
        type: "FETCH_ALL_EXHIBITS",
        isActive: category,
    });
    if (cursor) params.set("lastVisible", cursor);
    const response = await fetch(`${origin}/api/exhibit?${params}`, { signal });
    if (!response.ok) throw new Error("The world feed is unavailable.");
    return landingFeedFromResponse(await response.json(), category, cursor);
}

/**
 * One feed page from the body `/api/exhibit?type=FETCH_ALL_EXHIBITS` sends.
 * Shared by the browser (over HTTP) and the landing's server render, which
 * calls that API handler in-process.
 */
export function landingFeedFromResponse(
    result: any,
    category: FeedCategory,
    cursor = ""
): LandingFeed {
    if (!result.success || !Array.isArray(result.exhibits)) {
        throw new Error("The world feed is unavailable.");
    }
    const exhibits = result.exhibits;
    // Staff picks are returned as one complete set by the existing API.
    const pageSize =
        category === "latest" || (category === "most-visited" && cursor)
            ? 50
            : 30;
    return {
        // Missing previews use a local reference-mark cover in both renderers.
        cards: toLandingCards(exhibits),
        cursor: exhibits[exhibits.length - 1]?.id || "",
        hasMore: category !== "staff" && exhibits.length >= pageSize,
    };
}

/**
 * Who a card credits: the world's own curator line, else the owner's
 * username, else the owner's wallet address (shortened by `creatorLabel`).
 */
export function cardCreator(
    curator: unknown,
    ownerName: unknown,
    owner: string
): string {
    for (const name of [curator, ownerName])
        if (typeof name === "string" && name.trim()) return name.trim();
    return /^(0x[0-9a-f]{20,}|tz[123][1-9a-z]{30,})$/i.test(owner) ? owner : "";
}

/**
 * The creator name a card shows after "by". Wallet addresses are shortened so
 * a card reads "World by 0x1234…cdef" rather than a 42-character string.
 */
export function creatorLabel(creator: string): string {
    const name = (creator || "").trim().replace(/^@/, "");
    if (/^(0x[0-9a-f]{20,}|tz[123][1-9a-z]{30,})$/i.test(name))
        return `${name.slice(0, 6)}…${name.slice(-4)}`;
    return name;
}

export function roomLabel(room: string): string {
    const names: Record<string, string> = {
        rtfktspacepod: "Space Pod",
        rtfktlootpod: "Loot Pod",
        "6529hub": "Museum District",
        temple: "Temple",
        genesis: "Genesis",
        void: "Void",
        chalk: "Chalk",
        brute: "Brute",
        coal: "Coal",
        altitude: "Altitude",
    };
    return names[room] || "World";
}

/** Filter loaded worlds immediately, also used while global search is unavailable. */
export function filterBrowseCards(
    cards: LandingCard[],
    filters: DiscoveryFilters
) {
    const normalize = (value: string) =>
        value
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();
    return cards.filter((card) => {
        const text = normalize(
            [
                card.title,
                card.description,
                card.creator,
                card.owner,
                card.room,
                ...card.tags,
            ].join(" ")
        );
        return (
            (matchesSearchText(text, filters.q) ||
                matchesArtistNames(
                    [...(card.artistNames || []), ...(card.curatorNames || [])],
                    card.artistAddresses,
                    filters.q
                )) &&
            (!filters.chain ||
                card.chains.some(
                    (chain) => normalize(chain) === normalize(filters.chain)
                )) &&
            (!filters.owner.trim() ||
                normalize(card.owner) === normalize(filters.owner.trim())) &&
            (!filters.collection.trim() ||
                card.collections.some(
                    (collection) =>
                        normalize(collection) ===
                        normalize(filters.collection.trim())
                ))
        );
    });
}

/** Global metadata search backed by existing Firestore indexes. */
export async function fetchSpaceSearch(
    filters: DiscoveryFilters,
    cursor = "",
    signal?: AbortSignal
) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) abort();
    signal?.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(abort, 8000);
    try {
        const query = new URLSearchParams({
            ...filters,
            ...(cursor ? { cursor } : {}),
        });
        const response = await fetch(`/api/search/spaces?${query}`, {
            signal: controller.signal,
        });
        if (!response.ok) throw new Error("Search is temporarily unavailable.");
        const result = await response.json();
        if (!result.success || !Array.isArray(result.exhibits))
            throw new Error("Search is temporarily unavailable.");
        return {
            cards: toLandingCards(result.exhibits),
            cursor: result.cursor || "",
            hasMore: !!result.hasMore,
            total: null,
            limited: false,
        };
    } finally {
        clearTimeout(timeout);
        signal?.removeEventListener("abort", abort);
    }
}
