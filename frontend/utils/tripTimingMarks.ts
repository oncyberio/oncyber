/**
 * Opt-in trip profiling. With localStorage "oncyber:trip-marks" set to "1",
 * each world-load and native-entry stage also leaves a performance mark, so
 * a lobby trip can be broken down from the lobby page (same origin) in a
 * production build. Off by default; never affects loading.
 */
let enabled: boolean | undefined;

export function tripMark(name: string) {
    if (enabled === undefined) {
        try {
            enabled =
                typeof window !== "undefined" &&
                window.localStorage.getItem("oncyber:trip-marks") === "1";
        } catch {
            enabled = false;
        }
    }
    if (!enabled) return;
    try {
        performance.mark(name);
    } catch {}
}
