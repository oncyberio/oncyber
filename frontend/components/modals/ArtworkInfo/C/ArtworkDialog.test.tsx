/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import { openWindow } from "@utils/windowStack";
import { ArtworkDialog } from "./ArtworkDialog";
import { ArtworkInfo_3D } from "./ArtworkInfo_3D";
import { ArtworkInfoMint_3D } from "./ArtworkInfoMint_3D";

let mockAsset: any;
let mockMint: any;
jest.mock("./components/ShareButton", () => ({
    ShareButton: ({ tokenLink }) => (
        <button type="button" aria-label="Share artwork" data-token={tokenLink}>
            Share
        </button>
    ),
}));
jest.mock("./components/ArtworkContext", () => ({
    useArtworkInfo: () => ({ asset: mockAsset }),
}));
jest.mock("./ArtworkInfo_Data", () => ({
    ArtworkInfo_Data: () => (
        <button type="button">Existing marketplace action</button>
    ),
}));
jest.mock("./ArtworkInfoMint_Data", () => ({
    ArtworkInfoMint_Data: () => (
        <button type="button">Existing mint action</button>
    ),
}));
jest.mock(
    "@components/_3DExhibit-v2/ui/ControlPanel/Mint/MintProvider",
    () => ({ useMint: () => mockMint })
);
jest.mock("react-confetti", () => () => <div data-testid="mint-celebration" />);

let node: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let opener: HTMLButtonElement;
beforeEach(() => {
    (global as any).IS_REACT_ACT_ENVIRONMENT = true;
    opener = document.createElement("button");
    opener.textContent = "Open artwork";
    document.body.appendChild(opener);
    opener.focus();
    node = document.createElement("div");
    document.body.appendChild(node);
    root = createRoot(node);
    mockAsset = {
        name: "Spacepod artwork",
        mime_type: "image/png",
        image_url: "/artwork.png",
    };
    mockMint = {
        currentMint: { id: "mint", name: "Mint artwork", state: "ready" },
        mintProviders: {
            mint: {
                metadata: {
                    image: "/mint.png",
                    name: "Mint artwork",
                    token: "collection/123",
                },
            },
        },
        toggleAuth: jest.fn(),
    };
});
afterEach(() => {
    act(() => root.unmount());
    node.remove();
    opener.remove();
});
function show(onClose = jest.fn()) {
    act(() =>
        root.render(
            <ArtworkDialog
                onClose={onClose}
                preview={<img src="/artwork.png" alt="Spacepod artwork" />}
            >
                <button type="button">Buy artwork</button>
            </ArtworkDialog>
        )
    );
    return onClose;
}
const button = (name: string) =>
    Array.from(node.querySelectorAll("button")).find(
        (element) =>
            element.getAttribute("aria-label") === name ||
            element.textContent === name
    );

test("keeps preview, existing actions and named dialog controls together", () => {
    const close = show();
    expect(
        node.querySelector('[role="dialog"]').getAttribute("aria-modal")
    ).toBe("true");
    expect(node.querySelector("img").alt).toBe("Spacepod artwork");
    expect(button("Buy artwork")).toBeTruthy();
    expect(document.activeElement).toBe(button("Close artwork details"));
    act(() => Simulate.click(button("Close artwork details")));
    expect(close).toHaveBeenCalledTimes(1);
});

test("Escape closes, outside clicks close and clicks inside stay open", () => {
    const close = show();
    act(() =>
        button("Buy artwork").dispatchEvent(
            new MouseEvent("mousedown", { bubbles: true })
        )
    );
    expect(close).not.toHaveBeenCalled();
    act(() =>
        Simulate.keyDown(button("Close artwork details"), { key: "Escape" })
    );
    expect(close).toHaveBeenCalledTimes(1);
    act(() =>
        document.body.dispatchEvent(
            new MouseEvent("mousedown", { bubbles: true })
        )
    );
    expect(close).toHaveBeenCalledTimes(2);
});

test("Escape is left to a window open above the panel, such as a purchase in flight", () => {
    const close = show();
    const escape = () =>
        act(() => Simulate.keyDown(button("Buy artwork"), { key: "Escape" }));
    // The overlay shows no close control, so it ignores Escape on purpose.
    const closeOverlay = openWindow({
        contains: () => false,
        canClose: () => false,
        close: jest.fn(),
    });
    escape();
    expect(close).not.toHaveBeenCalled();
    closeOverlay();
    escape();
    expect(close).toHaveBeenCalledTimes(1);
});

test("keyboard focus stays in the panel and returns to its opener", () => {
    show();
    button("Buy artwork").focus();
    act(() => Simulate.keyDown(button("Buy artwork"), { key: "Tab" }));
    expect(document.activeElement).toBe(button("Share artwork"));
    act(() =>
        Simulate.keyDown(button("Share artwork"), {
            key: "Tab",
            shiftKey: true,
        })
    );
    expect(document.activeElement).toBe(button("Buy artwork"));
    act(() => root.render(null));
    expect(document.activeElement).toBe(opener);
});

test("focus wrapping skips controls inside visually hidden ancestors", () => {
    act(() =>
        root.render(
            <ArtworkDialog onClose={jest.fn()} preview={<span>Preview</span>}>
                <button type="button">Visible action</button>
                <div style={{ display: "none" }}>
                    <button type="button">Hidden action</button>
                </div>
                <button type="button" tabIndex={-1}>
                    Inactive tab
                </button>
            </ArtworkDialog>
        )
    );
    button("Visible action").focus();
    act(() => Simulate.keyDown(button("Visible action"), { key: "Tab" }));
    expect(document.activeElement).toBe(button("Share artwork"));
    act(() =>
        Simulate.keyDown(button("Share artwork"), {
            key: "Tab",
            shiftKey: true,
        })
    );
    expect(document.activeElement).toBe(button("Visible action"));
});

test("standard NFT preview retains the existing preferred image and data action", () => {
    const toggle = jest.fn();
    mockAsset.dcompressed_image_url = "/preferred.png";
    act(() =>
        root.render(
            <ArtworkInfo_3D artwork={mockAsset} isShowing toggle={toggle} />
        )
    );
    expect(node.querySelector("img").getAttribute("src")).toBe(
        "/preferred.png"
    );
    expect(button("Existing marketplace action")).toBeTruthy();
    act(() => Simulate.click(button("Close artwork details")));
    expect(toggle).toHaveBeenCalledWith(false);
});

test("video artwork remains muted and playing inline with its original source preference", () => {
    mockAsset.mime_type = "video/mp4";
    mockAsset.dcompressed_animation_url = "/preferred.mp4";
    mockAsset.animation_url = "/fallback.mp4";
    act(() =>
        root.render(
            <ArtworkInfo_3D artwork={mockAsset} isShowing toggle={jest.fn()} />
        )
    );
    const video = node.querySelector("video");
    expect(video.getAttribute("src")).toBe("/preferred.mp4");
    expect(video.muted).toBe(true);
    expect(video.playsInline).toBe(true);
    expect(video.loop).toBe(true);
});

test("mint preview, share token, mint action and success celebration stay connected", () => {
    mockMint.currentMint.state = "minted";
    act(() =>
        root.render(
            <ArtworkInfoMint_3D
                artwork={mockAsset}
                isShowing
                toggle={jest.fn()}
            />
        )
    );
    expect(node.querySelector("img").getAttribute("src")).toBe("/mint.png");
    expect(button("Share artwork").getAttribute("data-token")).toBe(
        "collection/123"
    );
    expect(button("Existing mint action")).toBeTruthy();
    expect(node.querySelector('[data-testid="mint-celebration"]')).toBeTruthy();
});

test("wallet and transaction portal clicks keep the underlying artwork provider open", () => {
    const close = show();
    const portal = document.createElement("div");
    portal.id = "dialogs-root";
    const confirm = document.createElement("button");
    portal.appendChild(confirm);
    document.body.appendChild(portal);
    act(() =>
        confirm.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))
    );
    expect(close).not.toHaveBeenCalled();
    portal.remove();
});
