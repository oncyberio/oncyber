/** @jest-environment node */
import { getExhibitAccessByCustomLink } from "@utils/firestore/exhibitAccess";
import { checkGatingRules } from "@utils/checkGatingRules";
import { db } from "@utils/firebaseAdmin";
import { getUserByDoc } from "@api/accounts/user/utils";
import { checkGating } from "./checkGating";

jest.mock("@utils/rpc/server", () => ({
    NoApi: jest.fn(),
    proc: (options) => Object.assign(options.handler, { _RPC_OPTS: options }),
}));
jest.mock("@utils/firestore/exhibitAccess", () => ({
    getExhibitAccessByCustomLink: jest.fn(),
}));
jest.mock("@utils/checkGatingRules", () => ({ checkGatingRules: jest.fn() }));
jest.mock("@utils/firebaseAdmin", () => ({ db: { collection: jest.fn() } }));
jest.mock("@api/accounts/user/utils", () => ({ getUserByDoc: jest.fn() }), {
    virtual: true,
});

const access = getExhibitAccessByCustomLink as jest.Mock;
const rules = checkGatingRules as jest.Mock;
const input = { spaceId: "6529AB", nbPlayers: 0 };
const call = (userId?: string, overrides = {}) =>
    checkGating.call({ userId } as any, { ...input, ...overrides });
let users: any;
const profile = { id: "owner", linkedAccounts: [] };
const userDoc = { id: "user-doc" };

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    access.mockResolvedValue({ editors: [], gating: { noAnonymous: true } });
    rules.mockResolvedValue({ type: "no-anonymous-error" });
    users = {
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({ empty: false, docs: [userDoc] }),
    };
    (db.collection as jest.Mock).mockReturnValue(users);
    (getUserByDoc as jest.Mock).mockResolvedValue(profile);
});
afterEach(() => jest.restoreAllMocks());

test("ungated requests retain public access but still read fresh access each time", async () => {
    access.mockResolvedValueOnce({ editors: [] });
    await expect(call()).resolves.toEqual({ type: "success" });
    expect(rules).not.toHaveBeenCalled();
    await expect(call()).resolves.toEqual({ type: "no-anonymous-error" });
    expect(access).toHaveBeenCalledTimes(2);
    expect(access).toHaveBeenNthCalledWith(1, "6529AB");
    expect(access).toHaveBeenNthCalledWith(2, "6529AB");
    expect(db.collection).not.toHaveBeenCalled();
    expect(rules).toHaveBeenCalledWith(
        { noAnonymous: true },
        null,
        0,
        expect.any(Function)
    );
    expect((checkGating as any)._RPC_OPTS.auth).toBe(false);
});

test("editor bypass remains case-insensitive and disappears after editor removal", async () => {
    access.mockResolvedValueOnce({
        editors: ["OWNER"],
        gating: { noAnonymous: true },
    });
    await expect(call("owner")).resolves.toEqual({ type: "success" });
    expect(db.collection).not.toHaveBeenCalled();
    expect(rules).not.toHaveBeenCalled();
    // Ownership alone has never bypassed this endpoint's editor-based check.
    access.mockResolvedValueOnce({
        owner: "owner",
        editors: [],
        gating: { noAnonymous: true },
    });
    rules.mockResolvedValueOnce({ type: "whitelist-error" });
    await expect(call("OWNER")).resolves.toEqual({ type: "whitelist-error" });
    expect(users.where).toHaveBeenCalledWith("walletId", "==", "owner");
    expect(getUserByDoc).toHaveBeenCalledWith(userDoc);
    expect(rules).toHaveBeenCalledWith(
        { noAnonymous: true },
        profile,
        0,
        expect.any(Function)
    );
});

test("capacity selection and password delegation retain existing behavior", async () => {
    const gating = {
        roomCapacity: 4,
        noAnonymous: true,
        password: { message: "", rev: "rev-1" },
    };
    access.mockResolvedValue({ id: "space-id", editors: [], gating });
    await call("owner", { nbPlayers: 3, password: "provided" });
    // The password is no longer compared by the rules: they get the check.
    expect(rules).toHaveBeenLastCalledWith(
        { noAnonymous: true, password: { message: "", rev: "rev-1" } },
        profile,
        3,
        expect.any(Function)
    );
    await call("owner", { cap: true, nbPlayers: 4 });
    expect(rules).toHaveBeenLastCalledWith(
        { roomCapacity: 4 },
        profile,
        4,
        expect.any(Function)
    );
});

test("authenticated gating still resolves live user data for every request", async () => {
    await call("owner");
    await call("owner");
    expect(users.get).toHaveBeenCalledTimes(2);
    expect(getUserByDoc).toHaveBeenCalledTimes(2);
    users.get.mockResolvedValueOnce({ empty: true, docs: [] });
    await expect(call("owner")).resolves.toEqual({
        type: "other-error",
        error: "user not found",
    });
    expect(rules).toHaveBeenCalledTimes(2);
});

test("deleted galleries and failed access reads deny entry", async () => {
    access.mockResolvedValueOnce(null);
    await expect(call()).resolves.toEqual({
        type: "other-error",
        error: "Failed to get exhibit data for 6529AB",
    });
    access.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(call()).resolves.toEqual({
        type: "other-error",
        error: "database unavailable",
    });
    expect(rules).not.toHaveBeenCalled();
});
