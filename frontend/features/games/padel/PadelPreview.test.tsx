/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { resolveLobbyAvatar } from "@features/lobby/avatarSelection";
import { UserContext } from "@components/context/UserContext";
import {
    failLobbyDestination,
    isLobbyDestination,
    lobbyDestinationPrepared,
    registerLobbyDestinationEntry,
    requestLobbyDestinationBack,
    waitForLobbyDestinationEntry,
} from "@utils/lobbyDestinationBridge";
import PadelPreview from "./PadelPreview";
import { createPadelHostEnvelope } from "./padelHostProtocol";
const hostAttempt = "12345678-1234-1234-1234-123456789012";
let parentSend: jest.SpyInstance;
const hostMessage = (
    type: any,
    payload = {},
    source: Window = window,
    origin = window.location.origin
) =>
    message(
        createPadelHostEnvelope(hostAttempt, type, payload),
        source,
        origin
    );
const latestHostState = () =>
    parentSend.mock.calls
        .map(([value]) => value)
        .filter((value) => value.type === "state")
        .at(-1)?.state;

const mockVisitBridge = {
    receivePose: jest.fn(),
    receiveShortcut: jest.fn(),
    focusChat: jest.fn(),
};
let mockSocialProps: any;
jest.mock("./PadelSocial", () => ({
    __esModule: true,
    default: (props) => {
        mockSocialProps = props;
        require("react").useEffect(() => {
            props.bridge.current = mockVisitBridge;
            return () => {
                props.bridge.current = null;
            };
        }, [props.bridge]);
        return <div data-testid="padel-social" hidden={props.hidden} />;
    },
}));
let mockRouter = { push: jest.fn() };
jest.mock("next/router", () => ({ useRouter: () => mockRouter }));
jest.mock("@components/context/UserContext", () => ({
    UserContext: require("react").createContext({}),
}));
jest.mock("@features/lobby/avatarSelection", () => ({
    resolveLobbyAvatar: jest.fn(),
    DEFAULT_LOBBY_AVATAR_URL: "/avatars/default.vrm",
}));
jest.mock("@utils/lobbyDestinationBridge", () => ({
    isLobbyDestination: jest.fn(),
    failLobbyDestination: jest.fn(),
    lobbyDestinationPrepared: jest.fn(),
    registerLobbyDestinationEntry: jest.fn(() => jest.fn()),
    requestLobbyDestinationBack: jest.fn(),
    waitForLobbyDestinationEntry: jest.fn(),
}));
let element: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let child: Window;
let send: jest.SpyInstance;
let reveal: () => void;
let focus: jest.SpyInstance;
const message = (
    data: object,
    source: Window = child,
    origin = window.location.origin
) =>
    act(() =>
        window.dispatchEvent(
            new MessageEvent("message", { data, source, origin })
        )
    );
const mount = async () => {
    act(() =>
        root.render(
            <UserContext.Provider
                value={
                    {
                        userData: {
                            username: "Visitor",
                            avatar: "/portrait.png",
                            privateField: "secret",
                        },
                    } as any
                }
            >
                <PadelPreview />
            </UserContext.Provider>
        )
    );
    child = element.querySelector("iframe").contentWindow;
    send = jest.spyOn(child, "postMessage");
    focus = jest.spyOn(element.querySelector("iframe"), "focus");
};
beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    window.history.replaceState(
        {},
        "",
        `/games/padel?__lobbyAttempt=${hostAttempt}`
    );
    parentSend = jest.spyOn(window, "postMessage");
    mockSocialProps = null;
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    (isLobbyDestination as jest.Mock).mockReturnValue(false);
    (waitForLobbyDestinationEntry as jest.Mock).mockImplementation(
        () =>
            new Promise<void>((resolve) => {
                reveal = resolve;
            })
    );
    (requestLobbyDestinationBack as jest.Mock).mockReturnValue(false);
    (resolveLobbyAvatar as jest.Mock).mockResolvedValue({
        url: "/avatars/selected.vrm",
    });
    element = document.createElement("div");
    document.body.append(element);
    root = createRoot(element);
});
afterEach(() => {
    act(() => root.unmount());
    element.remove();
    jest.restoreAllMocks();
    jest.useRealTimers();
});

test("only the hosted frame at our origin receives public avatar identity and can announce readiness", async () => {
    await mount();
    message({ type: "padel:hello" }, child, "https://untrusted.example");
    message({ type: "padel:hello" }, window);
    message({ type: "padel:ready" });
    await act(async () => {
        jest.advanceTimersByTime(0);
        await Promise.resolve();
    });
    expect(send).not.toHaveBeenCalled();
    expect(lobbyDestinationPrepared).not.toHaveBeenCalled();
    message({ type: "padel:hello" });
    expect(send).toHaveBeenCalledWith(
        {
            type: "padel:identity",
            avatarUrl: "/avatars/selected.vrm",
            name: "Visitor",
            pfp: "/portrait.png",
        },
        window.location.origin
    );
    message({ type: "padel:ready" });
    expect(lobbyDestinationPrepared).toHaveBeenCalledTimes(1);
    act(() => jest.advanceTimersByTime(20));
    expect(send).toHaveBeenCalledWith(
        { type: "padel:entered" },
        window.location.origin
    );
});

test("lobby selection takes priority and admission does not focus until reveal releases input", async () => {
    (isLobbyDestination as jest.Mock).mockReturnValue(true);
    await mount();
    message({ type: "padel:hello" });
    message(
        {
            type: "padel:lobby-identity",
            avatarUrl: "/avatars/carousel.vrm",
            name: "Current guest",
            pfp: "/guest.png",
            token: "not-forwarded",
        },
        window
    );
    expect(send).toHaveBeenCalledWith(
        {
            type: "padel:identity",
            avatarUrl: "/avatars/carousel.vrm",
            name: "Current guest",
            pfp: "/guest.png",
        },
        window.location.origin
    );
    message({ type: "padel:ready" });
    expect(send).not.toHaveBeenCalledWith(
        { type: "padel:entered" },
        window.location.origin
    );
    await completeTravelPhase("enter");
    await completeTravelPhase("stage");
    await completeTravelPhase("reveal");
    expect(send).not.toHaveBeenCalledWith(
        { type: "padel:entered" },
        window.location.origin
    );
    expect(focus).not.toHaveBeenCalled();
    await act(async () => {
        reveal();
        await Promise.resolve();
    });
    act(() => jest.advanceTimersByTime(20));
    expect(focus).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
        { type: "padel:entered" },
        window.location.origin
    );
    expect(resolveLobbyAvatar).not.toHaveBeenCalled();
});

test("exit uses existing lobby return and ignores unrelated windows", async () => {
    await mount();
    message({ type: "padel:hello" });
    message({ type: "padel:exit" }, window);
    expect(requestLobbyDestinationBack).not.toHaveBeenCalled();
    (requestLobbyDestinationBack as jest.Mock).mockReturnValue(true);
    message({ type: "padel:exit" });
    expect(requestLobbyDestinationBack).toHaveBeenCalledTimes(1);
    expect(mockRouter.push).not.toHaveBeenCalled();
    (requestLobbyDestinationBack as jest.Mock).mockReturnValue(false);
    message({ type: "padel:exit" });
    expect(mockRouter.push).toHaveBeenCalledWith("/?lobby=1");
});

test.each(["before reveal", "after reveal"])(
    "disposal %s prevents late game entry or focus",
    async (timing) => {
        (isLobbyDestination as jest.Mock).mockReturnValue(true);
        await mount();
        message({ type: "padel:hello" });
        message(
            {
                type: "padel:lobby-identity",
                avatarUrl: "/avatar.vrm",
                name: "Guest",
                pfp: "/guest.png",
            },
            window
        );
        message({ type: "padel:ready" });
        if (timing === "after reveal")
            await act(async () => {
                reveal();
                await Promise.resolve();
            });
        act(() => {
            (registerLobbyDestinationEntry as jest.Mock).mock.calls[0][1]();
        });
        if (timing === "before reveal")
            await act(async () => {
                reveal();
                await Promise.resolve();
            });
        act(() => jest.advanceTimersByTime(20));
        expect(focus).not.toHaveBeenCalled();
        expect(send).not.toHaveBeenCalledWith(
            { type: "padel:entered" },
            window.location.origin
        );
        expect(send).toHaveBeenCalledWith(
            { type: "padel:dispose" },
            window.location.origin
        );
        expect(
            (waitForLobbyDestinationEntry as jest.Mock).mock.calls[0][0].aborted
        ).toBe(true);
    }
);

async function readyDirectVisit() {
    await mount();
    message({ type: "padel:hello" });
    await act(async () => {
        jest.advanceTimersByTime(0);
        await Promise.resolve();
    });
    message({ type: "padel:ready" });
    act(() => jest.advanceTimersByTime(20));
}

test("mode changes only come from the prepared same-origin game", async () => {
    await readyDirectVisit();
    expect(element.querySelector("main").dataset.revealed).toBe("true");
    message({ type: "padel:mode", mode: "match" }, window);
    message({ type: "padel:mode", mode: "match" }, child, "https://wrong.test");
    message({ type: "padel:mode", mode: "unknown" });
    expect(element.querySelector("main").dataset.mode).toBe("visit");
    message({ type: "padel:mode", mode: "match" });
    expect(element.querySelector("main").dataset.mode).toBe("match");
    message({ type: "padel:mode", mode: "visit" });
    expect(element.querySelector("main").dataset.mode).toBe("visit");
});

test("router context changes retain the running frame", async () => {
    await readyDirectVisit();
    const original = element.querySelector("iframe");
    mockRouter = { push: jest.fn() };
    act(() =>
        root.render(
            <UserContext.Provider
                value={
                    {
                        userData: {
                            username: "Updated",
                            avatar: "/portrait.png",
                        },
                    } as any
                }
            >
                <PadelPreview />
            </UserContext.Provider>
        )
    );
    expect(element.querySelector("iframe")).toBe(original);
    expect(send).not.toHaveBeenCalledWith(
        { type: "padel:dispose" },
        window.location.origin
    );
    expect(registerLobbyDestinationEntry).toHaveBeenCalledTimes(1);
});

test("StrictMode reloads the disposed frame and admits a fresh game", async () => {
    act(() =>
        root.render(
            <React.StrictMode>
                <UserContext.Provider
                    value={
                        {
                            userData: {
                                username: "Visitor",
                                avatar: "/portrait.png",
                            },
                        } as any
                    }
                >
                    <PadelPreview />
                </UserContext.Provider>
            </React.StrictMode>
        )
    );
    child = element.querySelector("iframe").contentWindow;
    send = jest.spyOn(child, "postMessage");
    expect(registerLobbyDestinationEntry).toHaveBeenCalledTimes(2);
    message({ type: "padel:hello" });
    await act(async () => {
        jest.advanceTimersByTime(0);
        await Promise.resolve();
    });
    message({ type: "padel:ready" });
    act(() => jest.advanceTimersByTime(20));
    expect(element.querySelector("main").dataset.revealed).toBe("true");
    expect(send).toHaveBeenCalledWith(
        { type: "padel:entered" },
        window.location.origin
    );
});

test("a game error fails admission and late readiness cannot enter", async () => {
    await mount();
    message({ type: "padel:hello" });
    await act(async () => {
        jest.advanceTimersByTime(0);
        await Promise.resolve();
    });
    message({ type: "padel:error" });
    expect(failLobbyDestination).toHaveBeenCalledWith(
        expect.stringContaining("Padel"),
        "padel-load-failed"
    );
    message({ type: "padel:ready" });
    act(() => jest.advanceTimersByTime(20));
    expect(lobbyDestinationPrepared).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalledWith(
        { type: "padel:entered" },
        window.location.origin
    );
    expect(element.textContent).toContain("Back to lobby");
});

test("journey social is owned by the outer host and publishes the accepted identity after reveal", async () => {
    (isLobbyDestination as jest.Mock).mockReturnValue(true);
    await mount();
    message({ type: "padel:hello" });
    message(
        {
            type: "padel:lobby-identity",
            avatarUrl: "/carousel.vrm",
            name: "Court guest",
            pfp: "/portrait.png",
        },
        window
    );
    message({ type: "padel:ready" });
    message({ type: "padel:pose", pose: { x: 1 } });
    expect(mockVisitBridge.receivePose).not.toHaveBeenCalled();
    expect(element.querySelector('[data-testid="padel-social"]')).toBeNull();
    await completeTravelPhase("enter");
    await completeTravelPhase("stage");
    await completeTravelPhase("reveal");
    await act(async () => {
        reveal();
        await Promise.resolve();
    });
    act(() => jest.advanceTimersByTime(20));
    hostMessage("connect");
    expect(latestHostState()).toEqual({
        identity: {
            avatarUrl: "/carousel.vrm",
            name: "Court guest",
            pfp: "/portrait.png",
        },
        active: true,
        mode: "visit",
        setupOpen: false,
    });
    expect(mockSocialProps).toBeNull();
    expect(element.querySelector('[data-testid="padel-social"]')).toBeNull();
});
test("visit bridge accepts only the revealed game and stops in match or disposed state", async () => {
    await readyDirectVisit();
    message({ type: "padel:pose", pose: { x: 2 } }, window);
    message({ type: "padel:chat" }, child, "https://wrong.test");
    expect(mockVisitBridge.receivePose).not.toHaveBeenCalled();
    expect(mockVisitBridge.focusChat).not.toHaveBeenCalled();
    message({ type: "padel:pose", pose: { x: 2 } });
    message({ type: "padel:shortcut", slot: 0 });
    message({ type: "padel:chat" });
    expect(mockVisitBridge.receivePose).toHaveBeenCalledWith({ x: 2 });
    expect(mockVisitBridge.receiveShortcut).toHaveBeenCalledWith(0);
    expect(mockVisitBridge.focusChat).toHaveBeenCalledTimes(1);
    message({ type: "padel:mode", mode: "match" });
    expect(element.querySelector('[data-testid="padel-social"]')).toBeNull();
    message({ type: "padel:pose", pose: { x: 3 } });
    message({ type: "padel:chat" });
    message({ type: "padel:shortcut", slot: 1 });
    expect(mockVisitBridge.receivePose).toHaveBeenCalledTimes(1);
    expect(mockVisitBridge.focusChat).toHaveBeenCalledTimes(1);
    expect(mockVisitBridge.receiveShortcut).toHaveBeenCalledTimes(1);
    message({ type: "padel:mode", mode: "visit" });
    expect(
        element.querySelector('[data-testid="padel-social"]')
    ).not.toBeNull();
    act(() => (registerLobbyDestinationEntry as jest.Mock).mock.calls[0][1]());
    expect(element.querySelector('[data-testid="padel-social"]')).toBeNull();
    message({ type: "padel:chat" });
    expect(mockVisitBridge.focusChat).toHaveBeenCalledTimes(1);
});
test("setup hides rather than unmounts social and ignores shortcuts until the dialog closes", async () => {
    await readyDirectVisit();
    const original = element.querySelector('[data-testid="padel-social"]');
    message({ type: "padel:setup", open: true }, window);
    expect(original.hasAttribute("hidden")).toBe(false);
    message({ type: "padel:setup", open: true });
    expect(element.querySelector('[data-testid="padel-social"]')).toBe(
        original
    );
    expect(original.hasAttribute("hidden")).toBe(true);
    message({ type: "padel:chat" });
    message({ type: "padel:shortcut", slot: 0 });
    expect(mockVisitBridge.focusChat).not.toHaveBeenCalled();
    expect(mockVisitBridge.receiveShortcut).not.toHaveBeenCalled();
    message({ type: "padel:pose", pose: { x: 2 } });
    expect(mockVisitBridge.receivePose).toHaveBeenCalledTimes(1);
    message({ type: "padel:setup", open: false });
    expect(original.hasAttribute("hidden")).toBe(false);
    message({ type: "padel:chat" });
    expect(mockVisitBridge.focusChat).toHaveBeenCalledTimes(1);
    message({ type: "padel:setup", open: true });
    message({ type: "padel:mode", mode: "match" });
    message({ type: "padel:mode", mode: "visit" });
    expect(
        element
            .querySelector('[data-testid="padel-social"]')
            .hasAttribute("hidden")
    ).toBe(false);
});
test("loaded game errors remove social and reject further bridge traffic", async () => {
    await readyDirectVisit();
    message({ type: "padel:error" });
    expect(element.querySelector('[data-testid="padel-social"]')).toBeNull();
    message({ type: "padel:pose", pose: { x: 3 } });
    message({ type: "padel:chat" });
    expect(mockVisitBridge.receivePose).not.toHaveBeenCalled();
    expect(mockVisitBridge.focusChat).not.toHaveBeenCalled();
});

const travelView = {
    cameraOffset: { x: 1, y: 2, z: 3 },
    cameraTargetOffset: { x: 0, y: 1, z: 0 },
    avatarRotation: 0.5,
    avatarLift: 0.4,
    avatarHeight: 1.78,
    avatarIdleTime: 0.75,
    fov: 65,
    cameraMode: "third-person",
};
function travelHandlers() {
    const registration = (
        registerLobbyDestinationEntry as jest.Mock
    ).mock.calls.at(-1);
    return {
        enter: registration[0],
        dispose: registration[1],
        stage: registration[2].prepareReveal,
        reveal: registration[2].reveal,
        depart: registration[2].depart,
    };
}
function latestTravel() {
    return send.mock.calls
        .filter(([value]) => value.type === "padel:travel")
        .at(-1)?.[0];
}
async function completeTravelPhase(
    phase,
    options = { reducedMotion: false },
    result = {}
) {
    let pending;
    act(() => {
        pending = travelHandlers()[phase](options);
    });
    const request = latestTravel();
    message({
        type: "padel:travel-result",
        requestId: request.requestId,
        phase,
        ok: true,
        ...result,
    });
    await act(async () => {
        await pending;
    });
    return request;
}
async function prepareJourney() {
    (isLobbyDestination as jest.Mock).mockReturnValue(true);
    await mount();
    message({ type: "padel:hello" });
    message(
        {
            type: "padel:lobby-identity",
            avatarUrl: "/avatar.vrm",
            name: "Guest",
            pfp: "/guest.png",
        },
        window
    );
    message({ type: "padel:ready" });
}

test("native travel relays matching camera snapshots and holds interaction until renderer and host reveal finish", async () => {
    await prepareJourney();
    const enter = await completeTravelPhase("enter", {
        reducedMotion: false,
        travelView,
    } as any);
    expect(enter).toEqual({
        type: "padel:travel",
        phase: "enter",
        requestId: expect.any(String),
        options: { reducedMotion: false, travelView },
    });
    const finalView = {
        ...travelView,
        avatarIdleTime: 0.95,
        cameraOffset: { x: 2, y: 3, z: 4 },
    };
    const stage = await completeTravelPhase("stage", {
        reducedMotion: true,
        travelView: finalView,
    } as any);
    expect(stage.options).toEqual({
        reducedMotion: true,
        travelView: finalView,
    });
    let completion;
    act(() => {
        completion = travelHandlers().reveal({
            reducedMotion: true,
            travelView: finalView,
        });
    });
    const request = latestTravel();
    expect(
        new Set([enter.requestId, stage.requestId, request.requestId]).size
    ).toBe(3);
    // Even an unexpectedly early waiter resolution cannot release the player.
    await act(async () => {
        reveal();
        await Promise.resolve();
    });
    act(() => jest.advanceTimersByTime(20));
    expect(focus).not.toHaveBeenCalled();
    expect(element.querySelector('[data-testid="padel-social"]')).toBeNull();
    message({
        type: "padel:travel-result",
        requestId: request.requestId,
        phase: "reveal",
        ok: true,
    });
    await act(async () => {
        await completion;
    });
    act(() => jest.advanceTimersByTime(20));
    expect(focus).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
        { type: "padel:entered" },
        window.location.origin
    );
    hostMessage("connect");
    expect(latestHostState().active).toBe(true);
    expect(element.querySelector('[data-testid="padel-social"]')).toBeNull();
});
test("travel acknowledgements must match the request, phase, current frame and origin", async () => {
    await prepareJourney();
    const resolved = jest.fn();
    let pending;
    act(() => {
        pending = travelHandlers()
            .enter({ reducedMotion: false })
            .then(resolved);
    });
    const request = latestTravel();
    const ack = {
        type: "padel:travel-result",
        phase: "enter",
        requestId: request.requestId,
        ok: true,
    };
    message(ack, window);
    message(ack, child, "https://other.example");
    message({ ...ack, requestId: "stale-request" });
    message({ ...ack, phase: "reveal" });
    message({ ...ack, ok: "yes" });
    await act(async () => {
        await Promise.resolve();
    });
    expect(resolved).not.toHaveBeenCalled();
    message(ack);
    await act(async () => {
        await pending;
    });
    expect(resolved).toHaveBeenCalledTimes(1);
    message(ack);
    expect(resolved).toHaveBeenCalledTimes(1);
});
test("disposing a pending renderer request cancels it and ignores late acknowledgements", async () => {
    await prepareJourney();
    const pending = travelHandlers().enter({ reducedMotion: false });
    const request = latestTravel();
    const rejection = expect(pending).rejects.toHaveProperty(
        "name",
        "AbortError"
    );
    act(() => travelHandlers().dispose());
    await rejection;
    expect(send).toHaveBeenCalledWith(
        { type: "padel:travel-cancel", requestId: request.requestId },
        window.location.origin
    );
    message({
        type: "padel:travel-result",
        requestId: request.requestId,
        phase: "enter",
        ok: true,
    });
    await act(async () => {
        reveal();
        await Promise.resolve();
    });
    act(() => jest.advanceTimersByTime(20001));
    expect(focus).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalledWith(
        { type: "padel:entered" },
        window.location.origin
    );
});
test("stalled renderer requests time out after 20 seconds and remain locked", async () => {
    await prepareJourney();
    const pending = travelHandlers().enter({ reducedMotion: false });
    const request = latestTravel();
    const rejection = expect(pending).rejects.toThrow(
        "couldn’t finish the transition"
    );
    act(() => jest.advanceTimersByTime(20000));
    await rejection;
    expect(send).toHaveBeenCalledWith(
        { type: "padel:travel-cancel", requestId: request.requestId },
        window.location.origin
    );
    expect(element.textContent).toContain("Return to the lobby");
    expect(focus).not.toHaveBeenCalled();
    expect(element.querySelector('[data-testid="padel-social"]')).toBeNull();
});
test("departure suppresses social input, waits for renderer and returns only a validated view", async () => {
    await readyDirectVisit();
    const oldProps = mockSocialProps;
    let pending;
    act(() => {
        pending = travelHandlers().depart({ reducedMotion: false });
    });
    const request = latestTravel();
    expect(request.phase).toBe("depart");
    expect(element.querySelector('[data-testid="padel-social"]')).toBeNull();
    send.mockClear();
    act(() => {
        oldProps.focusGame();
        oldProps.send({ type: "padel:input", enabled: true });
    });
    expect(send).not.toHaveBeenCalled();
    message({
        type: "padel:travel-result",
        requestId: request.requestId,
        phase: "depart",
        ok: true,
        travelView: { ...travelView, privateField: "discard" },
    });
    await expect(pending).resolves.toEqual(travelView);
});
test("invalid camera snapshots and renderer failures cannot acknowledge admission", async () => {
    await prepareJourney();
    await expect(
        travelHandlers().enter({
            reducedMotion: false,
            travelView: { ...travelView, fov: Infinity },
        })
    ).rejects.toThrow("invalid");
    expect(latestTravel()).toBeUndefined();
    const pending = travelHandlers().enter({ reducedMotion: false });
    const request = latestTravel();
    const rejection = expect(pending).rejects.toThrow("could not finish");
    message({
        type: "padel:travel-result",
        requestId: request.requestId,
        phase: "enter",
        ok: false,
    });
    await rejection;
    expect(send).toHaveBeenCalledWith(
        { type: "padel:travel-cancel", requestId: request.requestId },
        window.location.origin
    );
    expect(focus).not.toHaveBeenCalled();
});
test("invalid departure view is rejected rather than forwarding unbounded renderer data", async () => {
    await readyDirectVisit();
    let pending;
    act(() => {
        pending = travelHandlers().depart({ reducedMotion: false });
    });
    const request = latestTravel();
    const rejection = expect(pending).rejects.toThrow("invalid travel view");
    message({
        type: "padel:travel-result",
        requestId: request.requestId,
        phase: "depart",
        ok: true,
        travelView: { ...travelView, cameraOffset: { x: 9000, y: 0, z: 0 } },
    });
    await rejection;
});

test("a disappearing renderer rejects travel without leaving a timeout behind", async () => {
    await prepareJourney();
    send.mockImplementationOnce(() => {
        throw new Error("Renderer window unavailable");
    });
    await expect(
        travelHandlers().enter({ reducedMotion: false })
    ).rejects.toThrow("could not start its transition");
    act(() => jest.advanceTimersByTime(20000));
    expect(element.textContent).not.toContain("couldn’t finish the transition");
    expect(focus).not.toHaveBeenCalled();
});

test("failed cancellation delivery still settles pending native travel", async () => {
    await prepareJourney();
    const pending = travelHandlers().enter({ reducedMotion: false });
    const rejection = expect(pending).rejects.toMatchObject({
        name: "AbortError",
    });
    send.mockImplementationOnce(() => {
        throw new Error("Renderer window unavailable");
    });
    act(() => travelHandlers().dispose());
    await rejection;
    act(() => jest.advanceTimersByTime(20000));
    expect(element.textContent).not.toContain("couldn’t finish the transition");
    expect(focus).not.toHaveBeenCalled();
});

async function readyHostedVisit() {
    await prepareJourney();
    hostMessage("connect");
    await completeTravelPhase("enter");
    await completeTravelPhase("stage");
    await completeTravelPhase("reveal");
    await act(async () => {
        reveal();
        await Promise.resolve();
    });
    act(() => jest.advanceTimersByTime(20));
}
test("outer host handshake requires the active attempt, origin, and parent window", async () => {
    await prepareJourney();
    expect(parentSend).toHaveBeenCalledWith(
        createPadelHostEnvelope(hostAttempt, "hello"),
        window.location.origin
    );
    parentSend.mockClear();
    hostMessage("connect", {}, child);
    hostMessage("connect", {}, window, "https://other.test");
    message(
        createPadelHostEnvelope(
            "87654321-1234-1234-1234-123456789012",
            "connect"
        ),
        window
    );
    expect(latestHostState()).toBeUndefined();
    hostMessage("connect");
    expect(latestHostState()).toMatchObject({ active: false, mode: "visit" });
    send.mockClear();
    hostMessage("command", {
        message: { type: "padel:input", enabled: true },
    });
    expect(send).not.toHaveBeenCalled();
});
test("host relay preserves controls, suppresses them for setup and match, and independently handles Back", async () => {
    await readyHostedVisit();
    send.mockClear();
    hostMessage("command", {
        message: { type: "padel:play", privateToken: "discard" },
    });
    expect(send).toHaveBeenCalledWith(
        { type: "padel:play" },
        window.location.origin
    );
    hostMessage("command", { message: { type: "padel:dispose" } });
    expect(send).not.toHaveBeenCalledWith(
        { type: "padel:dispose" },
        window.location.origin
    );
    message({ type: "padel:pose", pose: { x: 2 } });
    message({ type: "padel:chat" });
    message({ type: "padel:shortcut", slot: 1 });
    expect(parentSend).toHaveBeenCalledWith(
        createPadelHostEnvelope(hostAttempt, "chat"),
        window.location.origin
    );
    expect(parentSend).toHaveBeenCalledWith(
        createPadelHostEnvelope(hostAttempt, "shortcut", { slot: 1 }),
        window.location.origin
    );
    message({ type: "padel:setup", open: true });
    expect(latestHostState().setupOpen).toBe(true);
    send.mockClear();
    parentSend.mockClear();
    focus.mockClear();
    hostMessage("command", {
        message: { type: "padel:emote", index: 1, name: "Dance" },
    });
    hostMessage("focus");
    message({ type: "padel:chat" });
    expect(send).not.toHaveBeenCalled();
    expect(focus).not.toHaveBeenCalled();
    expect(parentSend).not.toHaveBeenCalled();
    hostMessage("command", {
        message: { type: "padel:input", enabled: false },
    });
    expect(send).toHaveBeenCalledWith(
        { type: "padel:input", enabled: false },
        window.location.origin
    );
    message({ type: "padel:mode", mode: "match" });
    expect(latestHostState()).toMatchObject({
        mode: "match",
        setupOpen: false,
    });
    send.mockClear();
    hostMessage("command", { message: { type: "padel:play" } });
    expect(send).not.toHaveBeenCalled();
    hostMessage("back");
    expect(requestLobbyDestinationBack).toHaveBeenCalled();
});
test("host identity changes are sanitized and disposal publishes inactive state before rejecting stale controls", async () => {
    await readyHostedVisit();
    const next = {
        avatarUrl: "/new.vrm",
        pfp: "/new.png",
        name: "Guest",
        token: "discard",
    };
    hostMessage("identity", { identity: next });
    expect(latestHostState().identity).toEqual({
        avatarUrl: "/new.vrm",
        pfp: "/new.png",
        name: "Guest",
    });
    hostMessage("identity", {
        identity: { ...next, avatarUrl: "javascript:bad" },
    });
    expect(latestHostState().identity.avatarUrl).toBe("/new.vrm");
    act(() => (registerLobbyDestinationEntry as jest.Mock).mock.calls[0][1]());
    expect(latestHostState().active).toBe(false);
    send.mockClear();
    hostMessage("command", {
        message: { type: "padel:input", enabled: true },
    });
    hostMessage("focus");
    expect(send).not.toHaveBeenCalled();
});
