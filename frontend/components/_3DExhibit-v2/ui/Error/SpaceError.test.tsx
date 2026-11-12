/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import SpaceError from "./index";

const mockPush = jest.fn(async () => true);
jest.mock("next/router", () => ({
    useRouter: () => ({ push: mockPush, replace: mockPush, asPath: "/space" }),
}));
jest.mock("@components/Dialogs", () => ({ showError: jest.fn() }));

let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.clearAllMocks();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

const render = (props) => act(() => root.render(<SpaceError {...props} />));
const backLink = () => container.querySelector("a");
const retryButton = () => container.querySelector("button");

test("a missing destination gets plain copy and both actions, never the internal code", () => {
    render({
        worldState: {
            type: "ERROR",
            error: "no-destination",
            kind: "destination-unavailable",
        },
    });
    expect(container.querySelector("h1").textContent).toBe(
        "This world didn’t load"
    );
    expect(container.querySelector("p").textContent).toBe(
        "Check your connection and try again."
    );
    expect(container.textContent).not.toContain("no-destination");
    expect(retryButton().textContent).toBe("Try again");
    expect(backLink().textContent).toBe("Back to exploring");
    expect(backLink().getAttribute("href")).toBe("/");
});

test("other load errors keep their own title and message on the same screen", () => {
    render({
        worldState: {
            type: "ERROR",
            kind: "load-failed",
            title: "Failed to load VRM",
            error: "Please check that your model only is one mesh.",
        },
    });
    expect(container.querySelector("h1").textContent).toBe(
        "Failed to load VRM"
    );
    expect(container.querySelector("p").textContent).toBe(
        "Please check that your model only is one mesh."
    );
    expect(retryButton().textContent).toBe("Try again");
    expect(backLink().textContent).toBe("Back to exploring");
});

test.each([
    ["an owner outside the dashboard", { editMode: true }],
    ["an error with no details", {}],
])("renders for %s", (_name, props) => {
    expect(() =>
        render({ worldState: { type: "ERROR" }, ...props })
    ).not.toThrow();
    expect(container.querySelector("h1").textContent).toBe(
        "This world didn’t load"
    );
    expect(retryButton()).not.toBeNull();
    expect(backLink()).not.toBeNull();
});

test("Try again reloads the page", () => {
    const { location } = window;
    const reload = jest.fn();
    delete (window as any).location;
    (window as any).location = { reload };
    try {
        render({
            worldState: { type: "ERROR", kind: "destination-unavailable" },
        });
        act(() => retryButton().click());
        expect(reload).toHaveBeenCalledTimes(1);
    } finally {
        (window as any).location = location;
    }
});

test("Back to exploring leaves for the home page", async () => {
    render({ worldState: { type: "ERROR", kind: "destination-unavailable" } });
    await act(async () => {
        backLink().click();
        for (let i = 0; i < 10; i++) await Promise.resolve();
    });
    expect(mockPush).toHaveBeenCalledWith("/", undefined, {
        scroll: true,
        shallow: false,
    });
});

const details = {
    name: "Error",
    message: "Failed to parse glft file of the room",
    step: "world-model",
    address: "https://oncyber.test/spaces/gallery",
    time: "2026-11-10T12:00:00.000Z",
    browser: "TestBrowser/1.0",
};
const detailsText = [
    "Error: Error: Failed to parse glft file of the room",
    "Step: world-model",
    "World: https://oncyber.test/spaces/gallery",
    "Time: 2026-11-10T12:00:00.000Z",
    "Browser: TestBrowser/1.0",
].join("\n");
const failedModel = {
    type: "ERROR",
    kind: "world-model",
    title: "This world’s 3D model didn’t load",
    error: "Try again in a moment, or tell the world’s creator if it keeps happening.",
    details,
};
const button = (name: string) =>
    [...container.querySelectorAll("button")].find(
        (item) =>
            item.textContent === name ||
            item.getAttribute("aria-label") === name
    );
const setClipboard = (clipboard) =>
    Object.defineProperty(navigator, "clipboard", {
        value: clipboard,
        configurable: true,
    });

test("a kind with no title or message of its own shows that kind's plain copy", () => {
    render({ worldState: { type: "ERROR", kind: "graphics" } });
    expect(container.querySelector("h1").textContent).toBe(
        "3D graphics couldn’t start"
    );
    expect(container.querySelector("p").textContent).toBe(
        "Close other tabs that use 3D, then try again or use another browser."
    );
});

test("the technical text stays collapsed until Show details", () => {
    render({ worldState: failedModel });
    expect(container.textContent).not.toContain("glft");
    const toggle = button("Show details");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    // The two main actions come first, as before.
    expect(retryButton().textContent).toBe("Try again");
    act(() => toggle.click());
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.textContent).toBe("Hide details");
    const pre = container.querySelector("pre");
    expect(pre.textContent).toBe(detailsText);
    expect(toggle.getAttribute("aria-controls")).toBe(pre.parentElement.id);
    act(() => toggle.click());
    expect(container.querySelector("pre")).toBeNull();
    expect(button("Show details")).toBeDefined();
});

test("no details, no control", () => {
    render({ worldState: { type: "ERROR", kind: "load-failed" } });
    expect(button("Show details")).toBeUndefined();
});

test("the copy button copies the details as plain text and says so briefly", async () => {
    jest.useFakeTimers();
    const writeText = jest.fn(async () => undefined);
    setClipboard({ writeText });
    try {
        render({ worldState: failedModel });
        act(() => button("Show details").click());
        const copy = button("Copy details");
        expect(copy.querySelector("svg")).not.toBeNull();
        await act(async () => copy.click());
        expect(writeText).toHaveBeenCalledWith(detailsText);
        const status = container.querySelector('[role="status"]');
        expect(status.textContent).toBe("Copied");
        act(() => jest.advanceTimersByTime(2000));
        expect(status.textContent).toBe("");
    } finally {
        setClipboard(undefined);
        jest.useRealTimers();
    }
});

test.each([
    ["is missing", undefined],
    [
        "refuses",
        {
            writeText: jest.fn(async () => {
                throw new Error("denied");
            }),
        },
    ],
])(
    "when the clipboard %s, the details are selected instead",
    async (_name, clipboard) => {
        setClipboard(clipboard);
        try {
            render({ worldState: failedModel });
            act(() => button("Show details").click());
            window.getSelection().removeAllRanges();
            await act(async () => button("Copy details").click());
            expect(window.getSelection().toString()).toBe(detailsText);
            expect(container.querySelector('[role="status"]').textContent).toBe(
                "Selected, ready to copy"
            );
        } finally {
            setClipboard(undefined);
        }
    }
);
