/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import { ThemeProvider } from "styled-components";
import { AssetInfo } from "./AssetInfo";

let mockInfo: any;
jest.mock("./ArtworkContext", () => ({ useArtworkInfo: () => mockInfo }));
jest.mock("@components/context/UserContext", () => ({
    UserContext: require("react").createContext({}),
}));
jest.mock("./Ownership", () => ({
    __esModule: true,
    default: ({ asset }) => (
        <div data-testid="ownership">Owner: {asset.owner.address}</div>
    ),
}));
jest.mock("./AssetHistory", () => ({
    AssetHistory: () => <p>Existing history data</p>,
}));
jest.mock("./Listings", () => ({
    Listings: ({ listings }) => <p>Listings: {listings.length}</p>,
}));
jest.mock("./Offers", () => ({
    Offers: ({ offers }) => <p>Offers: {offers.length}</p>,
}));
jest.mock("./CuratorNotes", () => ({
    __esModule: true,
    default: ({ text }) => <p>{text}</p>,
}));
jest.mock("./AssetPreview", () => ({
    AssetPreview: () => <span>Artwork preview</span>,
}));

let node: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
    (global as any).IS_REACT_ACT_ENVIRONMENT = true;
    node = document.createElement("div");
    document.body.appendChild(node);
    root = createRoot(node);
    mockInfo = {
        type: "3d",
        asset: {
            name: "Spacepod artwork",
            owner: { address: "0xowner" },
            source: { blockchain: "ethereum" },
            description: "A".repeat(150),
            curatorNotes: "Curator's original notes",
        },
        buyOrders: [{}],
        sellOrders: [{}, {}],
        refreshAssetLoading: false,
        assetType: "Nft",
    };
    act(() =>
        root.render(
            <ThemeProvider
                theme={{
                    color: "#f3f3f1",
                    label: { color: "#93938e" },
                    tab: { header: { color: "#c2c2bd" } },
                }}
            >
                <AssetInfo assetInfoRef={null} themeDark />
            </ThemeProvider>
        )
    );
});
afterEach(() => {
    act(() => root.unmount());
    node.remove();
});
const tab = (label: string) =>
    Array.from(node.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find(
        (element) => element.textContent === label
    );

test("preserves title, ownership, history, listings, offers and curator notes", () => {
    expect(node.querySelector("h2").textContent.trim()).toBe(
        "Spacepod artwork"
    );
    expect(node.textContent).toContain("Owner: 0xowner");
    expect(node.querySelector('[role="tabpanel"]').textContent).toBe(
        "Existing history data"
    );
    act(() => Simulate.click(tab("Listings")));
    expect(node.querySelector('[role="tabpanel"]').textContent).toBe(
        "Listings: 2"
    );
    act(() => Simulate.click(tab("Offers")));
    expect(node.querySelector('[role="tabpanel"]').textContent).toBe(
        "Offers: 1"
    );
    act(() => Simulate.click(tab("Curator Notes")));
    expect(node.querySelector('[role="tabpanel"]').textContent).toBe(
        "Curator's original notes"
    );
});

test("tab arrow keys update selection, focus and associated content", () => {
    tab("History").focus();
    act(() => Simulate.keyDown(tab("History"), { key: "ArrowRight" }));
    expect(tab("Listings").getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(tab("Listings"));
    expect(
        node.querySelector('[role="tabpanel"]').getAttribute("aria-labelledby")
    ).toBe(tab("Listings").id);
    act(() => Simulate.keyDown(tab("Listings"), { key: "End" }));
    expect(document.activeElement).toBe(tab("Curator Notes"));
});

test("description expansion preserves the full original text and can collapse again", () => {
    let toggle = node.querySelector<HTMLButtonElement>("button[aria-expanded]");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    act(() => Simulate.click(toggle));
    expect(
        node.querySelector(".artwork-summary-description .text").textContent
    ).toContain("A".repeat(150));
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    act(() => Simulate.click(toggle));
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
});

test("compact title and one-line description precede the ownership credits", () => {
    const summary = node.querySelector(".artwork-summary");
    const ownership = node.querySelector('[data-testid="ownership"]');
    expect(summary).not.toBeNull();
    expect(
        summary.compareDocumentPosition(ownership) &
            Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(node.querySelectorAll(".artwork-summary-description")).toHaveLength(
        1
    );
    expect(
        node.querySelector(".artwork-summary-description button").textContent
    ).toBe("See more");
});
