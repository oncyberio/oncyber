/** @jest-environment jsdom */
import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import LobbyChat from "./LobbyChat";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let social: any;
let hidden: boolean;
let setOpen: (value: boolean) => void;
let mounted: boolean;
const inputRef = React.createRef<HTMLInputElement>();
const buttonRef = React.createRef<HTMLButtonElement>();
const originalMatchMedia = window.matchMedia;

function Chat() {
    const [open, onOpenChange] = useState(false);
    setOpen = onOpenChange;
    return (
        <LobbyChat
            social={social}
            open={open}
            onOpenChange={onOpenChange}
            inputRef={inputRef}
            buttonRef={buttonRef}
            hidden={hidden}
        />
    );
}

const render = () => act(() => root.render(<Chat />));
const input = () => container.querySelector<HTMLInputElement>("input");
const selector = () =>
    container.querySelector<HTMLButtonElement>(".chat-people-toggle");
const contact = (name = "Global") =>
    container.querySelector<HTMLButtonElement>(
        `button[aria-label="${
            name === "Global" ? "Global chat" : `Message ${name}`
        }"]`
    );
const phase = () =>
    container.querySelector(".lobby-chat").getAttribute("data-view-phase");
const log = () => container.querySelector('[role="log"]');
const click = (target: Element) =>
    act(() => target.dispatchEvent(new MouseEvent("click", { bubbles: true })));
const advance = (milliseconds: number) =>
    act(() => jest.advanceTimersByTime(milliseconds));
const type = (value: string) =>
    act(() => {
        input().value = value;
        Simulate.change(input());
    });
const key = (value: string, target: Element = input()) => {
    const event = new KeyboardEvent("keydown", {
        key: value,
        bubbles: true,
        cancelable: true,
    });
    act(() => target.dispatchEvent(event));
    return event;
};
const finish = () => {
    advance(160);
    advance(100);
    advance(260);
};
const openPicker = () => {
    click(selector());
    finish();
};
const openAlice = () => {
    if (!contact("Alice")) openPicker();
    click(contact("Alice"));
    finish();
};
const mediaPreference = (reduced: boolean) => {
    Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: jest.fn((query: string) => ({
            matches: reduced,
            media: query,
            onchange: null,
            addListener: jest.fn(),
            removeListener: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
        })),
    });
};

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.useFakeTimers();
    mediaPreference(false);
    hidden = false;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    mounted = true;
    social = {
        status: "connected",
        sessionId: "self",
        messages: [],
        players: [
            { id: "self", name: "Guest", isLocal: true },
            { id: "alice", name: "Alice", avatar: "/alice.png" },
            { id: "bob", name: "Bob", avatar: "/bob.png" },
        ],
        sendMessage: jest.fn(() => true),
    };
});

afterEach(() => {
    if (mounted) act(() => root.unmount());
    container.remove();
    jest.clearAllTimers();
    jest.useRealTimers();
    Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
    });
    jest.clearAllMocks();
});

test("the next conversation appears only after a complete exit and 100 ms pause", () => {
    render();
    openPicker();
    expect(phase()).toBe("idle");
    click(contact("Alice"));
    expect(phase()).toBe("exiting");
    expect(contact("Alice")).not.toBeNull();
    expect(log()).toBeNull();
    expect(selector().getAttribute("aria-label")).toContain("Global");
    advance(159);
    expect(phase()).toBe("exiting");
    advance(1);
    expect(phase()).toBe("paused");
    advance(99);
    expect(phase()).toBe("paused");
    expect(log()).toBeNull();
    expect(selector().getAttribute("aria-label")).toContain("Global");
    advance(1);
    expect(phase()).toBe("entering");
    expect(contact("Alice")).toBeNull();
    expect(log().getAttribute("aria-label")).toBe("Messages with Alice");
    expect(input().getAttribute("aria-label")).toBe("Message Alice");
    expect(document.activeElement).toBe(input());
    advance(259);
    expect(phase()).toBe("entering");
    advance(1);
    expect(phase()).toBe("idle");
});

test("Tab restores focus to the selected pill after the pause and retains the private draft", () => {
    render();
    openAlice();
    type("A private draft");
    expect(key("Tab").defaultPrevented).toBe(true);
    expect(phase()).toBe("exiting");
    expect(log().getAttribute("aria-label")).toBe("Messages with Alice");
    expect(input().value).toBe("A private draft");
    advance(160);
    expect(phase()).toBe("paused");
    advance(100);
    expect(phase()).toBe("entering");
    expect(input().getAttribute("aria-label")).toBe(
        "Search people in this lobby"
    );
    expect(selector().getAttribute("aria-pressed")).toBe("true");
    expect(document.activeElement).toBe(contact("Alice"));
    advance(260);
    click(contact("Alice"));
    advance(160);
    advance(100);
    expect(input().value).toBe("A private draft");
    expect(document.activeElement).toBe(input());
    expect(social.sendMessage).not.toHaveBeenCalled();
});

test("unread messages remain unread through the hidden gap and entrance", () => {
    social.messages = [
        {
            id: "alice-message",
            sessionId: "alice",
            recipientId: "self",
            name: "Alice",
            text: "Hello",
            sentAt: 100,
        },
    ];
    render();
    openPicker();
    expect(container.querySelector(".chat-unread-dot")).not.toBeNull();
    click(contact("Alice"));
    advance(160);
    expect(container.querySelector(".chat-unread-dot")).not.toBeNull();
    advance(100);
    expect(log().textContent).toContain("Hello");
    expect(container.querySelector(".chat-unread-dot")).not.toBeNull();
    advance(259);
    expect(container.querySelector(".chat-unread-dot")).not.toBeNull();
    advance(1);
    expect(container.querySelector(".chat-unread-dot")).toBeNull();
});

test("repeated choices during exit and pause cannot replace the pending recipient", () => {
    render();
    openPicker();
    click(contact("Alice"));
    click(contact("Bob"));
    advance(160);
    click(contact("Global"));
    advance(100);
    expect(input().getAttribute("aria-label")).toBe("Message Alice");
    advance(260);
    expect(phase()).toBe("idle");
});

test.each([0, 160])(
    "sending is blocked while switching away from chat at %i ms",
    (elapsed) => {
        render();
        openAlice();
        type("Do not send while switching");
        key("Tab");
        if (elapsed) advance(elapsed);
        act(() =>
            container
                .querySelector("form.chat-composer")
                .dispatchEvent(
                    new Event("submit", { bubbles: true, cancelable: true })
                )
        );
        expect(social.sendMessage).not.toHaveBeenCalled();
        finish();
        click(contact("Alice"));
        finish();
        expect(input().value).toBe("Do not send while switching");
    }
);

test.each([0, 160])(
    "Escape cancels a pending selection at %i ms and restores the current message input",
    (elapsed) => {
        render();
        openPicker();
        click(contact("Alice"));
        if (elapsed) advance(elapsed);
        expect(key("Escape", contact("Alice")).defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(input());
        advance(1000);
        expect(phase()).toBe("idle");
        expect(log()).not.toBeNull();
        expect(input().getAttribute("aria-label")).toBe("Message the lobby");
        expect(contact("Alice")).toBeNull();
        expect(selector().getAttribute("aria-label")).toContain("Global");
    }
);

test("external close cancels the pending picker instead of reopening it later", () => {
    render();
    openAlice();
    type("Saved draft");
    key("Tab");
    advance(160);
    act(() => setOpen(false));
    advance(1000);
    expect(phase()).toBe("idle");
    expect(log()).toBeNull();
    expect(contact("Alice")).toBeNull();
    act(() => setOpen(true));
    finish();
    expect(input().getAttribute("aria-label")).toBe("Message Alice");
    expect(input().value).toBe("Saved draft");
});

test("hiding the lobby cancels a pending selection without stealing focus on return", () => {
    render();
    openPicker();
    click(contact("Alice"));
    advance(160);
    hidden = true;
    render();
    advance(1000);
    hidden = false;
    render();
    expect(phase()).toBe("idle");
    expect(selector().getAttribute("aria-label")).toContain("Global");
    expect(input().getAttribute("aria-label")).toBe(
        "Search people in this lobby"
    );
    expect(contact("Alice")).not.toBeNull();
    expect(document.activeElement).toBe(input());
});

test("a new session cancels a delayed private selection and discards old drafts", () => {
    render();
    openAlice();
    type("Old private draft");
    key("Tab");
    finish();
    click(contact("Alice"));
    advance(160);
    social.sessionId = "new-self";
    social.players = social.players.map((person: any) =>
        person.isLocal ? { ...person, id: "new-self" } : person
    );
    render();
    advance(1000);
    expect(phase()).toBe("idle");
    expect(selector().getAttribute("aria-label")).toContain("Global");
    expect(contact("Alice")).toBeNull();
    expect(log()).toBeNull();
    expect(input().getAttribute("aria-label")).toBe("Message the lobby");
    openAlice();
    expect(input().value).toBe("");
});

test("opening from the world reveals the existing message mode without a picker transition", () => {
    render();
    const originalInput = input();
    const composer = container.querySelector("form.chat-composer");
    expect(log()).toBeNull();
    act(() => setOpen(true));
    expect(phase()).toBe("idle");
    expect(input()).toBe(originalInput);
    expect(container.querySelector("form.chat-composer")).toBe(composer);
    expect(input().getAttribute("aria-label")).toBe("Message the lobby");
    expect(log()).not.toBeNull();
    expect(document.activeElement).toBe(input());
    expect(jest.getTimerCount()).toBe(0);
});

test.each(["reduced", "unsupported"])(
    "%s motion switches immediately without waiting",
    (preference) => {
        if (preference === "reduced") mediaPreference(true);
        else
            Object.defineProperty(window, "matchMedia", {
                configurable: true,
                value: undefined,
            });
        render();
        openPicker();
        click(contact("Alice"));
        expect(phase()).toBe("idle");
        expect(input().getAttribute("aria-label")).toBe("Message Alice");
        expect(document.activeElement).toBe(input());
        key("Tab");
        expect(phase()).toBe("idle");
        expect(document.activeElement).toBe(contact("Alice"));
    }
);

test("unmount clears pending transition timers", () => {
    render();
    const initialTimers = jest.getTimerCount();
    click(selector());
    expect(jest.getTimerCount()).toBeGreaterThan(initialTimers);
    act(() => root.unmount());
    mounted = false;
    expect(jest.getTimerCount()).toBe(initialTimers);
    advance(1000);
    expect(social.sendMessage).not.toHaveBeenCalled();
});

test("an initially open chat shows the message input under StrictMode without delayed work", () => {
    act(() =>
        root.render(
            <React.StrictMode>
                <LobbyChat
                    social={social}
                    open={true}
                    onOpenChange={jest.fn()}
                    inputRef={inputRef}
                    buttonRef={buttonRef}
                    hidden={false}
                />
            </React.StrictMode>
        )
    );
    expect(phase()).toBe("idle");
    expect(jest.getTimerCount()).toBe(0);
    expect(input().getAttribute("aria-label")).toBe("Message the lobby");
    expect(document.activeElement).toBe(input());
});

test("the composer frame stays outside the transitioning upper view and mounted through each phase", () => {
    render();
    openAlice();
    type("Keep this composer draft");
    const composer = container.querySelector("form.chat-composer");
    const upperView = container.querySelector(".chat-view");
    const messageInput = input();
    expect(upperView.contains(composer)).toBe(false);
    key("Tab");
    expect(phase()).toBe("exiting");
    expect(container.querySelector("form.chat-composer")).toBe(composer);
    expect(input()).toBe(messageInput);
    expect(input().readOnly).toBe(true);
    expect(input().value).toBe("Keep this composer draft");
    advance(160);
    expect(phase()).toBe("paused");
    expect(container.querySelector("form.chat-composer")).toBe(composer);
    expect(input()).toBe(messageInput);
    advance(100);
    expect(phase()).toBe("entering");
    expect(container.querySelector("form.chat-composer")).toBe(composer);
    expect(input().getAttribute("aria-label")).toBe(
        "Search people in this lobby"
    );
    expect(upperView.contains(contact("Alice"))).toBe(true);
    expect(document.activeElement).toBe(contact("Alice"));
    advance(260);
    key("Escape", contact("Alice"));
    expect(phase()).toBe("exiting");
    expect(container.querySelector("form.chat-composer")).toBe(composer);
    advance(160);
    expect(phase()).toBe("paused");
    expect(input().getAttribute("aria-label")).toBe(
        "Search people in this lobby"
    );
    advance(100);
    expect(phase()).toBe("entering");
    expect(container.querySelector("form.chat-composer")).toBe(composer);
    expect(input().value).toBe("Keep this composer draft");
    expect(document.activeElement).toBe(input());
    advance(260);
    expect(phase()).toBe("idle");
    expect(social.sendMessage).not.toHaveBeenCalled();
});

test.each([0, 160])(
    "Escape while opening the picker at %i ms cancels the delayed opening",
    (elapsed) => {
        render();
        openAlice();
        type("Preserve the private draft");
        key("Tab");
        if (elapsed) advance(elapsed);
        expect(key("Escape").defaultPrevented).toBe(true);
        advance(1000);
        expect(phase()).toBe("idle");
        expect(contact("Alice")).toBeNull();
        expect(log()).toBeNull();
        expect(input().getAttribute("aria-label")).toBe("Message Alice");
        expect(input().value).toBe("Preserve the private draft");
        expect(social.sendMessage).not.toHaveBeenCalled();
    }
);

test.each(["browse", "search"])(
    "external close dismisses a committed %s picker without losing the current draft",
    (mode) => {
        render();
        openAlice();
        type("Saved Alice draft");
        key("Tab");
        finish();
        if (mode === "search") {
            act(() => input().focus());
            type("bob");
        }
        act(() => setOpen(false));
        advance(1000);
        expect(phase()).toBe("idle");
        expect(contact("Alice")).toBeNull();
        expect(log()).toBeNull();
        expect(input().getAttribute("aria-label")).toBe("Message Alice");
        expect(input().value).toBe("Saved Alice draft");
        act(() => setOpen(true));
        expect(log().getAttribute("aria-label")).toBe("Messages with Alice");
        expect(document.activeElement).toBe(input());
        expect(input().value).toBe("Saved Alice draft");
        expect(social.sendMessage).not.toHaveBeenCalled();
    }
);

test.each([0, 160])(
    "Escape cancels a search selection at %i ms and returns to the current conversation",
    (elapsed) => {
        render();
        openAlice();
        type("Alice draft remains private");
        key("Tab");
        finish();
        act(() => input().focus());
        type("bob");
        click(contact("Bob"));
        if (elapsed) advance(elapsed);
        expect(key("Escape").defaultPrevented).toBe(true);
        advance(1000);
        expect(phase()).toBe("idle");
        expect(contact("Bob")).toBeNull();
        expect(selector().getAttribute("aria-label")).toContain("Alice");
        expect(document.activeElement).toBe(input());
        expect(input().getAttribute("aria-label")).toBe("Message Alice");
        expect(input().value).toBe("Alice draft remains private");
        expect(social.sendMessage).not.toHaveBeenCalled();
    }
);

test("losing the last contact cancels a pending picker animation", () => {
    render();
    click(selector());
    advance(160);
    social.players = social.players.filter(
        (person) => person.id === social.sessionId
    );
    render();
    finish();
    expect(selector().disabled).toBe(true);
    expect(contact()).toBeNull();
    expect(input()).not.toBeNull();
    expect(phase()).toBe("idle");
});
