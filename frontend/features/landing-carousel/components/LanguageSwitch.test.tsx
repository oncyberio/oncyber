/** @jest-environment jsdom */
import React from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import LanguageSwitch from "./LanguageSwitch";
import I18nProvider from "@components/context/I18nContext";

const act = (React as any).act;
(global as any).IS_REACT_ACT_ENVIRONMENT = true;
jest.mock("next/router", () => ({ useRouter: () => ({ query: {} }) }));
jest.mock("@utils/analytics", () => ({
    amplitude_logAnalyticsEvent: jest.fn(),
}));

let root: ReturnType<typeof createRoot>, container: HTMLDivElement;
beforeEach(() => {
    localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() =>
        root.render(
            <I18nProvider>
                <LanguageSwitch />
            </I18nProvider>
        )
    );
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

const toggle = () =>
    container.querySelector<HTMLButtonElement>(".language-button");
const items = () => [
    ...container.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'),
];

test("opens a menu with a check on the current language", () => {
    expect(toggle().textContent).toBe("EN");
    act(() => toggle().click());
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    // The current language has a check; the others show their code.
    expect(items().map((item) => item.textContent)).toEqual([
        "English",
        "EspañolES",
        "日本語JA",
        "한국어KO",
        "中文ZH",
    ]);
    expect(items()[0].getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(items()[0]);
});

test("arrow keys move, a choice switches and Escape returns focus", () => {
    act(() => toggle().click());
    act(() => Simulate.keyDown(items()[0], { key: "ArrowDown" }));
    expect(document.activeElement).toBe(items()[1]);
    act(() => items()[1].click());
    expect(toggle().textContent).toBe("ES");
    expect(localStorage.getItem("i18n")).toBe("es");
    expect(container.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(toggle());

    act(() => toggle().click());
    act(() => Simulate.keyDown(items()[0], { key: "Escape" }));
    expect(container.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(toggle());
});
