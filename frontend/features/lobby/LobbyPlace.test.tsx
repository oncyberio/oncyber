/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import LobbyPlace from "./LobbyPlace";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const back = jest.fn();
const render = (presence: string, backLabel?: string) =>
    act(() =>
        root.render(
            <LobbyPlace
                title="Lobby"
                presence={presence}
                onBack={back}
                backLabel={backLabel}
            />
        )
    );
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.clearAllMocks();
});

test.each(["12 here", "Connecting…", "You’re offline"])(
    "shows the host's presence words under the title: %s",
    (presence) => {
        render(presence);
        const place = container.querySelector(".lobby-place");
        expect(place.textContent).toBe(`Lobby${presence}`);
        const status = place.querySelector(".presence-status");
        expect(status.textContent).toBe(presence);
        // The count changes as people come and go, so this line is not live.
        expect(place.querySelector("[role='status'], [aria-live]")).toBeNull();
        expect(status.hasAttribute("aria-hidden")).toBe(false);
    }
);

test("the back control keeps its label and action", () => {
    render("12 here");
    const button = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Back to lobby"]'
    );
    act(() => button.click());
    expect(back).toHaveBeenCalledTimes(1);
    render("12 here", "Back to exploring");
    expect(
        container.querySelector('button[aria-label="Back to exploring"]')
    ).not.toBeNull();
});
