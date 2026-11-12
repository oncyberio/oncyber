/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { UploaderProvider } from "./UploaderProvider";

// The modals load through next/dynamic. Here they load from the mocks
// below, through React.lazy, so a test only waits for a promise.
jest.mock("next/dynamic", () => (load: () => Promise<any>) => {
    const React = require("react");
    const Lazy = React.lazy(async () => ({ default: (await load()).default }));
    return (props) => (
        <React.Suspense fallback={null}>
            <Lazy {...props} />
        </React.Suspense>
    );
});
jest.mock("next/router", () => ({
    useRouter: () => ({ asPath: "/destinations/new", push: jest.fn() }),
}));
jest.mock("@components/_3DExhibit-v2/context/WorldProvider", () => ({
    WorldProvider: ({ children }) => children,
}));
jest.mock("@components/_3DExhibit-v2/hooks/useWorld", () => ({
    useWorld: () => ({ current: { getKitBashTypes: () => [] } }),
}));
jest.mock("@components/context/UserContext", () => ({
    UserContext: require("react").createContext({ token: "session" }),
}));
jest.mock("@components/Dialogs", () => ({ showError: jest.fn() }));
jest.mock("@utils/saveToDb", () => ({}));
jest.mock("@utils/media/mediaUploader", () => ({ uploadFile: jest.fn() }));

// The editor: one Upload button.
jest.mock("./EditScene", () => ({
    __esModule: true,
    default: ({ onSubmit }) => (
        <button onClick={() => onSubmit({}, null, null)}>Upload</button>
    ),
}));
// The name form: shows what it starts from, and sends what the test typed.
let mockTyped: { name: string; slug: string };
jest.mock("./Modals/EditMetadata", () => ({
    __esModule: true,
    default: ({ destination, onSubmit }) => (
        <form data-form="">
            <output data-name="">{destination.name || ""}</output>
            <output data-slug="">{destination.slug || ""}</output>
            <button type="button" onClick={() => onSubmit(mockTyped)}>
                Next
            </button>
        </form>
    ),
}));
// The upload window: the name it deploys, and how it can end.
jest.mock("./Modals/Loader", () => ({
    __esModule: true,
    default: ({ metadata, onSuccess, onCancel }) => (
        <div data-loader="">
            <output data-deploying="">{metadata.name}</output>
            <button onClick={onCancel}>Close</button>
            <button onClick={() => onSuccess({ slug: metadata.slug })}>
                Finish
            </button>
        </div>
    ),
}));
jest.mock("./Modals/UploadSuccess", () => ({
    UploadSuccess: ({ onClose }) => <button onClick={onClose}>Done</button>,
}));

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

// The editor is a portal on document.body, so look there.
const $ = (selector: string) => document.body.querySelector(selector);
const press = async (label: string) => {
    const button = Array.from(document.body.querySelectorAll("button")).find(
        (item) => item.textContent.trim() === label
    );
    await act(async () => button.click());
    // Let React.lazy resolve the modal that opened.
    await act(() => new Promise((done) => setTimeout(done, 0)));
};
const form = () =>
    $("[data-form]") && {
        name: $("[data-name]").textContent,
        slug: $("[data-slug]").textContent,
    };

/** A space that was never uploaded, open in the editor with its file. */
async function mount() {
    await act(async () =>
        root.render(
            <UploaderProvider
                initSceneState={{
                    type: "SceneEdit",
                    destination: { params: {} },
                    newUpload: { fileURL: "blob:space" },
                    spline: null,
                }}
            />
        )
    );
    await act(() => new Promise((done) => setTimeout(done, 0)));
}

it("starts the name form empty for a space that has no name", async () => {
    await mount();
    await press("Upload");
    expect(form()).toEqual({ name: "", slug: "" });
});

it("shows the typed name again after a failed upload is closed", async () => {
    mockTyped = { name: "Night Garden", slug: "night-garden" };
    await mount();
    await press("Upload");
    await press("Next");
    expect($("[data-deploying]").textContent).toBe("Night Garden");

    await press("Close");
    expect($("[data-loader]")).toBeNull();

    // Back in the editor, pressing Upload again: the form is not empty.
    await press("Upload");
    expect(form()).toEqual({ name: "Night Garden", slug: "night-garden" });

    // A name changed on the second try is the one deployed, and remembered.
    mockTyped = { name: "Night Garden II", slug: "night-garden-ii" };
    await press("Next");
    expect($("[data-deploying]").textContent).toBe("Night Garden II");
    await press("Close");
    await press("Upload");
    expect(form()).toEqual({
        name: "Night Garden II",
        slug: "night-garden-ii",
    });
});

it("forgets the typed name once the space is uploaded", async () => {
    mockTyped = { name: "Night Garden", slug: "night-garden" };
    await mount();
    await press("Upload");
    await press("Next");
    await press("Finish");
    await press("Done");

    await press("Upload");
    expect(form()).toEqual({ name: "", slug: "" });
});
