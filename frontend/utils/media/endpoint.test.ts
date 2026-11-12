import axios from "axios";
import handler from "../../pages/api/artwork-media";
jest.mock("axios", () => ({ get: jest.fn() }));
jest.mock("@env", () => ({ nodeEnv: { OPENSEA_X_API_KEY: "test" } }));
const get = axios.get as jest.Mock;
const query = {
    chain: "ethereum",
    contract: "0x" + "b".repeat(40),
    token: "1",
};
function response() {
    const res: any = { setHeader: jest.fn(), end: jest.fn() };
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    return res;
}
beforeEach(() => get.mockReset());
test("rejects arbitrary upstream URLs before making any request", async () => {
    const res = response();
    await handler(
        {
            method: "GET",
            query: { ...query, contract: "http://localhost/" },
        } as any,
        res
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(get).not.toHaveBeenCalled();
});
test("recovers and caches only media fields through a bounded upstream request", async () => {
    get.mockResolvedValue({
        data: {
            nft: {
                display_image_url: "https://i2c.seadn.io/art.png",
                owners: ["private"],
            },
        },
    });
    const first = response();
    await handler({ method: "GET", query } as any, first);
    expect(first.status).toHaveBeenCalledWith(200);
    expect(first.json).toHaveBeenCalledWith({
        image: "https://i2c.seadn.io/art.png",
        animation: undefined,
    });
    const next = response();
    await handler({ method: "GET", query } as any, next);
    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0][1]).toMatchObject({
        timeout: 10000,
        maxContentLength: 2097152,
        maxRedirects: 0,
    });
});
test("provider outages remain retryable, never definitive missing artwork", async () => {
    get.mockRejectedValue({ response: { status: 429 } });
    const res = response();
    await handler(
        { method: "GET", query: { ...query, token: "2" } } as any,
        res
    );
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
});

test("maps Polygon to OpenSea's matic chain for media recovery", async () => {
    get.mockResolvedValue({
        data: { nft: { image_url: "https://i2c.seadn.io/polygon.png" } },
    });
    const res = response();
    await handler(
        { method: "GET", query: { ...query, chain: "polygon" } } as any,
        res
    );
    expect(get.mock.calls[0][0]).toContain("/chain/matic/");
    expect(res.status).toHaveBeenCalledWith(200);
});
