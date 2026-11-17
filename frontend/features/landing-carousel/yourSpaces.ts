import type { SpaceSummary } from "@api/exhibit/listMine";
import { exhibitCover } from "@utils/destinationCover";
import { resize } from "@utils/urlUtils";
import { matchesTemplate } from "./templateSearch";
import type { LandingCard } from "./types";

/** Create shows this many of your spaces before "Show all". */
export const SPACES_SHOWN = 9;

export const SHOW_ALL_SPACES_ID = "spaces-show-all";

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

function spaceCard(space: SpaceSummary, currentId?: string): LandingCard {
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
        buildStatus: current ? "Continue editing" : "Open in Studio",
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
        visits: 0,
        chains: [],
        collections: [],
        tags: [],
        portrait: false,
    };
}

/**
 * Cards for the "Your spaces" section of Create. Without a search it stops
 * at nine and ends with a card that shows the rest; a search shows every
 * match.
 */
export function createSpaceCards(
    spaces: SpaceSummary[],
    query: string,
    expanded: boolean,
    currentId?: string
): LandingCard[] {
    const matches = sortSpaces(spaces, currentId).filter((space) =>
        matchesSpace(query, space)
    );
    const capped = !expanded && !query.trim() && matches.length > SPACES_SHOWN;
    const shown = capped ? matches.slice(0, SPACES_SHOWN) : matches;
    const cards = shown.map((space) => spaceCard(space, currentId));
    if (!capped) return cards;
    const more = matches.length - SPACES_SHOWN;
    return [
        ...cards,
        {
            id: SHOW_ALL_SPACES_ID,
            section: "spaces",
            title: `Show all ${matches.length} spaces`,
            room: "",
            // A real link for new tabs; a plain click expands in place.
            href: "/?create=gallery&spaces=all",
            description: "",
            buildStatus: `${more} more`,
            actionLabel: `Show all ${matches.length} of your spaces`,
            // Cards draw their own cover; the expand card shows its first ones.
            imageUrls: shown
                .slice(0, 1)
                .flatMap((space) => spaceCard(space).imageUrls),
            creator: "",
            owner: "",
            visits: 0,
            chains: [],
            collections: [],
            tags: [],
            portrait: false,
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
