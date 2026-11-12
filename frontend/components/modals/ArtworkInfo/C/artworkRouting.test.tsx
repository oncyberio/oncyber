/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "styled-components";
import ArtworkInfo from "./index";
import NativeArtworkInfo from "../D";
import { ArtworkInfoProvider } from "./components/ArtworkContext";
import MobileArtworkInfo from "@components/_3DExhibit-v2/ui/ControlPanel/ArtworkInfoBulle/Mobile";

const originalWidth = window.innerWidth;
const originalHeight = window.innerHeight;
const mockCloseMobile = jest.fn();
jest.mock("@components/context/ThemeProvider", () => ({
    useCyberTheme: () => ({ isLightTheme: false }),
}));
jest.mock("../D", () => ({
    __esModule: true,
    default: jest.fn(({ toggle }) => (
        <section data-view="world">
            <button onClick={() => toggle(false)}>Close</button>
        </section>
    )),
}));
jest.mock("../D/Desktop", () => ({
    ArtworkInfoDesktop: ({ toggle }) => (
        <section data-view="world">
            <button onClick={() => toggle(false)}>Close</button>
        </section>
    ),
}));
jest.mock("../D/ArtworkContext", () => ({
    useArtworkInfo: () => ({ asset: { mintable: false } }),
}));
jest.mock("../D/Mint/ArtworkInfoMint_Data", () => ({
    ArtworkInfoMint_Data: () => null,
}));
jest.mock(
    "@components/_3DExhibit-v2/ui/ControlPanel/context/PanelProvider",
    () => ({
        usePanel: () => ({ setIsMobileArtworkInfoOpened: mockCloseMobile }),
    })
);
jest.mock("@ui/components/IconButton", () => ({ IconButton: () => null }));
jest.mock("./components/ArtworkContext", () => ({
    ArtworkInfoProvider: jest.fn(({ children }) => <>{children}</>),
}));
jest.mock("./ArtworkInfo_Full", () => ({
    ArtworkInfo_Full: () => <section data-view="full" />,
}));
jest.mock("./ArtworkInfoMint_3D", () => ({
    ArtworkInfoMint_3D: () => <section data-view="mint" />,
}));

let node: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const toggle = jest.fn();
const artwork = { id: "artwork", name: "Artwork", mintable: false } as any;
beforeEach(() => {
    jest.clearAllMocks();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    node = document.createElement("div");
    document.body.appendChild(node);
    root = createRoot(node);
});
afterEach(() => {
    act(() => root.unmount());
    node.remove();
    Object.defineProperty(window, "innerWidth", {
        configurable: true,
        writable: true,
        value: originalWidth,
    });
    Object.defineProperty(window, "innerHeight", {
        configurable: true,
        writable: true,
        value: originalHeight,
    });
    jest.restoreAllMocks();
});
function render(type: "3d" | "full" = "3d") {
    act(() =>
        root.render(
            <ThemeProvider theme={{}}>
                <ArtworkInfo
                    type={type}
                    artwork={artwork}
                    isShowing
                    toggle={toggle}
                />
            </ThemeProvider>
        )
    );
}
test.each([
    [1920, 1080],
    [900, 500],
    [390, 844],
])(
    "in-world details stay in the native overlay at %s × %s",
    (width, height) => {
        Object.defineProperty(window, "innerWidth", {
            configurable: true,
            writable: true,
            value: width,
        });
        Object.defineProperty(window, "innerHeight", {
            configurable: true,
            writable: true,
            value: height,
        });
        render();
        expect(node.querySelector('[data-view="world"]')).not.toBeNull();
        expect(node.querySelector('[role="dialog"]')).toBeNull();
        expect(NativeArtworkInfo).toHaveBeenCalled();
        expect(ArtworkInfoProvider).not.toHaveBeenCalled();
        act(() => node.querySelector<HTMLButtonElement>("button").click());
        expect(toggle).toHaveBeenCalledWith(false);
    }
);
test("the mobile entry point uses the same overlay and closes through its existing runtime control", () => {
    act(() => root.render(<MobileArtworkInfo />));
    expect(node.querySelector('[data-view="world"]')).not.toBeNull();
    expect(node.querySelector('[role="dialog"]')).toBeNull();
    act(() => node.querySelector<HTMLButtonElement>("button").click());
    expect(mockCloseMobile).toHaveBeenCalledWith(false);
});
test("standalone artwork pages retain their full-page data view", () => {
    render("full");
    expect(node.querySelector('[data-view="full"]')).not.toBeNull();
    expect(NativeArtworkInfo).not.toHaveBeenCalled();
});
