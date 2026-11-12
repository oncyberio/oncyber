/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import ArtworkInfoBulle from "./index";
import { Mode } from "../context/Mode";

const mockPanel = {
    activeArtworkInfoBulle: "mobile",
    setActiveArtworkInfoBulle: jest.fn(),
    isMobileArtworkInfoOpened: false,
};

jest.mock("../context/PanelProvider", () => ({
    Mode: jest.requireActual("../context/Mode").Mode,
    usePanel: () => mockPanel,
}));
jest.mock("@components/_3DExhibit-v2/three/constants", () => ({
    IS_MOBILE: true,
}));
jest.mock("@components/_3DExhibit-v2/constants", () => ({
    E_INFO_BREAKPOINT: { width: 760, height: 600 },
}));
jest.mock("@components/modals/ArtworkInfo/C/theme/dark", () => ({
    dark: {},
}));
jest.mock("@components/modals/ArtworkInfo/D/ArtworkContext", () => ({
    ArtworkInfoProvider: ({ children }) => children,
}));
jest.mock("next/dynamic", () => () => () => null);
jest.mock("./Basic", () => () => null);
jest.mock("./Helper", () => () => null);
jest.mock("./Mobile", () => () => <div data-testid="full-details" />);
jest.mock("../Panel/Mobile/SeeArtwork", () => () => (
    <div data-testid="info-bubble" />
));

const artwork = {
    id: "a1",
    name: "Sample",
    contract_address: "0xabc",
    token_id: "1",
    mime_type: "image/png",
};

function render() {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => {
        root.render(
            <ArtworkInfoBulle
                artwork={artwork}
                exhibit={{}}
                toggleArtworkInfo={jest.fn()}
                isPlaying={true}
                showArtworkInfo={false}
                isArtInfoTransition={false}
                selectedMode={Mode.SOLO}
            />
        );
    });
    return { host, unmount: () => act(() => root.unmount()) };
}

describe("ArtworkInfoBulle on small screens", () => {
    beforeAll(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    });

    it("shows only the small bubble while looking at an artwork", () => {
        mockPanel.isMobileArtworkInfoOpened = false;
        const { host, unmount } = render();
        expect(host.querySelector("[data-testid=info-bubble]")).not.toBeNull();
        expect(host.querySelector("[data-testid=full-details]")).toBeNull();
        unmount();
    });

    it("shows the full details once the bubble was tapped", () => {
        mockPanel.isMobileArtworkInfoOpened = true;
        const { host, unmount } = render();
        expect(host.querySelector("[data-testid=full-details]")).not.toBeNull();
        expect(host.querySelector("[data-testid=info-bubble]")).toBeNull();
        unmount();
    });
});
