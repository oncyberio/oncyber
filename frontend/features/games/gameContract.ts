/**
 * The page's half of the one game contract (docs/games/contract.md): the
 * single message prefix every game speaks, and the data the page hands a
 * game for its `enter()`: how the visitor arrived and who came along. The
 * game's half is games/runtime/src/contract.ts; a test there checks the two
 * state the same prefix and version.
 */
import type { GameParty, GamePartyMember } from "./gameParty";

export const CONTRACT_VERSION = 2;
/** Every game message is `oncyber:game:<kind>`, whatever the game's id. */
export const GAME_MESSAGE_PREFIX = "oncyber:game:";

/**
 * Which prefix a game speaks. Builds from before the contract say
 * `<id>:<kind>`; the page answers a game in the form it greeted with.
 */
export type GameDialect = "contract" | "legacy";

const KIND = /^[a-z][a-z-]{0,31}$/;

/** A game message's kind and the form it came in; null for anything else. */
export function readGameMessage(
    type: unknown,
    gameId: string
): { kind: string; dialect: GameDialect } | null {
    if (typeof type !== "string") return null;
    const forms: Array<[string, GameDialect]> = [
        [GAME_MESSAGE_PREFIX, "contract"],
        [`${gameId}:`, "legacy"],
    ];
    for (const [prefix, dialect] of forms) {
        const kind = type.slice(prefix.length);
        if (type.startsWith(prefix) && KIND.test(kind))
            return { kind, dialect };
    }
    return null;
}

/**
 * The message types to post for `kind`. Until the game has greeted the page
 * its form is unknown, so both go out; each game ignores the other's.
 */
export function gameMessageTypes(
    gameId: string,
    kind: string,
    dialect: GameDialect | null
): string[] {
    const contract = GAME_MESSAGE_PREFIX + kind;
    const legacy = `${gameId}:${kind}`;
    return dialect === "contract"
        ? [contract]
        : dialect === "legacy"
        ? [legacy]
        : [contract, legacy];
}

/**
 * A message for the game in both forms. A game hears only the prefix it
 * speaks and ignores the other, so the page never has to know which helper
 * inside a game uses which.
 */
export function bothForms<T extends { type?: unknown }>(
    gameId: string,
    message: T
): T[] {
    const kind = readGameMessage(message?.type, gameId)?.kind;
    if (!kind) return [message];
    return [
        { ...message, type: GAME_MESSAGE_PREFIX + kind },
        { ...message, type: `${gameId}:${kind}` },
    ];
}

/** What a contract game says about itself in `hello` (from its game.json). */
export interface GameDeclaration {
    contract: number;
    /** Null when the game didn't say; the page then waits as for a walkable one. */
    walkable: boolean | null;
}
export function readGameDeclaration(hello: any): GameDeclaration {
    return {
        contract: Number.isInteger(hello?.contract) ? hello.contract : 1,
        walkable:
            typeof hello?.arrival?.walkable === "boolean"
                ? hello.arrival.walkable
                : null,
    };
}

export interface GameArrivalView {
    cameraOffset: { x: number; y: number; z: number };
    cameraTargetOffset: { x: number; y: number; z: number };
    avatarRotation: number;
    avatarHeight: number;
    fov: number;
    cameraMode: "first-person" | "third-person";
}

/**
 * The lobby's last camera as a game receives it: the framing only. The
 * lobby's peers travel as the trip's members, not inside the view.
 */
export function gameArrivalView(view: any): GameArrivalView | null {
    const offset = (v: any) =>
        v && [v.x, v.y, v.z].every((n) => Number.isFinite(n))
            ? { x: v.x, y: v.y, z: v.z }
            : null;
    const cameraOffset = offset(view?.cameraOffset);
    const cameraTargetOffset = offset(view?.cameraTargetOffset);
    if (
        !cameraOffset ||
        !cameraTargetOffset ||
        !Number.isFinite(view.avatarRotation) ||
        !Number.isFinite(view.fov)
    )
        return null;
    return {
        cameraOffset,
        cameraTargetOffset,
        avatarRotation: view.avatarRotation,
        avatarHeight: Number.isFinite(view.avatarHeight)
            ? view.avatarHeight
            : 1.8,
        fov: view.fov,
        cameraMode:
            view.cameraMode === "first-person"
                ? "first-person"
                : "third-person",
    };
}

/** Someone in the party's room, as the room reports them. */
export interface GameRoomMember {
    id: string;
    name: string;
    pfp: string;
    vrm: string;
}

/** The party as a game sees it: the lobby's members plus the room's facts. */
export interface GameTrip extends GameParty {
    /** The party's own room. */
    room: string;
    /** The visitor's id in that room; empty until it connects. */
    self: string;
    /** The other members in the room now, by room id. */
    arrived: GamePartyMember[];
}

export function gameTrip(
    party: GameParty | null,
    room: string,
    self = "",
    peers: GameRoomMember[] = []
): GameTrip | null {
    if (!party) return null;
    const arrived = peers
        .slice(0, 7)
        .map(({ id, name, pfp, vrm }) => ({ id, name, pfp, avatarUrl: vrm }))
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return { ...party, room, self, arrived };
}

/** Changes only when a game would see a different trip. */
export const tripKey = (trip: GameTrip | null) =>
    trip
        ? [
              trip.id,
              trip.self,
              ...trip.members.map((m) => `${m.id}:${m.name}`),
              "|",
              ...trip.arrived.map((m) => `${m.id}:${m.name}`),
          ].join(",")
        : "";

/** The `enter` message: the page's part of the lifecycle's enter() data. */
export function enterMessage(
    fromLobby: boolean,
    view: unknown,
    trip: GameTrip | null
) {
    return {
        arrival: fromLobby
            ? { from: "lobby" as const, view: gameArrivalView(view) }
            : { from: "direct" as const, view: null },
        trip,
    };
}
