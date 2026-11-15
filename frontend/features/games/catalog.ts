import type { CSSProperties } from "react";
import { GAMES } from "./catalog.generated";

export { GAMES };

/**
 * Games served by this deployment. Each one is a static bundle under
 * `public/games/<id>/`, built from `games/<id>/` with `pnpm games:publish`.
 * The entries are generated from each game's `game.json` (`listing` and
 * `page`) by `pnpm games:catalog`; see docs/games/listing.md.
 * Games are hidden at launch: their pages exist only in development or
 * where `GAMES_PREVIEW=1` is set (see `gamesPreviewEnabled`).
 */
/** The devices a game claims in `devices` (docs/games/devices.md). */
export type GameDevice = "desktop" | "phone" | "gamepad";

export interface GameEntry {
    /** Folder under /games and the prefix of the page bridge messages. */
    id: string;
    title: string;
    /** Shown in the tab title after the name. */
    tagline: string;
    /** One or two sentences for the game's card. */
    description: string;
    /** Site path of the card image: the game's own, or the check's screenshot. */
    thumbnail: string;
    /** Fewest and most people who can play together. */
    players: { min: number; max: number };
    /**
     * Party sizes the game has a format for beyond its solo option, from
     * its `party` block; empty when it has none.
     */
    partySizes: number[];
    devices: GameDevice[];
    tags: string[];
    /** The shared native room everyone playing this game joins, if any. */
    room: string | null;
    /**
     * For a game with no `room`: the room its visitors share for chat and
     * voice only. The game gets no peers from it (docs/games/voice-chat.md).
     */
    socialRoom?: string;
    /** Relay `<id>:net` packets between the game and everyone in the room. */
    relay: boolean;
    /** "12 in the garden". */
    crowdLabel: string;
    /** Where the social controls sit over the game. */
    controlsStyle?: CSSProperties;
    /**
     * The game has its own page in pages/games/ (its own social layer and a
     * same-origin frame) instead of the shared, sandboxed GamePage.
     */
    ownPage?: boolean;
}

export function findGame(id: unknown): GameEntry | null {
    return typeof id === "string" && Object.hasOwn(GAMES, id)
        ? GAMES[id]
        : null;
}

/** A game the shared /games/[game] page runs. */
export function findSharedPageGame(id: unknown): GameEntry | null {
    const game = findGame(id);
    return game && !game.ownPage ? game : null;
}

/** Game pages stay out of production until launch. */
export function gamesPreviewEnabled(
    env: Record<string, string | undefined> = process.env
): boolean {
    return env.NODE_ENV === "development" || env.GAMES_PREVIEW === "1";
}
