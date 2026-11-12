/** @jest-environment node */
import { readFileSync } from "fs";
import { join } from "path";
import { isWhitelisted, whitelistedWallets } from "./whitelist";

jest.mock("@utils/rpc/server", () => ({
    NoApi: jest.fn(),
    proc: (options) => Object.assign(options.handler, { _RPC_OPTS: options }),
}));

const NAME = "AI_WHITELIST";
const previous = process.env[NAME];
const allowed = { success: true, message: "You are whitelisted." };
const refused = { success: false, message: "You are not whitelisted." };
const check = (walletId = "0xAbC") =>
    isWhitelisted.call({} as any, { walletId });

afterAll(() => {
    if (previous === undefined) delete process.env[NAME];
    else process.env[NAME] = previous;
});

test.each([
    ["unset", undefined],
    ["empty", ""],
    ["blank", "  , "],
])("nobody is whitelisted when the list is %s", async (_name, value) => {
    if (value === undefined) delete process.env[NAME];
    else process.env[NAME] = value;
    await expect(check()).resolves.toEqual(refused);
});

test("listed wallets match case-insensitively; others are refused", async () => {
    process.env[NAME] = "0xdef, 0xABC\n0x123";
    await expect(check("0xabc")).resolves.toEqual(allowed);
    await expect(check("0xAbC")).resolves.toEqual(allowed);
    await expect(check("0xother")).resolves.toEqual(refused);
});

test("the list is read on each request", async () => {
    process.env[NAME] = "0xabc";
    await expect(check()).resolves.toEqual(allowed);
    process.env[NAME] = "0xdef";
    await expect(check()).resolves.toEqual(refused);
});

test("parses comma and whitespace separated lists", () => {
    expect([...whitelistedWallets(" 0xA,0xb  0xC ")]).toEqual([
        "0xa",
        "0xb",
        "0xc",
    ]);
});

test("no outside service is called", () => {
    const source = readFileSync(join(__dirname, "whitelist.ts"), "utf8");
    expect(source).not.toMatch(/fetch\(|https?:\/\//);
});
