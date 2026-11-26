import type { GameEntry } from "./catalog";
import type { GameKillSwitch } from "./health/gameDisabled";
import type { GameFrame } from "./publish/gameRelease";

/** What a game's page is rendered from, at either of its addresses. */
export interface GameRouteProps {
    game: GameEntry;
    /** `GAMES_DISABLED` for this game and release (gameDisabled.ts). */
    killSwitch: GameKillSwitch;
    frame: GameFrame;
    /**
     * The game's one address for search engines and link previews: /<slug>
     * when it has a slug, else /games/<id> (gameSlug.ts).
     */
    canonical: string;
}
