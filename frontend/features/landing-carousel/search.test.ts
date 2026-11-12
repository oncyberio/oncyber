import { DEFAULT_FILTERS, fetchSpaceSearch } from "./data";
jest.mock("@utils/urlUtils", () => ({ resize: (value) => value }));
const originalFetch = global.fetch;
beforeEach(() => {
    jest.useFakeTimers();
    global.fetch = jest.fn();
});
afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
});
const result = () => ({
    ok: true,
    json: async () => ({
        success: true,
        exhibits: [
            {
                id: "spotlight1",
                info: {
                    headline: "Cyber Spotlight №1",
                    customLink: "spotlight1",
                },
            },
        ],
        cursor: "next",
        hasMore: true,
    }),
});
test("uses only the Firestore search endpoint and preserves pagination", async () => {
    (fetch as jest.Mock).mockResolvedValue(result());
    const response = await fetchSpaceSearch(
        { ...DEFAULT_FILTERS, q: "cyber spotlight" },
        "previous"
    );
    const [url] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("/api/search/spaces?");
    expect(url).toContain("q=cyber+spotlight");
    expect(url).toContain("cursor=previous");
    expect(response).toMatchObject({
        hasMore: true,
        cursor: "next",
        cards: [{ href: "/spotlight1" }],
    });
    expect(jest.getTimerCount()).toBe(0);
});
function pendingRequest() {
    (fetch as jest.Mock).mockImplementationOnce(
        (_url, { signal }) =>
            new Promise((_resolve, reject) => {
                signal.addEventListener(
                    "abort",
                    () => reject(new Error("aborted")),
                    { once: true }
                );
            })
    );
}
test("aborts old search requests when the input changes", async () => {
    pendingRequest();
    const controller = new AbortController();
    const request = fetchSpaceSearch(
        { ...DEFAULT_FILTERS, q: "cyber" },
        "",
        controller.signal
    );
    const rejected = expect(request).rejects.toThrow("aborted");
    controller.abort();
    await rejected;
    expect(jest.getTimerCount()).toBe(0);
});
test("bounds stalled requests and permits the next search to succeed", async () => {
    pendingRequest();
    const request = fetchSpaceSearch({ ...DEFAULT_FILTERS, q: "cyber" });
    const rejected = expect(request).rejects.toThrow("aborted");
    jest.advanceTimersByTime(8000);
    await rejected;
    (fetch as jest.Mock).mockResolvedValueOnce(result());
    await expect(
        fetchSpaceSearch({ ...DEFAULT_FILTERS, q: "cyber spotlight" })
    ).resolves.toMatchObject({ hasMore: true });
    expect(jest.getTimerCount()).toBe(0);
});
test("reports service failure instead of claiming the database has no matches", async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: false });
    await expect(
        fetchSpaceSearch({ ...DEFAULT_FILTERS, q: "cyber" })
    ).rejects.toThrow("temporarily unavailable");
});
