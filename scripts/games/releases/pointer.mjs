// The pointer: which stored release each game's page loads. It is the only
// thing that changes when a game is published or rolled back.
//
// {
//   "version": 1,
//   "games": {
//     "ace": {
//       "current": "<release id>",
//       "releases": [ { release, base, backend, address, publishedAt, files, bytes }, ... ]
//     }
//   }
// }
//
// `releases` is newest first and keeps what the page needs to load any of
// them, so rollback is setting `current` to an earlier id.
import {
    existsSync,
    mkdirSync,
    readFileSync,
    renameSync,
    writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { GAME_ID, RELEASE_ID } from "./storage.mjs";

/** Earlier releases kept per game for rollback. */
export const HISTORY = 20;

export function readPointers(file) {
    if (!existsSync(file)) return { version: 1, games: {} };
    const pointers = JSON.parse(readFileSync(file, "utf8"));
    if (pointers?.version !== 1 || typeof pointers.games !== "object")
        throw new Error(`${file} is not a games pointer file`);
    return pointers;
}

export function writePointers(file, pointers) {
    mkdirSync(dirname(file), { recursive: true });
    const staging = `${file}.${process.pid}.tmp`;
    writeFileSync(staging, JSON.stringify(pointers, null, 4) + "\n");
    renameSync(staging, file);
}

/** The entry a game's page loads now, or null. */
export function currentRelease(pointers, game) {
    const entry = Object.hasOwn(pointers.games, game)
        ? pointers.games[game]
        : null;
    return entry?.releases.find((r) => r.release === entry.current) ?? null;
}

/** Point a game at a release that was just stored. Returns new pointers. */
export function pointTo(pointers, game, stored) {
    if (!GAME_ID.test(game)) throw new Error(`bad game id ${game}`);
    if (!RELEASE_ID.test(stored.release))
        throw new Error(`bad release id ${stored.release}`);
    if (typeof stored.base !== "string" || !stored.base.endsWith("/"))
        throw new Error("a release's base URL ends in /");
    const before = Object.hasOwn(pointers.games, game)
        ? pointers.games[game].releases
        : [];
    // Publishing the same files again moves the release to the front; where
    // it is stored is replaced only by the same release id.
    const releases = [
        stored,
        ...before.filter((r) => r.release !== stored.release),
    ].slice(0, HISTORY);
    return {
        ...pointers,
        games: {
            ...pointers.games,
            [game]: { current: stored.release, releases },
        },
    };
}

/**
 * Point a game back at an earlier release: the named one, or the one
 * published before the current one. Nothing is uploaded or deleted.
 */
export function rollback(pointers, game, release) {
    const entry = Object.hasOwn(pointers.games, game)
        ? pointers.games[game]
        : null;
    if (!entry) throw new Error(`${game} has no hosted release to roll back`);
    const at = entry.releases.findIndex((r) => r.release === entry.current);
    const target = release
        ? entry.releases.find((r) => r.release === release)
        : entry.releases[at + 1];
    if (!target)
        throw new Error(
            release
                ? `${game} has no release ${release}; see games:release list ${game}`
                : `${game} has no release before ${entry.current}`
        );
    return {
        ...pointers,
        games: {
            ...pointers.games,
            [game]: { ...entry, current: target.release },
        },
    };
}

/** Stop pointing at hosted releases: the page falls back to the committed build. */
export function unpoint(pointers, game) {
    const { [game]: _removed, ...games } = pointers.games;
    return { ...pointers, games };
}
