import { useEffect, useRef } from "react";

/** Quiet checks, with one request at a time and none while away from the catalog. */
export default function useTemplateRefresh(
    active: boolean,
    busy: boolean,
    refresh: () => Promise<unknown>
) {
    const latest = useRef({ busy, refresh });
    latest.current = { busy, refresh };
    const visited = useRef(false);
    const running = useRef(false);
    const lastStarted = useRef(-Infinity);
    useEffect(() => {
        if (!active) return;
        let disposed = false;
        async function check() {
            if (
                disposed ||
                running.current ||
                latest.current.busy ||
                document.visibilityState !== "visible" ||
                Date.now() - lastStarted.current < 1000
            )
                return;
            running.current = true;
            lastStarted.current = Date.now();
            try {
                await latest.current.refresh();
            } catch {
                /* The provider displays its error state. */
            } finally {
                running.current = false;
            }
        }
        // The provider owns initial loading; returning to the catalog checks immediately.
        if (visited.current) void check();
        visited.current = true;
        window.addEventListener("focus", check);
        document.addEventListener("visibilitychange", check);
        const timer = setInterval(check, 30000);
        return () => {
            disposed = true;
            clearInterval(timer);
            window.removeEventListener("focus", check);
            document.removeEventListener("visibilitychange", check);
        };
    }, [active]);
}
