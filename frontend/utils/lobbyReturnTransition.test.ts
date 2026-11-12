/** @jest-environment jsdom */
import {
    beginLobbyReturn,
    finishLobbyReturn,
    pendingLobbyReturn,
    revealLobbyReturn,
} from "./lobbyReturnTransition";

const view = {
    cameraOffset: { x: 0, y: 2, z: 4 },
    cameraTargetOffset: { x: 0, y: 1, z: 0 },
    avatarRotation: 0.3,
    avatarLift: 0,
    avatarIdleTime: 1.2,
    fov: 60,
};
afterEach(() => {
    const pending = pendingLobbyReturn();
    if (pending) finishLobbyReturn(pending);
    jest.restoreAllMocks();
});
test("copies the native pose and covers the route until an actual lobby frame", () => {
    const transition = beginLobbyReturn(view);
    expect(pendingLobbyReturn()).toBe(transition);
    expect(transition.returnView).toEqual(view);
    expect(transition.returnView.cameraOffset).not.toBe(view.cameraOffset);
    expect(document.querySelector("[data-lobby-return]")).not.toBeNull();
    expect(beginLobbyReturn()).toBe(transition);
    expect(document.querySelectorAll("[data-lobby-return]")).toHaveLength(1);
    revealLobbyReturn({ ...transition });
    expect(document.querySelector("[data-lobby-return]")).not.toBeNull();
    revealLobbyReturn(transition);
    expect(document.querySelector("[data-lobby-return]")).toBeNull();
    expect(pendingLobbyReturn()).toBe(transition);
    finishLobbyReturn(transition);
    expect(pendingLobbyReturn()).toBeNull();
});
test("invalid camera data is discarded, reduced motion is respected, and stale completion is ignored", () => {
    Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: jest.fn(() => ({ matches: true })),
    });
    const first = beginLobbyReturn({ ...view, fov: NaN });
    expect(first.returnView).toBeUndefined();
    expect(first.reducedMotion).toBe(true);
    finishLobbyReturn(first);
    const next = beginLobbyReturn();
    finishLobbyReturn(first);
    expect(pendingLobbyReturn()).toBe(next);
    expect(document.querySelector("[data-lobby-return]")).not.toBeNull();
});
