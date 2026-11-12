import handler from "../../../pages/api/opensea-profile";
import axios from "axios";
jest.mock("axios", () => ({ get: jest.fn() }));
jest.mock("@env", () => ({ nodeEnv: { OPENSEA_X_API_KEY: "test" } }));
const get = axios.get as jest.Mock;
const address = (digit: string) => "0x" + digit.repeat(40);
function response() {
    const r: any = { setHeader: jest.fn(), end: jest.fn() };
    r.status = jest.fn(() => r);
    r.json = jest.fn(() => r);
    return r;
}
const request = (id: string) =>
    ({ method: "GET", query: { address: id } } as any);
beforeEach(() => get.mockReset());
test("accepts only account addresses, never arbitrary upstream URLs", async () => {
    const r = response();
    await handler(request("https://localhost"), r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(get).not.toHaveBeenCalled();
});
test("deduplicates and caches the OpenSea avatar without exposing other account fields", async () => {
    get.mockResolvedValue({
        data: {
            profile_image_url: "https://i2c.seadn.io/avatar.png",
            username: "someone",
            bio: "not needed",
        },
    });
    const r = response();
    await Promise.all([
        handler(request(address("A")), r),
        handler(request(address("a")), response()),
    ]);
    await handler(request(address("a")), response());
    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0][0]).toBe(
        `https://api.opensea.io/api/v2/accounts/${address("a")}`
    );
    expect(get.mock.calls[0][1]).toMatchObject({
        timeout: 10000,
        maxRedirects: 0,
        maxContentLength: 262144,
    });
    expect(r.json).toHaveBeenCalledWith({
        profile_image_url: "https://i2c.seadn.io/avatar.png",
    });
});
test("missing accounts use the fallback, but outages remain retryable", async () => {
    get.mockRejectedValueOnce({ response: { status: 404 } });
    const missing = response();
    await handler(request(address("b")), missing);
    expect(missing.json).toHaveBeenCalledWith({ profile_image_url: null });
    get.mockRejectedValueOnce({ response: { status: 429 } });
    const outage = response();
    await handler(request(address("c")), outage);
    expect(outage.status).toHaveBeenCalledWith(503);
    expect(outage.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
    get.mockResolvedValueOnce({
        data: { profile_image_url: "https://i2c.seadn.io/recovered.png" },
    });
    const recovered = response();
    await handler(request(address("c")), recovered);
    expect(recovered.status).toHaveBeenCalledWith(200);
});
test("discards unsafe profile image URLs", async () => {
    get.mockResolvedValue({
        data: { profile_image_url: "javascript:alert(1)" },
    });
    const r = response();
    await handler(request(address("d")), r);
    expect(r.json).toHaveBeenCalledWith({ profile_image_url: null });
});
