/** @jest-environment jsdom */
import React from "react";
import { createRoot } from "react-dom/client";
import useDestinationPreviews from "./useDestinationPreviews";
import type { LandingCard } from "../types";
import { toLandingCards } from "../data";
import { coverSources } from "../coverSources";

jest.mock("@utils/urlUtils", () => ({ resize: (url: string) => url }));

const act = (React as any).act;
(global as any).IS_REACT_ACT_ENVIRONMENT = true;

it("loads previews once without blocking cards, changing custom artwork, or moving later pages", async () => {
    let resolve;
    const originalFetch = global.fetch;
    global.fetch = jest.fn(
        () =>
            new Promise((done) => {
                resolve = done;
            })
    ) as any;
    const container = document.createElement("div");
    const root = createRoot(container);
    let output: LandingCard[];
    const cards = [
        { id: "default", room: "example-gallery_v2", imageUrls: [] },
        {
            id: "custom",
            room: "example-gallery_v2",
            imageUrls: ["/custom.jpg"],
        },
        { id: "unknown", room: "missing", imageUrls: [] },
    ] as LandingCard[];
    function Harness({ active = true, input = cards }) {
        output = useDestinationPreviews(input, active);
        return null;
    }
    try {
        act(() => root.render(<Harness active={false} />));
        expect(global.fetch).not.toHaveBeenCalled();
        act(() => root.render(<Harness />));
        expect(output).toBe(cards);
        await act(async () =>
            resolve({
                ok: true,
                json: async () => ({
                    success: true,
                    previews: { "example-gallery": ["/destination-2048.jpg"] },
                }),
            })
        );
        expect(output[0].imageUrls).toEqual(["/destination-2048.jpg"]);
        expect(output[1]).toBe(cards[1]);
        expect(output[2]).toBe(cards[2]);
        const next = [...cards, { ...cards[0], id: "next-page" }];
        act(() => root.render(<Harness input={next} />));
        expect(output.map((card) => card.id)).toEqual(
            next.map((card) => card.id)
        );
        expect(output[3].imageUrls).toEqual(["/destination-2048.jpg"]);
        expect(global.fetch).toHaveBeenCalledTimes(1);
    } finally {
        act(() => root.unmount());
        global.fetch = originalFetch;
    }
});

it("renders the enhanced Altitude fallback on a published gallery with no uploaded cover", () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn();
    const container = document.createElement("div");
    const root = createRoot(container);
    // Matches the uncovered public-gallery case: legacy room ID, no cover fields.
    const cards = toLandingCards([
        { id: "no-upload", info: { room: "altitude_v2" } },
        {
            id: "uploaded",
            info: { room: "altitude_v2", heroImg: "/owner-upload.jpg" },
        },
        {
            id: "captured",
            info: { room: "altitude_v2", cHeroImg: "/gallery-capture.jpg" },
        },
    ]);
    let output: LandingCard[];
    function Harness({ active = true }) {
        output = useDestinationPreviews(cards, active);
        return null;
    }
    try {
        act(() => root.render(<Harness />));
        expect(coverSources(output[0])[0]).toBe(
            "/landing-build/gallery-previews/altitude-gpt-1280.webp"
        );
        expect(output[0].href).toBe("/spaces/no-upload");
        expect(output[1]).toBe(cards[1]);
        expect(output[2]).toBe(cards[2]);
        expect(global.fetch).not.toHaveBeenCalled();
        act(() => root.render(<Harness active={false} />));
        expect(output).toBe(cards);
    } finally {
        act(() => root.unmount());
        global.fetch = originalFetch;
    }
});
