import AccountsAPI from "@api/accounts/_api";

jest.mock(
    "@api/accounts/_api",
    () => ({
        __esModule: true,
        default: { getUsers: jest.fn() },
    }),
    { virtual: true }
);
jest.mock("@api/destinations/_api", () => ({ __esModule: true, default: {} }), {
    virtual: true,
});
jest.mock("@api/asset/_api", () => ({ __esModule: true, default: {} }), {
    virtual: true,
});
jest.mock(
    "@3factory/space/roomdatacompat",
    () => ({ getDefaultEmptyRoomData: jest.fn() }),
    { virtual: true }
);
jest.mock("./analytics", () => ({
    amplitude_logUserExhibits: jest.fn(),
    amplitude_logAnalyticsEvent: jest.fn(),
}));
jest.mock("./metadata/formatExhibit", () => ({
    formatExhibit: (value) => ({ ...value, formatted: true }),
}));
jest.mock("./emptyRoom", () => ({ EMPTY_ROOM: {} }));

let saveToDb: typeof import("./saveToDb");
const getUsers = AccountsAPI.getUsers as jest.Mock;
const profile = { success: true, user: { walletId: "0xowner" } };

beforeEach(() => {
    jest.clearAllMocks();
    getUsers.mockResolvedValue(profile);
    jest.isolateModules(() => {
        saveToDb = require("./saveToDb");
    });
});

test("the world's owner is read once however many places ask at once", async () => {
    // The desktop menu, the mobile menu and the portal warm-up.
    const answers = await Promise.all([
        saveToDb.getUser("0xowner"),
        saveToDb.getUser("0xowner"),
        saveToDb.getUserByWalletId("0xowner"),
    ]);
    expect(answers).toEqual([profile, profile, profile]);
    expect(getUsers).toHaveBeenCalledTimes(1);
});

test("a menu's read serves later portal owner lookups", async () => {
    await saveToDb.getUser("0xowner");
    await saveToDb.getUserByWalletId("0xowner");
    expect(getUsers).toHaveBeenCalledTimes(1);
});

test("getUser still reads afresh once the earlier read has finished", async () => {
    await saveToDb.getUser("0xowner");
    await saveToDb.getUser("0xowner");
    expect(getUsers).toHaveBeenCalledTimes(2);
});

test("a failed read is not kept", async () => {
    getUsers.mockRejectedValueOnce(new Error("offline"));
    await expect(saveToDb.getUserByWalletId("0xowner")).resolves.toEqual({
        success: false,
        error: true,
    });
    await expect(saveToDb.getUserByWalletId("0xowner")).resolves.toBe(profile);
    expect(getUsers).toHaveBeenCalledTimes(2);
});

test("portal previews are one sorted, cacheable GET", async () => {
    const fetchMock = jest.fn(async () => ({
        json: async () => ({
            success: true,
            exhibits: [{ id: "a", info: {} }, { id: "broken" }],
        }),
    }));
    (global as any).fetch = fetchMock;
    const previews = await saveToDb.getExhibitPreviews(["b", "a", "b", null]);
    expect(fetchMock).toHaveBeenCalledWith(
        "/api/exhibit?type=GET_EXHIBITS_BY_IDS&ids=a,b"
    );
    expect(previews).toEqual([{ id: "a", info: {}, formatted: true }]);
    await expect(saveToDb.getExhibitPreviews([])).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
});
