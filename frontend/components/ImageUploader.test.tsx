/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { uploadFile } from "@utils/factory/httpPinata";
import ImageUploader from "./ImageUploader";

jest.mock("@utils/factory/httpPinata", () => ({ uploadFile: jest.fn() }));
jest.mock("./context/UserContext", () => ({
    UserContext: require("react").createContext({ user: { id: "u" } }),
}));
jest.mock("../utils/analytics", () => ({
    amplitude_logAnalyticsEvent: jest.fn(),
}));
jest.mock("@ui/components/Spinner", () => () => <i data-spinner="" />);
jest.mock("@ui/components/IconImg", () => ({ name }) => <i data-icon={name} />);

const upload = uploadFile as jest.Mock;

// jsdom decodes no pictures: read every file as a data URL at once and
// "load" every picture as soon as it gets a source.
class InstantReader extends EventTarget {
    result = "data:image/png;base64,eA==";
    readAsDataURL() {
        queueMicrotask(() => this.dispatchEvent(new Event("load")));
    }
}
class InstantImage {
    onload: () => void;
    set src(_value: string) {
        queueMicrotask(() => this.onload?.());
    }
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let realReader: typeof FileReader;
let realImage: typeof Image;
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
    realReader = window.FileReader;
    realImage = window.Image;
    (window as any).FileReader = InstantReader;
    (window as any).Image = InstantImage;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    window.FileReader = realReader;
    window.Image = realImage;
    jest.restoreAllMocks();
});

const spinner = () => container.querySelector("[data-spinner]");
const input = () => container.querySelector("input") as HTMLInputElement;
const pick = (file: File) =>
    act(async () => {
        Object.defineProperty(input(), "files", {
            value: [file],
            configurable: true,
        });
        input().dispatchEvent(new Event("change", { bubbles: true }));
    });

function mount() {
    const props = {
        onUploadStarted: jest.fn(),
        onUploadFinished: jest.fn(),
        onUploadFailed: jest.fn(),
        onProgress: jest.fn(),
    };
    act(() => root.render(<ImageUploader exhibitId="space-1" {...props} />));
    return props;
}

const file = new File(["x"], "banner.png", { type: "image/png" });

it("tells its parent the upload started and finished", async () => {
    upload.mockResolvedValueOnce({ IpfsHash: "Qm1" });
    const props = mount();
    await pick(file);
    expect(props.onUploadStarted).toHaveBeenCalledTimes(1);
    expect(props.onUploadFinished).toHaveBeenCalledWith(
        "https://cyber.mypinata.cloud/ipfs/Qm1"
    );
    expect(props.onUploadFailed).not.toHaveBeenCalled();
    expect(spinner()).toBeNull();
});

it.each<[string, () => unknown]>([
    ["the request fails", () => upload.mockRejectedValueOnce("offline")],
    ["no hash comes back", () => upload.mockResolvedValueOnce({})],
])(
    "tells its parent the upload ended when %s, with a retry",
    async (_name, arrange) => {
        arrange();
        const props = mount();
        await pick(file);
        // The parent's own "uploading" flag used to stay on: it only ever
        // heard that the upload had started.
        expect(props.onUploadFailed).toHaveBeenCalledTimes(1);
        expect(props.onUploadFinished).not.toHaveBeenCalled();
        expect(spinner()).toBeNull();
        expect(input().disabled).toBe(false);

        upload.mockResolvedValueOnce({ IpfsHash: "Qm2" });
        const [retry] = props.onUploadFailed.mock.calls[0];
        await act(async () => retry());
        expect(upload.mock.calls.at(-1)[0]).toBe(file);
        expect(props.onUploadStarted).toHaveBeenCalledTimes(
            upload.mock.calls.length
        );
        expect(props.onUploadFinished).toHaveBeenCalledTimes(1);
        expect(spinner()).toBeNull();
    }
);

it("sends a second picture once", async () => {
    upload.mockResolvedValue({ IpfsHash: "Qm1" });
    mount();
    await pick(file);
    const other = new File(["y"], "other.png", { type: "image/png" });
    await pick(other);
    expect(upload.mock.calls.map(([sent]) => sent)).toEqual([file, other]);
});

it("spins only while the upload is running", async () => {
    let settle: (value: unknown) => void;
    upload.mockReturnValue(new Promise((resolve) => (settle = resolve)));
    mount();
    await pick(file);
    expect(spinner()).not.toBeNull();
    expect(input().disabled).toBe(true);

    await act(async () => settle({ IpfsHash: "Qm1" }));
    expect(spinner()).toBeNull();
});
