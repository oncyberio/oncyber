/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import PadelSocial from "./PadelSocial";
import useLobbySocial from "@features/lobby/useLobbySocial";

jest.mock("@components/context/UserContext", () => ({
    UserContext: require("react").createContext({}),
}));
jest.mock("@features/lobby/useLobbySocial", () => ({
    __esModule: true,
    default: jest.fn(),
}));
jest.mock("@features/lobby/AvatarCarousel", () => ({
    __esModule: true,
    default: () => null,
}));
jest.mock("@features/lobby/EmotePanel", () => ({
    __esModule: true,
    default: () => null,
}));

let container: HTMLDivElement, root: ReturnType<typeof createRoot>;
let send: jest.Mock, social: any;
const originalMatchMedia = window.matchMedia;
const button = (label: string) =>
    container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
const key = (element: Element, name: string) => {
    const event = new KeyboardEvent("keydown", {
        key: name,
        bubbles: true,
        cancelable: true,
    });
    act(() => element.dispatchEvent(event));
    return event;
};
const finish = () => {
    act(() => jest.advanceTimersByTime(160));
    act(() => jest.advanceTimersByTime(100));
    act(() => jest.advanceTimersByTime(260));
};

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.useFakeTimers();
    Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: jest.fn(() => ({
            matches: false,
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
        })),
    });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    send = jest.fn();
    social = {
        status: "connected",
        sessionId: "self",
        population: 2,
        players: [
            { id: "self", name: "You", isLocal: true },
            { id: "friend", name: "Alex" },
        ],
        messages: [],
        voiceState: "off",
        voiceError: "",
        sampleParticipants: () => [],
        updatePosition: jest.fn(),
        sendMessage: jest.fn(() => true),
        toggleVoice: jest.fn(),
        retry: jest.fn(),
    };
    (useLobbySocial as jest.Mock).mockReturnValue(social);
    act(() =>
        root.render(
            <PadelSocial
                identity={{
                    name: "You",
                    avatarUrl: "/avatar.vrm",
                    pfp: "/portrait.png",
                }}
                bridge={{ current: null }}
                send={send}
                focusGame={jest.fn()}
                onIdentityChange={jest.fn()}
            />
        )
    );
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.clearAllTimers();
    jest.useRealTimers();
    window.matchMedia = originalMatchMedia;
    jest.clearAllMocks();
});

test("the real lobby composer keeps drafts and keyboard conversation selection in the club", () => {
    const input = container.querySelector<HTMLInputElement>(
        'input[aria-label="Message the club"]'
    );
    expect(input).not.toBeNull();
    expect(
        button("Current conversation: Global. Choose conversation")
    ).not.toBeNull();
    act(() => {
        input.focus();
        input.value = "Ready for a game";
        Simulate.change(input);
    });
    expect(send).toHaveBeenLastCalledWith({
        type: "padel:input",
        enabled: false,
    });
    expect(key(input, "Tab").defaultPrevented).toBe(true);
    finish();
    expect(document.activeElement).toBe(button("Global chat"));
    key(document.activeElement, "ArrowRight");
    expect(document.activeElement).toBe(button("Message Alex"));
    // JSDOM does not synthesize the browser’s native Enter click on buttons.
    act(() => (document.activeElement as HTMLButtonElement).click());
    finish();
    expect(
        container.querySelector('input[aria-label="Message Alex"]')
    ).not.toBeNull();
    key(document.activeElement, "Tab");
    finish();
    key(document.activeElement, "ArrowLeft");
    // JSDOM does not synthesize the browser’s native Enter click on buttons.
    act(() => (document.activeElement as HTMLButtonElement).click());
    finish();
    expect(
        container.querySelector<HTMLInputElement>(
            'input[aria-label="Message the club"]'
        ).value
    ).toBe("Ready for a game");
    expect(social.sendMessage).not.toHaveBeenCalled();
    expect(social.toggleVoice).not.toHaveBeenCalled();
});
