import { tripMark } from "./tripTimingMarks";
/** Development-only startup evidence exposed as DOM attributes for the travel lab.
 * No telemetry, full URLs, query strings, account data or persistent storage. */
const stages: Record<string, number> = {};
const round = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 0;
export function publishNativeStartupDiagnostics(element?: Element | null) {
    if (
        process.env.NODE_ENV !== "development" ||
        typeof document === "undefined"
    )
        return;
    try {
        const target = element || document.documentElement;
        const navigation = performance.getEntriesByType("navigation")[0] as
            | PerformanceNavigationTiming
            | undefined;
        const nav: Record<string, unknown> = {};
        if (navigation) {
            for (const key of [
                "fetchStart",
                "requestStart",
                "responseStart",
                "responseEnd",
                "domInteractive",
                "domContentLoadedEventEnd",
                "loadEventEnd",
                "transferSize",
                "encodedBodySize",
                "decodedBodySize",
            ])
                nav[key] = round(navigation[key]);
            nav.type = navigation.type;
            nav.serverTiming = (navigation.serverTiming || [])
                .filter((entry) => /^ssr_[a-z_]{1,32}$/.test(entry.name))
                .slice(0, 24)
                .map((entry) => ({
                    name: entry.name,
                    duration: round(entry.duration),
                }));
        }
        const resources = (
            performance.getEntriesByType(
                "resource"
            ) as PerformanceResourceTiming[]
        )
            .filter((entry) => Number.isFinite(entry.duration))
            .sort((a, b) => b.duration - a.duration)
            .slice(0, 12)
            .map((entry) => {
                let name = "resource";
                try {
                    name =
                        new URL(entry.name, document.baseURI).pathname
                            .split("/")
                            .filter(Boolean)
                            .pop()
                            ?.slice(0, 100) || "document";
                } catch {}
                return {
                    name,
                    initiator: entry.initiatorType.slice(0, 24),
                    start: round(entry.startTime),
                    duration: round(entry.duration),
                    transfer: round(entry.transferSize),
                    encoded: round(entry.encodedBodySize),
                    decoded: round(entry.decodedBodySize),
                };
            });
        target.setAttribute(
            "data-native-startup-stages",
            JSON.stringify(stages)
        );
        target.setAttribute(
            "data-native-startup-navigation",
            JSON.stringify(nav)
        );
        target.setAttribute(
            "data-native-startup-resources",
            JSON.stringify(resources)
        );
        target.setAttribute(
            "data-native-startup-document-ms",
            String(round(performance.now()))
        );
    } catch {
        /* Diagnostics must never affect renderer readiness. */
    }
}
export function markNativeStartup(stage: string) {
    tripMark(`native:${stage}`);
    if (
        process.env.NODE_ENV !== "development" ||
        typeof document === "undefined"
    )
        return;
    if (
        !Object.prototype.hasOwnProperty.call(stages, stage) &&
        Object.keys(stages).length >= 32
    )
        return;
    stages[stage.slice(0, 64)] = round(performance.now());
    publishNativeStartupDiagnostics();
}
