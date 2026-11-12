import { Room } from "colyseus";

import { CyberState } from "../schema/CyberState";

// CyberRoom carries these plain (non-schema) Maps; typed structurally to
// avoid a circular import with the room module.
type RealtimeRoom = Room<CyberState> & {
    userAttributes: Map<string, Map<string, string>>;
    channelAttributes: Map<string, string>;
    chatRate: Map<string, { count: number; windowStart: number }>;
};

// Allowlists: the only attribute keys the frontend uses today. A new key must
// be added here AND we log rejections, so a missing entry surfaces loudly
// instead of silently breaking a feature.
const USER_ATTR_KEYS = new Set(["voiceState", "walletId"]);
const CHANNEL_ATTR_KEYS = new Set(["voiceRequests"]);

const MAX_CHAT_PAYLOAD = 8 * 1024;
const MAX_ATTR_VALUE = 16 * 1024;

const CHAT_RATE_LIMIT = 15;
const CHAT_RATE_WINDOW_MS = 3000;

// RTM commands that move/act on OTHER clients (e.g. "teleport all", answering
// a request to speak, muting a speaker) must be authorized here: the
// sender-side `isMod` gate in the UI is cosmetic since any client can craft a
// chat-channel or chat-peer message. Enforce that the sender is a room mod
// (isAdmin is set authoritatively from checkIsMod at join and at login) before
// relaying, on both channels.
//
// Mirror these strings with the frontend RTM command constants:
// - SUMMON_COMMAND and KICK_COMMAND in
//   frontend/components/_3DExhibit-v2/context/MultiplayerProvider.tsx
// - the VOICE_REQUESTS enum in
//   frontend/components/_3DExhibit-v2/context/hooks/useVoice.tsx. Every member
//   is listed in one of the two voice lists below; a new one has to be sorted
//   into "moderators only" or "anyone" here (ChatEvents_test checks this).
const RTM_COMMAND = "RTM_COMMAND";

// A moderator answers a request to speak (broadcast), mutes, stops or removes
// a speaker (sent to that peer), or sets the voice range.
export const MOD_ONLY_VOICE_COMMANDS = [
    "ADMIN_ANSWER_VOICE_PERMISSION",
    "ADMIN_SET_USER_VOICE_STATE",
    "SET_VOICE_RANGE",
];

// Any visitor asks to speak, withdraws their own request, and announces their
// own microphone/stream state. Never restricted.
export const VISITOR_VOICE_COMMANDS = [
    "REQUEST_VOICE_PERMISSION",
    "CANCEL_VOICE_PERMISSION_REQUEST",
    "VOICE_STATE_CHANGED",
];

export const MOD_ONLY_RTM_COMMANDS = new Set([
    "SUMMON_COMMAND",
    "KICK_COMMAND",
    ...MOD_ONLY_VOICE_COMMANDS,
]);

// How many times a payload may be JSON-encoded and still reach the receiver
// as a command: sendCommand() sends the object as-is on chat-channel and
// JSON-stringified on chat-peer, and the receiving client parses a string
// once per layer (ColyseusChatProvider._normalize, decodeNativeChatPayload).
// Read one layer further than it does, so no encoding slips past this check.
const MAX_COMMAND_DECODES = 3;

/**
 * The RTM command name the receiving client would dispatch for this payload,
 * or undefined when it is not a command (an ordinary message, for example).
 */
export function rtmCommandName(data: unknown): string | undefined {
    let payload: any = data;

    for (
        let decodes = 0;
        typeof payload === "string" && decodes < MAX_COMMAND_DECODES;
        decodes++
    ) {
        try {
            payload = JSON.parse(payload);
        } catch (err) {
            return undefined;
        }
    }

    if (
        payload == null ||
        typeof payload !== "object" ||
        payload.type !== RTM_COMMAND ||
        !payload.command
    ) {
        return undefined;
    }

    // The receiver's emitter looks listeners up by property name, so a type
    // sent as ["SUMMON_COMMAND"] dispatches as "SUMMON_COMMAND": compare the
    // same string it will. A type with no string form dispatches nothing.
    try {
        return String(payload.command.type);
    } catch (err) {
        return undefined;
    }
}

export function isModOnlyCommand(data: unknown): boolean {
    const name = rtmCommandName(data);

    return name !== undefined && MOD_ONLY_RTM_COMMANDS.has(name);
}

export function ChatEventHandlers(room: RealtimeRoom) {
    // ---- text chat + RTM commands ----

    // Broadcast to ALL clients INCLUDING the sender: command dispatch relies
    // on the echo (the sender processes its own command via the round-trip).
    room.onMessage("chat-channel", (client, data) => {
        if (!withinChatRate(room, client.sessionId)) return;

        if (!withinSize(data, MAX_CHAT_PAYLOAD)) {
            console.warn("[chat-channel] payload too large", client.sessionId);
            return;
        }

        if (
            isModOnlyCommand(data) &&
            !room.state.players.get(client.sessionId)?.isAdmin
        ) {
            console.warn(
                "[chat-channel] non-mod restricted command blocked",
                client.sessionId
            );
            return;
        }

        room.broadcast("chat-channel", {
            from: client.sessionId,
            server_ts: Date.now(),
            data,
        });
    });

    // Targeted relay for direct messages and existing admin commands.
    room.onMessage("chat-peer", (client, payload) => {
        const to = payload?.to;
        const data = payload?.data;

        if (typeof to !== "string") return;
        if (
            data?.type === "MESSAGE" &&
            !withinChatRate(room, client.sessionId)
        ) return;

        if (!withinSize(data, MAX_CHAT_PAYLOAD)) {
            console.warn("[chat-peer] payload too large", client.sessionId);
            return;
        }

        const sender = room.state.players.get(client.sessionId);

        // Same gate as chat-channel: a moderator command sent straight to
        // one peer (mute, stop sharing, remove as speaker) needs a moderator.
        if (isModOnlyCommand(data) && !sender?.isAdmin) {
            console.warn(
                "[chat-peer] non-mod restricted command blocked",
                client.sessionId
            );
            return;
        }

        room.clients
            ?.find?.((c) => c.sessionId === to)
            ?.send("chat-peer", {
                from: client.sessionId,
                to,
                server_ts: Date.now(),
                profile: data?.type === "MESSAGE" && sender ? {
                    username: sender.username,
                    avatar: sender.avatar,
                } : undefined,
                data,
            });
    });

    // ---- per-user attributes (voiceState / walletId), keyed by sessionId ----

    room.onMessage("attr-set-user", (client, { key, value }) => {
        if (!USER_ATTR_KEYS.has(key)) {
            console.warn("[attr-set-user] rejected key", key, client.sessionId);
            return;
        }

        if (value == null) {
            room.userAttributes.get(client.sessionId)?.delete(key);
            return;
        }

        if (typeof value !== "string" || value.length > MAX_ATTR_VALUE) return;

        let attrs = room.userAttributes.get(client.sessionId);
        if (!attrs) {
            attrs = new Map();
            room.userAttributes.set(client.sessionId, attrs);
        }

        attrs.set(key, value);
    });

    room.onMessage("attr-get-user", (client, { requestId, sessionId, keys }) => {
        const attrs = room.userAttributes.get(sessionId);

        const values: Record<string, string> = {};

        (Array.isArray(keys) ? keys : []).forEach((k) => {
            const v = attrs?.get(k);
            if (v != null) values[k] = v;
        });

        client.send("attr-reply", { requestId, values });
    });

    // ---- per-room channel attributes (voiceRequests) ----

    room.onMessage("attr-set-channel", (client, { key, value }) => {
        if (!CHANNEL_ATTR_KEYS.has(key)) {
            console.warn("[attr-set-channel] rejected key", key, client.sessionId);
            return;
        }

        if (value == null) {
            room.channelAttributes.delete(key);
            return;
        }

        if (typeof value !== "string" || value.length > MAX_ATTR_VALUE) return;

        room.channelAttributes.set(key, value);
    });

    room.onMessage("attr-get-channel", (client, { requestId, keys }) => {
        const values: Record<string, string> = {};

        (Array.isArray(keys) ? keys : []).forEach((k) => {
            const v = room.channelAttributes.get(k);
            if (v != null) values[k] = v;
        });

        client.send("attr-reply", { requestId, values });
    });
}

function withinSize(data: any, max: number): boolean {
    try {
        return JSON.stringify(data ?? null).length <= max;
    } catch (err) {
        return false;
    }
}

function withinChatRate(room: RealtimeRoom, sessionId: string): boolean {
    const now = Date.now();

    let entry = room.chatRate.get(sessionId);

    if (!entry || now - entry.windowStart > CHAT_RATE_WINDOW_MS) {
        entry = { count: 0, windowStart: now };
        room.chatRate.set(sessionId, entry);
    }

    entry.count += 1;

    return entry.count <= CHAT_RATE_LIMIT;
}
