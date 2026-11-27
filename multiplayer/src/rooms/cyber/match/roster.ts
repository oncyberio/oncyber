import { createHash } from "crypto";

import { MATCH_AWAY_MS, MATCH_PLAYER_SEATS, MATCH_ROSTER_MAX } from "./limits";

// Who is in a party's room, in arrival order: which member is host, who
// holds a player seat, who watches, and who dropped but may come back. Pure
// state with no sockets or timers, so the rules can be tested directly.

export type Seat = "player" | "spectator";

export interface RosterProfile {
    name: string;
    pfp: string;
    avatarUrl: string;
}

export interface RosterMember extends RosterProfile {
    /**
     * Public and stable. Derived from the seat key, so the same page is
     * the same member after a reconnect, a reload or a room that was
     * recreated; without a key, the session id it joined with.
     */
    id: string;
    /** Current session id, "" while away. */
    session: string;
    /** Private: lets the same page take its seat back after a drop. */
    key: string;
    seat: Seat;
    state: "here" | "away";
    order: number;
    /** When an away member's seat is released. */
    awayUntil: number;
}

export interface RosterView {
    host: string;
    members: Array<
        RosterProfile & {
            id: string;
            session: string;
            seat: Seat;
            state: "here" | "away";
            order: number;
        }
    >;
}

const KEY = /^[A-Za-z0-9_-]{16,80}$/;

/** The public member id for a seat key: one way, so it gives no seat away. */
export const seatId = (key: string) => createHash("sha256").update(`oncyber-seat:${key}`).digest("base64url").slice(0, 16);

export class PartyRoster {
    members: RosterMember[] = [];
    host = "";
    private nextOrder = 1;

    constructor(private playerSeats = MATCH_PLAYER_SEATS, private awayMs = MATCH_AWAY_MS, private max = MATCH_ROSTER_MAX) {}

    bySession(session: string) {
        return session ? this.members.find((m) => m.session === session) ?? null : null;
    }

    byId(id: string) {
        return this.members.find((m) => m.id === id) ?? null;
    }

    /**
     * A session arrives. With the key of a member already on the roster it
     * takes that member's place (a reconnect); `replaced` is then the
     * session it took over from, if that one was still connected. Null
     * when the roster is full.
     */
    join(session: string, key: unknown, profile: RosterProfile): { member: RosterMember; replaced: string } | null {
        const secret = typeof key === "string" && KEY.test(key) ? key : "";
        const known = secret ? this.members.find((m) => m.key === secret) : null;
        if (known) {
            const replaced = known.state === "here" ? known.session : "";
            Object.assign(known, profile, {
                session,
                state: "here",
                awayUntil: 0,
            });
            this.settle();
            return { member: known, replaced };
        }
        if (this.members.length >= this.max) return null;
        const member: RosterMember = {
            ...profile,
            id: secret ? seatId(secret) : session,
            session,
            key: secret,
            seat: this.members.filter((m) => m.seat === "player").length < this.playerSeats ? "player" : "spectator",
            state: "here",
            order: this.nextOrder++,
            awayUntil: 0,
        };
        this.members.push(member);
        this.settle();
        return { member, replaced: "" };
    }

    /**
     * A session is gone. Leaving on purpose frees the seat at once; a
     * dropped connection holds it until `awayUntil`. Returns whether the
     * roster changed (a session that was already replaced changes nothing).
     */
    leave(session: string, consented: boolean, now: number) {
        const member = this.bySession(session);
        if (!member) return false;
        if (consented) this.members.splice(this.members.indexOf(member), 1);
        else
            Object.assign(member, {
                session: "",
                state: "away",
                awayUntil: now + this.awayMs,
            });
        this.settle();
        return true;
    }

    /** Release the seats of members who stayed away too long. */
    sweep(now: number) {
        const before = this.members.length;
        this.members = this.members.filter((m) => m.state === "here" || m.awayUntil > now);
        if (this.members.length === before) return false;
        this.settle();
        return true;
    }

    /** Fill free player seats and keep exactly one host among those here. */
    private settle() {
        let seated = this.members.filter((m) => m.seat === "player").length;
        for (const member of this.members) {
            if (seated >= this.playerSeats) break;
            if (member.seat === "spectator") {
                member.seat = "player";
                seated++;
            }
        }
        const host = this.byId(this.host);
        if (host?.state === "here") return;
        // The role moves to the earliest arrival still here, players first,
        // and stays there when the old host returns.
        const here = this.members.filter((m) => m.state === "here");
        this.host = (here.find((m) => m.seat === "player") ?? here[0])?.id ?? "";
    }

    view(): RosterView {
        return {
            host: this.host,
            members: this.members.map(({ id, session, seat, state, order, name, pfp, avatarUrl }) => ({
                id,
                session,
                seat,
                state,
                order,
                name,
                pfp,
                avatarUrl,
            })),
        };
    }
}

/** Token bucket: `rate` a second on average, `burst` at once. */
export class PacketBudget {
    private tokens: number;
    private last: number;

    constructor(private rate: number, private burst: number, now: number) {
        this.tokens = burst;
        this.last = now;
    }

    take(now: number) {
        this.tokens = Math.min(this.burst, this.tokens + ((now - this.last) / 1000) * this.rate);
        this.last = now;
        if (this.tokens < 1) return false;
        this.tokens -= 1;
        return true;
    }
}
