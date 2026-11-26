/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import GameRoute from "./GameRoute";

// The head's tags, where the test can read them.
jest.mock("next/head", () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => (
        <div data-head>{children}</div>
    ),
}));
jest.mock("./GamePage", () => ({
    __esModule: true,
    default: ({ game, frame }: any) => (
        <div data-game={game.id} data-frame={frame.src} />
    ),
}));
jest.mock("./GameDeviceGate", () => ({
    __esModule: true,
    default: ({ children }: any) => <>{children}</>,
}));
jest.mock("./GameKillSwitchGate", () => ({
    __esModule: true,
    default: ({ children, killSwitch }: any) =>
        killSwitch.paused ? <p>paused</p> : <>{children}</>,
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const game: any = { id: "sky", title: "Sky Run", slug: "sky-run" };
const frame: any = { src: "/game-builds/sky/index.html", release: null };

async function render(props: object) {
    const container = document.createElement("div");
    document.body.append(container);
    await act(async () =>
        createRoot(container).render(<GameRoute {...(props as any)} />)
    );
    return container;
}

test("the page names its canonical address, whichever address served it", async () => {
    const page = await render({
        game,
        frame,
        killSwitch: { paused: false, releases: [] },
        canonical: "https://oncyber.io/sky-run",
    });
    const canonical = page.querySelectorAll('link[rel="canonical"]');
    expect(canonical).toHaveLength(1);
    expect(canonical[0].getAttribute("href")).toBe(
        "https://oncyber.io/sky-run"
    );
    expect(page.querySelector("title").textContent).toBe("Sky Run · Oncyber");
    // Hidden at launch: not for search engines yet.
    expect(
        page.querySelector('meta[name="robots"]').getAttribute("content")
    ).toBe("noindex,nofollow");
    expect(page.querySelector("[data-game]").getAttribute("data-frame")).toBe(
        frame.src
    );
});

test("the same gates stand in front of the game at either address", async () => {
    const page = await render({
        game,
        frame,
        killSwitch: { paused: true, releases: [] },
        canonical: "https://oncyber.io/sky-run",
    });
    expect(page.textContent).toContain("paused");
    expect(page.querySelector("[data-game]")).toBeNull();
});
