/** @jest-environment jsdom */
import React, { act, createRef } from "react";
import { createRoot } from "react-dom/client";

const mockLog = jest.fn(async (_name: string, _event: unknown) => {});
jest.mock("@utils/analytics", () => ({
    amplitude_logAnalyticsEvent: (name: string, event: unknown) =>
        mockLog(name, event),
}));
jest.mock("./gameDisabled", () => ({
    fetchGameRelease: async () => "rel1",
}));

import { useGameHealth } from "./gameHealth";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const env = process.env as Record<string, string | undefined>;
const key = env.NEXT_PUBLIC_POSTHOG_KEY;
afterEach(() => {
    env.NEXT_PUBLIC_POSTHOG_KEY = key;
    mockLog.mockClear();
});

async function mount(game: string) {
    const frame = createRef<HTMLIFrameElement>();
    function Probe() {
        useGameHealth(game, frame);
        return <iframe ref={frame} />;
    }
    const container = document.body.appendChild(document.createElement("div"));
    const root = createRoot(container);
    await act(async () => root.render(<Probe />));
    const say = (data: object, source = frame.current.contentWindow) =>
        act(async () => {
            window.dispatchEvent(
                new MessageEvent("message", { data, origin: "null", source })
            );
        });
    return { say, unmount: () => act(() => root.unmount()) };
}
const events = () => mockLog.mock.calls.map(([, event]) => event);

test("the first frame is timed by the game's loading signal, in either prefix", async () => {
    env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test";
    const ace = await mount("ace");
    // `ready` alone measures nothing: the loading signal is the one clock.
    await ace.say({ type: "oncyber:game:ready" });
    expect(events()).toEqual([]);
    await ace.unmount();

    const contract = await mount("ace");
    await contract.say({
        type: "oncyber:game:first-frame",
        ms: 1840,
        width: 1280,
        height: 720,
    });
    await contract.say({ type: "oncyber:game:ready" });
    await contract.say({
        type: "oncyber:game:health",
        kind: "error",
        message: "TypeError: ball is undefined",
        where: "index-abc.js:12",
        // Anything else in the message stays in the browser.
        name: "Ada",
        save: { coins: 4 },
    });
    // Not this game's frame.
    await contract.say(
        { type: "oncyber:game:health", kind: "error", message: "x" },
        window
    );
    expect(mockLog.mock.calls.map(([name]) => name)).toEqual([
        "game_health",
        "game_health",
    ]);
    expect(events()).toEqual([
        {
            game: "ace",
            release: "rel1",
            device: "desktop",
            kind: "first-frame",
            ms: 1840,
        },
        {
            game: "ace",
            release: "rel1",
            device: "desktop",
            kind: "error",
            message: "TypeError: ball is undefined",
            where: "index-abc.js:12",
            afterReady: true,
        },
    ]);
    await contract.unmount();
    mockLog.mockClear();

    // A build from before the contract speaks its own prefix.
    const older = await mount("garden");
    await older.say({
        type: "garden:first-frame",
        ms: 900,
        width: 800,
        height: 600,
    });
    expect(events()).toEqual([
        {
            game: "garden",
            release: "rel1",
            device: "desktop",
            kind: "first-frame",
            ms: 900,
        },
    ]);
    await older.unmount();
});

test("nothing is sent without an analytics key", async () => {
    env.NEXT_PUBLIC_POSTHOG_KEY = "";
    const ace = await mount("ace");
    await ace.say({
        type: "oncyber:game:first-frame",
        ms: 1000,
        width: 10,
        height: 10,
    });
    await ace.say({
        type: "oncyber:game:health",
        kind: "error",
        message: "boom",
    });
    expect(mockLog).not.toHaveBeenCalled();
    await ace.unmount();
});
