/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import ExperienceShell, {
    ExperienceIcon,
    ExperienceShellChat,
} from "./ExperienceShell";

import { trackExperienceNavigation } from "@utils/experienceNavigation";
import {
    finishLobbyReturn,
    pendingLobbyReturn,
} from "@utils/lobbyReturnTransition";

jest.mock("@features/landing-carousel/components/Header", () => ({
    __esModule: true,
    default: ({ onHome }) => (
        <header>
            <button onClick={onHome}>Oncyber home</button>
        </header>
    ),
}));

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const exit = jest.fn();
const render = (props = {}) =>
    act(() =>
        root.render(
            <ExperienceShell title="Example world" onExit={exit} {...props} />
        )
    );
const button = (label: string) =>
    container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
const click = (element: Element) =>
    act(() =>
        element.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    );
const makeChat = (patch = {}): ExperienceShellChat => ({
    open: false,
    onToggle: jest.fn(),
    messages: [],
    value: "hello",
    onChange: jest.fn(),
    onSend: jest.fn(),
    ...patch,
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

test("exposes only supplied runtime actions and preserves disabled/active state", () => {
    const actOnWorld = jest.fn();
    render({
        actions: [
            {
                id: "voice",
                label: "Mute microphone",
                icon: "mic",
                active: true,
                onClick: actOnWorld,
            },
            { id: "save", label: "Save", disabled: true, onClick: actOnWorld },
        ],
    });
    expect(button("Avatars")).toBeNull();
    expect(button("Mute microphone").getAttribute("aria-pressed")).toBe("true");
    click(button("Mute microphone"));
    click(button("Save"));
    expect(actOnWorld).toHaveBeenCalledTimes(1);
    click(button("Back to previous world"));
    expect(exit).toHaveBeenCalledTimes(1);
});

test("the connection line sits under the title, in the lobby's words", () => {
    const title = () => container.querySelector(".experience-title");
    render();
    expect(title().textContent).toBe("Example world");
    render({ connection: { state: "connected", count: 12 } });
    expect(title().querySelector(".presence-status").textContent).toBe(
        "12 here"
    );
    render({ connection: { state: "connecting" } });
    expect(title().querySelector(".presence-status").textContent).toBe(
        "Connecting…"
    );
    render({ connection: { state: "offline", reason: "Connection lost." } });
    expect(title().querySelector(".presence-status").textContent).toBe(
        "You’re offline"
    );
    expect(title().querySelector(".presence-reason").textContent).toBe(
        "Connection lost."
    );
    // Under the title: the line, its reason, and the words read aloud.
    expect(
        [...title().children].map(
            (child) =>
                [...child.classList].find((name) =>
                    name.startsWith("presence-")
                ) || child.tagName
        )
    ).toEqual([
        "SPAN",
        "presence-status",
        "presence-reason",
        "presence-announcement",
    ]);
    expect(title().querySelector('[role="status"]').textContent).toBe(
        "You’re offline. Connection lost."
    );
});

test("an offline connection can carry the way back as a button under its reason", () => {
    const rejoin = jest.fn();
    render({
        connection: {
            state: "offline",
            reason: "You were away for a while.",
            action: { label: "Rejoin", onClick: rejoin },
        },
    });
    const title = container.querySelector(".experience-title");
    const action = title.querySelector<HTMLButtonElement>(
        "button.presence-action"
    );
    expect(action.textContent).toBe("Rejoin");
    expect(action.previousElementSibling.textContent).toBe(
        "You were away for a while."
    );
    click(action);
    expect(rejoin).toHaveBeenCalledTimes(1);
    expect(exit).not.toHaveBeenCalled();
});

test("a status about the place itself takes the line instead", () => {
    render({
        status: "Ready to enter",
        connection: { state: "connected", count: 3 },
    });
    const title = container.querySelector(".experience-title");
    expect(title.querySelector("small").textContent).toBe("Ready to enter");
    expect(title.querySelector(".presence-status")).toBeNull();
    render({ connection: {} });
    expect(title.textContent).toBe("Example world");
});

test("the title carries the connection machine's state for tests to wait on", () => {
    render({ connectionState: "connecting" });
    const title = container.querySelector(".experience-title");
    expect(title.getAttribute("data-machine")).toBe("space-connection");
    expect(title.getAttribute("data-state")).toBe("connecting");
    render({});
    expect(title.hasAttribute("data-machine")).toBe(false);
    expect(title.hasAttribute("data-state")).toBe(false);
});

test("sending chat requires a nonempty enabled composer", () => {
    const chat = makeChat();
    render({ chat });
    const send = () =>
        act(() =>
            container
                .querySelector("form")
                .dispatchEvent(
                    new Event("submit", { bubbles: true, cancelable: true })
                )
        );
    send();
    expect(chat.onSend).toHaveBeenCalledTimes(1);
    render({ chat: { ...chat, value: "  " } });
    send();
    render({ chat: { ...chat, disabled: true } });
    send();
    expect(chat.onSend).toHaveBeenCalledTimes(1);
});

test("composer keyboard events do not also trigger runtime shortcuts", () => {
    const runtimeKey = jest.fn();
    const chat = makeChat({ open: true });
    window.addEventListener("keydown", runtimeKey);
    render({ chat });
    const input = container.querySelector("input");
    act(() => {
        input.focus();
        input.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
        );
    });
    expect(chat.onToggle).toHaveBeenCalledTimes(1);
    expect(runtimeKey).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(input);
    window.removeEventListener("keydown", runtimeKey);
});

test("new remote messages mark collapsed history unread and opening clears the mark", () => {
    const chat = makeChat();
    render({ chat });
    const messages = [{ id: "new", name: "A visitor", text: "Hello" }];
    render({ chat: { ...chat, messages } });
    expect(container.textContent).toContain("Unread messages");
    render({ chat: { ...chat, messages, open: true } });
    expect(container.textContent).not.toContain("Unread messages");
    expect(container.querySelector('[role="log"]').textContent).toContain(
        "Hello"
    );
});

test("runtime-provided names and messages are rendered as text", () => {
    render({
        chat: makeChat({
            open: true,
            messages: [
                {
                    id: "one",
                    name: "<img onerror=alert(1)>",
                    text: "<script>alert(1)</script>",
                },
            ],
        }),
    });
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector('[role="log"]').textContent).toContain(
        "<script>alert(1)</script>"
    );
});

test("native and embedded action names use shared masks without changing button behavior", () => {
    const activate = jest.fn();
    const icons = [
        "mic",
        "mic-off",
        "user",
        "smile",
        "users",
        "grid",
        "dashboard",
        "lock",
        "refresh-cw",
        "info",
    ];
    render({
        actions: icons.map((icon) => ({
            id: icon,
            label: icon,
            icon,
            onClick: activate,
            disabled: icon === "lock",
        })),
    });
    for (const icon of icons) {
        const action = button(icon);
        const artwork = action.querySelector<HTMLElement>(
            ".experience-control-icon"
        );
        expect(artwork.style.width).toBe("22px");
        expect(action.querySelector("img")).toBeNull();
        click(action);
    }
    expect(activate).toHaveBeenCalledTimes(9);
    expect(button("lock").disabled).toBe(true);
    expect(
        button("info").querySelector<HTMLElement>("span").style.maskImage
    ).toContain("/icons/generated-v2/info.png");
});

test("utility glyphs retain their established SVG source and explicit sizing", () => {
    act(() =>
        root.render(
            <>
                <ExperienceIcon name="send" size={16} />
                <ExperienceIcon name="x" />
                <ExperienceIcon name="info" />
            </>
        )
    );
    const send = container.querySelector<HTMLImageElement>(
        'img[src="/icons/send.svg"]'
    );
    expect(send.width).toBe(16);
    expect(
        container.querySelector<HTMLImageElement>('img[src="/icons/x.svg"]')
            .width
    ).toBe(18);
    expect(
        container.querySelector<HTMLElement>(".experience-control-icon").style
            .width
    ).toBe("22px");
});

test("the home control opens the 3D lobby instead of invoking the runtime's 2D exit", async () => {
    const push = jest.fn().mockResolvedValue(true);
    const stop = trackExperienceNavigation({
        push,
        replace: jest.fn(),
        events: { on: jest.fn(), off: jest.fn() },
    });
    try {
        render();
        click(container.querySelector("header button"));
        await act(async () => {
            await Promise.resolve();
        });
        expect(push).toHaveBeenCalledWith("/?lobby=1");
        expect(exit).not.toHaveBeenCalled();
    } finally {
        stop();
        const pending = pendingLobbyReturn();
        if (pending) finishLobbyReturn(pending);
    }
});

test("says a failed dock action above the dock, with Retry only when given", () => {
    const actions = [{ id: "voice", label: "Request to speak", onClick() {} }];
    render({ actions });
    expect(container.querySelector(".experience-notice")).toBeNull();

    render({ actions, notice: { message: "No moderator is here." } });
    const alert = container.querySelector('.experience-notice [role="alert"]');
    expect(alert.textContent).toBe("No moderator is here.");
    expect(alert.querySelector("button")).toBeNull();

    const retry = jest.fn();
    render({ actions, notice: { message: "Couldn't share.", onRetry: retry } });
    click(container.querySelector(".experience-notice button"));
    expect(retry).toHaveBeenCalledTimes(1);
});
