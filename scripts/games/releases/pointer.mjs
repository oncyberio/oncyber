// The pointer: which stored release each game's page loads, if any. It is
// the only thing that changes when a game is switched to hosted releases,
// published while hosted, or rolled back.
//
// {
//   "version": 1,
//   "games": {
//     "ace": {
//       "current": "<release id>" | null,
//       "releases": [ { release, base, backend, address, publishedAt, files, bytes }, ... ]
//     }
//   }
// }
//
// `releases` is newest first and keeps what the page needs to load any of
// them, so rollback is setting `current` to an earlier id. `current` is null
// for a game whose releases are stored but whose page still loads the
// committed build: storing a release never switches a game to hosted, a
// person does (`pnpm games:release point <id>`).
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

/**
 * Record a release that was just stored and, with `point`, load the game's
 * page from it. Without, `current` stays where it was (null for a game that
 * loads its committed build). Returns new pointers.
 */
export function pointTo(pointers, game, stored, { point = true } = {}) {
    if (!GAME_ID.test(game)) throw new Error(`bad game id ${game}`);
    if (!RELEASE_ID.test(stored.release))
        throw new Error(`bad release id ${stored.release}`);
    if (typeof stored.base !== "string" || !stored.base.endsWith("/"))
        throw new Error("a release's base URL ends in /");
    const entry = Object.hasOwn(pointers.games, game)
        ? pointers.games[game]
        : null;
    const before = entry?.releases ?? [];
    const current = point ? stored.release : entry?.current ?? null;
    // Publishing the same files again moves the release to the front; where
    // it is stored is replaced only by the same release id.
    const all = [stored, ...before.filter((r) => r.release !== stored.release)];
    const releases = all.slice(0, HISTORY);
    // The release the page loads is never dropped from the history.
    const loaded = all.find((r) => r.release === current);
    if (loaded && !releases.includes(loaded)) releases.push(loaded);
    return {
        ...pointers,
        games: { ...pointers.games, [game]: { current, releases } },
    };
}

/**
 * Switch a game to a stored release: the named one, or the newest. This is
 * the one way a game that loads its committed build becomes hosted.
 */
export function point(pointers, game, release) {
    const entry = Object.hasOwn(pointers.games, game)
        ? pointers.games[game]
        : null;
    const target = release
        ? entry?.releases.find((r) => r.release === release)
        : entry?.releases[0];
    if (!target)
        throw new Error(
            release
                ? `${game} has no stored release ${release}; see games:release list ${game}`
                : `${game} has no stored release; run pnpm games:publish ${game} or pnpm games:release upload ${game}`
        );
    return {
        ...pointers,
        games: {
            ...pointers.games,
            [game]: { ...entry, current: target.release },
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
    const at =
        entry?.releases.findIndex((r) => r.release === entry.current) ?? -1;
    if (at < 0)
        throw new Error(
            `${game} loads its committed build; there is no hosted release to roll back`
        );
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

/**
 * Stop pointing at hosted releases: the page falls back to the committed
 * build. The stored releases stay listed, so `point` can switch back.
 */
export function unpoint(pointers, game) {
    const entry = Object.hasOwn(pointers.games, game)
        ? pointers.games[game]
        : null;
    if (!entry) return pointers;
    return {
        ...pointers,
        games: { ...pointers.games, [game]: { ...entry, current: null } },
    };
}
