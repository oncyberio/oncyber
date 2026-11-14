import type { LandingCard } from "@features/landing-carousel/types";
import { GAMES, type GameEntry } from "./catalog";

const DESCRIPTIONS: Record<string, string> = {
    garden: "Hatch a bloomling, feed it, pet it and watch it grow up. Race and bump with other players' bloomlings.",
    ace: "Charge it up, time it right, hear the crowd go wild.",
    padel: "Walk the club, then play doubles with an NPC partner.",
};

function card(game: GameEntry): LandingCard {
    return {
        id: `game-${game.id}`,
        title: game.title,
        href: `/games/${game.id}`,
        actionLabel: `Enter ${game.title}`,
        description: DESCRIPTIONS[game.id] ?? game.tagline,
        creator: "Oncyber",
        owner: "",
        room: "game",
        visits: 0,
        chains: [],
        collections: [],
        tags: ["game", game.id],
        imageUrls: [`/games/${game.id}/preview.jpg`],
        portrait: false,
        buildStatus: game.tagline,
        destinationStatus: "Local preview",
    };
}

/**
 * Game cards for the lobby's Explore panel. Games are hidden at launch, so
 * this returns cards on the development server only; in a production build
 * the check is constant and the list is always empty.
 */
export function developmentGameCards(query = ""): LandingCard[] {
    if (process.env.NODE_ENV !== "development") return [];
    const q = query.toLowerCase().trim();
    return Object.values(GAMES)
        .filter(
            (game) =>
                !q ||
                `${game.title} ${game.tagline} game`.toLowerCase().includes(q)
        )
        .map(card);
}
