import type { SpaceSummary } from "@api/exhibit/listMine";
import { exhibitCover } from "@utils/destinationCover";
import { resize } from "@utils/urlUtils";
import { matchesTemplate } from "./templateSearch";
import type { LandingCard } from "./types";

/**
 * Create shows this many of your spaces, then one card for the rest: nine
 * cells, so the card that says there are more is on screen with the spaces.
 */
export const SPACES_SHOWN = 8;

export const SHOW_ALL_SPACES_ID = "spaces-show-all";
/** Stands in for a filter that matches nothing, and clears it. */
export const RESET_SPACES_ID = "spaces-reset";

/** The ways to look at your spaces; the first is the default. */
export const SPACE_FILTERS = [
    { value: "latest", label: "Latest", noun: "spaces" },
    { value: "viewed", label: "Most viewed", noun: "spaces" },
    { value: "deployed", label: "Deployed", noun: "deployed spaces" },
    { value: "drafts", label: "Drafts", noun: "drafts" },
    { value: "shared", label: "Shared", noun: "shared spaces" },
] as const;

export type SpaceFilter = (typeof SPACE_FILTERS)[number]["value"];

export function parseSpaceFilter(value: unknown): SpaceFilter {
    return (
        SPACE_FILTERS.find((filter) => filter.value === value)?.value ||
        "latest"
    );
}

const visits = (space: SpaceSummary) => Number(space.visits) || 0;

const compact = Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
});

/**
 * Your spaces under one filter. Deployed and Drafts are the ones you own;
 * the ones shared with you have their own filter.
 */
export function filterSpaces(
    spaces: SpaceSummary[],
    filter: SpaceFilter,
    currentId?: string
) {
    if (filter === "viewed")
        return [...spaces].sort(
            (a, b) => visits(b) - visits(a) || time(b) - time(a)
        );
    const sorted = sortSpaces(spaces, currentId);
    if (filter === "deployed")
        return sorted.filter((space) => !space.invited && isDeployed(space));
    if (filter === "drafts")
        return sorted.filter((space) => !space.invited && !isDeployed(space));
    if (filter === "shared") return sorted.filter((space) => space.invited);
    return sorted;
}

/** How many of your spaces a filter and a search leave. */
export function countSpaces(
    spaces: SpaceSummary[],
    query: string,
    filter: SpaceFilter = "latest"
) {
    return filterSpaces(spaces, filter).filter((space) =>
        matchesSpace(query, space)
    ).length;
}

const PLACEHOLDER = "/images/sq_image_placeholder.png";

function time(space: SpaceSummary) {
    const value = space.createdAt ? new Date(space.createdAt).getTime() : 0;
    return Number.isFinite(value) ? value : 0;
}

/** Deployed means it has a name and a cover, the same rule as Studio's. */
export function isDeployed(space: SpaceSummary) {
    return !!(
        space.info?.headline &&
        (space.info?.cHeroImg || space.info?.heroImg)
    );
}

/**
 * The visitor's spaces, the one Studio opens first, then newest first.
 * Spaces never named sink below named ones, as in Studio's own list.
 */
export function sortSpaces(spaces: SpaceSummary[], currentId?: string) {
    const rank = (space: SpaceSummary) =>
        space.id === currentId
            ? Infinity
            : space.info?.headline
            ? time(space)
            : time(space) / 1_000;
    return [...spaces].sort((a, b) => rank(b) - rank(a));
}

/** Search covers every space: owned and shared, deployed or not. */
export function matchesSpace(query: string, space: SpaceSummary) {
    return matchesTemplate(
        query,
        space.info?.headline || "Untitled",
        space.info?.customLink,
        space.info?.description,
        space.info?.room,
        space.id,
        isDeployed(space) ? "deployed public" : "draft private not deployed",
        space.invited ? "collaboration shared" : ""
    );
}

function spaceCard(
    space: SpaceSummary,
    currentId?: string,
    filter: SpaceFilter = "latest"
): LandingCard {
    const title = space.info?.headline || "Untitled";
    const cover = exhibitCover(space.info);
    const current = space.id === currentId;
    return {
        id: `space-${space.id}`,
        spaceId: space.id,
        section: "spaces",
        title,
        room: space.info?.room || "",
        href: "/studio",
        description: space.info?.description || "",
        destinationStatus: space.invited
            ? "Shared with you"
            : isDeployed(space)
            ? "Deployed"
            : "Draft",
        buildStatus:
            filter === "viewed"
                ? `${compact.format(visits(space))} ${
                      visits(space) === 1 ? "visit" : "visits"
                  }`
                : current
                ? "Continue editing"
                : "Open in Studio",
        actionLabel: `Open ${title} in Studio`,
        openingLabel: "Opening your space…",
        imageUrls: cover
            ? [
                  cover === PLACEHOLDER
                      ? cover
                      : resize(cover, 1024, undefined, "webp"),
              ]
            : [],
        creator: "",
        owner: "",
        visits: visits(space),
        chains: [],
        collections: [],
        tags: [],
        portrait: false,
    };
}

const blankCard = {
    room: "",
    description: "",
    creator: "",
    owner: "",
    visits: 0,
    chains: [],
    collections: [],
    tags: [],
    portrait: false,
};

/**
 * Cards for the "Your spaces" section of Create. Without a search it stops
 * at eight and ends with a card that shows the rest; a search shows every
 * match. A filter that matches nothing leaves one card that clears it, so
 * the section and its filters stay on screen.
 */
export function createSpaceCards(
    spaces: SpaceSummary[],
    query: string,
    expanded: boolean,
    currentId?: string,
    filter: SpaceFilter = "latest"
): LandingCard[] {
    const matches = filterSpaces(spaces, filter, currentId).filter((space) =>
        matchesSpace(query, space)
    );
    const { noun } = SPACE_FILTERS.find((item) => item.value === filter);
    if (!matches.length && filter !== "latest" && spaces.length)
        return [
            {
                ...blankCard,
                id: RESET_SPACES_ID,
                section: "spaces",
                title: query.trim() ? `No ${noun} match` : `No ${noun} yet`,
                href: "/?create=gallery",
                buildStatus: `Show all ${spaces.length} spaces`,
                actionLabel: "Show all your spaces",
                imageUrls: [],
            },
        ];
    // One more than the cap fits the same nine cells without a "more" card.
    const capped =
        !expanded && !query.trim() && matches.length > SPACES_SHOWN + 1;
    const shown = capped ? matches.slice(0, SPACES_SHOWN) : matches;
    const cards = shown.map((space) => spaceCard(space, currentId, filter));
    if (!capped) return cards;
    const more = matches.length - SPACES_SHOWN;
    return [
        ...cards,
        {
            ...blankCard,
            id: SHOW_ALL_SPACES_ID,
            section: "spaces",
            title: `+${more} more`,
            // A real link for new tabs; a plain click expands in place.
            href: "/?create=gallery&spaces=all",
            buildStatus: `Show all ${matches.length} ${noun}`,
            actionLabel: `Show all ${matches.length} of your ${noun}`,
            // Cards draw their own cover; this one shows the next space's.
            imageUrls: spaceCard(matches[SPACES_SHOWN]).imageUrls,
        },
    ];
}

/** Your spaces, then the templates, each run tagged with its section. */
export function withSpaces(
    spaceCards: LandingCard[],
    templateCards: LandingCard[]
): LandingCard[] {
    if (!spaceCards.length) return templateCards;
    return [
        ...spaceCards,
        ...templateCards.map((card) => ({
            ...card,
            section: "templates" as const,
        })),
    ];
}
