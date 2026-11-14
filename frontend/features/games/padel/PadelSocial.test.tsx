/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import PadelSocial from "./PadelSocial";
import useLobbySocial from "@features/lobby/useLobbySocial";
import { setEmoteShortcut } from "@features/lobby/emoteShortcuts";

jest.mock("@components/context/UserContext", () => ({
    UserContext: require("react").createContext({}),
}));
jest.mock("@features/lobby/useLobbySocial", () => ({
    __esModule: true,
    default: jest.fn(),
}));
jest.mock("@features/lobby/LobbyChat", () => ({
    __esModule: true,
    default: ({ inputRef, onOpenChange }) => (
        <div>
            <input aria-label="Gym message" ref={inputRef} />
            <button onClick={() => onOpenChange(false)}>Close chat</button>
        </div>
    ),
}));
jest.mock("@features/lobby/AvatarCarousel", () => ({
    __esModule: true,
    default: ({ onSelect, onClose }) => (
        <div>
            <button onClick={() => onSelect({ url: "/new-avatar.vrm" })}>
                Pick avatar
            </button>
            <button onClick={onClose}>Close avatars</button>
        </div>
    ),
}));
jest.mock("@features/lobby/EmotePanel", () => ({
    __esModule: true,
    default: ({ onSelect, onClose }) => (
        <div>
            <button onClick={() => onSelect(0, "WAVING")}>Wave</button>
            <button onClick={onClose}>Close emotes</button>
        </div>
    ),
}));
let root: ReturnType<typeof createRoot>, container: HTMLDivElement;
let send: jest.Mock,
    focusGame: jest.Mock,
    onIdentityChange: jest.Mock,
    bridge: any,
    social: any;
const identity = {
    name: "Visitor",
    avatarUrl: "/visitor.vrm",
    pfp: "/portrait.png",
};
const click = (label: string) =>
    act(() => {
        const el = Array.from(container.querySelectorAll("button")).find(
            (el) =>
                el.getAttribute("aria-label") === label ||
                el.textContent === label
        );
        if (!el) throw Error(label);
        el.click();
    });
beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    localStorage.clear();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    send = jest.fn();
    focusGame = jest.fn();
    onIdentityChange = jest.fn();
    bridge = { current: null };
    social = {
        status: "connected",
        sessionId: "self",
        players: [],
        messages: [],
        population: 1,
        voiceState: "off",
        voiceError: "",
        sampleParticipants: () => [],
        updatePosition: jest.fn(),
        sendMessage: jest.fn(),
        toggleVoice: jest.fn(),
        retry: jest.fn(),
    };
    (useLobbySocial as jest.Mock).mockReturnValue(social);
    act(() =>
        root.render(
            <PadelSocial
                identity={identity}
                bridge={bridge}
                send={send}
                focusGame={focusGame}
                onIdentityChange={onIdentityChange}
            />
        )
    );
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.useRealTimers();
});
test("uses padel club scope, validates pose data and clears bridge timers on removal", () => {
    expect(useLobbySocial).toHaveBeenCalledWith(
        expect.objectContaining({
            nativeSpace: "padel-club",
            enabled: true,
        })
    );
    act(() =>
        bridge.current.receivePose({
            x: 2,
            y: 0,
            z: 5,
            rotation: 0,
            grounded: true,
            emote: "WAVING",
        })
    );
    expect(social.updatePosition).toHaveBeenCalledWith(
        expect.objectContaining({ x: 2, animation: 0, floor: true })
    );
    bridge.current.receivePose({ x: Infinity, y: 0, z: 0, rotation: 0 });
    expect(social.updatePosition).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({
        type: "padel:social-ready",
        enabled: true,
    });
    act(() => root.render(null));
    expect(bridge.current).toBeNull();
    expect(send).toHaveBeenCalledWith({
        type: "padel:social-ready",
        enabled: false,
    });
    expect(send).toHaveBeenCalledWith({
        type: "padel:peers",
        sessionId: "",
        players: [],
    });
    const count = send.mock.calls.length;
    act(() => jest.advanceTimersByTime(1000));
    expect(send).toHaveBeenCalledTimes(count);
});
test("chat focus and panels lock movement, closing restores it; shared choices send commands", () => {
    act(() => container.querySelector("input").focus());
    expect(send).toHaveBeenLastCalledWith({
        type: "padel:input",
        enabled: false,
    });
    click("Close chat");
    expect(focusGame).toHaveBeenCalled();
    click("Emotes");
    expect(send).toHaveBeenLastCalledWith({
        type: "padel:input",
        enabled: false,
    });
    click("Wave");
    expect(send).toHaveBeenCalledWith({
        type: "padel:emote",
        index: 0,
        name: "WAVING",
    });
    click("Choose avatar");
    click("Pick avatar");
    expect(onIdentityChange).toHaveBeenCalledWith({
        ...identity,
        avatarUrl: "/new-avatar.vrm",
    });
    expect(send).toHaveBeenCalledWith({
        type: "padel:avatar",
        avatarUrl: "/new-avatar.vrm",
        pfp: identity.pfp,
    });
    click("Close avatars");
    expect(send).toHaveBeenLastCalledWith({
        type: "padel:input",
        enabled: true,
    });
    expect(
        container.querySelector('[aria-label="Unmute microphone"]')
    ).toBeNull();
    click("More");
    click("Unmute microphone");
    expect(social.toggleVoice).toHaveBeenCalledTimes(1);
});
test("digit shortcuts use the shared saved mapping without opening a panel or moving focus", () => {
    act(() => setEmoteShortcut(0, "HIPHOP"));
    bridge.current.receiveShortcut(0);
    expect(send).toHaveBeenLastCalledWith({
        type: "padel:emote",
        index: 1,
        name: "HIPHOP",
    });
    const count = send.mock.calls.length;
    bridge.current.receiveShortcut(-1);
    bridge.current.receiveShortcut(10);
    bridge.current.receiveShortcut("0");
    expect(send).toHaveBeenCalledTimes(count);
    expect(focusGame).not.toHaveBeenCalled();
});

test("shared controls open match setup and settings without creating another room", () => {
    click("Play padel ↗");
    expect(send).toHaveBeenCalledWith({ type: "padel:play" });
    click("More");
    expect(send).toHaveBeenLastCalledWith({
        type: "padel:input",
        enabled: false,
    });
    click("Settings");
    expect(send).toHaveBeenCalledWith({ type: "padel:settings" });
    expect(container.querySelector("#padel-more-menu")).toBeNull();
});
test("setup hides controls and blocks movement while keeping peer sampling alive", () => {
    act(() => container.querySelector("input").focus());
    const originalBridge = bridge.current;
    act(() =>
        root.render(
            <PadelSocial
                identity={identity}
                bridge={bridge}
                send={send}
                focusGame={focusGame}
                onIdentityChange={onIdentityChange}
                hidden
            />
        )
    );
    expect(
        container
            .querySelector('[aria-label="Padel club social controls"]')
            .hasAttribute("hidden")
    ).toBe(true);
    expect(bridge.current).toBe(originalBridge);
    expect(send).toHaveBeenLastCalledWith({
        type: "padel:input",
        enabled: false,
    });
    send.mockClear();
    act(() => jest.advanceTimersByTime(100));
    expect(send).toHaveBeenCalledWith(
        expect.objectContaining({ type: "padel:peers" })
    );
    expect(send).not.toHaveBeenCalledWith({
        type: "padel:social-ready",
        enabled: false,
    });
    act(() =>
        root.render(
            <PadelSocial
                identity={identity}
                bridge={bridge}
                send={send}
                focusGame={focusGame}
                onIdentityChange={onIdentityChange}
            />
        )
    );
    expect(send).toHaveBeenLastCalledWith({
        type: "padel:input",
        enabled: true,
    });
});
test("More closes with Escape and returns keyboard focus to its button", () => {
    click("More");
    act(() =>
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
    );
    expect(container.querySelector("#padel-more-menu")).toBeNull();
    expect(document.activeElement).toBe(
        container.querySelector('[aria-label="More"]')
    );
});

test("native place navigation shows live presence and uses the existing return command", () => {
    const place = container.querySelector(".lobby-place");
    expect(place.textContent).toBe("Padel club1 here");
    const back = place.querySelector('button[aria-label="Back to lobby"]');
    expect(back.textContent).toBe("");
    click("Back to lobby");
    expect(send).toHaveBeenCalledWith({ type: "padel:exit" });
    expect(social.toggleVoice).not.toHaveBeenCalled();

    social.status = "offline";
    act(() =>
        root.render(
            <PadelSocial
                identity={identity}
                bridge={bridge}
                send={send}
                focusGame={focusGame}
                onIdentityChange={onIdentityChange}
            />
        )
    );
    expect(place.querySelector(".presence-status").textContent).toBe(
        "You’re offline"
    );
});
