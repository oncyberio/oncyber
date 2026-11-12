/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import EmptyState from "./index";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
});
const render = (element: React.ReactElement) => act(() => root.render(element));
const status = () => container.querySelector('[role="status"]');

it("says what is missing in one line, with a small icon and no action", () => {
    render(<EmptyState icon="activity" title="No activity yet." />);
    expect(status().textContent).toBe("No activity yet.");
    expect(status().querySelector("svg").getAttribute("aria-hidden")).toBe(
        "true"
    );
    expect(status().querySelector("button")).toBeNull();
    expect(status().getAttribute("data-surface")).toBe("dark");
    expect(status().getAttribute("data-size")).toBe("inline");
});

it("offers one action, outline unless told otherwise", () => {
    const onClick = jest.fn();
    render(
        <EmptyState
            icon="search"
            title="No matching destinations."
            detail="Try another search or remove a filter."
            action={{ label: "Show all destinations", onClick }}
        />
    );
    expect(status().textContent).toBe(
        "No matching destinations.Try another search or remove a filter.Show all destinations"
    );
    const buttons = status().querySelectorAll("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0].type).toBe("button");
    expect(buttons[0].getAttribute("data-variant")).toBe("outline");
    act(() => buttons[0].click());
    expect(onClick).toHaveBeenCalledTimes(1);
});

it("uses the blue action to sign in and a heading on a page", () => {
    render(
        <EmptyState
            size="page"
            titleAs="h1"
            icon="globe"
            title="Your destinations, in one place."
            action={{ label: "Sign in", onClick: jest.fn(), variant: "blue" }}
        />
    );
    expect(status().querySelector("h1").textContent).toBe(
        "Your destinations, in one place."
    );
    expect(status().querySelector("button").getAttribute("data-variant")).toBe(
        "blue"
    );
    expect(status().getAttribute("data-size")).toBe("page");
});

it("announces a failed load as an alert and suits a light panel", () => {
    render(
        <EmptyState
            role="alert"
            surface="light"
            title="Couldn’t load your destinations."
            action={{ label: "Try again", onClick: jest.fn() }}
        />
    );
    const alert = container.querySelector('[role="alert"]');
    expect(alert.getAttribute("data-surface")).toBe("light");
    expect(alert.querySelector(".empty-state-icon")).toBeNull();
});

it("never renders an emoji of its own", () => {
    render(<EmptyState icon="tag" title="No listings yet." />);
    expect(status().textContent).not.toMatch(/\p{Extended_Pictographic}/u);
});
