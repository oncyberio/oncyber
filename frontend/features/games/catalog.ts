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
    /** The shared native room everyone playing this game joins. */
    room: string;
    /** Relay `<id>:net` packets between the game and everyone in the room. */
    relay: boolean;
    /** "12 in the garden". */
    crowdLabel: string;
    /** Where the social controls sit over the game. */
    controlsStyle?: CSSProperties;
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
};

export function findGame(id: unknown): GameEntry | null {
    return typeof id === "string" && Object.hasOwn(GAMES, id)
        ? GAMES[id]
        : null;
}

/** Game pages stay out of production until launch. */
export function gamesPreviewEnabled(
    env: Record<string, string | undefined> = process.env
): boolean {
    return env.NODE_ENV === "development" || env.GAMES_PREVIEW === "1";
}
