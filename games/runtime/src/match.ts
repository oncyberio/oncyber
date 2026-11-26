/**
 * The real-time match channel between party members: 20 to 30 small
 * packets a second each, for games where members play each other (a rally,
 * a race). The slower relay (`net`) stays the place for turn state.
 *
 * The server enforces the limits below per sender and drops what exceeds
 * them, so this side paces itself to stay inside them: `state()` keeps
 * only the newest value (a late snapshot is worthless), `event()` queues
 * things that must each arrive (a hit, a point), and `pump()` sends what
 * the pace allows, once per frame.
 *
 * The limits are the server's (multiplayer/src/rooms/cyber/match/limits.ts)
 * and the page's (frontend/features/games/room/gameMatch.ts): the same three
 * numbers in all three files, held together by games/runtime/test/parity.test.mjs.
 */
/** Packets a second a member may send, averaged: the channel's limit. */
export const MATCH_RATE = 32;
/** How far ahead of the average a member may briefly get. */
export const MATCH_BURST = 16;
/**
 * The pace this side sends at: two under the limit, so a timer that fires
 * late and then catches up never crosses it.
 */
export const MATCH_SEND_RATE = 30;
/** Characters of JSON one packet may be on the wire, envelope included. */
export const MATCH_MAX_BYTES = 1200;
/** Events waiting for a send slot; older ones are dropped past this. */
export const MATCH_EVENT_QUEUE = 32;

export type MatchKind = "state" | "event";
export interface MatchPacket {
    from: string;
    kind: MatchKind;
    seq: number;
    data: unknown;
}
export interface MatchChannelOptions {
    /** Hands one packet to the page; `to` narrows it to one member. */
    post(packet: unknown, to?: string): void;
    now?: () => number;
    /** Packets a second, at most MATCH_SEND_RATE. */
    rate?: number;
}
export interface MatchStats {
    sent: number;
    /** Too large to send, or pushed out of a full event queue. */
    dropped: number;
    received: number;
    /** State packets that arrived after a newer one from the same sender. */
    stale: number;
    /** Packets the server reported dropping for rate or size. */
    limited: number;
}

/** Wire size the server measures: the JSON text of `[seq, kind, data]`. */
export function packetBytes(packet: unknown): number {
    try {
        return JSON.stringify(packet ?? null).length;
    } catch {
        return Infinity;
    }
}

export function createMatchChannel(options: MatchChannelOptions) {
    const now = options.now ?? (() => performance.now());
    const interval =
        1000 /
        Math.min(MATCH_SEND_RATE, Math.max(1, options.rate ?? MATCH_SEND_RATE));
    const stats: MatchStats = {
        sent: 0,
        dropped: 0,
        received: 0,
        stale: 0,
        limited: 0,
    };
    const events: { data: unknown; to?: string }[] = [];
    const lastState = new Map<string, number>();
    let pending: { data: unknown } | null = null;
    let seq = 0;
    let nextAt = 0;

    function send(kind: 0 | 1, data: unknown, to?: string) {
        const packet = [++seq, kind, data];
        if (packetBytes(packet) > MATCH_MAX_BYTES) {
            stats.dropped++;
            return false;
        }
        options.post(packet, to);
        stats.sent++;
        return true;
    }

    return {
        stats,
        /** The newest state to send; replaces one still waiting for a slot. */
        state(data: unknown) {
            pending = { data };
        },
        /** Something every receiver must get, in order. `to`: one member. */
        event(data: unknown, to?: string) {
            events.push({ data, to });
            if (events.length > MATCH_EVENT_QUEUE) {
                events.shift();
                stats.dropped++;
            }
        },
        /** Call once per frame. Sends at most one packet per pace interval. */
        pump() {
            const time = now();
            let sent = 0;
            // Catch up by at most two slots after a long frame, never a burst.
            if (nextAt < time - interval * 2) nextAt = time - interval * 2;
            while (nextAt <= time && (events.length || pending)) {
                const event = events.shift();
                if (event) send(1, event.data, event.to);
                else {
                    send(0, pending!.data);
                    pending = null;
                }
                nextAt += interval;
                sent++;
            }
            return sent;
        },
        /**
         * Send up to four waiting events now, ahead of the pace: for the
         * last words before a tab is hidden or a game leaves, when no
         * later frame will come to pump them.
         */
        flush() {
            let sent = 0;
            while (events.length && sent < 4) {
                const event = events.shift()!;
                send(1, event.data, event.to);
                nextAt = Math.max(nextAt, now()) + interval;
                sent++;
            }
            return sent;
        },
        /** A packet from the page. Null when malformed or a stale state. */
        receive(from: unknown, packet: unknown): MatchPacket | null {
            if (typeof from !== "string" || !from || !Array.isArray(packet))
                return null;
            const [n, kind, data] = packet;
            if (!Number.isInteger(n) || (kind !== 0 && kind !== 1)) return null;
            stats.received++;
            if (kind === 0) {
                if (n <= (lastState.get(from) ?? 0)) {
                    stats.stale++;
                    return null;
                }
                lastState.set(from, n);
            }
            return { from, kind: kind === 0 ? "state" : "event", seq: n, data };
        },
        /** A sender starts over (reconnected, reloaded): accept its low seq. */
        forget(from: string) {
            lastState.delete(from);
        },
        /** The server said it dropped `count` of this client's packets. */
        limited(count: number) {
            stats.limited += Math.max(0, Math.floor(count) || 0);
        },
    };
}
export type MatchChannel = ReturnType<typeof createMatchChannel>;
