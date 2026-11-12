/**
 * How travelling to a space looks, while Rayan compares the options. One URL
 * switch, read from the page or from the parent lobby when a space runs in
 * the lobby's same-origin frame, without changing subsequent visits:
 *
 *   ?travel=cubes   (default) cube reveals for both departure and arrival
 *   ?reveal=sweep   preview the alternate sweep arrival
 *   ?travel=sweep   legacy alias for reveal=sweep; the space appears with a shader front
 *                   spreading from your feet (cheaper, faster)
 *   ?travel=portal  choosing a space opens the round portal in front of you
 *                   (the profile portal from codex/new-portals-for-profile);
 *                   walk into it to go
 */
export type TravelStyle = "cubes" | "sweep" | "portal";

/** Preview options are URL-only. A previous portal experiment must never
 * silently replace the default experience on a later visit. */
export function readPreviewOption(name: string): string | null {
    try {
        const local = new URLSearchParams(window.location.search).get(name);
        if (local) return local;
        if (window.parent !== window)
            return new URLSearchParams(window.parent.location.search).get(name);
    } catch {
        /* No preferences from a cross-origin parent. */
    }
    return null;
}

export function readTravelStyle(): TravelStyle {
    const value = readPreviewOption("travel");
    return value === "sweep" || value === "portal" ? value : "cubes";
}

/** Transport and destination reveal are independent choices. */
export function readTransportStyle(): "standard" | "portal" {
    return readTravelStyle() === "portal" ? "portal" : "standard";
}

export function readRevealStyle(): "tiles" | "sweep" {
    const reveal = readPreviewOption("reveal");
    if (reveal === "sweep") return "sweep";
    if (reveal === "tiles" || reveal === "cubes") return "tiles";
    return readTravelStyle() === "sweep" ? "sweep" : "tiles";
}
