import { provesUser } from "../../../identity/oncyberToken";
import { Room } from "colyseus";

import { CyberState } from "../schema/CyberState";

import fetch from "node-fetch";
import { checkIsMod } from "../../../utils/isMod";

// CyberRoom carries a plain (non-schema) rtcRate Map; typed structurally to
// avoid a circular import with the room module.
type RtcRateRoom = Room<CyberState> & {
    rtcRate: Map<string, { tokens: number; last: number }>;
};

export function PlayersEventHandlers(room: Room<CyberState>) {
    // Messages can race a leave/kick: the sender's player may already be gone
    // from the state map, so every handler has to tolerate a missing player.
    room.onMessage("move", (client, data) => {
        room.state.players.get(client.sessionId)?._onMoveMessage(data);
    });

    room.onMessage("init", (client, data) => {
        room.state.players.get(client.sessionId)?._onInitMessage(data);
    });

    room.onMessage("VRM", (client, data) => {
        room.state.players.get(client.sessionId)?._onVRMMessage(data);
    });

    room.onMessage("avatar", (client, data) => {
        room.state.players.get(client.sessionId)?._onAvatarMessage(data);
    });

    room.onMessage("username", async (client, data) => {
        room.state.players.get(client.sessionId)?._onUsernameMessage(data);
    });

    room.onMessage("login", async (client, data) => {
        const [token, username, avatar, walletId] = data;

        // A login message names any wallet; only a verified session counts.
        if (!provesUser(walletId, token)) return;

        room.state.disconnectDuplicatePlayer(walletId, "onLogin");

        room.state.players.get(client.sessionId)?._onLoginMessage(data, room.metadata);
    });

    room.onMessage("pause", (client, data) => {
        room.state.players.get(client.sessionId)?._onPauseMessage(data);
    });

    room.onMessage("space", (client, data) => {
        room.state.players.get(client.sessionId)?._onSpaceMessage(data);
    });

    room.onMessage("scale", (client, data) => {
        room.state.players.get(client.sessionId)?._onScaleMessage(data);
    });

    room.onMessage("kick", async (client, data) => {
        const [token, sessionId] = data;

        const userToKick = room.clients?.find?.((client) => client.sessionId === sessionId);

        const sender = room.state.players.get(client.sessionId);

        if (userToKick && sender) {
            const isMod = await checkIsMod(sender.userId, room.metadata.exhibitId, token);

            if (isMod) {
                userToKick.send("kick");
            }
        }
    });

    room.onMessage("voice-request", async (_client) => {
        room.clients.forEach((client) => {
            const player = room.state.players.get(client.sessionId);

            if (player?.isAdmin) {
                client.send("voice-request", _client.sessionId);
            }
        });
    });

    room.onMessage("disable-voice", async (_client, data) => {
        const sessionId = data;

        const client = room.clients?.find?.((client) => client.sessionId === sessionId);

        if (client) {
            client.send("disable-voice");
        }
    });

    room.onMessage("enable-voice", async (_client, data) => {
        const [sessionId, token] = data;

        const client = room.clients?.find?.((client) => client.sessionId === sessionId);

        if (client) {
            client.send("enable-voice", token);
        }
    });

    room.onMessage("decline-voice", async (_client) => {
        // We check if admin

        const client = room.clients?.find?.((client) => client.sessionId === _client.sessionId);

        if (client) {
            client.send("decline-voice");
        }
    });

    room.onMessage("voice-range", async (client, data) => {
        const [range, token] = data;

        const sender = room.state.players.get(client.sessionId);

        if (!sender) return;

        const isMod = await checkIsMod(sender.userId, room.metadata.exhibitId, token);

        if (isMod) {
            room.broadcast("voice-range", range);
        }
    });

    // ---- WebRTC voice signaling relay (replaces the external PartyKit) ----

    // Opaque SDP/ICE blobs relayed between two clients. The token bucket is
    // generous: a perfect-negotiation join near many peers bursts
    // offer+answer+~10-15 trickle candidates per pair in 1-2s.
    const RTC_BURST = 150;
    const RTC_REFILL_PER_SEC = 50;
    const MAX_RTC_PAYLOAD = 64 * 1024;

    room.onMessage("rtc-signal", (client, data) => {
        const to = data?.to;
        const payload = data?.payload;

        if (typeof to !== "string" || payload == null || typeof payload !== "object") {
            return;
        }

        try {
            if (JSON.stringify(payload).length > MAX_RTC_PAYLOAD) return;
        } catch (err) {
            return;
        }

        if (!takeRtcToken(room as RtcRateRoom, client.sessionId, RTC_BURST, RTC_REFILL_PER_SEC)) {
            console.warn("[rtc-signal] rate limited", client.sessionId);
            return;
        }

        room.clients
            ?.find?.((c) => c.sessionId === to)
            ?.send("rtc-signal", { from: client.sessionId, payload });
    });

    // The voice stack starts seconds after room join; this lets it announce
    // readiness so existing publishers (re)offer once it's listening.
    room.onMessage("rtc-ready", (client) => {
        room.broadcast(
            "rtc-join",
            { sessionId: client.sessionId },
            { except: client }
        );
    });
}

function takeRtcToken(
    room: RtcRateRoom,
    sessionId: string,
    burst: number,
    refillPerSec: number
): boolean {
    const now = Date.now();

    const bucket = room.rtcRate;

    let entry = bucket.get(sessionId);

    if (!entry) {
        entry = { tokens: burst, last: now };
        bucket.set(sessionId, entry);
    }

    const refill = ((now - entry.last) / 1000) * refillPerSec;

    entry.tokens = Math.min(burst, entry.tokens + refill);
    entry.last = now;

    if (entry.tokens < 1) return false;

    entry.tokens -= 1;
    return true;
}
