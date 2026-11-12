import jwt from "jsonwebtoken";
import { auth } from "./authMiddleware";
import { serialize } from "cookie";
import { cookieSettings } from "../cookieSettings";
const secret = "local-auth-regression-key";
const old = process.env.SECRET_JWT_KEY;
beforeAll(() => {
    process.env.SECRET_JWT_KEY = secret;
});
afterAll(() => {
    if (old === undefined) delete process.env.SECRET_JWT_KEY;
    else process.env.SECRET_JWT_KEY = old;
});
test.each(["header", "body", "cookie"])(
    "auth accepts the existing account token through %s",
    async (source) => {
        const token = jwt.sign({ user: "test-account" }, secret);
        const request = {
            headers: {},
            body: {},
            cookies: {},
            query: {},
        } as any;
        if (source === "header")
            request.headers.authorization = `Bearer ${token}`;
        if (source === "body") request.body.token = token;
        if (source === "cookie")
            request.cookies = {
                _CCA: "account-cookie",
                "account-cookie": token,
            };
        await expect(auth(request)).resolves.toBe("test-account");
    }
);
test("invalid CLI credential fails even if a different browser account is signed in", async () => {
    const token = jwt.sign({ user: "browser-account" }, secret);
    await expect(
        auth({
            headers: { authorization: "Bearer invalid" },
            cookies: { _CCA: "current", current: token },
            query: {},
        })
    ).rejects.toBeTruthy();
});

test("same-origin browser cookies retain normal authentication and account switching", async () => {
    const current = jwt.sign({ user: "current-account" }, secret);
    const alternate = jwt.sign({ user: "alternate-account" }, secret);
    const request = {
        headers: { origin: "https://oncyber.io" },
        cookies: { _CCA: "current", current, alternate },
        query: {},
    } as any;
    await expect(auth(request)).resolves.toBe("current-account");
    request.query = { userId: "alternate", validate: "true" };
    await expect(auth(request)).resolves.toBe("alternate-account");
});

test.each([false, true])(
    "opaque-origin requests cannot authenticate using ambient cookies (account switch: %s)",
    async (switchAccount) => {
        const token = jwt.sign({ user: "browser-account" }, secret);
        await expect(
            auth({
                headers: { origin: "null" },
                cookies: { _CCA: "current", current: token },
                query: switchAccount
                    ? { userId: "current", validate: "true" }
                    : {},
            })
        ).rejects.toBeTruthy();
    }
);

test.each([false, true])(
    "opaque-origin requests keep explicit bearer authority without borrowing cookies (account switch: %s)",
    async (switchAccount) => {
        const bearer = jwt.sign({ user: "explicit-account" }, secret);
        const cookie = jwt.sign({ user: "browser-account" }, secret);
        await expect(
            auth({
                headers: { origin: "null", authorization: `Bearer ${bearer}` },
                cookies: { _CCA: "current", current: cookie },
                query: switchAccount
                    ? { userId: "current", validate: "true" }
                    : {},
            })
        ).resolves.toBe("explicit-account");
    }
);

test("authentication cookies explicitly serialize SameSite=Lax, Secure and HttpOnly", () => {
    const header = serialize("test-account", "test-token", cookieSettings);
    expect(header).toContain("SameSite=Lax");
    expect(header).toContain("Secure");
    expect(header).toContain("HttpOnly");
});

test.each([
    ["same-site", "no-cors", "image"],
    ["cross-site", "no-cors", "image"],
    ["same-site", "navigate", "iframe"],
    ["cross-site", "navigate", "iframe"],
    ["same-site", "cors", "empty"],
    ["cross-site", "cors", "empty"],
])(
    "%s %s/%s GETs without Origin cannot borrow cookies",
    async (site, mode, dest) => {
        const token = jwt.sign({ user: "browser-account" }, secret);
        for (const query of [{}, { userId: "current", validate: "true" }]) {
            await expect(
                auth({
                    method: "GET",
                    headers: {
                        "sec-fetch-site": site,
                        "sec-fetch-mode": mode,
                        "sec-fetch-dest": dest,
                    },
                    cookies: { _CCA: "current", current: token },
                    query,
                })
            ).rejects.toBeTruthy();
        }
    }
);

test.each(["header", "body", "query"])(
    "cross-origin subresources retain their explicit %s credential",
    async (source) => {
        const token = jwt.sign({ user: "explicit-account" }, secret);
        const browserToken = jwt.sign({ user: "browser-account" }, secret);
        const request = {
            method: "POST",
            headers: {
                "sec-fetch-site": "same-site",
                "sec-fetch-mode": "cors",
                "sec-fetch-dest": "empty",
            },
            body: {},
            query: { userId: "current", validate: "true" },
            cookies: { _CCA: "current", current: browserToken },
        } as any;
        if (source === "header")
            request.headers.authorization = `Bearer ${token}`;
        if (source === "body") request.body.token = token;
        if (source === "query") request.query.token = token;
        await expect(auth(request)).resolves.toBe("explicit-account");
    }
);

test.each(["same-origin", "none", undefined])(
    "%s cookie requests keep existing account behavior",
    async (site) => {
        const token = jwt.sign({ user: "browser-account" }, secret);
        await expect(
            auth({
                method: "POST",
                headers: site ? { "sec-fetch-site": site } : {},
                cookies: { _CCA: "current", current: token },
                query: {},
            })
        ).resolves.toBe("browser-account");
    }
);

test("top-level inbound GET links preserve login, but cross-site POST navigation does not", async () => {
    const token = jwt.sign({ user: "browser-account" }, secret);
    const request = {
        method: "GET",
        url: "/vvd",
        headers: {
            "sec-fetch-site": "cross-site",
            "sec-fetch-mode": "navigate",
            "sec-fetch-dest": "document",
        },
        cookies: { _CCA: "current", current: token },
        query: {},
    };
    await expect(auth(request)).resolves.toBe("browser-account");
    await expect(auth({ ...request, method: "POST" })).rejects.toBeTruthy();
    await expect(
        auth({ ...request, headers: { ...request.headers, origin: "null" } })
    ).rejects.toBeTruthy();
});

test.each([
    "/api/exhibit?type=CREATE_EXHIBIT",
    "/api",
    "/API/exhibit",
    "/%61pi/exhibit",
    "/vvd/../api/exhibit",
    "/vvd/%2e%2e/api/exhibit",
    "/%2fapi/exhibit",
    "/%2561pi/exhibit",
    "/%invalid",
    "//attacker.example/vvd",
    "https://oncyber.io/vvd",
    undefined,
])(
    "cross-origin top-level navigation cannot borrow cookies for API or invalid path %s",
    async (url) => {
        const token = jwt.sign({ user: "browser-account" }, secret);
        await expect(
            auth({
                method: "GET",
                url,
                headers: {
                    "sec-fetch-site": "cross-site",
                    "sec-fetch-mode": "navigate",
                    "sec-fetch-dest": "document",
                },
                cookies: { _CCA: "current", current: token },
                query: {},
            })
        ).rejects.toBeTruthy();
    }
);
