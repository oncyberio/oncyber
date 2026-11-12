/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import Chat from ".";

let mockChat: any;
const mockUpdatePlayer = jest.fn();
jest.mock("../../context/MultiplayerProvider", () => ({
    useMultiplayer: () => ({
        room: { id: "room-1", sessionId: "alice" },
        chat: mockChat,
    }),
}));
jest.mock("../../context/hooks/useChat", () => ({
    CHAT_TYPES: { MESSAGE: { label: "MESSAGE" } },
}));
jest.mock("../../hooks/useWorld", () => ({
    useWorld: () => ({ current: { updatePlayer: mockUpdatePlayer } }),
}));
jest.mock("../../three/factory/player/constants", () => ({
    UPDATE_CHAT: "UPDATE_CHAT",
}));
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const render = () => act(() => root.render(<Chat exhibit={{}} />));
const button = (label: string) =>
    container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
const click = (el: Element) =>
    act(() => {
        el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
const input = () => container.querySelector<HTMLInputElement>("input");
const type = (value: string) =>
    act(() => {
        input().value = value;
        Simulate.change(input());
    });
const submit = () =>
    act(() => {
        input()
            .closest("form")
            .dispatchEvent(
                new Event("submit", { bubbles: true, cancelable: true })
            );
    });
const selector = () =>
    container.querySelector<HTMLButtonElement>(
        'button[aria-label^="Current conversation:"]'
    );
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    window.matchMedia = jest.fn().mockReturnValue({ matches: true });
    mockUpdatePlayer.mockClear();
    mockChat = {
        active: true,
        isTyping: false,
        isMobileChatOpen: false,
        setIsMobileChatOpen: jest.fn(),
        isChatDisabled: false,
        playersInfo: {
            bob: {
                sessionId: "bob",
                userData: { username: "Bob", avatar: "" },
            },
        },
        messages: [],
        setIsTyping: jest.fn(),
        setChatMode: jest.fn(),
        sendMessage: jest.fn(({ payload }) => ({
            text: payload.message,
            date: "12:00",
            acc_date: "2026-10-09T12:00:00Z",
        })),
    };
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    render();
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

test("native gallery opens its Room/People picker from the message composer without the legacy emoji UI", () => {
    expect(input().getAttribute("aria-label")).toBe("Message the room");
    expect(button("Room chat")).toBeNull();
    click(selector());
    expect(input().getAttribute("aria-label")).toBe(
        "Search people in this room"
    );
    expect(button("Room chat")).not.toBeNull();
    expect(button("Message Bob")).not.toBeNull();
    expect(container.querySelector('[src*="chat-emoji"]')).toBeNull();
    expect(container.textContent).not.toContain("Global");
    click(button("Room chat"));
    type("hello room");
    submit();
    expect(mockChat.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
            payload: expect.objectContaining({
                message: "hello room",
                recipientId: undefined,
            }),
        })
    );
    expect(mockUpdatePlayer).toHaveBeenCalledTimes(1);
});

test("selecting a person sends only to that real session and never publishes an avatar bubble", () => {
    click(selector());
    click(button("Message Bob"));
    type("private hello");
    submit();
    expect(mockChat.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
            payload: expect.objectContaining({ recipientId: "bob" }),
        })
    );
    expect(mockUpdatePlayer).not.toHaveBeenCalled();
    expect(input().value).toBe("");
});

test("conversation drafts are isolated and a departed peer cannot fall back to room chat", () => {
    click(selector());
    click(button("Message Bob"));
    type("bob draft");
    click(selector());
    click(button("Room chat"));
    type("room draft");
    click(selector());
    click(button("Message Bob"));
    expect(input().value).toBe("bob draft");
    mockChat.playersInfo = {};
    render();
    submit();
    expect(mockChat.sendMessage).not.toHaveBeenCalled();
    expect(input().value).toBe("bob draft");
    expect(container.textContent).toContain("Your draft is saved");
});

test("received DM and public history are separated, including after the sender leaves", () => {
    mockChat.messages = [
        {
            type: "MESSAGE",
            sessionId: "bob",
            direct: "alice",
            username: "Bob",
            text: "secret",
            acc_date: "2026-10-09T12:00:02Z",
        },
        {
            type: "MESSAGE",
            sessionId: "bob",
            text: "public",
            acc_date: "2026-10-09T12:00:00Z",
        },
    ];
    render();
    click(selector());
    click(button("Room chat"));
    expect(container.querySelector('[role="log"]').textContent).toContain(
        "public"
    );
    expect(container.querySelector('[role="log"]').textContent).not.toContain(
        "secret"
    );
    click(selector());
    click(button("Message Bob"));
    mockChat.playersInfo = {};
    render();
    expect(container.querySelector('[role="log"]').textContent).toContain(
        "secret"
    );
    expect(container.querySelector('[role="log"]').textContent).not.toContain(
        "public"
    );
});

test("chat-disabled permission prevents both public and private composer sends", () => {
    mockChat.isChatDisabled = true;
    render();
    click(selector());
    click(button("Room chat"));
    type("hello");
    submit();
    click(selector());
    click(button("Message Bob"));
    type("private");
    submit();
    expect(mockChat.sendMessage).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Chat is disabled");
});

test("native Enter opens chat but focus already in the picker is not stolen", () => {
    click(selector());
    const focusedContact = button("Message Bob");
    act(() => focusedContact.focus());
    mockChat.isTyping = true;
    render();
    expect(document.activeElement).toBe(focusedContact);
    expect(input().getAttribute("aria-label")).toBe(
        "Search people in this room"
    );
    mockChat.isTyping = false;
    render();
    act(() => (document.activeElement as HTMLElement).blur());
    mockChat.isTyping = true;
    render();
    expect(document.activeElement).toBe(input());
    expect(input().getAttribute("aria-label")).toBe("Message the room");
});

test("solo gallery keeps the room composer but disables the empty conversation picker", () => {
    mockChat.playersInfo = {
        alice: { sessionId: "alice", userData: { username: "You" } },
    };
    render();
    expect(selector().disabled).toBe(true);
    click(selector());
    expect(button("Room chat")).toBeNull();
    expect(input().getAttribute("aria-label")).toBe("Message the room");
    expect(container.querySelector(".chat-chevron")).toBeNull();
});

test("collapsing phone chat preserves its draft and returns focus to the chat button", () => {
    const action = document.createElement("div");
    action.dataset.experienceAction = "chat";
    const toggle = document.createElement("button");
    action.append(toggle);
    document.body.append(action);
    mockChat.isMobileChatOpen = true;
    render();
    type("Unsent draft");
    const originalInput = input();
    mockChat.isMobileChatOpen = false;
    render();
    expect(container.querySelector("[data-phone-chat-open]")).toBeNull();
    expect(document.activeElement).toBe(toggle);
    mockChat.isMobileChatOpen = true;
    render();
    expect(input()).toBe(originalInput);
    expect(input().value).toBe("Unsent draft");
    expect(mockChat.sendMessage).not.toHaveBeenCalled();
    action.remove();
});

test("the native typing shortcut opens the collapsed phone composer", () => {
    mockChat.isTyping = true;
    render();
    expect(mockChat.setIsMobileChatOpen).toHaveBeenCalledWith(true);
});
