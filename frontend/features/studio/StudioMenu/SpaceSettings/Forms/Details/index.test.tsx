/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import { Details } from "./index";

const mockStore = { updateExhibitInfo: jest.fn() };
const mockOpenSnackbar = jest.fn();
const mockCloseSnackbar = jest.fn();
jest.mock("@components/Snackbar", () => ({
    useSnackbar: () => [mockOpenSnackbar, mockCloseSnackbar],
}));
jest.mock("@components/Snackbar/useSnackbar", () => ({
    DEFAULT_SNACKBAR_DURATION: 5000,
}));
jest.mock("@components/context/UserContext", () => ({
    UserContext: require("react").createContext({ user: { id: "creator" } }),
}));
jest.mock("@features/studio/context/ExhibitContext", () => ({
    useCurrentExhibit: () => ({
        exhibit: {
            id: "space-1",
            info: { headline: "Martian", description: "Red dust" },
        },
        exhibitStore: mockStore,
        userRole: "owner",
        baseAnalyticsEvent: {},
    }),
}));
jest.mock("../context/SpaceCoverContext", () => ({
    useSpaceCoverContext: () => ({
        is2DLoading: false,
        set2DUploading: jest.fn(),
        is360Loading: false,
        generateCover: jest.fn(),
    }),
}));
jest.mock("@components/hooks/useDebouncedCallback", () => ({
    useDebouncedCallback: (callback) => callback,
}));
jest.mock("@utils/analytics", () => ({
    amplitude_logAnalyticsEvent: jest.fn(),
}));
jest.mock("@utils/rules/url", () => ({ validatePath: jest.fn() }));
jest.mock("@features/studio/StudioMenu/context/useCustomLinkEditor", () => ({
    useCustomLinkEditor: jest.fn(),
}));
jest.mock("../shared/CustomLinkEdit", () => ({ CustomLinkEdit: () => null }));
jest.mock("../shared/LinkStatus", () => ({ LinkStatus: () => null }));
jest.mock("../shared/Input", () => ({
    Input: (props) => <input aria-label="Title" {...props} />,
}));
jest.mock("../shared/TextArea", () => ({
    TextArea: (props) => <textarea aria-label="Description" {...props} />,
}));
jest.mock("@ui/components/Spinner", () => () => null);
jest.mock("@ui/components/IconImg", () => () => null);
jest.mock("@ui/icons/InfoCircle", () => () => null);
jest.mock("@components/ImageUploader", () => () => null);

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.spyOn(console, "error").mockImplementation(() => {});
    mockStore.updateExhibitInfo.mockReset();
    mockOpenSnackbar.mockReset();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    act(() => root.render(<Details />));
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.restoreAllMocks();
});

const field = (label: string) =>
    container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`);
const type = (label: string, value: string) =>
    act(async () =>
        Simulate.change(field(label), { target: { value } } as any)
    );
const failures = () =>
    Array.from(container.querySelectorAll('[role="alert"]')).map(
        (element) => element.textContent
    );

it("explains a failed save under the field, not in a toast", async () => {
    mockStore.updateExhibitInfo.mockRejectedValueOnce(new Error("Offline"));
    await type("Title", "Lunar");
    expect(failures()).toEqual(["Couldn't save the title.Retry"]);
    expect(field("Title").nextElementSibling.getAttribute("role")).toBe(
        "alert"
    );
    expect(mockOpenSnackbar).not.toHaveBeenCalled();
    // The field keeps what was typed.
    expect(field("Title").value).toBe("Lunar");
});

it("Retry saves what the field shows now and clears the message", async () => {
    mockStore.updateExhibitInfo.mockRejectedValueOnce(new Error("Offline"));
    await type("Description", "Grey dust");
    expect(failures()).toEqual(["Couldn't save the description.Retry"]);

    mockStore.updateExhibitInfo.mockResolvedValueOnce(undefined);
    await act(async () =>
        container
            .querySelector<HTMLButtonElement>("[role=alert] button")
            .click()
    );
    expect(mockStore.updateExhibitInfo).toHaveBeenLastCalledWith({
        description: "Grey dust",
    });
    expect(failures()).toEqual([]);
});

it("keeps the message while saves keep failing and drops it once one succeeds", async () => {
    mockStore.updateExhibitInfo.mockRejectedValue(new Error("Offline"));
    await type("Title", "L");
    await type("Title", "Lu");
    expect(failures()).toEqual(["Couldn't save the title.Retry"]);
    // Another field saving does not clear the title's message.
    mockStore.updateExhibitInfo.mockResolvedValue(undefined);
    await type("Description", "Grey dust");
    expect(failures()).toEqual(["Couldn't save the title.Retry"]);
    await type("Title", "Lun");
    expect(failures()).toEqual([]);
});
