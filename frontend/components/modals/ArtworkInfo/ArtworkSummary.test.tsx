/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import { ArtworkSummary } from "./ArtworkSummary";

let node: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const asset = {
    id: "one",
    name: "An artwork title that must remain available in full, even when the visual line is truncated",
    description: "A long description. ".repeat(16),
};
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    node = document.createElement("div");
    document.body.appendChild(node);
    root = createRoot(node);
});
afterEach(() => {
    act(() => root.unmount());
    node.remove();
});
function render(next = asset) {
    act(() => root.render(<ArtworkSummary asset={next} />));
}
const toggle = () => node.querySelector<HTMLButtonElement>("button");

test("keeps the full title and description with an explicit, reversible See more action", () => {
    render();
    expect(node.querySelector("h2").textContent).toBe(asset.name);
    expect(node.querySelector("h2").title).toBe(asset.name);
    expect(node.querySelector(".text").textContent).toBe(
        asset.description.trim()
    );
    expect(toggle().textContent).toBe("See more");
    expect(toggle().type).toBe("button");
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(toggle().getAttribute("aria-controls")).toBe(
        node.querySelector(".text").id
    );
    act(() => Simulate.click(toggle()));
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(toggle().textContent).toBe("See less");
    expect(node.querySelector('[role="region"]').textContent).toBe(
        asset.description.trim()
    );
    act(() => Simulate.click(toggle()));
    expect(node.querySelector('[role="region"]')).toBeNull();
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
});

test("Escape collapses the full description without closing artwork details and returns focus", () => {
    const closeDetails = jest.fn();
    act(() =>
        root.render(
            <div onKeyDown={closeDetails}>
                <ArtworkSummary asset={asset} />
            </div>
        )
    );
    act(() => Simulate.click(toggle()));
    const region = node.querySelector<HTMLElement>('[role="region"]');
    region.focus();
    act(() => Simulate.keyDown(region, { key: "Escape" }));
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(toggle());
    expect(closeDetails).not.toHaveBeenCalled();
});

test("short descriptions get See more when a small viewport actually clips them, and lose it when they fit", () => {
    render({
        ...asset,
        description: "A description shorter than one hundred characters.",
    });
    const row = node.querySelector<HTMLElement>(".artwork-summary-description");
    const text = node.querySelector<HTMLElement>(".text");
    let width = 140;
    Object.defineProperty(row, "clientWidth", { get: () => width });
    Object.defineProperty(text, "scrollWidth", { get: () => 280 });
    act(() => window.dispatchEvent(new Event("resize")));
    expect(toggle().textContent).toBe("See more");
    width = 360;
    act(() => window.dispatchEvent(new Event("resize")));
    expect(toggle()).toBeNull();
});

test("switching artworks resets the expanded description", () => {
    render();
    act(() => Simulate.click(toggle()));
    render({ ...asset, id: "two" });
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
});

test.each([
    [{ collection: { name: "Collection" }, token_id: 0 }, "Collection #0"],
    [{ contract_address: "0xcontract" }, "0xcontract"],
    [{}, "Untitled artwork"],
])("metadata fallback avoids undefined titles (%s)", (next, title) => {
    act(() => root.render(<ArtworkSummary asset={next} />));
    expect(node.querySelector("h2").textContent).toBe(title);
    expect(node.querySelector(".artwork-summary-description")).toBeNull();
    expect(toggle()).toBeNull();
});
