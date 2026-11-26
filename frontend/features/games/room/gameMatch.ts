/**
 * The page's half of a party's roster and real-time match channel. The
 * party's room (multiplayer/src/rooms/cyber/events/MatchChannelHandler.ts)
 * sends the roster and relays match packets; this passes both between the
 * room and the game's frame, and keeps the frame inside the channel's
 * limits before the server has to.
 *
 * To the game: `match` ({ from, data }) and `match-limit`. The roster is
 * not a message of its own: the page puts it in the trip (`trip.roster`,
 * gameContract.ts), so a game hears one party message.
 * From the game: `match` ({ data, to? }).
 */

// The channel's limits, the same numbers as the server's
// (multiplayer/src/rooms/cyber/match/limits.ts) and the runtime's
// (games/runtime/src/match.ts, which sends at MATCH_SEND_RATE, two under the
// rate). games/runtime/test/parity.test.mjs fails when one of them moves alone.
export const MATCH_RATE = 32;
export const MATCH_BURST = 16;
export const MATCH_MAX_BYTES = 1200;
const ROSTER_MAX = 32;

export type MatchRoom = {
    onMessage(type: string, handler: (message: any) => void): unknown;
    send(type: string, message: unknown): void;
};
export type PageRosterMember = {
    id: string;
    session: string;
    name: string;
    pfp: string;
    avatarUrl: string;
    seat: "player" | "spectator";
    state: "here" | "away";
    order: number;
};
export type PageRoster = {
    self: string;
    host: string;
    online: boolean;
    members: PageRosterMember[];
};

const text = (value: unknown, max: number) =>
    typeof value === "string" ? value.slice(0, max) : "";

/** The room's roster as the game gets it; malformed entries drop out. */
export function readRoomRoster(value: any, online = true): PageRoster | null {
    if (!value || !Array.isArray(value.members)) return null;
    const members: PageRosterMember[] = [];
    for (const entry of value.members.slice(0, ROSTER_MAX)) {
        const id = text(entry?.id, 64);
        if (!id || members.some((m) => m.id === id)) continue;
        members.push({
            id,
            session: text(entry?.session, 64),
            name: text(entry?.name, 24).trim() || "Player",
            pfp: text(entry?.pfp, 2048),
            avatarUrl: text(entry?.avatarUrl, 2048),
            seat: entry?.seat === "spectator" ? "spectator" : "player",
            state: entry?.state === "away" ? "away" : "here",
            order: Number.isFinite(entry?.order) ? entry.order : members.length,
        });
    }
    return {
        self: text(value.self, 64),
        host: text(value.host, 64),
        online,
        members,
    };
}

/** A game's outgoing packet, or null when it isn't one or is too large. */
export function readMatchSend(
    message: any
): { data: unknown[]; to?: string } | null {
    const data = message?.data;
    if (!Array.isArray(data)) return null;
    try {
        if (JSON.stringify(data).length > MATCH_MAX_BYTES) return null;
    } catch {
        return null;
    }
    const to = text(message?.to, 64);
    return to ? { data, to } : { data };
}

/**
 * A key only this tab knows, kept for the tab's lifetime so a reload or a
 * dropped connection returns to the same seat. Never sent to the game.
 */
export function matchSeatKey(
    storage: Pick<Storage, "getItem" | "setItem"> | null = safeSessionStorage()
): string {
    const name = "oncyber:game-seat";
    try {
        const saved = storage?.getItem(name);
        if (saved && /^[A-Za-z0-9_-]{16,80}$/.test(saved)) return saved;
    } catch {
        // Storage blocked: a key for this page load only.
    }
    const bytes = new Uint8Array(18);
    globalThis.crypto.getRandomValues(bytes);
    const key = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
        ""
    );
    try {
        storage?.setItem(name, key);
    } catch {
        // As above.
    }
    return key;
}
function safeSessionStorage() {
    try {
        return globalThis.sessionStorage ?? null;
    } catch {
        return null;
    }
}

export class MatchBridge {
    private room: MatchRoom | null = null;
    private roster: PageRoster | null = null;
    private tokens = MATCH_BURST;
    private last = 0;
    private dropped = 0;
    private toldAt = 0;

    constructor(
        /**
         * `roster` ({ roster }) goes into the page's trip; `match` and
         * `match-limit` go to the game's frame.
         */
        private post: (kind: string, data: object) => void,
        private now: () => number = () => Date.now()
    ) {}

    /** Call with the room each time it connects, and null when it drops. */
    attach(room: MatchRoom | null) {
        this.room = room;
        if (!room) {
            // The game keeps its last roster, marked offline, so it can
            // carry on alone until the page is back in the room.
            if (this.roster) {
                this.roster = { ...this.roster, online: false };
                this.post("roster", { roster: this.roster });
            }
            return;
        }
        room.onMessage("game-roster", (message) => {
            if (this.room !== room) return;
            const roster = readRoomRoster(message);
            if (!roster) return;
            this.roster = roster;
            this.post("roster", { roster });
        });
        room.onMessage("game-match", (message) => {
            if (this.room !== room || !Array.isArray(message)) return;
            const [from, data] = message;
            if (typeof from === "string" && Array.isArray(data))
                this.post("match", { from, data });
        });
        room.onMessage("game-match-limit", (message) => {
            if (this.room === room)
                this.post("match-limit", {
                    dropped: Number(message?.dropped) || 1,
                });
        });
    }

    /** A `match` message from the game's frame. True when it was sent on. */
    send(message: unknown) {
        const now = this.now();
        this.tokens = Math.min(
            MATCH_BURST,
            this.tokens + ((now - this.last) / 1000) * MATCH_RATE
        );
        this.last = now;
        const packet = readMatchSend(message);
        if (!this.room || !packet || this.tokens < 1) {
            // Offline packets are simply lost; only a live refusal is news.
            if (this.room) this.refuse(now);
            return false;
        }
        this.tokens -= 1;
        try {
            this.room.send("game-match", packet);
            return true;
        } catch {
            return false;
        }
    }

    private refuse(now: number) {
        this.dropped += 1;
        if (now - this.toldAt < 1000) return;
        this.post("match-limit", { dropped: this.dropped });
        this.dropped = 0;
        this.toldAt = now;
    }
}
