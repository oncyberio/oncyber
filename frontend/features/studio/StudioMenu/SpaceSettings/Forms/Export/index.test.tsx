/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import { Export } from "./index";

const CID = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";

jest.mock("@features/studio/context/ExhibitContext", () => ({
    useCurrentExhibit: () => ({
        exhibit: {
            id: "space-1",
            owner: "0xowner",
            info: {
                headline: "Martian",
                heroImg: `ipfs://${CID}`,
            },
            artworks: {
                a: { data: { image: "https://example.com/a.png" } },
            },
            gating: { password: { password: "secret", message: "Ask me" } },
        },
        destination: { _id: "room", path: "https://rooms.example/r.glb" },
        baseAnalyticsEvent: {},
    }),
}));
jest.mock("@utils/analytics", () => ({
    amplitude_logAnalyticsEvent: jest.fn(),
}));

describe("Export", () => {
    let container: HTMLDivElement;
    let root: ReturnType<typeof createRoot>;
    let saved: Blob;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        URL.createObjectURL = jest.fn((blob: Blob) => {
            saved = blob;
            return "blob:space";
        });
        URL.revokeObjectURL = jest.fn();
        jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
            () => {}
        );
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        jest.restoreAllMocks();
    });

    it("counts the files and downloads the space without its password", async () => {
        act(() => root.render(<Export />));

        const counts = [...container.querySelectorAll("dd")].map(
            (it) => it.textContent
        );
        // 1 item; 1 IPFS file; the artwork image and the room model.
        expect(counts).toEqual(["1", "1", "2"]);

        const button = [...container.querySelectorAll("button")].find(
            (it) => it.textContent === "Download JSON"
        );
        act(() => Simulate.click(button));

        expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
        const text = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsText(saved);
        });
        const data = JSON.parse(text);
        expect(data.format).toBe("oncyber.space");
        expect(data.space.gating.password).toEqual({ message: "Ask me" });
        expect(JSON.stringify(data)).not.toContain("secret");
        expect(container.textContent).toContain("Saved to your downloads.");
    });
});
