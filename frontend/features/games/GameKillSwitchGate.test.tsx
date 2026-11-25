/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { failLobbyDestination } from "@utils/lobbyDestinationBridge";
import GameKillSwitchGate from "./GameKillSwitchGate";

jest.mock("@utils/lobbyDestinationBridge", () => ({
    failLobbyDestination: jest.fn(),
    requestLobbyDestinationBack: jest.fn(() => false),
}));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

async function mount(pause: any, release?: string) {
    (globalThis as any).fetch = jest.fn(async () => ({
        ok: release !== undefined,
        json: async () => ({ release }),
    }));
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
        root.render(
            <GameKillSwitchGate
                game="ace"
                title="ACE! Tennis"
                killSwitch={pause}
            >
                <iframe src="/games/ace/index.html" />
            </GameKillSwitchGate>
        );
    });
    await act(async () => {});
    return container;
}

describe("GameKillSwitchGate", () => {
    afterEach(() => {
        document.body.innerHTML = "";
        jest.clearAllMocks();
    });

    it("mounts the game when nothing is paused, without reading the release", async () => {
        const page = await mount({ paused: false, releases: [] });
        expect(page.querySelector("iframe")).not.toBeNull();
        expect(fetch).not.toHaveBeenCalled();
    });

    it("never mounts a disabled game, and offers the lobby", async () => {
        const page = await mount({ paused: true, releases: [] });
        expect(page.querySelector("iframe")).toBeNull();
        expect(page.textContent).toContain("This game is paused");
        expect(page.querySelector("a")?.getAttribute("href")).toBe("/?lobby=1");
        expect(failLobbyDestination).toHaveBeenCalledWith(
            "ACE! Tennis is paused for now.",
            "ace-paused",
            false
        );
    });

    it("pauses a disabled release and plays any other", async () => {
        const pause = { paused: false, releases: ["0800022feca2d8ba"] };
        const paused = await mount(pause, "0800022feca2d8ba");
        expect(paused.querySelector("iframe")).toBeNull();
        expect(paused.querySelector("[data-game-paused=ace]")).not.toBeNull();
        // The paused state is one of the page's overlays.
        expect(
            paused.querySelector('[data-game-overlay="paused"]')
        ).not.toBeNull();
        const fixed = await mount(pause, "1111111111111111");
        expect(fixed.querySelector("iframe")).not.toBeNull();
    });
});
