/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import Lobby from "./Lobby";
import LobbyRenderer from "./LobbyRenderer";
import FlashPicker from "./FlashPicker";
import useLobbySocial from "./useLobbySocial";
import useLobbyJourney from "./useLobbyJourney";
import useLobbyTravelParty from "./useLobbyTravelParty";
import { UserContext } from "@components/context/UserContext";
import { Simulate } from "react-dom/test-utils";
import { useMediaQuery } from "@components/hooks/useMediaQuery";
import { resolveLobbyAvatar } from "./avatarSelection";
import VRMS from "@components/_3DExhibit-v2/three/factory/player/vrms.json";

jest.mock("@components/hooks/useMediaQuery", () => ({
    useMediaQuery: jest.fn(),
}));
jest.mock("@components/context/UserContext", () => ({
    UserContext: require("react").createContext({
        user: {},
        authenticated: false,
    }),
}));
jest.mock("@components/InAppLink", () => ({
    __esModule: true,
    default: ({ href, children }) => <a href={href}>{children}</a>,
}));
jest.mock("./LobbyExplorePanel", () => ({
    __esModule: true,
    default: ({ cards, onSelect, onClose, active = true }) => (
        <section id="lobby-explore" data-active={String(active)}>
            <button aria-label="Close search" onClick={onClose}>
                Close
            </button>
            {cards.map((card) => (
                <button
                    key={card.id}
                    className="destination"
                    onClick={() =>
                        onSelect({
                            id: card.id,
                            title: card.title,
                            href: card.href,
                            imageUrl: card.imageUrls?.[0],
                        })
                    }
                >
                    {card.title}
                </button>
            ))}
        </section>
    ),
}));
jest.mock("./FlashPicker", () => ({
    __esModule: true,
    default: jest.fn(({ onSelect, onClose }) => (
        <section
            id="lobby-flash-picker"
            role="dialog"
            aria-label="Flash picker"
        >
            <button aria-label="Close Flash" onClick={onClose}>
                Close
            </button>
            <button
                aria-label="Choose test NFT"
                onClick={() =>
                    onSelect({
                        id: "ethereum:art:1",
                        title: "Blue sky",
                        imageUrl: "https://images.example/blue.png",
                        aspect: 1.5,
                    })
                }
            >
                Blue sky
            </button>
        </section>
    )),
}));
jest.mock("./LobbyRenderer", () => ({
    __esModule: true,
    default: jest.fn(() => <div data-testid="scene" />),
}));
jest.mock("./avatarSelection", () => ({
    resolveLobbyAvatar: jest.fn(() => new Promise(() => {})),
}));
const mockToast = jest.fn();
jest.mock("./useLobbyToast", () => ({
    __esModule: true,
    default: () => mockToast,
    LOBBY_TOAST_MS: 5000,
}));
jest.mock("@features/social/PartyPanel", () => ({
    __esModule: true,
    default: () => null,
}));
jest.mock("./useLobbyTravelParty", () => ({
    __esModule: true,
    default: jest.fn(() => ({
        partyIds: [],
        refresh: async () => ({}),
        prepareTravel: async (destination) => destination,
    })),
}));
jest.mock("./useLobbySocial", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("./useLobbyJourney", () => ({
    __esModule: true,
    default: jest.fn(),
}));

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let journey: any;
let social: any;
const cards: any[] = [
    { id: "one", title: "First space", href: "/first", imageUrls: [] },
];
const originalCrypto = Object.getOwnPropertyDescriptor(window, "crypto");
const render = (authenticated = false, accountId = "account") =>
    act(() =>
        root.render(
            <UserContext.Provider
                value={{ user: { id: accountId }, authenticated } as any}
            >
                <Lobby cards={cards} onExit={jest.fn()} onReady={jest.fn()} />
            </UserContext.Provider>
        )
    );
const button = (label: string) =>
    container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
const click = (target: Element) =>
    act(() => {
        target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    (useMediaQuery as jest.Mock).mockReturnValue(false);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    journey = {
        phase: "idle",
        selected: null,
        attempt: null,
        frameUrl: null,
        frameRef: React.createRef(),
        select: jest.fn(),
        go: jest.fn(),
        enter: jest.fn(),
        crossPortal: jest.fn(),
        cancel: jest.fn(),
        finishReturn: jest.fn(),
        markReturnReady: jest.fn(),
        returnReady: false,
    };
    social = {
        groups: [],
        invitations: [],
        groupMessages: [],
        groupsSupported: false,
        groupClock: null,
        groupAction: jest.fn(),
        status: "connected",
        sessionId: "self",
        messages: [],
        players: [{ id: "self", name: "Guest", isLocal: true }],
        voiceState: "off",
        voiceError: "",
        error: "",
        initializePose: jest.fn(() => ({ x: 2, y: 0, z: 4, rotation: 0 })),
        advanceMovement: jest.fn(),
        sampleParticipants: jest.fn(() => []),
        consumeCorrection: jest.fn(),
        updatePosition: jest.fn(),
        setFlash: jest.fn(),
        sendMessage: jest.fn(() => true),
        toggleVoice: jest.fn(),
        retry: jest.fn(),
    };
    (useLobbySocial as jest.Mock).mockReturnValue(social);
    (useLobbyJourney as jest.Mock).mockImplementation(() => journey);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    window.history.replaceState(null, "", "/");
    window.sessionStorage.clear();
    jest.clearAllMocks();
    jest.useRealTimers();
    if (originalCrypto) Object.defineProperty(window, "crypto", originalCrypto);
    else Reflect.deleteProperty(window, "crypto");
});

test("the message composer is available on arrival without stealing keyboard focus", () => {
    render();
    const input = container.querySelector("input");
    expect(input).not.toBeNull();
    expect(input.getAttribute("aria-label")).toBe("Message the lobby");
    expect(button("Global chat")).toBeNull();
    const selector = button("Current conversation: Global");
    expect(selector).not.toBeNull();
    expect(selector.disabled).toBe(true);
    expect(document.activeElement).not.toBe(input);
    expect(container.querySelector('[role="log"]')).toBeNull();
    expect(social.toggleVoice).not.toHaveBeenCalled();
});

test("search and chat Enter never enter the prepared destination", () => {
    journey = { ...journey, phase: "ready", selected: cards[0] };
    social.players.push({
        id: "visitor",
        name: "Visitor",
        isLocal: false,
        x: 1,
        y: 0,
        z: 2,
        rotation: 0,
    });
    render();
    click(button("Current conversation: Global. Choose conversation"));
    const input = container.querySelector("input");
    expect(input.getAttribute("aria-label")).toBe(
        "Search people in this lobby"
    );
    act(() => input.focus());
    const enter = new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
    });
    act(() => {
        input.dispatchEvent(enter);
    });
    expect(journey.enter).not.toHaveBeenCalled();
    const composer = container.querySelector<HTMLInputElement>(
        'input[aria-label="Message the lobby"]'
    );
    act(() => composer.focus());
    const composing = new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
        isComposing: true,
    });
    act(() => {
        composer.dispatchEvent(composing);
    });
    expect(composing.defaultPrevented).toBe(true);
    const repeated = new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
        repeat: true,
    });
    act(() => {
        composer.dispatchEvent(repeated);
    });
    expect(repeated.defaultPrevented).toBe(true);
    expect(journey.enter).not.toHaveBeenCalled();
});

test("the main search control replaces the dock and restores focus after close", () => {
    jest.useFakeTimers();
    render();
    const trigger = button("Search worlds");
    const dock = container.querySelector(".lobby-dock");
    const controls = dock.querySelector(".dock-bar");
    expect(container.querySelector("#lobby-explore")).toBeNull();
    click(trigger);
    const panel = container.querySelector("#lobby-explore");
    expect(panel.parentElement).toBe(dock);
    expect(panel.getAttribute("data-active")).toBe("true");
    expect(dock.hasAttribute("data-explore")).toBe(true);
    expect(controls.hasAttribute("inert")).toBe(true);
    expect(controls.getAttribute("aria-hidden")).toBe("true");
    click(button("Close search"));
    expect(panel.getAttribute("data-active")).toBe("false");
    expect(dock.hasAttribute("data-explore")).toBe(false);
    expect(controls.hasAttribute("inert")).toBe(false);
    expect(controls.getAttribute("aria-hidden")).not.toBe("true");
    expect(document.activeElement).toBe(trigger);
    act(() => jest.advanceTimersByTime(239));
    expect(container.querySelector("#lobby-explore")).toBe(panel);
    act(() => jest.advanceTimersByTime(1));
    expect(container.querySelector("#lobby-explore")).toBeNull();
});

test.each([false, true])(
    "search hides chat and immediately restores its draft and history on close (compact: %s)",
    (compact) => {
        jest.useFakeTimers();
        (useMediaQuery as jest.Mock).mockReturnValue(compact);
        render();
        const input = container.querySelector<HTMLInputElement>(
            'input[aria-label="Message the lobby"]'
        );
        act(() => {
            input.focus();
            input.value = "See you at the gallery";
            Simulate.change(input);
        });
        const surface = input.closest(".lobby-chat").parentElement;
        const history = container.querySelector("#lobby-chat-log");
        const expectChatPreserved = (hidden: boolean) => {
            expect(
                container.querySelector('input[aria-label="Message the lobby"]')
            ).toBe(input);
            expect(input.value).toBe("See you at the gallery");
            expect(container.querySelector("#lobby-chat-log")).toBe(history);
            expect(surface.hasAttribute("data-hidden")).toBe(hidden);
            expect(surface.getAttribute("aria-hidden") === "true").toBe(hidden);
        };
        expect(history).not.toBeNull();
        expectChatPreserved(false);
        click(button("Search worlds"));
        expectChatPreserved(true);
        click(button("Close search"));
        // Controls return immediately, even while the search rail fades away.
        expect(container.querySelector("#lobby-explore")).not.toBeNull();
        expectChatPreserved(false);
        act(() => jest.advanceTimersByTime(240));
        expect(container.querySelector("#lobby-explore")).toBeNull();
        expectChatPreserved(false);
    }
);

test("search keeps connection notices clear through closing and retains voice errors", () => {
    jest.useFakeTimers();
    social.status = "offline";
    social.voiceError = "Microphone access is unavailable";
    render();
    expect(container.querySelector(".connection-notice")).not.toBeNull();
    const voiceNotice = container.querySelector(".voice-notice");
    expect(voiceNotice.textContent).toContain(social.voiceError);
    expect(voiceNotice.hasAttribute("data-search")).toBe(false);

    click(button("Search worlds"));
    expect(container.querySelector(".connection-notice")).toBeNull();
    expect(container.querySelector(".voice-notice")).toBe(voiceNotice);
    expect(voiceNotice.hasAttribute("data-search")).toBe(true);
    expect(
        container.querySelector(".lobby-controls[data-search]")
    ).not.toBeNull();

    click(button("Close search"));
    expect(container.querySelector(".connection-notice")).toBeNull();
    expect(voiceNotice.hasAttribute("data-search")).toBe(true);
    act(() => jest.advanceTimersByTime(240));
    expect(container.querySelector(".connection-notice")).not.toBeNull();
    expect(voiceNotice.hasAttribute("data-search")).toBe(false);
    expect(container.querySelector(".lobby-controls[data-search]")).toBeNull();
});

test("reopening search during its close animation cancels the pending unmount", () => {
    jest.useFakeTimers();
    render();
    click(button("Search worlds"));
    const panel = container.querySelector("#lobby-explore");
    click(button("Close search"));
    act(() => jest.advanceTimersByTime(120));
    click(button("Search worlds"));
    expect(container.querySelector("#lobby-explore")).toBe(panel);
    expect(panel.getAttribute("data-active")).toBe("true");
    act(() => jest.advanceTimersByTime(240));
    expect(container.querySelector("#lobby-explore")).toBe(panel);
    expect(container.querySelector(".dock-bar").hasAttribute("inert")).toBe(
        true
    );
});

test("portal transport waits for Enter before loading and walking in cuts into the prepared room", () => {
    window.history.replaceState(null, "", "/?lobby=1&travel=portal");
    render();
    click(button("Search worlds"));
    click(container.querySelector(".destination"));
    const scene = () => (LobbyRenderer as jest.Mock).mock.calls.at(-1)[0];
    expect(journey.select).not.toHaveBeenCalled();
    expect(scene().portalActivated).toBe(false);
    act(() =>
        document.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
        )
    );
    expect(scene().portalActivated).toBe(true);
    expect(journey.select).toHaveBeenCalledWith(
        expect.objectContaining({ id: "one", href: "/first" })
    );
    expect(journey.go).not.toHaveBeenCalled();
    expect(scene().portal).toEqual(
        expect.objectContaining({ id: "one", href: "/first" })
    );
    expect(container.textContent).toContain("Opening the portal");
    journey = { ...journey, phase: "loading", selected: cards[0] };
    render();
    // The usual "selected destination" panel stays out of the way.
    expect(container.querySelector(".journey-panel")).toBeNull();
    // Walking in before it's ready waits; once ready it enters with no animation.
    act(() => scene().onEnterPortal());
    expect(journey.enter).not.toHaveBeenCalled();
    journey = { ...journey, phase: "ready", selected: cards[0] };
    render();
    expect(journey.enter).not.toHaveBeenCalled();
    journey = { ...journey, admitted: true };
    render();
    expect(journey.enter).not.toHaveBeenCalled();
    expect(journey.crossPortal).toHaveBeenCalledTimes(1);
    expect(scene().portal).not.toBeNull();
    journey = { ...journey, phase: "revealing", portalCrossing: true };
    render();
    expect(scene().active).toBe(true);
    expect(scene().travel).toBeFalsy();
    expect(
        container
            .querySelector("[data-lobby-surface]")
            .hasAttribute("data-revealing")
    ).toBe(false);
    expect(journey.go).not.toHaveBeenCalled();
});

test("without a portal option, choosing a solo space travels straight away", () => {
    render();
    click(button("Search worlds"));
    click(container.querySelector(".destination"));
    expect(journey.go).toHaveBeenCalledTimes(1);
    const scene = (LobbyRenderer as jest.Mock).mock.calls.at(-1)[0];
    expect(scene.portal).toBeNull();
});

test("Escape or Close dismisses the portal without travelling", () => {
    window.history.replaceState(null, "", "/?lobby=1&travel=portal");
    render();
    click(button("Search worlds"));
    click(container.querySelector(".destination"));
    const scene = () => (LobbyRenderer as jest.Mock).mock.calls.at(-1)[0];
    expect(scene().portal).toBeTruthy();
    act(() =>
        document.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
        )
    );
    expect(scene().portal).toBeNull();
    expect(journey.go).not.toHaveBeenCalled();
    expect(journey.cancel).toHaveBeenCalled();
});

test("the explicit ready/Enter control remains available to the prepared flow", () => {
    journey = { ...journey, phase: "ready", selected: cards[0] };
    render();
    click(container.querySelector("button.enter"));
    expect(journey.enter).toHaveBeenCalledTimes(1);
    expect(journey.go).not.toHaveBeenCalled();
});

test("closing the people list returns focus to its trigger", () => {
    render();
    click(button("People in this lobby"));
    expect(container.querySelector("#lobby-people")).not.toBeNull();
    click(button("Close people"));
    expect(document.activeElement).toBe(button("People in this lobby"));
});

test("Escape closes People when its native control holds focus", () => {
    render();
    const trigger = button("People in this lobby");
    act(() => trigger.focus());
    click(trigger);
    act(() => {
        trigger.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
        );
    });
    expect(container.querySelector("#lobby-people")).toBeNull();
    expect(document.activeElement).toBe(trigger);
});

test("preparation blocks iframe autoplay until destination admission succeeds", () => {
    journey = {
        ...journey,
        phase: "loading",
        selected: cards[0],
        frameUrl: "/first?__lobbyAttempt=test",
        attempt: "test",
    };
    render();
    const frame = container.querySelector("iframe");
    expect(frame.getAttribute("allow")).toContain("autoplay 'none'");
    expect(frame.hasAttribute("inert")).toBe(true);
    journey = { ...journey, phase: "entered" };
    render();
    expect(frame.getAttribute("allow")).not.toContain("autoplay 'none'");
    expect(frame.hasAttribute("inert")).toBe(false);
    expect(useLobbySocial).toHaveBeenLastCalledWith(
        expect.objectContaining({ enabled: true, present: false })
    );
});

test("landing lobby uses the shared predicted movement and smoothed crowd with authored animation", () => {
    const remote = {
        id: "52",
        x: 1,
        y: 0,
        z: 2,
        rotation: 0,
        speed: 0,
        restConfirmed: true,
    };
    social.players.push({ ...remote, name: "Visitor", isLocal: false });
    social.sampleParticipants.mockReturnValue([remote]);
    render();
    const scene = (LobbyRenderer as jest.Mock).mock.calls.at(-1)[0];
    expect(scene).toMatchObject({
        active: true,
        renderer: "auto",
        crowdEnabled: true,
        proceduralMotion: true,
        initializePose: social.initializePose,
        advanceMovement: social.advanceMovement,
        sampleParticipants: social.sampleParticipants,
        consumeCorrection: social.consumeCorrection,
        onMove: social.updatePosition,
        destinations: [],
    });
    expect(scene.participants.map((p) => p.id)).toEqual(["52"]);
    expect(scene.sampleParticipants(1234)).toEqual([remote]);
    expect(social.sampleParticipants).toHaveBeenCalledWith(1234);
    expect(scene.onStats).toBeUndefined();
    expect(scene.onMotionFrame).toBeUndefined();
    expect(scene.onSelectAvatar).toBeUndefined();
});

test("a visitor removed from the lobby is told so without a way back in", () => {
    social.status = "offline";
    social.error = "Connection lost. Reconnecting to everyone…";
    render();
    const notice = () => container.querySelector(".connection-notice");
    // Any other lost connection still offers the button.
    expect(notice().querySelector("button").textContent).toBe("Reconnect");

    social = {
        ...social,
        stopped: "removed",
        error: "You’re exploring solo.",
    };
    (useLobbySocial as jest.Mock).mockReturnValue(social);
    render();
    expect(notice().textContent).toBe("You’re exploring solo.");
    expect(notice().querySelector("button")).toBeNull();

    // A seat taken from another tab can still be taken back.
    social = { ...social, stopped: "replaced" };
    (useLobbySocial as jest.Mock).mockReturnValue(social);
    render();
    click(notice().querySelector("button"));
    expect(social.retry).toHaveBeenCalledTimes(1);
});

test("the avatar picker covers an open chat and hands it back as it was", () => {
    render();
    const input = container.querySelector<HTMLInputElement>(
        'input[aria-label="Message the lobby"]'
    );
    act(() => {
        input.focus();
        input.value = "Back in a second";
        Simulate.change(input);
    });
    const surface = input.closest(".lobby-chat").parentElement;
    expect(container.querySelector("#lobby-chat-log")).not.toBeNull();

    click(button("Choose avatar"));
    expect(surface.hasAttribute("data-hidden")).toBe(true);

    // Like every other dock panel, closing it leaves chat where it was.
    click(button("Choose avatar"));
    expect(surface.hasAttribute("data-hidden")).toBe(false);
    expect(container.querySelector("#lobby-chat-log")).not.toBeNull();
    expect(
        container.querySelector<HTMLInputElement>(
            'input[aria-label="Message the lobby"]'
        ).value
    ).toBe("Back in a second");
});

test("avatar picker and destination entry preserve the movement connection lifecycle", () => {
    render();
    click(button("Choose avatar"));
    let scene = (LobbyRenderer as jest.Mock).mock.calls.at(-1)[0];
    expect(scene.avatarPreview).toBe(true);
    expect(scene.advanceMovement).toBe(social.advanceMovement);
    expect(scene.sampleParticipants).toBe(social.sampleParticipants);
    expect(useLobbySocial).toHaveBeenLastCalledWith(
        expect.objectContaining({ enabled: true })
    );
    journey = { ...journey, phase: "entered" };
    render();
    scene = (LobbyRenderer as jest.Mock).mock.calls.at(-1)[0];
    expect(scene.active).toBe(false);
    expect(useLobbySocial).toHaveBeenLastCalledWith(
        expect.objectContaining({ enabled: true, present: false })
    );
});

test("the cinematic retains the lobby connection and locks both surfaces until reveal completion", () => {
    journey = {
        ...journey,
        phase: "entering",
        selected: cards[0],
        frameUrl: "/first?__lobbyAttempt=test",
        attempt: "test",
        travel: { phase: "charge", startedAt: 10, reducedMotion: false },
    };
    render();
    expect((LobbyRenderer as jest.Mock).mock.calls.at(-1)[0]).toMatchObject({
        active: true,
        travel: { phase: "charge", partyIds: [] },
    });
    expect(
        container.querySelector("[data-lobby-surface]").hasAttribute("inert")
    ).toBe(true);
    const frame = container.querySelector("iframe");
    expect(frame.hasAttribute("inert")).toBe(true);
    expect(useLobbySocial).toHaveBeenLastCalledWith(
        expect.objectContaining({ enabled: true })
    );
    journey = { ...journey, phase: "revealing", admitted: true };
    render();
    expect(frame.hasAttribute("data-visible")).toBe(true);
    expect(frame.hasAttribute("inert")).toBe(true);
    act(() =>
        window.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
        )
    );
    expect(journey.cancel).toHaveBeenCalled();
});

test("Back resumes the same lobby renderer with return tiles, keeps the old frame inert, and forwards its render acknowledgement", () => {
    journey = {
        ...journey,
        phase: "entered",
        selected: cards[0],
        frameUrl: "/first?__lobbyAttempt=test",
        attempt: "test",
    };
    render();
    const sceneElement = container.querySelector('[data-testid="scene"]');
    const frame = container.querySelector("iframe");
    const startedAt = 120;
    journey = {
        ...journey,
        phase: "returning",
        travel: { phase: "return", startedAt, reducedMotion: false },
    };
    render();
    const scene = (LobbyRenderer as jest.Mock).mock.calls.at(-1)[0];
    expect(scene).toMatchObject({
        active: true,
        travel: { phase: "return", startedAt, partyIds: [] },
        onReturnReady: journey.markReturnReady,
        onReturnComplete: journey.finishReturn,
    });
    expect(scene.groupFormation).toBeUndefined();
    expect(container.querySelector('[data-testid="scene"]')).toBe(sceneElement);
    expect(container.querySelector("iframe")).toBe(frame);
    expect(frame.hasAttribute("data-visible")).toBe(true);
    const surface = container.querySelector("[data-lobby-surface]");
    expect(surface.hasAttribute("data-return-preparing")).toBe(true);
    expect(surface.getAttribute("data-machine")).toBe("lobby-journey");
    expect(surface.getAttribute("data-state")).toBe(journey.phase);
    expect(getComputedStyle(surface).visibility).toBe("hidden");
    act(() => scene.onReturnReady(startedAt));
    expect(journey.markReturnReady).toHaveBeenCalledWith(startedAt);
    journey = { ...journey, returnReady: true };
    render();
    expect(surface.hasAttribute("data-return-preparing")).toBe(false);
    expect(getComputedStyle(surface).visibility).not.toBe("hidden");
    expect(frame.hasAttribute("data-visible")).toBe(false);
    expect(frame.hasAttribute("inert")).toBe(true);
    expect(frame.getAttribute("allow")).toContain("autoplay 'none'");
    expect(
        container.querySelector("[data-lobby-surface]").hasAttribute("inert")
    ).toBe(true);
    expect(container.textContent).toContain("Welcome back");
    expect(useLobbySocial).toHaveBeenLastCalledWith(
        expect.objectContaining({
            enabled: true,
            present: false,
            location: { state: "travelling" },
        })
    );
    act(() => scene.onReturnComplete(startedAt));
    expect(journey.finishReturn).toHaveBeenCalledWith(startedAt);
    expect(journey.cancel).not.toHaveBeenCalled();
    journey = {
        ...journey,
        phase: "idle",
        travel: null,
        frameUrl: null,
        attempt: null,
        selected: null,
    };
    render();
    expect(container.querySelector("iframe")).toBeNull();
    expect(
        container.querySelector("[data-lobby-surface]").hasAttribute("inert")
    ).toBe(false);
    expect((LobbyRenderer as jest.Mock).mock.calls.at(-1)[0].active).toBe(true);
});

test("loading with an immediate departure keeps the renderer active, locks input and shows only travel controls", () => {
    journey = {
        ...journey,
        phase: "loading",
        selected: cards[0],
        attempt: "decision",
        frameUrl: null,
        travel: {
            phase: "charge",
            startedAt: 120,
            dissolveStartedAt: 120,
            reducedMotion: false,
        },
    };
    render();
    expect((LobbyRenderer as jest.Mock).mock.calls.at(-1)[0]).toMatchObject({
        active: true,
        travel: {
            phase: "charge",
            startedAt: 120,
            dissolveStartedAt: 120,
            partyIds: [],
        },
    });
    const surface = container.querySelector("[data-lobby-surface]");
    expect(surface.hasAttribute("data-travelling")).toBe(true);
    expect(surface.hasAttribute("inert")).toBe(true);
    expect(container.querySelector("iframe")).toBeNull();
    expect(
        container.querySelector('[aria-label="Selected world"]')
    ).toBeNull();
    expect(container.querySelector("button.enter")).toBeNull();
    const controls = container.querySelector(
        '[aria-label="Travelling to your world"]'
    );
    expect(controls.textContent).toContain("First space");
    expect(controls.textContent).toContain("Transporting you");
    expect(document.activeElement).toBe(controls);
    expect(useLobbySocial).toHaveBeenLastCalledWith(
        expect.objectContaining({ enabled: true, present: true })
    );
    act(() =>
        window.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
        )
    );
    expect(journey.enter).not.toHaveBeenCalled();
    act(() =>
        window.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
        )
    );
    expect(journey.cancel).toHaveBeenCalledTimes(1);
});

test("a selected group retains its conversation, draft and focus throughout travel, gallery entry and return", async () => {
    social.groupsSupported = true;
    social.groups = [
        {
            id: "g1",
            name: "Moon club",
            ownerId: "self",
            joinCode: "join-me",
            messages: [],
            members: [
                { id: "self", name: "Guest", avatar: "", vrmUrl: "", scale: 1 },
                { id: "peer", name: "Alice", avatar: "", vrmUrl: "", scale: 1 },
            ],
        },
    ];
    social.groupMessages = [
        {
            id: "private",
            groupId: "g1",
            sessionId: "peer",
            name: "Alice",
            avatar: "",
            text: "Meet inside",
            sentAt: 1,
        },
    ];
    social.groupAction.mockResolvedValue({ requestId: "sent" });
    render(true);
    click(button("Current conversation: Global. Choose conversation"));
    click(button("Party Moon club"));
    const input = container.querySelector<HTMLInputElement>(
        'input[aria-label="Message Moon club"]'
    );
    act(() => {
        input.value = "Still together";
        Simulate.change(input);
        input.focus();
    });
    const surface = input.closest(".lobby-chat").parentElement;
    for (const phase of [
        "loading",
        "revealing",
        "entered",
        "returning",
        "idle",
    ]) {
        journey = {
            ...journey,
            phase,
            selected: phase === "idle" ? null : cards[0],
            travel: phase === "idle" ? null : { phase: "charge", startedAt: 1 },
            frameUrl: phase === "idle" ? null : "/first?__lobbyAttempt=test",
            attempt: "test",
        };
        render(true);
        expect(
            container.querySelector('input[aria-label="Message Moon club"]')
        ).toBe(input);
        expect(input.value).toBe("Still together");
        expect(document.activeElement).toBe(input);
        expect(surface.hasAttribute("inert")).toBe(false);
        expect(surface.hasAttribute("data-hidden")).toBe(false);
        expect(surface.hasAttribute("data-collapsed")).toBe(false);
        expect(container.querySelector('[role="log"]').textContent).toContain(
            "Meet inside"
        );
        expect(useLobbyTravelParty).toHaveBeenLastCalledWith(
            expect.objectContaining({ enabled: true, identityKey: "account" })
        );
        if (phase !== "entered" && phase !== "idle")
            expect(button("Travel with Moon club").disabled).toBe(true);
        if (phase === "revealing")
            expect(useLobbySocial).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    present: false,
                    location: {
                        state: "space",
                        destination: {
                            id: "one",
                            title: "First space",
                            href: "/first",
                        },
                    },
                })
            );
    }
    await act(async () => {
        Simulate.submit(input.closest("form"));
    });
    expect(social.groupAction).toHaveBeenCalledWith({
        action: "message",
        groupId: "g1",
        text: "Still together",
    });
    render(false);
    expect(useLobbyTravelParty).toHaveBeenLastCalledWith(
        expect.objectContaining({ enabled: false })
    );
});

test("native gallery entry without any group keeps the extra host chat surface hidden", () => {
    journey = {
        ...journey,
        phase: "entered",
        selected: cards[0],
        frameUrl: "/first?__lobbyAttempt=test",
        attempt: "test",
    };
    render();
    const toggle = container.querySelector(".destination-group-toggle");
    expect(toggle.parentElement.hasAttribute("data-hidden")).toBe(true);
    expect(toggle.parentElement.getAttribute("aria-hidden")).toBe("true");
});

test("shared place chrome keeps lobby navigation and presence connected", () => {
    const onExit = jest.fn();
    social.population = 4;
    act(() =>
        root.render(<Lobby cards={cards} onExit={onExit} onReady={jest.fn()} />)
    );
    expect(container.querySelector(".lobby-place").textContent).toBe(
        "Lobby4 here"
    );
    click(button("Back to exploring"));
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(journey.go).not.toHaveBeenCalled();
});

test("publishes the parent clock and loading phase to a destination without remounting it", () => {
    journey = {
        ...journey,
        phase: "loading",
        selected: { id: "space", title: "Space", href: "/space" },
        attempt: "loading-policy-attempt",
        frameUrl: "/space?__lobbyAttempt=loading-policy-attempt",
        travel: { phase: "isolate", startedAt: 100, reducedMotion: false },
    };
    render();
    const frame = container.querySelector("iframe");
    expect(frame.dataset.lobbyLoadingAttempt).toBe(journey.attempt);
    expect(Number(frame.dataset.lobbyLoadingStart)).toBe(
        performance.timeOrigin + 100
    );
    expect(frame.dataset.lobbyLoadingPhase).toBe("opening");
    journey = {
        ...journey,
        phase: "revealing",
        travel: { ...journey.travel, phase: "reveal" },
    };
    render();
    expect(container.querySelector("iframe")).toBe(frame);
    expect(frame.dataset.lobbyLoadingPhase).toBe("revealing");
    journey = { ...journey, phase: "entered", travel: null };
    render();
    expect(container.querySelector("iframe")).toBe(frame);
    expect(frame.dataset.lobbyLoadingPhase).toBe("active");
    expect(frame.dataset.lobbyLoadingStart).toBeUndefined();
});

test("defers the closed search tree cleanup until after the opening camera movement", () => {
    jest.useFakeTimers();
    render();
    click(button("Search worlds"));
    const panel = container.querySelector("#lobby-explore");
    journey = {
        ...journey,
        phase: "loading",
        selected: { id: "space", title: "Space", href: "/space" },
        travel: {
            phase: "isolate",
            startedAt: performance.now(),
            reducedMotion: false,
        },
    };
    render();
    click(button("Close search"));
    expect(panel.getAttribute("data-active")).toBe("false");
    act(() => jest.advanceTimersByTime(599));
    expect(container.querySelector("#lobby-explore")).toBe(panel);
    act(() => jest.advanceTimersByTime(1));
    expect(container.querySelector("#lobby-explore")).toBeNull();
});

const latestScene = () => (LobbyRenderer as jest.Mock).mock.calls.at(-1)[0];
const latestFlashPicker = () => (FlashPicker as jest.Mock).mock.calls.at(-1)[0];
let flashNonce = 0;
async function openFlash() {
    await act(async () => click(button("Flash")));
    expect(container.querySelector("#lobby-flash-picker")).not.toBeNull();
}
function chooseFlash() {
    Object.defineProperty(window, "crypto", {
        configurable: true,
        value: { randomUUID: () => `flash-test-${++flashNonce}` },
    });
    click(button("Choose test NFT"));
    return latestScene().flash;
}

test("Flash opens in the dock, restores focus on close and publishes only after the scene is ready", async () => {
    jest.useFakeTimers();
    render(true);
    const trigger = button("Flash");
    await openFlash();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelector(".dock-bar").hasAttribute("inert")).toBe(
        true
    );
    expect(latestFlashPicker().returnFocusRef.current).toBe(trigger);
    const conversation = container.querySelector(
        '[aria-label="Lobby chat"]'
    ).parentElement;
    expect(conversation.hasAttribute("data-hidden")).toBe(true);
    expect(conversation.hasAttribute("inert")).toBe(true);
    click(button("Close Flash"));
    act(() => jest.advanceTimersByTime(20));
    expect(document.activeElement).toBe(trigger);
    expect(conversation.hasAttribute("data-hidden")).toBe(false);
    expect(conversation.hasAttribute("inert")).toBe(false);
    expect(container.querySelector(".dock-bar").hasAttribute("inert")).toBe(
        false
    );

    await openFlash();
    const selected = chooseFlash();
    expect(selected).toMatchObject({
        id: "ethereum:art:1",
        title: "Blue sky",
        aspect: 1.5,
    });
    expect(container.querySelector("#lobby-flash-picker")).toBeNull();
    expect(container.querySelector(".flash-status").textContent).toContain(
        "Preparing Flash"
    );
    expect(social.setFlash.mock.calls.every(([value]) => value === null)).toBe(
        true
    );
    act(() => latestScene().onFlashReady(selected));
    expect(social.setFlash).toHaveBeenLastCalledWith(selected);
    expect(container.querySelector(".flash-status").textContent).toContain(
        "Blue sky"
    );
    const stop = Array.from(container.querySelectorAll("button")).find(
        (element) => element.textContent === "Stop Flash"
    );
    click(stop);
    expect(latestScene().flash).toBeNull();
    expect(social.setFlash).toHaveBeenLastCalledWith(null);
    expect(container.querySelector(".flash-status")).toBeNull();
});

test("replacing or stopping Flash ignores stale scene readiness, failure and dismiss callbacks", async () => {
    jest.useFakeTimers();
    render(true);
    await openFlash();
    const first = chooseFlash();
    const firstScene = latestScene();
    await openFlash();
    const replacement = chooseFlash();
    expect(replacement.nonce).not.toBe(first.nonce);
    social.setFlash.mockClear();
    act(() => {
        firstScene.onFlashReady(first);
        firstScene.onFlashError(first.nonce, "Old image failed");
        firstScene.onFlashDismiss(first.nonce);
    });
    expect(latestScene().flash).toEqual(replacement);
    expect(social.setFlash).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("Old image failed");
    const currentScene = latestScene();
    act(() => currentScene.onFlashDismiss(replacement.nonce));
    expect(latestScene().flash).toBeNull();
    social.setFlash.mockClear();
    act(() => currentScene.onFlashReady(replacement));
    expect(social.setFlash).not.toHaveBeenCalled();
});

test("Flash error clears the artwork and travel closes the picker and stops a loaded Flash", async () => {
    jest.useFakeTimers();
    render(true);
    await openFlash();
    const first = chooseFlash();
    act(() => latestScene().onFlashError(first.nonce, "Image unavailable"));
    expect(latestScene().flash).toBeNull();
    expect(
        container.querySelector(".flash-status [role=alert]").textContent
    ).toBe("Image unavailable");
    click(button("Dismiss Flash error"));
    expect(container.querySelector(".flash-status")).toBeNull();

    await openFlash();
    const next = chooseFlash();
    act(() => latestScene().onFlashReady(next));
    await openFlash();
    const oldScene = latestScene();
    journey = {
        ...journey,
        phase: "loading",
        selected: cards[0],
        travel: {
            phase: "isolate",
            startedAt: performance.now(),
            reducedMotion: false,
        },
    };
    render(true);
    expect(container.querySelector("#lobby-flash-picker")).toBeNull();
    expect(latestScene().flash).toBeNull();
    expect(social.setFlash).toHaveBeenLastCalledWith(null);
    social.setFlash.mockClear();
    act(() => oldScene.onFlashReady(next));
    expect(social.setFlash).not.toHaveBeenCalled();
});

test("a Flash that failed to load offers Try again with the same artwork", async () => {
    jest.useFakeTimers();
    render(true);
    await openFlash();
    const first = chooseFlash();
    act(() =>
        latestScene().onFlashError(
            first.nonce,
            "This NFT’s image took too long to load."
        )
    );
    const retry = [
        ...container.querySelectorAll<HTMLButtonElement>(
            ".flash-status button"
        ),
    ].find((item) => item.textContent === "Try again");
    expect(retry).toBeTruthy();
    click(retry);
    const again = latestScene().flash;
    expect(again).toMatchObject({ id: first.id, title: first.title });
    expect(again.nonce).not.toBe(first.nonce);
    expect(container.querySelector(".flash-status [role=alert]")).toBeNull();
    expect(container.querySelector(".flash-status").textContent).toContain(
        "Preparing Flash"
    );
});

test("unsupported shared Flash still shows locally without claiming it is shared", async () => {
    jest.useFakeTimers();
    delete social.setFlash;
    render(true);
    await openFlash();
    const selected = chooseFlash();
    act(() => latestScene().onFlashReady(selected));
    expect(latestScene().flash).toEqual(selected);
    expect(container.querySelector(".flash-status").textContent).toContain(
        "Blue sky"
    );
    expect(container.querySelector(".flash-status").textContent).not.toMatch(
        /shared|everyone/i
    );
});

test.each([
    ["signing out", false, "account"],
    ["changing account", true, "another-account"],
])(
    "%s closes Flash and ignores the former account's pending scene callback",
    async (_label, authenticated, accountId) => {
        jest.useFakeTimers();
        render(true);
        await openFlash();
        const selected = chooseFlash();
        const previous = latestScene();
        act(() => previous.onFlashReady(selected));
        await openFlash();
        expect(latestFlashPicker().showing).toBe(true);
        expect(typeof latestFlashPicker().onStop).toBe("function");
        render(authenticated as boolean, accountId as string);
        expect(container.querySelector("#lobby-flash-picker")).toBeNull();
        expect(latestScene().flash).toBeNull();
        expect(social.setFlash).toHaveBeenLastCalledWith(null);
        social.setFlash.mockClear();
        act(() => previous.onFlashReady(selected));
        expect(social.setFlash).not.toHaveBeenCalled();
    }
);

test("travel gives the 3D scene no words, only loading progress; the page keeps one screen-reader status and Cancel", () => {
    journey = {
        ...journey,
        phase: "loading",
        selected: cards[0],
        progress: 0.4,
        travel: { phase: "charge", startedAt: 120, reducedMotion: false },
    };
    render();
    const overlay = () =>
        container.querySelector('[aria-label="Travelling to your world"]');
    const scene = () => (LobbyRenderer as jest.Mock).mock.calls.at(-1)[0];
    const words = () => JSON.stringify(scene().travel);
    expect(scene().travel.label).toEqual({ progress: 0.4 });
    expect(scene().travel.status).toBeUndefined();
    expect(words()).not.toMatch(/First space|Opening|world/i);
    expect(scene().onTravelStatusVisible).toBeUndefined();
    expect(overlay().querySelectorAll('[role="status"]')).toHaveLength(1);
    expect(overlay().querySelector('[role="status"]').textContent).toBe(
        "First spaceTransporting you…"
    );
    expect(overlay().hasAttribute("data-floor-visible")).toBe(false);
    click(overlay().querySelector("button"));
    expect(journey.cancel).toHaveBeenCalledTimes(1);
    journey = { ...journey, phase: "revealing", admitted: true };
    render();
    expect(scene().travel.label).toEqual({ progress: undefined });
    expect(words()).not.toMatch(/First space|Arriving|ready/i);
    expect(overlay().querySelector('[role="status"]').textContent).toBe(
        "First spaceArriving"
    );
});

test("a saved avatar that fails to load becomes the default avatar with one self-dismissing notice, not a lobby error", async () => {
    jest.useFakeTimers();
    const notice = "Couldn’t load your avatar. Using the default.";
    (resolveLobbyAvatar as jest.Mock).mockResolvedValueOnce({
        id: "custom",
        name: "Custom",
        url: "/avatars/broken.vrm",
        scale: 1.2,
    });
    render(true);
    await act(async () => {});
    expect(latestScene().avatarUrl).toBe("/avatars/broken.vrm");
    const announcement = () => container.querySelector(".lobby-announcement");
    expect(announcement().getAttribute("role")).toBe("status");
    expect(announcement().textContent).toBe("");
    const failed = {
        url: "/avatars/broken.vrm",
        status: "error",
        fallbackUrl: VRMS.square.url,
    };
    act(() => latestScene().onAvatarStatus(failed));
    expect(mockToast).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith(notice);
    expect(announcement().textContent).toBe(notice);
    expect(container.querySelectorAll('[role="alert"]')).toHaveLength(0);
    expect(container.querySelector(".scene-error")).toBeNull();
    // The lobby follows the scene: same default avatar for the picker and
    // for what other visitors are told, and the scene keeps running.
    expect(latestScene().active).toBe(true);
    expect(latestScene().avatarUrl).toBe(VRMS.square.url);
    expect(latestScene().avatarScale).toBe(1.2);
    expect(
        (useLobbySocial as jest.Mock).mock.calls.at(-1)[0].identity.vrmUrl
    ).toBe(VRMS.square.url);
    // The same failure reported again (a restarted scene) is not repeated.
    act(() => latestScene().onAvatarStatus(failed));
    expect(mockToast).toHaveBeenCalledTimes(1);
    act(() => jest.advanceTimersByTime(5000));
    expect(announcement().textContent).toBe("");
});

test("a failed change of avatar stays beside the picker, with no toast", async () => {
    (resolveLobbyAvatar as jest.Mock).mockResolvedValueOnce({
        id: "custom",
        name: "Custom",
        url: "/avatars/broken.vrm",
    });
    render(true);
    await act(async () => {});
    act(() =>
        latestScene().onAvatarStatus({
            url: "/avatars/broken.vrm",
            status: "error",
        })
    );
    expect(mockToast).not.toHaveBeenCalled();
    expect(container.querySelector(".lobby-announcement").textContent).toBe("");
    expect(latestScene().avatarUrl).toBe("/avatars/broken.vrm");
    expect(container.querySelector(".scene-error")).toBeNull();
});

test("a scene error of either kind opens the lobby error with Try again, without the kind in its text", () => {
    render();
    act(() =>
        latestScene().onError(
            "Your avatar couldn’t load. Please try again.",
            "asset"
        )
    );
    const error = container.querySelector(".scene-error");
    expect(error.getAttribute("role")).toBe("alert");
    expect(error.querySelector("p").textContent).toBe(
        "Your avatar couldn’t load. Please try again."
    );
    expect(error.textContent).not.toMatch(/asset|renderer/);
    expect(latestScene().active).toBe(false);
    const attempts = (LobbyRenderer as jest.Mock).mock.calls.length;
    click(
        [...error.querySelectorAll("button")].find(
            (item) => item.textContent === "Try again"
        )
    );
    expect(container.querySelector(".scene-error")).toBeNull();
    expect(latestScene().active).toBe(true);
    expect((LobbyRenderer as jest.Mock).mock.calls.length).toBeGreaterThan(
        attempts
    );
});
