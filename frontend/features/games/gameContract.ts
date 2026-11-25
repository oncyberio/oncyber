/**
 * The page's half of the one game contract (docs/games/contract.md): the
 * single message prefix every game speaks, and the data the page hands a
 * game for its `enter()`: how the visitor arrived and who came along. The
 * game's half is games/runtime/src/contract.ts.
 *
 * The two halves are held together by games/runtime/test/parity.test.mjs:
 * the same version, prefix and limits, and the same answer from both
 * readers for every case in games/runtime/test/contract.fixtures.json.
 * Every message kind, who sends it and the file on each side that handles
 * it is one list: games/runtime/messages.json.
 */
import type { GameParty, GamePartyMember } from "./gameParty";
import type { PageRoster } from "./gameMatch";

/** What this page speaks. The history is in games/runtime/src/contract.ts. */
export const CONTRACT_VERSION = 3;
/**
 * The oldest contract this page still runs. A build between this and
 * `CONTRACT_VERSION` loads and is reported as out of date; one below it, or
 * one newer than the page, is not loaded (`contractSupport`).
 */
export const CONTRACT_OLDEST = 2;
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

/** How the page treats the contract a game greeted with. */
export type ContractSupport =
    /** The page's own version. */
    | "current"
    /** Older, and still run: say so, the build needs rebuilding. */
    | "older"
    /** Older than the page can speak to: not loaded. */
    | "too-old"
    /** Newer than this page: not loaded, the site needs deploying. */
    | "too-new";

export function contractSupport(version: number): ContractSupport {
    if (version === CONTRACT_VERSION) return "current";
    if (version > CONTRACT_VERSION) return "too-new";
    return version >= CONTRACT_OLDEST ? "older" : "too-old";
}

/** What to tell a developer about a game whose contract is not the page's. */
export function contractNotice(game: string, version: number): string | null {
    const support = contractSupport(version);
    if (support === "current") return null;
    const base = `${game} speaks game contract ${version}; this page speaks ${CONTRACT_VERSION}.`;
    return support === "older"
        ? `${base} It still loads. Rebuild it on the current runtime (pnpm games:publish ${game}).`
        : support === "too-old"
        ? `${base} The oldest this page runs is ${CONTRACT_OLDEST}: it was not loaded. Rebuild it on the current runtime.`
        : `${base} It was built for a newer site and was not loaded.`;
}

/** Characters of a name a game is given; the runtime cuts at the same length. */
export const GAME_NAME_MAX = 24;
/** A name as a game gets it. */
export const gameName = (name: unknown): string =>
    typeof name === "string" ? name.trim().slice(0, GAME_NAME_MAX) : "";

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
 *
 * The bounds are the runtime's (`ARRIVAL_VIEW_LIMITS` and `readArrivalView`
 * in games/runtime/src/contract.ts): a view the game would refuse is not
 * sent, so the page and the game never disagree on whether there is one.
 */
export function gameArrivalView(view: any): GameArrivalView | null {
    const number = (n: unknown): n is number =>
        typeof n === "number" && Number.isFinite(n);
    const offset = (v: any) =>
        v && [v.x, v.y, v.z].every((n) => number(n) && Math.abs(n) <= 1000)
            ? { x: v.x, y: v.y, z: v.z }
            : null;
    const cameraOffset = offset(view?.cameraOffset);
    const cameraTargetOffset = offset(view?.cameraTargetOffset);
    if (
        !cameraOffset ||
        !cameraTargetOffset ||
        !number(view.avatarRotation) ||
        Math.abs(view.avatarRotation) > 1e6 ||
        !number(view.fov) ||
        view.fov <= 5 ||
        view.fov >= 150
    )
        return null;
    return {
        cameraOffset,
        cameraTargetOffset,
        avatarRotation: view.avatarRotation,
        avatarHeight:
            number(view.avatarHeight) &&
            view.avatarHeight >= 0.2 &&
            view.avatarHeight <= 10
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
    /**
     * The room's roster once it has sent one: arrival order, the host,
     * seats, who dropped (docs/games/party.md). Null until then.
     */
    roster: PageRoster | null;
}

export function gameTrip(
    party: GameParty | null,
    room: string,
    self = "",
    peers: GameRoomMember[] = [],
    roster: PageRoster | null = null
): GameTrip | null {
    if (!party) return null;
    const arrived = peers
        .slice(0, 7)
        .map(({ id, name, pfp, vrm }) => ({
            id,
            name: gameName(name) || "Player",
            pfp,
            avatarUrl: vrm,
        }))
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return { ...party, room, self, arrived, roster };
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
              "|",
              trip.roster ? JSON.stringify(trip.roster) : "",
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
