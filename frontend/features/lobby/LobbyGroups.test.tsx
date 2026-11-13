/** @jest-environment jsdom */
import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import LobbyChat from "./LobbyChat";
import LobbyGroupsModal from "./LobbyGroupsModal";
import LobbyGroupNotices from "./LobbyGroupNotices";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const member = (id: string) => ({
    id,
    name: id === "self" ? "Me" : id,
    avatar: "",
    vrmUrl: "",
    scale: 1,
});
const group = {
    id: "g1",
    name: "Moon club",
    ownerId: "self",
    members: [member("self"), member("Alice")],
    joinCode: "code-example",
    messages: [],
};
const click = async (label: string) => {
    const target = Array.from(
        document.querySelectorAll<HTMLButtonElement>("button")
    ).find(
        (button) =>
            button.getAttribute("aria-label") === label ||
            button.textContent.trim() === label
    );
    expect(target).toBeTruthy();
    await act(async () => target.click());
};
const type = (target: HTMLInputElement, value: string) =>
    act(() => {
        target.value = value;
        Simulate.change(target);
    });
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.clearAllMocks();
});

function Chat({
    send = jest.fn(async () => true),
    request,
    onSelect = jest.fn(),
}: any) {
    const [open, setOpen] = useState(true);
    return (
        <LobbyChat
            social={{
                status: "connected",
                sessionId: "self",
                players: [member("Alice")],
                messages: [
                    {
                        id: "public",
                        sessionId: "Alice",
                        name: "Alice",
                        text: "Public hello",
                        sentAt: 1,
                    },
                ],
                sendMessage: jest.fn(),
            }}
            groupConversations={{
                groups: [group],
                messages: [
                    {
                        id: "secret",
                        groupId: "g1",
                        sessionId: "Alice",
                        name: "Alice",
                        avatar: "",
                        text: "Group secret",
                        sentAt: 2,
                    },
                ],
                request,
                onSelect,
                onCreate: jest.fn(),
                onManage: jest.fn(),
                sendMessage: send,
            }}
            open={open}
            onOpenChange={setOpen}
            inputRef={React.createRef()}
            buttonRef={React.createRef()}
            hidden={false}
        />
    );
}
test("group history stays out of Global and DMs, with a separate picker pill", async () => {
    act(() => root.render(<Chat />));
    expect(container.querySelector('[role="log"]').textContent).toContain(
        "Public hello"
    );
    expect(container.textContent).not.toContain("Group secret");
    await click("Current conversation: Global. Choose conversation");
    await click("Party Moon club");
    expect(container.querySelector('[role="log"]').textContent).toContain(
        "Group secret"
    );
    expect(container.querySelector('[role="log"]').textContent).not.toContain(
        "Public hello"
    );
    expect(
        container.querySelector('button[aria-label="Manage Moon club"]')
    ).toBeTruthy();
    await click("Current conversation: Moon club. Choose conversation");
    await click("Message Alice");
    expect(container.querySelector('[role="log"]').textContent).not.toContain(
        "Group secret"
    );
});
test("external group selection opens the correct conversation and sends only to that group", async () => {
    const send = jest.fn(async () => true),
        onSelect = jest.fn();
    await act(async () =>
        root.render(
            <Chat
                send={send}
                onSelect={onSelect}
                request={{ id: "g1", nonce: 1 }}
            />
        )
    );
    const input = container.querySelector("input");
    expect(input.getAttribute("aria-label")).toBe("Message Moon club");
    type(input, "Meet at the moon");
    await act(async () => {
        Simulate.submit(container.querySelector("form"));
    });
    expect(send).toHaveBeenCalledWith("g1", "Meet at the moon");
    expect(input.value).toBe("");
    expect(onSelect).toHaveBeenCalledWith("g1");
});
test("failed group sends preserve the draft", async () => {
    const send = jest.fn(async () => {
        throw new Error("Disconnected");
    });
    await act(async () =>
        root.render(<Chat send={send} request={{ id: "g1", nonce: 1 }} />)
    );
    const input = container.querySelector("input");
    type(input, "Keep this");
    await act(async () => {
        Simulate.submit(container.querySelector("form"));
    });
    expect(input.value).toBe("Keep this");
});
test("create modal selects nearby people and sends invitation IDs, then opens the new group", async () => {
    const action = jest.fn(async () => ({ requestId: "r", groupId: "new" })),
        selected = jest.fn(),
        close = jest.fn();
    act(() =>
        root.render(
            <LobbyGroupsModal
                sessionId="self"
                players={[member("self"), member("Alice"), member("Bob")]}
                action={action}
                onSelected={selected}
                onClose={close}
            />
        )
    );
    type(
        document.querySelector('input[placeholder="Friday explorers"]'),
        "Weekend"
    );
    await click("Invite Alice");
    await click("Create party · 2");
    expect(action).toHaveBeenCalledWith({
        action: "create",
        name: "Weekend",
        memberIds: ["Alice"],
    });
    expect(selected).toHaveBeenCalledWith("new");
    expect(close).toHaveBeenCalled();
});
test("join links require an explicit Join party action", async () => {
    const action = jest.fn(async () => ({ requestId: "r", groupId: "g1" }));
    act(() =>
        root.render(
            <LobbyGroupsModal
                joinCode="code-example"
                sessionId="self"
                players={[]}
                action={action}
                onSelected={jest.fn()}
                onClose={jest.fn()}
            />
        )
    );
    expect(action).not.toHaveBeenCalled();
    await click("Join party");
    expect(action).toHaveBeenCalledWith({
        action: "join",
        code: "code-example",
    });
});
test("modal contains keyboard focus and restores its trigger on Escape", async () => {
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();
    let close: () => void;
    function Modal() {
        const [open, setOpen] = useState(true);
        close = () => setOpen(false);
        return open ? (
            <LobbyGroupsModal
                sessionId="self"
                players={[]}
                action={jest.fn()}
                onSelected={jest.fn()}
                onClose={close}
            />
        ) : null;
    }
    act(() => root.render(<Modal />));
    const first = document.querySelector<HTMLButtonElement>(
        '[aria-label="Close party"]'
    );
    first.focus();
    act(() =>
        first.dispatchEvent(
            new KeyboardEvent("keydown", {
                key: "Tab",
                shiftKey: true,
                bubbles: true,
                cancelable: true,
            })
        )
    );
    expect(document.activeElement).not.toBe(trigger);
    act(() =>
        document.activeElement.dispatchEvent(
            new KeyboardEvent("keydown", {
                key: "Escape",
                bubbles: true,
                cancelable: true,
            })
        )
    );
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
});
const travel = {
    id: "trip",
    initiatorId: "Alice",
    destination: { id: "space", title: "Moon garden", href: "/moon" },
    status: "inviting" as const,
    responses: { self: "pending" as const, Alice: "accepted" as const },
    readyIds: ["Alice"],
    acceptedIds: ["Alice"],
    poses: {},
    expiresAt: Date.now() + 60000,
};
test("travel card asks for consent before preparing, and Stay here explicitly declines", async () => {
    const accept = jest.fn(async () => {}),
        decline = jest.fn(async () => {});
    act(() =>
        root.render(
            <LobbyGroupNotices
                groups={[{ ...group, travel }]}
                invitations={[]}
                sessionId="self"
                action={jest.fn()}
                onSelected={jest.fn()}
                onAccept={accept}
                onDecline={decline}
                onLaunch={jest.fn()}
                onCancel={jest.fn()}
            />
        )
    );
    expect(container.textContent).toContain(
        "Alice is heading to Moon garden. Join them?"
    );
    expect(accept).not.toHaveBeenCalled();
    await click("Stay here");
    expect(decline).toHaveBeenCalledWith("g1", "trip");
    expect(accept).not.toHaveBeenCalled();
});
test("accepting travel targets that invitation and opens group chat", async () => {
    const accept = jest.fn(async () => {}),
        selected = jest.fn();
    act(() =>
        root.render(
            <LobbyGroupNotices
                groups={[{ ...group, travel }]}
                invitations={[]}
                sessionId="self"
                action={jest.fn()}
                onSelected={selected}
                onAccept={accept}
                onDecline={jest.fn()}
                onLaunch={jest.fn()}
                onCancel={jest.fn()}
            />
        )
    );
    await click("Join trip");
    expect(accept).toHaveBeenCalledWith("g1", "trip");
    expect(selected).toHaveBeenCalledWith("g1");
});

test("a trip waiting for a dropped traveller says who, and counts down on the server clock", () => {
    jest.useFakeTimers();
    const now = jest.spyOn(performance, "now").mockReturnValue(5000);
    const waiting = (waitingFor: any[], clock?: any) => {
        act(() =>
            root.render(
                <LobbyGroupNotices
                    groups={[
                        {
                            ...group,
                            travel: {
                                ...travel,
                                status: "preparing",
                                responses: {
                                    self: "accepted",
                                    Alice: "accepted",
                                },
                                acceptedIds: ["Alice", "self"],
                                waitingFor,
                            },
                        },
                    ]}
                    invitations={[]}
                    sessionId="self"
                    clock={clock}
                    action={jest.fn()}
                    onSelected={jest.fn()}
                    onAccept={jest.fn()}
                    onDecline={jest.fn()}
                    onLaunch={jest.fn()}
                    onCancel={jest.fn()}
                />
            )
        );
        return container.querySelector(".notice-status");
    };
    const alice = { id: "Alice", name: "Alice", until: 108_000 };
    // The server said 100s when this browser's clock read 5s.
    const status = waiting([alice], { serverNow: 100_000, receivedAt: 5000 });
    expect(status.textContent).toBe("Waiting for Alice to reconnect… 8s");
    // The seconds are drawn, not announced every tick.
    expect(status.querySelector("[aria-hidden]").textContent).toBe(" 8s");
    now.mockReturnValue(8100);
    act(() => jest.advanceTimersByTime(250));
    expect(status.textContent).toBe("Waiting for Alice to reconnect… 5s");
    now.mockReturnValue(30_000);
    act(() => jest.advanceTimersByTime(250));
    expect(status.textContent).toBe("Waiting for Alice to reconnect… 0s");

    // Without a clock there is no number to show; several people are counted.
    expect(waiting([alice]).textContent).toBe(
        "Waiting for Alice to reconnect…"
    );
    const others = ["Bo", "Cy"].map((name) => ({ ...alice, name }));
    expect(waiting([alice, others[0]]).textContent).toBe(
        "Waiting for Alice and Bo to reconnect…"
    );
    expect(waiting([alice, ...others]).textContent).toBe(
        "Waiting for 3 people to reconnect…"
    );
    // Once everyone is back the ordinary status returns.
    expect(waiting([]).textContent).toBe("2 joining · 1 ready");
    now.mockRestore();
    jest.useRealTimers();
});

test("an accepted member can cancel while the trip is preparing", async () => {
    const cancel = jest.fn(async () => {}),
        decline = jest.fn(async () => {});
    act(() =>
        root.render(
            <LobbyGroupNotices
                groups={[
                    {
                        ...group,
                        travel: {
                            ...travel,
                            status: "preparing",
                            responses: { self: "accepted", Alice: "accepted" },
                            acceptedIds: ["Alice", "self"],
                        },
                    },
                ]}
                invitations={[]}
                sessionId="self"
                action={jest.fn()}
                onSelected={jest.fn()}
                onAccept={jest.fn()}
                onDecline={decline}
                onLaunch={jest.fn()}
                onCancel={cancel}
            />
        )
    );
    await click("Cancel trip");
    expect(cancel).toHaveBeenCalledWith("g1", "trip");
    expect(decline).not.toHaveBeenCalled();
});

test("group management shows each member's current space or travel state", () => {
    const destination = {
        id: "wanimal",
        title: "Wanimal blue",
        href: "/wanimal",
    };
    act(() =>
        root.render(
            <LobbyGroupsModal
                group={{
                    ...group,
                    members: [
                        {
                            ...member("self"),
                            location: { state: "space", destination },
                        },
                        {
                            ...member("Alice"),
                            location: { state: "travelling", destination },
                        },
                    ],
                }}
                players={[]}
                sessionId="self"
                action={jest.fn()}
                onClose={jest.fn()}
                onSelected={jest.fn()}
            />
        )
    );
    const members = document.querySelector('[aria-label="Party members"]');
    expect(members.textContent).toContain("In Wanimal blue");
    expect(members.textContent).toContain("Travelling to Wanimal blue");
});

test("a failed trip answer is explained beside the card, with a Retry that answers again", async () => {
    const accept = jest
        .fn()
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockResolvedValueOnce(undefined);
    act(() =>
        root.render(
            <LobbyGroupNotices
                groups={[{ ...group, travel }]}
                invitations={[]}
                sessionId="self"
                action={jest.fn()}
                onSelected={jest.fn()}
                onAccept={accept}
                onDecline={jest.fn()}
                onLaunch={jest.fn()}
                onCancel={jest.fn()}
            />
        )
    );
    await click("Join trip");
    const alert = container.querySelector('[role="alert"]');
    // The browser's own wording is never shown.
    expect(alert.textContent).toContain("Couldn’t update the party.");
    expect(alert.textContent).not.toContain("fetch");
    await click("Retry");
    expect(accept).toHaveBeenCalledTimes(2);
    expect(accept).toHaveBeenLastCalledWith("g1", "trip");
    expect(container.querySelector('[role="alert"]')).toBeNull();
});

test("a party server explanation is kept as written", async () => {
    const action = jest.fn(async () => {
        throw new Error("This party is full.");
    });
    act(() =>
        root.render(
            <LobbyGroupsModal
                sessionId="self"
                players={[member("self"), member("Alice")]}
                action={action}
                onSelected={jest.fn()}
                onClose={jest.fn()}
            />
        )
    );
    type(
        document.querySelector('input[placeholder="Friday explorers"]'),
        "Weekend"
    );
    await click("Invite Alice");
    await click("Create party · 2");
    expect(document.querySelector('[role="alert"]').textContent).toBe(
        "This party is full."
    );
});
