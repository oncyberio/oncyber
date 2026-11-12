import { ARENA_HTTP_URL } from "@utils/arena/constants";

describe("regional TURN credential cache", () => {
    let getTurnIceServers: typeof import("./turnCredentials").getTurnIceServers;
    beforeEach(() => {
        jest.resetModules();
        getTurnIceServers = require("./turnCredentials").getTurnIceServers;
        global.fetch = jest.fn(async (url: string) => ({
            ok: true,
            json: async () => ({
                username: `${Math.floor(Date.now() / 1000) + 3600}`,
                credential: url,
                urls: ["turn:relay.example:3478"],
            }),
        })) as any;
    });
    afterEach(() => {
        jest.restoreAllMocks();
        jest.useRealTimers();
    });
    test("keeps credentials isolated by region and reuses only that region's unexpired cache", async () => {
        const eu = await getTurnIceServers(2500, "https://eu.example/");
        const us = await getTurnIceServers(2500, "https://us.example");
        expect(eu[0].credential).toBe("https://eu.example/turnCredentials");
        expect(us[0].credential).toBe("https://us.example/turnCredentials");
        expect(await getTurnIceServers(2500, "https://eu.example")).toBe(eu);
        expect(fetch).toHaveBeenCalledTimes(2);
    });
    test("default callers retain Arena and a 404 or network failure returns STUN-only fallback", async () => {
        (fetch as jest.Mock).mockResolvedValueOnce({ ok: false });
        expect(await getTurnIceServers()).toEqual([]);
        expect(fetch).toHaveBeenCalledWith(
            `${ARENA_HTTP_URL}/turnCredentials`,
            expect.anything()
        );
        (fetch as jest.Mock).mockRejectedValueOnce(new Error("offline"));
        expect(await getTurnIceServers(2500, "https://eu.example")).toEqual([]);
    });
    test("evicts the least recently used region after eight entries and refreshes expiring credentials", async () => {
        for (let i = 0; i < 8; i++)
            await getTurnIceServers(2500, `https://r${i}.example`);
        await getTurnIceServers(2500, "https://r0.example");
        await getTurnIceServers(2500, "https://r8.example");
        await getTurnIceServers(2500, "https://r0.example");
        expect(fetch).toHaveBeenCalledTimes(9);
        await getTurnIceServers(2500, "https://r1.example");
        expect(fetch).toHaveBeenCalledTimes(10);
        jest.spyOn(Date, "now").mockReturnValue(Date.now() + 3600_000);
        await getTurnIceServers(2500, "https://r0.example");
        expect(fetch).toHaveBeenCalledTimes(11);
    });
    test("timeout aborts the regional fetch and returns no relay credentials", async () => {
        jest.useFakeTimers();
        let signal: AbortSignal;
        (fetch as jest.Mock).mockImplementation(
            (_url, options) =>
                new Promise((_resolve, reject) => {
                    signal = options.signal;
                    signal.addEventListener("abort", () =>
                        reject(new Error("aborted"))
                    );
                })
        );
        const request = getTurnIceServers(50, "https://eu.example");
        jest.advanceTimersByTime(50);
        expect(await request).toEqual([]);
        expect(signal.aborted).toBe(true);
    });
});
