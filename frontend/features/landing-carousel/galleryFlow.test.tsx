/** @jest-environment jsdom */
import React from "react";
import { createRoot, Root } from "react-dom/client";
import LandingCarouselPage from "./index";
import type { LandingCard, LandingPageProps } from "./types";

const act = (React as any).act;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const mockRouter = {
    pathname: "/",
    query: {} as Record<string, string>,
    push: jest.fn().mockResolvedValue(true),
    events: { on: jest.fn(), off: jest.fn() },
};
const mockOpenTemplate = jest.fn();
let mockTemplateCards: LandingCard[];
let mockUserData;
const mockAvatarPreload = jest.fn();
const mockFrames = new Map<number, FrameRequestCallback>();
const mockIdleCallbacks = new Map<number, IdleRequestCallback>();
let mockCallbackId = 0;

jest.mock("@components/context/UserContext", () => ({
    UserContext: require("react").createContext({
        get userData() {
            return mockUserData;
        },
    }),
}));
jest.mock(
    "../lobby/LobbyRenderer",
    () => ({
        preloadLobbyRendererAvatar: (...args) => mockAvatarPreload(...args),
    }),
    { virtual: true }
);

jest.mock("next/router", () => ({ useRouter: () => mockRouter }));
// Keep the page's dynamic-loading behavior while replacing only its expensive
// grid renderer and authenticated catalog data source below.
jest.mock("next/dynamic", () => ({
    __esModule: true,
    default: (loader) => {
        const React = require("react");
        const Component = React.lazy(loader);
        return (props) => (
            <React.Suspense fallback={null}>
                <Component {...props} />
            </React.Suspense>
        );
    },
}));
jest.mock("./hooks/useDiscovery", () => ({
    __esModule: true,
    default: (props) => ({
        filters: props.initialFilters,
        cards: props.initialFeed.cards,
        resultKey: "worlds",
        loading: false,
        hasMore: false,
        loadingMore: false,
        update: jest.fn(),
        reset: jest.fn(),
        loadMore: jest.fn(),
    }),
}));
jest.mock("./hooks/useDestinationPreviews", () => ({
    __esModule: true,
    default: (cards) => cards,
}));
jest.mock("../lobby/Lobby", () => ({
    __esModule: true,
    default: ({ onExit }) => (
        <section data-test-lobby>
            <button onClick={onExit}>Leave lobby</button>
        </section>
    ),
}));
jest.mock("./components/Header", () => ({
    __esModule: true,
    default: ({ menu }) => <header>{menu}</header>,
}));
jest.mock("./components/DiscoveryHeader", () => ({
    __esModule: true,
    default: ({ templates, createControl, immersive }) => (
        <header data-catalog-filters={!!templates}>
            {!immersive && createControl}
        </header>
    ),
}));
jest.mock("./components/ExperienceCard", () => ({ CoverImage: () => null }));
jest.mock("./components/TemplateCatalog", () => ({
    __esModule: true,
    default: ({ active, onChange, query, category }) => {
        require("react").useEffect(() => {
            onChange({
                cards: mockTemplateCards,
                loading: false,
                opening: false,
                checking: false,
                error: "",
                open: mockOpenTemplate,
            });
        }, [active, onChange, query, category]);
        return <div data-catalog hidden={!active} data-query={query} />;
    },
}));
jest.mock("./components/Scene", () => ({
    __esModule: true,
    default: ({
        active,
        cards,
        creating,
        onCreate,
        onCardActivate,
        renderCard,
        viewControls,
        footerStart,
    }) => (
        <section data-scene hidden={!active}>
            {footerStart ?? (
                <button data-create aria-pressed={creating} onClick={onCreate}>
                    Create
                </button>
            )}
            {viewControls}
            {cards.map((card) => (
                <button
                    key={card.id}
                    data-card
                    onClick={() => onCardActivate(card)}
                >
                    {renderCard?.(card) || card.title}
                </button>
            ))}
        </section>
    ),
}));

const gallery = {
    id: "template-whitecube",
    room: "whitecube",
    title: "White Cube",
    href: "/studio?templateId=whitecube",
    imageUrls: ["/whitecube.jpg"],
} as LandingCard;
const props: LandingPageProps = {
    initialFilters: {
        q: "rayan",
        category: "latest",
        chain: "ethereum",
        owner: "",
        collection: "",
    },
    initialFeed: {
        cards: [{ ...gallery, id: "world", title: "Rayan's gallery" }],
        cursor: "",
        hasMore: false,
    },
    initialError: false,
};
let root: Root, container: HTMLDivElement;
async function render(
    query = mockRouter.query,
    pathname = mockRouter.pathname
) {
    mockRouter.query = query;
    mockRouter.pathname = pathname;
    await act(async () => root.render(<LandingCarouselPage {...props} />));
}
async function click(selector: string) {
    const button = container.querySelector<HTMLButtonElement>(selector);
    expect(button).not.toBeNull();
    await act(async () => button.click());
}
async function applyNavigation() {
    const [route] = mockRouter.push.mock.calls.at(-1);
    await render(route.query, route.pathname);
}
function titles() {
    return Array.from(
        container.querySelectorAll("[data-card]"),
        (card) => card.textContent
    );
}
beforeEach(() => {
    jest.clearAllMocks();
    mockRouter.pathname = "/";
    mockRouter.query = { q: "rayan", category: "latest", chain: "ethereum" };
    mockTemplateCards = [gallery];
    mockUserData = { settings: { vrm: "square" }, walletId: "test-wallet" };
    mockAvatarPreload
        .mockReset()
        .mockResolvedValue({ id: "square", url: "/square.glb" });
    mockFrames.clear();
    mockIdleCallbacks.clear();
    jest.spyOn(document, "hidden", "get").mockReturnValue(false);
    jest.spyOn(window, "requestAnimationFrame").mockImplementation(
        (callback) => {
            const id = ++mockCallbackId;
            mockFrames.set(id, callback);
            return id;
        }
    );
    jest.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
        mockFrames.delete(id);
    });
    window.requestIdleCallback = jest.fn((callback) => {
        const id = ++mockCallbackId;
        mockIdleCallbacks.set(id, callback);
        return id;
    });
    window.cancelIdleCallback = jest.fn((id) => mockIdleCallbacks.delete(id));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    jest.restoreAllMocks();
});

it("opens the gallery catalog in one click, activates its templates, and returns to browsing in one click", async () => {
    await render();
    const browseQuery = { ...mockRouter.query };
    expect(titles()).toEqual(["Rayan's gallery"]);
    // Fetch the catalog in the background without replacing the browse cards.
    expect(container.querySelector("[data-catalog]")).not.toBeNull();
    expect(
        container.querySelector("[data-catalog]").hasAttribute("hidden")
    ).toBe(true);
    await click("#open-create");
    expect(mockRouter.push).toHaveBeenLastCalledWith(
        { pathname: "/", query: { ...browseQuery, create: "gallery" } },
        undefined,
        { shallow: true, scroll: false }
    );
    await applyNavigation();
    expect(titles()).toEqual(["White Cube"]);
    expect(
        container.querySelector("[data-catalog]").hasAttribute("hidden")
    ).toBe(false);
    expect(
        container.querySelector('[aria-label="Search gallery templates"]')
    ).not.toBeNull();
    expect(container.textContent).not.toMatch(
        /Gaussian|Games|Videos|creation assistant/i
    );
    await click("[data-card]");
    expect(mockOpenTemplate).toHaveBeenCalledWith(gallery);
    await click("#open-create");
    expect(mockRouter.push).toHaveBeenLastCalledWith(
        { pathname: "/", query: browseQuery },
        undefined,
        { shallow: true, scroll: false }
    );
    await applyNavigation();
    expect(titles()).toEqual(["Rayan's gallery"]);
    expect(
        container.querySelector(
            '[aria-label="Search worlds, artists, and creators"]'
        )
    ).not.toBeNull();

    // Restoring the previous URL (browser Back/Forward) restores its catalog
    // context and saved template query, never the retired type chooser.
    await render({ ...browseQuery, create: "choose", templateSearch: "white" });
    expect(titles()).toEqual(["White Cube"]);
    expect(container.querySelector<HTMLInputElement>("input").value).toBe(
        "white"
    );
    await render(browseQuery);
    expect(titles()).toEqual(["Rayan's gallery"]);
});
it.each(["new-gallery", "new-splat"])(
    "keeps /studio/%s in the gallery flow and exits without reopening its route default",
    async (route) => {
        await render({}, `/studio/${route}`);
        expect(titles()).toEqual(["White Cube"]);
        await click("#open-create");
        expect(mockRouter.push.mock.calls.at(-1)[0]).toEqual({
            pathname: `/studio/${route}`,
            query: { create: "explore" },
        });
        await applyNavigation();
        expect(titles()).toEqual(["Rayan's gallery"]);
    }
);
it("can leave Create when the gallery search has no matches", async () => {
    mockTemplateCards = [];
    await render({ create: "gallery", templateSearch: "missing" });
    expect(container.textContent).toContain("No matching rooms.");
    await click("#open-create");
    await applyNavigation();
    expect(mockRouter.query.create).toBeUndefined();
    expect(titles()).toEqual(["Rayan's gallery"]);
});

it("allows Escape to leave an empty gallery search", async () => {
    mockTemplateCards = [];
    await render({ create: "gallery", templateSearch: "missing" });
    await act(async () => {
        document.body.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
        );
    });
    await applyNavigation();
    expect(mockRouter.query.create).toBeUndefined();
    expect(titles()).toEqual(["Rayan's gallery"]);
});

it("keeps the normal gallery Create action without a separate game button", async () => {
    await render();
    expect(
        Array.from(container.querySelectorAll("button")).some(
            (button) => button.textContent === "Create game"
        )
    ).toBe(false);
    await click("#open-create");
    await applyNavigation();
    expect(mockRouter.query.create).toBe("gallery");
    expect(container.querySelectorAll("[data-game-card]")).toHaveLength(0);
});

it("enters the lobby without losing discovery filters and restores browsing with browser Back", async () => {
    await render();
    const browseQuery = { ...mockRouter.query };
    const jump = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent.includes("Jump In")
    );
    expect(jump).toBeTruthy();
    await act(async () => jump.click());
    expect(mockRouter.push).toHaveBeenLastCalledWith(
        { pathname: "/", query: { ...browseQuery, lobby: "1" } },
        undefined,
        { shallow: true, scroll: false }
    );
    await applyNavigation();
    expect(container.querySelector("[data-test-lobby]")).not.toBeNull();
    expect(container.querySelector("main").hasAttribute("inert")).toBe(true);
    expect(
        container.querySelector(
            '[aria-label="Search worlds, artists, and creators"]'
        )
    ).toBeNull();
    await render(browseQuery);
    expect(container.querySelector("[data-test-lobby]")).toBeNull();
    expect(container.querySelector("main").hasAttribute("inert")).toBe(false);
    expect(titles()).toEqual(["Rayan's gallery"]);
});

async function paintAndIdle() {
    await act(async () => {
        for (let paint = 0; paint < 2; paint++) {
            const callbacks = [...mockFrames.values()];
            mockFrames.clear();
            callbacks.forEach((callback) => callback(performance.now()));
        }
        const callbacks = [...mockIdleCallbacks.values()];
        mockIdleCallbacks.clear();
        callbacks.forEach((callback) =>
            callback({ didTimeout: false, timeRemaining: () => 50 })
        );
    });
}

it("warms the saved native avatar after painting without mounting or entering the lobby", async () => {
    await render();
    expect(mockAvatarPreload).not.toHaveBeenCalled();
    expect(container.querySelector("[data-test-lobby]")).toBeNull();
    await paintAndIdle();
    expect(mockAvatarPreload).toHaveBeenCalledTimes(1);
    expect(mockAvatarPreload).toHaveBeenCalledWith(mockUserData);
    expect(container.querySelector("[data-test-lobby]")).toBeNull();
    expect(mockRouter.push).not.toHaveBeenCalled();
});

it("uses Jump In focus to start the same avatar warm-up early and deduplicates idle work", async () => {
    await render();
    await act(async () =>
        container.querySelector<HTMLButtonElement>(".jump-in").focus()
    );
    expect(mockAvatarPreload).toHaveBeenCalledTimes(1);
    await paintAndIdle();
    expect(mockAvatarPreload).toHaveBeenCalledTimes(1);
    expect(container.querySelector("[data-test-lobby]")).toBeNull();
});

it("warms a newly selected avatar and retries an opportunistic failure on intent", async () => {
    await render();
    await paintAndIdle();
    mockAvatarPreload.mockRejectedValueOnce(
        new Error("temporary asset failure")
    );
    mockUserData = { ...mockUserData, settings: { vrm: "pepe" } };
    await render();
    await paintAndIdle();
    expect(mockAvatarPreload).toHaveBeenLastCalledWith(mockUserData);
    await act(async () =>
        container.querySelector<HTMLButtonElement>(".jump-in").focus()
    );
    expect(mockAvatarPreload).toHaveBeenCalledTimes(3);
});

it("defers avatar work while the document is hidden and cancels it on leaving browse", async () => {
    const hidden = jest.spyOn(document, "hidden", "get").mockReturnValue(true);
    await render();
    await paintAndIdle();
    expect(mockAvatarPreload).not.toHaveBeenCalled();
    hidden.mockReturnValue(false);
    await act(async () =>
        document.dispatchEvent(new Event("visibilitychange"))
    );
    expect(mockFrames.size).toBe(1);
    await render({ ...mockRouter.query, create: "gallery" });
    await paintAndIdle();
    expect(mockAvatarPreload).not.toHaveBeenCalled();
});
