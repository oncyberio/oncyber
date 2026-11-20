import { Client, Room } from "colyseus";

import { MATCH_BURST, MATCH_MAX_BYTES, MATCH_RATE, isPartyRoom } from "../match/limits";
import { PacketBudget, PartyRoster } from "../match/roster";

// A party's room (see frontend/features/games/gameParty.ts) gets two things
// the shared rooms don't: a roster ("game-roster": members in arrival
// order, the host, seats, who dropped) and a real-time channel between its
// members ("game-match", about thirty small packets a second each). The
// chat relay stays as it is for slow state. Both are plain messages, out
// of the synced schema.
//
// The server relays packets without reading them. What it enforces: only
// members holding a player seat send, each within MATCH_RATE packets a
// second and MATCH_MAX_BYTES a packet; the rest is dropped and the sender
// is told how many (at most once a second).

/** Close code for a session whose seat was taken over by a reconnect. */
export const MATCH_REPLACED = 4001;

type Budget = { budget: PacketBudget; dropped: number; toldAt: number };

const text = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : "");

function decoded(value: unknown) {
    const raw = text(value, 400);
    try {
        return decodeURIComponent(raw);
    } catch (err) {
        return raw;
    }
}

export class MatchChannel {
    readonly roster = new PartyRoster();
    private budgets = new Map<string, Budget>();
    private sweeper: { clear(): void } | null = null;

    private constructor(private room: Room) {
        room.onMessage("game-match", (client, message) => this.relay(client, message));
        this.sweeper = room.clock.setInterval(() => {
            if (this.roster.sweep(Date.now())) this.announce();
        }, 1000);
    }

    /** Null for any room that isn't a party's: those keep no roster. */
    static for(room: Room, label: unknown) {
        return isPartyRoom(label) ? new MatchChannel(room) : null;
    }

    join(client: Client, options: any) {
        const joined = this.roster.join(client.sessionId, options?.matchKey, {
            name: decoded(options?.username).slice(0, 24),
            pfp: text(options?.avatar, 2048),
            avatarUrl: text(options?.VRM, 2048),
        });
        if (!joined) return;
        if (joined.replaced) {
            this.budgets.delete(joined.replaced);
            this.room.clients.find((c) => c.sessionId === joined.replaced)?.leave(MATCH_REPLACED);
        }
        this.budgets.set(client.sessionId, {
            budget: new PacketBudget(MATCH_RATE, MATCH_BURST, Date.now()),
            dropped: 0,
            toldAt: 0,
        });
        this.announce();
    }

    leave(client: Client, consented: boolean) {
        this.budgets.delete(client.sessionId);
        if (this.roster.leave(client.sessionId, consented, Date.now())) this.announce();
    }

    dispose() {
        this.sweeper?.clear();
        this.budgets.clear();
    }

    /** Everyone gets the roster, each with their own member id as `self`. */
    private announce() {
        const view = this.roster.view();
        for (const client of this.room.clients) {
            const self = this.roster.bySession(client.sessionId);
            if (self) client.send("game-roster", { ...view, self: self.id });
        }
    }

    private relay(client: Client, message: any) {
        const sender = this.roster.bySession(client.sessionId);
        const state = this.budgets.get(client.sessionId);
        if (!sender || !state) return;
        const now = Date.now();
        const data = message?.data;
        let allowed = sender.seat === "player" && Array.isArray(data);
        if (allowed) allowed = state.budget.take(now);
        if (allowed) {
            try {
                allowed = JSON.stringify(data).length <= MATCH_MAX_BYTES;
            } catch (err) {
                allowed = false;
            }
        }
        if (!allowed) {
            state.dropped += 1;
            if (now - state.toldAt >= 1000) {
                client.send("game-match-limit", { dropped: state.dropped });
                state.dropped = 0;
                state.toldAt = now;
            }
            return;
        }
        const to = typeof message?.to === "string" ? message.to : "";
        const envelope = [sender.id, data];
        for (const peer of this.room.clients) {
            if (peer === client) continue;
            const member = this.roster.bySession(peer.sessionId);
            if (member && (!to || member.id === to)) peer.send("game-match", envelope);
        }
    }
}
