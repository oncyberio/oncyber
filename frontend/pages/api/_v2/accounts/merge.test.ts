/** @jest-environment node */
import { forceMergeAccount, linkAccounts } from "./authenticate/utils/link";
import { validateSig } from "./authenticate/utils/utils";
import { authenticate } from "./authenticate";
import { merge } from "./merge";

jest.mock("@utils/rpc/server", () => ({
    NoApi: jest.fn(),
    proc: (options) => Object.assign(options.handler, { _RPC_OPTS: options }),
}));
jest.mock("@utils/firebaseAdmin", () => ({
    auth: jest.fn(),
    db: {},
    fire: {},
}));
jest.mock("@utils/cookieSettings", () => ({ cookieSettings: {} }));
jest.mock("./authenticate/utils/link", () => ({
    forceMergeAccount: jest.fn(),
    linkAccounts: jest.fn(),
    unlinkAccount: jest.fn(),
}));
jest.mock("./authenticate/utils/utils", () => ({ validateSig: jest.fn() }));
jest.mock("./authenticate/utils/createAccount", () => jest.fn());
jest.mock("./user/utils", () => ({
    fetchUserByAccountId: jest.fn(),
    fetchUserByWalletId: jest.fn(),
}));

const mergeAccounts = forceMergeAccount as jest.Mock;
const link = linkAccounts as jest.Mock;
const signature = validateSig as jest.Mock;

// What the sign-in sheet sends: the account being merged in (`owner`, proved
// by `sig`) and the account it is merged into (`linkAccount`).
const payload = {
    sig: { type: "ethereum", sig: "0xsignature" },
    owner: "0xSecond",
    type: "web3" as const,
    linkAccount: "0xfirst",
    providerId: "ethereum",
    userMetadata: {},
    source: "current" as const,
};
const context = (userId?: string) =>
    ({ userId, token: "session-token", req: { cookies: {} } } as any);

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => undefined);
    signature.mockResolvedValue(true);
    mergeAccounts.mockResolvedValue({ success: true });
    link.mockResolvedValue({ success: true, account: { id: "0xfirst" } });
});
afterEach(() => jest.restoreAllMocks());

test("merge requires a session", () => {
    expect((merge as any)._RPC_OPTS.auth).toBe(true);
});

test.each([
    ["another account", "0xmallory"],
    ["the account being merged in", "0xSecond"],
    ["nobody", undefined],
])(
    "merge is refused when the caller is signed in as %s",
    async (_name, userId) => {
        await expect(merge.call(context(userId), payload)).resolves.toEqual({
            success: false,
            message: "Sign in to the account you are merging into.",
        });
        expect(signature).not.toHaveBeenCalled();
        expect(mergeAccounts).not.toHaveBeenCalled();
    }
);

test("merge is refused when no account to merge into is named", async () => {
    const { linkAccount, ...rest } = payload;
    const result = await merge.call(context("0xfirst"), rest as any);
    expect(result.success).toBe(false);
    expect(mergeAccounts).not.toHaveBeenCalled();
});

test("the owner of both accounts can still merge them", async () => {
    // The session keeps the account id's original casing.
    await expect(merge.call(context("0xFirst"), payload)).resolves.toEqual({
        success: true,
    });
    expect(signature).toHaveBeenCalledWith(
        expect.objectContaining({ sig: payload.sig, owner: "0xSecond" })
    );
    expect(mergeAccounts).toHaveBeenCalledWith(
        expect.objectContaining({
            sourceAccountId: "0xSecond",
            destinationAccountId: "0xfirst",
            signedInAccountId: "0xFirst",
            source: "current",
        })
    );
});

test("merge still needs a valid signature for the account merged in", async () => {
    signature.mockResolvedValue(false);
    await expect(merge.call(context("0xfirst"), payload)).resolves.toEqual({
        success: false,
        message: "Failed to merge accounts.",
    });
    expect(mergeAccounts).not.toHaveBeenCalled();
});

test("linking asks for the same proof and is otherwise unchanged", async () => {
    const refused = await authenticate.call(context("0xmallory"), payload);
    expect(refused).toEqual({
        success: false,
        message: "Sign in to the account you are linking to.",
    });
    expect(link).not.toHaveBeenCalled();

    const linked = await authenticate.call(context("0xFirst"), payload);
    expect(linked).toEqual({ success: true, user: { id: "0xfirst" } });
    expect(link).toHaveBeenCalledWith(
        expect.objectContaining({
            accountToLink: "0xSecond",
            accountId: "0xfirst",
        })
    );
});
