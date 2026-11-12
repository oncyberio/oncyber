/** Public filters are views of the same room broadcast, never private rooms. */
export const NATIVE_CHAT_VIEWS = ["world", "space", "nearby"];
export const nativeChatRecipient = (mode: string): string | undefined =>
    mode?.startsWith("peer:") && mode.length > 5 ? mode.slice(5) : undefined;

export function decodeNativeChatPayload(raw: unknown): any {
    if (typeof raw === "string") {
        if (raw.length > 8192) return null;
        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }
    return raw && typeof raw === "object" ? raw : null;
}

/** The relay envelope, not a sender-authored sessionId/direct field, owns identity. */
export function receiveNativeChat(
    raw: unknown,
    from: string,
    self: string,
    privateMessage: boolean,
    profile?: { username?: string; avatar?: string }
) {
    const message = decodeNativeChatPayload(raw);
    if (!message || !from || from === self) return null;
    if (
        privateMessage &&
        !["MESSAGE", "REFRESH_MESSAGE"].includes(message.type)
    )
        return null;
    if (!privateMessage && message.direct) return null;
    if (
        message.type === "MESSAGE" &&
        (typeof message.text !== "string" ||
            !message.text.trim() ||
            message.text.length > 500)
    )
        return null;
    return {
        ...message,
        sessionId: from,
        direct: privateMessage ? self : undefined,
        ...(profile?.username ? { username: profile.username } : {}),
        ...(profile?.avatar ? { avatar: profile.avatar } : {}),
    };
}

export function nativeConversation(
    message: { direct?: string; sessionId?: string },
    self: string
) {
    if (!message.direct) return "world";
    if (message.sessionId === self) return `peer:${message.direct}`;
    return message.direct === self ? `peer:${message.sessionId}` : null;
}

type Transport = {
    sendPeerMessage: (data: any, recipient: string) => unknown;
    sendChannelMessage: (data: any, roomId: string) => unknown;
};
/** DMs never fall back to broadcast or public history, including their link updates. */
export function dispatchNativeChat({
    transport,
    message,
    roomId,
    recipient,
    allowed,
    peerPresent,
    saveHistory,
}: {
    transport: Transport;
    message: any;
    roomId: string;
    recipient?: string;
    allowed: boolean;
    peerPresent: boolean;
    saveHistory: (data: any) => void;
}) {
    if (!allowed || !transport || !roomId || (recipient && !peerPresent))
        return false;
    if (recipient) transport.sendPeerMessage(message, recipient);
    else {
        transport.sendChannelMessage(message, roomId);
        if (message.type === "MESSAGE") saveHistory(message);
    }
    return true;
}
