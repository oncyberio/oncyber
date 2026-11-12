import { fetchArtworkHistory } from "./client";
const asset = { contract_address: "0x" + "a".repeat(40), token_id: "0" };
const originalFetch = global.fetch;
afterEach(() => {
    global.fetch = originalFetch;
});
test("revives serialized dates for the history UI", async () => {
    global.fetch = jest
        .fn()
        .mockResolvedValue({
            ok: true,
            json: async () => ({
                events: [
                    {
                        type: "Mint",
                        date: "2024-01-01T00:00:00.000Z",
                        to: { address: asset.contract_address },
                    },
                ],
            }),
        });
    const result = await fetchArtworkHistory(asset, "ethereum");
    expect(result.success && result.value[0].date).toBeInstanceOf(Date);
});
test("aborted selection does not launch a request", async () => {
    global.fetch = jest.fn();
    const c = new AbortController();
    c.abort();
    expect(
        (await fetchArtworkHistory(asset, "ethereum", c.signal)).success
    ).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
});
