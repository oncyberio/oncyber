/**
 * Browser side of ./ssrTiming: the server stages of the document this page
 * was served in, read from its `Server-Timing` header through the
 * Navigation Timing API. Safe to import in the browser (no server modules).
 *
 *     load.end("idle-ready", { server: readDocumentServerTimings() });
 *
 * Returns milliseconds per stage (`ssr_total`, `ssr_exhibit`, ...), rounded.
 * It returns an empty object when the browser does not expose server timing,
 * when the header was absent, and when the current page was reached by an
 * in-app navigation (its path is not the document's), so a timeline never
 * carries another page's server stages.
 */
export function readDocumentServerTimings(
    browser: {
        performance?: Performance;
        location?: Location;
    } = typeof window === "undefined" ? {} : window
): Record<string, number> {
    const stages: Record<string, number> = {};
    try {
        const entry = browser.performance?.getEntriesByType?.(
            "navigation"
        )?.[0] as PerformanceNavigationTiming | undefined;
        if (!entry?.serverTiming?.length) return stages;
        if (
            browser.location &&
            new URL(entry.name, browser.location.href).pathname !==
                browser.location.pathname
        )
            return stages;
        for (const { name, duration } of entry.serverTiming) {
            if (/^ssr_[a-z_]{1,32}$/.test(name) && Number.isFinite(duration))
                stages[name] = Math.round(duration);
        }
    } catch {
        // Diagnostics must never break a load.
    }
    return stages;
}
