/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { EventEmitter } from "events";
import useVoice, { VOICE_REQUESTS, VOICE_REQUEST_TIMEOUT_MS } from "./useVoice";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";

jest.mock("@components/_3DExhibit-v2/hooks/useWorld", () => ({
    useWorld: jest.fn(),
}));
jest.mock("@components/_3DExhibit-v2/hooks/useWorldHandler", () => ({
    useWorldHandler: jest.fn(),
}));
jest.mock(
    "@components/_3DExhibit-v2/three/factory/multiplayer/constants",
    () => ({ GET_USERS_INFO: "GET_USERS_INFO" })
);
jest.mock("@3events", () => ({}), { virtual: true });
jest.mock("@utils/analytics", () => ({
    amplitude_logAnalyticsEvent: jest.fn(),
}));
jest.mock("@components/Dialogs", () => ({ showError: jest.fn() }));

type Name = "visitor" | "moderator";
const names: Name[] = ["visitor", "moderator"];
const tokens = { mic: "", stream: "" };

// One room: commands reach every client, the sender included, and the
// channel attribute is a single shared value, as on the multiplayer server.
let attributes: Record<string, any>;
let clients: Record<Name, ReturnType<typeof client>>;
let hooks: Record<Name, ReturnType<typeof useVoice>>;
let root: ReturnType<typeof createRoot>;

function client(sessionId: Name) {
    const commands = new EventEmitter();
    let host = sessionId === "moderator";
    const voiceChat = {
        Events: {},
        on: jest.fn(),
        off: jest.fn(),
        join: jest.fn(async () => {}),
        leave: jest.fn(async () => {}),
        getToken: jest.fn(async () => tokens),
        enableVoice: jest.fn(async () => {
            host = true;
        }),
        isVoiceEnabled: () => host,
        isPlaying: () => false,
        isMuted: () => true,
    };
    const service = {
        roomService: { voiceChat, room: { sessionId } },
        sendCommand: jest.fn(async (type: string, data: any) => {
            names.forEach((name) =>
                clients[name].commands.emit(type, data, sessionId)
            );
        }),
        onCommand: (type, listener) => commands.on(type, listener),
        offCommand: (type, listener) => commands.off(type, listener),
        getUserAttribute: jest.fn(async () => null),
        setUserAttribute: jest.fn(async () => {}),
        getChannelAttribute: jest.fn(async (key: string) => attributes[key]),
        setChannelAttribute: jest.fn(async (key: string, value: any) => {
            attributes[key] = value;
        }),
    };
    return { commands, voiceChat, service: { current: service as any } };
}
function Client({ name }: { name: Name }) {
    hooks[name] = useVoice({
        userId: name,
        MultiplayerService: clients[name].service,
    });
    return null;
}
const run = (work: () => unknown) => act(async () => void (await work()));
const sent = (name: Name, type: VOICE_REQUESTS) =>
    clients[name].service.current.sendCommand.mock.calls.filter(
        ([command]) => command === type
    );
const cards = () =>
    hooks.moderator.voiceRequests.map((it) => it.user.sessionId);

beforeEach(async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.useFakeTimers();
    jest.spyOn(console, "log").mockImplementation(() => {});
    Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: { ondevicechange: null, enumerateDevices: async () => [] },
    });
    (useWorld as jest.Mock).mockReturnValue({
        current: {
            handleCommand: () => ({
                success: true,
                players: names.map((sessionId) => ({ sessionId })),
            }),
        },
    });
    attributes = {};
    hooks = {} as any;
    clients = { visitor: client("visitor"), moderator: client("moderator") };
    root = createRoot(document.createElement("div"));
    await run(() =>
        root.render(
            <>
                <Client key="visitor" name="visitor" />
                <Client key="moderator" name="moderator" />
            </>
        )
    );
    for (const name of names) {
        await run(() =>
            hooks[name].init({
                id: "room",
                sessionId: name,
                spaceId: "space",
                label: "room",
                isMod: name === "moderator",
                needsHostPermission: true,
            })
        );
    }
    await run(() => hooks.visitor.requestVoicePermission("mic"));
});
afterEach(async () => {
    await run(() => root.unmount());
    delete (navigator as any).mediaDevices;
    jest.useRealTimers();
    jest.restoreAllMocks();
});

test("a sent request waits for a moderator and is listed for them", () => {
    expect(hooks.visitor.voiceState).toEqual({
        type: "pending",
        reason: "mic",
    });
    expect(cards()).toEqual(["visitor"]);
    expect(attributes.voiceRequests).toEqual([
        { sessionId: "visitor", reason: "mic" },
    ]);
});

test("cancelling withdraws the request from the visitor, the moderator and the shared list", async () => {
    await run(() => hooks.visitor.cancelVoicePermissionRequest());
    expect(hooks.visitor.voiceState).toEqual({
        type: "disabled",
        request: "withdrawn",
    });
    expect(cards()).toEqual([]);
    expect(attributes.voiceRequests).toEqual([]);

    // Nothing is left to expire, and a second cancel has nothing to withdraw.
    await run(() => hooks.visitor.cancelVoicePermissionRequest());
    await run(() => jest.advanceTimersByTime(VOICE_REQUEST_TIMEOUT_MS));
    expect(
        sent("visitor", VOICE_REQUESTS.CANCEL_VOICE_PERMISSION_REQUEST)
    ).toHaveLength(1);
});

test("an unanswered request expires after two minutes", async () => {
    expect(VOICE_REQUEST_TIMEOUT_MS).toBe(120_000);
    await run(() => jest.advanceTimersByTime(VOICE_REQUEST_TIMEOUT_MS - 1));
    expect(hooks.visitor.voiceState.type).toBe("pending");
    expect(cards()).toEqual(["visitor"]);

    await run(() => jest.advanceTimersByTime(1));
    expect(hooks.visitor.voiceState).toEqual({
        type: "disabled",
        request: "expired",
    });
    expect(cards()).toEqual([]);
    expect(attributes.voiceRequests).toEqual([]);
});

test.each([
    ["a cancelled", () => hooks.visitor.cancelVoicePermissionRequest()],
    ["an expired", () => jest.advanceTimersByTime(VOICE_REQUEST_TIMEOUT_MS)],
])("a late approval of %s request does not enable voice", async (_, end) => {
    await run(end);
    await run(() =>
        clients.moderator.service.current.sendCommand(
            VOICE_REQUESTS.ADMIN_ANSWER_VOICE_PERMISSION,
            { sessionId: "visitor", tokens }
        )
    );
    expect(clients.visitor.voiceChat.enableVoice).not.toHaveBeenCalled();
    expect(hooks.visitor.voiceState.type).toBe("disabled");
});

test("an approval in time enables voice and stops the expiry", async () => {
    await run(() =>
        hooks.moderator.admin_acceptUserVoicePermissionRequest("visitor")
    );
    expect(clients.visitor.voiceChat.enableVoice).toHaveBeenCalledWith(tokens);
    expect(hooks.visitor.voiceState.type).toBe("enabled");
    expect(cards()).toEqual([]);

    await run(() => jest.advanceTimersByTime(VOICE_REQUEST_TIMEOUT_MS));
    expect(hooks.visitor.voiceState.type).toBe("enabled");
    expect(
        sent("visitor", VOICE_REQUESTS.CANCEL_VOICE_PERMISSION_REQUEST)
    ).toHaveLength(0);
});

test("a rejection returns the visitor to disabled and stops the expiry", async () => {
    await run(() =>
        hooks.moderator.admin_rejectUserVoicePermissionRequest("visitor")
    );
    expect(hooks.visitor.voiceState).toEqual({ type: "disabled" });
    expect(cards()).toEqual([]);

    await run(() => jest.advanceTimersByTime(VOICE_REQUEST_TIMEOUT_MS));
    expect(
        sent("visitor", VOICE_REQUESTS.CANCEL_VOICE_PERMISSION_REQUEST)
    ).toHaveLength(0);
});

test("a request made again after cancelling gets its own two minutes", async () => {
    await run(() => jest.advanceTimersByTime(60_000));
    await run(() => hooks.visitor.cancelVoicePermissionRequest());
    await run(() => hooks.visitor.requestVoicePermission("broadcast"));
    expect(hooks.visitor.voiceState).toEqual({
        type: "pending",
        reason: "broadcast",
    });
    expect(cards()).toEqual(["visitor"]);

    await run(() => jest.advanceTimersByTime(VOICE_REQUEST_TIMEOUT_MS - 1));
    expect(hooks.visitor.voiceState.type).toBe("pending");
    await run(() => jest.advanceTimersByTime(1));
    expect(hooks.visitor.voiceState).toEqual({
        type: "disabled",
        request: "expired",
    });
});

test("leaving voice withdraws a waiting request, once, and stops its expiry", async () => {
    expect(jest.getTimerCount()).toBe(1);
    await run(() => hooks.visitor.dispose());
    expect(jest.getTimerCount()).toBe(0);
    // The moderator's card goes, and so does the shared list's entry.
    expect(cards()).toEqual([]);
    expect(attributes.voiceRequests).toEqual([]);
    expect(
        sent("visitor", VOICE_REQUESTS.CANCEL_VOICE_PERMISSION_REQUEST)
    ).toEqual([
        [
            VOICE_REQUESTS.CANCEL_VOICE_PERMISSION_REQUEST,
            {
                sessionId: "visitor",
            },
        ],
    ]);
    await run(() => jest.advanceTimersByTime(VOICE_REQUEST_TIMEOUT_MS));
    expect(
        sent("visitor", VOICE_REQUESTS.CANCEL_VOICE_PERMISSION_REQUEST)
    ).toHaveLength(1);
});

test("the withdrawal is sent before leaving voice closes anything", async () => {
    const { voiceChat, service } = clients.visitor;
    const order: string[] = [];
    service.current.sendCommand.mockImplementationOnce(async (type) => {
        order.push(type);
    });
    service.current.setChannelAttribute.mockImplementationOnce(async (key) => {
        order.push(key);
    });
    voiceChat.leave.mockImplementationOnce(async () => {
        order.push("leave");
    });
    // The provider closes voice, chat and the room side by side: what is not
    // sent synchronously, before voice leaves, may not be sent at all.
    let leaving: Promise<void>;
    act(() => {
        leaving = hooks.visitor.dispose();
    });
    expect(order).toEqual([
        VOICE_REQUESTS.CANCEL_VOICE_PERMISSION_REQUEST,
        "voiceRequests",
        "leave",
    ]);
    await run(() => leaving);
});

test("leaving voice with nothing waiting withdraws nothing", async () => {
    await run(() =>
        hooks.moderator.admin_rejectUserVoicePermissionRequest("visitor")
    );
    await run(() => hooks.visitor.dispose());
    expect(
        sent("visitor", VOICE_REQUESTS.CANCEL_VOICE_PERMISSION_REQUEST)
    ).toHaveLength(0);
});

test("unmounting clears the expiry timer", async () => {
    expect(jest.getTimerCount()).toBe(1);
    await run(() => root.render(<Client key="moderator" name="moderator" />));
    expect(jest.getTimerCount()).toBe(0);
    await run(() => jest.advanceTimersByTime(VOICE_REQUEST_TIMEOUT_MS));
    expect(
        sent("visitor", VOICE_REQUESTS.CANCEL_VOICE_PERMISSION_REQUEST)
    ).toHaveLength(0);
});
