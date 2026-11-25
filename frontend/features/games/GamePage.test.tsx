/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import {
    isLobbyDestination,
    registerLobbyDestinationEntry,
    waitForLobbyDestinationEntry,
} from "@utils/lobbyDestinationBridge";
import { readLobbyGroupCohort } from "@utils/lobbyGroupContext";
import GamePage from "./GamePage";
import { GAMES } from "./catalog";

jest.mock("next/router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@components/context/UserContext", () => ({
    UserContext: require("react").createContext({}),
}));
jest.mock("@features/lobby/avatarSelection", () => ({
    resolveLobbyAvatar: jest.fn(async () => ({ url: "/avatars/me.vrm" })),
    DEFAULT_LOBBY_AVATAR_URL: "/avatars/default.vrm",
}));
jest.mock("@utils/lobbyDestinationBridge", () => ({
    isLobbyDestination: jest.fn(() => false),
    failLobbyDestination: jest.fn(),
    lobbyDestinationPrepared: jest.fn(),
    lobbyDestinationProgress: jest.fn(),
    registerLobbyDestinationEntry: jest.fn(() => jest.fn()),
    requestLobbyDestinationBack: jest.fn(),
    waitForLobbyDestinationEntry: jest.fn(() => new Promise(() => {})),
}));
jest.mock("@utils/lobbyGroupContext", () => ({
    readLobbyGroupCohort: jest.fn(),
}));
// Layers with tests of their own; this file is about the contract.
jest.mock("./useGameSocial", () => ({ useGameSocial: () => ({}) }));
jest.mock("./GameChat", () => ({ __esModule: true, default: () => null }));
// Field health only listens; its release lookup and analytics stay out.
jest.mock("./gameHealth", () => ({ useGameHealth: () => {} }));
jest.mock("./GameInputLayer", () => ({
    __esModule: true,
    default: () => null,
}));
jest.mock("./safeArea", () => ({
    bridgeGameSafeArea: () => () => undefined,
    CONTROLS_PLACEMENT: {},
}));
// Match results: the hook is real; its RPC client needs a bundler. The
// visitor here is signed out, so nothing is recorded.
jest.mock("@api/games/_api", () => ({
    __esModule: true,
    default: { reportResult: jest.fn(), leaderboard: jest.fn() },
}));
// Saved data: the bridge is real; the server store's RPC client needs a
// bundler. The visitor here is signed out, so only the browser is used.
jest.mock("@api/gameSaved/_api", () => ({
    __esModule: true,
    default: { savedRead: jest.fn(), savedWrite: jest.fn() },
}));
// The seat key needs the browser's crypto and storage; the bridge is real.
jest.mock("./gameMatch", () => ({
    ...jest.requireActual("./gameMatch"),
    matchSeatKey: () => "seat-key-0123456789abcdef",
}));
// The party's room: connects at once as "room-me" with whoever `mockPeers` holds.
let mockPeers: any[] = [];
// Its roster and match channel, as the page's match bridge sees the room.
const mockMatchRoom = {
    handlers: {} as Record<string, (message: any) => void>,
    onMessage(type: string, handler: (message: any) => void) {
        this.handlers[type] = handler;
    },
    send: jest.fn(),
};
jest.mock("./gameRoom", () => ({
    GameRoom: class {
        sessionId = "room-me";
        mockState: (state: any) => void;
        constructor(_who: unknown, mockState: (state: any) => void) {
            this.mockState = mockState;
            // The page's other layers (chat, voice, results...) call room
            // methods this test doesn't care about: they do nothing here.
            const nothing = () => undefined;
            return new Proxy(this, {
                get: (room, key) => (key in room ? room[key] : nothing),
            });
        }
        async connect() {
            this.mockState({
                status: "connected",
                players: mockPeers.length + 1,
            });
            (this as any).onRoom?.(mockMatchRoom);
        }
        onRelay() {}
        relay() {}
        setPose() {}
        samplePeers() {
            return mockPeers;
        }
        async close() {}
    },
}));

const cohort = "trip_0123456789abcdef";
const view = {
    cameraOffset: { x: 0, y: 2.1, z: -4.4 },
    cameraTargetOffset: { x: 0, y: 1.2, z: 0 },
    avatarRotation: 0,
    avatarLift: 0,
    fov: 55,
    peers: [
        {
            id: "lobby-a",
            name: "Ada",
            offset: { x: 1, y: 0, z: 0 },
            rotation: 0,
        },
    ],
};
let root: ReturnType<typeof createRoot>;
let host: HTMLDivElement;
let sent: any[];
const wait = (ms = 30) =>
    act(async () => {
        await new Promise((resolve) => setTimeout(resolve, ms));
    });
const frameWindow = () => host.querySelector("iframe").contentWindow;
/** A message from the game: the sandboxed frame's origin is opaque. */
const fromGame = (data: object) =>
    act(async () => {
        window.dispatchEvent(
            new MessageEvent("message", {
                data,
                source: frameWindow(),
                origin: "null",
            })
        );
    });
const types = () => sent.map((message) => message.type);
const last = (type: string) =>
    sent.filter((message) => message.type === type).at(-1);

async function mount(id = "ace") {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root.render(<GamePage game={GAMES[id]} />));
    sent = [];
    jest.spyOn(frameWindow(), "postMessage").mockImplementation(
        ((message: any) => void sent.push(message)) as any
    );
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    mockPeers = [];
    (isLobbyDestination as jest.Mock).mockReturnValue(false);
    (readLobbyGroupCohort as jest.Mock).mockReturnValue(undefined);
    (registerLobbyDestinationEntry as jest.Mock).mockClear();
});
afterEach(async () => {
    jest.restoreAllMocks();
    await act(async () => root.unmount());
    host.remove();
});

test("a contract game is answered in the one prefix and told how to enter", async () => {
    await mount();
    await fromGame({
        type: "oncyber:game:hello",
        contract: 2,
        arrival: { walkable: true },
    });
    await wait();
    expect(types()).toEqual([
        "oncyber:game:identity",
        "oncyber:game:party",
        "oncyber:game:enter",
    ]);
    expect(last("oncyber:game:identity").avatarUrl).toBe("/avatars/me.vrm");
    expect(last("oncyber:game:enter")).toMatchObject({
        arrival: { from: "direct", view: null },
        trip: null,
    });
    await fromGame({ type: "oncyber:game:ready" });
    await wait();
    expect(types().at(-1)).toBe("oncyber:game:entered");
    expect(types().some((type) => type.startsWith("ace:"))).toBe(false);
});

test("a build from before the contract is answered in its own prefix", async () => {
    await mount("garden");
    await fromGame({ type: "garden:hello" });
    await wait();
    expect(types().slice(0, 2)).toEqual(["garden:identity", "garden:party"]);
    await fromGame({ type: "garden:ready" });
    await wait(150);
    expect(types()).toContain("garden:entered");
    expect(types()).toContain("garden:peers");
    expect(types().some((type) => type.startsWith("oncyber:game:"))).toBe(
        false
    );
});

test("messages for another game, or from another window, are ignored", async () => {
    await mount();
    await fromGame({ type: "garden:hello" });
    await act(async () => {
        window.dispatchEvent(
            new MessageEvent("message", {
                data: { type: "oncyber:game:hello" },
                source: window,
                origin: window.location.origin,
            })
        );
    });
    await wait();
    expect(sent).toEqual([]);
});

test("a lobby trip enters with the lobby's view and the party, then hears who arrived", async () => {
    (isLobbyDestination as jest.Mock).mockReturnValue(true);
    (readLobbyGroupCohort as jest.Mock).mockReturnValue(cohort);
    let reveal: () => void;
    (waitForLobbyDestinationEntry as jest.Mock).mockReturnValue(
        new Promise<void>((resolve) => (reveal = resolve))
    );
    await mount();
    await fromGame({
        type: "oncyber:game:hello",
        contract: 2,
        arrival: { walkable: true },
    });
    await wait(300);
    // On a trip, enter waits for the lobby's final view.
    expect(types()).toContain("oncyber:game:identity");
    expect(types()).not.toContain("oncyber:game:enter");
    await fromGame({ type: "oncyber:game:ready" });

    const { prepareReveal } = (registerLobbyDestinationEntry as jest.Mock).mock
        .calls[0][2];
    let staged = false;
    await act(async () => {
        void prepareReveal({ travelView: view }).then(() => (staged = true));
    });
    const enter = last("oncyber:game:enter");
    expect(enter.arrival).toEqual({
        from: "lobby",
        view: {
            cameraOffset: view.cameraOffset,
            cameraTargetOffset: view.cameraTargetOffset,
            avatarRotation: 0,
            avatarHeight: 1.8,
            fov: 55,
            cameraMode: "third-person",
        },
    });
    expect(enter.trip).toMatchObject({
        id: cohort,
        room: `oncyber-ace-party-${cohort}`,
        size: 2,
        members: [{ id: "lobby-a", name: "Ada" }],
    });
    expect(types()).not.toContain("oncyber:game:arrival");
    // The lobby holds its last frame until the game has drawn the arrival.
    expect(staged).toBe(false);
    await fromGame({ type: "oncyber:game:arrival-ready" });
    await wait();
    expect(staged).toBe(true);
    await act(async () => reveal());
    await wait();
    expect(types()).toContain("oncyber:game:entered");

    // Someone arrives in the party's room: the game hears the new trip.
    mockPeers = [{ id: "room-ada", name: "Ada", pfp: "", vrm: "/a.vrm" }];
    await wait(250);
    expect(last("oncyber:game:party").party).toMatchObject({
        self: "room-me",
        arrived: [{ id: "room-ada", name: "Ada", avatarUrl: "/a.vrm" }],
    });
    const parties = sent.filter((m) => m.type === "oncyber:game:party").length;
    await wait(250);
    // Unchanged rosters aren't repeated.
    expect(sent.filter((m) => m.type === "oncyber:game:party").length).toBe(
        parties
    );

    // The room's roster is part of the same trip, not a message of its own.
    const member = (id: string, order: number) => ({
        id,
        session: `room-${id}`,
        name: id,
        seat: "player",
        state: "here",
        order,
    });
    await act(async () =>
        mockMatchRoom.handlers["game-roster"]({
            self: "m-me",
            host: "m-ada",
            members: [member("m-ada", 1), member("m-me", 2)],
        })
    );
    expect(last("oncyber:game:party").party).toMatchObject({
        self: "room-me",
        roster: {
            self: "m-me",
            host: "m-ada",
            online: true,
            members: [{ id: "m-ada" }, { id: "m-me" }],
        },
    });
    expect(types()).not.toContain("oncyber:game:roster");
    expect(types()).not.toContain("ace:roster");

    // The match channel, both ways, in the one prefix.
    await fromGame({ type: "oncyber:game:match", data: [1, 0, { x: 1 }] });
    expect(mockMatchRoom.send).toHaveBeenCalledWith("game-match", {
        data: [1, 0, { x: 1 }],
    });
    await act(async () =>
        mockMatchRoom.handlers["game-match"](["m-ada", [4, 1, { t: "hit" }]])
    );
    expect(last("oncyber:game:match")).toEqual({
        type: "oncyber:game:match",
        from: "m-ada",
        data: [4, 1, { t: "hit" }],
    });
    expect(types()).not.toContain("ace:match");
});

test("a game that isn't walkable is revealed without waiting", async () => {
    (isLobbyDestination as jest.Mock).mockReturnValue(true);
    await mount();
    await fromGame({
        type: "oncyber:game:hello",
        contract: 2,
        arrival: { walkable: false },
    });
    await wait(300);
    const { prepareReveal } = (registerLobbyDestinationEntry as jest.Mock).mock
        .calls[0][2];
    let staged = false;
    await act(async () => {
        void prepareReveal({ travelView: view }).then(() => (staged = true));
    });
    await wait(0);
    expect(staged).toBe(true);
    expect(last("oncyber:game:enter").arrival.from).toBe("lobby");
});

test("a result is read in the form the game speaks and answered through the page's sender", async () => {
    const result = {
        match: "ace-0123456789",
        format: "singles",
        durationSeconds: 61.5,
        teams: [
            {
                score: 2,
                players: [{ id: "room-a", name: "Ada", kind: "peer" }],
            },
            {
                score: 1,
                players: [{ id: "room-me", name: "Me", kind: "self" }],
            },
        ],
        winner: 0,
    };
    // The page logs each result it refuses.
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    await mount();
    await fromGame({ type: "oncyber:game:hello", contract: 2 });
    await wait();
    await fromGame({ type: "oncyber:game:ready" });
    await wait();
    await fromGame({ type: "oncyber:game:result", result });
    await wait();
    expect(last("oncyber:game:result-status")).toMatchObject({
        match: result.match,
        status: "unrecorded",
        reason: "SIGNED_OUT",
    });
    // The card floats over the game: the safe area measures it.
    const card = host.querySelector("[data-game-result]");
    expect(card?.getAttribute("data-game-overlay")).toBe("result");
    expect(card?.textContent).toContain("Ada");
    // The same match again is refused: one result per match.
    await fromGame({ type: "oncyber:game:result", result });
    await wait();
    expect(last("oncyber:game:result-status").status).toBe("rejected");
    expect(types().some((type) => type.startsWith("ace:"))).toBe(false);
});

test("an older build's result is answered in its own prefix", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    await mount("garden");
    await fromGame({ type: "garden:hello" });
    await wait();
    await fromGame({ type: "garden:result", result: { match: "nope" } });
    await wait();
    expect(last("garden:result-status")).toMatchObject({
        status: "rejected",
        reason: "RESULT_MATCH_ID",
    });
    expect(types().some((t) => t.startsWith("oncyber:game:"))).toBe(false);
});

test("loading is read in the form the game speaks and a page menu's pause goes out through the page's sender", async () => {
    const { holdGamePause } = jest.requireActual("./gamePause");
    await mount();
    const cover = () =>
        host.querySelector<HTMLElement>('[data-machine="game-loading"]');
    expect(cover()?.getAttribute("data-game-overlay")).toBe("loading");
    await fromGame({ type: "oncyber:game:hello", contract: 2 });
    await wait();
    await fromGame({
        type: "oncyber:game:progress",
        value: 0.5,
        label: "Painting the lines…",
    });
    expect(cover()?.dataset.state).toBe("loading");
    expect(cover()?.textContent).toContain("Painting the lines…");
    await fromGame({
        type: "oncyber:game:first-frame",
        ms: 900,
        width: 1280,
        height: 720,
    });
    expect(cover()?.dataset.state).toBe("drawn");
    // The first frame alone does not enter the game: `ready` does.
    expect(types()).not.toContain("oncyber:game:entered");
    await fromGame({ type: "oncyber:game:ready" });
    await wait();
    expect(types()).toContain("oncyber:game:entered");
    let release = () => {};
    await act(async () => void (release = holdGamePause()));
    expect(last("oncyber:game:pause")).toEqual({
        type: "oncyber:game:pause",
        reason: "menu",
    });
    await act(async () => release());
    expect(last("oncyber:game:resume")).toEqual({
        type: "oncyber:game:resume",
        reason: "menu",
    });
    expect(types().some((type) => type.startsWith("ace:"))).toBe(false);
});

test("the game uses the shared content sandbox and keeps gamepad input", async () => {
    await mount();
    const frame = host.querySelector("iframe");
    expect(frame.getAttribute("sandbox")).toBe(
        "allow-scripts allow-pointer-lock"
    );
    expect(frame.hasAttribute("credentialless")).toBe(true);
    expect(frame.getAttribute("allow")).toContain("microphone 'none'");
    expect(frame.getAttribute("allow")).toContain("gamepad *");
});
