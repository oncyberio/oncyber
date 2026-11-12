/** @jest-environment jsdom */
// A profile picture that is too large, or that fails to upload, is explained
// under the picker instead of in a browser alert (docs/feedback.md).
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import UploaderAvatar from "./UploaderAvatar";
import { UserContext } from "@components/context/UserContext";
import { updateAvatar } from "@utils/saveToDb";

jest.mock("@components/context/UserContext", () => {
    const React = require("react");
    return { UserContext: React.createContext({}) };
});
jest.mock("@utils/saveToDb", () => ({ updateAvatar: jest.fn() }));
jest.mock("@utils/analytics", () => ({
    amplitude_logAnalyticsEvent: jest.fn(),
}));
jest.mock("@ui/components/IconImg", () => () => null);
jest.mock("@ui/components/Spinner", () => () => null);
jest.mock("@ui/components/IconButton.tsx", () => ({ IconButton: () => null }));

const upload = updateAvatar as jest.Mock;

// jsdom reads no files and decodes no images: both finish at once here.
class InstantReader {
    result = "data:image/png;base64,AAAA";
    private onLoad: () => void;
    addEventListener(_type: string, listener: () => void) {
        this.onLoad = listener;
    }
    readAsDataURL() {
        Promise.resolve().then(() => this.onLoad?.());
    }
}
class InstantImage {
    onload: () => void;
    set src(_value: string) {
        Promise.resolve().then(() => this.onload?.());
    }
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const onImageReady = jest.fn();
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    (globalThis as any).FileReader = InstantReader;
    (globalThis as any).Image = InstantImage;
    upload.mockReset();
    onImageReady.mockReset();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    act(() =>
        root.render(
            <UserContext.Provider value={{ user: { id: "0xme" } } as any}>
                <UploaderAvatar currentAvatar="" onImageReady={onImageReady} />
            </UserContext.Provider>
        )
    );
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

const alert = () => container.querySelector('[role="alert"]');

async function pick(sizeInBytes: number) {
    const input = container.querySelector("input");
    const file = new File(["x"], "me.png", { type: "image/png" });
    Object.defineProperty(file, "size", { value: sizeInBytes });
    Object.defineProperty(input, "files", {
        value: [file],
        configurable: true,
    });
    await act(async () => {
        input.dispatchEvent(new Event("change", { bubbles: true }));
        await new Promise((done) => setTimeout(done));
    });
}

test("a picture over 900 KB is explained, without Retry", async () => {
    await pick(2 * 1024 * 1024);

    expect(alert().textContent).toBe(
        "This picture is larger than 900 KB. Choose a smaller one."
    );
    expect(alert().querySelector("button")).toBeNull();
    expect(upload).not.toHaveBeenCalled();
});

test("a failed upload is explained with Retry, which uploads it again", async () => {
    upload.mockResolvedValueOnce({ success: false });
    await pick(1024);

    expect(alert().textContent).toBe("Couldn't upload your picture.Retry");

    upload.mockResolvedValueOnce({ success: true, url: "https://pic" });
    await act(async () => {
        alert().querySelector("button").click();
        await new Promise((done) => setTimeout(done));
    });

    expect(upload).toHaveBeenCalledTimes(2);
    expect(upload).toHaveBeenLastCalledWith(
        "data:image/png;base64,AAAA",
        "0xme",
        1
    );
    expect(onImageReady).toHaveBeenCalledWith("https://pic");
    expect(alert()).toBeNull();
});
