/** @jest-environment jsdom */
import React, { act, useContext } from "react";
import { createRoot } from "react-dom/client";
import MultiplayerProvider, {
    KICK_COMMAND,
    MultiplayerContext,
} from "./MultiplayerProvider";
import { UserContext } from "@components/context/UserContext";
import { formatAvatar } from "../utils/avatar";

let mockServices: any;
let mockWorld: any;
// The exhibit as the page sees it now; the provider is given the one it
// was served with.
let mockLiveExhibit: any;
const mockCheckGating = jest.fn();
const mockRoom = {
    init: jest.fn(),
    dispose: jest.fn(),
    setIsMod: jest.fn(),
    label: "gallery",
};
const mockChat = {
    init: jest.fn(),
    dispose: jest.fn(),
    setAdmins: jest.fn(),
    setUsers: jest.fn(),
    sendMessage: jest.fn(),
};
const mockVoice = { init: jest.fn(), dispose: jest.fn() };
jest.mock("./hooks/useRoom", () => ({
    __esModule: true,
    default: () => mockRoom,
}));
jest.mock("./hooks/useChat", () => ({
    __esModule: true,
    default: ({ MultiplayerService }) => {
        mockServices = MultiplayerService;
        return mockChat;
    },
    CHAT_TYPES: { KICK: { label: "KICK" } },
}));
jest.mock("@features/studio/context/ExhibitContext", () => ({
    useCurrentExhibit: () => ({ exhibit: mockLiveExhibit }),
}));
jest.mock("./hooks/useVoice", () => ({
    __esModule: true,
    default: () => mockVoice,
}));
jest.mock("../hooks/useWorld", () => ({ useWorld: () => mockWorld }));
jest.mock("../utils/avatar", () => ({ formatAvatar: jest.fn() }));
jest.mock("@components/context/UserContext", () => ({
    UserContext: require("react").createContext({}),
}));
jest.mock("@components/context/GatingErrorContext", () => ({
    useGatingError: () => ({}),
}));
jest.mock("@components/hooks/useEventCallback", () => ({
    useEventCallback: (fn) => fn,
}));
jest.mock("@utils/saveToDb", () => ({ getProfanity: async () => null }));
jest.mock("@utils/nativeStartupDiagnostics", () => ({
    markNativeStartup: jest.fn(),
}));
jest.mock("@utils/lobbyDestinationBridge", () => ({
    isLobbyDestinationPreparing: () => false,
    isLobbyDestinationEntering: () => true,
}));
jest.mock("../three/factory/player/constants", () => ({}));
jest.mock("../three/constants", () => ({ IS_MULTIPLAYER_ENABLED: () => true }));
jest.mock("../three/factory/multiplayer/constants", () => ({
    GET_USERS_INFO: "players",
}));
jest.mock("../ui/ControlPanel/context/PanelProvider", () => ({
    Mode: { SOLO: "solo", MULTIPLAYER: "multiplayer" },
}));
jest.mock("@utils/voiceChat/constants", () => ({ RTC_SPACES: [] }));
jest.mock(
    "@api/social/_api",
    () => ({
        __esModule: true,
        default: {
            opts: () => ({
                isMod: async () => false,
                checkGating: (request) => mockCheckGating(request),
            }),
        },
    }),
    { virtual: true }
);
jest.mock("@utils/arena", () => ({ __esModule: true, default: {} }));
jest.mock("@utils/chat/ColyseusChatProvider", () => ({
    __esModule: true,
    default: class {},
}));
let container: HTMLDivElement, root: ReturnType<typeof createRoot>;
let context: React.ContextType<typeof MultiplayerContext>;
const account = {
    user: { id: "visitor" },
    userData: { username: "Visitor" },
    token: null,
    dispatch: jest.fn(),
};
const exhibit = { id: "gallery", info: { customLink: "gallery" } };
function Harness() {
    context = useContext(MultiplayerContext);
    return null;
}
const tree = (served: any = exhibit) => (
    <UserContext.Provider value={account as any}>
        <MultiplayerProvider exhibit={served} destination={{}} vrmUrl={null}>
            <Harness />
        </MultiplayerProvider>
    </UserContext.Provider>
);
function deferred<T>() {
    let resolve: (value: T) => void, reject: (reason: any) => void;
    const promise = new Promise<T>((yes, no) => {
        resolve = yes;
        reject = no;
    });
    return { promise, resolve, reject };
}
const flush = async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
};
beforeEach(async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    mockWorld = {
        current: {
            setMultiplayer: jest.fn(async () => {}),
            getPlayerData: jest.fn(() => ({ position: { x: 7, y: 2, z: 9 } })),
            handleCommand: jest.fn(),
            pause: jest.fn(),
            resetCamera: jest.fn(),
        },
    };
    (formatAvatar as jest.Mock).mockResolvedValue("avatar.png");
    mockLiveExhibit = exhibit;
    mockRoom.init.mockImplementation(async () => {
        mockServices.current.roomService = { room: { sessionId: "session" } };
        return { label: "gallery", sessionId: "session" };
    });
    mockChat.init.mockImplementation(async () => {
        const channel = { on: jest.fn(), removeAllListeners: jest.fn() };
        mockServices.current.chatService = {
            channels: { gallery: { channel } },
            on: jest.fn(),
            removeAllListeners: jest.fn(),
        };
        return channel;
    });
    mockVoice.init.mockResolvedValue(undefined);
    mockRoom.dispose.mockResolvedValue(undefined);
    mockChat.dispose.mockResolvedValue(undefined);
    mockVoice.dispose.mockResolvedValue(undefined);
    container = document.createElement("div");
    root = createRoot(container);
    await act(async () => root.render(tree()));
});
afterEach(async () => {
    await act(async () => {
        root.unmount();
        await flush();
    });
    jest.restoreAllMocks();
});

test("cancelled stalled profile settles promptly and cannot mutate the scene later", async () => {
    const profile = deferred<string>();
    (formatAvatar as jest.Mock).mockReturnValue(profile.promise);
    const controller = new AbortController();
    let pending: Promise<boolean>;
    await act(async () => {
        pending = context.changeMode("multiplayer", {
            background: true,
            signal: controller.signal,
        });
        await flush();
    });
    const dispatch = (formatAvatar as jest.Mock).mock.calls[0][1];
    await act(async () => {
        controller.abort();
        expect(await pending).toBe(false);
    });
    await act(async () => {
        dispatch({ type: "late" });
        profile.resolve("late");
        await flush();
    });
    expect(account.dispatch).not.toHaveBeenCalled();
    expect(mockRoom.init).not.toHaveBeenCalled();
    expect(mockWorld.current.setMultiplayer).not.toHaveBeenCalled();
});

test("cancelling a delayed room cannot attach the engine or reset the camera", async () => {
    const room = deferred<any>();
    mockRoom.init.mockReturnValue(room.promise);
    const controller = new AbortController();
    let pending: Promise<boolean>;
    await act(async () => {
        pending = context.changeMode("multiplayer", {
            background: true,
            signal: controller.signal,
        });
        await flush();
    });
    expect(mockRoom.init).toHaveBeenCalledTimes(1);
    expect(mockRoom.init.mock.calls[0][2].signal).toBeInstanceOf(AbortSignal);
    await act(async () => {
        controller.abort();
        expect(await pending).toBe(false);
    });
    await act(async () => {
        room.resolve({ sessionId: "late" });
        await flush();
    });
    expect(mockWorld.current.setMultiplayer).not.toHaveBeenCalled();
    expect(mockWorld.current.resetCamera).not.toHaveBeenCalled();
    expect(mockWorld.current.pause).not.toHaveBeenCalled();
});

test("background admission failure is retryable without changing mode or bouncing the scene", async () => {
    mockRoom.init.mockResolvedValueOnce(undefined);
    const callback = jest.fn();
    context._onChangeModeCallback.current = callback;
    await act(async () => {
        expect(
            await context.changeMode("multiplayer", { background: true })
        ).toBe(false);
    });
    expect(context.mode).toBe("multiplayer");
    expect(callback).not.toHaveBeenCalled();
    expect(mockWorld.current.setMultiplayer).not.toHaveBeenCalled();
    await act(async () => {
        expect(
            await context.changeMode("multiplayer", { background: true })
        ).toBe(true);
    });
    expect(mockRoom.init).toHaveBeenCalledTimes(2);
    expect(mockWorld.current.setMultiplayer).toHaveBeenCalledTimes(1);
});

test("a completed background session remains owned by its entry signal without changing camera", async () => {
    const controller = new AbortController();
    await act(async () => {
        expect(
            await context.changeMode("multiplayer", {
                background: true,
                signal: controller.signal,
            })
        ).toBe(true);
    });
    expect(mockWorld.current.setMultiplayer).toHaveBeenCalledTimes(1);
    const payload = mockWorld.current.setMultiplayer.mock.calls[0][0];
    expect(payload.mode).toBe("multiplayer");
    expect(mockRoom.init.mock.calls[0][1].position).toEqual({
        x: 7,
        y: 2,
        z: 9,
    });
    await act(async () => {
        controller.abort();
        await context.dispose();
    });
    expect(mockRoom.dispose).toHaveBeenCalled();
    expect(mockWorld.current.setMultiplayer).toHaveBeenCalledTimes(1);
    expect(mockWorld.current.resetCamera).not.toHaveBeenCalled();
});

test("failed partial engine setup is cleaned before retry without camera reset", async () => {
    mockWorld.current.setMultiplayer.mockRejectedValueOnce(
        Error("engine incomplete")
    );
    await act(async () => {
        expect(
            await context.changeMode("multiplayer", { background: true })
        ).toBe(false);
    });
    expect(mockRoom.dispose).toHaveBeenCalled();
    expect(mockChat.dispose).toHaveBeenCalled();
    expect(mockWorld.current.setMultiplayer).toHaveBeenNthCalledWith(2, {
        mode: "solo",
        preserveCamera: true,
    });
    await act(async () => {
        expect(
            await context.changeMode("multiplayer", { background: true })
        ).toBe(true);
    });
    expect(
        mockWorld.current.setMultiplayer.mock.calls.filter(
            ([arg]) => arg.mode === "multiplayer"
        )
    ).toHaveLength(2);
    expect(mockRoom.init).toHaveBeenCalledTimes(2);
});

test("voice or chat failure after engine attachment never creates a duplicate native room", async () => {
    mockVoice.init.mockRejectedValueOnce(Error("voice temporarily down"));
    await act(async () => {
        expect(
            await context.changeMode("multiplayer", { background: true })
        ).toBe(true);
    });
    await act(async () => {
        expect(
            await context.changeMode("multiplayer", { background: true })
        ).toBe(true);
    });
    expect(mockRoom.init).toHaveBeenCalledTimes(1);
    expect(mockWorld.current.setMultiplayer).toHaveBeenCalledTimes(1);
});

test("manual mode changes keep their original solo teardown", async () => {
    await act(async () => {
        await context.changeMode("multiplayer");
    });
    await act(async () => {
        expect(await context.changeMode("solo")).toBe(true);
    });
    expect(context.mode).toBe("solo");
    expect(mockWorld.current.setMultiplayer).toHaveBeenLastCalledWith({
        mode: "solo",
    });
});

test("native chat failure keeps the room connected and does not trigger room retries", async () => {
    mockChat.init.mockRejectedValueOnce(Error("chat import unavailable"));
    await act(async () => {
        expect(
            await context.changeMode("multiplayer", { background: true })
        ).toBe(true);
    });
    await act(async () => {
        expect(
            await context.changeMode("multiplayer", { background: true })
        ).toBe(true);
    });
    expect(mockRoom.init).toHaveBeenCalledTimes(1);
    expect(mockVoice.init).not.toHaveBeenCalled();
    expect(mockWorld.current.setMultiplayer).toHaveBeenCalledTimes(1);
});

test("duplicate background effects share one pending admission", async () => {
    const profile = deferred<string>();
    (formatAvatar as jest.Mock).mockReturnValue(profile.promise);
    let first: Promise<boolean>, second: Promise<boolean>;
    await act(async () => {
        first = context.changeMode("multiplayer", { background: true });
        second = context.changeMode("multiplayer", { background: true });
        await flush();
        profile.resolve("ready");
        expect(await first).toBe(true);
        expect(await second).toBe(true);
    });
    expect(mockRoom.init).toHaveBeenCalledTimes(1);
    expect(mockWorld.current.setMultiplayer).toHaveBeenCalledTimes(1);
});

test("an unmounted provider cannot attach a late room", async () => {
    const room = deferred<any>();
    mockRoom.init.mockReturnValue(room.promise);
    let pending: Promise<boolean>;
    await act(async () => {
        pending = context.changeMode("multiplayer", { background: true });
        await flush();
    });
    await act(async () => {
        root.render(null);
    });
    await act(async () => {
        expect(await pending).toBe(false);
    });
    await act(async () => {
        room.resolve({ sessionId: "late" });
        await flush();
    });
    expect(mockWorld.current.setMultiplayer).not.toHaveBeenCalled();
});

test("the connection is reported while it is made and is idle again in solo", async () => {
    expect(context.connection).toBe("idle");
    const profile = deferred<string>();
    (formatAvatar as jest.Mock).mockReturnValue(profile.promise);
    let pending: Promise<boolean>;
    await act(async () => {
        pending = context.changeMode("multiplayer");
        await flush();
    });
    expect(context.connection).toBe("connecting");
    await act(async () => {
        profile.resolve("avatar.png");
        expect(await pending).toBe(true);
    });
    expect(context.connection).toBe("connected");
    await act(async () => {
        expect(await context.changeMode("solo")).toBe(true);
    });
    expect(context.connection).toBe("idle");
});

test("an attempt that does not get in is reported as failed until the next one", async () => {
    mockRoom.init.mockResolvedValueOnce(undefined);
    await act(async () => {
        expect(await context.changeMode("multiplayer")).toBe(false);
    });
    // The visitor is left in solo, and told the room was not reached.
    expect(context.mode).toBe("solo");
    expect(context.connection).toBe("failed");
    mockWorld.current.setMultiplayer.mockRejectedValueOnce(
        Error("engine incomplete")
    );
    await act(async () => {
        expect(
            await context.changeMode("multiplayer", { background: true })
        ).toBe(false);
    });
    expect(context.connection).toBe("failed");
    await act(async () => {
        expect(
            await context.changeMode("multiplayer", { background: true })
        ).toBe(true);
    });
    expect(context.connection).toBe("connected");
});

test("a cancelled attempt leaves no connection to report", async () => {
    const room = deferred<any>();
    mockRoom.init.mockReturnValue(room.promise);
    const controller = new AbortController();
    let pending: Promise<boolean>;
    await act(async () => {
        pending = context.changeMode("multiplayer", {
            background: true,
            signal: controller.signal,
        });
        await flush();
    });
    expect(context.connection).toBe("connecting");
    await act(async () => {
        controller.abort();
        expect(await pending).toBe(false);
        await flush();
    });
    expect(context.connection).toBe("idle");
});

test("a room that closes underneath a connected visitor is reported as lost", async () => {
    const room = mockRoom as any;
    try {
        // Nothing was connected, so there is nothing to lose.
        room.lost = true;
        await act(async () => root.render(tree()));
        expect(context.connection).toBe("idle");
        room.lost = false;
        await act(async () => {
            expect(await context.changeMode("multiplayer")).toBe(true);
        });
        expect(context.connection).toBe("connected");
        room.lost = true;
        await act(async () => root.render(tree()));
        expect(context.connection).toBe("lost");
        await act(async () => {
            await context.dispose();
        });
        expect(context.connection).toBe("idle");
    } finally {
        delete room.lost;
    }
});

const join = async () => {
    await act(async () => {
        expect(await context.changeMode("multiplayer")).toBe(true);
    });
    expect(context.connection).toBe("connected");
};
// A command as the room relays it to every client.
const receive = (type: string, data: any) => {
    const { channel } = mockServices.current.chatService.channels.gallery;
    const listener = channel.on.mock.calls.find(
        ([name]) => name === "ChannelMessage"
    )[1];
    return act(async () => {
        listener({ type: "RTM_COMMAND", command: { type, data } }, "moderator");
        await flush();
    });
};
const engineCalls = () =>
    mockWorld.current.setMultiplayer.mock.calls.map(([arg]) =>
        arg.mode === "solo" && arg.preserveCamera ? "cleared" : arg.mode
    );

test("a visitor a moderator removes is told so and is not offered a way back", async () => {
    // Two joins: only the room joined last answers a removal.
    await join();
    await act(async () => {
        await context.changeMode("solo");
    });
    await join();
    await receive(KICK_COMMAND, { userId: "someone-else" });
    expect(context.connection).toBe("connected");
    mockRoom.dispose.mockClear();
    await receive(KICK_COMMAND, { userId: "visitor" });
    expect(context.connection).toBe("removed");
    expect(mockRoom.dispose).toHaveBeenCalled();
    expect(mockChat.sendMessage).toHaveBeenCalledTimes(1);
    expect(mockChat.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
            type: "KICK",
            payload: { userId: "visitor" },
        })
    );
    // The panel is left in multiplayer, as before.
    expect(context.mode).toBe("multiplayer");
    await act(async () => {
        expect(await context.rejoin()).toBe(false);
        expect(await context.enterPassword("anything")).toBe("other-error");
    });
    expect(context.connection).toBe("removed");
    expect(mockRoom.init).toHaveBeenCalledTimes(2);
    // Closing again, for whatever reason, does not lose the explanation.
    await act(async () => {
        await context.dispose();
    });
    expect(context.connection).toBe("removed");
    // Solo picked by the visitor is a choice: nothing is left to explain.
    await act(async () => {
        await context.changeMode("solo");
    });
    expect(context.connection).toBe("idle");
});

test("a visitor who was away for too long is put in solo, told why, and can rejoin", async () => {
    const away = 1000 * 60 * 120;
    // Mounted again so the watch, and its clock, are the fake ones.
    await act(async () => {
        root.unmount();
        await flush();
    });
    jest.useFakeTimers();
    try {
        root = createRoot(container);
        await act(async () => root.render(tree()));
        const panel = jest.fn();
        context._onChangeModeCallback.current = panel;
        await join();
        await act(async () => {
            jest.advanceTimersByTime(away);
            await flush();
        });
        // Not yet: the visitor has to be away for more than two hours.
        expect(context.connection).toBe("connected");
        await act(async () => {
            jest.advanceTimersByTime(30_000);
            for (let i = 0; i < 5; i++) await flush();
        });
        expect(context.connection).toBe("inactive");
        expect(context.mode).toBe("solo");
        expect(panel).toHaveBeenLastCalledWith(1);
        expect(mockWorld.current.setMultiplayer).toHaveBeenLastCalledWith({
            mode: "solo",
        });
        await act(async () => {
            expect(await context.rejoin()).toBe(true);
        });
        expect(context.connection).toBe("connected");
        expect(context.mode).toBe("multiplayer");
        expect(panel).toHaveBeenLastCalledWith(0);
        expect(mockRoom.init).toHaveBeenCalledTimes(2);
    } finally {
        jest.useRealTimers();
    }
});

describe("a world whose password changes", () => {
    // Exhibits carry the password's revision, never the password.
    const password = (rev: string) => ({
        ...exhibit,
        gating: { password: { message: "", rev } },
    });
    const served = password("old");
    const enter = async () => {
        mockLiveExhibit = served;
        await act(async () => root.render(tree(served)));
        await join();
    };
    // The page sees the new exhibit; DisplayScene then closes the room.
    const change = async (live: any) => {
        mockLiveExhibit = live;
        await act(async () => root.render(tree(served)));
        await act(async () => {
            await context.dispose();
        });
    };

    test("says so, and joins again once the server accepts the new one", async () => {
        await enter();
        await change(password("new"));
        expect(context.connection).toBe("password-changed");
        await act(async () => {
            expect(await context.rejoin()).toBe(false);
        });
        mockCheckGating.mockResolvedValueOnce({ type: "password-error" });
        await act(async () => {
            expect(await context.enterPassword("wrong")).toBe("password-error");
        });
        expect(mockCheckGating).toHaveBeenLastCalledWith({
            spaceId: "gallery",
            nbPlayers: 0,
            password: "wrong",
        });
        mockCheckGating.mockRejectedValueOnce(Error("offline"));
        jest.spyOn(console, "error").mockImplementation(() => {});
        await act(async () => {
            expect(await context.enterPassword("new")).toBe("other-error");
        });
        expect(context.connection).toBe("password-changed");
        expect(mockRoom.init).toHaveBeenCalledTimes(1);
        mockCheckGating.mockResolvedValueOnce({ type: "success" });
        await act(async () => {
            expect(await context.enterPassword("new")).toBeNull();
            for (let i = 0; i < 5; i++) await flush();
        });
        expect(context.connection).toBe("connected");
        expect(mockRoom.init).toHaveBeenCalledTimes(2);
        expect(engineCalls()).toEqual([
            "multiplayer",
            "cleared",
            "multiplayer",
        ]);
    });

    test.each<[string, () => Promise<void>]>([
        [
            "the password is the one the visitor came in with",
            () => change(served),
        ],
        [
            "the page has moved on to another world",
            () => change({ ...password("new"), id: "elsewhere" }),
        ],
        [
            "the visitor is a moderator",
            async () => {
                (mockRoom as any).isMod = true;
                await change(password("new"));
            },
        ],
    ])("a close is not put down to the password when %s", async (_, close) => {
        try {
            await enter();
            await close();
            expect(context.connection).toBe("idle");
        } finally {
            delete (mockRoom as any).isMod;
        }
    });

    test("hashing a stored plain password is not a password change", async () => {
        // Before migration a read shows only that a password is required.
        const unmigrated = {
            ...exhibit,
            gating: { password: { message: "", rev: "unmigrated" } },
        };
        mockLiveExhibit = unmigrated;
        await act(async () => root.render(tree(unmigrated)));
        await join();
        mockLiveExhibit = password("hashed");
        await act(async () => root.render(tree(unmigrated)));
        await act(async () => {
            await context.dispose();
        });
        expect(context.connection).toBe("idle");
    });

    test("the room join carries the proof the password check gave", async () => {
        await enter();
        await change(password("new"));
        mockCheckGating.mockResolvedValueOnce({
            type: "success",
            proof: "wa1.e30.signature",
        });
        await act(async () => {
            expect(await context.enterPassword("new")).toBeNull();
            for (let i = 0; i < 5; i++) await flush();
        });
        expect(mockRoom.init).toHaveBeenLastCalledWith(
            expect.anything(),
            expect.objectContaining({ accessProof: "wa1.e30.signature" }),
            expect.anything(),
            expect.anything()
        );
    });

    test("nothing is said to a visitor who was in solo by choice", async () => {
        await enter();
        await act(async () => {
            await context.changeMode("solo");
        });
        await change(password("new"));
        expect(context.connection).toBe("idle");
    });
});

describe("joining again", () => {
    const room = mockRoom as any;
    afterEach(() => {
        delete room.lost;
    });
    const lose = async () => {
        await join();
        room.lost = true;
        await act(async () => root.render(tree()));
        expect(context.connection).toBe("lost");
    };

    test("a lost room is rejoined in place, and says connecting from the first moment", async () => {
        await lose();
        const leaving = deferred<void>();
        mockRoom.dispose.mockReturnValueOnce(leaving.promise);
        let pending: Promise<boolean>;
        await act(async () => {
            pending = context.rejoin();
            await flush();
        });
        // Leaving a room that already dropped can take seconds.
        expect(context.connection).toBe("connecting");
        expect(mockRoom.init).toHaveBeenCalledTimes(1);
        room.lost = false;
        await act(async () => {
            leaving.resolve();
            expect(await pending).toBe(true);
        });
        expect(context.connection).toBe("connected");
        expect(context.mode).toBe("multiplayer");
        // The old room's players leave the engine before the new ones arrive.
        expect(engineCalls()).toEqual([
            "multiplayer",
            "cleared",
            "multiplayer",
        ]);
        expect(mockRoom.init).toHaveBeenCalledTimes(2);
    });

    test("an attempt that did not get in can be tried again", async () => {
        mockRoom.init.mockResolvedValueOnce(undefined);
        await act(async () => {
            expect(await context.changeMode("multiplayer")).toBe(false);
        });
        expect(context.connection).toBe("failed");
        await act(async () => {
            expect(await context.rejoin()).toBe(true);
        });
        expect(context.connection).toBe("connected");
        expect(context.mode).toBe("multiplayer");
    });

    test("a rejoin that fails says so without moving the visitor to solo", async () => {
        await lose();
        room.lost = false;
        mockRoom.init.mockResolvedValueOnce(undefined);
        const panel = jest.fn();
        context._onChangeModeCallback.current = panel;
        await act(async () => {
            expect(await context.rejoin()).toBe(false);
        });
        expect(context.connection).toBe("failed");
        expect(context.mode).toBe("multiplayer");
        expect(panel).not.toHaveBeenCalledWith(1);
    });

    test("it is the room joined last, not the page's, after a portal", async () => {
        await join();
        const next = { id: "museum", info: { customLink: "museum" } };
        await act(async () => {
            await context.switchRoom({
                exhibit: next,
                destination: { floor: 2 },
            });
        });
        expect(context.connection).toBe("connected");
        room.lost = true;
        await act(async () => root.render(tree()));
        await act(async () => {
            expect(await context.rejoin()).toBe(true);
        });
        expect(mockRoom.init).toHaveBeenCalledTimes(3);
        expect(mockRoom.init.mock.calls[2][0]).toBe(next);
        expect(mockWorld.current.setMultiplayer).toHaveBeenLastCalledWith(
            expect.objectContaining({ roomParameters: { floor: 2 } })
        );
    });

    test("there is nothing to rejoin while connected, connecting or in solo", async () => {
        await act(async () => {
            expect(await context.rejoin()).toBe(false);
        });
        await join();
        await act(async () => {
            expect(await context.rejoin()).toBe(false);
        });
        expect(mockRoom.init).toHaveBeenCalledTimes(1);
        expect(context.connection).toBe("connected");
    });
});
