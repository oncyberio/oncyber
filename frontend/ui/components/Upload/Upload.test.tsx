/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { uploadFile } from "@utils/factory/httpPinata";
import ImageUpload from "./Image";
import VideoUpload from "./Video";

jest.mock("@utils/factory/httpPinata", () => ({ uploadFile: jest.fn() }));
// The image picker reaches the context through @context, the video picker
// through @components.
jest.mock(
    "@context/UserContext",
    () => ({ UserContext: require("react").createContext({ token: "t" }) }),
    { virtual: true }
);
jest.mock("@components/context/UserContext", () => ({
    UserContext: require("react").createContext({ token: "t" }),
}));
jest.mock("@ui/components/ProgressBar", () => () => <i data-progress="" />);
jest.mock("@ui/icons/Plus", () => () => null);

const upload = uploadFile as jest.Mock;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.restoreAllMocks();
});

/** A request the test settles by hand. */
function held<T>() {
    let settle: { resolve: (value: T) => void; reject: (e: Error) => void };
    const promise = new Promise<T>(
        (resolve, reject) => (settle = { resolve, reject })
    );
    return { promise, ...settle };
}

const progress = () => container.querySelector("[data-progress]");
const failure = () => container.querySelector('[role="alert"]');
const input = () => container.querySelector("input") as HTMLInputElement;

/** The visitor picks `file` in the browser's file dialog. */
const pick = (file: File) =>
    act(async () => {
        Object.defineProperty(input(), "files", {
            value: [file],
            configurable: true,
        });
        input().dispatchEvent(new Event("change", { bubbles: true }));
    });

describe.each([
    ["image", ImageUpload, "Couldn't upload the image."],
    ["video", VideoUpload, "Couldn't upload the video."],
] as const)("the %s picker", (_kind, Picker, message) => {
    const file = new File(["x"], "pick.bin");
    let onUpload: jest.Mock;
    beforeEach(() => {
        onUpload = jest.fn();
        act(() => root.render(<Picker onUpload={onUpload} />));
    });

    it("shows progress only while the upload is running", async () => {
        const request = held<{ IpfsHash: string }>();
        upload.mockReturnValueOnce(request.promise);
        await pick(file);
        expect(upload).toHaveBeenCalledWith(file);
        expect(progress()).not.toBeNull();
        expect(input().disabled).toBe(true);

        await act(async () => request.resolve({ IpfsHash: "Qm1" }));
        expect(progress()).toBeNull();
        expect(input().disabled).toBe(false);
        expect(onUpload).toHaveBeenCalledTimes(1);
        expect(failure()).toBeNull();
    });

    it.each<[string, () => unknown]>([
        ["the request fails", () => upload.mockRejectedValueOnce("offline")],
        ["no hash comes back", () => upload.mockResolvedValueOnce({})],
    ])(
        "says so under the picker when %s, and Retry sends the same file",
        async (_name, arrange) => {
            arrange();
            await pick(file);
            expect(progress()).toBeNull();
            expect(input().disabled).toBe(false);
            expect(onUpload).not.toHaveBeenCalled();
            // It used to fail without a word, and picking the same file again
            // did nothing because the input had not changed.
            expect(failure().textContent).toBe(message + "Retry");

            upload.mockResolvedValueOnce({ IpfsHash: "Qm2" });
            await act(async () => failure().querySelector("button").click());
            expect(upload).toHaveBeenCalledTimes(2);
            expect(upload.mock.calls[1][0]).toBe(file);
            expect(onUpload).toHaveBeenCalledTimes(1);
            expect(failure()).toBeNull();
        }
    );
});
