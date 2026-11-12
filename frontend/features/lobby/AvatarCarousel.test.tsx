/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import AvatarCarousel, { LobbyAvatarChoice } from "./AvatarCarousel";

const items: LobbyAvatarChoice[] = [
    { id: "summer", name: "Summer", url: "/summer.glb", img: "/summer.png" },
    { id: "pepe", name: "Roller Pepe", url: "/pepe.glb", img: "/pepe.png" },
    { id: "square", name: "Square", url: "/square.glb" },
    { id: "ghost", name: "Ghost", url: "/ghost.glb" },
    { id: "robot", name: "Robot", url: "/robot.glb" },
    { id: "cat", name: "Cat", url: "/cat.glb" },
    { id: "astronaut", name: "Astronaut", url: "/astronaut.glb" },
];
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let onSelect: jest.Mock;
let onClose: jest.Mock;
let scrollTo: jest.Mock;
let reducedMotion: boolean;
let singleRow: boolean;
const card = (name: string) =>
    container.querySelector<HTMLButtonElement>(
        `[role="option"][aria-label="${name}"]`
    );
const button = (name: string) =>
    container.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`);
const strip = () => container.querySelector<HTMLDivElement>('[role="listbox"]');
const click = (target: Element) =>
    act(() => target.dispatchEvent(new MouseEvent("click", { bubbles: true })));
const key = (
    target: Element,
    value: string,
    options: KeyboardEventInit = {}
) => {
    const event = new KeyboardEvent("keydown", {
        key: value,
        bubbles: true,
        cancelable: true,
        ...options,
    });
    act(() => target.dispatchEvent(event));
    return event;
};
const render = (selectedId = "pepe", choices = items, loading = false) =>
    act(() =>
        root.render(
            <AvatarCarousel
                items={choices}
                selectedId={selectedId}
                onSelect={onSelect}
                onClose={onClose}
                loading={loading}
            />
        )
    );
const focused = (name: string) => {
    expect(document.activeElement).toBe(card(name));
    expect(card(name).tabIndex).toBe(0);
    expect(
        container.querySelectorAll('[role="option"][tabindex="0"]')
    ).toHaveLength(1);
};
const pointer = (type: string, x: number) => {
    const event = new MouseEvent(type, {
        clientX: x,
        button: 0,
        buttons: type === "pointerup" ? 0 : 1,
        bubbles: true,
        cancelable: true,
    });
    Object.defineProperties(event, {
        pointerId: { value: 1 },
        pointerType: { value: "mouse" },
    });
    act(() => strip().dispatchEvent(event));
};

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    onSelect = jest.fn();
    onClose = jest.fn();
    reducedMotion = singleRow = false;
    scrollTo = jest.fn(function (options) {
        this.scrollLeft = Math.max(
            0,
            Math.min(options.left, this.scrollWidth - this.clientWidth)
        );
        this.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    HTMLElement.prototype.scrollTo = scrollTo;
    jest.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(
        400
    );
    jest.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(
        1200
    );
    jest.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(
        140
    );
    jest.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(
        function () {
            const index = Array.from(
                container.querySelectorAll(".avatar-card")
            ).indexOf(this);
            return index < 0
                ? 0
                : Math.floor(index / (singleRow ? 1 : 2)) * 154;
        }
    );
    const computedStyle = window.getComputedStyle.bind(window);
    jest.spyOn(window, "getComputedStyle").mockImplementation((element) => {
        const style = computedStyle(element);
        const property = style.getPropertyValue.bind(style);
        style.getPropertyValue = (name) =>
            name === "--avatar-rows"
                ? String(singleRow ? 1 : 2)
                : property(name);
        return style;
    });
    window.matchMedia = jest.fn((query: string) => ({
        matches: query.includes("prefers-reduced-motion")
            ? reducedMotion
            : singleRow,
        media: query,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
    })) as any;
    (globalThis as any).ResizeObserver = class {
        observe = jest.fn();
        disconnect = jest.fn();
    };
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.restoreAllMocks();
    jest.useRealTimers();
});

test("focuses the selected avatar; clicking the last card selects it directly without traversing other avatars", () => {
    render();
    focused("Roller Pepe");
    expect(card("Roller Pepe").getAttribute("aria-selected")).toBe("true");
    click(card("Astronaut"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(items[6]);
    expect(onClose).not.toHaveBeenCalled();
    focused("Astronaut");
    expect(card("Astronaut").getAttribute("aria-selected")).toBe("true");
    expect(card("Roller Pepe").getAttribute("aria-selected")).toBe("false");
    expect(container.querySelector("img").getAttribute("loading")).toBe("lazy");
});

test("two-row arrows move roving focus within columns and across columns without selecting", () => {
    render();
    key(card("Roller Pepe"), "ArrowUp");
    focused("Summer");
    key(card("Summer"), "ArrowUp");
    focused("Summer");
    key(card("Summer"), "ArrowDown");
    focused("Roller Pepe");
    key(card("Roller Pepe"), "ArrowDown");
    focused("Roller Pepe");
    key(card("Roller Pepe"), "ArrowLeft");
    focused("Roller Pepe");
    key(card("Roller Pepe"), "ArrowRight");
    focused("Ghost");
    key(card("Ghost"), "ArrowRight");
    focused("Cat");
    key(card("Cat"), "ArrowLeft");
    focused("Ghost");
    key(card("Ghost"), "Home");
    focused("Summer");
    key(card("Summer"), "End");
    focused("Astronaut");
    key(card("Astronaut"), "ArrowDown");
    focused("Astronaut");
    key(card("Astronaut"), "ArrowRight");
    focused("Astronaut");
    key(card("Astronaut"), "ArrowLeft");
    focused("Robot");
    expect(onSelect).not.toHaveBeenCalled();
    expect(card("Roller Pepe").getAttribute("aria-selected")).toBe("true");
    expect(card("Robot").getAttribute("aria-selected")).toBe("false");
});

test("Enter and Space select only the focused card, leaving the picker open", () => {
    render();
    key(card("Roller Pepe"), "End");
    key(card("Astronaut"), "Enter");
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenLastCalledWith(items[6]);
    key(card("Astronaut"), "Home");
    expect(key(card("Summer"), " ").defaultPrevented).toBe(true);
    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(onSelect).toHaveBeenLastCalledWith(items[0]);
    expect(onClose).not.toHaveBeenCalled();
    expect(card("Summer").getAttribute("aria-selected")).toBe("true");
});

test("keyboard navigation follows the rendered row count", () => {
    singleRow = true;
    render();
    key(card("Roller Pepe"), "ArrowRight");
    focused("Square");
    key(card("Square"), "ArrowDown");
    focused("Square");
    key(card("Square"), "ArrowUp");
    focused("Square");
    key(card("Square"), "ArrowLeft");
    focused("Roller Pepe");
    expect(onSelect).not.toHaveBeenCalled();
});

test("page arrows scroll the catalog without choosing or loading any avatar", () => {
    jest.useFakeTimers();
    render();
    act(() => jest.advanceTimersByTime(16));
    scrollTo.mockClear();
    expect(button("Next avatars").disabled).toBe(false);
    click(button("Next avatars"));
    expect(scrollTo).toHaveBeenCalledWith(
        expect.objectContaining({ behavior: "smooth" })
    );
    expect(strip().scrollLeft).toBeGreaterThan(0);
    expect(onSelect).not.toHaveBeenCalled();
    expect(card("Roller Pepe").getAttribute("aria-selected")).toBe("true");
    const afterNext = strip().scrollLeft;
    act(() => jest.advanceTimersByTime(16));
    expect(button("Previous avatars").disabled).toBe(false);
    click(button("Previous avatars"));
    expect(strip().scrollLeft).toBeLessThan(afterNext);
    act(() => jest.advanceTimersByTime(16));
    expect(button("Previous avatars").disabled).toBe(true);
    act(() => {
        strip().scrollLeft = strip().scrollWidth - strip().clientWidth;
        strip().dispatchEvent(new Event("scroll", { bubbles: true }));
        jest.advanceTimersByTime(16);
    });
    expect(button("Next avatars").disabled).toBe(true);
    expect(button("Previous avatars").disabled).toBe(false);
    expect(onSelect).not.toHaveBeenCalled();
});

test("touch scrolling and wheel browsing never select the card that settles in view", () => {
    jest.useFakeTimers();
    render();
    act(() => {
        strip().dispatchEvent(new Event("touchstart", { bubbles: true }));
        strip().scrollLeft = 400;
        strip().dispatchEvent(new Event("scroll", { bubbles: true }));
        strip().dispatchEvent(new Event("touchend", { bubbles: true }));
        jest.advanceTimersByTime(1000);
    });
    expect(onSelect).not.toHaveBeenCalled();
    const wheel = new WheelEvent("wheel", {
        deltaY: 80,
        bubbles: true,
        cancelable: true,
    });
    act(() => strip().dispatchEvent(wheel));
    expect(wheel.defaultPrevented).toBe(true);
    expect(strip().scrollLeft).toBe(480);
    act(() => jest.advanceTimersByTime(1000));
    expect(onSelect).not.toHaveBeenCalled();
    expect(card("Roller Pepe").getAttribute("aria-selected")).toBe("true");
});

test("mouse drag suppresses its release click, and a subsequent deliberate click can select", () => {
    render();
    act(() => {
        strip().scrollLeft = 0;
    });
    pointer("pointerdown", 300);
    pointer("pointermove", 180);
    expect(strip().scrollLeft).toBe(120);
    pointer("pointerup", 180);
    click(card("Summer"));
    expect(onSelect).not.toHaveBeenCalled();
    pointer("pointerdown", 180);
    pointer("pointerup", 180);
    click(card("Summer"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(items[0]);
});

test("a changed account avatar regains focus and reduced motion avoids animated scrolling", () => {
    render();
    reducedMotion = true;
    render("astronaut", items, true);
    focused("Astronaut");
    expect(onSelect).not.toHaveBeenCalled();
    expect(container.querySelector('[role="status"]').textContent).toBe(
        "Loading avatar…"
    );
    expect(scrollTo).toHaveBeenLastCalledWith(
        expect.objectContaining({ behavior: "auto" })
    );
    scrollTo.mockClear();
    click(button("Next avatars"));
    expect(scrollTo).toHaveBeenLastCalledWith(
        expect.objectContaining({ behavior: "auto" })
    );
    expect(onSelect).not.toHaveBeenCalled();
});

test("a custom avatar and an empty catalog remain usable without selecting a fallback", () => {
    render("custom");
    focused("Summer");
    expect(container.querySelector('[aria-selected="true"]')).toBeNull();
    expect(onSelect).not.toHaveBeenCalled();
    click(card("Summer"));
    expect(onSelect).toHaveBeenCalledWith(items[0]);
    render("custom", []);
    expect(document.activeElement).toBe(button("Close avatars"));
    expect(button("Next avatars").disabled).toBe(true);
    expect(button("Previous avatars").disabled).toBe(true);
    click(button("Close avatars"));
    expect(onClose).toHaveBeenCalledTimes(1);
});

test("IME composition and modified shortcuts do not navigate, select, or close the picker", () => {
    render();
    key(card("Roller Pepe"), "Escape", { isComposing: true });
    key(card("Roller Pepe"), "Enter", { isComposing: true });
    const legacyImeEscape = new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
    });
    Object.defineProperty(legacyImeEscape, "keyCode", { value: 229 });
    act(() => card("Roller Pepe").dispatchEvent(legacyImeEscape));
    key(card("Roller Pepe"), "ArrowRight", { ctrlKey: true });
    key(card("Roller Pepe"), "End", { altKey: true });
    focused("Roller Pepe");
    expect(onSelect).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    const escape = key(card("Roller Pepe"), "Escape");
    expect(escape.defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
    click(button("Close avatars"));
    expect(onClose).toHaveBeenCalledTimes(2);
});
