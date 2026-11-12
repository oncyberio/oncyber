/** @jest-environment jsdom */
// A portal moves the visitor to another world without changing the page's
// props; turning multiplayer on afterwards must join the room of the world
// they stand in, not the first one.
import React, { act, useContext } from "react";
import { createRoot } from "react-dom/client";
import MultiplayerProvider, {
    KICK_COMMAND,
    MultiplayerContext,
} from "./MultiplayerProvider";
import { UserContext } from "@components/context/UserContext";
import { formatAvatar } from "@components/_3DExhibit-v2/utils/avatar";

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
jest.mock("@components/_3DExhibit-v2/context/hooks/useRoom", () => ({
    __esModule: true,
    default: () => mockRoom,
}));
jest.mock("@components/_3DExhibit-v2/context/hooks/useChat", () => ({
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
jest.mock("@components/_3DExhibit-v2/context/hooks/useVoice", () => ({
    __esModule: true,
    default: () => mockVoice,
}));
jest.mock("@components/_3DExhibit-v2/hooks/useWorld", () => ({
    useWorld: () => mockWorld,
}));
jest.mock("@components/_3DExhibit-v2/utils/avatar", () => ({
    formatAvatar: jest.fn(),
}));
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
jest.mock(
    "@components/_3DExhibit-v2/three/factory/player/constants",
    () => ({})
);
jest.mock("@components/_3DExhibit-v2/three/constants", () => ({
    IS_MULTIPLAYER_ENABLED: () => true,
}));
jest.mock(
    "@components/_3DExhibit-v2/three/factory/multiplayer/constants",
    () => ({
        GET_USERS_INFO: "players",
    })
);
jest.mock(
    "@components/_3DExhibit-v2/ui/ControlPanel/context/PanelProvider",
    () => ({
        Mode: { SOLO: "solo", MULTIPLAYER: "multiplayer" },
    })
);
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

// Reproduction for glitch 2 (R6). The provider is mounted for world A (the
// page's world). A portal takes the visitor to world B in place: DisplayScene
// calls switchRoom({ exhibit: B, ... }). The visitor then turns multiplayer
// on. Expected: the room joined is B's. These tests pass when the bug is
// present (they pin the CURRENT behaviour) and are marked as such.
const worldB = { id: "worldB", info: { customLink: "world-b" } };
const joinedLabels = () =>
    mockRoom.init.mock.calls.map((call) => call[2].label);
const joinedSpaces = () =>
    mockRoom.init.mock.calls.map((call) => call[1].currentSpace);

test("FIXED: solo, portal to B, then multiplayer joins A's room", async () => {
    // The visitor had multiplayer on in A and turned it off (solo).
    await act(async () => {
        await context.changeMode("multiplayer");
    });
    await act(async () => {
        await context.changeMode("solo");
    });
    expect(context.mode).toBe("solo");
    mockRoom.init.mockClear();
    // Portal to B while solo: switchRoom returns early and records nothing.
    await act(async () => {
        await context.switchRoom({ exhibit: worldB, destination: {} });
    });
    expect(mockRoom.init).not.toHaveBeenCalled();
    // Multiplayer on, standing in B.
    await act(async () => {
        await context.changeMode("multiplayer");
    });
    console.info(
        "joined labels",
        joinedLabels(),
        "currentSpace",
        joinedSpaces()
    );
    expect(joinedLabels()).toEqual(["world-b"]);
    expect(joinedSpaces()).toEqual(["worldB"]);
});

test("FIXED: multiplayer, portal to B, solo, multiplayer again joins A's room", async () => {
    await act(async () => {
        await context.changeMode("multiplayer");
    });
    await act(async () => {
        await context.switchRoom({ exhibit: worldB, destination: {} });
    });
    await act(async () => {
        await context.changeMode("solo");
    });
    await act(async () => {
        await context.changeMode("multiplayer");
    });
    console.info("joined labels", joinedLabels());
    expect(joinedLabels()).toEqual(["gallery", "world-b", "world-b"]);
});
