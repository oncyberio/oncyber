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
    default: ({ title, spaceId, notice, actions = [] }: any) => (
        <div data-shell data-space={spaceId ?? ""}>
            {actions.map((action: any) => (
                <button
                    key={action.id}
                    data-action={action.id}
                    aria-pressed={!!action.active}
                    disabled={action.disabled}
                    onClick={action.onClick}
                >
                    {action.label}
                </button>
            ))}
            {notice && !notice.onRetry && <p data-notice>{notice.message}</p>}
            <span data-title>{title}</span>
            {notice?.onRetry && (
                <button
                    data-retry
                    data-label={notice.actionLabel ?? "Retry"}
                    onClick={notice.onRetry}
                >
                    {notice.message}
                </button>
            )}
        </div>
    ),
}));

// The account as the page holds it; a test signs in by changing it.
let account: {
    isSignedIn: boolean;
    userData: any;
    token?: string;
    user?: { id: string };
};
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

const mockSeat = jest.fn();
jest.mock("@utils/arena/join", () => ({
    requestSeat: (...args: unknown[]) => mockSeat(...args),
    takeSeat: async () => ({
        sessionId: "me",
        id: "room-1",
        send: jest.fn(),
        onStateChange: jest.fn(),
        onMessage: jest.fn(),
        onLeave: jest.fn(),
        leave: jest.fn(),
    }),
}));

// The page's voice in a room: what was asked of it, and a way to answer.
const mockVoices: any[] = [];
jest.mock("@features/games/roomVoice", () => ({
    RoomVoice: class {
        state = "off";
        toggle = jest.fn();
        listen = jest.fn(async () => {});
        close = jest.fn();
        updateVolumes = jest.fn();
        published = () => [];
        setGated = jest.fn();
        levels = { levels: () => [] };
        options: any;
        constructor(_room: unknown, mockOptions: any) {
            this.options = mockOptions;
            mockVoices.push(this);
        }
    },
}));

const mockIsMod = jest.fn();
jest.mock("@api/social/_api", () => ({
    __esModule: true,
    default: { isMod: (...args: unknown[]) => mockIsMod(...args) },
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
                account: null,
            },
            target: "https://worlds.example",
        },
    ]);
});

test("a signed-in visitor crosses as who they are, how they look and their settings; no session and nothing private", async () => {
    account = {
        isSignedIn: true,
        token: "page-session",
        user: { id: "0xabc" },
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
        account: {
            id: "0xabc",
            username: "ada",
            profile: {
                avatar: "https://cdn.example/ada.png",
                walletId: "0xabc",
                settings: { vrm: "robot", default_vrm_scale: 0.4 },
            },
        },
    });
    expect(JSON.stringify(sent[0].message)).not.toMatch(
        /page-session|example\.com/
    );
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

test("a world that is slow but keeps reporting is not failed, and a late first frame takes the notice away", () => {
    // two minutes of loading, a report every half minute
    for (let i = 0; i < 6; i++) {
        act(() => void jest.advanceTimersByTime(30_000));
        fromWorld({ type: "oncyber:game:progress", value: 0.1 * i, label: "" });
    }
    expect(retry()).toBeNull();
    // then silence: failed after the wait, counted from its last word
    for (let i = 0; i < 5 && !retry(); i++)
        act(() => void jest.advanceTimersByTime(30_000));
    expect(retry().textContent).toBe("This world didn't load.");
    // and it draws after all
    fromWorld({
        type: "oncyber:game:first-frame",
        ms: 300000,
        width: 1280,
        height: 720,
    });
    expect(retry()).toBeNull();
    expect(cover().dataset.state).toBe("drawn");
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

describe("the world's room", () => {
    const join = (label: string) =>
        act(async () => {
            window.dispatchEvent(
                new MessageEvent("message", {
                    data: {
                        type: "oncyber:game:room-join",
                        seq: 1,
                        options: {
                            label,
                            position: { x: 1, y: 2, z: 3 },
                            avatar: "https://cdn.example/me.png",
                            username: "anything",
                            userId: "0xmallory",
                            token: "made up",
                        },
                    },
                    origin: frame.world,
                    source: element().contentWindow,
                })
            );
            // the lookup, the seat and the join each take a turn
            for (let i = 0; i < 8; i++) await Promise.resolve();
        });
    const signIn = async () => {
        account = {
            isSignedIn: true,
            token: "page-session",
            user: { id: "0xada" },
            userData: { username: "ada" },
        } as any;
        await render();
        listen();
    };
    beforeEach(() => {
        mockSeat.mockReset();
        mockSeat.mockResolvedValue({ reservation: {} });
    });

    test("a guest's world joins as a guest the page names", async () => {
        await join("starry-night");
        expect(mockSeat.mock.calls[0][0]).toMatchObject({
            label: "starry-night",
            userId: expect.stringMatching(/^Anon-/),
            token: "",
            username: "anything",
        });
        expect(sent.at(-1).message).toEqual({
            type: "oncyber:game:room-joined",
            seq: 1,
            sessionId: "me",
            roomId: "room-1",
        });
    });

    test("a signed-in visitor joins this space's room with the page's session, which stays on the page", async () => {
        (fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({ exists: true, id: "abc" }),
        });
        await signIn();
        await join("starry-night");
        expect(fetch).toHaveBeenCalledWith(
            "/api/world-access?space=starry-night"
        );
        expect(mockSeat.mock.calls[0][0]).toMatchObject({
            userId: "0xada",
            token: "page-session",
            username: "ada",
        });
        expect(JSON.stringify(sent)).not.toContain("page-session");
    });

    test("a room reached through a portal is joined by name, without the session", async () => {
        // the label is another space's (the lookup says "def", not "abc")
        await signIn();
        await join("someone-elses-space");
        expect(mockSeat.mock.calls[0][0]).toMatchObject({
            label: "someone-elses-space",
            userId: "0xada",
            token: "",
            username: "ada",
        });
    });
});

describe("the one dock", () => {
    const action = (id: string) =>
        host.querySelector<HTMLButtonElement>(`[data-action="${id}"]`);
    const worldDock = () =>
        fromWorld({
            type: "oncyber:game:dock",
            actions: [
                { id: "voice", label: "Enable microphone", icon: "mic-off" },
                { id: "emotes", label: "Emotes", icon: "emote" },
            ],
        });
    const joinRoom = () =>
        act(async () => {
            window.dispatchEvent(
                new MessageEvent("message", {
                    data: {
                        type: "oncyber:game:room-join",
                        seq: 1,
                        options: {
                            label: "starry-night",
                            position: { x: 1, y: 2, z: 3 },
                            avatar: "https://cdn.example/me.png",
                        },
                    },
                    origin: frame.world,
                    source: element().contentWindow,
                })
            );
            for (let i = 0; i < 8; i++) await Promise.resolve();
        });
    beforeEach(() => {
        mockVoices.length = 0;
        mockSeat.mockReset();
        mockSeat.mockResolvedValue({ reservation: {} });
    });

    test("the page draws the world's buttons and tells the world when one is pressed", () => {
        expect(action("emotes")).toBeNull();
        worldDock();
        expect(action("emotes").textContent).toBe("Emotes");
        act(() => action("emotes").click());
        expect(sent.at(-1)).toEqual({
            message: { type: "oncyber:game:dock-press", id: "emotes" },
            target: "https://worlds.example",
        });
    });

    const allow = (allowed = true) =>
        fromWorld({ type: "oncyber:game:voice-allow", allowed });

    test("the microphone is the page's: once the world's rules allow it, its button never asks the world", async () => {
        worldDock();
        await joinRoom();
        expect(mockVoices).toHaveLength(1);
        // heard at once, a microphone only on the visitor's own press
        expect(mockVoices[0].listen).toHaveBeenCalled();
        allow();
        expect(mockVoices[0].toggle).not.toHaveBeenCalled();
        expect(action("voice").textContent).toBe("Enable microphone");

        sent.length = 0;
        act(() => action("voice").click());
        expect(mockVoices[0].toggle).toHaveBeenCalledTimes(1);
        expect(sent).toEqual([]);

        act(() => mockVoices[0].options.onChange("live", ""));
        expect(action("voice").textContent).toBe("Mute microphone");
        expect(action("voice").getAttribute("aria-pressed")).toBe("true");
    });

    test("until the world's rules allow it, the button is the world's to answer", async () => {
        fromWorld({
            type: "oncyber:game:dock",
            actions: [{ id: "voice", label: "Request to speak", icon: "mic" }],
        });
        await joinRoom();
        allow(false);
        expect(action("voice").textContent).toBe("Request to speak");
        sent.length = 0;
        act(() => action("voice").click());
        expect(mockVoices[0].toggle).not.toHaveBeenCalled();
        expect(sent.map(({ message }) => message)).toEqual([
            { type: "oncyber:game:dock-press", id: "voice" },
        ]);
    });

    test("a world cannot turn the microphone on", async () => {
        worldDock();
        await joinRoom();
        allow();
        fromWorld({ type: "oncyber:game:dock-press", id: "voice" });
        fromWorld({ type: "oncyber:game:voice", on: true });
        fromWorld({ type: "oncyber:game:voice-mute", muted: false });
        fromWorld({ type: "oncyber:game:voice-state", live: true });
        fromWorld({
            type: "oncyber:game:room-send",
            seq: 1,
            name: "rtc-ready",
        });
        expect(mockVoices[0].toggle).not.toHaveBeenCalled();
    });

    test("why the microphone did not start is said on the page", async () => {
        worldDock();
        await joinRoom();
        act(() =>
            mockVoices[0].options.onChange(
                "off",
                "Microphone access was declined. You can still listen."
            )
        );
        expect(host.querySelector("[data-notice]").textContent).toBe(
            "Microphone access was declined. You can still listen."
        );
    });

    test("leaving the room ends the page's voice in it", async () => {
        worldDock();
        await joinRoom();
        allow();
        fromWorld({ type: "oncyber:game:room-leave", seq: 1 });
        expect(mockVoices[0].close).toHaveBeenCalled();
        // the button is the world's again, with what the world says of it
        act(() => action("voice").click());
        expect(mockVoices[0].toggle).not.toHaveBeenCalled();
    });
});

describe("what the world asks the page", () => {
    const ask = (label: string) =>
        act(async () => {
            window.dispatchEvent(
                new MessageEvent("message", {
                    data: {
                        type: "oncyber:game:ask",
                        n: 7,
                        name: "moderator",
                        label,
                    },
                    origin: frame.world,
                    source: element().contentWindow,
                })
            );
            for (let i = 0; i < 10; i++) await Promise.resolve();
        });
    const answer = () =>
        sent.find(({ message }) => message.type === "oncyber:game:answer")
            ?.message;
    beforeEach(() => mockIsMod.mockReset());

    test("a guest moderates nothing, and the account is not asked", async () => {
        await ask("starry-night");
        expect(answer()).toEqual({
            type: "oncyber:game:answer",
            n: 7,
            value: false,
        });
        expect(mockIsMod).not.toHaveBeenCalled();
    });

    test("a signed-in visitor: the page asks with its own session, for this space only", async () => {
        account = {
            isSignedIn: true,
            token: "page-session",
            user: { id: "0xada" },
            userData: { username: "ada" },
        } as any;
        await render();
        listen();
        mockIsMod.mockResolvedValue(true);

        // another space's label (the lookup says "def"; this page is "abc")
        await ask("someone-elses-space");
        expect(answer().value).toBe(false);
        expect(mockIsMod).not.toHaveBeenCalled();

        sent.length = 0;
        (fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({ exists: true, id: "abc" }),
        });
        await ask("starry-night");
        expect(mockIsMod).toHaveBeenCalledWith({ slug: "starry-night" });
        expect(answer().value).toBe(true);
        expect(JSON.stringify(sent)).not.toContain("page-session");
    });

    test("a question the page does not know is answered with nothing", async () => {
        await act(async () => {
            window.dispatchEvent(
                new MessageEvent("message", {
                    data: { type: "oncyber:game:ask", n: 9, name: "session" },
                    origin: frame.world,
                    source: element().contentWindow,
                })
            );
        });
        expect(answer()).toEqual({
            type: "oncyber:game:answer",
            n: 9,
            value: undefined,
        });
    });
});

describe("a world that stops", () => {
    const alive = () => fromWorld({ type: "oncyber:game:alive" });
    const drawn = () =>
        fromWorld({
            type: "oncyber:game:first-frame",
            ms: 900,
            width: 1280,
            height: 720,
        });
    const pass = (ms: number) => act(() => void jest.advanceTimersByTime(ms));

    test("silence after it has drawn is said on the page, with a way to load it again", () => {
        drawn();
        for (let i = 0; i < 5; i++) {
            alive();
            pass(1000);
        }
        expect(retry()).toBeNull();

        const first = element();
        pass(9000);
        expect(retry().textContent).toBe("This world stopped responding.");
        // the page's own things are still there
        expect(shown()).toBe("Starry Night");

        act(() => retry().click());
        expect(element()).not.toBe(first);
        expect(retry()).toBeNull();
    });

    test("a world that comes back is no longer called stopped", () => {
        drawn();
        alive();
        pass(9000);
        expect(retry()).not.toBeNull();
        alive();
        pass(1000);
        expect(retry()).toBeNull();
    });

    test("a tab out of view is not a stopped world", () => {
        drawn();
        alive();
        Object.defineProperty(document, "hidden", {
            configurable: true,
            get: () => true,
        });
        act(() => void document.dispatchEvent(new Event("visibilitychange")));
        pass(60_000);
        expect(retry()).toBeNull();
        Object.defineProperty(document, "hidden", {
            configurable: true,
            get: () => false,
        });
        act(() => void document.dispatchEvent(new Event("visibilitychange")));
        pass(5000);
        expect(retry()).toBeNull();
    });
});

describe("a link the world asks to open", () => {
    let opened: jest.SpyInstance;
    beforeEach(() => {
        opened = jest.spyOn(window, "open").mockImplementation(() => null);
    });
    const ask = (href: unknown) =>
        fromWorld({ type: "oncyber:game:open-link", href });

    test("the page says where it goes and opens it on the visitor's click, never on the world's word", () => {
        ask("https://opensea.io/assets/1");
        expect(opened).not.toHaveBeenCalled();
        expect(retry().textContent).toBe("Open opensea.io in a new tab?");
        expect(retry().dataset.label).toBe("Open link");

        act(() => retry().click());
        expect(opened).toHaveBeenCalledWith(
            "https://opensea.io/assets/1",
            "_blank",
            "noopener,noreferrer"
        );
        expect(retry()).toBeNull();
    });

    test("what is not a web address is not offered", () => {
        ask("javascript:alert(1)");
        ask({ href: "https://opensea.io" });
        expect(retry()).toBeNull();
        expect(opened).not.toHaveBeenCalled();
    });

    test("an offer nobody takes goes away, and a newer one replaces an older", () => {
        ask("https://opensea.io/1");
        ask("https://foundation.app/2");
        expect(retry().textContent).toBe("Open foundation.app in a new tab?");
        act(() => void jest.advanceTimersByTime(16_000));
        expect(retry()).toBeNull();
        expect(opened).not.toHaveBeenCalled();
    });
});

describe("a file the world asks to save", () => {
    test("the page offers it and saves it on the visitor's click", () => {
        const made: string[] = [];
        (URL as any).createObjectURL = () => "blob:page/1";
        (URL as any).revokeObjectURL = () => {};
        const click = jest
            .spyOn(HTMLAnchorElement.prototype, "click")
            .mockImplementation(function (this: HTMLAnchorElement) {
                made.push(`${this.download} ${this.href}`);
            });
        fromWorld({
            type: "oncyber:game:download",
            name: "photo.png",
            file: new Blob(["x"], { type: "image/png" }),
        });
        expect(retry().textContent).toBe("Save photo.png?");
        expect(retry().dataset.label).toBe("Save");
        expect(made).toEqual([]);
        act(() => retry().click());
        expect(made).toEqual(["photo.png blob:page/1"]);
        expect(retry()).toBeNull();
        click.mockRestore();
    });

    test("a page that is not a picture or a film is not offered", () => {
        fromWorld({
            type: "oncyber:game:download",
            name: "a.html",
            file: new Blob(["<p>"], { type: "text/html" }),
        });
        expect(retry()).toBeNull();
    });
});
