import { loadArtworkDocument } from "./document";
const originalFetch = global.fetch;
afterEach(() => {
    global.fetch = originalFetch;
});
test("HTML artworks use their cached document and keep its base URL", async () => {
    global.fetch = jest
        .fn()
        .mockResolvedValue({ ok: true, text: async () => "<html>art</html>" });
    const result = await loadArtworkDocument({
        dcompressed_animation_url: "https://cache.test/art.html",
        animation_url: "https://gone.test/art.html",
    });
    expect(result).toEqual({
        url: "https://cache.test/art.html",
        text: "<html>art</html>",
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
});
test("an HTTP error page is not treated as artwork HTML", async () => {
    global.fetch = jest
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce({
            ok: true,
            text: async () => "<html>recovered</html>",
        });
    expect(
        (
            await loadArtworkDocument({
                dcompressed_animation_url: "bad",
                animation_url: "good",
            })
        ).url
    ).toBe("good");
});
