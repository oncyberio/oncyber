/**
 * Starts a page's getServerSideProps request before the click that opens it,
 * and hands the answer to the Next router.
 *
 * Opening a space from a link waits first of all for the page's server data
 * (/_next/data/<build>/<locale>/<slug>.json): nothing on the page starts
 * before it arrives, and it takes 0.4–0.7s, or 2s and more when the server
 * function is cold. Next's own prefetch never reads this data for
 * getServerSideProps pages.
 *
 * The pages router keeps in-flight data requests in `router.sdc`, keyed by
 * the absolute data URL, and a navigation reuses an entry it finds there
 * (fetchNextData in next/dist/shared/lib/router/router.js; it drops the
 * entry once a getServerSideProps page has used it). A seed is an entry of
 * the same shape. It lives ROUTE_DATA_SEED_MS at most, so a click never
 * gets data older than that.
 */
import Router from "next/router";

/** A seed older than this is dropped; the click then fetches fresh data. */
export const ROUTE_DATA_SEED_MS = 20_000;

type RouteData = {
    dataHref: string;
    json: any;
    response: Response;
    text: string;
    cacheKey: string;
};
type Seed = { entry: Promise<RouteData>; json: Promise<any | null> };

const seeds = new Map<string, Seed>();

function dataCache(): Record<string, Promise<RouteData>> | null {
    try {
        const sdc = (Router as any).router?.sdc;
        return sdc && typeof sdc === "object" ? sdc : null;
    } catch {
        return null;
    }
}

async function load(cacheKey: string): Promise<RouteData> {
    const url = new URL(cacheKey);
    const response = await fetch(cacheKey, {
        credentials: "same-origin",
        // Same header Next sends when the build has a deployment id.
        headers: process.env.NEXT_DEPLOYMENT_ID
            ? { "x-deployment-id": process.env.NEXT_DEPLOYMENT_ID }
            : {},
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Page data ${response.status}`);
    return {
        dataHref: url.pathname + url.search,
        json: JSON.parse(text),
        response,
        text,
        cacheKey,
    };
}

/**
 * Seeds the router with the data request for `dataUrl` (an absolute
 * /_next/data URL, see destinationDataUrl) and resolves with its JSON, or
 * null when it could not seed or the request failed. Calling it again while
 * a seed is fresh returns the same request.
 */
export function seedRouteData(dataUrl: string): Promise<any | null> {
    const sdc = dataCache();
    if (!sdc) return Promise.resolve(null);
    let cacheKey: string;
    try {
        const base =
            typeof location === "undefined" ? undefined : location.href;
        cacheKey = new URL(dataUrl, base).href;
    } catch {
        return Promise.resolve(null);
    }
    const existing = seeds.get(cacheKey);
    if (existing && sdc[cacheKey] === existing.entry) return existing.json;
    // Next's own request for this page is in flight: leave it alone.
    if (sdc[cacheKey] !== undefined) return Promise.resolve(null);
    const entry: Promise<RouteData> = load(cacheKey).catch(() => {
        // Unused seeds step aside so the click makes its own request; a
        // click already waiting on this one gets a second try.
        if (sdc[cacheKey] === entry) delete sdc[cacheKey];
        return load(cacheKey);
    });
    // The router's catch handles a failure once it uses the entry.
    entry.catch(() => {});
    const seed: Seed = {
        entry,
        json: entry.then(
            (data) => data.json,
            () => null
        ),
    };
    sdc[cacheKey] = entry;
    seeds.set(cacheKey, seed);
    setTimeout(() => {
        if (sdc[cacheKey] === entry) delete sdc[cacheKey];
        if (seeds.get(cacheKey) === seed) seeds.delete(cacheKey);
    }, ROUTE_DATA_SEED_MS);
    return seed.json;
}

/** Test seam: drop every seed. */
export function resetRouteDataSeeds() {
    const sdc = dataCache();
    seeds.forEach((seed, key) => {
        if (sdc?.[key] === seed.entry) delete sdc[key];
    });
    seeds.clear();
}
