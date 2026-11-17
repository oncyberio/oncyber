import { waitForArtworks } from "./waitForArtworks";

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it("resolves as soon as the artworks have loaded", async () => {
    let loading = true;
    const artworks = { hasArtworksLoading: () => loading };
    const done = waitForArtworks(() => artworks, null, 5000);

    jest.advanceTimersByTime(500);
    loading = false;
    jest.advanceTimersByTime(500);

    await expect(done).resolves.toBeUndefined();
    expect(jest.getTimerCount()).toBe(0);
});

it("rejects when artworks are still loading at the timeout", async () => {
    const artworks = { hasArtworksLoading: () => true };
    const done = waitForArtworks(() => artworks, null, 5000);

    jest.advanceTimersByTime(5000);

    await expect(done).rejects.toThrow("Please wait for artworks to load");
});

it("stops quietly when the space closes while waiting", async () => {
    let artworks = { hasArtworksLoading: jest.fn(() => true) };
    const done = waitForArtworks(() => artworks, null, 5000);

    jest.advanceTimersByTime(500);
    artworks = null;
    jest.advanceTimersByTime(500);

    await expect(done).rejects.toThrow("The space closed");
    expect(jest.getTimerCount()).toBe(0);
});

it("checks once with no timeout", async () => {
    const artworks = { hasArtworksLoading: () => false };
    const done = waitForArtworks(() => artworks, null);

    jest.advanceTimersByTime(0);

    await expect(done).resolves.toBeUndefined();
});
