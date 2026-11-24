/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readWorldFrame } from "./worldFrame";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("next/router", () => ({
    useRouter: () => ({
        asPath: "/spaces/abc?coords=1x2x3x0",
        push: jest.fn(),
    }),
}));
// The page's chrome is its own component with its own tests; here it shows
// what it was given.
jest.mock("@features/content-host/ExperienceShell", () => ({
    __esModule: true,
    default: ({ title, notice }: any) => (
        <div data-shell>
            <span data-title>{title}</span>
            {notice && (
                <button data-retry onClick={notice.onRetry}>
                    {notice.message}
                </button>
            )}
        </div>
    ),
}));

import FramedWorld, { WORLD_LOAD_TIMEOUT_MS } from "./FramedWorld";

const frame = readWorldFrame(
    "https://worlds.example",
    "https://www.oncyber.com"
);

let root: Root;
let host: HTMLDivElement;
let sent: { message: any; target: string }[];
const element = () => host.querySelector("iframe")!;
const cover = () =>
    host.querySelector<HTMLElement>('[data-machine="game-loading"]');
const retry = () => host.querySelector<HTMLButtonElement>("[data-retry]");
/** Messages posted to the frame now on the page. */
const listen = () => {
    sent = [];
    jest.spyOn(element().contentWindow!, "postMessage").mockImplementation(
        ((message: any, target: string) =>
            void sent.push({ message, target })) as any
    );
};
/** A message as the browser delivers it from the world. */
const fromWorld = (
    data: object,
    origin = frame.world,
    source: any = element().contentWindow
) =>
    act(() => {
        window.dispatchEvent(
            new MessageEvent("message", { data, origin, source })
        );
    });

beforeEach(() => {
    jest.useFakeTimers();
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    act(() =>
        root.render(
            <FramedWorld title="Starry Night" spaceId="abc" frame={frame} />
        )
    );
    listen();
});
afterEach(() => {
    act(() => root.unmount());
    host.remove();
    jest.useRealTimers();
    jest.restoreAllMocks();
});

test("frames the same address on the world host, with no way out of the frame", () => {
    expect(element().src).toBe(
        "https://worlds.example/spaces/abc?coords=1x2x3x0"
    );
    const sandbox = element().getAttribute("sandbox");
    expect(sandbox).toContain("allow-scripts");
    expect(sandbox).not.toMatch(/popups|top-navigation|forms/);
    expect(element().getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(element().title).toBe("Starry Night");
});

test("answers the world's hello, to the world's origin and with nothing of the account", () => {
    fromWorld({ type: "oncyber:game:hello", contract: 2, world: true });
    expect(sent).toEqual([
        {
            message: { type: "oncyber:game:identity" },
            target: "https://worlds.example",
        },
    ]);
});

test("ignores anything that is not the world in its frame", () => {
    fromWorld({ type: "oncyber:game:hello" }, "https://elsewhere.example");
    // a sandboxed game's opaque origin is not the world's
    fromWorld({ type: "oncyber:game:hello" }, "null");
    fromWorld({ type: "oncyber:game:hello" }, frame.world, window);
    expect(sent).toEqual([]);
    fromWorld(
        { type: "oncyber:game:first-frame", width: 1, height: 1 },
        "null"
    );
    expect(cover().dataset.state).toBe("loading");
});

test("covers the world until it has drawn, showing how far it has loaded", () => {
    expect(cover().dataset.state).toBe("loading");
    fromWorld({ type: "oncyber:game:progress", value: 0.3, label: "" });
    expect(
        cover()
            .querySelector('[role="progressbar"]')
            .getAttribute("aria-valuenow")
    ).toBe("30");
    fromWorld({
        type: "oncyber:game:first-frame",
        ms: 900,
        width: 1280,
        height: 720,
    });
    expect(cover().dataset.state).toBe("drawn");
    expect(retry()).toBeNull();
    // drawn: no failure later, however long the visit
    act(() => void jest.advanceTimersByTime(WORLD_LOAD_TIMEOUT_MS * 2));
    expect(retry()).toBeNull();
});

test("a world that says it failed can be loaded again", () => {
    const first = element();
    fromWorld({ type: "oncyber:game:error" });
    expect(retry().textContent).toBe("This world didn't load.");
    expect(cover()).toBeNull();

    act(() => retry().click());
    expect(retry()).toBeNull();
    // a new frame and a new cover, from the start
    expect(element()).not.toBe(first);
    expect(cover().dataset.state).toBe("loading");
});

test("a world that never draws is taken as failed", () => {
    act(() => void jest.advanceTimersByTime(WORLD_LOAD_TIMEOUT_MS - 1));
    expect(retry()).toBeNull();
    act(() => void jest.advanceTimersByTime(2));
    expect(retry().textContent).toBe("This world didn't load.");
});
