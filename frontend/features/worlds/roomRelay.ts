/**
 * The room, relayed (docs/plans/framed-worlds.md, slice 3). The page holds
 * a framed world's room connection, joined with the page's own account;
 * the world sees a room that looks like the one it has always had, carried
 * over the frame as these messages:
 *
 *   world → page   `room-join`, `room-send`, `room-leave`
 *   page → world   `room-joined`, `room-refused`, `room-state`,
 *                  `room-message`, `room-left`
 *
 * Each carries `seq`, the join it belongs to, so a late message from a
 * room the world has left is dropped.
 */

/** What the room keeps about each visitor, as the engine reads it. */
export const ROOM_PLAYER_FIELDS = [
    "sessionId",
    "userId",
    "walletId",
    "username",
    "avatar",
    "VRM",
    "space",
    "positionX",
    "positionY",
    "positionZ",
    "rotation",
    "scale",
    "user_height",
    "animation",
    "floor",
    "paused",
    "isAdmin",
] as const;

export type RoomPlayer = Record<(typeof ROOM_PLAYER_FIELDS)[number], unknown>;

/** The room's visitors as plain values: what crosses the frame. */
export function readRoomPlayers(state: any): RoomPlayer[] {
    const players: RoomPlayer[] = [];
    state?.players?.forEach?.((player: any, key: string) => {
        const plain = {} as RoomPlayer;
        for (const field of ROOM_PLAYER_FIELDS) plain[field] = player?.[field];
        plain.sessionId ||= key;
        players.push(plain);
    });
    return players;
}

const text = (value: unknown, max: number) =>
    typeof value === "string" && value.length <= max ? value : undefined;
const number = (value: unknown) =>
    Number.isFinite(Number(value)) && value !== "" && value !== null
        ? (value as number | string)
        : undefined;

/** A join as a world may ask for it. Who is joining is not the world's to say. */
export interface RoomJoinRequest {
    label: string;
    currentSpace: string;
    position: { x: number | string; y: number | string; z: number | string };
    rotationY: number | string;
    username: string;
    avatar: string;
    accessProof?: string;
    lobbyGroupCohort?: string;
}

export function readRoomJoin(value: any): RoomJoinRequest | null {
    const label = text(value?.label, 200);
    const position = {
        x: number(value?.position?.x),
        y: number(value?.position?.y),
        z: number(value?.position?.z),
    };
    const avatar = text(value?.avatar, 2048);
    if (
        !label ||
        !avatar ||
        position.x === undefined ||
        position.y === undefined ||
        position.z === undefined
    )
        return null;
    return {
        label,
        currentSpace: text(value.currentSpace, 200) || label,
        position: position as RoomJoinRequest["position"],
        rotationY: number(value.rotationY) ?? 0,
        username: text(value.username, 200) ?? "",
        avatar,
        ...(text(value.accessProof, 1024)
            ? { accessProof: value.accessProof }
            : {}),
        ...(text(value.lobbyGroupCohort, 200)
            ? { lobbyGroupCohort: value.lobbyGroupCohort }
            : {}),
    };
}

/** Who the page joins a room as. */
export interface RoomIdentity {
    userId: string;
    /** The session, lent only to the room of the space the page opened. */
    token: string;
    /** A signed-in visitor's name: the world cannot change it. */
    username?: string;
}

// What a world may say to the room about its own visitor: where they are
// and how they look, and the room's chat channel.
const OPEN = new Set([
    "move",
    "pause",
    "VRM",
    "space",
    "avatar",
    "scale",
    "chat-channel",
    "chat-peer",
    // Asking to speak, and a moderator's answer: the room passes these on
    // as any visitor's.
    "voice-request",
    "enable-voice",
    "disable-voice",
    "decline-voice",
]);

/**
 * What the page passes on for a world's `room-send`, or `undefined` to drop
 * it. Identity stays the page's: an `init` carries the page's id and name,
 * a signed-in visitor cannot be renamed, a moderator's acts carry the
 * page's session, and `login` and voice signalling never come from a world.
 */
export function filterRoomSend(
    name: unknown,
    data: unknown,
    who: RoomIdentity
): { name: string; data: unknown } | undefined {
    if (typeof name !== "string") return undefined;
    if (OPEN.has(name) || /^attr-[a-z-]{1,24}$/.test(name))
        return { name, data };
    if (name === "username")
        return who.username === undefined ? { name, data } : undefined;
    if (name === "init" && Array.isArray(data)) {
        const init = [...data];
        init[6] = who.userId;
        if (who.username !== undefined) init[8] = who.username;
        return { name, data: init };
    }
    // What only a moderator may do, the room checks against the session,
    // which is the page's to add.
    if (name === "voice-range" && Array.isArray(data))
        return { name, data: [data[0], who.token] };
    if (name === "kick" && Array.isArray(data))
        return { name, data: [who.token, data[1]] };
    return undefined;
}
