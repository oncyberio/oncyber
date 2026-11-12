import type { Room } from "colyseus.js";
import type {
    SignalingHandlers,
    SignalingTransport,
    SignalPayload,
} from "@utils/voiceChat/ColyseusSignaling";

export const LOBBY_VOICE_LIMIT = 8;
/** Proximity peers plus stage speakers (up to 5) or, for a speaker, its listeners (up to 50). */
export const LOBBY_SIGNAL_LIMIT = 64;
/** Every ingress and egress path is restricted before WebRTC can allocate peers. */
export class LobbyVoiceSignaling implements SignalingTransport {
    private peers = new Set<string>();
    private handlers: SignalingHandlers | null = null;
    private unbinds: Array<() => void> = [];
    private closed = false;
    constructor(
        private room: Room,
        peers: string[] = [],
        private supportsDisable = true
    ) {
        this.replacePeers(peers);
    }
    get selfId() {
        return this.room.sessionId;
    }
    replacePeers(peers: string[]) {
        if (this.closed) return;
        const next = new Set(
            peers
                .filter((id) => typeof id === "string" && id !== this.selfId)
                .slice(0, LOBBY_SIGNAL_LIMIT)
        );
        const previous = this.peers;
        this.peers = next;
        for (const id of previous)
            if (!next.has(id)) this.handlers?.onPeerLeave(id);
        for (const id of next)
            if (!previous.has(id)) this.handlers?.onPeerJoin(id);
    }
    start(handlers: SignalingHandlers) {
        if (this.closed || this.handlers) return;
        this.handlers = handlers;
        this.unbinds.push(
            this.room.onMessage("rtc-signal", (message: any) => {
                if (
                    this.peers.has(message?.from) &&
                    ["offer", "answer", "candidate"].includes(
                        message?.payload?.kind
                    )
                )
                    handlers.onSignal(message.from, message.payload);
            }),
            this.room.onMessage("rtc-join", (message: any) => {
                if (this.peers.has(message?.sessionId))
                    handlers.onPeerJoin(message.sessionId);
            }),
            this.room.onMessage("rtc-leave", (message: any) => {
                if (this.peers.has(message?.sessionId))
                    handlers.onPeerLeave(message.sessionId);
            })
        );
        this.room.send("rtc-ready", { enabled: true });
    }
    initialPeers() {
        return Array.from(this.peers);
    }
    send(to: string, payload: SignalPayload) {
        if (!this.closed && this.peers.has(to))
            this.room.send("rtc-signal", { to, payload });
    }
    dispose() {
        if (this.closed) return;
        this.closed = true;
        this.unbinds.forEach((unbind) => {
            try {
                unbind();
            } catch {}
        });
        this.unbinds = [];
        // The room may already have disconnected; teardown must still release PCs.
        try {
            if (this.supportsDisable)
                this.room.send("rtc-ready", { enabled: false });
        } catch {}
        this.peers.clear();
        this.handlers = null;
    }
}

/** Legacy servers cannot select voice pairs. Require mutual nearest-neighbor
 * membership, in audible range, to keep both ends of the fallback bounded. */
export function legacyVoicePeers(
    selfId: string,
    positions: Array<{ id: string; x: number; z: number }>
) {
    const self = positions.find((player) => player.id === selfId);
    if (!self) return [];
    const distance = (a: typeof self, b: typeof self) =>
        Math.hypot(a.x - b.x, a.z - b.z);
    const candidates = positions
        .filter(
            (player) => player.id !== selfId && distance(self, player) <= 14
        )
        .sort(
            (a, b) =>
                distance(self, a) - distance(self, b) ||
                a.id.localeCompare(b.id)
        )
        .slice(0, LOBBY_VOICE_LIMIT);
    return candidates
        .filter((candidate) => {
            const selfDistance = distance(candidate, self);
            let closer = 0;
            for (const other of positions) {
                if (other.id === candidate.id || other.id === selfId) continue;
                const d = distance(candidate, other);
                if (
                    d < selfDistance ||
                    (d === selfDistance && other.id.localeCompare(selfId) < 0)
                )
                    closer++;
                if (closer >= LOBBY_VOICE_LIMIT) return false;
            }
            return true;
        })
        .map((player) => player.id);
}
