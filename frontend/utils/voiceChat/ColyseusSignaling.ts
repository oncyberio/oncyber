import type { Room } from "colyseus.js";

export interface SignalPayload {
    kind: "offer" | "answer" | "candidate";
    offer?: { offer: RTCSessionDescriptionInit; map: Record<string, string> };
    answer?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
}

export interface SignalingHandlers {
    onSignal: (from: string, payload: SignalPayload) => void;
    onPeerJoin: (sessionId: string) => void;
    onPeerLeave: (sessionId: string) => void;
}

export interface SignalingTransport {
    readonly selfId: string;
    start(handlers: SignalingHandlers): void;
    initialPeers(): string[];
    send(to: string, payload: SignalPayload): void;
    dispose(): void;
}

// WebRTC voice signaling carried over the existing Colyseus room connection
// (replaces the standalone PartyKit socket). It only relays — it never
// joins or leaves the room (the room is owned by the multiplayer layer).
export class ColyseusSignaling implements SignalingTransport {
    private _unsubs: Array<() => void> = [];

    private _disposed = false;

    private _started = false;

    constructor(private room: Room) {}

    get selfId() {
        return this.room.sessionId;
    }

    start(handlers: SignalingHandlers) {
        if (this._disposed || this._started) return;
        this._started = true;
        // Register handlers BEFORE announcing readiness, so a recovery offer
        // bounced straight back can't arrive before its handler exists.
        this._unsubs.push(
            this.room.onMessage("rtc-signal", (msg: any) => {
                if (
                    this._disposed ||
                    typeof msg?.from !== "string" ||
                    !msg.from ||
                    msg.from === this.selfId ||
                    !["offer", "answer", "candidate"].includes(msg.payload?.kind)
                ) {
                    return;
                }
                handlers.onSignal(msg.from, msg.payload);
            }),
            this.room.onMessage("rtc-join", (msg: any) => {
                if (
                    this._disposed ||
                    typeof msg?.sessionId !== "string" ||
                    !msg.sessionId ||
                    msg.sessionId === this.selfId
                ) return;
                handlers.onPeerJoin(msg.sessionId);
            }),
            this.room.onMessage("rtc-leave", (msg: any) => {
                if (
                    this._disposed ||
                    typeof msg?.sessionId !== "string" ||
                    !msg.sessionId ||
                    msg.sessionId === this.selfId
                ) return;
                handlers.onPeerLeave(msg.sessionId);
            })
        );

        // If we joined before the first full state landed, replay the roster
        // once it arrives so we still connect to peers already present.
        if (this.initialPeers().length === 0) {
            this.room.onStateChange.once(() => {
                if (this._disposed) return;
                this.initialPeers().forEach((id) => handlers.onPeerJoin(id));
            });
        }

        try {
            this.room.send("rtc-ready");
        } catch (err) {
            console.error("[ColyseusSignaling] rtc-ready failed", err);
        }
    }

    initialPeers(): string[] {
        if (this._disposed) return [];
        const players = (this.room.state as any)?.players;
        if (!players?.keys) return [];

        const ids: string[] = [];
        for (const sessionId of Array.from(players.keys()) as string[]) {
            if (sessionId !== this.selfId) ids.push(sessionId);
        }
        return ids;
    }

    send(to: string, payload: SignalPayload) {
        if (this._disposed || !this._started || !to || to === this.selfId) return;
        try {
            this.room.send("rtc-signal", { to, payload });
        } catch (err) {
            console.error("[ColyseusSignaling] send failed", err);
        }
    }

    dispose() {
        if (this._disposed) return;
        this._disposed = true;
        this._unsubs.forEach((unsub) => {
            try {
                unsub();
            } catch (err) {
                // room may already be cleaned up
            }
        });
        this._unsubs = [];
    }
}
