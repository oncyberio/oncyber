/** @jest-environment node */
import { getUsers } from "./getUsers";
import { fetchUserByUsername } from "./utils";

jest.mock("@utils/rpc/server", () => ({
    NoApi: jest.fn(),
    proc: (options) => Object.assign(options.handler, { _RPC_OPTS: options }),
}));
jest.mock("@utils/firebaseAdmin", () => ({ db: {} }));
jest.mock("./utils", () => ({
    fetchUserByUsername: jest.fn(),
    fetchUserByWalletId: jest.fn(),
    getProfiles: jest.fn(),
    getSpaceEditors: jest.fn(),
}));

const fetch = fetchUserByUsername as jest.Mock;
const lookUp = (userId?: string) =>
    getUsers.call({ userId } as any, {
        type: "username",
        username: "@alice",
        all: true,
    });

beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockImplementation(async (_name, full) =>
        full
            ? { id: "0xAlice", walletId: "0xalice", email: "a@x.io" }
            : { id: "0xAlice", walletId: "0xalice" }
    );
});

test.each([
    ["nobody", undefined],
    ["another account", "0xmallory"],
])("%s asking for the whole document gets the public one", async (_n, id) => {
    const result: any = await lookUp(id);
    expect(result.success).toBe(true);
    expect(result.email).toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("alice");
});

test("the account's own session gets the whole document", async () => {
    const result: any = await lookUp("0xALICE");
    expect(result.email).toBe("a@x.io");
    expect(fetch).toHaveBeenLastCalledWith("alice", true);
});
