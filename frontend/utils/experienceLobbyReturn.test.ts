/** @jest-environment jsdom */
jest.mock("./lobbyDestinationBridge", () => ({
    requestLobbyDestinationBack: jest.fn(() => false),
}));

let navigation: typeof import("./experienceNavigation");
let transitions: typeof import("./lobbyReturnTransition");
let bridge: typeof import("./lobbyDestinationBridge");
let cleanup: Array<() => void>;
const view = {
    cameraOffset: { x: 0, y: 2, z: 4 },
    cameraTargetOffset: { x: 0, y: 1, z: 0 },
    avatarRotation: 0,
    avatarLift: 0,
    fov: 60,
};
const flush = async () => {
    for (let index = 0; index < 8; index++) await Promise.resolve();
};
beforeEach(() => {
    jest.resetModules();
    navigation = require("./experienceNavigation");
    transitions = require("./lobbyReturnTransition");
    bridge = require("./lobbyDestinationBridge");
    cleanup = [];
    Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: jest.fn(() => ({ matches: false })),
    });
});
afterEach(() => {
    cleanup.reverse().forEach((release) => release());
    const pending = transitions.pendingLobbyReturn();
    if (pending) transitions.finishLobbyReturn(pending);
    jest.restoreAllMocks();
});
function routes(from = "/", push = jest.fn().mockResolvedValue(true)) {
    const on = jest.fn();
    window.history.replaceState({ key: "landing" }, "", from);
    cleanup.push(
        navigation.trackExperienceNavigation({
            push,
            replace: jest.fn(),
            events: { on, off: jest.fn() },
        })
    );
    window.history.replaceState({ key: "world" }, "", "/world");
    const record = on.mock.calls[0][1];
    record();
    return { push, record };
}
test("a 2D gallery entry departs once, preserves its framing, and opens the 3D lobby", async () => {
    const { push, record } = routes();
    let complete: (value: typeof view) => void;
    const depart = jest.fn(
        () =>
            new Promise<typeof view>((resolve) => {
                complete = resolve;
            })
    );
    cleanup.push(navigation.registerExperienceDeparture(depart as any));
    const fallback = jest.fn();
    const back = jest
        .spyOn(window.history, "back")
        .mockImplementation(() => {});
    navigation.goToPreviousExperience(() => navigation.goToLobby(fallback));
    navigation.goToLobby(fallback);
    expect(depart).toHaveBeenCalledTimes(1);
    expect(depart).toHaveBeenCalledWith({ reducedMotion: false });
    expect(push).not.toHaveBeenCalled();
    complete(view);
    await flush();
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/?lobby=1");
    expect(back).not.toHaveBeenCalled();
    expect(fallback).not.toHaveBeenCalled();
    expect(transitions.pendingLobbyReturn()?.returnView).toEqual(view);
    window.history.replaceState({ key: "lobby" }, "", "/?lobby=1");
    record();
    expect(document.querySelector("[data-lobby-return]")).not.toBeNull();
    navigation.goToLobby(fallback);
    expect(push).toHaveBeenCalledTimes(1);
});
test("an entered lobby-owned frame delegates to its parent without a new route", async () => {
    const { push } = routes();
    const depart = jest.fn().mockResolvedValue(view);
    cleanup.push(navigation.registerExperienceDeparture(depart as any));
    (bridge.requestLobbyDestinationBack as jest.Mock).mockReturnValue(true);
    navigation.goToLobby(jest.fn());
    await flush();
    expect(depart).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(transitions.pendingLobbyReturn()).toBeNull();
});
test.each([false, new Error("canceled")])(
    "failed routing clears the cover and restores the source (%s)",
    async (result) => {
        const push =
            result === false
                ? jest.fn().mockResolvedValue(false)
                : jest.fn().mockRejectedValue(result);
        routes("/", push);
        const restore = jest.fn();
        cleanup.push(
            navigation.registerExperienceDeparture(
                jest.fn().mockResolvedValue(view),
                restore
            )
        );
        navigation.goToLobby(jest.fn());
        await flush();
        expect(transitions.pendingLobbyReturn()).toBeNull();
        expect(document.querySelector("[data-lobby-return]")).toBeNull();
        expect(restore).toHaveBeenCalledTimes(1);
        navigation.goToLobby(jest.fn());
        await flush();
        expect(push).toHaveBeenCalledTimes(2);
    }
);
test("leaving a pending lobby return clears its cover and camera data", async () => {
    const { record } = routes();
    navigation.goToLobby(jest.fn());
    await flush();
    expect(transitions.pendingLobbyReturn()).not.toBeNull();
    window.history.replaceState({ key: "other" }, "", "/another-world");
    record();
    expect(transitions.pendingLobbyReturn()).toBeNull();
    expect(document.querySelector("[data-lobby-return]")).toBeNull();
});
test("an unmounted source cannot navigate after a late departure resolves", async () => {
    const { push } = routes();
    let complete: () => void;
    const unregister = navigation.registerExperienceDeparture(
        () =>
            new Promise<void>((resolve) => {
                complete = resolve;
            })
    );
    navigation.goToLobby(jest.fn());
    unregister();
    complete();
    await flush();
    expect(push).not.toHaveBeenCalled();
    expect(transitions.pendingLobbyReturn()).toBeNull();
});
test("a directly opened world without a native departure still assembles into the lobby", async () => {
    const { push } = routes("/world");
    navigation.goToLobby(jest.fn());
    await flush();
    expect(push).toHaveBeenCalledWith("/?lobby=1");
    expect(transitions.pendingLobbyReturn()?.returnView).toBeUndefined();
});

// A module, so its top-level names stay out of the other test scripts.
export {};
