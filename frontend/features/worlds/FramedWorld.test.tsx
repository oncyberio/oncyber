/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readWorldFrame } from "./worldFrame";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockPush = jest.fn();
jest.mock("next/router", () => ({
    useRouter: () => ({
        asPath: "/spaces/abc?coords=1x2x3x0",
        push: mockPush,
    }),
}));
// The page's chrome is its own component with its own tests; here it shows
// what it was given.
jest.mock("@features/content-host/ExperienceShell", () => ({
    __esModule: true,
    default: ({ title, spaceId, notice }: any) => (
        <div data-shell data-space={spaceId ?? ""}>
            <span data-title>{title}</span>
            {notice && (
                <button data-retry onClick={notice.onRetry}>
                    {notice.message}
                </button>
            )}
        </div>
    ),
}));

// The account as the page holds it; a test signs in by changing it.
let account: { isSignedIn: boolean; userData: any };
jest.mock("@components/context/UserContext", () => {
    const { createContext } = require("react");
    return { UserContext: createContext({}) };
});
jest.mock("@features/lobby/avatarSelection", () => ({
    DEFAULT_LOBBY_AVATAR_URL: "/avatars/square.vrm",
    resolveLobbyAvatar: jest.fn(async (who?: { settings?: any }) =>
        who?.settings?.vrm
            ? { id: who.settings.vrm, name: "Robot", url: "/avatars/r.vrm" }
            : { id: "square", name: "Square", url: "/avatars/square.vrm" }
    ),
}));

import { UserContext } from "@components/context/UserContext";
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

/** Renders the page for the account as it is now, and lets it be read. */
const render = async () => {
    await act(async () =>
        root.render(
            <UserContext.Provider value={account as any}>
                <FramedWorld title="Starry Night" spaceId="abc" frame={frame} />
            </UserContext.Provider>
        )
    );
};
const hello = () =>
    fromWorld({ type: "oncyber:game:hello", contract: 2, world: true });

const shell = () => host.querySelector<HTMLElement>("[data-shell]")!;
const shown = () => host.querySelector("[data-title]")!.textContent;

beforeEach(async () => {
    jest.useFakeTimers();
    mockPush.mockReset();
    window.history.replaceState(null, "", "/spaces/abc?coords=1x2x3x0");
    (globalThis as any).fetch = jest.fn(async () => ({
        ok: true,
        json: async () => ({ exists: true, id: "def" }),
    }));
    account = { isSignedIn: false, userData: null };
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await render();
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

test("answers the world's hello with a guest, to the world's origin", () => {
    hello();
    expect(sent).toEqual([
        {
            message: {
                type: "oncyber:game:identity",
                guest: true,
                name: "Guest",
                pfp: expect.any(String),
                avatarUrl: "/avatars/square.vrm",
                avatarId: "square",
                avatarName: "Square",
                avatarSize: null,
            },
            target: "https://worlds.example",
        },
    ]);
});

test("a signed-in visitor crosses as a name, a portrait and an avatar, and nothing else of the account", async () => {
    account = {
        isSignedIn: true,
        userData: {
            username: "ada",
            avatar: "https://cdn.example/ada.png",
            walletId: "0xabc",
            email: "ada@example.com",
            settings: { vrm: "robot", default_vrm_scale: 0.4 },
        },
    };
    act(() => root.unmount());
    root = createRoot(host);
    await render();
    listen();
    hello();
    expect(sent).toHaveLength(1);
    expect(sent[0].message).toEqual({
        type: "oncyber:game:identity",
        guest: false,
        name: "ada",
        pfp: "https://cdn.example/ada.png",
        avatarUrl: "/avatars/r.vrm",
        avatarId: "robot",
        avatarName: "Robot",
        avatarSize: 0.4,
    });
    expect(JSON.stringify(sent[0].message)).not.toMatch(/0xabc|example\.com"/);
});

test("signing in after the world started starts it again as that visitor", async () => {
    const first = element();
    hello();
    account = {
        isSignedIn: true,
        userData: { username: "ada", avatar: "https://cdn.example/ada.png" },
    };
    await render();
    expect(element()).not.toBe(first);
    listen();
    hello();
    expect(sent[0].message).toMatchObject({ guest: false, name: "ada" });
});

test("a visitor who has not changed leaves the world running", async () => {
    const first = element();
    hello();
    await render();
    expect(element()).toBe(first);
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

test("the address bar follows the world as the visitor walks", () => {
    const first = element();
    fromWorld({
        type: "oncyber:game:location",
        href: "/spaces/abc?coords=9x8x7x1",
    });
    expect(window.location.pathname + window.location.search).toBe(
        "/spaces/abc?coords=9x8x7x1"
    );
    // the same world in the same frame, and still this page's space
    expect(element()).toBe(first);
    expect(element().src).toBe(
        "https://worlds.example/spaces/abc?coords=1x2x3x0"
    );
    expect(shown()).toBe("Starry Night");
    expect(shell().dataset.space).toBe("abc");
});

test("a portal taken inside the frame: the page shows that place, with an id it looked up itself", async () => {
    const first = element();
    await act(async () => {
        window.dispatchEvent(
            new MessageEvent("message", {
                data: {
                    type: "oncyber:game:location",
                    href: "/second-space?from=abc",
                    title: "Second space",
                    spaceId: "not-believed",
                },
                origin: frame.world,
                source: element().contentWindow,
            })
        );
    });
    expect(window.location.pathname).toBe("/second-space");
    expect(shown()).toBe("Second space");
    expect(fetch).toHaveBeenCalledWith("/api/world-access?space=second-space");
    expect(shell().dataset.space).toBe("def");
    expect(element()).toBe(first);

    // and back through the portal
    fromWorld({ type: "oncyber:game:location", href: "/spaces/abc" });
    expect(shown()).toBe("Starry Night");
    expect(shell().dataset.space).toBe("abc");
});

test("an address that is not a world's is not shown", () => {
    for (const href of ["https://elsewhere.example/x", "/@ada", "/studio"])
        fromWorld({ type: "oncyber:game:location", href });
    expect(window.location.pathname).toBe("/spaces/abc");
});

test("travel the world asks for is done by the page, on this site only", () => {
    fromWorld({ type: "oncyber:game:travel", href: "/?lobby=1" });
    expect(mockPush).toHaveBeenCalledWith("/?lobby=1");
    fromWorld({
        type: "oncyber:game:travel",
        href: "https://elsewhere.example/",
    });
    fromWorld({ type: "oncyber:game:travel", href: "//elsewhere.example" });
    expect(mockPush).toHaveBeenCalledTimes(1);
});
