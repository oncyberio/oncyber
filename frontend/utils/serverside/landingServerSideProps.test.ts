/** @jest-environment node */
import exhibitApi from "pages/api/exhibit";
import { corsMiddleware } from "../middlewares/corsMiddleware";
import { feedBasicServerSideProps } from "./feedBasicServerSideProps";
import {
    landingServerSideProps,
    readLandingFeed,
} from "./landingServerSideProps";

// Staff picks read Firestore; these tests are about the feed itself.
jest.mock("@utils/staffPicks", () => ({
    readStaffPickIds: jest.fn(async () => []),
}));
jest.mock(
    "pages/api/exhibit",
    () => ({ __esModule: true, default: jest.fn() }),
    {
        virtual: true,
    }
);
jest.mock("./feedBasicServerSideProps", () => ({
    feedBasicServerSideProps: jest.fn(),
}));

const mockApi = exhibitApi as unknown as jest.Mock;
const mockAuth = feedBasicServerSideProps as jest.Mock;

const exhibits = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
        id: `world-${i}`,
        owner: "0xabc",
        number_of_visits: 100 - i,
        info: {
            headline: `World ${i}`,
            customLink: i === 0 ? "rift" : "",
            room: "temple",
        },
        // Firestore values that only exist in-process.
        createdAt: { toJSON: () => "2026-11-01T00:00:00.000Z" },
        artworks: [],
    }));

const originalEnvironment = process.env.NODE_ENV;
beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ props: { authenticated: false } });
});
afterEach(() => {
    Object.assign(process.env, { NODE_ENV: originalEnvironment });
    jest.useRealTimers();
});

test("calls the feed handler in-process with the browser's query", async () => {
    const handler = jest.fn(async (req, res) => {
        // The real handler runs the CORS middleware first.
        await corsMiddleware(req, res);
        return res.status(200).json({ success: true, exhibits: exhibits(30) });
    });
    const feed = await readLandingFeed("most-visited", { handler });
    expect(handler.mock.calls[0][0]).toMatchObject({
        method: "GET",
        query: { type: "FETCH_ALL_EXHIBITS", isActive: "most-visited" },
    });
    expect(handler.mock.calls[0][0].query).not.toHaveProperty("lastVisible");
    expect(feed.cards).toHaveLength(30);
    expect(feed.cards[0]).toMatchObject({
        id: "world-0",
        href: "/rift",
        title: "World 0",
        visits: 100,
    });
    expect(feed.cursor).toBe("world-29");
    expect(feed.hasMore).toBe(true);
    // Plain JSON, like the HTTP body was.
    expect(JSON.parse(JSON.stringify(feed))).toEqual(feed);
});

test.each([
    [
        "an error status",
        (_req, res) =>
            res.status(400).json({ success: false, message: "Failed" }),
    ],
    [
        "a body without exhibits",
        (_req, res) => res.status(200).json({ success: true }),
    ],
    [
        "a handler that throws",
        async () => {
            throw new Error("firestore unavailable");
        },
    ],
    ["a handler that never answers", async () => undefined],
    ["a handler that ends without a body", (_req, res) => res.end()],
])("fails on %s", async (_name, handler) => {
    await expect(
        readLandingFeed("latest", { handler: handler as any })
    ).rejects.toThrow();
});

test("fails after the timeout, as the HTTP read did", async () => {
    jest.useFakeTimers();
    const read = readLandingFeed("staff", {
        handler: () => new Promise(() => {}),
    });
    jest.advanceTimersByTime(7000);
    await expect(read).rejects.toThrow("The world feed is unavailable.");
});

test("the page reads sign-in and feed together and keeps its props", async () => {
    Object.assign(process.env, { NODE_ENV: "production" });
    let resolveAuth: (value: unknown) => void;
    mockAuth.mockReturnValue(
        new Promise((resolve) => {
            resolveAuth = resolve;
        })
    );
    mockApi.mockImplementation(async (_req, res) =>
        res.status(200).json({ success: true, exhibits: exhibits(2) })
    );
    const res = { setHeader: jest.fn(), getHeader: jest.fn() };
    const page = landingServerSideProps({
        query: { category: "staff" },
        res,
    } as any);
    await new Promise((resolve) => setImmediate(resolve));
    // The feed was requested while sign-in is still pending.
    expect(mockApi).toHaveBeenCalledTimes(1);
    resolveAuth({ props: { authenticated: true, userId: "0xabc" } });
    const result: any = await page;
    expect(result.props).toMatchObject({
        authenticated: true,
        userId: "0xabc",
        initialError: false,
        initialFilters: { category: "staff" },
        // Staff picks continue with the most popular worlds.
        initialFeed: { cursor: "popular:", hasMore: true },
    });
    expect(result.props.initialFeed.cards).toHaveLength(2);
    expect(res.setHeader.mock.calls[0][1]).toMatch(
        /ssr_(auth|feed);dur=.*ssr_(auth|feed);dur=.*ssr_total;dur=/
    );
});

test("a failed feed and a failed sign-in still render the landing", async () => {
    mockAuth.mockRejectedValue(new Error("auth down"));
    mockApi.mockImplementation(async (_req, res) =>
        res.status(400).json({ success: false })
    );
    const result: any = await landingServerSideProps({
        query: {},
        res: { setHeader: jest.fn() },
    } as any);
    expect(result).toEqual({
        props: {
            authenticated: false,
            initialFeed: { cards: [], cursor: "", hasMore: false },
            initialFilters: {
                q: "",
                category: "most-visited",
                chain: "",
                owner: "",
                collection: "",
            },
            // No staff picks yet, so Popular leads.
            defaultCategory: "most-visited",
            initialError: true,
        },
    });
});
