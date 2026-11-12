import { isWhitelisted } from "../../pages/api/_v2/ai/whitelist";

jest.mock("@utils/rpc/server", () => ({
    proc: ({ handler }) => handler,
    NoApi: jest.fn(),
}));

const originalFetch = global.fetch;
const originalToken = process.env.CYBER_CMS_API_TOKEN;
const fetchMock = jest.fn();
const invoke = (walletId = "0xabc") =>
    isWhitelisted.call({ req: {} as any, res: {} as any }, { walletId });
const denied = { success: false, message: "You are not whitelisted." };

beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
    delete process.env.CYBER_CMS_API_TOKEN;
});

afterEach(() => {
    global.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.CYBER_CMS_API_TOKEN;
    else process.env.CYBER_CMS_API_TOKEN = originalToken;
    jest.restoreAllMocks();
});

test.each([undefined, "", "   "])(
    "denies without calling the CMS when the token is %p",
    async (token) => {
        if (token !== undefined) process.env.CYBER_CMS_API_TOKEN = token;
        expect(await invoke()).toEqual(denied);
        expect(fetchMock).not.toHaveBeenCalled();
    }
);

test("uses only the configured token and matches wallets case-insensitively", async () => {
    process.env.CYBER_CMS_API_TOKEN = "fixture-cms-token";
    fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { attributes: { users: ["0xABC"] } } }),
    });
    expect(await invoke()).toEqual({ success: true, message: "You are whitelisted." });
    expect(fetchMock).toHaveBeenCalledWith(
        "https://cyber-cms-ef9hl.ondigitalocean.app/api/lists/1",
        { headers: { Authorization: "Bearer fixture-cms-token" } }
    );
});

test("denies wallets outside the configured list", async () => {
    process.env.CYBER_CMS_API_TOKEN = "fixture-cms-token";
    fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { attributes: { users: ["0xdef"] } } }),
    });
    expect(await invoke()).toEqual(denied);
});

test("denies an upstream HTTP failure even if its body contains a matching wallet", async () => {
    process.env.CYBER_CMS_API_TOKEN = "fixture-cms-token";
    const json = jest.fn(async () => ({ data: { attributes: { users: ["0xabc"] } } }));
    fetchMock.mockResolvedValue({ ok: false, json });
    expect(await invoke()).toEqual(denied);
    expect(json).not.toHaveBeenCalled();
});

test("denies network failures without logging credential-bearing errors", async () => {
    process.env.CYBER_CMS_API_TOKEN = "fixture-cms-token";
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    fetchMock.mockRejectedValue(new Error("Bearer fixture-cms-token"));
    expect(await invoke()).toEqual(denied);
    expect(log).not.toHaveBeenCalled();
});
