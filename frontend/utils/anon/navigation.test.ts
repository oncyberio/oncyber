/** @jest-environment jsdom */
import { setAnonExhibit } from "./index";
import AccountsAPI from "@api/accounts/_api";
jest.mock(
    "@api/accounts/_api",
    () => ({
        __esModule: true,
        default: {
            verifyAnonHash: jest.fn(),
            setAnonHash: jest.fn(),
        },
    }),
    { virtual: true }
);
jest.mock("@utils/metadata/formatExhibit", () => ({
    formatExhibit: (value) => value,
}));
jest.mock("@utils/emptyRoom", () => ({ EMPTY_ROOM: {} }));
jest.mock(
    "@components/_3DExhibit-v2/three/factory/space/roomdatacompat",
    () => ({})
);
jest.mock("./FileUploadCache", () => ({
    FileUploadCache: { getInstance: () => ({ getUploadUrls: () => [] }) },
}));
jest.mock("@utils/media/mediaInfo", () => ({}));
jest.mock("@utils/media/mediaUploader", () => ({}));
jest.mock("@components/Dialogs", () => ({ showError: jest.fn() }));
jest.mock("@utils/urlUtils", () => ({}));
jest.mock("@features/studio/utils", () => ({}));
const previous = JSON.stringify({ id: "draft", info: { name: "Before" } });
const updated = { id: "draft", info: { name: "After" } };
beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("exhibit-anon", previous);
    jest.clearAllMocks();
    (AccountsAPI.verifyAnonHash as jest.Mock).mockResolvedValue({
        success: true,
    });
    (AccountsAPI.setAnonHash as jest.Mock).mockResolvedValue({ success: true });
});
test("does not replace the persisted draft until signing succeeds", async () => {
    let finish;
    (AccountsAPI.setAnonHash as jest.Mock).mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                finish = resolve;
            })
    );
    const saving = setAnonExhibit(updated);
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(localStorage.getItem("exhibit-anon")).toBe(previous);
    finish({ success: true });
    await saving;
    expect(JSON.parse(localStorage.getItem("exhibit-anon"))).toEqual(updated);
    expect(localStorage.getItem("exhibit-anon-next")).toBeNull();
});
test("failed signing rejects navigation and preserves the existing draft", async () => {
    (AccountsAPI.setAnonHash as jest.Mock).mockResolvedValueOnce({
        success: false,
    });
    await expect(setAnonExhibit(updated)).rejects.toThrow(
        "Could not save your draft"
    );
    expect(localStorage.getItem("exhibit-anon")).toBe(previous);
    expect(AccountsAPI.setAnonHash).toHaveBeenLastCalledWith({
        data: previous,
    });
    expect(localStorage.getItem("exhibit-anon-next")).toBeNull();
});
