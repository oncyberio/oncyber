/**
 * dat.gui, the engine's debug panel. It is for `?debug=true` only, so it is
 * fetched only then, before the engine's own modules run (see
 * displyUI/Exhibit3DGate.tsx), and is not part of what every visitor loads.
 */
let panel = null;

export function debugRequested() {
    return (
        typeof window !== "undefined" &&
        /[?&]debug=true(?:&|$)/.test(window.location.search)
    );
}

/** Fetches the panel when the address asks for it. Resolves either way. */
export async function loadDebugPanel() {
    if (panel || !debugRequested()) return;
    try {
        panel = (await import("dat.gui")).default;
    } catch (error) {
        console.warn("The debug panel did not load", error);
    }
}

/** dat.gui once loaded; null for everyone who did not ask for it. */
export function debugPanel() {
    return panel;
}

/**
 * Stands in for a panel that is not there: every call and every property
 * answers with itself, so code written for the panel runs and does nothing.
 */
export const NO_PANEL = new Proxy(function () {}, {
    get: (_target, key) => (key === Symbol.toPrimitive ? () => "" : NO_PANEL),
    apply: () => NO_PANEL,
    construct: () => NO_PANEL,
});
