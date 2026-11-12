/** @jest-environment jsdom */
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { UploadAsset, uploadFailure } from "./UploadContent";

const mockSaveUpload = jest.fn();

jest.mock("./utils", () => ({
    getUploader: () => ({ saveUpload: mockSaveUpload }),
    getUploadErrorMsg: (err) => ({
        title: "Upload error",
        message: err.message,
    }),
}));
jest.mock("../../context/WorldEditContext", () => ({
    useEditWorld: () => ({
        baseAnalyticsEvent: {},
        droppedFile: { current: null },
    }),
}));
jest.mock("@components/context/UserContext", () => ({
    UserContext: require("react").createContext({
        token: "t",
        isAnonymous: false,
    }),
}));
jest.mock("@utils/anon", () => ({ reachedAnonLimits: jest.fn() }));
jest.mock("@utils/analytics", () => ({
    amplitude_logAnalyticsEvent: jest.fn(),
}));
jest.mock("../shared/AssetIcon", () => ({ AssetIcon: () => null }));

beforeEach(() => {
    jest.clearAllMocks();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.spyOn(console, "error").mockImplementation(() => {});
});

it.each([
    ["exists", "You have already uploaded this file.", false],
    ["mime", "This kind of file can't be added.", false],
    ["size-limit", "This file is too large.", false],
    ["network", "Couldn't upload the file.", true],
])("explains a %s failure in plain words", (code, text, canRetry) => {
    const shown = uploadFailure(new Error(code));
    expect(shown.message).toContain(text);
    expect(shown.canRetry).toBe(canRetry);
});

function mount() {
    const host = document.createElement("div");
    const root = createRoot(host);
    const finished = jest.fn();
    act(() => root.render(<UploadAsset onUploadFinished={finished} />));
    const choose = async (file: File) => {
        const input = host.querySelector("input[type=file]");
        Object.defineProperty(input, "files", {
            configurable: true,
            value: [file],
        });
        await act(async () => {
            input.dispatchEvent(new Event("change", { bubbles: true }));
        });
    };
    return { host, root, finished, choose };
}

it("says a failed upload under the card and Retry sends the same file", async () => {
    const file = new File(["png"], "cat.png", { type: "image/png" });
    mockSaveUpload
        .mockRejectedValueOnce(new Error("network"))
        .mockResolvedValueOnce({ url: "u", name: "cat.png", hash: "h" });

    const { host, root, finished, choose } = mount();
    await choose(file);

    const alert = host.querySelector('[role="alert"]');
    expect(alert.textContent).toContain("Couldn't upload the file.");

    const retry = alert.querySelector("button");
    expect(retry.textContent).toBe("Retry");
    await act(async () => retry.click());

    expect(mockSaveUpload).toHaveBeenCalledTimes(2);
    expect(mockSaveUpload.mock.calls[1][0].file).toBe(file);
    expect(finished).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[role="alert"]')).toBeNull();

    act(() => root.unmount());
});

it("offers no Retry when the file itself is the problem", async () => {
    const big = new File(["x"], "big.png", { type: "image/png" });
    Object.defineProperty(big, "size", { value: 9 * 1024 * 1024 });

    const { host, root, choose } = mount();
    await choose(big);

    const alert = host.querySelector('[role="alert"]');
    expect(alert.textContent).toBe(
        "This file is too large. The limit is 8 MB."
    );
    expect(alert.querySelector("button")).toBeNull();
    expect(mockSaveUpload).not.toHaveBeenCalled();

    act(() => root.unmount());
});
