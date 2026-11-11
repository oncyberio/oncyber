import Router from "next/router";
import {
    ROUTE_DATA_SEED_MS,
    resetRouteDataSeeds,
    seedRouteData,
} from "./routeDataSeed";

const URL_A = "http://localhost/_next/data/b1/en/void.json";

function answer(body: any, status = 200) {
    // jsdom has no Response; the seed reads only these members.
    return Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        headers: new Map([["content-type", "application/json"]]),
        text: () => Promise.resolve(JSON.stringify(body)),
    });
}

describe("seedRouteData", () => {
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

    it("hands the router an entry shaped like its own data request", async () => {
        fetchMock.mockReturnValueOnce(answer({ pageProps: { a: 1 } }));
        const json = await seedRouteData(URL_A);
        expect(json).toEqual({ pageProps: { a: 1 } });
        const entry = await sdc[URL_A];
        expect(entry).toMatchObject({
            dataHref: "/_next/data/b1/en/void.json",
            cacheKey: URL_A,
            json: { pageProps: { a: 1 } },
        });
        expect(entry.response.headers.get("content-type")).toContain("json");
    });

    it("reuses a fresh seed and drops it after ROUTE_DATA_SEED_MS", async () => {
        fetchMock.mockImplementation(() => answer({ pageProps: {} }));
        const first = seedRouteData(URL_A);
        expect(seedRouteData(URL_A)).toBe(first);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        jest.advanceTimersByTime(ROUTE_DATA_SEED_MS);
        expect(sdc[URL_A]).toBeUndefined();
        void seedRouteData(URL_A);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("seeds again once the router used the entry", () => {
        fetchMock.mockImplementation(() => answer({ pageProps: {} }));
        void seedRouteData(URL_A);
        delete sdc[URL_A]; // what the router does after a navigation
        void seedRouteData(URL_A);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("leaves the router's own request alone", async () => {
        const own = Promise.resolve({});
        sdc[URL_A] = own;
        expect(await seedRouteData(URL_A)).toBe(null);
        expect(sdc[URL_A]).toBe(own);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("steps aside on failure, and retries for a click already waiting", async () => {
        fetchMock
            .mockReturnValueOnce(answer({}, 500))
            .mockReturnValueOnce(answer({ pageProps: { b: 2 } }));
        const json = seedRouteData(URL_A);
        const waiting = sdc[URL_A];
        expect(await json).toEqual({ pageProps: { b: 2 } });
        expect((await waiting).json).toEqual({ pageProps: { b: 2 } });
        expect(sdc[URL_A]).toBeUndefined();
    });

    it("does nothing without a router", async () => {
        delete (Router as any).router;
        expect(await seedRouteData(URL_A)).toBe(null);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
