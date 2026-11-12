/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import ExtraBtn from "./ExtraBtn";
import { usePanel } from "../../context/PanelProvider";
import { useMultiplayer } from "@components/_3DExhibit-v2/context/MultiplayerProvider";

jest.mock("@components/_3DExhibit-v2/three/constants", () => ({
    IS_MOBILE: false,
}));
jest.mock("../../context/PanelProvider", () => ({ usePanel: jest.fn() }));
jest.mock("@components/_3DExhibit-v2/context/MultiplayerProvider", () => ({
    useMultiplayer: jest.fn(),
}));

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let panel: {
    currentTab: string;
    setCurrentTab: jest.Mock;
    addTogglerRef: jest.Mock;
};
const render = () => act(() => root.render(<ExtraBtn />));
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    panel = {
        currentTab: "",
        setCurrentTab: jest.fn(),
        addTogglerRef: jest.fn(),
    };
    (usePanel as jest.Mock).mockReturnValue(panel);
    (useMultiplayer as jest.Mock).mockReturnValue({
        voice: { hasNewVoiceRequests: false },
    });
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.clearAllMocks();
});

test("virtual-tour More uses the shared mask while preserving the legacy menu interaction", () => {
    render();
    const button = container.querySelector<HTMLButtonElement>(
        'button[aria-label="More"]'
    );
    const icon = button.querySelector<HTMLElement>(".experience-control-icon");
    expect(icon.style.maskImage).toContain("/icons/generated-v2/more.png");
    expect(icon.style.width).toBe("22px");
    expect(button.querySelector("img")).toBeNull();
    expect(button.getAttribute("aria-expanded")).toBe("false");
    act(() =>
        button.parentElement.dispatchEvent(
            new MouseEvent("mouseover", { bubbles: true })
        )
    );
    let next: string;
    act(() => {
        next = panel.setCurrentTab.mock.calls[0][0]("");
    });
    expect(next).toBe("dashboard");
    expect(panel.addTogglerRef).toHaveBeenCalledWith(
        "dashboard",
        button.parentElement
    );
});

test("the generated mask keeps contrast on the legacy white selected button", () => {
    panel.currentTab = "dashboard";
    render();
    const button = container.querySelector<HTMLButtonElement>(
        'button[aria-label="More"]'
    );
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.style.color).toBe("rgb(23, 25, 30)");
    panel.currentTab = "";
    render();
    expect(button.style.color).toBe("rgb(232, 233, 236)");
});
