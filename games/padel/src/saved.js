// What Padel saves through the page (declared in game.json, `saved`), read
// defensively. Pure, so it can be tested without a browser. Sound is not
// here: the page has one sound setting (docs/games/sound.md).

export const DEFAULT_SETTINGS = Object.freeze({
    difficulty: "practice",
    graphics: "high",
    camera: "broadcast",
});
const CHOICES = {
    difficulty: ["practice", "competitive"],
    graphics: ["high", "balanced"],
    camera: ["broadcast", "courtside", "first-person"],
};

/** Settings from anything saved; unknown fields fall back to the defaults. */
export function readSettings(value) {
    const saved = value && typeof value === "object" ? value : {};
    return Object.fromEntries(
        Object.entries(CHOICES).map(([key, allowed]) => [
            key,
            allowed.includes(saved[key]) ? saved[key] : DEFAULT_SETTINGS[key],
        ])
    );
}
