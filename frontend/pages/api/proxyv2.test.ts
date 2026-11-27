/** @jest-environment node */
import handler from "./proxyv2";
import { publicFetch } from "@utils/net/publicFetch";

jest.mock("../../utils/middlewares/corsMiddleware", () => ({
    corsMiddleware: jest.fn(async () => undefined),
}));
jest.mock("@utils/net/publicFetch", () => ({ publicFetch: jest.fn() }));

function response() {
    const res: any = { statusCode: 200, headers: {} };
    res.setHeader = (k, v) => (res.headers[k] = v);
    res.status = (code) => ((res.statusCode = code), res);
    res.json = (body) => ((res.body = body), res);
    res.send = (body) => ((res.body = body), res);
    return res;
}

test("a dead upstream answers 502, cached briefly", async () => {
    (publicFetch as jest.Mock).mockRejectedValue(new Error("ENOTFOUND"));
    const res = response();
    await handler({ query: { url: "https://gone.example/a.png" } }, res);
    expect(res.statusCode).toBe(502);
    expect(res.headers["Cache-Control"]).toMatch(/s-maxage=600/);
});

test("a media answer passes through", async () => {
    (publicFetch as jest.Mock).mockResolvedValue({
        status: 200,
        headers: { "content-type": "image/png" },
        body: Buffer.from("x"),
    });
    const res = response();
    await handler({ query: { url: "https://ok.example/a.png" } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toBe("image/png");
});
