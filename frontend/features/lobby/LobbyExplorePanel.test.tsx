/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import { DEFAULT_FILTERS, FEED_CATEGORIES } from "../landing-carousel/data";
import useDiscovery from "../landing-carousel/hooks/useDiscovery";
import ExperienceCard from "../landing-carousel/components/ExperienceCard";
import useDestinationPreviews from "../landing-carousel/hooks/useDestinationPreviews";
import type { LandingCard } from "../landing-carousel/types";
import LobbyExplorePanel from "./LobbyExplorePanel";

jest.mock("@components/InAppLink", () => ({
    __esModule: true,
    default: require("react").forwardRef((props, ref) => (
        <a {...props} ref={ref} />
    )),
}));
const mockPush = jest.fn();
jest.mock("next/router", () => ({
    useRouter: () => ({ pathname: "/", query: {}, push: mockPush }),
}));
jest.mock("../landing-carousel/hooks/useDiscovery", () => ({
    __esModule: true,
    default: jest.fn(),
}));
jest.mock("../landing-carousel/hooks/useDestinationPreviews", () => ({
    __esModule: true,
    default: jest.fn(),
}));
jest.mock("../landing-carousel/components/ExperienceCard", () => ({
    __esModule: true,
    default: jest.fn(({ card, flat, ...props }) => (
        <a
            href={card.href}
            data-card-id={card.id}
            data-flat={String(flat)}
            {...props}
        >
            {card.title}
        </a>
    )),
}));

const card: LandingCard = {
    id: "gallery",
    title: "The gallery",
    href: "/vvd",
    description: "A public gallery",
    creator: "An artist",
    owner: "0x123",
    room: "room",
    visits: 20,
    chains: ["ethereum"],
    collections: [],
    tags: [],
    imageUrls: ["https://images.example/gallery.webp"],
    portrait: false,
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let discovery: any;
let onClose: jest.Mock;
let onSelect: jest.Mock;

const render = (groupName?: string, active = true) =>
    act(() => {
        root.render(
            <LobbyExplorePanel
                cards={[card]}
                groupName={groupName}
                active={active}
                onClose={onClose}
                onSelect={onSelect}
            />
        );
    });
const button = (label: string) =>
    Array.from(
        container.querySelectorAll<HTMLButtonElement>('button, [role="option"]')
    ).find(
        (entry) =>
            entry.getAttribute("aria-label") === label ||
            entry.textContent.trim() === label ||
            entry.querySelector(".label")?.textContent === label
    );
const click = (label: string) => {
    const target = button(label);
    expect(target).toBeDefined();
    act(() => target.click());
};
const field = (label: string) => {
    const labelled = container.querySelector<
        HTMLInputElement | HTMLSelectElement
    >(`[aria-label="${label}"]`);
    if (labelled) return labelled;
    const element = Array.from(container.querySelectorAll("label")).find(
        (entry) =>
            Array.from(entry.childNodes)
                .filter((node) => node.nodeType === Node.TEXT_NODE)
                .map((node) => node.textContent)
                .join("")
                .trim() === label
    );
    return element?.htmlFor
        ? container.querySelector<HTMLInputElement | HTMLSelectElement>(
              `[id="${element.htmlFor}"]`
          )
        : element?.querySelector<HTMLInputElement | HTMLSelectElement>(
              "input, select"
          );
};
const change = (label: string, value: string) => {
    const target = field(label);
    expect(target).toBeTruthy();
    act(() => {
        target.value = value;
        Simulate.change(target);
    });
};
const press = (
    key: string,
    options: KeyboardEventInit = {},
    target: EventTarget = document.activeElement
) => {
    const event = new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
        ...options,
    });
    act(() => target.dispatchEvent(event));
    return event;
};
const escape = () => press("Escape");
const feedLabels = FEED_CATEGORIES.map((entry) => entry.label);
const feedRows = () =>
    Array.from(
        container.querySelectorAll<HTMLElement>('[role="option"]')
    ).filter((entry) =>
        feedLabels.includes(entry.querySelector(".label")?.textContent)
    );
const activeRow = () =>
    document.getElementById(
        document.activeElement?.getAttribute("aria-activedescendant")
    );
const cardLink = () =>
    container.querySelector<HTMLAnchorElement>('[data-card-id="gallery"]');
const railCards = () => {
    const cards = Array.from(
        container.querySelectorAll<HTMLAnchorElement>("[data-card-id]")
    );
    cards.forEach((entry) => {
        entry.scrollIntoView = jest.fn();
    });
    return cards;
};

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    onClose = jest.fn();
    onSelect = jest.fn();
    discovery = {
        filters: { ...DEFAULT_FILTERS },
        update: jest.fn(),
        cards: [card],
        loading: false,
        loadingMore: false,
        loadMoreError: false,
        error: false,
        hasMore: false,
        searchTotal: null,
        limitedSearch: false,
        loadMore: jest.fn(),
        retry: jest.fn(),
        reset: jest.fn(),
        resultKey: "initial",
    };
    (useDiscovery as jest.Mock).mockImplementation(() => discovery);
    (useDestinationPreviews as jest.Mock).mockImplementation((cards) => cards);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.clearAllMocks();
});

test("refreshes the seeded feed without changing the lobby URL", () => {
    render();
    expect(useDiscovery).toHaveBeenCalledWith(
        {
            initialFeed: { cards: [card], cursor: "", hasMore: false },
            initialFilters: DEFAULT_FILTERS,
            initialError: false,
        },
        { syncUrl: false, fetchOnMount: true }
    );
    expect(container.querySelector("#lobby-explore-title").textContent).toBe(
        "Popular"
    );
    expect(cardLink().getAttribute("data-flat")).toBe("true");
    click("Close search");
    expect(onClose).toHaveBeenCalledTimes(1);
});

test("an inactive closing panel is inert and does not focus or handle shortcuts", () => {
    const outside = document.createElement("input");
    document.body.append(outside);
    try {
        outside.focus();
        render(undefined, false);
        const panel = container.querySelector("#lobby-explore");
        const input = field("Search worlds, artists, and creators");
        expect(panel.getAttribute("aria-hidden")).toBe("true");
        expect(panel.hasAttribute("inert")).toBe(true);
        expect(document.activeElement).toBe(outside);
        expect(press("/", {}, input).defaultPrevented).toBe(false);
        expect(press("k", { ctrlKey: true }, input).defaultPrevented).toBe(
            false
        );
        expect(container.querySelector('[aria-label="Commands"]')).toBeNull();
        expect(document.activeElement).toBe(outside);
        render(undefined, true);
        expect(panel.getAttribute("aria-hidden")).not.toBe("true");
        expect(panel.hasAttribute("inert")).toBe(false);
        expect(document.activeElement).toBe(input);
        expect(press("/").defaultPrevented).toBe(true);
        expect(
            container.querySelector('[aria-label="Commands"]')
        ).not.toBeNull();
    } finally {
        outside.remove();
    }
});

test("the real search input updates, trims submission, and clears search", () => {
    render();
    change("Search worlds, artists, and creators", "  museum  ");
    expect(discovery.update).toHaveBeenLastCalledWith({ q: "  museum  " });
    act(() => {
        field("Search worlds, artists, and creators")
            .closest("form")
            .dispatchEvent(
                new Event("submit", { bubbles: true, cancelable: true })
            );
    });
    expect(discovery.update).toHaveBeenLastCalledWith({ q: "museum" });
    click("Clear world search");
    expect(discovery.update).toHaveBeenLastCalledWith({ q: "" });
    expect(field("Search worlds, artists, and creators").value).toBe("");
});

test("search starts focused and closing delegates without clearing the query", () => {
    discovery.filters.q = "museum";
    render();
    const input = field("Search worlds, artists, and creators");
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe("museum");
    expect(button("Search worlds")).toBeUndefined();
    expect(button("Filter worlds")).toBeDefined();
    click("Close search");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(discovery.update).not.toHaveBeenCalled();
});

test("slash on a card opens the feed menu and choosing a feed restores input focus", () => {
    render();
    act(() => cardLink().focus());
    expect(press("/").defaultPrevented).toBe(true);
    expect(field("Search worlds, artists, and creators")).toBeTruthy();
    const categories = feedRows();
    expect(categories.map((entry) => entry.textContent.trim())).toEqual(
        FEED_CATEGORIES.map((entry) => entry.label)
    );
    act(() =>
        categories.find((entry) => entry.textContent === "Latest").click()
    );
    expect(discovery.update).toHaveBeenLastCalledWith({ category: "latest" });
    expect(container.querySelector('[aria-label="Commands"]')).toBeNull();
    expect(document.activeElement).toBe(
        field("Search worlds, artists, and creators")
    );
});

test("Escape closes the slash menu before closing search", () => {
    render();
    const input = field("Search worlds, artists, and creators");
    expect(press("/").defaultPrevented).toBe(true);
    expect(container.querySelector('[aria-label="Commands"]')).not.toBeNull();
    expect(discovery.update).not.toHaveBeenCalled();
    escape();
    expect(container.querySelector('[aria-label="Commands"]')).toBeNull();
    expect(document.activeElement).toBe(input);
    expect(onClose).not.toHaveBeenCalled();
    escape();
    expect(onClose).toHaveBeenCalledTimes(1);
});

test.each([{ ctrlKey: true }, { metaKey: true }])(
    "the search shortcut focuses and selects the query with %j",
    (modifier) => {
        discovery.filters.q = "museum";
        render();
        act(() => cardLink().focus());
        expect(press("k", modifier).defaultPrevented).toBe(true);
        const input = field(
            "Search worlds, artists, and creators"
        ) as HTMLInputElement;
        expect(document.activeElement).toBe(input);
        expect(input.selectionStart).toBe(0);
        expect(input.selectionEnd).toBe("museum".length);
        expect(container.querySelector('[aria-label="Commands"]')).toBeNull();
    }
);

test.each([{ isComposing: true }, { keyCode: 229 }])(
    "IME Escape and slash preserve search and focus with %j",
    (composition) => {
        render();
        const input = field("Search worlds, artists, and creators");
        expect(document.activeElement).toBe(input);
        expect(press("Escape", composition).defaultPrevented).toBe(false);
        expect(field("Search worlds, artists, and creators")).toBe(input);
        expect(document.activeElement).toBe(input);
        expect(onClose).not.toHaveBeenCalled();
        expect(press("/", composition).defaultPrevented).toBe(false);
        expect(container.querySelector('[aria-label="Commands"]')).toBeNull();
        expect(document.activeElement).toBe(input);
        expect(discovery.update).not.toHaveBeenCalled();
    }
);

test("panel shortcuts do not capture typing elsewhere on the page", () => {
    render();
    const outside = document.createElement("input");
    document.body.append(outside);
    try {
        outside.focus();
        expect(press("/").defaultPrevented).toBe(false);
        expect(press("k", { ctrlKey: true }).defaultPrevented).toBe(false);
        expect(document.activeElement).toBe(outside);
        expect(container.querySelector('[aria-label="Commands"]')).toBeNull();
    } finally {
        outside.remove();
    }
});

test("a virtual keyboard slash opens the feed menu without entering a query", () => {
    render();
    const event = new InputEvent("beforeinput", {
        data: "/",
        inputType: "insertText",
        bubbles: true,
        cancelable: true,
    });
    act(() =>
        field("Search worlds, artists, and creators").dispatchEvent(event)
    );
    expect(event.defaultPrevented).toBe(true);
    expect(container.querySelector('[aria-label="Commands"]')).not.toBeNull();
    expect(discovery.update).not.toHaveBeenCalled();
    expect(field("Search worlds, artists, and creators").value).toBe("");
});

test.each(FEED_CATEGORIES)("offers the $label feed", ({ label, value }) => {
    render();
    click("World feeds");
    const categories = feedRows();
    expect(categories.map((entry) => entry.textContent.trim())).toEqual(
        FEED_CATEGORIES.map((entry) => entry.label)
    );
    act(() => {
        (
            categories.find(
                (entry) => entry.textContent.trim() === label
            ) as HTMLButtonElement
        ).click();
    });
    expect(discovery.update).toHaveBeenLastCalledWith(
        expect.objectContaining({ category: value })
    );
});

test("the command menu opens from the feeds button and restores search on Escape", () => {
    render();
    const trigger = button("World feeds");
    act(() => trigger.focus());
    press("ArrowDown");
    const commandInput = container.querySelector<HTMLInputElement>(
        '[aria-label="Search commands"]'
    );
    const rows = Array.from(
        container.querySelectorAll<HTMLElement>('[role="option"]')
    );
    expect(feedRows()).toHaveLength(FEED_CATEGORIES.length);
    expect(document.activeElement).toBe(commandInput);
    expect(activeRow()).toBe(feedRows()[0]);
    press("ArrowDown");
    expect(activeRow()).toBe(rows[1]);
    press("End");
    expect(activeRow()).toBe(rows[rows.length - 1]);
    press("ArrowDown");
    expect(activeRow()).toBe(rows[0]);
    press("ArrowUp");
    expect(activeRow()).toBe(rows[rows.length - 1]);
    press("Home");
    expect(activeRow()).toBe(rows[0]);
    escape();
    expect(container.querySelector('[aria-label="Commands"]')).toBeNull();
    expect(document.activeElement).toBe(
        field("Search worlds, artists, and creators")
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(discovery.update).not.toHaveBeenCalled();
});

test("the command menu offers create, go-to and help actions", () => {
    render();
    click("World feeds");
    const sections = Array.from(
        container.querySelectorAll(".command-section")
    ).map((entry) => entry.textContent);
    expect(sections).toEqual(["Filter worlds", "Create", "Go to", "Help"]);
    expect(button("Jump into the lobby")).toBeUndefined();
    click("New gallery");
    expect(mockPush).toHaveBeenCalledWith("/?create=gallery");
});

test("in a space the command menu can jump into the lobby", () => {
    act(() => {
        root.render(
            <LobbyExplorePanel
                cards={[card]}
                context="space"
                onClose={onClose}
                onSelect={onSelect}
            />
        );
    });
    click("World feeds");
    click("Jump into the lobby");
    expect(mockPush).toHaveBeenCalledWith("/?lobby=1");
});

test("More filters opens the filter form", () => {
    render();
    click("World feeds");
    click("More filters");
    expect(container.querySelector('[aria-label="Commands"]')).toBeNull();
    expect(button("Filter worlds").getAttribute("aria-expanded")).toBe("true");
});

test("Staff picks clears search and facets so the curated feed can load", () => {
    discovery.filters = {
        q: "museum",
        category: "latest",
        chain: "ethereum",
        owner: "0x123",
        collection: "collection-id",
    };
    render();
    click("World feeds");
    click("Staff picks");
    expect(discovery.update).toHaveBeenLastCalledWith({
        category: "staff",
        q: "",
        chain: "",
        owner: "",
        collection: "",
    });
});

test("filters apply only on submission and preserve the current search", () => {
    discovery.filters.q = "museum";
    render();
    click("Filter worlds");
    change("Blockchain", "ethereum");
    change("Creator wallet", "0x456");
    change("Collection", "collection-id");
    expect(discovery.update).not.toHaveBeenCalled();
    discovery.filters = { ...discovery.filters, q: "another museum" };
    render();
    click("Apply filters");
    expect(discovery.update).toHaveBeenCalledTimes(1);
    const patch = discovery.update.mock.calls[0][0];
    expect(patch).toMatchObject({
        chain: "ethereum",
        owner: "0x456",
        collection: "collection-id",
    });
    expect(patch).not.toHaveProperty("q");
    expect({ ...discovery.filters, ...patch }.q).toBe("another museum");
});

test("reset restores the discovery defaults", () => {
    discovery.filters = {
        q: "museum",
        category: "latest",
        chain: "ethereum",
        owner: "0x123",
        collection: "collection-id",
    };
    render();
    click("Filter worlds");
    click("Reset filters");
    expect(discovery.reset).toHaveBeenCalledTimes(1);
    expect(field("Blockchain").value).toBe("");
    expect(field("Creator wallet").value).toBe("");
    expect(field("Collection").value).toBe("");
});

test("previous and next controls move focus without selecting a destination", () => {
    discovery.cards = [
        card,
        { ...card, id: "second", title: "Second world", href: "/second" },
        { ...card, id: "third", title: "Third world", href: "/third" },
    ];
    render();
    const cards = railCards();
    expect(button("1 column")).toBeUndefined();
    expect(button("2 columns")).toBeUndefined();
    expect(button("Previous world").disabled).toBe(true);
    expect(button("Next world").disabled).toBe(false);
    click("Next world");
    expect(document.activeElement).toBe(cards[1]);
    expect(cards[1].getAttribute("data-selected")).toBe("true");
    expect(cards[1].scrollIntoView).not.toHaveBeenCalled();
    click("Next world");
    expect(document.activeElement).toBe(cards[2]);
    expect(button("Next world").disabled).toBe(true);
    click("Previous world");
    expect(document.activeElement).toBe(cards[1]);
    click("Previous world");
    expect(document.activeElement).toBe(cards[0]);
    expect(button("Previous world").disabled).toBe(true);
    expect(onSelect).not.toHaveBeenCalled();
});

test("arrow keys move one card and Home and End respect the rail bounds", () => {
    discovery.cards = [
        card,
        { ...card, id: "second", title: "Second world", href: "/second" },
        { ...card, id: "third", title: "Third world", href: "/third" },
    ];
    render();
    const cards = railCards();
    act(() => cards[0].focus());
    press("ArrowDown");
    expect(document.activeElement).toBe(cards[1]);
    press("ArrowRight");
    expect(document.activeElement).toBe(cards[2]);
    press("ArrowRight");
    expect(document.activeElement).toBe(cards[2]);
    press("ArrowUp");
    expect(document.activeElement).toBe(cards[1]);
    press("ArrowLeft");
    expect(document.activeElement).toBe(cards[0]);
    press("ArrowLeft");
    expect(document.activeElement).toBe(cards[0]);
    press("End");
    expect(document.activeElement).toBe(cards[2]);
    press("Home");
    expect(document.activeElement).toBe(cards[0]);
    press("PageDown");
    expect(document.activeElement).toBe(cards[1]);
    press("PageUp");
    expect(document.activeElement).toBe(cards[0]);
    expect(onSelect).not.toHaveBeenCalled();
});

test("vertical wheel scrolling moves the rail and preserves native gestures and edges", () => {
    render();
    const rail = container.querySelector<HTMLElement>('[aria-label="Worlds"]');
    Object.defineProperties(rail, {
        scrollWidth: { configurable: true, value: 1000 },
        clientWidth: { configurable: true, value: 400 },
    });
    rail.scrollLeft = 100;
    const wheel = (options: WheelEventInit) => {
        const event = new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            ...options,
        });
        act(() => rail.dispatchEvent(event));
        return event;
    };
    expect(wheel({ deltaY: 50 }).defaultPrevented).toBe(true);
    expect(rail.scrollLeft).toBe(150);

    expect(wheel({ deltaX: 60, deltaY: 10 }).defaultPrevented).toBe(false);
    expect(wheel({ deltaY: 50, shiftKey: true }).defaultPrevented).toBe(false);
    expect(wheel({ deltaY: 50, ctrlKey: true }).defaultPrevented).toBe(false);
    expect(rail.scrollLeft).toBe(150);

    rail.scrollLeft = 0;
    expect(wheel({ deltaY: -50 }).defaultPrevented).toBe(false);
    expect(rail.scrollLeft).toBe(0);
    rail.scrollLeft = 600;
    expect(wheel({ deltaY: 50 }).defaultPrevented).toBe(false);
    expect(rail.scrollLeft).toBe(600);
});

test.each([false, true])(
    "an ended mouse press cannot begin dragging on reentry (left rail: %s)",
    (leaveRail) => {
        render();
        const rail = container.querySelector<HTMLElement>(
            '[aria-label="Worlds"]'
        );
        rail.setPointerCapture = jest.fn();
        rail.scrollLeft = 100;
        const pointer = {
            pointerId: 7,
            pointerType: "mouse",
            button: 0,
            buttons: 1,
            clientX: 150,
        };
        act(() => {
            Simulate.pointerDown(rail, pointer);
            if (leaveRail) Simulate.pointerLeave(rail, pointer);
            Simulate.pointerMove(rail, {
                ...pointer,
                buttons: 0,
                clientX: 100,
            });
        });
        expect(rail.setPointerCapture).not.toHaveBeenCalled();
        expect(rail.scrollLeft).toBe(100);
        expect(rail.dataset.dragging).toBeUndefined();
        act(() => {
            Simulate.pointerMove(rail, { ...pointer, clientX: 80 });
        });
        expect(rail.setPointerCapture).not.toHaveBeenCalled();
        expect(rail.scrollLeft).toBe(100);
    }
);

test("a captured drag suppresses its click and a fresh click can still travel", () => {
    render();
    const rail = container.querySelector<HTMLElement>('[aria-label="Worlds"]');
    let captured = false;
    rail.setPointerCapture = jest.fn(() => {
        captured = true;
    });
    rail.hasPointerCapture = jest.fn(() => captured);
    rail.releasePointerCapture = jest.fn(() => {
        captured = false;
    });
    rail.scrollLeft = 100;
    const pointer = {
        pointerId: 7,
        pointerType: "mouse",
        button: 0,
        buttons: 1,
        clientX: 150,
    };
    act(() => {
        Simulate.pointerDown(rail, pointer);
        Simulate.pointerMove(rail, { ...pointer, clientX: 148 });
    });
    expect(rail.setPointerCapture).not.toHaveBeenCalled();
    expect(rail.scrollLeft).toBe(100);
    act(() => {
        Simulate.pointerMove(rail, { ...pointer, clientX: 100 });
    });
    expect(rail.setPointerCapture).toHaveBeenCalledWith(7);
    expect(rail.scrollLeft).toBe(150);
    expect(rail.dataset.dragging).toBe("true");
    act(() => {
        Simulate.pointerUp(rail, { ...pointer, buttons: 0, clientX: 100 });
        Simulate.lostPointerCapture(rail, pointer);
    });
    expect(rail.releasePointerCapture).toHaveBeenCalledWith(7);
    expect(rail.dataset.dragging).toBeUndefined();
    const dragClick = new MouseEvent("click", {
        button: 0,
        bubbles: true,
        cancelable: true,
    });
    act(() => cardLink().dispatchEvent(dragClick));
    expect(dragClick.defaultPrevented).toBe(true);
    expect(onSelect).not.toHaveBeenCalled();

    act(() => {
        Simulate.pointerDown(rail, pointer);
        Simulate.pointerUp(rail, { ...pointer, buttons: 0 });
        cardLink().dispatchEvent(
            new MouseEvent("click", {
                button: 0,
                bubbles: true,
                cancelable: true,
            })
        );
    });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ id: card.id, href: card.href })
    );
});

test("the filter overlay disables navigation until the form closes", () => {
    discovery.cards = [
        card,
        { ...card, id: "second", title: "Second world", href: "/second" },
    ];
    render();
    const cards = railCards();
    click("Filter worlds");
    expect(button("Previous world").disabled).toBe(true);
    expect(button("Next world").disabled).toBe(true);
    click("Next world");
    expect(cards[1].scrollIntoView).not.toHaveBeenCalled();
    click("Apply filters");
    expect(button("Next world").disabled).toBe(false);
    expect(onSelect).not.toHaveBeenCalled();
});

test("Escape closes filters before it closes explore", () => {
    render();
    click("Filter worlds");
    expect(field("Creator wallet")).toBeTruthy();
    act(() => field("Creator wallet").focus());
    escape();
    expect(field("Creator wallet")).toBeFalsy();
    expect(onClose).not.toHaveBeenCalled();
    escape();
    expect(onClose).toHaveBeenCalledTimes(1);
});

test("a group destination uses the resolved cover and existing selection callback", () => {
    const imageUrl = "https://images.example/resolved-gallery.webp";
    (useDestinationPreviews as jest.Mock).mockImplementation((cards) =>
        cards.map((entry) => ({ ...entry, imageUrls: [imageUrl] }))
    );
    render("The explorers");
    expect(container.textContent).toContain("Explore with The explorers");
    const event = new MouseEvent("click", {
        button: 0,
        bubbles: true,
        cancelable: true,
    });
    act(() => cardLink().dispatchEvent(event));
    expect(event.defaultPrevented).toBe(true);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith({
        id: card.id,
        title: card.title,
        creator: card.creator,
        href: card.href,
        imageUrl,
    });
});

test.each([
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true },
    { altKey: true },
    { button: 1 },
    { defaultPrevented: true },
])("preserves native navigation for %j", (event) => {
    render();
    const preventDefault = jest.fn();
    act(() => {
        Simulate.click(cardLink(), {
            button: 0,
            ...event,
            preventDefault,
        });
    });
    expect(onSelect).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
});

test("unsafe or external destinations never become navigable cards", () => {
    const unsafe = [
        "javascript:alert(1)",
        "data:text/html,unsafe",
        "//attacker.example/game",
        "/\\attacker.example/game",
        "https://attacker.example/game",
    ];
    discovery.cards = [
        card,
        ...unsafe.map((href, index) => ({
            ...card,
            id: `unsafe-${index}`,
            href,
        })),
    ];
    render();
    const hrefs = Array.from(container.querySelectorAll("a")).map((link) =>
        link.getAttribute("href")
    );
    expect(hrefs).toContain(card.href);
    unsafe.forEach((href) => expect(hrefs).not.toContain(href));
});

test("retry and pagination controls use their own discovery actions", () => {
    discovery.cards = [];
    discovery.error = true;
    render();
    click("Retry");
    expect(discovery.retry).toHaveBeenCalledTimes(1);
    expect(discovery.loadMore).not.toHaveBeenCalled();

    discovery.cards = [card];
    discovery.error = false;
    discovery.hasMore = true;
    render();
    click("Load more");
    expect(discovery.loadMore).toHaveBeenCalledTimes(1);

    discovery.error = true;
    discovery.loadMoreError = true;
    render();
    expect(button("Retry")).toBeUndefined();
    expect(cardLink()).not.toBeNull();
    click("Retry loading more");
    expect(discovery.loadMore).toHaveBeenCalledTimes(2);
    expect(discovery.retry).toHaveBeenCalledTimes(1);

    discovery.loadingMore = true;
    render();
    expect(button("Loading…").disabled).toBe(true);
    click("Loading…");
    expect(discovery.loadMore).toHaveBeenCalledTimes(2);
});

test("Next on the last card loads or retries the next page without travelling", () => {
    discovery.hasMore = true;
    render();
    expect(button("Next world").disabled).toBe(false);
    click("Next world");
    expect(discovery.loadMore).toHaveBeenCalledTimes(1);

    discovery.loadingMore = true;
    render();
    expect(button("Next world").disabled).toBe(true);
    click("Next world");
    expect(discovery.loadMore).toHaveBeenCalledTimes(1);

    discovery.loadingMore = false;
    discovery.hasMore = false;
    discovery.error = true;
    discovery.loadMoreError = true;
    render();
    expect(button("Next world").disabled).toBe(false);
    click("Next world");
    expect(discovery.loadMore).toHaveBeenCalledTimes(2);
    expect(discovery.retry).not.toHaveBeenCalled();

    discovery.error = false;
    discovery.loadMoreError = false;
    render();
    expect(button("Next world").disabled).toBe(true);
    click("Next world");
    expect(discovery.loadMore).toHaveBeenCalledTimes(2);
    expect(onSelect).not.toHaveBeenCalled();
});

test("closing for travel preserves card renders and uses the latest selection callback", () => {
    discovery.cards = Array.from({ length: 12 }, (_, index) => ({
        ...card,
        id: index ? `world-${index}` : card.id,
        title: index ? `World ${index}` : card.title,
        href: index ? `/world-${index}` : card.href,
    }));
    render();
    const rendered = (ExperienceCard as jest.Mock).mock.calls.length;
    expect(rendered).toBe(12);
    const first = cardLink();
    const previousSelection = onSelect;
    onSelect = jest.fn();

    render(undefined, false);
    expect(
        container.querySelector("#lobby-explore").hasAttribute("inert")
    ).toBe(true);
    expect(ExperienceCard).toHaveBeenCalledTimes(rendered);
    expect(cardLink()).toBe(first);

    render();
    expect(ExperienceCard).toHaveBeenCalledTimes(rendered);
    act(() => first.click());
    expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ id: card.id })
    );
    expect(previousSelection).not.toHaveBeenCalled();

    discovery.cards = [
        { ...discovery.cards[0], title: "Updated gallery", href: "/updated" },
        ...discovery.cards.slice(1),
    ];
    render();
    expect(cardLink().textContent).toBe("Updated gallery");
    act(() => cardLink().click());
    expect(onSelect).toHaveBeenLastCalledWith(
        expect.objectContaining({ title: "Updated gallery", href: "/updated" })
    );
});

test("the shared curve follows rail scrolling and resizing without changing selection behavior", () => {
    jest.useFakeTimers();
    try {
        discovery.cards = [
            card,
            { ...card, id: "second", title: "Second", href: "/second" },
        ];
        render();
        const rail = container.querySelector<HTMLElement>(
            '[aria-label="Worlds"]'
        );
        const cards = railCards();
        Object.defineProperty(rail, "clientWidth", {
            configurable: true,
            value: 656,
        });
        cards.forEach((entry, index) =>
            Object.defineProperties(entry, {
                offsetLeft: { configurable: true, value: 24 + index * 308 },
                offsetWidth: { configurable: true, value: 300 },
            })
        );
        act(() => {
            window.dispatchEvent(new Event("resize"));
            jest.advanceTimersByTime(20);
        });
        const turn = (entry: HTMLElement) =>
            parseFloat(entry.style.getPropertyValue("--explore-turn"));
        expect(turn(cards[0])).toBeLessThan(0);
        expect(turn(cards[1])).toBeGreaterThan(0);
        rail.scrollLeft = 154;
        act(() => {
            rail.dispatchEvent(new Event("scroll"));
            jest.advanceTimersByTime(20);
        });
        expect(turn(cards[1])).toBeCloseTo(0);
        expect(onSelect).not.toHaveBeenCalled();
        Object.defineProperty(rail, "clientWidth", {
            configurable: true,
            value: 420,
        });
        act(() => {
            window.dispatchEvent(new Event("resize"));
            jest.advanceTimersByTime(20);
        });
        expect(turn(cards[1])).toBeGreaterThan(0);
        expect(Math.abs(turn(cards[0]))).toBeLessThanOrEqual(16);
    } finally {
        jest.useRealTimers();
    }
});

test("focus reveals only hidden layout bounds and ignores the card's projected bounds", () => {
    discovery.cards = [
        card,
        { ...card, id: "second", title: "Second", href: "/second" },
        { ...card, id: "third", title: "Third", href: "/third" },
    ];
    render();
    const rail = container.querySelector<HTMLElement>('[aria-label="Worlds"]');
    const cards = railCards();
    Object.defineProperties(rail, {
        clientWidth: { configurable: true, value: 656 },
        scrollWidth: { configurable: true, value: 964 },
    });
    cards.forEach((entry, index) => {
        Object.defineProperties(entry, {
            offsetLeft: { configurable: true, value: 24 + index * 308 },
            offsetWidth: { configurable: true, value: 300 },
        });
        entry.getBoundingClientRect = jest.fn(() => {
            throw new Error("Projected bounds must not control scrolling");
        });
    });
    click("Next world");
    expect(rail.scrollLeft).toBe(0); // Both first and second cards already fit.
    click("Next world");
    expect(rail.scrollLeft).toBe(308); // Reveal the third card with the 24px gutter.
    act(() => rail.dispatchEvent(new Event("scroll")));
    expect(button("Next world").disabled).toBe(true); // Scroll does not replace focused selection with the left visible card.
    press("ArrowRight", {}, cards[2]);
    expect(rail.scrollLeft).toBe(308);
    click("Previous world");
    expect(rail.scrollLeft).toBe(308); // The second card is still entirely visible.
    click("Previous world");
    expect(rail.scrollLeft).toBe(0);
    for (const entry of cards) {
        expect(entry.getBoundingClientRect).not.toHaveBeenCalled();
        expect(entry.scrollIntoView).not.toHaveBeenCalled();
    }
    expect(onSelect).not.toHaveBeenCalled();
});

test("the hovered world is highlighted until the pointer leaves", () => {
    discovery.cards = [
        card,
        { ...card, id: "second", title: "Second world", href: "/second" },
        { ...card, id: "third", title: "Third world", href: "/third" },
    ];
    render();
    const cards = railCards();
    const selected = () =>
        cards.filter((entry) => entry.getAttribute("data-selected") === "true");
    expect(selected()).toHaveLength(1);
    act(() => Simulate.pointerEnter(cards[2], { pointerType: "mouse" } as any));
    expect(selected()).toEqual([cards[2]]);
    act(() => Simulate.pointerLeave(cards[2], { pointerType: "mouse" } as any));
    expect(selected()).toHaveLength(1);
    expect(selected()[0]).not.toBe(cards[2]);
});
