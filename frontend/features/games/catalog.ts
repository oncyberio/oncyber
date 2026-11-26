import type { CSSProperties } from "react";
import { GAMES } from "./catalog.generated";

export { GAMES };
// The switch that hides games until launch has a file of its own, so the
// middleware can ask it without loading the catalog.
export { gamesPreviewEnabled } from "./gamesPreview";

/**
 * Games served by this deployment. Each one is a static bundle under
 * `public/game-builds/<id>/`, built from `games/<id>/` with `pnpm games:publish`.
 * The entries are generated from each game's `game.json` (`listing` and
 * `page`) by `pnpm games:catalog`; see docs/games/listing.md.
 * Games are hidden at launch: nothing of a game answers outside development
 * unless `GAMES_PREVIEW=1` is set (`gamesPreviewEnabled`, gamesPreview.ts).
 */
/** The devices a game claims in `devices` (docs/games/devices.md). */
export type GameDevice = "desktop" | "phone" | "gamepad";

export interface GameEntry {
    /** Folder under /games and the prefix of the page bridge messages. */
    id: string;
    /**
     * The game's short address, /<slug>, when it has one: `page.slug` in
     * game.json for a catalogued game, the record's for a published one
     * (gameSlug.ts). The game is at /games/<id> either way.
     */
    slug?: string;
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
     * Published from outside the repository and read from the registry, not
     * this catalog (docs/games/publishing.md). Its results are not recorded
     * and it has no saved data on the server yet.
     */
    registered?: boolean;
}

export function findGame(id: unknown): GameEntry | null {
    return typeof id === "string" && Object.hasOwn(GAMES, id)
        ? GAMES[id]
        : null;
}
