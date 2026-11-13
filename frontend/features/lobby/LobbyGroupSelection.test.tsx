/** @jest-environment jsdom */
import React, { act, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import LobbyChat from "./LobbyChat";

const group = {
    id: "g",
    name: "Friends",
    ownerId: "self",
    members: [],
    joinCode: "code",
    messages: [],
};
const secret = {
    id: "secret",
    groupId: "g",
    sessionId: "friend",
    name: "Friend",
    avatar: "",
    text: "Private group history",
    sentAt: 1,
};
let root: ReturnType<typeof createRoot>, container: HTMLDivElement;
let props: any;
const originalMedia = window.matchMedia;
function Chat() {
    const [open, onOpenChange] = useState(true);
    return (
        <LobbyChat
            social={{
                sessionId: "self",
                status: "connected",
                players: [],
                messages: [],
                sendMessage: jest.fn(),
            }}
            groupConversations={{
                groups: props.groups,
                messages: props.messages,
                request: props.request,
                onSelect: props.onSelect,
                onCreate: jest.fn(),
                onManage: jest.fn(),
                sendMessage: props.send,
            }}
            open={open}
            onOpenChange={onOpenChange}
            hidden={props.hidden}
            inputRef={useRef<HTMLInputElement>(null)}
            buttonRef={useRef<HTMLButtonElement>(null)}
        />
    );
}
const render = (next: any = {}) => {
    props = { ...props, ...next };
    act(() => root.render(<Chat />));
};
const input = () => container.querySelector<HTMLInputElement>("input");
const button = (label: string) =>
    container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
const click = (label: string) => act(() => button(label).click());
const type = (value: string) =>
    act(() => {
        input().value = value;
        Simulate.change(input());
    });
const advance = (ms: number) => act(() => jest.advanceTimersByTime(ms));
const finish = () => {
    advance(160);
    advance(100);
    advance(260);
};
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    props = {
        groups: [group],
        messages: [secret],
        hidden: false,
        send: jest.fn(async () => true),
        onSelect: jest.fn(),
    };
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.useRealTimers();
    Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: originalMedia,
    });
});
const enableMotion = () => {
    jest.useFakeTimers();
    Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: jest.fn(() => ({ matches: false })),
    });
};

test("an external group request arriving during exit waits and then selects the group", () => {
    enableMotion();
    render();
    click("Current conversation: Global. Choose conversation");
    expect(container.querySelector("section").dataset.viewPhase).toBe(
        "exiting"
    );
    render({ request: { id: "g", nonce: 1 } });
    expect(props.onSelect).not.toHaveBeenCalled();
    finish();
    finish();
    expect(input().getAttribute("aria-label")).toBe("Message Friends");
    expect(props.onSelect).toHaveBeenCalledWith("g");
});

test("a request received while hidden waits until visible without stealing focus", () => {
    const outside = document.createElement("button");
    document.body.append(outside);
    render({ hidden: true });
    outside.focus();
    render({ request: { id: "g", nonce: 1 } });
    expect(props.onSelect).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(outside);
    render({ hidden: false });
    expect(input().getAttribute("aria-label")).toBe("Message Friends");
    expect(document.activeElement).toBe(input());
    outside.remove();
});

test("a request for a group that has not arrived remains pending until membership appears", () => {
    render({ groups: [], request: { id: "g", nonce: 1 } });
    expect(props.onSelect).not.toHaveBeenCalled();
    render({ groups: [group] });
    expect(input().getAttribute("aria-label")).toBe("Message Friends");
});

test("leaving clears selected group, private history, unread marker, and draft before rejoining", () => {
    render({ request: { id: "g", nonce: 1 } });
    type("Private unsent draft");
    expect(container.textContent).toContain("Private group history");
    render({ groups: [] });
    expect(input().getAttribute("aria-label")).toBe("Message the lobby");
    expect(container.textContent).not.toContain("Private group history");
    expect(container.querySelector(".chat-unread-dot")).toBeNull();
    expect(props.onSelect).toHaveBeenLastCalledWith(null);
    render({ groups: [group], request: { id: "g", nonce: 2 } });
    expect(input().value).toBe("");
});

test("membership loss cancels selection before the delayed group commit", () => {
    enableMotion();
    render({ request: { id: "g", nonce: 1 } });
    advance(160);
    render({ groups: [] });
    advance(100);
    advance(260);
    expect(input().getAttribute("aria-label")).toBe("Message the lobby");
    expect(props.onSelect).not.toHaveBeenCalledWith("g");
    expect(container.textContent).not.toContain("Private group history");
});

test("a removed group's delayed send cannot erase a new draft after rejoining", async () => {
    let resolve: (sent: boolean) => void;
    const send = jest.fn(
        () =>
            new Promise<boolean>((done) => {
                resolve = done;
            })
    );
    render({ send, request: { id: "g", nonce: 1 } });
    type("Keep this text");
    act(() => Simulate.submit(container.querySelector("form")));
    render({ groups: [] });
    render({ groups: [group], request: { id: "g", nonce: 2 } });
    type("Keep this text");
    await act(async () => resolve(true));
    expect(input().value).toBe("Keep this text");
});

test("leaving another group does not discard the current group's send acknowledgement", async () => {
    let resolve: (sent: boolean) => void;
    const send = jest.fn(
        () =>
            new Promise<boolean>((done) => {
                resolve = done;
            })
    );
    render({
        groups: [group, { ...group, id: "other" }],
        send,
        request: { id: "g", nonce: 1 },
    });
    type("Send once");
    act(() => Simulate.submit(container.querySelector("form")));
    render({ groups: [group] });
    await act(async () => resolve(true));
    expect(input().value).toBe("");
});
