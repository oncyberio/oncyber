/** @jest-environment jsdom */
import React, { act, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { GameLoadingCover, useGameLoading } from "./GameLoadingCover";
import { holdGamePause, useGamePause } from "../contract/gamePause";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function Page() {
    const frame = useRef<HTMLIFrameElement>(null);
    const loading = useGameLoading("ace", frame);
    // GamePage passes its `send`, which puts the message in the form the
    // game speaks; this page's game is an older build.
    useGamePause("ace", frame, (message) =>
        frame.current?.contentWindow?.postMessage(message, "*")
    );
    return (
        <>
            <iframe ref={frame} title="game" />
            <GameLoadingCover state={loading} title="ACE! Tennis" />
        </>
    );
}

let root: Root;
let host: HTMLDivElement;
let sent: any[];
const frame = () => host.querySelector("iframe")!;
const cover = () =>
    host.querySelector<HTMLElement>('[data-machine="game-loading"]')!;
const bar = () => cover().querySelector('[role="progressbar"]')!;
/** A message as the browser delivers it from the sandboxed game. */
const fromGame = (data: object, source: any = frame().contentWindow) =>
    act(() => {
        window.dispatchEvent(
            new MessageEvent("message", { data, origin: "null", source })
        );
    });

beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root.render(<Page />));
    sent = [];
    jest.spyOn(frame().contentWindow!, "postMessage").mockImplementation(
        (message: any) => void sent.push(message)
    );
});
afterEach(() => {
    act(() => root.unmount());
    host.remove();
});

test("the cover shows the game's progress and lifts at its first frame", () => {
    expect(cover().dataset.state).toBe("loading");
    expect(cover().style.visibility).toBe("visible");
    fromGame({
        type: "ace:progress",
        value: 0.25,
        label: "Painting the lines…",
    });
    expect(bar().getAttribute("aria-valuenow")).toBe("25");
    expect(cover().textContent).toContain("Painting the lines…");
    // Another window, or another game's message, changes nothing.
    fromGame({ type: "ace:first-frame", ms: 1, width: 1, height: 1 }, window);
    fromGame({ type: "garden:first-frame", ms: 1, width: 1, height: 1 });
    expect(cover().dataset.state).toBe("loading");
    fromGame({ type: "ace:first-frame", ms: 900, width: 1280, height: 720 });
    expect(cover().dataset.state).toBe("drawn");
    expect(cover().style.visibility).toBe("hidden");
    expect(cover().getAttribute("aria-hidden")).toBe("true");
});

test("a game on the one contract is followed the same way", () => {
    fromGame({
        type: "oncyber:game:progress",
        value: 0.5,
        label: "Warming up…",
    });
    expect(bar().getAttribute("aria-valuenow")).toBe("50");
    fromGame({
        type: "oncyber:game:first-frame",
        ms: 900,
        width: 1280,
        height: 720,
    });
    expect(cover().dataset.state).toBe("drawn");
    // An open menu is repeated to it at its first frame too.
    let release = () => {};
    act(() => void (release = holdGamePause()));
    fromGame({ type: "oncyber:game:ready" });
    expect(sent).toHaveLength(2);
    act(() => release());
});

test("the cover is a page overlay", () => {
    expect(cover().getAttribute("data-game-overlay")).toBe("loading");
});

test("a game without first-frame is shown when it says ready", () => {
    fromGame({ type: "ace:ready" });
    expect(cover().dataset.state).toBe("drawn");
});

test("a page menu pauses the game and closing it resumes", () => {
    let release = () => {};
    act(() => void (release = holdGamePause()));
    expect(sent).toEqual([{ type: "ace:pause", reason: "menu" }]);
    // A game that starts listening later hears about the open menu.
    fromGame({ type: "ace:first-frame", ms: 900, width: 1280, height: 720 });
    expect(sent).toHaveLength(2);
    act(() => release());
    expect(sent.at(-1)).toEqual({ type: "ace:resume", reason: "menu" });
    fromGame({ type: "ace:ready" });
    expect(sent).toHaveLength(3);
});
