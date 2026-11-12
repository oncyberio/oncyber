import Router from "next/router";
import {
    offerRouteData,
    ROUTE_DATA_SEED_MS,
    resetRouteDataSeeds,
    seedRouteData,
} from "./routeDataSeed";

const DATA = "http://localhost/_next/data/b1/en/void.json";
// The key the pages router uses for /[slug].
const ROUTER_KEY = `${DATA}?slug=void`;

function answer(body: any, status = 200, headers: Record<string, string> = {}) {
    // The seed reads only these members of a Response.
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: new Map(Object.entries(headers)),
        text: () => Promise.resolve(JSON.stringify(body)),
    };
}
// What Router.prefetch leaves in sdc when a middleware is present.
const middlewareOnly = () =>
    Promise.resolve({
        dataHref: "/_next/data/b1/en/void.json?slug=void",
        json: {},
        text: "",
        cacheKey: ROUTER_KEY,
        response: answer({}, 200, { "x-middleware-skip": "1" }),
    });

describe("route data seeds", () => {
    let sdc: Record<string, Promise<any>>;
    const fetchMock = jest.fn();

    beforeEach(() => {
        jest.useFakeTimers();
        sdc = {};
        (Router as any).router = { sdc };
        fetchMock.mockReset();
        (global as any).fetch = fetchMock;
    });
    afterEach(() => {
        resetRouteDataSeeds();
        delete (Router as any).router;
        jest.useRealTimers();
    });

    it("hands the full answer to the router under its own key", async () => {
        fetchMock.mockResolvedValueOnce(answer({ pageProps: { a: 1 } }));
        const json = seedRouteData(DATA);
        sdc[ROUTER_KEY] = middlewareOnly();
        expect(await offerRouteData(DATA)).toBe(true);
        expect(await json).toEqual({ pageProps: { a: 1 } });
        const entry = await sdc[ROUTER_KEY];
        expect(entry.cacheKey).toBe(ROUTER_KEY);
        expect(entry.json).toEqual({ pageProps: { a: 1 } });
        expect(entry.response.headers.get("x-middleware-skip")).toBe(undefined);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("reuses a fresh request and drops the offer after ROUTE_DATA_SEED_MS", async () => {
        fetchMock.mockImplementation(async () => answer({ pageProps: {} }));
        const first = seedRouteData(DATA);
        expect(seedRouteData(DATA)).toBe(first);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        sdc[ROUTER_KEY] = middlewareOnly();
        await offerRouteData(DATA);
        jest.advanceTimersByTime(ROUTE_DATA_SEED_MS);
        expect(sdc[ROUTER_KEY]).toBeUndefined();
    });

    it("leaves a navigation's own request alone", async () => {
        fetchMock.mockResolvedValue(answer({ pageProps: {} }));
        void seedRouteData(DATA);
        const own = Promise.resolve({
            response: answer({ pageProps: {} }),
        });
        sdc[ROUTER_KEY] = own;
        expect(await offerRouteData(DATA)).toBe(false);
        expect(sdc[ROUTER_KEY]).toBe(own);
    });

    it("gives a waiting click its own request when the seed failed", async () => {
        fetchMock
            .mockResolvedValueOnce(answer({}, 500))
            .mockResolvedValueOnce(answer({ pageProps: { b: 2 } }));
        const json = seedRouteData(DATA);
        sdc[ROUTER_KEY] = middlewareOnly();
        await offerRouteData(DATA);
        expect(await json).toBe(null);
        expect((await sdc[ROUTER_KEY]).json).toEqual({ pageProps: { b: 2 } });
        expect(fetchMock.mock.calls[1][0]).toBe(ROUTER_KEY);
    });

    it("does nothing without a router", async () => {
        delete (Router as any).router;
        expect(await seedRouteData(DATA)).toBe(null);
        expect(await offerRouteData(DATA)).toBe(false);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
