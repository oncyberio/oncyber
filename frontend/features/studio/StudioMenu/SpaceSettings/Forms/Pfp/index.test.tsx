/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import UploadService from "@api/uploader/_api";
import { Pfp } from "./index";

const mockStore = { updateExhibitParams: jest.fn() };
const mockOpenSnackbar = jest.fn();
jest.mock(
    "@api/uploader/_api",
    () => ({ __esModule: true, default: { uploadMedia: jest.fn() } }),
    { virtual: true }
);
jest.mock("@components/hooks/useUserAvatars", () => ({
    useUserAvatars: () => ({
        state: "Loaded",
        data: {
            assets: [
                {
                    name: "Spacepod",
                    image_preview_url: "/spacepod.png",
                    contract_address: "0xabc",
                    token_id: "7",
                },
            ],
        },
    }),
}));
jest.mock("@features/studio/context/ExhibitContext", () => ({
    useCurrentExhibit: () => ({
        exhibit: { params: { pfp: { avatar: "/current.png" } } },
        exhibitStore: mockStore,
        userRole: "owner",
        baseAnalyticsEvent: {},
    }),
}));
jest.mock("@utils/analytics", () => ({
    amplitude_logAnalyticsEvent: jest.fn(),
}));
jest.mock("@components/Snackbar", () => ({
    useSnackbar: () => [mockOpenSnackbar, jest.fn()],
}));

const upload = UploadService.uploadMedia as jest.Mock;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.spyOn(console, "error").mockImplementation(() => {});
    upload.mockReset();
    mockStore.updateExhibitParams.mockReset();
    mockOpenSnackbar.mockReset();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    act(() => root.render(<Pfp />));
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.restoreAllMocks();
});

const button = (name: string) =>
    Array.from(container.querySelectorAll("button")).find(
        (element) =>
            element.textContent === name ||
            element.getAttribute("aria-label") === name
    );
const click = (name: string) => act(async () => button(name).click());
const failure = () => container.querySelector('[role="alert"]');

it("explains a picture that failed to save above the picker, and Retry saves it again", async () => {
    upload.mockRejectedValueOnce(new Error("Upload failed"));
    await click("Spacepod");
    expect(failure().textContent).toBe(
        "Couldn't update the visitor picture.Retry"
    );
    // Above the picker, not in a toast.
    const search = container.querySelector('input[type="search"]');
    expect(
        failure().compareDocumentPosition(search) &
            Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(mockOpenSnackbar).not.toHaveBeenCalled();
    expect(mockStore.updateExhibitParams).not.toHaveBeenCalled();

    upload.mockResolvedValueOnce({ secure_url: "/saved.png" });
    await click("Retry");
    expect(upload).toHaveBeenCalledTimes(2);
    expect(upload.mock.calls[1][0].url).toBe("/spacepod.png");
    expect(failure()).toBeNull();
    expect(mockStore.updateExhibitParams).toHaveBeenCalledWith({
        pfp: {
            avatar: "/saved.png",
            avatarContractAddress: "0xabc",
            avatarTokenId: "7",
        },
    });
});

it("says nothing when the picture saves", async () => {
    upload.mockResolvedValueOnce({ secure_url: "/saved.png" });
    await click("Spacepod");
    expect(failure()).toBeNull();
});

it("puts the failure away when the shared picture is switched off", async () => {
    upload.mockRejectedValueOnce(new Error("Upload failed"));
    await click("Spacepod");
    expect(failure()).not.toBeNull();
    await click("Use a shared visitor picture");
    expect(failure()).toBeNull();
    await click("Use a shared visitor picture");
    expect(failure()).toBeNull();
});
