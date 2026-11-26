/**
 * What the page shows over a framed world while it loads.
 *
 * A world draws its own star field while it loads, on the thread that is
 * loading it: every model parsed and shader compiled is a held frame, so
 * the stars stutter exactly when there is most to wait for. The page is
 * another document on another site, which a browser that isolates sites
 * runs in another process, and it has nothing else to do meanwhile. So the
 * page draws the same stars over the frame (./WorldStars) until the world
 * says it has drawn.
 */
export type WorldCover = "stars" | "plain" | "none";

export function worldCover(state: {
    /** The frame's loading phase (features/games/loading/gameLoading). */
    phase: string;
    /** A trip from the lobby: the lobby stays on screen until the world is ready. */
    onTrip: boolean;
    /**
     * The world is gated: what it shows before it draws (a password to
     * give, a wallet to connect) must not be covered.
     */
    gated: boolean;
    /** The visitor asked for less motion: a still cover, no stars. */
    reducedMotion: boolean;
}): WorldCover {
    if (state.phase !== "loading" || state.onTrip || state.gated) return "none";
    return state.reducedMotion ? "plain" : "stars";
}

/**
 * How solid the cover is. A browser slows a frame from another origin to
 * a couple of frames a second while something opaque covers it, and a
 * world loads by frames (./worldFrames.ts), so the cover stops a breath
 * short of opaque. What shows through is the world's own stars, at about
 * one part in a hundred.
 */
export const WORLD_COVER_OPACITY = 0.988;

/**
 * Whether the page's verdict on a space's gate is anything but "come in".
 * A space with no gate is given the same verdict as one the visitor
 * passed: `success`.
 */
export function isGated(gate?: { type: string } | null) {
    return !!gate && gate.type !== "success";
}
