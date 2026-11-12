/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import useChat from "../../context/hooks/useChat";

const mockWorld = {
    getPlayerData: jest.fn(() => ({
        position: { x: 0, y: 0, z: 0 },
        space: "space",
    })),
    setEventListener: jest.fn((name: string, callback: any) => {}),
    handleCommand: jest.fn(() => ({ success: true })),
};
const mockListeners: Record<string, (...args: any[]) => void> = {};
const mockPeer = jest.fn();
const mockChannel = jest.fn();
const mockDispose = jest.fn();
jest.mock("../../hooks/useWorld", () => ({
    useWorld: () => ({ current: mockWorld }),
}));
jest.mock("@3gl/factory/player/constants", () => ({ CHAT_NEARBY_RADIUS: 32 }), {
    virtual: true,
});
jest.mock(
    "@3events",
    () => ({ __esModule: true, default: { UPDATE_PLAYERS: "players" } }),
    { virtual: true }
);
jest.mock("../../three/factory/multiplayer/constants", () => ({
    UPDATE_CHAT_BUBBLE: "bubble",
}));
jest.mock("../../three/constants", () => ({ IS_MOBILE: false }));
jest.mock("../../ui/ControlPanel/Raffle/raffles/rtfktRaffleConstants", () => ({
    MINT_SPACE_CUSTOM_LINK: "disabled-space",
}));
jest.mock("@components/context/UserContext", () => ({
    UserContext: require("react").createContext({
        userData: { username: "Alice" },
    }),
}));
jest.mock("@utils/saveToDb", () => ({
    getProfanity: jest.fn(async () => null),
}));
jest.mock("@env", () => ({ nodeEnv: { PUBLIC_API: "https://api.example" } }));
jest.mock("@utils/chat/ColyseusChatProvider", () => ({
    __esModule: true,
    default: class {
        init() {}
        async login() {}
        async logout() {}
        async leaveChannel() {}
        async dispose() {
            mockDispose();
        }
        async joinChannel() {
            return {
                on: (name, fn) => {
                    mockListeners[name] = fn;
                },
            };
        }
        on(name, fn) {
            mockListeners[name] = fn;
        }
        sendPeerMessage = mockPeer;
        sendChannelMessage = mockChannel;
    },
}));
let chat: ReturnType<typeof useChat>;
let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;
let service: any;
function Hook() {
    chat = useChat({ MultiplayerService: service, userId: "user-alice" });
    return null;
}
const init = async (roomId = "room-1") => {
    await act(async () => {
        await chat.init({
            roomId,
            isMod: false,
            sessionId: "alice",
            exhibit: { info: {} } as any,
            label: roomId,
            isAnon: false,
        });
    });
    const onPlayers = mockWorld.setEventListener.mock.calls.find(
        ([name, callback]) => name === "players" && callback
    )?.[1];
    act(() =>
        onPlayers({
            bob: {
                getPayload: () => ({
                    sessionId: "bob",
                    userData: { username: "Bob" },
                }),
            },
        })
    );
};
const send = (recipientId?: string, message = "hello") => {
    let result: any;
    act(() => {
        result = chat.sendMessage({
            type: "MESSAGE",
            payload: { message, recipientId, loading: false },
            roomId: "forged-room",
            sessionId: "forged-self",
        });
    });
    return result;
};
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.clearAllMocks();
    Object.keys(mockListeners).forEach((key) => delete mockListeners[key]);
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    service = { current: { roomService: { room: {} } } };
    container = document.createElement("div");
    root = createRoot(container);
    act(() => root.render(<Hook />));
});
afterEach(async () => {
    if (chat.active)
        await act(async () => {
            await chat.dispose("room-1");
        });
    act(() => root.unmount());
});

test("mounted provider binds own room/session and keeps DM out of public history", async () => {
    await init();
    const privateMessage = send("bob");
    expect(privateMessage).toMatchObject({ direct: "bob", sessionId: "alice" });
    expect(mockPeer).toHaveBeenCalledWith(
        expect.objectContaining({ direct: "bob", text: "hello" }),
        "bob"
    );
    expect(mockChannel).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    send(undefined, "room hello");
    expect(mockChannel).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: "alice", text: "room hello" }),
        "room-1"
    );
    expect(fetch).toHaveBeenCalledWith(
        "https://api.example/api/chat/history?roomId=room-1",
        expect.anything()
    );
});

test("peer receive uses relay sender and never triggers a world bubble", async () => {
    await init();
    act(() =>
        mockListeners.MessageFromPeer(
            JSON.stringify({
                type: "MESSAGE",
                text: "secret",
                sessionId: "forged",
                direct: "other",
            }),
            "bob",
            Date.now(),
            { username: "Bob" }
        )
    );
    expect(chat.messages[0]).toMatchObject({
        text: "secret",
        sessionId: "bob",
        direct: "alice",
    });
    expect(mockWorld.handleCommand).not.toHaveBeenCalled();
    await act(async () =>
        mockListeners.ChannelMessage(
            { type: "MESSAGE", text: "forged DM", direct: "alice" },
            "bob",
            Date.now()
        )
    );
    expect(chat.messages).toHaveLength(1);
    await act(async () =>
        mockListeners.ChannelMessage(
            { type: "MESSAGE", text: "public", sessionId: "forged" },
            "bob",
            Date.now()
        )
    );
    expect(chat.messages[0]).toMatchObject({
        text: "public",
        sessionId: "bob",
        direct: undefined,
    });
    expect(mockWorld.handleCommand).toHaveBeenCalledTimes(1);
});

test("disabled native chat rejects room and private sends equally", async () => {
    await init("disabled-space");
    expect(send()).toBeUndefined();
    expect(send("bob")).toBeUndefined();
    expect(mockPeer).not.toHaveBeenCalled();
    expect(mockChannel).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
});

test("missing recipient and private link updates cannot broadcast", async () => {
    await init();
    expect(send("missing")).toBeUndefined();
    act(() =>
        chat.sendMessage({
            type: "REFRESH_MESSAGE",
            payload: { acc_date: "same", recipientId: "bob", loading: false },
            roomId: "room-1",
            sessionId: "alice",
        })
    );
    expect(mockPeer).toHaveBeenCalledTimes(1);
    expect(mockChannel).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
});
