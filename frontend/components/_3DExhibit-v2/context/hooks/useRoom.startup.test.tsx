/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import useRoom from "./useRoom";
import { UserContext } from "@components/context/UserContext";
import { formatAvatar } from "@components/_3DExhibit-v2/utils/avatar";

jest.mock("next/router", () => ({ useRouter: () => ({}) }));
jest.mock("@components/context/UserContext", () => ({
    UserContext: require("react").createContext({}),
}));
jest.mock("@components/_3DExhibit-v2/utils/avatar", () => ({
    formatAvatar: jest.fn(),
}));
jest.mock("@api/social/_api", () => ({}), { virtual: true });
jest.mock("@utils/lobbyGroupContext", () => ({
    readLobbyGroupCohort: () => "trip-123",
}));

let container: HTMLDivElement, root: ReturnType<typeof createRoot>;
let hook: ReturnType<typeof useRoom>;
let services: any, arena: any;
const profile = { username: "Visitor" };
const exhibit = { id: "exhibit" } as any;
const player = { currentSpace: "exhibit", position: { x: 1, y: 2, z: 3 } };
const roomOpts = { label: "gallery", isMod: false };
const context = { userData: profile, token: "token", dispatch: jest.fn() };
function Harness() {
    hook = useRoom({ userId: "visitor", MultiplayerService: services });
    return null;
}
beforeEach(async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.spyOn(console, "log").mockImplementation(() => {});
    (formatAvatar as jest.Mock).mockResolvedValue("resolved-avatar.png");
    const room = { sessionId: "session", onStateChange: jest.fn() };
    arena = {
        room,
        joinMatch: jest.fn(async () => room),
        leaveMatch: jest.fn(async () => {}),
    };
    services = { current: { roomService: null } };
    container = document.createElement("div");
    root = createRoot(container);
    await act(async () =>
        root.render(
            <UserContext.Provider value={context as any}>
                <Harness />
            </UserContext.Provider>
        )
    );
});
afterEach(async () => {
    await act(async () => root.unmount());
    jest.clearAllMocks();
    jest.restoreAllMocks();
});

test("prepared modules do not connect early and the validated avatar is reused for admission", async () => {
    let resolveModule: (value: any) => void;
    const roomService = new Promise<any>((resolve) => {
        resolveModule = resolve;
    });
    let pending: ReturnType<typeof hook.init>;
    await act(async () => {
        pending = hook.init(
            exhibit,
            player,
            { ...roomOpts, avatar: "prepared-avatar.png" },
            { roomService }
        );
        await Promise.resolve();
    });
    expect(arena.joinMatch).not.toHaveBeenCalled();
    expect(formatAvatar).not.toHaveBeenCalled();
    await act(async () => {
        resolveModule({ default: arena });
        await pending;
    });
    expect(arena.joinMatch).toHaveBeenCalledTimes(1);
    expect(arena.joinMatch).toHaveBeenCalledWith(
        "cyber",
        expect.objectContaining({
            avatar: "prepared-avatar.png",
            label: "gallery",
            token: "token",
            userId: "visitor",
            currentSpace: "exhibit",
            position: player.position,
            lobbyGroupCohort: "trip-123",
        }),
        expect.any(AbortController)
    );
    expect(formatAvatar).not.toHaveBeenCalled();
    expect(hook.active).toBe(true);
});

test("ordinary room callers still resolve their own profile image", async () => {
    services.current.roomService = arena;
    await act(async () => {
        await hook.init(exhibit, player, roomOpts);
    });
    expect(formatAvatar).toHaveBeenCalledTimes(1);
    expect(formatAvatar).toHaveBeenCalledWith(
        profile,
        expect.any(Function),
        exhibit
    );
    expect(arena.joinMatch.mock.calls[0][1].avatar).toBe("resolved-avatar.png");
});

test("cancelling while the warmed module is pending cannot join or enable the room", async () => {
    let resolveModule: (value: any) => void;
    const roomService = new Promise<any>((resolve) => {
        resolveModule = resolve;
    });
    let pending: ReturnType<typeof hook.init>;
    await act(async () => {
        pending = hook.init(
            exhibit,
            player,
            { ...roomOpts, avatar: "prepared-avatar.png" },
            { roomService }
        );
        await hook.dispose();
        resolveModule({ default: arena });
        await pending;
    });
    expect(arena.joinMatch).not.toHaveBeenCalled();
    expect(formatAvatar).not.toHaveBeenCalled();
    expect(hook.active).toBe(false);
});

test("parent cancellation before module resolution cannot publish the service", async () => {
    let finish: (value: any) => void;
    const roomService = new Promise<any>((resolve) => {
        finish = resolve;
    });
    const controller = new AbortController();
    let pending: ReturnType<typeof hook.init>;
    await act(async () => {
        pending = hook.init(
            exhibit,
            player,
            { ...roomOpts, signal: controller.signal },
            { roomService }
        );
        controller.abort();
        finish({ default: arena });
        await pending;
    });
    expect(services.current.roomService).toBeNull();
    expect(arena.joinMatch).not.toHaveBeenCalled();
    expect(hook.failedToJoin).toBe(false);
});

test("a superseded late seat cannot replace a newer session or dispose its room", async () => {
    services.current.roomService = arena;
    let finish: (value: any) => void;
    const late = {
        sessionId: "late",
        leave: jest.fn(async () => {}),
        onStateChange: jest.fn(),
    };
    const newer = {
        sessionId: "new",
        leave: jest.fn(),
        onStateChange: jest.fn(),
    };
    arena.joinMatch
        .mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    finish = resolve;
                })
        )
        .mockImplementationOnce(async () => {
            arena.room = newer;
            return newer;
        });
    let first: ReturnType<typeof hook.init>;
    await act(async () => {
        first = hook.init(exhibit, player, { ...roomOpts, avatar: "ready" });
    });
    await act(async () => {
        await hook.init(exhibit, player, {
            ...roomOpts,
            label: "new",
            avatar: "ready",
        });
    });
    await act(async () => {
        finish(late);
        await first;
    });
    expect(hook.sessionId).toBe("new");
    expect(hook.active).toBe(true);
    expect(hook.label).toBe("new");
    expect(late.leave).toHaveBeenCalledWith(true);
    expect(late.onStateChange).not.toHaveBeenCalled();
    expect(arena.leaveMatch).not.toHaveBeenCalled();
    expect(newer.leave).not.toHaveBeenCalled();
});

test("disposed profile work cannot dispatch account state or join", async () => {
    services.current.roomService = arena;
    let finish: (value: any) => void;
    (formatAvatar as jest.Mock).mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                finish = resolve;
            })
    );
    let pending: ReturnType<typeof hook.init>;
    await act(async () => {
        pending = hook.init(exhibit, player, roomOpts);
    });
    const dispatchAvatar = (formatAvatar as jest.Mock).mock.calls[0][1];
    await act(async () => {
        await hook.dispose();
        dispatchAvatar({ type: "late" });
        finish("late.png");
        await pending;
    });
    expect(context.dispatch).not.toHaveBeenCalled();
    expect(arena.joinMatch).not.toHaveBeenCalled();
    expect(hook.active).toBe(false);
});

// A room whose close handlers can be fired the way colyseus.js fires them.
const closableRoom = (sessionId: string) => {
    const handlers: ((code: number) => void)[] = [];
    return {
        sessionId,
        onStateChange: jest.fn(),
        onLeave: jest.fn((handler) => handlers.push(handler)),
        close: (code: number) => handlers.forEach((handler) => handler(code)),
    };
};

test("a room that closes underneath the visitor is reported as lost until the next join", async () => {
    const joined = closableRoom("session");
    arena.room = joined;
    arena.joinMatch.mockImplementation(async () => joined);
    services.current.roomService = arena;
    await act(async () => {
        await hook.init(exhibit, player, { ...roomOpts, avatar: "ready" });
    });
    expect(joined.onLeave).toHaveBeenCalledTimes(1);
    expect(hook.lost).toBe(false);
    // 1006: the socket dropped. The server closing the room looks the same.
    await act(async () => joined.close(1006));
    expect(hook.lost).toBe(true);
    const next = closableRoom("next");
    arena.room = next;
    arena.joinMatch.mockImplementation(async () => next);
    await act(async () => {
        await hook.init(exhibit, player, { ...roomOpts, avatar: "ready" });
    });
    expect(hook.lost).toBe(false);
    expect(hook.active).toBe(true);
    // The room that was replaced can no longer speak for this visitor.
    await act(async () => joined.close(1006));
    expect(hook.lost).toBe(false);
});

test("leaving on purpose is not a lost connection", async () => {
    const joined = closableRoom("session");
    arena.room = joined;
    arena.joinMatch.mockImplementation(async () => joined);
    services.current.roomService = arena;
    await act(async () => {
        await hook.init(exhibit, player, { ...roomOpts, avatar: "ready" });
    });
    await act(async () => {
        await hook.dispose();
        // 4000 is the close code of a leave the client asked for.
        joined.close(4000);
    });
    expect(arena.leaveMatch).toHaveBeenCalledTimes(1);
    expect(hook.lost).toBe(false);
    expect(hook.active).toBe(false);
});
