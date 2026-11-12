/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import {
    applyFactory,
    getUserDestination,
    uploadCinematic,
} from "@utils/saveToDb";
import { uploadFile } from "@utils/media/mediaUploader";
import Optimiser from "@components/_3DExhibit-v2/three/modules/optimiser";
import Loader from "./index";

let mockWorld: any;
jest.mock("@utils/saveToDb", () => ({
    applyFactory: jest.fn(),
    getUserDestination: jest.fn(),
    updateFactory: jest.fn(),
    uploadCinematic: jest.fn(),
    updateCinematic: jest.fn(),
}));
jest.mock("@utils/media/mediaUploader", () => ({
    uploadFile: jest.fn(),
    uploadKitbashImages: jest.fn(),
}));
jest.mock("@components/_3DExhibit-v2/three/modules/optimiser", () => ({
    __esModule: true,
    default: { get: jest.fn() },
}));
jest.mock("@components/_3DExhibit-v2/hooks/useWorld", () => ({
    useWorld: () => ({ current: mockWorld }),
}));
jest.mock(
    "@context/UserContext",
    () => ({
        UserContext: require("react").createContext({
            user: { id: "creator" },
            token: "session",
        }),
    }),
    { virtual: true }
);
jest.mock("@utils/analytics", () => ({
    amplitude_logAnalyticsEvent: jest.fn(),
    getCookie: () => "uploader-session",
}));
jest.mock("@features/spaces/create/utils", () => ({
    createDefaultStylekit: jest.fn(),
}));
jest.mock("@components/modals/Modal", () => ({ children }) => (
    <div role="dialog">{children}</div>
));

const WAITING = "Deploying your space…";
const FAILED = "We couldn’t finish deploying your space";
const optimise = Optimiser.get as jest.Mock;
const upload = uploadFile as jest.Mock;
const save = applyFactory as jest.Mock;
const saveCinematic = uploadCinematic as jest.Mock;
const findSaved = getUserDestination as jest.Mock;
const created = { slug: "gallery", name: "Gallery" };

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let onSuccess: jest.Mock;
let onCancel: jest.Mock;
const settle = () => act(() => new Promise((done) => setTimeout(done, 0)));
const heading = () => container.querySelector("h1").textContent;
const buttons = () =>
    Array.from(container.querySelectorAll("button")).map(
        (button) => button.textContent
    );
const steps = () =>
    Array.from(container.querySelectorAll("h6")).map(
        (step) => `${step.textContent}: ${step.className}`
    );
const uploadedIds = () => upload.mock.calls.map(([file]) => file.id);
async function press(label: string) {
    const button = Array.from(container.querySelectorAll("button")).find(
        (item) => item.textContent === label
    );
    act(() => Simulate.click(button));
    await settle();
}
async function show(props: Record<string, any> = {}) {
    await act(async () =>
        root.render(
            <Loader
                mode="submit"
                metadata={{
                    slug: "gallery",
                    name: "Gallery",
                    fileURL: "blob:gallery",
                }}
                destination={{ status: "tested", params: {} } as any}
                onSuccess={onSuccess}
                onCancel={onCancel}
                {...props}
            />
        )
    );
    await settle();
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.spyOn(console, "error").mockImplementation(() => {});
    mockWorld = {
        getSceneData: jest.fn(async () => ({ placeholdersSize: 4 })),
        setShowPlaceholders: jest.fn(),
        takeBase64Screenshot: jest.fn(async () => "data:image/jpeg;cover"),
        getKitBashTypes: jest.fn(() => []),
    };
    (globalThis as any).fetch = jest.fn(async () => ({
        arrayBuffer: async () => new ArrayBuffer(4),
    }));
    optimise.mockReset().mockResolvedValue({
        low: "low-model",
        mid: "mid-model",
        high: "high-model",
        lowCompressed: "compressed-model",
    });
    upload
        .mockReset()
        .mockImplementation(async ({ id }) => ({ secure_url: `cdn/${id}` }));
    save.mockReset().mockResolvedValue({
        status: "success",
        destination: created,
    });
    saveCinematic.mockReset().mockResolvedValue({ success: true });
    // By default nothing was saved by an earlier attempt.
    findSaved.mockReset().mockResolvedValue({ success: false });
    onSuccess = jest.fn();
    onCancel = jest.fn();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.restoreAllMocks();
});

it("deploys once and never offers a way out while everything succeeds", async () => {
    let finish: (result: any) => void;
    save.mockReturnValue(
        new Promise((resolve) => {
            finish = resolve;
        })
    );
    await show();
    expect(heading()).toBe(WAITING);
    expect(container.querySelector(".dot-flashing")).not.toBeNull();
    expect(buttons()).toEqual([]);
    expect(steps()).toEqual([
        "Preparing different quality models: success",
        "Uploading files to our CDN: success",
        "Uploading to DB: progress",
    ]);

    await act(async () => finish({ status: "success", destination: created }));
    expect(mockWorld.setShowPlaceholders).toHaveBeenCalledWith(false);
    expect(optimise).toHaveBeenCalledTimes(1);
    expect(uploadedIds()).toEqual([
        "gallery-low-.glb",
        "gallery-mid.glb",
        "gallery-high.glb",
        "gallery-origin.glb",
        "gallery-low-compressed.glb",
        "gallery-thumb",
    ]);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][1]).toMatchObject({
        name: "Gallery",
        thumbnail: "cdn/gallery-thumb",
        paths: {
            low: "cdn/gallery-low-.glb",
            mid: "cdn/gallery-mid.glb",
            high: "cdn/gallery-high.glb",
            original_path: "cdn/gallery-origin.glb",
            low_compressed: "cdn/gallery-low-compressed.glb",
        },
        params: { artworkScale: 150, capacity: 4 },
        author: { id: "creator" },
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith(created);
    expect(heading()).toBe(WAITING);
    expect(buttons()).toEqual([]);
    expect(onCancel).not.toHaveBeenCalled();
});

it("shows a failed step inside the window with Close and Try again", async () => {
    save.mockResolvedValue({ status: "error", error: "Server unavailable" });
    await show();
    expect(heading()).toBe(FAILED);
    expect(container.querySelector(".dot-flashing")).toBeNull();
    expect(steps()).toEqual([
        "Preparing different quality models: success",
        "Uploading files to our CDN: success",
        "Uploading to DB: error",
    ]);
    expect(buttons()).toEqual(["Close", "Try again"]);
    expect(onSuccess).not.toHaveBeenCalled();

    // The deploy hid the frames for its cover shot.
    expect(mockWorld.setShowPlaceholders).toHaveBeenLastCalledWith(false);
    await press("Close");
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(1);
    // The editor behind the window gets them back.
    expect(mockWorld.setShowPlaceholders).toHaveBeenLastCalledWith(true);
});

it("leaves the frames hidden on Close when the space is set to hide them", async () => {
    save.mockResolvedValue({ status: "error", error: "Server unavailable" });
    await show({
        destination: {
            status: "tested",
            params: { showPlaceholders: false },
        },
    });
    await press("Close");
    expect(mockWorld.setShowPlaceholders).toHaveBeenLastCalledWith(false);
    expect(mockWorld.setShowPlaceholders).toHaveBeenCalledTimes(2);
});

it("tries the failed step again without preparing or uploading twice", async () => {
    save.mockResolvedValueOnce({ status: "error" });
    await show();
    expect(heading()).toBe(FAILED);

    let finish: (result: any) => void;
    save.mockReturnValueOnce(
        new Promise((resolve) => {
            finish = resolve;
        })
    );
    await press("Try again");
    expect(heading()).toBe(WAITING);
    expect(container.querySelector(".dot-flashing")).not.toBeNull();
    expect(buttons()).toEqual([]);
    expect(steps()).toEqual([
        "Preparing different quality models: success",
        "Uploading files to our CDN: success",
        "Uploading to DB: progress",
    ]);

    await act(async () => finish({ status: "success", destination: created }));
    expect(onSuccess).toHaveBeenCalledWith(created);
    expect(optimise).toHaveBeenCalledTimes(1);
    expect(mockWorld.takeBase64Screenshot).toHaveBeenCalledTimes(1);
    expect(upload).toHaveBeenCalledTimes(6);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][1]).toEqual(save.mock.calls[0][1]);
});

it("uploads only the thumbnail again when the models already reached the CDN", async () => {
    upload.mockImplementation(async ({ id }) => {
        if (id === "gallery-thumb" && upload.mock.calls.length === 6)
            throw new Error("Network");
        return { secure_url: `cdn/${id}` };
    });
    await show();
    expect(heading()).toBe(FAILED);
    expect(steps()[1]).toBe("Uploading files to our CDN: error");
    expect(steps()[2]).toBe("Uploading to DB: todo");
    expect(save).not.toHaveBeenCalled();

    await press("Try again");
    expect(uploadedIds().slice(6)).toEqual(["gallery-thumb"]);
    expect(optimise).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][1]).toMatchObject({
        thumbnail: "cdn/gallery-thumb",
        paths: { low: "cdn/gallery-low-.glb" },
    });
    expect(onSuccess).toHaveBeenCalledWith(created);
});

it("uploads the models again when they did not all reach the CDN", async () => {
    upload.mockImplementation(async ({ id }) => {
        if (id === "gallery-high.glb" && upload.mock.calls.length === 3)
            throw new Error("Network");
        return { secure_url: `cdn/${id}` };
    });
    await show();
    expect(heading()).toBe(FAILED);

    await press("Try again");
    expect(uploadedIds().slice(3)).toEqual([
        "gallery-low-.glb",
        "gallery-mid.glb",
        "gallery-high.glb",
        "gallery-origin.glb",
        "gallery-low-compressed.glb",
        "gallery-thumb",
    ]);
    expect(optimise).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith(created);
});

it("prepares the models again when preparing them was the step that failed", async () => {
    optimise.mockRejectedValueOnce(new Error("Out of memory"));
    await show();
    expect(heading()).toBe(FAILED);
    expect(steps()).toEqual([
        "Preparing different quality models: error",
        "Uploading files to our CDN: todo",
        "Uploading to DB: todo",
    ]);
    expect(upload).not.toHaveBeenCalled();

    await press("Try again");
    expect(optimise).toHaveBeenCalledTimes(2);
    expect(onSuccess).toHaveBeenCalledWith(created);
});

it("does not add the cinematic a second time when only saving failed", async () => {
    save.mockResolvedValueOnce({ status: "error" });
    await show({ splines: { points: [1, 2, 3] } });
    expect(heading()).toBe(FAILED);
    expect(saveCinematic).toHaveBeenCalledTimes(1);

    await press("Try again");
    expect(saveCinematic).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(2);
    expect(onSuccess).toHaveBeenCalledWith(created);
});

it("reuses a destination that was saved although the answer was lost, instead of creating a second", async () => {
    save.mockResolvedValueOnce({ status: "error", error: "Network lost" });
    await show();
    expect(heading()).toBe(FAILED);
    // The first attempt has nothing to look for.
    expect(findSaved).not.toHaveBeenCalled();

    findSaved.mockResolvedValueOnce({ success: true, data: created });
    await press("Try again");
    expect(findSaved).toHaveBeenCalledWith("session", "creator", "gallery");
    expect(save).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith(created);
});

it("creates the destination on a retry when the earlier attempt saved nothing", async () => {
    save.mockResolvedValueOnce({ status: "error", error: "Refused" });
    await show();
    await press("Try again");
    expect(findSaved).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(2);
    expect(onSuccess).toHaveBeenCalledWith(created);
});

it("offers the same way out when the deploy fails before its first step", async () => {
    mockWorld.getSceneData.mockRejectedValueOnce(new Error("Scene not ready"));
    const onError = jest.fn();
    await show({ onError });
    expect(heading()).toBe(FAILED);
    expect(buttons()).toEqual(["Close", "Try again"]);
    expect(onError).toHaveBeenCalledWith("Scene not ready");

    await press("Try again");
    expect(onSuccess).toHaveBeenCalledWith(created);
});
