/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { failLobbyDestination } from "@utils/lobbyDestinationBridge";
import GameDeviceGate from "./GameDeviceGate";

jest.mock("@utils/lobbyDestinationBridge", () => ({
    failLobbyDestination: jest.fn(),
    requestLobbyDestinationBack: jest.fn(() => false),
}));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const PHONE =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148";

async function mount(devices: string[], agent?: string) {
    if (agent)
        Object.defineProperty(navigator, "userAgent", {
            value: agent,
            configurable: true,
        });
    const container = document.createElement("div");
    document.body.append(container);
    await act(async () => {
        createRoot(container).render(
            <GameDeviceGate
                game={{ id: "padel", title: "Padel", devices: devices as any }}
            >
                <iframe src="/games/padel/index.html" />
            </GameDeviceGate>
        );
    });
    return container;
}

describe("GameDeviceGate", () => {
    const agent = navigator.userAgent;
    afterEach(() => {
        Object.defineProperty(navigator, "userAgent", {
            value: agent,
            configurable: true,
        });
        document.body.innerHTML = "";
        jest.clearAllMocks();
    });

    it("mounts a game on a device it supports", async () => {
        const page = await mount(["desktop", "gamepad"]);
        expect(page.querySelector("iframe")).not.toBeNull();
        expect(failLobbyDestination).not.toHaveBeenCalled();
    });

    it("never mounts a game on a phone it doesn't claim", async () => {
        const page = await mount(["desktop", "gamepad"], PHONE);
        expect(page.querySelector("iframe")).toBeNull();
        expect(page.textContent).toContain("Padel isn’t on phones yet.");
        expect(page.textContent).toContain("on a computer");
        expect(page.querySelector("a")?.getAttribute("href")).toBe("/?lobby=1");
        expect(failLobbyDestination).toHaveBeenCalledWith(
            "Padel isn’t on phones yet.",
            "padel-device",
            false
        );
    });

    it("mounts a game on a phone it claims", async () => {
        const page = await mount(["desktop", "phone"], PHONE);
        expect(page.querySelector("iframe")).not.toBeNull();
    });
});
