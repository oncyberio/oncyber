/**
 * Who is in the party's room right now, as the server sees it: members in
 * arrival order, which of them is host, who holds a player seat and who
 * watches, and who dropped but may come back. Pure data and rules; the
 * page delivers a new roster whenever it changes (`<game>:roster`).
 *
 * A member's `id` stays the same across a reconnect, so a draw or a score
 * keyed by it survives a dropped connection. `session` is the member's
 * current id in the room (what `peers` entries use) and changes.
 */

export type Seat = "player" | "spectator";
export interface RosterMember {
    /** Stable for the whole visit, reconnects included. */
    id: string;
    /** The member's current room id; "" while they are away. */
    session: string;
    name: string;
    pfp: string;
    avatarUrl: string;
    /** The server gives the first eight arrivals a player seat. */
    seat: Seat;
    /** "away": the connection dropped and the seat is being held. */
    state: "here" | "away";
    /** Arrival order; lower came first. */
    order: number;
}
export interface Roster {
    /** This client's member id; "" before the room has answered. */
    self: string;
    /** The host's member id. Moves to the next member when the host drops. */
    host: string;
    /** False while this client's own connection is down. */
    online: boolean;
    members: RosterMember[];
}

export type RosterEvent =
    /** `late` is true for anyone who arrives after this client did. */
    | { type: "arrived"; member: RosterMember; late: boolean }
    | { type: "dropped"; member: RosterMember }
    | { type: "returned"; member: RosterMember }
    | { type: "left"; member: RosterMember }
    | { type: "seat"; member: RosterMember }
    /** `member` is null only when the room is empty of hosts (never while online). */
    | { type: "host"; member: RosterMember | null; self: boolean }
    | { type: "offline" }
    | { type: "online" };

export const ROSTER_MAX = 32;
export const EMPTY_ROSTER: Roster = Object.freeze({
    self: "",
    host: "",
    online: false,
    members: [],
}) as Roster;

const text = (value: unknown, max: number) =>
    typeof value === "string" ? value.slice(0, max) : "";

/** A roster from the page, with anything malformed dropped. */
export function readRoster(value: unknown): Roster {
    const raw = value as Partial<Record<keyof Roster, unknown>> | null;
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.members))
        return EMPTY_ROSTER;
    const seen = new Set<string>();
    const members: RosterMember[] = [];
    for (const entry of raw.members.slice(0, ROSTER_MAX)) {
        const id = text(entry?.id, 64);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        members.push({
            id,
            session: text(entry?.session, 64),
            name: text(entry?.name, 24).trim() || "Player",
            pfp: text(entry?.pfp, 2048),
            avatarUrl: text(entry?.avatarUrl, 2048),
            seat: entry?.seat === "spectator" ? "spectator" : "player",
            state: entry?.state === "away" ? "away" : "here",
            order: Number.isFinite(entry?.order)
                ? Number(entry.order)
                : members.length,
        });
    }
    members.sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : 1));
    const self = text(raw.self, 64);
    const host = text(raw.host, 64);
    return {
        self: seen.has(self) ? self : "",
        host: seen.has(host) ? host : "",
        online: raw.online !== false,
        members,
    };
}

/** What changed between two rosters, in the order a game should react. */
export function rosterEvents(
    previous: Roster | null,
    next: Roster
): RosterEvent[] {
    const events: RosterEvent[] = [];
    const before = new Map((previous?.members ?? []).map((m) => [m.id, m]));
    const after = new Map(next.members.map((m) => [m.id, m]));
    // Anyone listed in the first roster was here before this client: not late.
    const late = Boolean(previous?.self);
    if (previous && previous.online !== next.online)
        events.push({ type: next.online ? "online" : "offline" });
    for (const member of previous?.members ?? [])
        if (!after.has(member.id)) events.push({ type: "left", member });
    for (const member of next.members) {
        const was = before.get(member.id);
        if (!was)
            events.push({
                type: "arrived",
                member,
                late: late && member.id !== next.self,
            });
        else {
            if (was.state === "here" && member.state === "away")
                events.push({ type: "dropped", member });
            if (was.state === "away" && member.state === "here")
                events.push({ type: "returned", member });
            if (was.seat === "spectator" && member.seat === "player")
                events.push({ type: "seat", member });
        }
    }
    if (
        (previous?.host ?? "") !== next.host ||
        (previous?.self ?? "") !== next.self
    )
        if (next.host || previous?.host)
            events.push({
                type: "host",
                member: after.get(next.host) ?? null,
                self: Boolean(next.host) && next.host === next.self,
            });
    return events;
}

export const memberById = (roster: Roster, id: string) =>
    roster.members.find((m) => m.id === id) ?? null;
export const isHost = (roster: Roster) =>
    Boolean(roster.self) && roster.self === roster.host;

/**
 * Seats for a game that plays `capacity` at a time: the first arrivals
 * play, the rest watch. A member who is away keeps their seat until the
 * server lets it go, so a reconnect returns them to the same place.
 */
export function assignSeats(
    roster: Roster,
    capacity: number
): { players: RosterMember[]; spectators: RosterMember[] } {
    const seated = roster.members.filter((m) => m.seat === "player");
    const players = seated.slice(0, Math.max(0, capacity));
    const playing = new Set(players.map((m) => m.id));
    return {
        players,
        spectators: roster.members.filter((m) => !playing.has(m.id)),
    };
}

/**
 * Which member runs a match between `players` (member ids): the host when
 * the host is playing, else the earliest arrival still here. Every member
 * computes the same answer from the same roster, and it moves when that
 * member drops, so a match always has exactly one authority.
 */
export function matchAuthority(
    roster: Roster,
    players: readonly string[]
): string {
    if (
        players.includes(roster.host) &&
        memberById(roster, roster.host)?.state === "here"
    )
        return roster.host;
    return (
        roster.members.find((m) => m.state === "here" && players.includes(m.id))
            ?.id ?? ""
    );
}
