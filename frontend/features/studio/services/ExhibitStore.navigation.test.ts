import { serialize, deserialize } from "v8";
(globalThis as any).structuredClone = (value) => deserialize(serialize(value));
import { ExhibitStore } from "./ExhibitStore";
const mockSave = jest.fn(),
    mockRemote = jest.fn();
jest.mock("@utils/firebase", () => ({ db: {} }));
jest.mock(
    "@api/exhibit/_api",
    () => ({
        __esModule: true,
        default: { opts: () => ({ update: mockRemote }) },
    }),
    { virtual: true }
);
jest.mock("@utils/js", () => ({
    Failure: (error) => ({ success: false, error }),
    Success: (value) => ({ success: true, value }),
    noop: () => {},
}));
jest.mock("@utils/metadata/formatExhibit", () => ({ formatExhibit: (x) => x }));
jest.mock("firebase/firestore", () => ({
    collection: jest.fn(),
    doc: jest.fn(),
    onSnapshot: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
}));
jest.mock("@utils/anon", () => ({
    setAnonExhibit: (...args) => mockSave(...args),
}));
const store = (mode) =>
    new ExhibitStore({
        exhibit: {
            id: "draft",
            info: { room: "empty", headline: "Before" },
            artworks: {},
            portals: {},
            kitbash: {},
        } as any,
        userId: "owner",
        token: "token",
        mode,
    });
beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockSave.mockResolvedValue(undefined);
    mockRemote.mockResolvedValue(undefined);
});
afterEach(() => jest.useRealTimers());
test.each(["local", "remote"])(
    "leaving flushes debounced %s edits once and waits for persistence",
    async (mode) => {
        let finish;
        const save = mode === "local" ? mockSave : mockRemote;
        save.mockImplementation(
            () =>
                new Promise((r) => {
                    finish = r;
                })
        );
        const draft = store(mode);
        const update = draft.updateExhibitInfo({ headline: "After" });
        let left = false;
        const leaving = draft.dispose().then(() => {
            left = true;
        });
        await Promise.resolve();
        expect(left).toBe(false);
        expect(jest.getTimerCount()).toBe(0);
        finish({ success: true });
        await leaving;
        await update;
        await draft.dispose();
        expect(save).toHaveBeenCalledTimes(1);
    }
);
test("failed persistence blocks leaving and can be retried", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    mockSave.mockRejectedValueOnce(Error("offline"));
    const draft = store("local");
    const update = draft.updateExhibitInfo({ headline: "After" });
    const rejected = expect(update).rejects.toThrow("offline");
    await expect(draft.dispose()).rejects.toThrow("offline");
    await rejected;
    await expect(draft.dispose()).resolves.toBeUndefined();
    expect(mockSave).toHaveBeenCalledTimes(2);
    log.mockRestore();
});
