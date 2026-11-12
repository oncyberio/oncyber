/** @jest-environment node */
import { readFileSync } from "fs";
import { join } from "path";
import { isWhitelisted } from "./whitelist";

jest.mock("@utils/rpc/server", () => ({
    NoApi: jest.fn(),
    proc: (options) => Object.assign(options.handler, { _RPC_OPTS: options }),
}));

const NAME = "CYBER_CMS_API_TOKEN";
const dummy = "test-cms-token";
const refused = { success: false, message: "You are not whitelisted." };
const previous = process.env[NAME];
const realFetch = global.fetch;
let request: jest.Mock;

const list = (users) => ({
    ok: true,
    json: async () => ({ data: { attributes: { users } } }),
});
const check = (walletId = "0xAbC") =>
    isWhitelisted.call({} as any, { walletId });

beforeEach(() => {
    process.env[NAME] = dummy;
    request = jest.fn().mockResolvedValue(list(["0xabc"]));
    global.fetch = request as any;
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    jest.spyOn(console, "log").mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());
afterAll(() => {
    global.fetch = realFetch;
    if (previous === undefined) delete process.env[NAME];
    else process.env[NAME] = previous;
});

test.each([
    ["unset", undefined],
    ["empty", ""],
    ["blank", "   "],
])(
    "every request is refused and the CMS is not called when the token is %s",
    async (_name, value) => {
        if (value === undefined) delete process.env[NAME];
        else process.env[NAME] = value;
        await expect(check()).resolves.toEqual(refused);
        expect(request).not.toHaveBeenCalled();
    }
);

test("the token from the environment is what the CMS is called with", async () => {
    await expect(check()).resolves.toEqual({
        success: true,
        message: "You are whitelisted.",
    });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][1].headers.Authorization).toBe(
        `Bearer ${dummy}`
    );
});

test("the token is read on each request, so a rotated value takes effect", async () => {
    await check();
    process.env[NAME] = "rotated-test-token";
    await check();
    expect(request.mock.calls[1][1].headers.Authorization).toBe(
        "Bearer rotated-test-token"
    );
});

test("a wallet that is not listed, a CMS refusal and a CMS failure all refuse", async () => {
    await expect(check("0xother")).resolves.toEqual(refused);
    request.mockResolvedValueOnce({ json: async () => ({ error: {} }) });
    await expect(check()).resolves.toEqual(refused);
    request.mockRejectedValueOnce(new Error("network"));
    await expect(check()).resolves.toEqual(refused);
});

test("no token is written into the source", () => {
    const source = readFileSync(join(__dirname, "whitelist.ts"), "utf8");
    // Any long unbroken run of key-like characters inside a string literal.
    expect(source).not.toMatch(/["'`][A-Za-z0-9+/=_-]{24,}["'`]/);
    expect(source).toContain(`process.env.${NAME}`);
});
