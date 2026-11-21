/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import { ArtworkInfoDesktop, hiddenWorldControls } from "./index";

const mockAsset = {
    name: "Artwork title",
    description: "A complete description. ".repeat(20),
};
jest.mock("../ArtworkContext", () => ({
    useArtworkInfo: () => ({ asset: mockAsset, marketplace: null }),
}));
jest.mock("../components/ArtworkMarketplace", () => ({
    ArtworkMarketplace: () => null,
}));
jest.mock("../components/ArtworkHistory", () => ({
    ArtworkHistory: () => null,
}));
jest.mock("../components/ShareButton", () => ({
    ShareButton: () => <button>Share artwork</button>,
}));
jest.mock("../components/Ownership", () => ({
    Ownership: () => (
        <div className="d-artwork-ownership">
            Art by Artist · Collected by Collector
        </div>
    ),
}));
jest.mock("@ui/components/IconImg", () => ({
    __esModule: true,
    default: () => null,
}));

let node: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let opener: HTMLButtonElement;
const close = jest.fn();
const button = (label: string) =>
    [...node.querySelectorAll<HTMLButtonElement>("button")].find(
        (el) =>
            el.textContent === label || el.getAttribute("aria-label") === label
    );
beforeEach(() => {
    jest.clearAllMocks();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    node = document.createElement("div");
    document.body.appendChild(node);
    root = createRoot(node);
    act(() =>
        root.render(
            <ArtworkInfoDesktop
                type="3d"
                artwork={mockAsset as any}
                toggle={close}
            />
        )
    );
});
afterEach(() => {
    act(() => root.unmount());
    node.remove();
    opener.remove();
});

test("the in-world region places compact metadata above credits without opening a modal", () => {
    expect(node.querySelector('[role="dialog"], [aria-modal]')).toBeNull();
    const summary = node.querySelector(".artwork-summary");
    const ownership = node.querySelector(".d-artwork-ownership");
    expect(
        summary.compareDocumentPosition(ownership) &
            Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(document.activeElement).toBe(button("Close artwork details"));
    act(() => Simulate.click(summary));
    expect(close).not.toHaveBeenCalled();
    act(() => Simulate.click(button("Close artwork details")));
    expect(close).toHaveBeenCalledWith(false);
});

test("Escape first collapses See more, then closes details, and unmount restores focus", () => {
    act(() => Simulate.click(button("See more")));
    act(() => Simulate.keyDown(button("See less"), { key: "Escape" }));
    expect(close).not.toHaveBeenCalled();
    expect(button("See more").getAttribute("aria-expanded")).toBe("false");
    act(() => Simulate.keyDown(button("See more"), { key: "Escape" }));
    expect(close).toHaveBeenCalledWith(false);
    act(() => root.render(null));
    expect(document.activeElement).toBe(opener);
});

test("hides the whole world chrome by default, but keeps the header on small screens", () => {
    expect(hiddenWorldControls(false)).toMatch(/^\[data-experience-chrome\],/);
    expect(hiddenWorldControls(true)).toMatch(
        /^\[data-experience-chrome\] > :not\(header\):not\(\.experience-place\),/
    );
    for (const keep of [false, true]) {
        expect(hiddenWorldControls(keep)).toContain(".mobile-joystick");
        expect(hiddenWorldControls(keep)).toContain(".jump-btn");
    }
});
