/** @jest-environment jsdom */
import React, { act, createRef } from "react";
import { createRoot } from "react-dom/client";
import LobbyArrivalStatus, {
    LobbyArrivalStatusProps,
} from "./LobbyArrivalStatus";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let onCancel: jest.Mock;
const ref = createRef<HTMLDivElement>();
const render = (props: Partial<LobbyArrivalStatusProps> = {}) =>
    act(() =>
        root.render(
            <LobbyArrivalStatus
                ref={ref}
                worldName="A quiet place on the moon"
                phase="loading"
                onCancel={onCancel}
                {...props}
            />
        )
    );

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    onCancel = jest.fn();
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

test("retains a focus target and an explicit cancel action throughout arrival", () => {
    render();
    const overlay = container.querySelector(
        '[aria-label="Travelling to your world"]'
    );
    expect(ref.current).toBe(overlay);
    act(() => ref.current.focus({ preventScroll: true }));
    expect(document.activeElement).toBe(overlay);
    expect(onCancel).not.toHaveBeenCalled();
    const cancel = container.querySelector("button");
    expect(cancel.type).toBe("button");
    expect(cancel.getAttribute("aria-keyshortcuts")).toBe("Escape");
    act(() => cancel.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(onCancel).toHaveBeenCalledTimes(1);
});

test("announces the destination and actual travel stage without claiming the world is already ready", () => {
    const state = () => container.querySelector('[role="status"]');
    render();
    expect(state().textContent).toContain("A quiet place on the moon");
    expect(state().textContent).toContain("Transporting you…");
    expect(state().getAttribute("aria-atomic")).toBe("true");
    render({ phase: "entering", admitted: true });
    expect(state().textContent).toContain("Preparing arrival");
    render({ phase: "revealing", admitted: true });
    expect(state().textContent).toContain("Arriving");
    render({ worldName: "Lobby", phase: "returning", admitted: true });
    expect(state().textContent).toBe("LobbyWelcome back");
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(1);
    expect(onCancel).not.toHaveBeenCalled();
});

test("keeps full long destination names accessible and supplies a missing-title fallback", () => {
    const title =
        "A destination with a long title that still needs its complete accessible name";
    render({ worldName: title });
    expect(container.querySelector("strong").textContent).toBe(title);
    expect(container.querySelector("strong").title).toBe(title);
    render({ worldName: " " });
    expect(container.querySelector("strong").textContent).toBe("Your world");
});

test("travel text is never drawn: one live announcement for assistive technology, and Cancel", () => {
    render();
    const overlay = container.querySelector(
        '[aria-label="Travelling to your world"]'
    );
    const status = container.querySelector<HTMLElement>('[role="status"]');
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(1);
    expect(status.textContent).toContain("A quiet place on the moon");
    expect(status.hasAttribute("aria-hidden")).toBe(false);
    expect(status.hidden).toBe(false);
    expect(getComputedStyle(status).clipPath).toBe("inset(50%)");
    const cancel = container.querySelector("button");
    act(() => cancel.focus());
    expect(document.activeElement).toBe(cancel);
    // The 3D scene draws no text either, so nothing here depends on it: the
    // retired floor flag is accepted and ignored.
    render({ floorStatusVisible: true });
    expect(overlay.hasAttribute("data-floor-visible")).toBe(false);
    expect(getComputedStyle(status).clipPath).toBe("inset(50%)");
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(1);
});
