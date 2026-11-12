/** @jest-environment jsdom */
import React from "react";
import { createRoot } from "react-dom/client";
import Scene from "./Scene";
import { BUILD_CARDS } from "../buildOptions";

// Setup cards are form cells: the grid renders them through renderCard.
const SETUP_CARDS = ["source", "name", "settings", "create"].map((part) => ({
    ...BUILD_CARDS[0],
    id: `setup-form-${part}`,
    title: part,
    href: "",
    imageUrls: [],
}));

const act = (React as any).act;
(global as any).IS_REACT_ACT_ENVIRONMENT = true;
jest.mock("@components/context/UserContext", () => ({
    UserContext: require("react").createContext({ user: null }),
}));
jest.mock("@components/InAppLink", () => ({
    __esModule: true,
    default: ({ children, href, legacyBehavior }) =>
        legacyBehavior ? (
            require("react").cloneElement(children, { href })
        ) : (
            <a href={href}>{children}</a>
        ),
}));
jest.mock("@utils/analytics", () => ({
    amplitude_logAnalyticsEvent: jest.fn(),
}));
jest.mock("../three/pool", () => ({ CardPool: jest.fn() }));
jest.mock("../activity", () => {
    const signal = jest.fn();
    return {
        useActivitySignal: () => signal,
        useLandingBusy: jest.fn(),
        useLandingActivity: () => null,
    };
});
let root: ReturnType<typeof createRoot>, container: HTMLDivElement;
const navigate = jest.fn();
const renderCard = (card) =>
    card.id.endsWith("source") ? (
        <textarea aria-label="Brief" defaultValue="My idea" />
    ) : (
        <button type="button">Configure</button>
    );
function render(columns = 2, content = renderCard) {
    act(() =>
        root.render(
            <Scene
                cards={SETUP_CARDS}
                renderCard={content}
                active
                creating
                contentKey="setup:form"
                resetKey="setup:form"
                onCreate={navigate}
                flat={false}
                onFlatView={navigate}
                columns={columns}
                visibleRows={columns}
                viewControls={null}
                hasMore={false}
                loadingMore={false}
                error={false}
                loadMore={navigate}
            />
        )
    );
    act(() => jest.advanceTimersByTime(32));
}
beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    window.matchMedia = jest.fn(() => ({
        matches: true,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
    })) as any;
    global.requestAnimationFrame = ((callback) =>
        setTimeout(() => callback(performance.now()), 16)) as any;
    global.cancelAnimationFrame = ((id) => clearTimeout(id)) as any;
    (global as any).ResizeObserver = class {
        constructor(private callback) {}
        observe() {
            this.callback();
        }
        disconnect() {}
    };
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
        configurable: true,
        get: () => 1000,
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
        configurable: true,
        get: () => 500,
    });
    HTMLElement.prototype.scrollTo = function (options: any) {
        this.scrollLeft = options.left;
    };
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.useRealTimers();
});
it("positions editable cards with the existing geometry and keeps inputs mounted as content updates", () => {
    render();
    const panels = container.querySelectorAll<HTMLElement>("[data-grid-form]");
    expect(panels).toHaveLength(4);
    expect(panels[0].style.width).not.toBe("");
    expect(panels[0].style.width).toBe(panels[3].style.width);
    expect(panels[0].style.clipPath).toContain("polygon(");
    expect(container.querySelector("canvas")).toBeNull();
    const input = container.querySelector("textarea");
    input.value = "Keep this draft";
    input.focus();
    render(2, (card) => renderCard(card));
    expect(container.querySelector("textarea")).toBe(input);
    expect(input.value).toBe("Keep this draft");
    expect(document.activeElement).toBe(input);
});
it("leaves editing keys and textarea scrolling native while keeping grid navigation available", () => {
    render(1);
    const input = container.querySelector("textarea");
    input.focus();
    const key = new KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
        cancelable: true,
    });
    input.dispatchEvent(key);
    expect(key.defaultPrevented).toBe(false);
    const innerWheel = new WheelEvent("wheel", {
        deltaY: 100,
        bubbles: true,
        cancelable: true,
    });
    input.dispatchEvent(innerWheel);
    expect(innerWheel.defaultPrevented).toBe(false);
    const viewport = container.querySelector<HTMLElement>('[role="region"]');
    expect(viewport.scrollLeft).toBe(0);
    const gridWheel = new WheelEvent("wheel", {
        deltaY: 100,
        bubbles: true,
        cancelable: true,
    });
    act(() => viewport.dispatchEvent(gridWheel));
    expect(gridWheel.defaultPrevented).toBe(true);
    expect(viewport.scrollLeft).toBeGreaterThan(0);
});
it("removes offscreen form controls from navigation in the single-card layout", () => {
    render(1);
    const panels = container.querySelectorAll("[data-grid-form]");
    expect(panels[0].hasAttribute("inert")).toBe(false);
    expect(panels[1].hasAttribute("inert")).toBe(true);
    expect(panels[3].hasAttribute("inert")).toBe(true);
});
