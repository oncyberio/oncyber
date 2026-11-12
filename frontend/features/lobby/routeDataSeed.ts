/**
 * Starts a page's getServerSideProps request before the click that opens it,
 * and hands the answer to the Next router.
 *
 * Opening a space from a link waits first of all for the page's server data
 * (/_next/data/<build>/<locale>/<slug>.json): nothing on the page starts
 * before it arrives, and it takes 0.4–0.7s, or 2s and more when the server
 * function is cold. Next's own prefetch never reads this data for
 * getServerSideProps pages: with a middleware it only asks the middleware
 * (an answer marked x-middleware-skip), and the click fetches the data again.
 *
 * The pages router keeps data requests in `router.sdc`, keyed by the data
 * URL it builds for the route (for /[slug] that is ".../void.json?slug=void").
 * Router.prefetch leaves its middleware-only answer there under that key,
 * and a navigation that finds it fetches again (fetchNextData and
 * getRouteInfo in next/dist/shared/lib/router/router.js). Once that prefetch
 * has run, offerRouteData puts the full answer under the same key, so the
 * navigation uses it as is. An offer lives ROUTE_DATA_SEED_MS at most, so a
 * click never gets data older than that.
 */
import Router from "next/router";

/** Data older than this is not offered; the click then fetches fresh data. */
export const ROUTE_DATA_SEED_MS = 20_000;

type RouteData = {
    dataHref: string;
    json: any;
    response: { headers: { get(name: string): string | null } };
    text: string;
    cacheKey: string;
};
type Seed = {
    started: number;
    data: Promise<RouteData>;
    json: Promise<any | null>;
};

const seeds = new Map<string, Seed>();
/** sdc entries this module put there, so it only ever removes its own. */
const offered = new Map<string, Promise<RouteData>>();

function dataCache(): Record<string, Promise<RouteData>> | null {
    try {
        const sdc = (Router as any).router?.sdc;
        return sdc && typeof sdc === "object" ? sdc : null;
    } catch {
        return null;
    }
}

function absolute(url: string) {
    try {
        const base =
            typeof location === "undefined" ? undefined : location.href;
        return new URL(url, base);
    } catch {
        return null;
    }
}

async function load(url: string): Promise<RouteData> {
    const response = await fetch(url, {
        credentials: "same-origin",
        // Same header Next sends when the build has a deployment id.
        headers: process.env.NEXT_DEPLOYMENT_ID
            ? { "x-deployment-id": process.env.NEXT_DEPLOYMENT_ID }
            : {},
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Page data ${response.status}`);
    const parsed = new URL(url);
    return {
        dataHref: parsed.pathname + parsed.search,
        json: JSON.parse(text),
        response,
        text,
        cacheKey: url,
    };
}

const fresh = (seed: Seed | undefined) =>
    !!seed && performance.now() - seed.started < ROUTE_DATA_SEED_MS;

/**
 * Starts the server data request for `dataUrl` (an absolute /_next/data URL,
 * see destinationDataUrl) and resolves with its JSON, or null when it
 * failed. Calling it again while the request is fresh returns the same one.
 */
export function seedRouteData(dataUrl: string): Promise<any | null> {
    const url = absolute(dataUrl);
    if (!url || !dataCache()) return Promise.resolve(null);
    const key = url.href;
    const existing = seeds.get(key);
    if (fresh(existing)) return existing.json;
    const data = load(key);
    const seed: Seed = {
        started: performance.now(),
        data,
        json: data.then(
            (answer) => answer.json,
            () => null
        ),
    };
    seeds.set(key, seed);
    setTimeout(() => {
        if (seeds.get(key) === seed) seeds.delete(key);
    }, ROUTE_DATA_SEED_MS);
    return seed.json;
}

/** Whether an sdc entry is Router.prefetch's middleware-only answer. */
async function middlewareOnly(entry: Promise<RouteData>) {
    try {
        const answer = await entry;
        return answer?.response?.headers?.get("x-middleware-skip") === "1";
    } catch {
        return false;
    }
}

/**
 * Call after Router.prefetch(href) resolved: replaces its middleware-only
 * answer for this page with the seeded one, under the router's own key.
 * Resolves with whether it did.
 */
export async function offerRouteData(dataUrl: string) {
    const sdc = dataCache();
    const url = absolute(dataUrl);
    const seed = url && seeds.get(url.href);
    if (!sdc || !seed || !fresh(seed)) return false;
    const keys = Object.keys(sdc).filter((key) => {
        const candidate = absolute(key);
        return (
            candidate?.origin === url.origin &&
            candidate.pathname === url.pathname &&
            offered.get(key) !== sdc[key]
        );
    });
    let handed = false;
    for (const key of keys) {
        const prefetched = sdc[key];
        if (!(await middlewareOnly(prefetched))) continue;
        // A navigation may have taken or replaced the entry meanwhile.
        if (sdc[key] !== prefetched || !fresh(seed)) continue;
        // Still loading is fine: a click waits on it, and gets a request
        // of its own if it fails.
        const entry = seed.data.then(
            (answer) => ({ ...answer, cacheKey: key }),
            () => load(key)
        );
        entry.catch(() => {});
        sdc[key] = entry;
        offered.set(key, entry);
        handed = true;
        const left = ROUTE_DATA_SEED_MS - (performance.now() - seed.started);
        setTimeout(() => {
            if (sdc[key] === entry) delete sdc[key];
            if (offered.get(key) === entry) offered.delete(key);
        }, Math.max(0, left));
    }
    return handed;
}

/** Test seam: drop every seed and offer. */
export function resetRouteDataSeeds() {
    const sdc = dataCache();
    offered.forEach((entry, key) => {
        if (sdc?.[key] === entry) delete sdc[key];
    });
    offered.clear();
    seeds.clear();
}
