/**
 * Saved values for a game, kept by the page. Games run in an opaque-origin
 * frame with no storage of their own, so the page holds a few small string
 * values per game in its own localStorage and hands them over with the
 * visitor's identity.
 */
// Sound is not here: mute and volume are the page's own setting (gameAudio.ts).
export const GAME_STORAGE_KEYS = ["save", "settings"] as const;
export type GameStorageKey = (typeof GAME_STORAGE_KEYS)[number];
export const GAME_STORAGE_MAX = 256 * 1024;

const storageKey = (game: string, key: string) => `oncyber:game:${game}:${key}`;

function isKey(key: unknown): key is GameStorageKey {
    return (GAME_STORAGE_KEYS as readonly unknown[]).includes(key);
}

export function readGameStorage(
    game: string,
    storage: Pick<Storage, "getItem"> | undefined = globalThis.localStorage
): Partial<Record<GameStorageKey, string>> {
    const values: Partial<Record<GameStorageKey, string>> = {};
    for (const key of GAME_STORAGE_KEYS) {
        try {
            const value = storage?.getItem(storageKey(game, key));
            if (typeof value === "string" && value.length <= GAME_STORAGE_MAX)
                values[key] = value;
        } catch {
            /* storage blocked */
        }
    }
    return values;
}

/** Stores one value the game sent; refuses unknown keys and large values. */
export function writeGameStorage(
    game: string,
    key: unknown,
    value: unknown,
    storage: Pick<Storage, "setItem"> | undefined = globalThis.localStorage
): boolean {
    if (
        !isKey(key) ||
        typeof value !== "string" ||
        value.length > GAME_STORAGE_MAX
    )
        return false;
    try {
        storage?.setItem(storageKey(game, key), value);
        return true;
    } catch {
        return false;
    }
}
