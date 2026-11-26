/**
 * Whether the world has a scene yet. Asked before any of the engine's own
 * modules may be loaded (importing them before the world exists evaluates
 * them in another order), so it reads the one thing the engine leaves on
 * the page for that: `window.scene`, set by the engine's scene when it is
 * made. Part of the engine facade (./facade.ts), kept apart only so that
 * asking does not load the engine.
 */
export function worldHasScene(
    win: any = typeof window === "undefined" ? undefined : window
) {
    return !!win?.scene;
}
