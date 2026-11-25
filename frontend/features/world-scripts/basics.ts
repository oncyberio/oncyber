/**
 * tokens-ok-file: the colours here are what scripts draw 3D things with
 * (named colours), not interface colours.
 *
 * The small things about world scripts that both sides of a framed world
 * use: the limits, the looks, and the checks on a colour and on text. Kept
 * apart from the rest of the protocol (./protocol.ts) so that the page,
 * which only asks for scripts and saves them, does not load the checks for
 * everything a script can draw, or the painting code behind them.
 */

export const WORLD_SCRIPT_LIMITS = {
    /** Objects one script can have in the world at once. */
    maxThings: 300,
    /** Requests applied per frame; the rest are dropped. */
    maxOpsPerTick: 600,
    /** Messages a script may send between two frames before it is stopped. */
    maxMessagesPerFrame: 120,
    /** HUD lines shown at once. */
    maxHudLines: 8,
    maxTextLength: 160,
    maxIdLength: 40,
    /** Furthest an object can be placed from the world's origin, in metres. */
    maxCoordinate: 2000,
    minScale: 0.001,
    maxScale: 200,
    maxSize: 100,
    maxSeconds: 30,
    /** Source size the server saves and the sandbox accepts. */
    maxSourceBytes: 48_000,
    /** Scripts one space can keep. */
    maxScriptsPerSpace: 3,
    /** Errors before the host stops a script for good. */
    maxErrors: 25,
    /** Models one script can have (a painted one is thousands of strokes). */
    maxModels: 8,
    /** Holes one script can open in the world's own model. */
    maxOpenings: 6,
    /** Longest side of one opening, in metres. */
    maxOpeningSize: 60,
    /** Avatars one script can have standing in the world. */
    maxAvatars: 12,
    /** Boxes and walls in one "solid". */
    maxSolidParts: 64,
    /** Characters of an avatar's name, and of what it says. */
    maxNameLength: 40,
    maxSpeechLength: 200,
} as const;

/**
 * How a thing's surface is drawn. "style" (the default) uses the world's own
 * look (style.ts); the others pick one. All are made on the device from
 * code, so a script never makes the page fetch a texture.
 */
export const THING_LOOKS = [
    "style",
    "painted",
    "toon",
    "glossy",
    "matte",
    "metal",
    "glow",
    "flat",
] as const;
export type ThingLook = (typeof THING_LOOKS)[number];

const COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const NAMED_COLORS: Record<string, string> = {
    white: "#ffffff",
    black: "#000000",
    red: "#ff3b30",
    orange: "#ff9500",
    yellow: "#ffd60a",
    gold: "#ffc400",
    green: "#34c759",
    teal: "#30d5c8",
    blue: "#0a84ff",
    purple: "#bf5af2",
    pink: "#ff6fae",
    gray: "#8e8e93",
    grey: "#8e8e93",
};

export function cleanText(
    value: unknown,
    max: number = WORLD_SCRIPT_LIMITS.maxTextLength
) {
    if (value == null) return "";
    const text = typeof value === "string" ? value : String(value);
    // Control characters other than new lines are dropped.
    // eslint-disable-next-line no-control-regex
    return text
        .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "")
        .slice(0, max);
}

export function cleanColor(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const lower = value.trim().toLowerCase();
    if (NAMED_COLORS[lower]) return NAMED_COLORS[lower];
    return COLOR.test(lower) ? lower : undefined;
}

export function byteLength(text: string) {
    return new TextEncoder().encode(text).length;
}

/** Whether a flag's value means on ("1", "true", "on"). */
export function flagOn(value: unknown) {
    return ["1", "true", "on"].includes(String(value || "").toLowerCase());
}

/** The first line of an error or a log, short enough to show. */
export function firstLine(text = "") {
    return text.split("\n")[0].slice(0, 200);
}

/** What every world script message between a page and its world starts with. */
export const SCRIPT_MESSAGE = "script-";
