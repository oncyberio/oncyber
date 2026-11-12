/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import BottomSearch from "./BottomSearch";
import DiscoveryHeader from "./DiscoveryHeader";

jest.mock("./Header", () => ({
    __esModule: true,
    default: ({ menu, search, immersive }) => (
        <header>
            {!immersive && (
                <>
                    {menu}
                    {search}
                </>
            )}
        </header>
    ),
}));
jest.mock("@components/InAppLink", () => ({
    __esModule: true,
    default: require("react").forwardRef((props, ref) => (
        <a {...props} ref={ref} />
    )),
}));
const mockPush = jest.fn();
const mockRouter: any = { pathname: "/", query: {} };
jest.mock("next/router", () => ({
    useRouter: () => ({ ...mockRouter, push: mockPush }),
}));
jest.mock("@components/context/UserContext", () => ({
    UserContext: require("react").createContext({}),
}));
jest.mock("../data", () => ({
    FEED_CATEGORIES: [
        { value: "most-visited", label: "Popular" },
        { value: "latest", label: "Latest" },
        { value: "staff", label: "Staff picks" },
        { value: "oncyberlabs", label: "Oncyber Labs" },
    ],
}));
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const filters: any = {
    q: "",
    category: "most-visited",
    chain: "",
    owner: "",
    collection: "",
};
const update = jest.fn();
const searchChange = jest.fn();
const render = (props: any = {}) =>
    act(() =>
        root.render(
            <>
                <DiscoveryHeader
                    filters={filters}
                    update={update}
                    createControl={<button>Create +</button>}
                    {...props}
                />
                <BottomSearch
                    value={(props.filters || filters).q}
                    scope={props.templates ? "templates" : "worlds"}
                    onSearch={searchChange}
                    onChange={searchChange}
                />
                <input aria-label="Other input" />
                <textarea aria-label="Other text" />
                <div contentEditable aria-label="Other editor" />
            </>
        )
    );
const search = () =>
    container.querySelector<HTMLInputElement>("#landing-search");
const menu = () => container.querySelector<HTMLElement>('[role="dialog"]');
const input = () => menu()?.querySelector<HTMLInputElement>("input");
const options = () =>
    Array.from(menu()?.querySelectorAll<HTMLElement>('[role="option"]') || []);
const active = () =>
    document.getElementById(input()?.getAttribute("aria-activedescendant"));
const label = (el: HTMLElement) => el?.querySelector(".label")?.textContent;
const checked = () =>
    menu()?.querySelector<HTMLElement>('[data-checked="true"]');
const filterOptions = () =>
    options().filter((el) => sectionOf(el).startsWith("Filter"));
function sectionOf(el: HTMLElement) {
    let node = el.previousElementSibling;
    while (node && !node.classList.contains("command-section"))
        node = node.previousElementSibling;
    return node?.textContent || "";
}
function type(value: string) {
    const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
    ).set;
    act(() => {
        setter.call(input(), value);
        input().dispatchEvent(new Event("input", { bubbles: true }));
    });
}
function key(
    target: HTMLElement,
    value: string,
    options: KeyboardEventInit = {}
) {
    const event = new KeyboardEvent("keydown", {
        key: value,
        bubbles: true,
        cancelable: true,
        ...options,
    });
    act(() => target.dispatchEvent(event));
    return event;
}
function beforeInput(target: HTMLElement, options: InputEventInit = {}) {
    const event = new InputEvent("beforeinput", {
        data: "/",
        inputType: "insertText",
        bubbles: true,
        cancelable: true,
        ...options,
    });
    act(() => target.dispatchEvent(event));
    return event;
}
function openMenu() {
    act(() => search().focus());
    return key(search(), "/");
}
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.clearAllMocks();
    mockRouter.pathname = "/";
    mockRouter.query = {};
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

test("Create occupies the header and the menu starts closed", () => {
    render();
    expect(container.querySelector("header").textContent).toBe("Create +");
    expect(menu()).toBeNull();
});

test.each(["inside search", "outside inputs"])(
    "slash %s opens the command menu on the current feed and keeps the query",
    (location) => {
        const activeFilters = {
            ...filters,
            q: "Cyber",
            category: "latest",
            chain: "ethereum",
        };
        render({ filters: activeFilters });
        const event =
            location === "inside search" ? openMenu() : key(document.body, "/");
        expect(event.defaultPrevented).toBe(true);
        expect(filterOptions().map(label)).toEqual([
            "Popular",
            "Latest",
            "Staff picks",
            "Oncyber Labs",
        ]);
        expect(label(checked())).toBe("Latest");
        expect(document.activeElement).toBe(input());
        expect(active()).toBe(checked());
        expect(search().value).toBe("Cyber");
        expect(update).not.toHaveBeenCalled();
        expect(searchChange).not.toHaveBeenCalled();
    }
);

test("menu has filter, create, go-to and help sections", () => {
    render();
    openMenu();
    const sections = Array.from(
        menu().querySelectorAll(".command-section")
    ).map((el) => el.textContent);
    expect(sections).toEqual(["Filter worlds", "Create", "Go to", "Help"]);
    const labels = options().map(label);
    expect(labels).toEqual(
        expect.arrayContaining([
            "New gallery",
            "Jump into the lobby",
            "Search worlds",
            "Sign in",
            "Docs",
            "Contribute",
        ])
    );
});

test("arrows move the active command and Enter runs it without leaking keys", () => {
    render({ filters: { ...filters, q: "Cyber", owner: "0x123" } });
    openMenu();
    const backgroundKey = jest.fn();
    document.addEventListener("keydown", backgroundKey);
    try {
        expect(key(input(), "ArrowDown").defaultPrevented).toBe(true);
        expect(label(active())).toBe("Latest");
        key(input(), "End");
        expect(active()).toBe(options()[options().length - 1]);
        key(input(), "ArrowDown");
        expect(label(active())).toBe("Popular");
        key(input(), "ArrowUp");
        expect(active()).toBe(options()[options().length - 1]);
        key(input(), "Home");
        key(input(), "ArrowDown");
        expect(key(input(), "Enter").defaultPrevented).toBe(true);
        expect(update).toHaveBeenCalledWith({ category: "latest" });
        expect(backgroundKey).not.toHaveBeenCalled();
        expect(menu()).toBeNull();
        expect(document.activeElement).toBe(search());
        expect(search().value).toBe("Cyber");
    } finally {
        document.removeEventListener("keydown", backgroundKey);
    }
});

test("typing filters commands across sections", () => {
    render();
    openMenu();
    type("lobby");
    expect(options().map(label)).toEqual(["Jump into the lobby"]);
    expect(label(active())).toBe("Jump into the lobby");
    key(input(), "Enter");
    expect(mockPush).toHaveBeenCalledWith(
        { pathname: "/", query: { lobby: "1" } },
        undefined,
        { shallow: true, scroll: false }
    );
    expect(menu()).toBeNull();
});

test("no match shows an empty state and Enter does nothing", () => {
    render();
    openMenu();
    type("zzzz");
    expect(options()).toHaveLength(0);
    expect(menu().textContent).toContain("No matching commands");
    key(input(), "Enter");
    expect(update).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
});

test("New gallery opens the template step", () => {
    mockRouter.query = { lobby: "1", q: "x" };
    render();
    openMenu();
    const gallery = options().find((el) => label(el) === "New gallery");
    act(() => gallery.click());
    expect(mockPush).toHaveBeenCalledWith(
        { pathname: "/", query: { q: "x", create: "gallery" } },
        undefined,
        { shallow: true, scroll: false }
    );
});

test("Staff picks retains its existing search reset behavior", () => {
    render({ filters: { ...filters, q: "Cyber", owner: "0x123" } });
    openMenu();
    const staff = options().find((el) => label(el) === "Staff picks");
    act(() => staff.click());
    expect(update).toHaveBeenCalledWith({
        category: "staff",
        q: "",
        chain: "",
        owner: "",
        collection: "",
    });
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(search());
});

test("Escape closes the menu and restores search focus without exiting Create", () => {
    const templateUpdate = jest.fn();
    render({ templates: { category: "all", update: templateUpdate } });
    openMenu();
    const backgroundKey = jest.fn();
    document.addEventListener("keydown", backgroundKey);
    try {
        expect(key(input(), "Escape").defaultPrevented).toBe(true);
        expect(menu()).toBeNull();
        expect(document.activeElement).toBe(search());
        expect(backgroundKey).not.toHaveBeenCalled();
        expect(templateUpdate).not.toHaveBeenCalled();
    } finally {
        document.removeEventListener("keydown", backgroundKey);
    }
});

test("Backspace on an empty filter closes the menu", () => {
    render();
    openMenu();
    key(input(), "Backspace");
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(search());
});

test("template slash shows space categories and updates only the chosen category", () => {
    const templateUpdate = jest.fn();
    render({
        filters: { ...filters, q: "Loft" },
        templates: { category: "curated", update: templateUpdate },
    });
    expect(openMenu().defaultPrevented).toBe(true);
    expect(menu().querySelector(".command-section").textContent).toBe(
        "Filter templates"
    );
    expect(label(checked())).toBe("Curated");
    expect(filterOptions()).toHaveLength(8);
    expect(options().map(label)).not.toContain("New gallery");
    expect(options().map(label)).toContain("Explore worlds");
    key(input(), "Home");
    key(input(), "ArrowDown");
    key(input(), "Enter");
    expect(templateUpdate).toHaveBeenCalledWith("free");
    expect(update).not.toHaveBeenCalled();
    expect(search().value).toBe("Loft");
    expect(document.activeElement).toBe(search());
});

test.each([undefined, { category: "all", update: jest.fn() }])(
    "virtual keyboard slash opens the menu before inserting text",
    (templates) => {
        render({ filters: { ...filters, q: "Cyber" }, templates });
        act(() => search().focus());
        expect(beforeInput(search()).defaultPrevented).toBe(true);
        expect(menu()).not.toBeNull();
        expect(document.activeElement).toBe(input());
        expect(search().value).toBe("Cyber");
        expect(searchChange).not.toHaveBeenCalled();
    }
);

test.each(["metaKey", "ctrlKey"])(
    "%s K closes the menu and focuses and selects search",
    (modifier) => {
        render({ filters: { ...filters, q: "Cyber" } });
        openMenu();
        const event = key(input(), "k", { [modifier]: true });
        expect(event.defaultPrevented).toBe(true);
        expect(menu()).toBeNull();
        expect(document.activeElement).toBe(search());
        expect(search().selectionStart).toBe(0);
        expect(search().selectionEnd).toBe(5);
    }
);

test.each(["focusin", "pointerdown"])(
    "%s outside the menu dismisses it",
    (eventType) => {
        render();
        openMenu();
        act(() =>
            document.body.dispatchEvent(new Event(eventType, { bubbles: true }))
        );
        expect(menu()).toBeNull();
    }
);

test("does not intercept slash in immersive lobby", () => {
    render({ immersive: true });
    expect(openMenu().defaultPrevented).toBe(false);
    expect(key(document.body, "/").defaultPrevented).toBe(false);
    expect(beforeInput(search()).defaultPrevented).toBe(false);
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(search());
});

test.each(["Other input", "Other text", "Other editor"])(
    "does not intercept slash in %s",
    (name) => {
        render();
        const el = container.querySelector<HTMLElement>(
            `[aria-label="${name}"]`
        );
        act(() => el.focus());
        expect(key(el, "/").defaultPrevented).toBe(false);
        expect(beforeInput(el).defaultPrevented).toBe(false);
        expect(menu()).toBeNull();
    }
);

test.each(["metaKey", "ctrlKey", "altKey", "isComposing"])(
    "does not intercept slash with %s",
    (modifier) => {
        render();
        expect(key(search(), "/", { [modifier]: true }).defaultPrevented).toBe(
            false
        );
        expect(menu()).toBeNull();
    }
);

test("does not intercept text composition or noncancelable virtual input", () => {
    render();
    expect(beforeInput(search(), { isComposing: true }).defaultPrevented).toBe(
        false
    );
    expect(beforeInput(search(), { cancelable: false }).defaultPrevented).toBe(
        false
    );
    expect(menu()).toBeNull();
});
