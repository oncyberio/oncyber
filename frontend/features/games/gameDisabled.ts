/**
 * The kill switch for games. `GAMES_DISABLED` is a server-side list of what
 * must not load, separated by commas or spaces:
 *
 *     GAMES_DISABLED="ace, garden@0800022feca2d8ba"
 *
 * `ace` pauses every release of Ace; `garden@<release id>` pauses that one
 * release of the garden, so publishing a fixed release brings the game back
 * without touching the variable. The game page reads the list before it
 * mounts the game's frame and shows "this game is paused" instead
 * (docs/games/field-health.md). The release id is the one the page is about
 * to load: the pointer's for a hosted release (docs/games/releases.md,
 * `pauseForRelease`), `release.json`'s for the committed build.
 *
 * This file imports nothing, so `pnpm games:check` runs the same decision.
 */

export interface GamePause {
    /** Every release of the game is paused. */
    paused: boolean;
    /** Release ids of this game that are paused. */
    releases: string[];
}

const GAME_ID = /^[a-z0-9][a-z0-9-]{0,62}$/;
const RELEASE_ID = /^[a-z0-9][a-z0-9._-]{0,63}$/;

/** The entries of a `GAMES_DISABLED` value that are well formed. */
export function parseDisabledGames(
    value: string | undefined
): Array<{ game: string; release: string | null }> {
    return (value ?? "")
        .toLowerCase()
        .split(/[\s,]+/)
        .filter(Boolean)
        .flatMap((entry) => {
            const [game, release, extra] = entry.split("@");
            if (!GAME_ID.test(game) || extra !== undefined) return [];
            if (release === undefined) return [{ game, release: null }];
            return RELEASE_ID.test(release) ? [{ game, release }] : [];
        });
}

/** What the server tells the game page about one game. */
export function gamePause(
    id: string,
    env: Record<string, string | undefined> = process.env
): GamePause {
    const entries = parseDisabledGames(env.GAMES_DISABLED).filter(
        (entry) => entry.game === id
    );
    return {
        paused: entries.some((entry) => entry.release === null),
        releases: entries.flatMap((entry) => entry.release ?? []),
    };
}

/**
 * The answer for a visit whose release id is already known: a hosted
 * release, named by the game's pointer. A listed release is paused outright;
 * any other leaves nothing for the page to look up. With no id (the
 * committed build) the answer is unchanged and the page reads `release.json`.
 */
export function pauseForRelease(
    pause: GamePause,
    release: string | null | undefined
): GamePause {
    if (pause.paused || !release) return pause;
    return {
        paused: pause.releases.includes(release.toLowerCase()),
        releases: [],
    };
}

/**
 * The page's decision. A release-level pause needs the release id, which
 * `loadRelease` reads from the game's `release.json`; it is only called
 * when some release of this game is paused. If the id can't be read the
 * game plays: to stop a game for certain, pause its id.
 */
export async function resolveGamePause(
    pause: GamePause | null | undefined,
    loadRelease: () => Promise<string | null>
): Promise<"paused" | "play"> {
    if (pause?.paused) return "paused";
    if (!pause?.releases?.length) return "play";
    const release = await loadRelease().catch(() => null);
    return release && pause.releases.includes(release.toLowerCase())
        ? "paused"
        : "play";
}

/** The release id in a game's `release.json`, or null. */
export async function fetchGameRelease(
    id: string,
    fetcher: typeof fetch = fetch
): Promise<string | null> {
    try {
        const response = await fetcher(`/games/${id}/release.json`, {
            cache: "no-store",
            // Older browsers have no AbortSignal.timeout; they just wait.
            signal: AbortSignal.timeout?.(5000),
        });
        if (!response.ok) return null;
        const release = (await response.json())?.release;
        return typeof release === "string" && RELEASE_ID.test(release)
            ? release
            : null;
    } catch {
        return null;
    }
}
