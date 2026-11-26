/**
 * The one contract between a game and the page that hosts it: what a visit
 * hands to `enter()` (how the visitor arrived, and with whom), and the one
 * message prefix both sides speak. Pure data and readers: no DOM, usable in
 * the game, the page's tests and the check script. See docs/games/contract.md.
 *
 * `frontend/features/games/contract/gameContract.ts` is the page's half; a test in
 * games/runtime/test/contract.test.mjs keeps the two in step.
 */
import { readRoster, type Roster } from "./roster.ts";

/**
 * Raised when the messages or the enter data change shape or meaning. The
 * page reads it from `hello` and says so when a build is older than it
 * speaks (frontend/features/games/contract/gameContract.ts, `contractSupport`).
 *
 * 2  `oncyber:game:<kind>` for every game; `enter` carries the visit.
 * 3  Keys: M on its own is the game's; the page's chords arrive as
 *    `key` with `mod: true` (keys.ts). The `storage` message and the
 *    values in `identity` are gone: saved data is saved.ts.
 *
 * Every kind, who sends it and where each side handles it:
 * games/runtime/messages.json.
 */
export const CONTRACT_VERSION = 3;

/** Every game message is `oncyber:game:<kind>`, whatever the game's id. */
export const GAME_MESSAGE_PREFIX = "oncyber:game:";

/** Games built before contract 2 say `<id>:<kind>`; the page still answers them. */
export const legacyMessagePrefix = (gameId: string) => `${gameId}:`;

/**
 * The kind of a game message, or null when `type` isn't one. With `gameId`,
 * the game's old `<id>:<kind>` form is read too.
 */
export function gameMessageKind(type: unknown, gameId?: string): string | null {
    if (typeof type !== "string") return null;
    for (const prefix of gameId
        ? [GAME_MESSAGE_PREFIX, legacyMessagePrefix(gameId)]
        : [GAME_MESSAGE_PREFIX])
        if (
            type.startsWith(prefix) &&
            /^[a-z][a-z-]{0,31}$/.test(type.slice(prefix.length))
        )
            return type.slice(prefix.length);
    return null;
}

export interface Offset {
    x: number;
    y: number;
    z: number;
}
/**
 * The lobby's last third-person frame, relative to the avatar's feet, so a
 * game can stand the visitor in the same framing before it is revealed.
 */
export interface ArrivalView {
    cameraOffset: Offset;
    cameraTargetOffset: Offset;
    /** Radians, the avatar's facing in the lobby. */
    avatarRotation: number;
    /** Metres; 1.8 when the lobby didn't say. */
    avatarHeight: number;
    /** Vertical field of view in degrees. */
    fov: number;
    cameraMode: "first-person" | "third-person";
}
export interface Arrival {
    /** `lobby`: travelled here and is revealed in place. `direct`: opened the game's page. */
    from: "lobby" | "direct";
    /** Null on a direct visit, or when the lobby sent no camera. */
    view: ArrivalView | null;
}
/** Public presentation fields only. A hint for matchmaking, never proof of who someone is. */
export interface TripMember {
    id: string;
    name: string;
    pfp: string;
    avatarUrl: string;
}
/** The party a visitor travelled with. */
export interface Trip {
    /** Same for every member of this trip. Seed shared draws with it. */
    id: string;
    /** The party's own room; `self`, `arrived` and relayed packets come from it. */
    room: string;
    /** Members including the visitor, two to eight. */
    size: number;
    /** The other members the lobby named on the way in (lobby ids). */
    members: TripMember[];
    /** The visitor's id in the party room; empty until the room connects. */
    self: string;
    /**
     * The other members now in the party room (room ids, the same on every
     * member's screen). Once this isn't empty it is who actually arrived.
     */
    arrived: TripMember[];
    /**
     * The party room's roster, once the room has sent one: members in
     * arrival order with ids that survive a reconnect, the host, seats and
     * who dropped (roster.ts, docs/games/party.md). Null until then.
     */
    roster: Roster | null;
}
/** What the page sends as `enter`: the part of `enter()`'s data only it knows. */
export interface EnterData {
    arrival: Arrival;
    trip: Trip | null;
}

export const DIRECT_ENTER: EnterData = Object.freeze({
    arrival: Object.freeze({ from: "direct", view: null }) as Arrival,
    trip: null,
});

const MAX_OTHERS = 7;
/** Characters of a name a game is given: the visitor's and each member's. */
export const NAME_MAX = 24;
/** The bounds of an arrival view; the page sends nothing outside them. */
export const ARRIVAL_VIEW_LIMITS = Object.freeze({
    /** Metres, each axis of an offset. */
    offset: 1000,
    /** Radians. */
    rotation: 1e6,
    /** Degrees, exclusive. */
    fov: Object.freeze([5, 150] as const),
    /** Metres, inclusive; 1.8 outside them. */
    avatarHeight: Object.freeze([0.2, 10] as const),
});
const text = (value: unknown, max: number) =>
    typeof value === "string" ? value.trim().slice(0, max) : "";
const offset = (v: any): Offset | null =>
    v &&
    [v.x, v.y, v.z].every(
        (n: unknown) =>
            typeof n === "number" &&
            Number.isFinite(n) &&
            Math.abs(n) <= ARRIVAL_VIEW_LIMITS.offset
    )
        ? { x: v.x, y: v.y, z: v.z }
        : null;

/** A bounded copy of an arrival view; null when malformed. */
export function readArrivalView(value: any): ArrivalView | null {
    const cameraOffset = offset(value?.cameraOffset),
        cameraTargetOffset = offset(value?.cameraTargetOffset);
    if (!cameraOffset || !cameraTargetOffset) return null;
    if (
        typeof value.avatarRotation !== "number" ||
        !Number.isFinite(value.avatarRotation) ||
        Math.abs(value.avatarRotation) > ARRIVAL_VIEW_LIMITS.rotation
    )
        return null;
    const [fovMin, fovMax] = ARRIVAL_VIEW_LIMITS.fov;
    if (
        !(
            typeof value.fov === "number" &&
            value.fov > fovMin &&
            value.fov < fovMax
        )
    )
        return null;
    const [heightMin, heightMax] = ARRIVAL_VIEW_LIMITS.avatarHeight;
    return {
        cameraOffset,
        cameraTargetOffset,
        avatarRotation: value.avatarRotation,
        avatarHeight:
            typeof value.avatarHeight === "number" &&
            value.avatarHeight >= heightMin &&
            value.avatarHeight <= heightMax
                ? value.avatarHeight
                : 1.8,
        fov: value.fov,
        cameraMode:
            value.cameraMode === "first-person"
                ? "first-person"
                : "third-person",
    };
}

function readMembers(value: unknown): TripMember[] {
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    const members: TripMember[] = [];
    for (const item of value.slice(0, 32)) {
        const id = text(item?.id, 64);
        if (!id || seen.has(id) || members.length >= MAX_OTHERS) continue;
        seen.add(id);
        members.push({
            id,
            name: text(item?.name, NAME_MAX) || "Player",
            pfp: text(item?.pfp, 2048),
            avatarUrl: text(item?.avatarUrl, 2048),
        });
    }
    return members;
}

/** A bounded copy of a trip; null when alone or malformed. */
export function readTrip(value: any): Trip | null {
    const id = text(value?.id, 96);
    if (!id) return null;
    const members = readMembers(value.members),
        arrived = readMembers(value.arrived);
    const roster = value.roster ? readRoster(value.roster) : null;
    const size = Number.isInteger(value.size)
        ? Math.max(2, Math.min(MAX_OTHERS + 1, value.size))
        : 0;
    return {
        id,
        room: text(value.room, 160),
        size: Math.max(size, members.length + 1, arrived.length + 1, 2),
        members,
        self: text(value.self, 64),
        arrived,
        roster: roster?.members.length ? roster : null,
    };
}

/** Never throws: anything malformed reads as a direct, solo visit. */
export function readEnterData(value: any): EnterData {
    const from = value?.arrival?.from === "lobby" ? "lobby" : "direct";
    return {
        arrival: {
            from,
            view: from === "lobby" ? readArrivalView(value.arrival.view) : null,
        },
        trip: readTrip(value?.trip),
    };
}

/**
 * Everyone in the party, the visitor first, with ids every member agrees
 * on when possible: the roster's player seats once the party's room has
 * sent it (ids that survive a reconnect), else the party room's ids once
 * anyone else has arrived, until then the members the lobby named.
 */
export function tripPlayers(
    trip: Trip | null,
    me: { name: string }
): Array<{ id: string; name: string }> {
    if (!trip) return [{ id: "self", name: me.name }];
    const self = trip.roster?.self;
    const seated =
        trip.roster?.members.filter((m) => m.seat === "player") ?? [];
    if (self && seated.length > 1)
        return [
            ...seated
                .filter((m) => m.id === self)
                .map(({ id }) => ({ id, name: me.name })),
            ...seated
                .filter((m) => m.id !== self)
                .map(({ id, name }) => ({ id, name })),
        ];
    if (trip.self && trip.arrived.length)
        return [
            { id: trip.self, name: me.name },
            ...trip.arrived.map(({ id, name }) => ({ id, name })),
        ];
    return [
        { id: "self", name: me.name },
        ...trip.members.map(({ id, name }) => ({ id, name })),
    ];
}
