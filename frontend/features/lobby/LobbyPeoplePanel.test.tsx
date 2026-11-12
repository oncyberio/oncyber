/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import LobbyPeoplePanel from "./LobbyPeoplePanel";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let opener: HTMLButtonElement;
let onClose: jest.Mock;
const players = [
    { id: "self", name: "You Name", isLocal: true },
    { id: "nearby", name: "Nearby Visitor" },
];
const render = () =>
    act(() =>
        root.render(
            <LobbyPeoplePanel
                players={players}
                population={12}
                status="connected"
                onClose={onClose}
                returnFocusRef={{ current: opener }}
            >
                <label>
                    Invite a friend
                    <input aria-label="Invite a friend" />
                </label>
            </LobbyPeoplePanel>
        )
    );

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    opener = document.createElement("button");
    opener.textContent = "People";
    document.body.append(opener);
    opener.focus();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    onClose = jest.fn();
    render();
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    opener.remove();
});

it("opens with a labelled dialog, nearby status, and focus on Close", () => {
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog.getAttribute("aria-labelledby")).toBe("lobby-people-title");
    expect(container.querySelector('[role="status"]').textContent).toBe(
        "12 in this lobby · showing people near you"
    );
    expect(
        container.querySelectorAll('ul[aria-label="People nearby"] li')
    ).toHaveLength(2);
    expect(document.activeElement.getAttribute("aria-label")).toBe(
        "Close people"
    );
    expect(container.querySelector("small").textContent).toBe("You");
});

it("handles Escape from party fields locally while respecting composition", () => {
    const input = container.querySelector("input");
    const outside = jest.fn();
    window.addEventListener("keydown", outside);
    act(() => input.focus());
    const composing = new KeyboardEvent("keydown", {
        key: "Escape",
        isComposing: true,
        bubbles: true,
        cancelable: true,
    });
    act(() => input.dispatchEvent(composing));
    expect(onClose).not.toHaveBeenCalled();
    outside.mockClear();
    const escape = new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
    });
    act(() => input.dispatchEvent(escape));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(escape.defaultPrevented).toBe(true);
    expect(outside).not.toHaveBeenCalled();
    window.removeEventListener("keydown", outside);
});

it("returns focus on dismissal without taking it from another panel", async () => {
    act(() => root.render(null));
    await act(async () => await Promise.resolve());
    expect(document.activeElement).toBe(opener);
    render();
    const nextPanel = document.createElement("button");
    document.body.append(nextPanel);
    act(() => nextPanel.focus());
    act(() => root.render(null));
    await act(async () => await Promise.resolve());
    expect(document.activeElement).toBe(nextPanel);
    nextPanel.remove();
});

it("someone an admin muted is told that, not to turn their microphone on", () => {
    const voice = (muted: boolean) => ({
        stage: {
            speakers: [{ sessionId: "self", name: "You Name", avatar: "" }],
            limit: 5,
            role: null,
            muted,
            requested: false,
            requests: [],
            mutedPeople: [],
        },
        voiceState: "muted" as const,
        onListen: jest.fn(),
        onRequest: jest.fn(),
        onLeave: jest.fn(),
        onAdmin: jest.fn(),
    });
    const notes = (muted: boolean) => {
        act(() =>
            root.render(
                <LobbyPeoplePanel
                    players={players}
                    population={12}
                    status="connected"
                    onClose={onClose}
                    voice={voice(muted)}
                />
            )
        );
        return [...container.querySelectorAll(".voice-note")].map(
            (note) => note.textContent
        );
    };
    expect(notes(false)).toEqual([
        "You’re on voice. Turn on your microphone to be heard.",
    ]);
    // Turning the microphone on would do nothing, so only the reason shows.
    expect(notes(true)).toEqual(["An admin muted you. You can still listen."]);
});
