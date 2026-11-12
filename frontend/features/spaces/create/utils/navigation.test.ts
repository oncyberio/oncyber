import { createNewSpace, createEmptySpace } from "./index";
const mockCreate = jest.fn(),
    mockUpdate = jest.fn(),
    mockEmpty = jest.fn();
jest.mock("@utils/saveToDb", () => ({
    createExhibit: (...args) => mockCreate(...args),
    updateUser: (...args) => mockUpdate(...args),
    createStylekit: jest.fn(),
}));
jest.mock(
    "@api/exhibit/_api",
    () => ({
        __esModule: true,
        default: { createEmpty: (...args) => mockEmpty(...args) },
    }),
    { virtual: true }
);
jest.mock("@utils/anon", () => ({
    getDefaultAnonExhibit: (room) => ({ id: "draft", info: { room } }),
}));
beforeEach(() => jest.clearAllMocks());
test("anonymous creation returns a local draft without account writes", async () => {
    await expect(createNewSpace("anon", "", "room")).resolves.toMatchObject({
        id: "draft",
        info: { room: "room" },
    });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
});
test.each([false, true])(
    "signed-in creation waits for the account pointer before returning (empty=%s)",
    async (empty) => {
        const exhibit = { id: "created" };
        mockCreate.mockResolvedValue({ success: true, exhibit });
        mockEmpty.mockResolvedValue({ success: true, value: exhibit });
        let finish;
        mockUpdate.mockImplementation(
            () =>
                new Promise((r) => {
                    finish = r;
                })
        );
        let done = false;
        const creation = (
            empty
                ? createEmptySpace("OWNER", "token")
                : createNewSpace("OWNER", "token", "room")
        ).then((value) => {
            done = true;
            return value;
        });
        for (let i = 0; i < 5; i++) await Promise.resolve();
        expect(done).toBe(false);
        expect(mockUpdate).toHaveBeenCalledWith(
            "token",
            { currentExhibitId: "created", walletId: "owner" },
            "OWNER"
        );
        finish({ success: true });
        await expect(creation).resolves.toBe(exhibit);
    }
);
test("account-update failure prevents navigation from receiving a created exhibit", async () => {
    mockCreate.mockResolvedValue({ success: true, exhibit: { id: "created" } });
    mockUpdate.mockResolvedValue({ success: false, message: "denied" });
    await expect(createNewSpace("owner", "token", "room")).rejects.toThrow(
        "denied"
    );
});
