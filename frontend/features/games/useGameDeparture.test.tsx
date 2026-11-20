/** @jest-environment jsdom */
import React, { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useGameDeparture } from "./useGameDeparture";
import { partyLeavePacket } from "./gamePartyLeave";

const mockPush = jest.fn();
jest.mock("next/router", () => ({ useRouter: () => ({ push: mockPush }) }));
const mockBack = jest.fn(() => false);
jest.mock("@utils/lobbyDestinationBridge", () => ({
    requestLobbyDestinationBack: () => mockBack(),
}));
const push = mockPush;
const back = mockBack;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLElement;
const render = (element: React.ReactElement) => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    act(() => root.render(element));
};
const find = (text: string) =>
    [...container.querySelectorAll("button, span, p")].find(
        (node) => node.textContent === text
    ) as HTMLElement | undefined;
const screen = {
    getByText(text: string) {
        const node = find(text);
        if (!node) throw new Error(`no "${text}" in ${container.innerHTML}`);
        return node;
    },
    queryByText: (text: string) => find(text) ?? null,
};
const fireEvent = {
    click: (node: HTMLElement) => act(() => node.click()),
};

const view = {
    cameraOffset: { x: 0, y: 2.3, z: 4.8 },
    cameraTargetOffset: { x: 0, y: 1.25, z: 0 },
    avatarRotation: 0,
    avatarHeight: 1.75,
    fov: 50,
};

function mount(inParty = true) {
    const posted: any[] = [];
    const relayed: unknown[] = [];
    const gameWindow = { postMessage: (message: any) => posted.push(message) };
    const frame = createRef<HTMLIFrameElement>();
    (frame as any).current = { contentWindow: gameWindow, focus: jest.fn() };
    const room: any = { relay: (data: unknown) => (relayed.push(data), true) };
    let api: ReturnType<typeof useGameDeparture>;
    function Page() {
        api = useGameDeparture({
            game: "ace",
            frame,
            // GamePage's postGame: the kind, in the form the game speaks.
            post: (kind, data = {}) =>
                gameWindow.postMessage({ type: `ace:${kind}`, ...data }),
            ready: true,
            room,
            inParty,
            name: "Ada",
        });
        return (
            <>
                {api.offer}
                {api.leaving && <p>leaving</p>}
            </>
        );
    }
    render(<Page />);
    const fromGame = (kind: string, data = {}, prefix = "ace:") =>
        act(() => {
            window.dispatchEvent(
                new MessageEvent("message", {
                    data: { type: prefix + kind, ...data },
                    origin: "null",
                    source: gameWindow as any,
                })
            );
        });
    return { posted, relayed, fromGame, api: () => api };
}

beforeEach(() => {
    jest.useFakeTimers();
    push.mockClear();
    back.mockReset().mockReturnValue(false);
});
afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    jest.useRealTimers();
});

test("leaving tells the party, asks the game for its last frame, then goes to the lobby", async () => {
    const { posted, relayed, fromGame, api } = mount();
    act(() => api().leave());
    expect(screen.getByText("leaving")).toBeTruthy();
    expect(relayed).toEqual([partyLeavePacket("Ada")]);
    expect(posted).toEqual([{ type: "ace:departure", reason: "self" }]);
    expect(push).not.toHaveBeenCalled();
    fromGame("departure-staging");
    fromGame("departure-ready", { view });
    await act(async () => {});
    expect(push).toHaveBeenCalledWith("/?lobby=1");
    // Leaving twice changes nothing.
    act(() => api().leave());
    expect(posted).toHaveLength(1);
    expect(relayed).toHaveLength(1);
});

test("a contract game's answer is read in the contract's form", async () => {
    const { fromGame, api } = mount(false);
    act(() => api().leave());
    fromGame("departure-staging", {}, "oncyber:game:");
    fromGame("departure-ready", { view }, "oncyber:game:");
    await act(async () => {});
    expect(push).toHaveBeenCalledWith("/?lobby=1");
});

test("in a lobby trip the bridge asks for the view and goes back itself", async () => {
    back.mockReturnValue(true);
    const { posted, fromGame, api } = mount(false);
    act(() => api().leave());
    expect(posted).toEqual([]);
    // What registerLobbyDestinationEntry's `depart` gets.
    const staged = api().depart();
    expect(posted).toEqual([{ type: "ace:departure", reason: "self" }]);
    fromGame("departure-ready", { view });
    await expect(staged).resolves.toMatchObject({
        fov: 50,
        avatarTravelPose: "idle",
        cameraMode: "third-person",
    });
    expect(push).not.toHaveBeenCalled();
});

test("a member leaving offers the others to follow", async () => {
    const { posted, relayed, fromGame, api } = mount();
    expect(api().relayed("peer-1", { t: "serve" })).toBe(false);
    act(() => void api().relayed("peer-1", partyLeavePacket("Bo")));
    expect(screen.getByText("Bo is heading back to the lobby.")).toBeTruthy();
    fireEvent.click(screen.getByText("Follow"));
    expect(posted).toEqual([{ type: "ace:departure", reason: "party" }]);
    expect(screen.queryByText("Follow")).toBeNull();
    // The follower's own notice lets the rest of the party follow in turn.
    expect(relayed).toEqual([partyLeavePacket("Ada")]);
    fromGame("departure-ready", { view });
    await act(async () => {});
    expect(push).toHaveBeenCalledWith("/?lobby=1");
});

test("staying dismisses the offer, and it lapses by itself", () => {
    const { posted, api } = mount();
    act(() => void api().relayed("peer-1", partyLeavePacket("Bo")));
    fireEvent.click(screen.getByText("Stay"));
    expect(screen.queryByText("Follow")).toBeNull();
    act(() => void api().relayed("peer-2", partyLeavePacket("Cy")));
    expect(screen.getByText("Cy is heading back to the lobby.")).toBeTruthy();
    act(() => void jest.advanceTimersByTime(30_000));
    expect(screen.queryByText("Follow")).toBeNull();
    expect(posted).toEqual([]);
});

test("messages that are not the game's are ignored", async () => {
    const { api } = mount(false);
    act(() => api().leave());
    act(() => {
        window.dispatchEvent(
            new MessageEvent("message", {
                data: { type: "ace:departure-ready", view },
                origin: "http://evil.example",
            })
        );
    });
    await act(async () => {});
    expect(push).not.toHaveBeenCalled();
});
