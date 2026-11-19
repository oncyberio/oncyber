/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import ExperienceShell from "./ExperienceShell";
import { trackExperienceNavigation } from "@utils/experienceNavigation";

// Its own file: the navigation history is kept for the life of the module,
// and this world has to be the first page of the visit.
jest.mock("@features/landing-carousel/components/Header", () => ({
    __esModule: true,
    default: () => <header />,
}));

test("the back arrow of a world opened by its link goes to the 2D main page, not the lobby", () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const push = jest.fn().mockResolvedValue(true);
    window.history.replaceState({ key: "direct" }, "", "/frahm-gallery");
    const stop = trackExperienceNavigation({
        push,
        replace: jest.fn(),
        events: { on: jest.fn(), off: jest.fn() },
    });
    const exit = jest.fn();
    const home = jest.fn();
    const back = () =>
        act(() =>
            container
                .querySelector('button[aria-label="Back to previous world"]')
                .dispatchEvent(new MouseEvent("click", { bubbles: true }))
        );
    try {
        act(() =>
            root.render(
                <ExperienceShell title="Frahm" onExit={exit} onHome={home} />
            )
        );
        back();
        expect(home).toHaveBeenCalledTimes(1);
        // Without its own way home, the runtime's exit is the 2D main page.
        act(() => root.render(<ExperienceShell title="Frahm" onExit={exit} />));
        back();
        expect(exit).toHaveBeenCalledTimes(1);
        // Neither opened the lobby.
        expect(push).not.toHaveBeenCalled();
    } finally {
        stop();
        act(() => root.unmount());
        container.remove();
    }
});
