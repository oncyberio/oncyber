/** @jest-environment node */
import { measureSsrStage, withSsrTiming } from "./ssrTiming";

const originalEnvironment = process.env.NODE_ENV;
function response(previous = "") {
    return { getHeader: jest.fn(() => previous), setHeader: jest.fn() };
}
function value(res: ReturnType<typeof response>) {
    return res.setHeader.mock.calls[0]?.[1] as string;
}
beforeEach(() => {
    Object.assign(process.env, { NODE_ENV: "development" });
});
afterEach(() => {
    Object.assign(process.env, { NODE_ENV: originalEnvironment });
});

test("isolates overlapping requests and preserves existing timing headers", async () => {
    const a = response("edge;dur=2"),
        b = response();
    let continueA: () => void;
    const gate = new Promise<void>((resolve) => {
        continueA = resolve;
    });
    const first = withSsrTiming(a, () =>
        measureSsrStage("ssr_auth", async () => {
            await gate;
            return "signed in";
        })
    );
    await expect(
        withSsrTiming(b, () =>
            measureSsrStage("ssr_destination", () => "public")
        )
    ).resolves.toBe("public");
    continueA();
    await expect(first).resolves.toBe("signed in");
    expect(value(a)).toMatch(
        /^edge;dur=2, ssr_auth;dur=\d+\.\d, ssr_total;dur=\d+\.\d$/
    );
    expect(value(a)).not.toContain("destination");
    expect(value(b)).toContain("ssr_destination;dur=");
    expect(value(b)).not.toContain("ssr_auth");
});

test("reports failures without swallowing them or returning diagnostic data", async () => {
    const res = response();
    const failure = new Error("access denied");
    await expect(
        withSsrTiming(res, () =>
            measureSsrStage("ssr_page", () => {
                throw failure;
            })
        )
    ).rejects.toBe(failure);
    expect(value(res)).toContain("ssr_page;dur=");
    expect(value(res)).toContain("ssr_total;dur=");
    expect(value(res)).not.toContain("access denied");
});

test("does not change results when response is missing, sent, or header writes fail", async () => {
    await expect(withSsrTiming(undefined, () => 42)).resolves.toBe(42);
    const sent = { ...response(), headersSent: true };
    await expect(withSsrTiming(sent, () => 43)).resolves.toBe(43);
    expect(sent.setHeader).not.toHaveBeenCalled();
    const broken = {
        setHeader: () => {
            throw new Error("sent");
        },
    };
    await expect(withSsrTiming(broken, () => 44)).resolves.toBe(44);
});

test("caps diagnostic header entries", async () => {
    const res = response();
    await withSsrTiming(res, () =>
        Promise.all(
            Array.from({ length: 40 }, () =>
                measureSsrStage("ssr_exhibit", () => null)
            )
        )
    );
    expect(value(res).split(", ")).toHaveLength(24);
});

test("production sends the header; the switch and other environments do not", async () => {
    Object.assign(process.env, { NODE_ENV: "production" });
    const production = response();
    await expect(
        withSsrTiming(production, () => measureSsrStage("ssr_auth", () => 1))
    ).resolves.toBe(1);
    expect(value(production)).toMatch(
        /^ssr_auth;dur=\d+\.\d, ssr_total;dur=\d+\.\d$/
    );

    process.env.SSR_SERVER_TIMING = "off";
    try {
        const off = response();
        await expect(withSsrTiming(off, () => 2)).resolves.toBe(2);
        expect(off.setHeader).not.toHaveBeenCalled();
    } finally {
        delete process.env.SSR_SERVER_TIMING;
    }

    Object.assign(process.env, { NODE_ENV: "test" });
    const test = response();
    await expect(withSsrTiming(test, () => 3)).resolves.toBe(3);
    expect(test.setHeader).not.toHaveBeenCalled();
});

test("a nested wrapper leaves the header to the outer one", async () => {
    const outer = response(),
        inner = response();
    await withSsrTiming(outer, () =>
        withSsrTiming(inner, () => measureSsrStage("ssr_feed", () => 1))
    );
    expect(inner.setHeader).not.toHaveBeenCalled();
    expect(value(outer)).toMatch(
        /^ssr_feed;dur=\d+\.\d, ssr_total;dur=\d+\.\d$/
    );
});
