/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import Settings from "./index";
import { usePanel } from "../context/PanelProvider";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { useCyberTranslation } from "@components/context/I18nContext";

jest.mock("../context/PanelProvider", () => ({ usePanel: jest.fn() }));
jest.mock("@components/_3DExhibit-v2/hooks/useWorld", () => ({
    useWorld: jest.fn(),
}));
jest.mock("@components/context/I18nContext", () => ({
    useCyberTranslation: jest.fn(),
}));
jest.mock("@components/_3DExhibit-v2/context/MultiplayerProvider", () => ({
    useMultiplayer: () => ({ mode: "multiplayer", room: {} }),
}));
jest.mock("@components/_3DExhibit-v2/three/constants", () => ({
    IS_MOBILE: true,
}));
jest.mock("@utils/analytics", () => ({
    amplitude_logAnalyticsEvent: jest.fn(),
    amplitude_setIndetity: jest.fn(),
}));
jest.mock("@ui/components/IconImg", () => ({
    __esModule: true,
    default: () => <span />,
}));
jest.mock("@components/Spinner", () => ({
    __esModule: true,
    default: () => <span />,
}));

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let panel: any;
let switchI18n: jest.Mock;
let enableAdjustCamera: jest.Mock;
const clickText = (label: string) =>
    act(() =>
        [...container.querySelectorAll<HTMLButtonElement>("button")]
            .find((button) => button.textContent.includes(label))
            .click()
    );
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    panel = {
        settings: {
            quality: "medium",
            camera: "third_person",
            adjustCamera: "auto",
            joystick: "left",
        },
        handleSettings: jest.fn(),
        settingsLoading: false,
    };
    switchI18n = jest.fn();
    enableAdjustCamera = jest.fn();
    (usePanel as jest.Mock).mockReturnValue(panel);
    (useWorld as jest.Mock).mockReturnValue({
        current: { enableAdjustCamera },
    });
    (useCyberTranslation as jest.Mock).mockReturnValue({
        t: (text) => String(text),
        i18n: "en",
        switchI18n,
    });
    act(() => root.render(<Settings />));
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.clearAllMocks();
});

test("quality cards retain native setting values and expose selected state", () => {
    const selected = container.querySelector(
        '[aria-label="GRAPHICS_QUALITY"] [aria-pressed="true"]'
    );
    expect(selected.textContent).toContain("OPTIMAL_QUALITY_TITLE");
    clickText("HIGH_QUALITY_TITLE");
    expect(panel.handleSettings).toHaveBeenCalledWith("quality", "high");
});

test("language buttons have explicit names and retain locale selection", () => {
    act(() =>
        container
            .querySelector<HTMLButtonElement>('[aria-label="日本語"]')
            .click()
    );
    expect(switchI18n).toHaveBeenCalledWith("ja");
    expect(
        container
            .querySelector('[aria-label="English"]')
            .getAttribute("aria-pressed")
    ).toBe("true");
});

test("camera controls retain first and third person settings", () => {
    clickText("FIRST_PERSON");
    expect(panel.handleSettings).toHaveBeenCalledWith("camera", "first_person");
    clickText("THIRD_PERSON");
    expect(panel.handleSettings).toHaveBeenCalledWith("camera", "third_person");
});

test("mobile controls preserve camera adjustment and joystick actions", () => {
    clickText("MANUAL");
    expect(enableAdjustCamera).toHaveBeenCalledWith(false);
    expect(panel.handleSettings).toHaveBeenCalledWith("adjustCamera", "manual");
    clickText("RIGHT");
    expect(panel.handleSettings).toHaveBeenCalledWith("joystick", "right");
});

test.each([null, "en-US", "unsupported"])(
    "language selection matches rendered English when locale is %s",
    (i18n) => {
        (useCyberTranslation as jest.Mock).mockReturnValue({
            t: (text) => String(text),
            i18n,
            switchI18n,
        });
        act(() => root.render(<Settings />));
        expect(
            container
                .querySelector('[aria-label="English"]')
                .getAttribute("aria-pressed")
        ).toBe("true");
        expect(switchI18n).not.toHaveBeenCalled();
    }
);
