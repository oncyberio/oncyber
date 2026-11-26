/**
 * A game's page, as the server builds it for either of its addresses
 * (GameRoute.tsx): /games/<id>, and /<slug> for a game with a slug
 * (gameSlug.ts). Nothing here answers while games are hidden.
 */
import { searchUrl } from "@utils/siteUrl";
import { findGame, type GameEntry } from "./catalog";
import { gameKillSwitch, killSwitchForRelease } from "./gameDisabled";
import type { GameFrame } from "./gameRelease";
import { loadGameFrame } from "./gameReleaseServer";
import type { GameRouteProps } from "./gameRoute";
import { GAME_SLUG, catalogGameBySlug, gamePath } from "./gameSlug";
import { gamesPreviewEnabled } from "./gamesPreview";

const route = (game: GameEntry, frame: GameFrame): GameRouteProps => ({
    game,
    // The kill switch stops the release this visit would load: a hosted
    // one is decided here, by the pointer's id.
    killSwitch: killSwitchForRelease(gameKillSwitch(game.id), frame.release),
    frame,
    canonical: searchUrl(gamePath(game)),
});

/** The page of a catalogued game, from its release (docs/games/releases.md). */
const catalogued = async (game: GameEntry, draft: boolean) =>
    // A hosted release when a person pointed the game at one, else the
    // committed build.
    route(game, await loadGameFrame(game.id, { draft }));

/**
 * The page at /games/<id>: a catalogued game, or one published from
 * outside the repository (docs/games/publishing.md) while it is published.
 * Null: no such page.
 */
export async function loadGameRoute(
    id: unknown,
    { draft = false }: { draft?: boolean } = {}
): Promise<GameRouteProps | null> {
    if (!gamesPreviewEnabled()) return null;
    const game = findGame(id);
    if (game) return catalogued(game, draft);
    // Not in the catalog: a game the registry holds. It runs in the same
    // page, behind the same gates.
    const { loadRegisteredGame } = await import("./publishedGamesServer");
    const registered = await loadRegisteredGame(id);
    return registered ? route(registered.game, registered.frame) : null;
}

/**
 * The page at /<slug>, when a game holds that slug: a catalogued game's
 * `page.slug`, or a published game's claimed one. Null for any other name,
 * and for every name while games are hidden. A slug is lower case; a name
 * typed with capitals is `redirect`ed to it, as a space's link is.
 */
export async function loadGameRouteBySlug(
    name: unknown,
    { draft = false }: { draft?: boolean } = {}
): Promise<{ props: GameRouteProps } | { redirect: string } | null> {
    if (!gamesPreviewEnabled() || typeof name !== "string") return null;
    const slug = name.toLowerCase();
    if (!GAME_SLUG.test(slug)) return null;
    let found: GameRouteProps | null = null;
    const game = catalogGameBySlug(slug);
    if (game) found = await catalogued(game, draft);
    else {
        const { loadRegisteredGameBySlug } = await import(
            "./publishedGamesServer"
        );
        const registered = await loadRegisteredGameBySlug(slug);
        if (registered) found = route(registered.game, registered.frame);
    }
    if (!found) return null;
    return slug === name ? { props: found } : { redirect: `/${slug}` };
}
