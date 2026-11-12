import { AsyncLocalStorage } from "async_hooks";
import { performance } from "perf_hooks";

/**
 * Server stages of a page request, sent as a `Server-Timing` header in
 * development and production. The header carries these fixed names and their
 * durations only, for the requester's own page. Browsers expose it to the page
 * (`readDocumentServerTimings` in ./documentServerTimings), so a load timeline
 * can include the server's share. `SSR_SERVER_TIMING=off` turns it off.
 */
export type SsrTimingStage =
    | "ssr_total"
    | "ssr_auth"
    | "ssr_user"
    | "ssr_page"
    | "ssr_exhibit"
    | "ssr_destination"
    | "ssr_owner"
    | "ssr_feed";

type Timing = { name: SsrTimingStage; duration: number };
type Response = {
    headersSent?: boolean;
    getHeader?: (name: string) => string | number | string[] | undefined;
    setHeader?: (name: string, value: string) => unknown;
};
const requestTimings = new AsyncLocalStorage<Timing[]>();
const MAX_TIMINGS = 24;

/** Fixed stage names and durations only; never URLs, identity or credentials. */
export async function measureSsrStage<T>(
    name: SsrTimingStage,
    run: () => T | Promise<T>
): Promise<T> {
    const timings = requestTimings.getStore();
    if (!timings) return run();
    const started = performance.now();
    try {
        return await run();
    } finally {
        if (timings.length < MAX_TIMINGS) {
            timings.push({
                name,
                duration: Math.max(0, performance.now() - started),
            });
        }
    }
}

function timingEnabled() {
    if (process.env.SSR_SERVER_TIMING === "off") return false;
    return (
        process.env.NODE_ENV === "development" ||
        process.env.NODE_ENV === "production"
    );
}

/** Request isolation also covers async failures. */
export function withSsrTiming<T>(
    response: Response | undefined,
    run: () => T | Promise<T>
): Promise<T> {
    // A nested wrapper leaves the header to the outer one.
    if (!timingEnabled() || requestTimings.getStore())
        return Promise.resolve().then(run);
    const timings: Timing[] = [];
    return requestTimings.run(timings, async () => {
        try {
            return await measureSsrStage("ssr_total", run);
        } finally {
            try {
                if (response?.setHeader && !response.headersSent) {
                    const previous = response.getHeader?.("Server-Timing");
                    const value = timings
                        .map(
                            ({ name, duration }) =>
                                `${name};dur=${duration.toFixed(1)}`
                        )
                        .join(", ");
                    response.setHeader(
                        "Server-Timing",
                        previous ? `${previous}, ${value}` : value
                    );
                }
            } catch {
                // Diagnostic delivery must never change page rendering.
            }
        }
    });
}
