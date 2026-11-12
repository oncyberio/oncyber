/** @jest-environment jsdom */
import React from "react";
import { createRoot, Root } from "react-dom/client";
import { act, Simulate } from "react-dom/test-utils";
import { DEFAULT_FILTERS, fetchLandingFeed, toLandingCards } from "../data";
import BottomSearch from "../components/BottomSearch";
import useDiscovery from "./useDiscovery";

const mockSearch = jest.fn();
const mockRouter = {
    isReady: true,
    pathname: "/",
    asPath: "/",
    query: {},
    replace: jest.fn().mockResolvedValue(true),
};
jest.mock("next/router", () => ({ useRouter: () => mockRouter }));
jest.mock("@utils/urlUtils", () => ({ resize: (url: string) => url }));
jest.mock("../data", () => ({
    ...jest.requireActual("../data"),
    fetchLandingFeed: jest.fn(),
    fetchSpaceSearch: (...args) => mockSearch(...args),
}));

const exhibits = [
    {
        id: "museum",
        headline: "6529 Museum",
        heroImg: "/museum.jpg",
        chains: ["ethereum"],
    },
    {
        id: "garden",
        headline: "Garden",
        curator: "Alice",
        heroImg: "/garden.jpg",
        chains: ["polygon"],
    },
];
const initialFeed = {
    cards: toLandingCards(exhibits),
    cursor: "garden",
    hasMore: true,
};
const props = {
    initialFeed,
    initialFilters: DEFAULT_FILTERS,
    initialError: false,
};
let state: ReturnType<typeof useDiscovery>;
let root: Root;
let container: HTMLDivElement;
function Harness() {
    state = useDiscovery(props);
    return (
        <BottomSearch
            value={state.filters.q}
            onChange={(q) => state.update({ q })}
            onSearch={(q) => state.update({ q })}
        />
    );
}
function type(q: string) {
    act(() =>
        Simulate.change(container.querySelector("input"), {
            target: { value: q },
        } as any)
    );
}
function ids() {
    return state.cards.map((card) => card.id);
}
async function advance(ms: number) {
    await act(async () => {
        jest.advanceTimersByTime(ms);
    });
}
function response(hits = [], page = 0, nbPages = 1) {
    return {
        cards: toLandingCards(hits),
        cursor: page + 1 < nbPages ? String(page + 1) : "",
        hasMore: page + 1 < nbPages,
        total: null,
        limited: false,
    };
}
function navigate(query: Record<string, string>) {
    mockRouter.query = query;
    mockRouter.asPath = "/?" + new URLSearchParams(query);
    act(() => root.render(<Harness />));
}
beforeEach(() => {
    jest.useFakeTimers();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    mockRouter.pathname = "/";
    mockRouter.asPath = "/";
    mockRouter.query = {};
    mockRouter.replace.mockClear();
    mockSearch.mockReset().mockResolvedValue(response());
    (fetchLandingFeed as jest.Mock).mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<Harness />));
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.useRealTimers();
});

it("filters on input before a request and restarts the debounce on each keystroke", async () => {
    type("65");
    expect(ids()).toEqual(["museum"]);
    expect(mockSearch).not.toHaveBeenCalled();
    await advance(299);
    type("6529");
    await advance(299);
    expect(mockSearch).not.toHaveBeenCalled();
    await advance(1);
    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({ q: "6529" }),
        "",
        expect.any(AbortSignal)
    );
    // Even an empty server result must not discard a loaded match.
    expect(ids()).toEqual(["museum"]);
});

it("retains spaces while typing and broadens or clears immediately", () => {
    type("6529 ");
    expect(container.querySelector("input").value).toBe("6529 ");
    type("6529 missing");
    expect(ids()).toEqual([]);
    type("6529");
    expect(ids()).toEqual(["museum"]);
    act(() =>
        Simulate.click(
            container.querySelector('[aria-label="Clear world search"]')
        )
    );
    expect(ids()).toEqual(["museum", "garden"]);
    expect(document.activeElement).toBe(container.querySelector("input"));
});

it("appends server matches without duplicates and retains local matches", async () => {
    mockSearch.mockResolvedValue(
        response([
            exhibits[0],
            {
                id: "remote",
                headline: "Remote gallery",
                heroImg: "/remote.jpg",
            },
        ])
    );
    type("6529");
    await advance(300);
    expect(ids()).toEqual(["museum", "remote"]);
    type("Alice");
    expect(ids()).toEqual(["garden"]);
    type("");
    expect(ids()).toEqual(["museum", "garden"]);
});

it("ignores an old response after the query changes or clears", async () => {
    let resolve: (value: any) => void;
    mockSearch.mockImplementationOnce(
        () =>
            new Promise((done) => {
                resolve = done;
            })
    );
    type("6529");
    await advance(300);
    type("Alice");
    await advance(300);
    await act(async () =>
        resolve(
            response([
                { id: "stale", headline: "Alice stale", heroImg: "/stale.jpg" },
            ])
        )
    );
    expect(ids()).toEqual(["garden"]);
    type("");
    expect(ids()).toEqual(["museum", "garden"]);
});

it("filters every loaded feed page and restores them all when cleared", async () => {
    (fetchLandingFeed as jest.Mock).mockResolvedValue({
        cards: toLandingCards([
            { id: "later", headline: "6529 Archive", heroImg: "/later.jpg" },
        ]),
        cursor: "later",
        hasMore: false,
    });
    await act(async () => state.loadMore());
    type("6529");
    expect(ids()).toEqual(["museum", "later"]);
    type("");
    expect(ids()).toEqual(["museum", "garden", "later"]);
    await advance(0);
    expect(state.hasMore).toBe(false);
    expect(fetchLandingFeed).toHaveBeenCalledTimes(1);
});

it("keeps local results usable after a failed search and retries on the next query", async () => {
    mockSearch.mockRejectedValueOnce(new Error("timeout"));
    type("6529");
    await advance(300);
    expect(ids()).toEqual(["museum"]);
    expect(state.loading).toBe(false);
    expect(state.error).toBe(false);
    expect(state.limitedSearch).toBe(true);
    type("Alice");
    expect(ids()).toEqual(["garden"]);
    await advance(300);
    expect(mockSearch).toHaveBeenCalledTimes(2);
    expect(state.limitedSearch).toBe(false);
});

it("finds every Cyber Spotlight edition outside the loaded popular feed", async () => {
    mockSearch.mockResolvedValue(
        response(
            [1, 2, 3].map((n) => ({
                id: `spotlight${n}`,
                info: {
                    headline: `Cyber Spotlight №${n}`,
                    customLink: `spotlight${n}`,
                    heroImg: `/spotlight${n}.jpg`,
                },
            }))
        )
    );
    type("cyber spotlight");
    expect(ids()).toEqual([]);
    await advance(300);
    expect(ids()).toEqual(["spotlight1", "spotlight2", "spotlight3"]);
    expect(state.cards.map((card) => card.href)).toEqual([
        "/spotlight1",
        "/spotlight2",
        "/spotlight3",
    ]);
});

it("uses the server cursor to append later title matches", async () => {
    mockSearch
        .mockResolvedValueOnce(
            response([{ id: "one", headline: "Series 1" }], 0, 2)
        )
        .mockResolvedValueOnce(
            response([{ id: "two", headline: "Series 2" }], 1, 2)
        );
    type("Series");
    await advance(300);
    await act(async () => state.loadMore());
    expect(mockSearch).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: "Series" }),
        "1",
        expect.any(AbortSignal)
    );
    expect(ids()).toEqual(["one", "two"]);
});

it("combines immediate text and non-text filters", () => {
    act(() => state.update({ chain: "polygon" }));
    type("Alice");
    expect(ids()).toEqual(["garden"]);
    type("6529");
    expect(ids()).toEqual([]);
    type("");
    expect(ids()).toEqual(["garden"]);
    expect(state.filters.chain).toBe("polygon");
});

it("ignores stale URL echoes and restores browser navigation once settled", () => {
    type("65");
    type("Alice");
    navigate({ q: "65" });
    expect(state.filters.q).toBe("Alice");
    expect(ids()).toEqual(["garden"]);
    navigate({ q: "Alice" });
    navigate({ q: "6529" });
    expect(container.querySelector("input").value).toBe("6529");
    expect(ids()).toEqual(["museum"]);
});

it("cancels the debounce when cleared before the request starts", async () => {
    type("6529");
    await advance(200);
    type("");
    await advance(300);
    expect(mockSearch).not.toHaveBeenCalled();
    expect(ids()).toEqual(["museum", "garden"]);
});

it("still restores navigation after re-submitting an unchanged query", async () => {
    type("6529");
    navigate({ q: "6529" });
    await act(async () => {
        Simulate.submit(container.querySelector("form"));
    });
    navigate({ q: "Alice" });
    expect(state.filters.q).toBe("Alice");
    expect(ids()).toEqual(["garden"]);
});

it("keeps known cover images when matching index hits omit them", async () => {
    mockSearch.mockResolvedValue(
        response([{ id: "museum", headline: "6529 Museum" }])
    );
    type("6529");
    expect(state.cards[0].imageUrls).toEqual(["/museum.jpg"]);
    await advance(300);
    expect(state.cards[0].imageUrls).toEqual(["/museum.jpg"]);
    type("");
    expect(state.cards.find((card) => card.id === "museum").imageUrls).toEqual([
        "/museum.jpg",
    ]);
});

it("blocks a repeated cursor instead of looping, then permits a manual retry", async () => {
    const feed = fetchLandingFeed as jest.Mock;
    feed.mockResolvedValueOnce({ cards: [], cursor: "garden", hasMore: true });
    await act(async () => state.loadMore());
    expect(state.loadMoreError).toBe(true);
    expect(ids()).toEqual(["museum", "garden"]);
    feed.mockResolvedValueOnce({
        cards: toLandingCards([{ id: "next", headline: "Next" }]),
        cursor: "next",
        hasMore: false,
    });
    await act(async () => state.loadMore());
    expect(state.loadMoreError).toBe(false);
    expect(ids()).toEqual(["museum", "garden", "next"]);
    expect(state.hasMore).toBe(false);
});

it("deduplicates overlapping pages and ignores simultaneous load-more requests", async () => {
    let resolve: (value: any) => void;
    const feed = fetchLandingFeed as jest.Mock;
    feed.mockImplementationOnce(
        () =>
            new Promise((done) => {
                resolve = done;
            })
    );
    let request: Promise<void>;
    act(() => {
        request = state.loadMore();
        void state.loadMore();
    });
    expect(feed).toHaveBeenCalledTimes(1);
    await act(async () => {
        resolve({
            cards: toLandingCards([
                exhibits[1],
                { id: "new", headline: "New" },
            ]),
            cursor: "new",
            hasMore: false,
        });
        await request;
    });
    expect(ids()).toEqual(["museum", "garden", "new"]);
});

it("discards a pending page when its feed changes", async () => {
    let resolve: (value: any) => void;
    const feed = fetchLandingFeed as jest.Mock;
    feed.mockImplementationOnce(
        () =>
            new Promise((done) => {
                resolve = done;
            })
    );
    let request: Promise<void>;
    act(() => {
        request = state.loadMore();
    });
    const signal = feed.mock.calls[0][2];
    feed.mockResolvedValueOnce({
        cards: toLandingCards([{ id: "latest", headline: "Latest" }]),
        cursor: "latest",
        hasMore: false,
    });
    act(() => state.update({ category: "latest" }));
    await advance(0);
    expect(signal.aborted).toBe(true);
    await act(async () => {
        resolve({
            cards: toLandingCards([{ id: "stale", headline: "Stale" }]),
            cursor: "stale",
            hasMore: true,
        });
        await request;
    });
    expect(ids()).toEqual(["latest"]);
    expect(state.hasMore).toBe(false);
});

it("surfaces a pagination failure even when local search matches remain", async () => {
    mockSearch.mockResolvedValueOnce(response([exhibits[0]], 0, 2));
    type("6529");
    await advance(300);
    mockSearch.mockRejectedValueOnce(new Error("offline"));
    await act(async () => state.loadMore());
    expect(ids()).toEqual(["museum"]);
    expect(state.loadMoreError).toBe(true);
    expect(state.loadingMore).toBe(false);
});

it("never fills an empty new filter with the previous feed's cursor", async () => {
    function AutoFill() {
        state = useDiscovery(props);
        React.useEffect(() => {
            if (
                !state.cards.length &&
                !state.loading &&
                !state.loadingMore &&
                state.hasMore
            )
                void state.loadMore();
        }, [state]);
        return null;
    }
    act(() => root.render(<AutoFill />));
    const feed = fetchLandingFeed as jest.Mock;
    feed.mockResolvedValue({
        cards: toLandingCards([{ id: "fresh", headline: "Fresh" }]),
        cursor: "fresh",
        hasMore: true,
    });
    act(() => state.update({ category: "latest" }));
    await advance(0);
    expect(feed).toHaveBeenCalledTimes(1);
    expect(feed).toHaveBeenCalledWith("latest", "", expect.any(AbortSignal));
    expect(ids()).toEqual(["fresh"]);
});

it.each([false, true])(
    "keeps the initial recovery loading state until the browser request finishes (failure: %s)",
    async (fails) => {
        const frames: boolean[] = [];
        let complete: (value: any) => void;
        let reject: (error: Error) => void;
        (fetchLandingFeed as jest.Mock).mockReturnValue(
            new Promise((resolve, fail) => {
                complete = resolve;
                reject = fail;
            })
        );
        function RecoveringFeed() {
            state = useDiscovery({
                ...props,
                initialFeed: { cards: [], cursor: "", hasMore: false },
                initialError: true,
            });
            frames.push(state.loading);
            return null;
        }
        act(() => root.render(<RecoveringFeed />));
        expect(frames[0]).toBe(true);
        await advance(300);
        expect(state.loading).toBe(true);
        await act(async () => {
            if (fails) reject(new Error("Unavailable"));
            else complete(initialFeed);
        });
        expect(state.loading).toBe(false);
        expect(state.error).toBe(fails);
        expect(ids()).toEqual(fails ? [] : ["museum", "garden"]);
    }
);

describe("isolated discovery panels", () => {
    let panelProps = props;
    function Panel() {
        state = useDiscovery(panelProps, {
            syncUrl: false,
            fetchOnMount: true,
        });
        return null;
    }
    function openPanel(overrides: Partial<typeof props> = {}) {
        panelProps = { ...props, ...overrides };
        act(() => root.render(<Panel />));
    }

    it("ignores page query changes and keeps update/reset out of router navigation", async () => {
        mockRouter.query = { q: "unrelated", category: "latest", lobby: "1" };
        mockRouter.asPath = "/?lobby=1&q=unrelated&category=latest";
        (fetchLandingFeed as jest.Mock).mockResolvedValue(initialFeed);
        openPanel();
        expect(state.filters).toEqual(DEFAULT_FILTERS);
        await advance(0);
        act(() => state.update({ q: "Alice", chain: "polygon" }));
        expect(ids()).toEqual(["garden"]);
        mockRouter.query = { q: "changed elsewhere", category: "staff" };
        mockRouter.asPath = "/?q=changed+elsewhere&category=staff";
        act(() => root.render(<Panel />));
        expect(state.filters).toEqual({
            ...DEFAULT_FILTERS,
            q: "Alice",
            chain: "polygon",
        });
        act(() => state.reset());
        expect(state.filters).toEqual(DEFAULT_FILTERS);
        expect(ids()).toEqual(["museum", "garden"]);
        expect(mockRouter.replace).not.toHaveBeenCalled();
        expect(mockRouter.query).toEqual({
            q: "changed elsewhere",
            category: "staff",
        });
    });

    it("fetches an empty initial feed without pretending it was an error", async () => {
        let complete: (value: any) => void;
        (fetchLandingFeed as jest.Mock).mockReturnValue(
            new Promise((resolve) => {
                complete = resolve;
            })
        );
        openPanel({ initialFeed: { cards: [], cursor: "", hasMore: false } });
        expect(state.loading).toBe(true);
        expect(state.error).toBe(false);
        expect(state.hasMore).toBe(false);
        await advance(0);
        expect(fetchLandingFeed).toHaveBeenCalledWith(
            "most-visited",
            "",
            expect.any(AbortSignal)
        );
        await act(async () => complete(initialFeed));
        expect(ids()).toEqual(["museum", "garden"]);
        expect(state.loading).toBe(false);
        expect(state.hasMore).toBe(true);
        expect(mockRouter.replace).not.toHaveBeenCalled();
    });

    it("refreshes visual seed cards and retries the network after initial failure", async () => {
        const feed = fetchLandingFeed as jest.Mock;
        feed.mockRejectedValueOnce(new Error("offline"));
        openPanel();
        expect(ids()).toEqual(["museum", "garden"]);
        expect(state.loading).toBe(true);
        await advance(0);
        expect(state.error).toBe(true);
        feed.mockResolvedValueOnce({
            cards: toLandingCards([{ id: "fresh", headline: "Fresh" }]),
            cursor: "fresh",
            hasMore: false,
        });
        act(() => state.retry());
        await advance(0);
        expect(feed).toHaveBeenCalledTimes(2);
        expect(ids()).toEqual(["fresh"]);
        expect(state.error).toBe(false);
    });

    it("uses current cursors and aborts pending pagination when panel filters change", async () => {
        const feed = fetchLandingFeed as jest.Mock;
        feed.mockResolvedValueOnce(initialFeed);
        openPanel({ initialFeed: { cards: [], cursor: "", hasMore: false } });
        await advance(0);
        let complete: (value: any) => void;
        feed.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    complete = resolve;
                })
        );
        let pending: Promise<void>;
        act(() => {
            pending = state.loadMore();
            void state.loadMore();
        });
        expect(feed).toHaveBeenCalledTimes(2);
        expect(feed).toHaveBeenLastCalledWith(
            "most-visited",
            "garden",
            expect.any(AbortSignal)
        );
        const signal = feed.mock.calls[1][2];
        feed.mockResolvedValueOnce({
            cards: toLandingCards([{ id: "newest", headline: "Newest" }]),
            cursor: "",
            hasMore: false,
        });
        act(() => state.update({ category: "latest" }));
        expect(signal.aborted).toBe(true);
        await advance(0);
        await act(async () => {
            complete({
                cards: toLandingCards([{ id: "stale", headline: "Stale" }]),
                cursor: "stale",
                hasMore: true,
            });
            await pending;
        });
        expect(ids()).toEqual(["newest"]);
        expect(state.hasMore).toBe(false);
        expect(state.loadingMore).toBe(false);
        expect(mockRouter.replace).not.toHaveBeenCalled();
    });

    it("debounces isolated search and aborts its request when the panel closes", async () => {
        (fetchLandingFeed as jest.Mock).mockResolvedValue(initialFeed);
        openPanel();
        await advance(0);
        let complete: (value: any) => void;
        mockSearch.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    complete = resolve;
                })
        );
        act(() => state.update({ q: "museum" }));
        await advance(299);
        expect(mockSearch).not.toHaveBeenCalled();
        await advance(1);
        const signal = mockSearch.mock.calls[0][2];
        act(() => root.render(<Harness />));
        expect(signal.aborted).toBe(true);
        await act(async () =>
            complete(response([{ id: "late", headline: "Late" }]))
        );
        expect(ids()).toEqual(["museum", "garden"]);
        expect(mockRouter.replace).not.toHaveBeenCalled();
    });
});
