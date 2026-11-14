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
// strings '{"difficulty":"pro","games":2}' and "1" / "0".
export const MIGRATE = {
    settings: (old, from) =>
        from === 0 && typeof old === "string"
            ? readSettings(JSON.parse(old))
            : undefined,
    muted: (old, from) => (from === 0 ? old === "1" : undefined),
};
