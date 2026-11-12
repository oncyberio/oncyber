/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import Profile from "./index";
import { usePanel } from "../context/PanelProvider";
import { useVrm } from "@components/context/VrmContext";

jest.mock("@components/hooks/useMediaQuery", () => ({
    useMediaQuery: () => false,
}));

jest.mock("../context/PanelProvider", () => ({ usePanel: jest.fn() }));
jest.mock("@components/context/VrmContext", () => ({ useVrm: jest.fn() }));
jest.mock("@components/_3DExhibit-v2/hooks/useWorldState", () => ({
    useWorldState: () => ({ mode: "display" }),
}));
jest.mock("@components/hooks/useEventCallback", () => ({
    useEventCallback: (callback) => callback,
}));
jest.mock("@components/context/I18nContext", () => ({
    useCyberTranslation: () => ({ t: (text) => String(text) }),
}));
jest.mock("@ui/components/IconImg", () => ({
    __esModule: true,
    default: () => <span />,
}));
jest.mock("./Vrm/Selection", () => ({
    __esModule: true,
    default: () => <button>Choose avatar fixture</button>,
}));
jest.mock("./Vrm/NewUpload", () => ({
    __esModule: true,
    default: () => <input aria-label="Avatar name" />,
}));
jest.mock("../Settings", () => ({
    __esModule: true,
    default: () => <button>Camera fixture</button>,
}));
jest.mock("framer-motion", () => {
    const React = require("react");
    return {
        AnimatePresence: ({ children }) => children,
        useReducedMotion: () => true,
        motion: {
            div: React.forwardRef(
                ({ initial, animate, exit, transition, ...props }, ref) => (
                    <div ref={ref} {...props} />
                )
            ),
        },
    };
});

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let panel: any;
let vrm: any;
const render = (isShowing = true) =>
    act(() => root.render(<Profile isShowing={isShowing} />));
const button = (label: string) =>
    container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
const key = (target: HTMLElement, value: string) => {
    const event = new KeyboardEvent("keydown", {
        key: value,
        bubbles: true,
        cancelable: true,
    });
    act(() => target.dispatchEvent(event));
    return event;
};
beforeEach(() => {
    jest.useFakeTimers();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    panel = {
        clickRef: { current: null },
        activeProfileTab: "profile",
        setCurrentTab: jest.fn(),
        setActiveProfileTab: jest.fn(),
    };
    vrm = {
        currentModal: { type: "none" },
        disableCancel: false,
        onCancel: jest.fn(),
        onUploadVrm: jest.fn(),
    };
    (usePanel as jest.Mock).mockReturnValue(panel);
    (useVrm as jest.Mock).mockReturnValue(vrm);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.useRealTimers();
    jest.clearAllMocks();
});

test("avatar and settings tabs preserve the native panel actions", () => {
    render();
    expect(container.querySelector('[role="tabpanel"]').textContent).toContain(
        "Choose avatar fixture"
    );
    act(() =>
        container
            .querySelector<HTMLButtonElement>("#visitor-profile-tab-settings")
            .click()
    );
    expect(panel.setActiveProfileTab).toHaveBeenCalledWith("settings");
    panel.activeProfileTab = "settings";
    render();
    expect(container.querySelector('[role="tabpanel"]').textContent).toContain(
        "Camera fixture"
    );
    expect(
        container
            .querySelector('[role="tabpanel"]')
            .getAttribute("aria-labelledby")
    ).toBe("visitor-profile-tab-settings");
});

test("arrow navigation changes the profile tab and follows its focus", () => {
    render();
    const avatars = container.querySelector<HTMLElement>(
        "#visitor-profile-tab-profile"
    );
    act(() => avatars.focus());
    expect(key(avatars, "ArrowRight").defaultPrevented).toBe(true);
    expect(panel.setActiveProfileTab).toHaveBeenCalledWith("settings");
    expect(document.activeElement.id).toBe("visitor-profile-tab-settings");
});

test("Tab leaves native browser traversal intact while keeping world shortcuts out", () => {
    render();
    const worldShortcut = jest.fn();
    window.addEventListener("keydown", worldShortcut);
    const event = key(container.querySelector("[role=tab]"), "Tab");
    expect(event.defaultPrevented).toBe(false);
    expect(worldShortcut).not.toHaveBeenCalled();
    key(container.querySelector("[role=tab]"), "p");
    expect(worldShortcut).not.toHaveBeenCalled();
    window.removeEventListener("keydown", worldShortcut);
});

test("Escape closes the sidebar and returns focus to its opener", () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    render();
    act(() => jest.advanceTimersByTime(20));
    expect(document.activeElement.id).toBe("visitor-profile-tab-profile");
    key(document.activeElement as HTMLElement, "Escape");
    expect(panel.setCurrentTab).toHaveBeenCalledWith("");
    render(false);
    expect(document.activeElement).toBe(opener);
    opener.remove();
});

test("upload cancellation goes back to avatars without closing the sidebar", () => {
    vrm.currentModal.type = "upload";
    render();
    key(container.querySelector("input"), "Escape");
    expect(vrm.onCancel).toHaveBeenCalledTimes(1);
    expect(panel.setCurrentTab).not.toHaveBeenCalled();
    act(() => button("Back to avatars").click());
    expect(vrm.onCancel).toHaveBeenCalledTimes(2);
});

test("an in-progress upload keeps its cancellation lock", () => {
    vrm.currentModal.type = "upload";
    vrm.disableCancel = true;
    render();
    expect(button("Close avatar and settings").disabled).toBe(true);
    expect(button("Back to avatars").disabled).toBe(true);
    key(container.querySelector("input"), "Escape");
    expect(vrm.onCancel).not.toHaveBeenCalled();
    expect(panel.setCurrentTab).not.toHaveBeenCalled();
});

test.each([
    ["IME composition", { isComposing: true }],
    ["legacy IME composition", { keyCode: 229 }],
    ["a held key", { repeat: true }],
    ["Alt", { altKey: true }],
    ["Control", { ctrlKey: true }],
    ["Meta", { metaKey: true }],
    ["Shift", { shiftKey: true }],
])("Escape during %s does not cancel an avatar edit", (_name, flags) => {
    vrm.currentModal.type = "upload";
    render();
    const event = new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
        ...flags,
    });
    act(() => container.querySelector("input").dispatchEvent(event));
    expect(event.defaultPrevented).toBe(false);
    expect(vrm.onCancel).not.toHaveBeenCalled();
    expect(panel.setCurrentTab).not.toHaveBeenCalled();
});
