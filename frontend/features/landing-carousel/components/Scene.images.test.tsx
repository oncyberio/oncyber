/** @jest-environment jsdom */
import React from "react";
import { createRoot } from "react-dom/client";
import { WebGLRenderer } from "three";
import { CardPool } from "../three/pool";
import { BUILD_CARDS } from "../buildOptions";
import Scene from "./Scene";
import { createColumnScroller } from "../columnScroller";
import { useLandingActivity } from "../activity";
const act = (React as any).act;
(global as any).IS_REACT_ACT_ENVIRONMENT = true;
jest.mock("@components/context/UserContext", () => ({
    UserContext: require("react").createContext({ user: null }),
}));
jest.mock("@utils/analytics", () => ({
    amplitude_logAnalyticsEvent: jest.fn(),
}));
jest.mock("@components/InAppLink", () => ({
    __esModule: true,
    default: ({ children, href }) => <a href={href}>{children}</a>,
}));
jest.mock("./ExperienceCard", () => ({
    __esModule: true,
    default: require("react").forwardRef(
        ({ card, flat, featured, ...props }, ref) => (
            <a ref={ref} href={card.href} {...props}>
                {card.title}
            </a>
        )
    ),
}));
jest.mock("../activity", () => {
    const signal = jest.fn();
    const activity = jest.requireActual("../activity").createActivityStore();
    return {
        useActivitySignal: () => signal,
        useLandingBusy: jest.fn(),
        useLandingActivity: () => activity,
    };
});
jest.mock("three", () => ({
    ...jest.requireActual("three"),
    WebGLRenderer: jest.fn().mockImplementation(() => ({
        setPixelRatio: jest.fn(),
        setClearColor: jest.fn(),
        setSize: jest.fn(),
        render: jest.fn(),
        dispose: jest.fn(),
    })),
}));
jest.mock("../three/pool", () => ({
    CardPool: jest.fn().mockImplementation(() => ({
        group: new (require("three").Group)(),
        update: jest.fn(),
        dispose: jest.fn(),
    })),
}));
jest.mock("../columnScroller", () => ({
    createColumnScroller: jest.fn(
        jest.requireActual("../columnScroller").createColumnScroller
    ),
}));
let root: ReturnType<typeof createRoot>, container: HTMLDivElement;
const navigate = jest.fn();
const covers = BUILD_CARDS.slice(0, 3).map((card, i) => ({
    ...card,
    id: `world-${i}`,
    imageUrls: [`/${i}.jpg`],
}));
function render(
    cards = covers,
    key = "all",
    active = true,
    options: Partial<React.ComponentProps<typeof Scene>> = {}
) {
    act(() =>
        root.render(
            <Scene
                cards={cards}
                active={active}
                contentKey={`explore:${key}`}
                resetKey={key}
                onCreate={navigate}
                flat={false}
                onFlatView={navigate}
                columns={2}
                visibleRows={2}
                viewControls={null}
                hasMore={false}
                loadingMore={false}
                error={false}
                loadMore={navigate}
                {...options}
            />
        )
    );
}
beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    window.matchMedia = jest.fn(() => ({
        matches: false,
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

function worlds(count: number, start = 0) {
    return Array.from({ length: count }, (_, i) => ({
        ...covers[0],
        id: `paged-${start + i}`,
        imageUrls: [`/${start + i}.jpg`],
    }));
}

it("prefetches near the end and pauses during a request, on errors, and at the true end", () => {
    const cards = worlds(30);
    render(cards, "latest", true, { hasMore: true });
    expect(navigate).not.toHaveBeenCalled();
    const viewport = container.querySelector('[role="region"]') as HTMLElement;
    act(() => {
        viewport.scrollLeft = 3600;
        viewport.dispatchEvent(new Event("scroll"));
        jest.advanceTimersByTime(32);
    });
    expect(navigate).toHaveBeenCalledTimes(1);
    render([...cards, ...worlds(50, 30)], "latest", true, { hasMore: true });
    expect(navigate).toHaveBeenCalledTimes(1);
    navigate.mockClear();
    render(cards, "latest", true, { hasMore: true, loadingMore: true });
    render(cards, "latest", true, { hasMore: true, error: true });
    expect(navigate).not.toHaveBeenCalled();
    render(cards, "latest", true, { hasMore: false });
    expect(navigate).not.toHaveBeenCalled();
});

it("preserves scroll position and in-flight navigation while another page appends", () => {
    const first = worlds(30);
    render(first);
    const scroller = (createColumnScroller as jest.Mock).mock.results[0].value;
    const dispose = jest.spyOn(scroller, "dispose");
    const viewport = container.querySelector('[role="region"]') as HTMLElement;
    act(() => {
        scroller.goTo(6);
        jest.advanceTimersByTime(48);
    });
    const position = viewport.scrollLeft;
    expect(position).toBeGreaterThan(0);
    render([...first, ...worlds(50, 30)]);
    expect(viewport.scrollLeft).toBe(position);
    expect(createColumnScroller).toHaveBeenCalledTimes(1);
    expect(dispose).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(240));
    expect(viewport.scrollLeft).toBeGreaterThan(position);
});

it("keeps DOM cards bounded as the feed grows and mounts the current window", () => {
    render(worlds(1000));
    expect(container.querySelectorAll("[data-card-id]").length).toBeLessThan(
        32
    );
    const viewport = container.querySelector('[role="region"]') as HTMLElement;
    act(() => {
        viewport.scrollLeft = 40000;
        viewport.dispatchEvent(new Event("scroll"));
        jest.advanceTimersByTime(32);
    });
    expect(container.querySelectorAll("[data-card-id]").length).toBeLessThan(
        32
    );
    expect(container.querySelector('[data-card-id="paged-0"]')).toBeNull();
    expect(
        container.querySelector('[data-card-id][aria-current="true"]')
    ).not.toBeNull();
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.useRealTimers();
});
it("reuses its canvas, renderer, textures and drawing-buffer size while live search changes cards", () => {
    render();
    const canvas = container.querySelector("canvas");
    const renderer = (WebGLRenderer as jest.Mock).mock.results[0].value;
    const pool = (CardPool as jest.Mock).mock.results[0].value;
    const sizes = renderer.setSize.mock.calls.length;
    render([covers[1]], "first query");
    render([covers[2], covers[1]], "narrow query");
    render(covers, "cleared");
    expect(container.querySelector("canvas")).toBe(canvas);
    expect(WebGLRenderer).toHaveBeenCalledTimes(1);
    expect(CardPool).toHaveBeenCalledTimes(1);
    expect(renderer.setSize).toHaveBeenCalledTimes(sizes);
    expect(renderer.dispose).not.toHaveBeenCalled();
    expect(pool.dispose).not.toHaveBeenCalled();
    // New card bindings are drawn in the layout pass, before another animation frame.
    expect(pool.update).toHaveBeenLastCalledWith(
        covers,
        expect.any(Array),
        expect.any(Object),
        0,
        "",
        expect.any(Function)
    );
});
it("retains image resources while empty results hide the grid, and releases them on unmount", () => {
    render();
    const renderer = (WebGLRenderer as jest.Mock).mock.results[0].value;
    const pool = (CardPool as jest.Mock).mock.results[0].value;
    render(covers, "no results", false);
    expect((container.firstElementChild as HTMLElement).style.display).toBe(
        "none"
    );
    expect(renderer.dispose).not.toHaveBeenCalled();
    render(covers, "cleared", true);
    expect(WebGLRenderer).toHaveBeenCalledTimes(1);
    act(() => root.render(null));
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
    expect(pool.dispose).toHaveBeenCalledTimes(1);
});

it("does not prefetch a new feed using the hidden previous feed's range", () => {
    const previous = worlds(100);
    render(previous, "popular");
    const viewport = container.querySelector('[role="region"]') as HTMLElement;
    act(() => {
        viewport.scrollLeft = 15000;
        viewport.dispatchEvent(new Event("scroll"));
        jest.advanceTimersByTime(32);
    });
    render(previous, "labs", false, { hasMore: false });
    render(worlds(30, 100), "labs", true, { hasMore: true });
    expect(navigate).not.toHaveBeenCalled();
    expect(viewport.scrollLeft).toBe(0);
});

it("publishes the rendered scroll progress through navigation, reversal, and resets", () => {
    render(worlds(30));
    const activity = useLandingActivity();
    const options = (createColumnScroller as jest.Mock).mock.calls[0][0];
    const scroller = (createColumnScroller as jest.Mock).mock.results[0].value;
    const viewport = container.querySelector('[role="region"]') as HTMLElement;
    expect(activity.getScrollProgress()).toBe(0);
    act(() => scroller.goTo(2));
    for (let i = 0; i < 8; i++) {
        act(() => jest.advanceTimersByTime(32));
        const pool = (CardPool as jest.Mock).mock.results[0].value;
        const rendered =
            pool.update.mock.calls[pool.update.mock.calls.length - 1][3];
        expect(activity.getScrollProgress()).toBe(rendered);
    }
    expect(activity.getScrollProgress()).toBe(2);
    act(() => {
        scroller.wheel(-options.stride() / 2);
        jest.advanceTimersByTime(32);
    });
    expect(activity.getScrollProgress()).toBeCloseTo(1.5);
    expect(activity.getScrollProgress()).toBe(
        viewport.scrollLeft / options.stride()
    );
    render(worlds(30), "new feed");
    act(() => jest.advanceTimersByTime(600));
    expect(activity.getScrollProgress()).toBe(0);
});

it("keeps destination previews visible while a management dialog blocks grid input", () => {
    render(worlds(20), "destinations", true, {
        interactionsBlocked: true,
        createLabel: "Upload destination",
        createTitle: "Upload a gallery destination",
        featuredActionLabel: "Manage destination",
        columns: 1,
        visibleRows: 1,
        counterLabel: "destinations",
    });
    const viewport = container.querySelector<HTMLElement>('[role="region"]');
    const before = viewport.scrollLeft;
    expect(
        container
            .querySelector("[data-grid-content]")
            .getAttribute("aria-hidden")
    ).toBeNull();
    expect(container.querySelector("#open-create").textContent).toContain(
        "Upload destination"
    );
    expect(container.textContent).toContain("Manage destination");
    act(() => {
        document.dispatchEvent(
            new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
        );
        viewport.dispatchEvent(
            new WheelEvent("wheel", {
                deltaY: 500,
                bubbles: true,
                cancelable: true,
            })
        );
        jest.advanceTimersByTime(200);
    });
    expect(viewport.scrollLeft).toBe(before);
    render(worlds(20), "destinations", true, { interactionsBlocked: false });
    act(() => {
        viewport.dispatchEvent(
            new WheelEvent("wheel", {
                deltaY: 500,
                bubbles: true,
                cancelable: true,
            })
        );
        jest.advanceTimersByTime(64);
    });
    expect(viewport.scrollLeft).toBeGreaterThan(before);
});
