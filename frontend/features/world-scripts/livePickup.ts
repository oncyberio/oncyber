/**
 * How a space that is open follows a script saved while it is open.
 *
 * A save says so on the space's live feed (utils/liveSpace): a short
 * notice, no script in it. Every open space already listens to that feed,
 * framed or not, signed in or not. A world that hears of a save newer than
 * what it runs reads the saved script (`worldScripts.current`) and swaps
 * it in the way the sidebar does for its editor: tried out of sight, then
 * in place between two frames (./host.ts). No page reloads.
 *
 * Whoever saves decides how it lands, because only they know what they
 * changed:
 *
 * - "add": the game keeps going. Things with the same id stay where they
 *   are, `keep()` values carry over, the visitor stays where they stand.
 *   This is the default, and right whenever the change can simply be
 *   added: a new prop, a colour, a line of text, a sound.
 * - "rewind": the round starts again, for new rules or a new game, where
 *   carrying the old state into the new script would be wrong.
 *
 * This file is the rules, with nothing of the page in it; ./liveScript.ts
 * does the listening.
 */
import type { SwapMode } from "./host";

export const WORLD_SCRIPT_EVENT = "WORLD_SCRIPT";

export type Landing = "add" | "rewind";
export const LANDINGS: readonly Landing[] = ["add", "rewind"];

/**
 * How long a notice counts. The feed hands a newcomer its newest event,
 * so a notice is also what tells a world that loaded a moment before the
 * save and listened a moment after it; older than this, a world has the
 * save from its own page.
 */
export const SCRIPT_EVENT_LIFE_MS = 2 * 60_000;

/** The notice a save puts on the space's feed. */
export function scriptEvent(savedAt: number, landing: Landing, now: number) {
    return {
        type: WORLD_SCRIPT_EVENT,
        isServerEvent: true,
        savedAt,
        landing,
        // The feed's own convention: the time after which an event is old.
        timestamp: now + SCRIPT_EVENT_LIFE_MS,
    };
}

/** A notice read off the feed, or null for anything else or anything old. */
export function readScriptEvent(
    event: any,
    now: number
): { savedAt: number; landing: Landing } | null {
    if (!event || event.type !== WORLD_SCRIPT_EVENT) return null;
    if (event.isServerEvent !== true) return null;
    if (!Number.isFinite(event.savedAt) || event.savedAt <= 0) return null;
    if (!Number.isFinite(event.timestamp) || now > event.timestamp) return null;
    return {
        savedAt: event.savedAt,
        landing: event.landing === "rewind" ? "rewind" : "add",
    };
}

export type Pickup =
    /** The very script that is running, in the style it is drawn in. */
    | { do: "nothing" }
    /** The same script in a new style: redrawn, nothing restarted. */
    | { do: "restyle" }
    /** The space has no script now. */
    | { do: "stop" }
    | { do: "run"; mode: SwapMode };

/**
 * What a world does about the script it has just read, given the source
 * it runs now. Decided from what was read, never from what a notice says
 * was saved: the feed is one a browser may be able to write to, and a
 * notice is only a reason to go and read. Its `landing` is taken on
 * trust, and the worst a false one can do is rewind a round at a real
 * save.
 */
export function pickup(
    running: string,
    saved: { source: string; restyled?: boolean },
    landing: Landing
): Pickup {
    if (saved.source === running)
        return saved.restyled ? { do: "restyle" } : { do: "nothing" };
    if (!saved.source) return { do: "stop" };
    // Nothing is running, so there is no round to keep or to rewind.
    if (!running) return { do: "run", mode: "fresh" };
    return { do: "run", mode: landing === "rewind" ? "fresh" : "keep" };
}
