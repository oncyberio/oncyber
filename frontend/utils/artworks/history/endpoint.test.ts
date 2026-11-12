import handler from "../../../pages/api/artwork-history";
import axios from "axios";
jest.mock("axios", () => ({ get: jest.fn() }));
jest.mock("@env", () => ({ nodeEnv: { OPENSEA_X_API_KEY: "test" } }));
const get = axios.get as jest.Mock;
const query = {
    chain: "ethereum",
    contract: "0x" + "c".repeat(40),
    token: "0",
};
function response() {
    const r: any = { setHeader: jest.fn(), end: jest.fn() };
    r.status = jest.fn(() => r);
    r.json = jest.fn(() => r);
    return r;
}
beforeEach(() => get.mockReset());
test("rejects unsafe identities without upstream access", async () => {
    const r = response();
    await handler(
        {
            method: "GET",
            query: { ...query, contract: "http://localhost/" },
        } as any,
        r
    );
    expect(r.status).toHaveBeenCalledWith(400);
    expect(get).not.toHaveBeenCalled();
});
test("uses v2, caches an empty success, and supports token zero", async () => {
    get.mockResolvedValue({ data: { asset_events: [] } });
    const r = response();
    await handler({ method: "GET", query } as any, r);
    await handler({ method: "GET", query } as any, response());
    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0][0]).toContain(
        "/api/v2/events/chain/ethereum/contract/"
    );
    expect(get.mock.calls[0][1]).toMatchObject({
        timeout: 10000,
        maxContentLength: 4194304,
        maxRedirects: 0,
    });
    expect(r.json).toHaveBeenCalledWith({ events: [] });
});
test("does not turn a provider outage into an empty timeline", async () => {
    get.mockRejectedValue({ response: { status: 429 } });
    const r = response();
    await handler({ method: "GET", query: { ...query, token: "2" } } as any, r);
    expect(r.status).toHaveBeenCalledWith(503);
    expect(r.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
});
test("maps Polygon to OpenSea's matic chain", async () => {
    get.mockResolvedValue({ data: { asset_events: [] } });
    await handler(
        { method: "GET", query: { ...query, chain: "polygon" } } as any,
        response()
    );
    expect(get.mock.calls[0][0]).toContain("/chain/matic/");
});
