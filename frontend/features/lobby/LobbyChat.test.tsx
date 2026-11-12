/** @jest-environment jsdom */
import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import LobbyChat from "./LobbyChat";
import { LOBBY_GUEST_PORTRAIT } from "./lobbyIdentity";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let social: any;
let hidden: boolean;
let setOpen: (open: boolean) => void;
const inputRef = React.createRef<HTMLInputElement>();
const buttonRef = React.createRef<HTMLButtonElement>();

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
const button = (label: string) =>
    container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
const input = () => container.querySelector<HTMLInputElement>("input");
const selector = () =>
    container.querySelector<HTMLButtonElement>(
        'button[aria-label^="Current conversation:"]'
    );
const click = (target: Element) =>
    act(() => {
        target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
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
const openConversation = (name = "Global") => {
    if (!button("Global chat")) click(selector());
    click(button(name === "Global" ? "Global chat" : `Message ${name}`));
};
const openPicker = () => {
    if (!button("Global chat")) click(selector());
};
const openSearch = () => {
    openPicker();
    if (input()?.getAttribute("aria-label") !== "Search people in this lobby")
        act(() => input().focus());
};
const receive = (
    id: string,
    sessionId: string,
    recipientId?: string,
    text = id,
    sentAt = 100
) => {
    social.messages = [
        ...social.messages,
        {
            id,
            sessionId,
            recipientId,
            name: social.players.find((player) => player.id === sessionId)
                ?.name,
            text,
            sentAt,
        },
    ];
    render();
};

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    hidden = false;
    social = {
        status: "connected",
        sessionId: "self",
        messages: [],
        players: [
            { id: "self", name: "Guest", isLocal: true },
            { id: "alice", name: "Alice", avatar: "/alice.png" },
            { id: "bob", name: "Bob", avatar: "/bob.png" },
            { id: "carol", name: "Carol" },
        ],
        sendMessage: jest.fn(() => true),
    };
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.clearAllMocks();
});

test("opening search finds people in this space and excludes yourself", () => {
    render();
    openSearch();
    expect(input().getAttribute("aria-label")).toBe(
        "Search people in this lobby"
    );
    expect(document.activeElement).toBe(input());
    expect(button("Global chat")).not.toBeNull();
    expect(button("Message Alice")).not.toBeNull();
    expect(button("Message Bob")).not.toBeNull();
    expect(button("Message Guest")).toBeNull();
    expect(container.querySelector('[role="log"]')).toBeNull();
    type("aLi");
    expect(button("Message Alice")).not.toBeNull();
    expect(button("Message Bob")).toBeNull();
    expect(social.sendMessage).not.toHaveBeenCalled();
    type("nobody matches");
    expect(button("Message Alice")).toBeNull();
    expect(button("Message Bob")).toBeNull();
});

test("people are ordered by the most recent direct conversation", () => {
    render();
    openPicker();
    receive("older-alice", "self", "alice", "Hi Alice", 200);
    receive("latest-bob", "bob", "self", "Hi back", 300);
    receive("public-carol", "carol", undefined, "Public hello", 400);
    const names = () =>
        Array.from(
            container.querySelectorAll<HTMLButtonElement>(
                'button[aria-label^="Message "]'
            )
        ).map((entry) => entry.getAttribute("aria-label"));
    expect(names()).toEqual(["Message Bob", "Message Alice", "Message Carol"]);
    social.messages = [];
    render();
    expect(names()).toEqual(["Message Bob", "Message Alice", "Message Carol"]);
    receive("newest-alice", "alice", "self", "Hello again", 500);
    expect(names()).toEqual(["Message Alice", "Message Bob", "Message Carol"]);
});

test("selecting a person shows their portrait in the selector and targets the DM", () => {
    render();
    openConversation("Alice");
    expect(input().getAttribute("aria-label")).toBe("Message Alice");
    expect(button("Global chat")).toBeNull();
    expect(selector().getAttribute("aria-label")).toBe(
        "Current conversation: Alice. Choose conversation"
    );
    expect(
        container.querySelector('.chat-input-glyph img[src="/alice.png"]')
    ).not.toBeNull();
    type("Hello Alice");
    submit();
    expect(social.sendMessage).toHaveBeenCalledWith("Hello Alice", "alice");
    expect(input().value).toBe("");
    openConversation();
    expect(selector().getAttribute("aria-label")).toBe(
        "Current conversation: Global. Choose conversation"
    );
    type("Hello everyone");
    submit();
    expect(social.sendMessage).toHaveBeenLastCalledWith("Hello everyone");
});

test("global and private message histories stay separate", () => {
    render();
    receive("public", "bob", undefined, "A public message");
    receive("alice-in", "alice", "self", "Alice private incoming");
    receive("alice-out", "self", "alice", "Alice private outgoing");
    receive("bob-private", "bob", "self", "Bob private incoming");
    receive("unrelated", "bob", "carol", "Someone else's private message");
    openConversation();
    expect(container.querySelector('[role="log"]').textContent).toContain(
        "A public message"
    );
    expect(container.querySelector('[role="log"]').textContent).not.toContain(
        "private"
    );
    openConversation("Alice");
    const log = container.querySelector('[role="log"]');
    expect(log.textContent).toContain("Alice private incoming");
    expect(log.textContent).toContain("Alice private outgoing");
    expect(log.textContent).not.toContain("A public message");
    expect(log.textContent).not.toContain("Bob private incoming");
    expect(log.textContent).not.toContain("Someone else's private message");
    openConversation("Bob");
    expect(container.querySelector('[role="log"]').textContent).toContain(
        "Bob private incoming"
    );
    expect(container.querySelector('[role="log"]').textContent).not.toContain(
        "Someone else's private message"
    );
});

test("drafts belong to each conversation and search does not change them", () => {
    render();
    openConversation();
    type("Lobby draft");
    openConversation("Alice");
    expect(input().value).toBe("");
    type("Private draft");
    openSearch();
    type("bob");
    click(button("Message Bob"));
    expect(input().value).toBe("");
    openConversation("Alice");
    expect(input().value).toBe("Private draft");
    openConversation();
    expect(input().value).toBe("Lobby draft");
    expect(social.sendMessage).not.toHaveBeenCalled();
});

test("a departed recipient cannot cause a private draft to be sent globally", () => {
    render();
    openConversation("Alice");
    type("Keep this private");
    social.players = social.players.filter((player) => player.id !== "alice");
    render();
    submit();
    expect(social.sendMessage).not.toHaveBeenCalled();
    expect(input().value).toBe("Keep this private");
    expect(selector().getAttribute("aria-label")).toContain("Alice");
});

test("a DM from someone outside the nearby roster can still be opened safely", () => {
    render();
    openPicker();
    social.messages = [
        {
            id: "off-roster-dm",
            sessionId: "dana",
            recipientId: "self",
            name: "Dana",
            avatar: "/dana.png",
            text: "Hello from across the space",
            sentAt: 100,
        },
    ];
    render();
    expect(button("Message Dana")).not.toBeNull();
    expect(
        button("Message Dana").querySelector(".contact-unread")
    ).not.toBeNull();
    openConversation("Dana");
    expect(container.querySelector('[role="log"]').textContent).toContain(
        "Hello from across the space"
    );
    expect(
        container.querySelector('.chat-input-glyph img[src="/dana.png"]')
    ).not.toBeNull();
    expect(container.querySelector(".chat-unread-dot")).toBeNull();
    type("Reply draft");
    expect(button("Send message").disabled).toBe(true);
    submit();
    expect(social.sendMessage).not.toHaveBeenCalled();
    expect(input().value).toBe("Reply draft");
});

test.each([
    { isComposing: true },
    { keyCode: 229 },
    { repeat: true },
    { ctrlKey: true },
    { metaKey: true },
    { altKey: true },
    { shiftKey: true },
])("IME, repeated, and modified Enter do not submit a message: %p", (extra) => {
    render();
    openConversation("Alice");
    type("Unfinished text");
    const event = new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
        ...extra,
    });
    act(() => input().dispatchEvent(event));
    expect(event.defaultPrevented).toBe(true);
    expect(social.sendMessage).not.toHaveBeenCalled();
    expect(input().value).toBe("Unfinished text");
});

test("incoming messages are unread only in their own conversation", () => {
    render();
    openConversation("Alice");
    receive("alice-in", "alice", "self");
    expect(container.querySelector(".chat-unread-dot")).toBeNull();
    receive("bob-in", "bob", "self");
    expect(container.querySelector(".chat-unread-dot")).not.toBeNull();
    click(selector());
    expect(button("Message Alice").querySelector(".contact-unread")).toBeNull();
    expect(
        button("Message Bob").querySelector(".contact-unread")
    ).not.toBeNull();
    expect(button("Global chat").querySelector(".contact-unread")).toBeNull();
    click(button("Global chat"));
    expect(container.querySelector(".chat-unread-dot")).not.toBeNull();
    openConversation("Bob");
    expect(container.querySelector(".chat-unread-dot")).toBeNull();
    click(selector());
    social.messages = [...social.messages];
    render();
    expect(button("Message Bob").querySelector(".contact-unread")).toBeNull();
    receive("own", "self", "alice");
    expect(container.querySelector(".chat-unread-dot")).toBeNull();
});

test("visible chat follows new messages without flagging them unread", () => {
    render();
    openConversation();
    const log = container.querySelector<HTMLElement>('[role="log"]');
    Object.defineProperty(log, "scrollHeight", {
        configurable: true,
        value: 400,
    });
    receive("public", "alice");
    expect(log.scrollTop).toBe(400);
    expect(container.querySelector(".chat-unread-dot")).toBeNull();
});

test("reading older messages preserves position and unread until scrolling to the bottom", () => {
    render();
    openConversation("Alice");
    const log = container.querySelector<HTMLElement>('[role="log"]');
    Object.defineProperties(log, {
        scrollHeight: { configurable: true, value: 600 },
        clientHeight: { configurable: true, value: 200 },
    });
    act(() => {
        log.scrollTop = 100;
        log.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    receive("alice-new", "alice", "self");
    expect(log.scrollTop).toBe(100);
    expect(container.querySelector(".chat-unread-dot")).not.toBeNull();
    act(() => {
        log.scrollTop = 400;
        log.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    expect(container.querySelector(".chat-unread-dot")).toBeNull();
});

test("hidden and closed conversations keep incoming messages unread until visible", () => {
    render();
    openConversation();
    hidden = true;
    render();
    receive("while-avatar-open", "alice");
    expect(container.querySelector(".chat-unread-dot")).not.toBeNull();
    hidden = false;
    render();
    expect(container.querySelector(".chat-unread-dot")).toBeNull();
    act(() => setOpen(false));
    receive("while-closed", "alice");
    expect(container.querySelector(".chat-unread-dot")).not.toBeNull();
    act(() => setOpen(true));
    expect(container.querySelector(".chat-unread-dot")).toBeNull();
});

test("messages received in a background tab stay unread until the tab is visible", () => {
    const documentHidden = jest.spyOn(document, "hidden", "get");
    try {
        documentHidden.mockReturnValue(false);
        render();
        openConversation("Alice");
        documentHidden.mockReturnValue(true);
        act(() => document.dispatchEvent(new Event("visibilitychange")));
        receive("while-backgrounded", "alice", "self");
        expect(container.querySelector(".chat-unread-dot")).not.toBeNull();
        documentHidden.mockReturnValue(false);
        act(() => document.dispatchEvent(new Event("visibilitychange")));
        expect(container.querySelector(".chat-unread-dot")).toBeNull();
    } finally {
        documentHidden.mockRestore();
    }
});

test("inline messages retain profile pictures, initials, and own-message labels", () => {
    render();
    receive("alice-in", "alice", "self", "Small inline message");
    receive("own", "self", "alice", "My message");
    openConversation("Alice");
    const rows = container.querySelectorAll(".chat-message");
    expect(rows[0].querySelector(".chat-line").textContent).toBe(
        "Alice: Small inline message"
    );
    expect(rows[1].querySelector(".chat-line").textContent).toBe(
        "You: My message"
    );
    const photo = rows[0].querySelector("img");
    expect(photo.getAttribute("src")).toBe("/alice.png");
    act(() => photo.dispatchEvent(new Event("error")));
    expect(photo.getAttribute("src")).toBe(LOBBY_GUEST_PORTRAIT);
    expect(photo.style.display).toBe("");
    act(() => photo.dispatchEvent(new Event("error")));
    expect(photo.style.display).toBe("none");
    expect(rows[0].querySelector(".chat-avatar").textContent).toBe("A");
    expect(rows[1].querySelector("img")).toBeNull();
});

test("a new session resets the selected person and private draft", () => {
    render();
    openConversation("Alice");
    type("Old session draft");
    social.sessionId = "new-self";
    social.players = social.players.map((player) =>
        player.isLocal ? { ...player, id: "new-self" } : player
    );
    render();
    expect(button("Global chat")).toBeNull();
    expect(input().getAttribute("aria-label")).toBe("Message the lobby");
    expect(selector().getAttribute("aria-label")).toContain("Global");
    openConversation("Alice");
    expect(input().value).toBe("");
});

test("Escape closes the picker from a contact and restores the message input", () => {
    render();
    openPicker();
    act(() => button("Message Alice").focus());
    const escape = new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
    });
    act(() => button("Message Alice").dispatchEvent(escape));
    expect(escape.defaultPrevented).toBe(true);
    expect(button("Message Alice")).toBeNull();
    expect(input().getAttribute("aria-label")).toBe("Message the lobby");
    expect(document.activeElement).toBe(input());
});

test("Escape closes a conversation without discarding its draft", () => {
    render();
    openConversation("Alice");
    type("Saved draft");
    act(() =>
        input().dispatchEvent(
            new KeyboardEvent("keydown", {
                key: "Escape",
                bubbles: true,
                cancelable: true,
            })
        )
    );
    expect(container.querySelector('[role="log"]')).toBeNull();
    expect(document.activeElement).toBe(selector());
    openConversation("Alice");
    expect(input().value).toBe("Saved draft");
});

test("arrow and boundary keys navigate the horizontal contact pills", () => {
    render();
    openPicker();
    act(() => button("Global chat").focus());
    const key = (value: string) =>
        act(() =>
            document.activeElement.dispatchEvent(
                new KeyboardEvent("keydown", {
                    key: value,
                    bubbles: true,
                    cancelable: true,
                })
            )
        );
    key("ArrowRight");
    expect(document.activeElement).toBe(button("Message Alice"));
    key("End");
    expect(document.activeElement).toBe(button("Message Carol"));
    key("ArrowLeft");
    expect(document.activeElement).toBe(button("Message Bob"));
    key("Home");
    expect(document.activeElement).toBe(button("Global chat"));
});

const pressKey = (
    key: string,
    target: Element = document.activeElement,
    extra: KeyboardEventInit = {}
) => {
    const event = new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
        ...extra,
    });
    act(() => target.dispatchEvent(event));
    return event;
};
/** The list sits above the input: Down walks the rows, then lands in search. */
const backToSearch = () => {
    let event: KeyboardEvent;
    for (let step = 0; step < 12 && document.activeElement !== input(); step++)
        event = pressKey("ArrowDown");
    return event;
};
const pressTab = (target: Element = input(), extra: KeyboardEventInit = {}) =>
    pressKey("Tab", target, extra);

test.each([
    ["Global", "input"],
    ["Global", "dropdown"],
    ["Alice", "input"],
    ["Alice", "dropdown"],
])(
    "Tab from the %s conversation %s opens the picker at the selected pill",
    (name, control) => {
        render();
        receive("recent-bob", "bob", "self", "Hello", 300);
        openConversation(name);
        type(`${name} draft`);
        const target = control === "input" ? input() : selector();
        act(() => target.focus());
        expect(pressTab(target).defaultPrevented).toBe(true);
        expect(input().getAttribute("aria-label")).toBe(
            "Search people in this lobby"
        );
        expect(selector().getAttribute("aria-pressed")).toBe("true");
        expect(document.activeElement).toBe(
            button(name === "Global" ? "Global chat" : `Message ${name}`)
        );
        expect(selector().getAttribute("aria-label")).toBe(
            `Current conversation: ${name}. Choose conversation`
        );
        expect(container.querySelector('[role="log"]')).toBeNull();
        click(document.activeElement);
        expect(input().value).toBe(`${name} draft`);
        expect(document.activeElement).toBe(input());
        expect(social.sendMessage).not.toHaveBeenCalled();
    }
);

test("arrows browse pills and native Enter opens the focused conversation", () => {
    render();
    openConversation("Alice");
    type("Alice draft");
    pressTab();
    expect(document.activeElement).toBe(button("Message Alice"));
    expect(pressKey("ArrowRight").defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(button("Message Bob"));
    expect(selector().getAttribute("aria-label")).toContain("Alice");
    expect(pressKey("Enter").defaultPrevented).toBe(false);
    // jsdom does not synthesize a native button's click for Enter.
    click(document.activeElement);
    expect(input().getAttribute("aria-label")).toBe("Message Bob");
    expect(document.activeElement).toBe(input());
    expect(input().value).toBe("");
    expect(
        container.querySelector('[role="log"]').getAttribute("aria-label")
    ).toBe("Messages with Bob");
    pressTab();
    pressKey("ArrowLeft");
    click(document.activeElement);
    expect(input().getAttribute("aria-label")).toBe("Message Alice");
    expect(input().value).toBe("Alice draft");
    expect(social.sendMessage).not.toHaveBeenCalled();
});

test("Down goes to search and Up returns to the selected conversation without changing its draft", () => {
    render();
    openConversation("Alice");
    type("Alice draft");
    pressTab();
    pressKey("ArrowRight");
    expect(document.activeElement).toBe(button("Message Bob"));
    expect(backToSearch().defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(input());
    expect(input().getAttribute("aria-label")).toBe(
        "Search people in this lobby"
    );
    expect(selector().getAttribute("aria-label")).toContain("Alice");
    expect(pressKey("ArrowUp").defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(button("Message Alice"));
    click(document.activeElement);
    expect(input().value).toBe("Alice draft");
    expect(social.sendMessage).not.toHaveBeenCalled();
});

test("Up and Down move through the vertical chat list", () => {
    render();
    openPicker();
    act(() => button("Global chat").focus());
    expect(pressKey("ArrowDown").defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(button("Message Alice"));
    pressKey("ArrowDown");
    expect(document.activeElement).toBe(button("Message Bob"));
    expect(pressKey("ArrowUp").defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(button("Message Alice"));
    pressKey("ArrowUp");
    pressKey("ArrowUp");
    expect(document.activeElement).toBe(button("Global chat"));
    expect(selector().getAttribute("aria-label")).toContain("Global");
    expect(social.sendMessage).not.toHaveBeenCalled();
});

test.each([
    ["bOb", "Message Bob"],
    ["a", "Message Alice"],
    ["nobody matches", "Global chat"],
])("Up from search %s focuses %s without selecting it", (query, label) => {
    render();
    openConversation("Carol");
    type("Carol draft");
    pressTab();
    backToSearch();
    type(query);
    expect(pressKey("ArrowUp").defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(button(label));
    expect(input().value).toBe(query);
    expect(selector().getAttribute("aria-label")).toContain("Carol");
    expect(social.sendMessage).not.toHaveBeenCalled();
});

test("Tab from the open picker input retains native navigation and the search", () => {
    render();
    openSearch();
    type("bOb");
    act(() => input().focus());
    expect(pressTab(input()).defaultPrevented).toBe(false);
    expect(input().getAttribute("aria-label")).toBe(
        "Search people in this lobby"
    );
    expect(input().value).toBe("bOb");
    expect(button("Message Bob")).not.toBeNull();
    expect(selector().getAttribute("aria-label")).toContain("Global");
    expect(social.sendMessage).not.toHaveBeenCalled();
});

test("search presses the people toggle and leaves search Tab navigation native", () => {
    render();
    openSearch();
    type("bOb");
    expect(selector().getAttribute("aria-pressed")).toBe("true");
    act(() => input().focus());
    expect(pressTab(input()).defaultPrevented).toBe(false);
    expect(input().value).toBe("bOb");
    expect(selector().getAttribute("aria-label")).toContain("Global");
    expect(social.sendMessage).not.toHaveBeenCalled();
});

test.each([
    { shiftKey: true },
    { ctrlKey: true },
    { altKey: true },
    { metaKey: true },
    { isComposing: true },
    { keyCode: 229 },
    { repeat: true },
])("modified, composing, and repeated Tab remain untouched: %p", (extra) => {
    render();
    openConversation("Alice");
    type("Keep this draft");
    for (const target of [input(), selector()]) {
        act(() => target.focus());
        expect(pressTab(target, extra).defaultPrevented).toBe(false);
        expect(input().getAttribute("aria-label")).toBe("Message Alice");
        expect(input().value).toBe("Keep this draft");
        expect(document.activeElement).toBe(target);
    }
    expect(social.sendMessage).not.toHaveBeenCalled();
});

test.each([
    { shiftKey: true },
    { ctrlKey: true },
    { altKey: true },
    { metaKey: true },
    { isComposing: true },
    { keyCode: 229 },
])("modified and composing Up/Down retain native behavior: %p", (extra) => {
    render();
    openPicker();
    const contact = button("Message Alice");
    act(() => contact.focus());
    expect(pressKey("ArrowDown", contact, extra).defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(contact);
    act(() => input().focus());
    type("bob");
    act(() => input().focus());
    expect(pressKey("ArrowUp", input(), extra).defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(input());
    expect(input().value).toBe("bob");
    expect(selector().getAttribute("aria-label")).toContain("Global");
    expect(social.sendMessage).not.toHaveBeenCalled();
});

test("Tab on contact pills retains normal keyboard navigation", () => {
    render();
    openPicker();
    const contact = button("Message Alice");
    act(() => contact.focus());
    expect(pressTab(contact).defaultPrevented).toBe(false);
    expect(input().getAttribute("aria-label")).toBe(
        "Search people in this lobby"
    );
    expect(selector().getAttribute("aria-label")).toContain("Global");
    expect(social.sendMessage).not.toHaveBeenCalled();
});

test("Tab on the selector reopens the picker after Escape without discarding a draft", () => {
    render();
    openConversation("Alice");
    type("Private draft");
    act(() =>
        input().dispatchEvent(
            new KeyboardEvent("keydown", {
                key: "Escape",
                bubbles: true,
                cancelable: true,
            })
        )
    );
    expect(document.activeElement).toBe(selector());
    expect(container.querySelector('[role="log"]')).toBeNull();
    expect(pressTab(selector()).defaultPrevented).toBe(true);
    expect(selector().getAttribute("aria-label")).toContain("Alice");
    expect(container.querySelector('[role="log"]')).toBeNull();
    expect(button("Global chat")).not.toBeNull();
    expect(document.activeElement).toBe(button("Message Alice"));
    click(button("Message Alice"));
    expect(input().value).toBe("Private draft");
    expect(social.sendMessage).not.toHaveBeenCalled();
});

// Search-to-people navigation keeps the current conversation unchanged until
// the user activates a focused pill with Enter or a click.
test("Right from empty search focuses the first user without opening a chat", () => {
    render();
    openSearch();
    act(() => input().focus());
    expect(pressKey("ArrowRight").defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(button("Message Alice"));
    expect(input().getAttribute("aria-label")).toBe(
        "Search people in this lobby"
    );
    expect(input().value).toBe("");
    expect(selector().getAttribute("aria-label")).toContain("Global");
    expect(container.querySelector('[role="log"]')).toBeNull();
    expect(social.sendMessage).not.toHaveBeenCalled();
});

test("Down to search then Right resumes from the last focused person", () => {
    render();
    openConversation("Alice");
    type("Alice draft");
    pressTab();
    pressKey("ArrowRight");
    expect(document.activeElement).toBe(button("Message Bob"));
    backToSearch();
    expect(document.activeElement).toBe(input());
    expect(pressKey("ArrowRight").defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(button("Message Carol"));
    expect(selector().getAttribute("aria-label")).toContain("Alice");
    expect(pressKey("Enter").defaultPrevented).toBe(false);
    // jsdom does not synthesize a native button's click for Enter.
    click(document.activeElement);
    expect(input().getAttribute("aria-label")).toBe("Message Carol");
    openConversation("Alice");
    expect(input().value).toBe("Alice draft");
    expect(social.sendMessage).not.toHaveBeenCalled();
});

test("Left from search resumes from the last focused person", () => {
    render();
    openPicker();
    act(() => button("Message Carol").focus());
    backToSearch();
    expect(pressKey("ArrowLeft").defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(button("Message Bob"));
    expect(selector().getAttribute("aria-label")).toContain("Global");
    expect(social.sendMessage).not.toHaveBeenCalled();
});

test.each([
    ["ArrowRight", "a", "Alice"],
    ["ArrowLeft", "a", "Carol"],
    ["ArrowRight", "bOb", "Bob"],
    ["ArrowLeft", "bOb", "Bob"],
])(
    "%s from filtered search %s focuses %s and keeps the query",
    (key, query, name) => {
        render();
        openPicker();
        act(() => button("Global chat").focus());
        backToSearch();
        type(query);
        expect(pressKey(key).defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(button(`Message ${name}`));
        expect(input().value).toBe(query);
        expect(selector().getAttribute("aria-label")).toContain("Global");
        expect(container.querySelector('[role="log"]')).toBeNull();
        expect(social.sendMessage).not.toHaveBeenCalled();
    }
);

test("search navigation falls back to its first match when the last focused user is filtered out", () => {
    render();
    openPicker();
    act(() => button("Message Bob").focus());
    backToSearch();
    type("a");
    expect(pressKey("ArrowRight").defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(button("Message Alice"));
    expect(input().value).toBe("a");
    expect(selector().getAttribute("aria-label")).toContain("Global");
    expect(social.sendMessage).not.toHaveBeenCalled();
});

test.each(["ArrowRight", "ArrowLeft"])(
    "%s leaves focus and the query alone when search has no matches",
    (key) => {
        render();
        openSearch();
        type("nobody matches");
        act(() => input().focus());
        expect(pressKey(key).defaultPrevented).toBe(false);
        expect(document.activeElement).toBe(input());
        expect(input().value).toBe("nobody matches");
        expect(selector().getAttribute("aria-label")).toContain("Global");
        expect(social.sendMessage).not.toHaveBeenCalled();
    }
);

test.each([
    { shiftKey: true },
    { ctrlKey: true },
    { altKey: true },
    { metaKey: true },
    { isComposing: true },
    { keyCode: 229 },
])(
    "modified and composing horizontal arrows remain native in search: %p",
    (extra) => {
        render();
        openSearch();
        type("a");
        for (const key of ["ArrowRight", "ArrowLeft"]) {
            act(() => input().focus());
            expect(pressKey(key, input(), extra).defaultPrevented).toBe(false);
            expect(document.activeElement).toBe(input());
            expect(input().value).toBe("a");
        }
        expect(selector().getAttribute("aria-label")).toContain("Global");
        expect(social.sendMessage).not.toHaveBeenCalled();
    }
);

test("horizontal arrows in the message input keep editing the current draft", () => {
    render();
    openConversation("Alice");
    type("Keep editing this message");
    for (const key of ["ArrowRight", "ArrowLeft"]) {
        expect(pressKey(key, input()).defaultPrevented).toBe(false);
        expect(document.activeElement).toBe(input());
        expect(input().value).toBe("Keep editing this message");
    }
    expect(selector().getAttribute("aria-label")).toContain("Alice");
    expect(button("Global chat")).toBeNull();
    expect(social.sendMessage).not.toHaveBeenCalled();
});

test("contact boundary keys scroll the focused user into view", () => {
    render();
    openPicker();
    const lastPerson = button("Message Carol");
    lastPerson.scrollIntoView = jest.fn();
    act(() => button("Global chat").focus());
    pressKey("End");
    expect(document.activeElement).toBe(lastPerson);
    expect(lastPerson.scrollIntoView).toHaveBeenCalledWith({
        block: "nearest",
        inline: "nearest",
    });
    pressKey("ArrowRight");
    expect(document.activeElement).toBe(lastPerson);
    pressKey("Home");
    expect(document.activeElement).toBe(button("Global chat"));
});

test("wheel movement over people stays in the picker without choosing a conversation", () => {
    render();
    openPicker();
    const people = container.querySelector<HTMLDivElement>(".chat-contacts");
    act(() =>
        people.dispatchEvent(
            new WheelEvent("wheel", { deltaY: 90, bubbles: true })
        )
    );
    expect(selector().getAttribute("aria-label")).toContain("Global");
    expect(input().getAttribute("aria-label")).toBe(
        "Search people in this lobby"
    );
    expect(social.sendMessage).not.toHaveBeenCalled();
});

const hover = (target: Element) => act(() => Simulate.mouseEnter(target));
const nativeTab = (
    target: EventTarget = window,
    extra: KeyboardEventInit = {}
) => {
    const event = new KeyboardEvent("keydown", {
        key: "Tab",
        bubbles: true,
        cancelable: true,
        ...extra,
    });
    act(() => target.dispatchEvent(event));
    return event;
};
const preview = (label: string) =>
    button(label)?.querySelector<HTMLElement>(".contact-last");

test("keyboard browsing and hover keep each row's own latest message", () => {
    render();
    openConversation("Alice");
    receive("alice-preview", "alice", "self", "Alice preview", 100);
    receive("bob-preview", "bob", "self", "Bob preview", 200);
    pressTab();
    expect(document.activeElement).toBe(button("Message Alice"));
    hover(button("Message Bob"));
    expect(preview("Message Bob").textContent).toBe("Bob: Bob preview");
    expect(document.activeElement).toBe(button("Message Alice"));
    pressKey("ArrowLeft");
    pressKey("ArrowRight");
    expect(document.activeElement).toBe(button("Message Alice"));
    expect(preview("Message Alice").textContent).toBe("Alice: Alice preview");
});

test("hovering the selector makes its Tab tooltip work from the world", () => {
    render();
    openConversation("Alice");
    type("Keep Alice draft");
    act(() => input().blur());
    hover(selector());
    expect(nativeTab().defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(button("Message Alice"));
    expect(input().getAttribute("aria-label")).toBe(
        "Search people in this lobby"
    );
    expect(selector().getAttribute("aria-label")).toContain("Alice");
    click(button("Message Alice"));
    expect(input().value).toBe("Keep Alice draft");
    expect(social.sendMessage).not.toHaveBeenCalled();
});

test("hovering the selector and pressing Tab opens the inline picker from the world", () => {
    render();
    hover(selector());
    expect(nativeTab().defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(button("Global chat"));
    expect(container.querySelector('[role="log"]')).toBeNull();
    expect(social.sendMessage).not.toHaveBeenCalled();
});

test("leaving the selector restores native Tab navigation from the world", () => {
    render();
    hover(selector());
    act(() => Simulate.mouseLeave(selector()));
    expect(nativeTab().defaultPrevented).toBe(false);
    expect(document.activeElement).not.toBe(button("Global chat"));
});

test.each([
    { shiftKey: true },
    { ctrlKey: true },
    { altKey: true },
    { metaKey: true },
    { isComposing: true },
    { keyCode: 229 },
    { repeat: true },
])(
    "the hovered selector leaves modified or composing Tab untouched: %p",
    (extra) => {
        render();
        hover(selector());
        expect(nativeTab(window, extra).defaultPrevented).toBe(false);
        expect(document.activeElement).not.toBe(button("Global chat"));
    }
);

test.each([
    '<input aria-label="Other input" />',
    '<textarea aria-label="Other text area"></textarea>',
    '<select aria-label="Other select"><option>Choice</option></select>',
    '<div contenteditable="true" tabindex="0">Editor</div>',
    '<div role="dialog"><button>Dialog action</button></div>',
    '<div role="menu"><button>Menu action</button></div>',
])(
    "hovering the selector does not capture Tab from another control: %s",
    (markup) => {
        render();
        hover(selector());
        const outside = document.createElement("div");
        outside.innerHTML = markup;
        document.body.append(outside);
        try {
            const target = outside.querySelector<HTMLElement>(
                "button,input,textarea,select,[contenteditable]"
            );
            act(() => target.focus());
            expect(nativeTab(target).defaultPrevented).toBe(false);
            expect(document.activeElement).toBe(target);
            expect(container.querySelector('[role="log"]')).toBeNull();
        } finally {
            outside.remove();
        }
    }
);

test("hidden lobby controls do not capture Tab while their selector was hovered", () => {
    render();
    hover(selector());
    hidden = true;
    render();
    expect(nativeTab().defaultPrevented).toBe(false);
    expect(document.activeElement).not.toBe(button("Global chat"));
});

test("each conversation row shows only its own latest message", () => {
    render();
    openPicker();
    receive("alice-old", "alice", "self", "Old Alice message", 100);
    receive("alice-in", "alice", "self", "Latest incoming Alice", 200);
    receive("alice-out", "self", "alice", "Latest outgoing Alice", 300);
    receive("bob-private", "bob", "self", "Bob secret", 400);
    receive("unrelated", "bob", "carol", "Unrelated secret", 500);
    receive("public", "carol", undefined, "Lobby announcement", 600);
    expect(preview("Message Alice").textContent).toBe(
        "You: Latest outgoing Alice"
    );
    expect(preview("Message Bob").textContent).toBe("Bob: Bob secret");
    expect(preview("Message Carol").textContent).toBe("Say hello");
    expect(preview("Global chat").textContent).toBe(
        "Carol: Lobby announcement"
    );
    expect(container.textContent).not.toContain("Unrelated secret");
    expect(container.querySelector('[role="log"]')).toBeNull();
    expect(selector().getAttribute("aria-label")).toContain("Global");
    expect(social.sendMessage).not.toHaveBeenCalled();
});

test("keyboard browsing does not change the conversation or mark messages read", () => {
    render();
    openConversation("Alice");
    type("Alice draft to preserve");
    receive("bob-preview", "bob", "self", "Bob preview text", 200);
    receive("carol-preview", "carol", "self", "Carol preview text", 100);
    pressTab();
    act(() => button("Message Bob").focus());
    expect(preview("Message Bob").textContent).toContain("Bob preview text");
    expect(
        button("Message Bob").querySelector(".contact-unread")
    ).not.toBeNull();
    expect(pressKey("ArrowRight").defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(button("Message Carol"));
    expect(preview("Message Carol").textContent).toContain(
        "Carol preview text"
    );
    expect(
        button("Message Carol").querySelector(".contact-unread")
    ).not.toBeNull();
    expect(selector().getAttribute("aria-label")).toContain("Alice");
    expect(container.querySelector('[role="log"]')).toBeNull();
    click(button("Message Alice"));
    expect(input().value).toBe("Alice draft to preserve");
    expect(social.sendMessage).not.toHaveBeenCalled();
});

test("the Global row shows its latest public message, never a private one", () => {
    render();
    openPicker();
    receive("public-old", "alice", undefined, "Old announcement", 100);
    receive("public-in", "bob", undefined, "Recent announcement", 200);
    receive("public-own", "self", undefined, "My public message", 300);
    receive("private", "alice", "self", "Private reply", 400);
    expect(preview("Global chat").textContent).toBe("You: My public message");
    expect(
        button("Global chat").querySelector(".contact-unread")
    ).not.toBeNull();
});

test("searching keeps matching rows with their latest messages", () => {
    render();
    openSearch();
    receive("alice-preview", "alice", "self", "Alice preview", 100);
    receive("bob-preview", "bob", "self", "Bob preview", 200);
    type("bOb");
    expect(button("Message Alice")).toBeNull();
    expect(preview("Message Bob").textContent).toContain("Bob preview");
    expect(selector().getAttribute("aria-label")).toContain("Global");
    expect(input().value).toBe("bOb");
});

test("a conversation without messages invites a hello", () => {
    render();
    openPicker();
    expect(preview("Message Carol").textContent).toBe("Say hello");
    expect(preview("Global chat").textContent).toBe("Everyone in this lobby");
    expect(selector().getAttribute("aria-label")).toContain("Global");
});

test("a departed person's received messages remain visible in the list without opening the conversation", () => {
    render();
    openPicker();
    receive("alice-away", "alice", "self", "Alice before leaving", 100);
    social.players = social.players.filter((person) => person.id !== "alice");
    render();
    expect(preview("Message Alice").textContent).toContain(
        "Alice before leaving"
    );
    expect(button("Message Alice").textContent).toContain("Away");
    expect(
        button("Message Alice").querySelector(".contact-unread")
    ).not.toBeNull();
    expect(container.querySelector('[role="log"]')).toBeNull();
    expect(social.sendMessage).not.toHaveBeenCalled();
});

test("a new session clears the previous private conversation from the list", () => {
    render();
    openPicker();
    receive(
        "old-session-private",
        "alice",
        "self",
        "Old session private text",
        100
    );
    expect(preview("Message Alice").textContent).toContain(
        "Old session private text"
    );
    social.sessionId = "new-self";
    social.players = social.players.map((person) =>
        person.isLocal ? { ...person, id: "new-self" } : person
    );
    render();
    expect(button("Global chat")).toBeNull();
    openPicker();
    expect(container.textContent).not.toContain("Old session private text");
    expect(selector().getAttribute("aria-label")).toContain("Global");
});

test("arrival shows the chat switcher, with the current conversation, to the left of the message input", () => {
    render();
    const messageInput = input();
    expect(messageInput.getAttribute("aria-label")).toBe("Message the lobby");
    expect(document.activeElement).not.toBe(messageInput);
    expect(selector().getAttribute("aria-pressed")).toBe("false");
    expect(selector().querySelector(".chat-input-glyph")).not.toBeNull();
    expect(
        selector().compareDocumentPosition(messageInput) &
            Node.DOCUMENT_POSITION_FOLLOWING
    ).not.toBe(0);
    expect(button("Global chat")).toBeNull();
    expect(container.querySelector('[role="log"]')).toBeNull();
    act(() => messageInput.focus());
    expect(container.querySelector('[role="log"]')).not.toBeNull();
    expect(document.activeElement).toBe(messageInput);
});

test("the people toggle turns the composer into search with results above it", () => {
    render();
    const composer = container.querySelector("form.chat-composer");
    openPicker();
    expect(container.querySelector("form.chat-composer")).toBe(composer);
    expect(composer.getAttribute("data-mode")).toBe("search");
    expect(selector().getAttribute("aria-pressed")).toBe("true");
    expect(button("Show more people")).toBeNull();
    expect(input().getAttribute("aria-label")).toBe(
        "Search people in this lobby"
    );
    expect(document.activeElement).toBe(input());
    expect(composer.contains(button("Message Alice"))).toBe(false);
    expect(
        container.querySelector(".chat-view").contains(button("Message Alice"))
    ).toBe(true);
    expect(container.querySelector(".chat-view").contains(composer)).toBe(
        false
    );
    type("bOb");
    expect(button("Message Alice")).toBeNull();
    expect(button("Message Bob")).not.toBeNull();
    click(button("Message Bob"));
    expect(container.querySelector("form.chat-composer")).toBe(composer);
    expect(input().getAttribute("aria-label")).toBe("Message Bob");
    expect(selector().getAttribute("aria-pressed")).toBe("false");
    expect(social.sendMessage).not.toHaveBeenCalled();
});

test.each(["Escape", "people toggle"])(
    "%s leaves search in one step, restoring the selected conversation and draft",
    (action) => {
        render();
        openConversation("Alice");
        type("Unsent Alice draft");
        openSearch();
        type("bOb");
        expect(button("Message Alice")).toBeNull();
        if (action === "Escape")
            expect(pressKey("Escape", input()).defaultPrevented).toBe(true);
        else click(selector());
        expect(input().getAttribute("aria-label")).toBe("Message Alice");
        expect(input().value).toBe("Unsent Alice draft");
        expect(document.activeElement).toBe(input());
        expect(container.querySelector('[role="log"]')).not.toBeNull();
        expect(button("Global chat")).toBeNull();
        expect(selector().getAttribute("aria-pressed")).toBe("false");
        // Reopening proves that the previous query was cleared.
        click(selector());
        expect(input().value).toBe("");
        expect(button("Message Alice")).not.toBeNull();
        expect(pressKey("Escape", input()).defaultPrevented).toBe(true);
        expect(pressKey("Escape", input()).defaultPrevented).toBe(true);
        expect(container.querySelector('[role="log"]')).toBeNull();
        expect(input().value).toBe("Unsent Alice draft");
        expect(social.sendMessage).not.toHaveBeenCalled();
    }
);

test("Enter in search opens the highlighted person", () => {
    render();
    openSearch();
    type("bOb");
    expect(pressKey("Enter", input()).defaultPrevented).toBe(true);
    expect(input().getAttribute("aria-label")).toBe("Message Bob");
    expect(
        container.querySelector(".chat-thread-heading").textContent
    ).toContain("Bob");
    expect(social.sendMessage).not.toHaveBeenCalled();
});

test("the DM header names the person and its close button returns to the room", () => {
    render();
    openConversation("Alice");
    type("Alice draft");
    const heading = container.querySelector(".chat-thread-heading");
    expect(heading.textContent).toContain("Alice");
    expect(heading.textContent).toContain("Direct message");
    click(button("Back to Global chat"));
    expect(container.querySelector(".chat-thread-heading")).toBeNull();
    expect(input().getAttribute("aria-label")).toBe("Message the lobby");
    openConversation("Alice");
    expect(input().value).toBe("Alice draft");
});

test("Down from a filtered result returns focus to the already open search input", () => {
    render();
    openSearch();
    type("a");
    expect(pressKey("ArrowUp", input()).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(button("Message Alice"));
    expect(backToSearch().defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(input());
    expect(input().value).toBe("a");
    expect(selector().getAttribute("aria-label")).toContain("Global");
    expect(social.sendMessage).not.toHaveBeenCalled();
});

test.each([true, false])(
    "clicking outside the picker restores the draft, retains log visibility %s, and keeps outside focus",
    (logWasOpen) => {
        render();
        openConversation("Alice");
        type("Private Alice draft");
        if (!logWasOpen) pressKey("Escape", input());
        openSearch();
        type("bOb");
        const outside = document.createElement("button");
        outside.textContent = "Other action";
        document.body.append(outside);
        try {
            act(() => {
                outside.dispatchEvent(
                    new MouseEvent("pointerdown", { bubbles: true })
                );
                outside.focus();
            });
            expect(input().getAttribute("aria-label")).toBe("Message Alice");
            expect(input().value).toBe("Private Alice draft");
            expect(button("Global chat")).toBeNull();
            expect(selector().getAttribute("aria-label")).toContain("Alice");
            expect(!!container.querySelector('[role="log"]')).toBe(logWasOpen);
            expect(document.activeElement).toBe(outside);
            expect(social.sendMessage).not.toHaveBeenCalled();
        } finally {
            outside.remove();
        }
    }
);

test("an empty conversation selector is disabled and leaves public typing and Tab navigation available", () => {
    social.players = [social.players[0]];
    render();
    expect(selector().disabled).toBe(true);
    expect(selector().getAttribute("aria-label")).toBe(
        "Current conversation: Global"
    );
    expect(selector().getAttribute("aria-keyshortcuts")).toBeNull();
    expect(container.querySelector(".chat-chevron")).toBeNull();
    expect(container.querySelector('[role="tooltip"]')).toBeNull();
    click(selector());
    expect(button("Global chat")).toBeNull();
    act(() => setOpen(true));
    type("Public draft");
    expect(pressTab().defaultPrevented).toBe(false);
    expect(input().value).toBe("Public draft");
    expect(button("Global chat")).toBeNull();
});

test("conversation switching enables when someone arrives and closes if the final choice leaves", () => {
    social.players = [social.players[0]];
    render();
    expect(selector().disabled).toBe(true);
    social.players = [...social.players, { id: "alice", name: "Alice" }];
    render();
    expect(selector().disabled).toBe(false);
    openPicker();
    expect(button("Message Alice")).not.toBeNull();
    social.players = [social.players[0]];
    render();
    expect(selector().disabled).toBe(true);
    expect(button("Global chat")).toBeNull();
    expect(input()).not.toBeNull();
});

test("saved direct conversations stay accessible after the live roster empties", () => {
    render();
    receive("saved-dm", "alice", "self", "Saved conversation");
    social.players = [social.players[0]];
    render();
    expect(selector().disabled).toBe(false);
    openConversation("Alice");
    expect(container.textContent).toContain("Saved conversation");
    openConversation("Global");
    expect(input().getAttribute("aria-label")).toBe("Message the lobby");
});
