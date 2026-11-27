// What ACE saves through the page (declared in game.json, `saved`), and how
// saves from older versions are read. Pure, so it can be tested without a
// browser. See docs/games/saved-data.md.
import { DIFFICULTY } from "./config.js";

export const DEFAULT_SETTINGS = { difficulty: "pro", games: 2 };

/** Settings from anything saved; unknown fields fall back to `base`. */
export function readSettings(value, base = DEFAULT_SETTINGS) {
    const saved = value && typeof value === "object" ? value : {};
    return {
        difficulty: Object.hasOwn(DIFFICULTY, saved.difficulty)
            ? saved.difficulty
            : base.difficulty,
        games: [1, 2, 3].includes(saved.games) ? saved.games : base.games,
    };
}

/** The party's pick: a format id, or null. Written by any party member. */
export function readFormat(value) {
    return value && typeof value.format === "string"
        ? value.format.slice(0, 24)
        : null;
}

/** Matches finished by everyone. Shared input, so read defensively. */
export function readTally(value) {
    const matches = value?.matches;
    return Number.isInteger(matches) && matches >= 0 && matches < 1e12
        ? matches
        : 0;
}

// stateVersion 0 is what ACE kept before keys were declared: the raw
// string '{"difficulty":"pro","games":2}'. (Sound is not saved by the game:
// the page has one sound setting, docs/games/sound.md.)
export const MIGRATE = {
    settings: (old, from) =>
        from === 0 && typeof old === "string"
            ? readSettings(JSON.parse(old))
            : undefined,
};

/**
 * Read, change, write a shared key through the host's `storage` service
 * (`call(operation, value)` resolves to the service's answer, or null).
 * A write names the revision it read; when someone else wrote first the
 * change is applied to what they wrote and tried again. Resolves to the
 * value kept, or null when it could not be saved. Never rejects.
 */
export async function updateSaved(call, key, change, attempts = 4) {
    let read = await call("get", { key });
    for (let attempt = 0; attempt < attempts; attempt++) {
        if (!read || read.outcome === "unavailable") return null;
        const value = change(read.value);
        const write = await call("set", {
            key,
            value,
            ifRevision: read.revision,
        });
        if (write?.ok) return value;
        if (write?.reason !== "conflict" || !write.current) return null;
        read = write.current;
    }
    return null;
}
