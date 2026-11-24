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
const render = (
    selectedId = "pepe",
    choices = items,
    loading = false,
    extra: Partial<React.ComponentProps<typeof AvatarCarousel>> = {}
) =>
    act(() =>
        root.render(
            <AvatarCarousel
                items={choices}
                selectedId={selectedId}
                onSelect={onSelect}
                onClose={onClose}
                loading={loading}
                {...extra}
            />
        )
    );
const tab = (name: string) =>
    Array.from(
        container.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    ).find((element) => element.textContent.startsWith(name));
const shown = () =>
    Array.from(container.querySelectorAll('[role="option"]')).map((element) =>
        element.getAttribute("aria-label")
    );
const gateway = "https://cyber.mypinata.cloud/ipfs";
const mine: LobbyAvatarChoice[] = [
    {
        id: "upload",
        name: "My upload",
        url: "/upload.vrm",
        img: `${gateway}/QmUpload?filename=me.png`,
        owned: true,
    },
    { id: "nft", name: "Wallet one", url: "/nft.vrm", owned: true },
];
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
    expect(container.querySelector("img").getAttribute("loading")).toBe(
        "eager"
    );
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
    expect(
        container.querySelector('[role="option"][aria-selected="true"]')
    ).toBeNull();
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

test("free and owned avatars sit on their own tabs, opening on the one being worn", () => {
    render("pepe", [...mine, ...items]);
    expect(tab("Free").getAttribute("aria-selected")).toBe("true");
    expect(tab("Owned").getAttribute("aria-selected")).toBe("false");
    // Two plain labels, nothing else in the switch.
    expect(
        Array.from(container.querySelectorAll('[role="tab"]')).map(
            (element) => element.textContent
        )
    ).toEqual(["Free", "Owned"]);
    expect(shown()).toEqual(items.map((item) => item.name));
    focused("Roller Pepe");
    const panel = container.querySelector('[role="tabpanel"]');
    expect(panel.getAttribute("aria-labelledby")).toBe(tab("Free").id);
    expect(tab("Free").getAttribute("aria-controls")).toBe(panel.id);

    act(() => root.unmount());
    root = createRoot(container);
    render("nft", [...mine, ...items]);
    expect(tab("Owned").getAttribute("aria-selected")).toBe("true");
    expect(shown()).toEqual(["My upload", "Wallet one"]);
    focused("Wallet one");
    expect(onSelect).not.toHaveBeenCalled();
    // A handful reads left to right on one row; the catalog keeps two.
    expect(strip().style.getPropertyValue("--avatar-rows")).toBe("1");
    click(tab("Free"));
    expect(strip().style.getPropertyValue("--avatar-rows")).toBe("");
});

test("switching tabs browses without choosing, and keeps the keyboard on the tabs", () => {
    render("pepe", [...mine, ...items]);
    act(() => tab("Free").focus());
    const heard = jest.fn();
    document.addEventListener("keydown", heard);
    const right = key(tab("Free"), "ArrowRight");
    // The world behind the picker walks on arrow keys; it must not hear this.
    expect(right.defaultPrevented).toBe(true);
    expect(heard).not.toHaveBeenCalled();
    document.removeEventListener("keydown", heard);
    expect(tab("Owned").getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(tab("Owned"));
    expect(tab("Owned").tabIndex).toBe(0);
    expect(tab("Free").tabIndex).toBe(-1);
    expect(shown()).toEqual(["My upload", "Wallet one"]);
    expect(
        container.querySelector('[aria-selected="true"][role="option"]')
    ).toBeNull();
    // The footer still names the avatar being worn.
    expect(container.querySelector('[role="status"]').textContent).toBe(
        "Roller Pepe · 2 avatars"
    );

    // Down steps into the cards; a click chooses one.
    key(tab("Owned"), "ArrowDown");
    expect(document.activeElement).toBe(card("My upload"));
    key(tab("Owned"), "Home");
    expect(tab("Free").getAttribute("aria-selected")).toBe("true");
    key(tab("Free"), "ArrowLeft");
    expect(tab("Owned").getAttribute("aria-selected")).toBe("true");
    expect(onSelect).not.toHaveBeenCalled();
    click(card("Wallet one"));
    expect(onSelect).toHaveBeenCalledWith(mine[1]);

    click(tab("Free"));
    expect(shown()).toEqual(items.map((item) => item.name));
    const escape = key(tab("Free"), "Escape");
    expect(escape.defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
});

test("a wallet avatar that loads late brings its tab forward, unless the visitor chose one", () => {
    // The worn avatar is in the wallet, which has not answered yet.
    render("nft", items, false, { ownedLoading: true });
    expect(tab("Free").getAttribute("aria-selected")).toBe("true");
    render("nft", [...mine, ...items]);
    expect(tab("Owned").getAttribute("aria-selected")).toBe("true");
    focused("Wallet one");

    act(() => root.unmount());
    root = createRoot(container);
    render("nft", items, false, { ownedLoading: true });
    click(tab("Free"));
    render("nft", [...mine, ...items]);
    expect(tab("Free").getAttribute("aria-selected")).toBe("true");
});

test("an empty owned tab says why, and says so while the wallet is read", () => {
    render("pepe", items, false, { ownedLoading: true });
    click(tab("Owned"));
    const panel = container.querySelector('[role="tabpanel"]');
    expect(panel.querySelector(".avatar-empty").textContent).toBe(
        "Finding your avatars…"
    );
    expect(strip().hidden).toBe(true);
    render("pepe", items, false, { ownedHint: "Sign in to see yours." });
    expect(panel.querySelector(".avatar-empty").textContent).toBe(
        "Sign in to see yours."
    );
    expect(button("Next avatars").disabled).toBe(true);
    click(tab("Free"));
    expect(panel.querySelector(".avatar-empty")).toBeNull();
    expect(strip().hidden).toBe(false);
});

test("pictures come at card size, the first screens at once, with the original as a fallback", () => {
    const many: LobbyAvatarChoice[] = Array.from({ length: 40 }, (_, i) => ({
        id: `a${i}`,
        name: `Avatar ${i}`,
        url: `/a${i}.vrm`,
        img: `${gateway}/Qm${i}?filename=a${i}.png`,
    }));
    render("a0", many);
    const picture = (name: string) => card(name).querySelector("img");
    const first = new URL(picture("Avatar 0").src);
    expect(first.searchParams.get("img-width")).toBe("288");
    expect(first.searchParams.get("img-format")).toBe("webp");
    expect(picture("Avatar 0").getAttribute("loading")).toBe("eager");
    expect(picture("Avatar 0").getAttribute("fetchpriority")).toBe("high");
    expect(picture("Avatar 13").getAttribute("fetchpriority")).toBe("high");
    expect(picture("Avatar 14").getAttribute("loading")).toBe("eager");
    expect(picture("Avatar 14").hasAttribute("fetchpriority")).toBe(false);
    expect(picture("Avatar 28").getAttribute("loading")).toBe("lazy");

    // The host would not resize it: the original is tried, then the initial.
    act(() => picture("Avatar 0").dispatchEvent(new Event("error")));
    expect(picture("Avatar 0").src).toBe(many[0].img);
    act(() => picture("Avatar 0").dispatchEvent(new Event("error")));
    expect(picture("Avatar 0")).toBeNull();
    expect(card("Avatar 0").querySelector(".initial").textContent).toBe("A");

    // A picture shows once it has arrived.
    expect(picture("Avatar 1").dataset.loaded).toBe("false");
    act(() => picture("Avatar 1").dispatchEvent(new Event("load")));
    expect(picture("Avatar 1").dataset.loaded).toBe("true");
});

test("the other tab's first pictures are fetched before it is opened", () => {
    const asked: string[] = [];
    const RealImage = globalThis.Image;
    (globalThis as any).Image = class {
        decoding = "";
        set src(value: string) {
            asked.push(value);
        }
    };
    try {
        const unseen = {
            ...mine[0],
            img: `${gateway}/QmUnseen?filename=me.png`,
        };
        render("pepe", [unseen, mine[1], ...items]);
        expect(asked).toHaveLength(1);
        expect(asked[0]).toContain("/QmUnseen?");
        expect(asked[0]).toContain("img-width=288");
    } finally {
        globalThis.Image = RealImage;
    }
});

test("a click away from the picker closes it; a click inside or a drag in the world does not", () => {
    render("pepe", [...mine, ...items]);
    const world = document.createElement("canvas");
    document.body.append(world);
    const at = (target: Element, type: string, x: number, y: number) => {
        const event = new MouseEvent(type, {
            clientX: x,
            clientY: y,
            bubbles: true,
        });
        act(() => target.dispatchEvent(event));
    };
    // Inside: a card, a label and the search field.
    click(tab("Owned"));
    click(card("My upload"));
    click(container.querySelector('input[type="search"]'));
    expect(onClose).not.toHaveBeenCalled();
    // Turning the avatar or the camera: the pointer travels before release.
    at(world, "pointerdown", 100, 100);
    at(world, "click", 260, 120);
    expect(onClose).not.toHaveBeenCalled();
    // A click on the world.
    at(world, "pointerdown", 100, 100);
    at(world, "click", 102, 101);
    expect(onClose).toHaveBeenCalledTimes(1);
    world.remove();
});

test("the gaps between cards count as the picker, not as a click away", () => {
    render("pepe", items);
    const box = container.querySelector(".avatar-picker");
    jest.spyOn(box, "getBoundingClientRect").mockReturnValue({
        left: 300,
        right: 900,
        top: 400,
        bottom: 740,
        width: 600,
        height: 340,
    } as DOMRect);
    const press = (x: number, y: number) =>
        act(() =>
            document.body.dispatchEvent(
                new MouseEvent("click", {
                    clientX: x,
                    clientY: y,
                    bubbles: true,
                })
            )
        );
    press(600, 500);
    expect(onClose).not.toHaveBeenCalled();
    press(600, 200);
    expect(onClose).toHaveBeenCalledTimes(1);
});

test("search narrows the open tab by name and says what the other tab holds", () => {
    render("pepe", [...mine, ...items]);
    const field = container.querySelector<HTMLInputElement>(
        'input[type="search"]'
    );
    const type = (text: string) =>
        act(() => {
            Object.getOwnPropertyDescriptor(
                HTMLInputElement.prototype,
                "value"
            ).set.call(field, text);
            field.dispatchEvent(new Event("input", { bubbles: true }));
        });
    expect(field.placeholder).toBe("Search avatars…");
    // "/" from the cards moves to the field without typing a slash.
    const slash = key(card("Roller Pepe"), "/");
    expect(slash.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(field);

    type("  ro");
    expect(shown()).toEqual(["Roller Pepe", "Robot", "Astronaut"]);
    // Typing keeps the keyboard in the field and chooses nothing.
    expect(document.activeElement).toBe(field);
    expect(onSelect).not.toHaveBeenCalled();
    expect(container.querySelector('[role="status"]').textContent).toBe(
        "Roller Pepe · 3 avatars"
    );

    type("wallet");
    expect(shown()).toEqual([]);
    expect(container.querySelector(".avatar-empty").textContent).toBe(
        "No free avatars match “wallet”. 1 in Owned."
    );
    click(tab("Owned"));
    expect(shown()).toEqual(["Wallet one"]);

    // Down steps into the results; Escape empties the field before it
    // closes the picker.
    key(field, "ArrowDown");
    expect(document.activeElement).toBe(card("Wallet one"));
    act(() => field.focus());
    const first = key(field, "Escape");
    expect(first.defaultPrevented).toBe(true);
    expect(field.value).toBe("");
    expect(onClose).not.toHaveBeenCalled();
    expect(shown()).toEqual(["My upload", "Wallet one"]);
    key(field, "Escape");
    expect(onClose).toHaveBeenCalledTimes(1);

    type("zzz");
    expect(container.querySelector(".avatar-empty").textContent).toBe(
        "No owned avatars match “zzz”."
    );
    click(button("Clear avatar search"));
    expect(field.value).toBe("");
    expect(document.activeElement).toBe(field);
});
