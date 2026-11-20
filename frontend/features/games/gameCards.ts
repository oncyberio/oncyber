import { useMemo } from "react";
import type { LandingCard } from "@features/landing-carousel/types";
import { GAMES, type GameEntry } from "./catalog";
import {
    joinableParty,
    playingLabel,
    useGamePresence,
    type GamePresence,
} from "./gamePresence";
import { partyJoinHref, rememberedGameParties } from "./gamePartyJoin";
import { gameOnDevice } from "./gameDevices";
import { gameDevice, type GameDevice } from "./gameHealth";

/** "1 player", "1 to 8 players". */
export function playersLabel({ min, max }: GameEntry["players"]): string {
    return min === max
        ? `${min} player${min === 1 ? "" : "s"}`
        : `${min} to ${max} players`;
}

function card(game: GameEntry, presence?: GamePresence): LandingCard {
    return {
        id: `game-${game.id}`,
        title: game.title,
        href: `/games/${game.id}`,
        actionLabel: `Enter ${game.title}`,
        description: game.description,
        creator: "Oncyber",
        owner: "",
        room: "game",
        visits: 0,
        chains: [],
        collections: [],
        tags: ["game", ...game.tags],
        imageUrls: [game.thumbnail],
        portrait: false,
        buildStatus: `${game.tagline} · ${playersLabel(game.players)}`,
        // Who is playing now, from the game's rooms.
        destinationStatus: playingLabel(presence) || "Local preview",
    };
}

/** The way into the visitor's own party, when it is in this game now. */
function partyCard(
    game: GameEntry,
    party: { id: string; playing: number }
): LandingCard {
    return {
        ...card(game),
        id: `game-${game.id}-party`,
        href: partyJoinHref(game.id, party.id),
        actionLabel: `Join your party in ${game.title}`,
        buildStatus: `${party.playing} in your party · join them`,
        destinationStatus: "Your party is here",
    };
}

function matches(game: GameEntry, query: string) {
    const q = query.toLowerCase().trim();
    return (
        !q ||
        `${game.title} ${game.tagline} ${game.tags.join(" ")} game`
            .toLowerCase()
            .includes(q)
    );
}

/**
 * Cards for every catalogued game matching `query`. With presence, each
 * card says how many are playing, and a game where one of the visitor's own
 * parties (`ownPartyIds`) is playing gets a second card, first, that joins it.
 * With `device`, games that don't support it are left out
 * (docs/games/devices.md).
 */
export function gameCards(
    query = "",
    presence: Record<string, GamePresence> | null = null,
    ownPartyIds: readonly string[] = [],
    games: GameEntry[] = Object.values(GAMES),
    device: GameDevice | null = null
): LandingCard[] {
    return games
        .filter((game) => matches(game, query))
        .filter((game) => !device || gameOnDevice(game, device))
        .flatMap((game) => {
            const party = joinableParty(presence?.[game.id], ownPartyIds);
            return [
                ...(party ? [partyCard(game, party)] : []),
                card(game, presence?.[game.id]),
            ];
        });
}

/**
 * Game cards for the lobby's Explore panel, live: who is playing now, and
 * the way into a party of the visitor's that is already in a game.
 * `partyIds` are the trip ids of the visitor's lobby groups. Games are
 * hidden at launch, so this returns cards on the development server only;
 * in a production build the check is constant, the list is always empty and
 * the room list is never asked. Lists games while `show`, and asks the room
 * list only while `watching` too (the panel is open).
 */
export function useGameCards(
    query: string,
    show: boolean,
    watching: boolean,
    partyIds: readonly string[] = []
): LandingCard[] {
    const listed = process.env.NODE_ENV === "development" && show;
    const games = useMemo(() => Object.values(GAMES), []);
    const presence = useGamePresence(games, listed && watching);
    const own = partyIds.join(",");
    return useMemo(
        () =>
            listed
                ? gameCards(
                      query,
                      presence,
                      [
                          ...own.split(",").filter(Boolean),
                          ...rememberedGameParties(),
                      ],
                      games,
                      gameDevice()
                  )
                : [],
        [listed, query, presence, own, games]
    );
}
