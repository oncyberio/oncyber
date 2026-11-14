import type { CSSProperties } from "react";

/**
 * Games served by this deployment. Each one is a static bundle under
 * `public/games/<id>/`, built from `games/<id>/` with `pnpm games:publish`.
 * Games are hidden at launch: their pages exist only in development or
 * where `GAMES_PREVIEW=1` is set (see `gamesPreviewEnabled`).
 */
export interface GameEntry {
    /** Folder under /games and the prefix of the page bridge messages. */
    id: string;
    title: string;
    /** Shown in the tab title after the name. */
    tagline: string;
    /** The shared native room everyone playing this game joins, if any. */
    room: string | null;
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

export const GAMES: Record<string, GameEntry> = {
    garden: {
        id: "garden",
        title: "Bloom Garden",
        tagline: "raise bloomlings with other players",
        room: "oncyber-bloom-garden-v1",
        relay: true,
        crowdLabel: "in the garden",
        controlsStyle: { top: 14, left: "auto", right: 16 },
    },
    padel: {
        id: "padel",
        title: "Glasshouse · Padel",
        tagline: "doubles padel with NPC partners",
        room: null,
        relay: false,
        crowdLabel: "",
        ownPage: true,
    },
    ace: {
        id: "ace",
        title: "ACE! Tennis",
        tagline: "an arcade tennis match",
        room: null,
        relay: false,
        crowdLabel: "",
    },
};

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
