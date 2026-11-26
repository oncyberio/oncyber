/**
 * The one switch that hides games until launch. Everything of a game
 * answers only where it is on: its page (/games/<id>), its static build
 * (/game-builds/<id>/..., `hiddenGameFile` below, asked by middleware.ts),
 * its hosted releases, its saved data, its results and its publishing.
 *
 * On: the development server, or a deployment that sets `GAMES_PREVIEW=1`.
 *
 * `GAMES_PREVIEW` is a server variable, so in the browser only the
 * development server reads as on: a preview deployment serves a game to
 * someone who has its address, and the lobby lists games on the development
 * server alone (gameCards.ts).
 *
 * No imports: the middleware loads this file at the edge.
 */
export function gamesPreviewEnabled(
    // Each variable by name: the edge and the browser fill in `process.env`
    // one named value at a time, not as an object to read from.
    env: Record<string, string | undefined> = {
        NODE_ENV: process.env.NODE_ENV,
        GAMES_PREVIEW: process.env.GAMES_PREVIEW,
    }
): boolean {
    return env.NODE_ENV === "development" || env.GAMES_PREVIEW === "1";
}

/**
 * Anything under the address the committed builds are served from,
 * `public/game-builds/<id>/` (gameRelease.ts, `GAME_BUILDS_PATH`): the
 * bundle, `check.json`, `release.json`, and a build's folder itself, which a
 * host answers with its index file. A game's page (/games/<id>) is not
 * here: no build can stand in for it, and it hides itself
 * (pages/games/[game].tsx).
 */
const GAME_FILE = /^\/game-builds(\/|$)/i;

export function isGameFile(path: string): boolean {
    return GAME_FILE.test(path);
}

/** Whether a request for `path` is for a game's file while games are hidden. */
export function hiddenGameFile(
    path: string,
    env?: Record<string, string | undefined>
): boolean {
    return isGameFile(path) && !gamesPreviewEnabled(env);
}

/**
 * What the middleware matches to ask this (Next's matcher syntax). Next
 * reads a middleware's matcher without running it, so middleware.ts writes
 * this same text out; gamesPreview.test.ts fails when the two differ.
 */
export const GAME_FILE_MATCHER = "/game-builds/:path*";
