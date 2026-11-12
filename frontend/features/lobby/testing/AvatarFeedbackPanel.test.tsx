/** @jest-environment jsdom */
import React, { act, StrictMode } from "react";
import { Simulate } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import AvatarFeedbackPanel, {
    AvatarFeedbackCapture,
} from "./AvatarFeedbackPanel";

test("effect replay saves one trace and notes update its original report", async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    const previousFetch = globalThis.fetch;
    const posts: any[] = [];
    globalThis.fetch = jest.fn(async (_url, options) => {
        if (options?.method === "POST") {
            posts.push(JSON.parse(options.body as string));
            return {
                ok: true,
                json: async () => ({
                    id: "saved-report",
                    savedAt: "2026-10-07",
                }),
            } as Response;
        }
        return { ok: true, json: async () => [] } as Response;
    });
    const container = document.createElement("div");
    const root = createRoot(container);
    const capture: AvatarFeedbackCapture = {
        schemaVersion: 1,
        clickedAt: "2026-10-07",
        avatar: { id: "5" },
        rendering: {},
        context: { seed: 42, profile: "regional", simulationMs: 1000 },
        frames: [
            {
                timeMs: 1000,
                simulationMs: 1000,
                dt: 1 / 60,
                x: 0,
                y: 0,
                z: 0,
                rotation: 0,
                motion: { speed: 0, grounded: true },
            },
        ],
    };
    try {
        await act(async () =>
            root.render(
                <StrictMode>
                    <AvatarFeedbackPanel capture={capture} />
                </StrictMode>
            )
        );
        expect(posts).toHaveLength(1);
        await act(async () =>
            Simulate.change(container.querySelector("textarea"), {
                target: { value: "Speed surges" },
            } as any)
        );
        const button = Array.from(container.querySelectorAll("button")).find(
            (node) => node.textContent === "Save note"
        );
        await act(async () => Simulate.click(button));
        expect(posts).toHaveLength(2);
        expect(posts[1]).toMatchObject({
            id: "saved-report",
            notes: "Speed surges",
        });
        expect(container.textContent).toContain("Saved locally");
    } finally {
        act(() => root.unmount());
        globalThis.fetch = previousFetch;
    }
});
