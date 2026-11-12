import {
    dispatchNativeChat,
    nativeConversation,
    receiveNativeChat,
} from "./nativeConversations";

test("peer messages and link updates only use the targeted relay, never public history", () => {
    const transport = {
        sendPeerMessage: jest.fn(),
        sendChannelMessage: jest.fn(),
    };
    const saveHistory = jest.fn();
    for (const type of ["MESSAGE", "REFRESH_MESSAGE"])
        expect(
            dispatchNativeChat({
                transport,
                saveHistory,
                message: { type, direct: "bob" },
                roomId: "room",
                recipient: "bob",
                allowed: true,
                peerPresent: true,
            })
        ).toBe(true);
    expect(transport.sendPeerMessage).toHaveBeenCalledTimes(2);
    expect(transport.sendChannelMessage).not.toHaveBeenCalled();
    expect(saveHistory).not.toHaveBeenCalled();
    dispatchNativeChat({
        transport,
        saveHistory,
        message: { type: "MESSAGE" },
        roomId: "room",
        allowed: true,
        peerPresent: true,
    });
    expect(transport.sendChannelMessage).toHaveBeenCalledTimes(1);
    expect(saveHistory).toHaveBeenCalledTimes(1);
});

test("disabled chat and missing peers fail closed without a public fallback", () => {
    const transport = {
        sendPeerMessage: jest.fn(),
        sendChannelMessage: jest.fn(),
    };
    const saveHistory = jest.fn();
    for (const recipient of [undefined, "bob"])
        expect(
            dispatchNativeChat({
                transport,
                saveHistory,
                message: { type: "MESSAGE" },
                roomId: "room",
                recipient,
                allowed: false,
                peerPresent: true,
            })
        ).toBe(false);
    expect(
        dispatchNativeChat({
            transport,
            saveHistory,
            message: { type: "MESSAGE" },
            roomId: "room",
            recipient: "gone",
            allowed: true,
            peerPresent: false,
        })
    ).toBe(false);
    expect(transport.sendPeerMessage).not.toHaveBeenCalled();
    expect(transport.sendChannelMessage).not.toHaveBeenCalled();
    expect(saveHistory).not.toHaveBeenCalled();
});

test("private receive identity comes from the relay and stays outside every public view", () => {
    const raw = {
        type: "MESSAGE",
        text: "hello",
        sessionId: "forged",
        direct: "mallory",
        username: "spoof",
    };
    const incoming = receiveNativeChat(
        JSON.stringify(raw),
        "bob",
        "alice",
        true,
        { username: "Bob" }
    );
    expect(incoming).toMatchObject({
        sessionId: "bob",
        direct: "alice",
        username: "Bob",
    });
    expect(nativeConversation(incoming, "alice")).toBe("peer:bob");
    expect(nativeConversation(incoming, "mallory")).toBe(null);
    expect(
        nativeConversation({ sessionId: "alice", direct: "bob" }, "alice")
    ).toBe("peer:bob");
    expect(receiveNativeChat(raw, "bob", "alice", false)).toBe(null);
    expect(
        receiveNativeChat(
            { type: "MESSAGE", text: "room", sessionId: "forged" },
            "bob",
            "alice",
            false
        )
    ).toMatchObject({ sessionId: "bob", direct: undefined });
});

test("malformed peer content cannot become a message or an RTM command", () => {
    for (const payload of [
        "{",
        null,
        { type: "RTM_COMMAND" },
        { type: "MESSAGE", text: [] },
        { type: "MESSAGE", text: "a".repeat(501) },
    ]) {
        expect(receiveNativeChat(payload, "bob", "alice", true)).toBe(null);
    }
});
