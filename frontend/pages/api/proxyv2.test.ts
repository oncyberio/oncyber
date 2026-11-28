/** @jest-environment node */
import handler, { recentFailures } from "./proxyv2";
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

beforeEach(() => {
    recentFailures.clear();
    (publicFetch as jest.Mock).mockReset();
});

test("a dead upstream answers 502 and isn't asked again for a while", async () => {
    (publicFetch as jest.Mock).mockRejectedValue(new Error("ENOTFOUND"));
    const req = { query: { url: "https://gone.example/a.png" } };
    const first = response();
    await handler(req, first);
    expect(first.statusCode).toBe(502);
    expect(first.headers["Cache-Control"]).toMatch(/max-age=300/);

    const second = response();
    await handler(req, second);
    expect(second.statusCode).toBe(502);
    expect(publicFetch).toHaveBeenCalledTimes(1);
});

test("an upstream error status is remembered the same way", async () => {
    (publicFetch as jest.Mock).mockResolvedValue({ status: 404, headers: {} });
    const req = { query: { url: "https://gone.example/b.png" } };
    await handler(req, response());
    await handler(req, response());
    expect(publicFetch).toHaveBeenCalledTimes(1);
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

test.each([
    ["no url", {}],
    ["an empty url", { url: "" }],
    [
        "two urls",
        { url: ["https://a.example/1.png", "https://b.example/2.png"] },
    ],
])("%s is a bad request", async (_n, query) => {
    const res = response();
    await handler({ query }, res);
    expect(res.statusCode).toBe(400);
    expect(publicFetch).not.toHaveBeenCalled();
    expect(recentFailures.size).toBe(0);
});
