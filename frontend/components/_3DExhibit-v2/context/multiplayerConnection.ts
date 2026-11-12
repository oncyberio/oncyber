/**
 * The visitor's link to a world's room, as a pure state machine.
 *
 * `MultiplayerProvider` holds the value and applies `connectionTransition`.
 * It keeps everything that touches the room, the engine or a timer. A room
 * that closes underneath the visitor is reported by `hooks/useRoom.tsx`;
 * `reportedConnection` adds that as "lost".
 *
 *   any ─ connect ─▶ connecting ─ joined ─▶ connected
 *   connecting ─ failed ─▶ failed
 *   connecting ─ cancelled ─▶ idle
 *   connecting | connected ─ ended(reason) ─▶ removed | password-changed |
 *                                             inactive
 *   any ─ rejoin ─▶ rejoining ─ connect ─▶ connecting
 *   rejoining ─ cancelled ─▶ idle
 *   any ─ closed ─▶ idle, except an ending or rejoining, which stay
 *   any ─ solo ─▶ idle
 *
 * An ending is a close the visitor did not choose. It stays, so it can be
 * explained, until the next attempt or until the visitor picks solo. "idle"
 * is solo by choice, or nothing attempted yet: there is nothing to explain.
 * "rejoining" is the old room being closed before the next attempt; the
 * visitor is told "connecting" throughout.
 */

/**
 * Why a room was closed for the visitor, when the client knows:
 * a moderator removed them, the world's password changed, or they were away
 * for too long.
 */
export type MultiplayerEndReason = "removed" | "password-changed" | "inactive";

/** What the provider stores. */
export type MultiplayerAdmission =
    | "idle"
    | "rejoining"
    | "connecting"
    | "connected"
    | "failed"
    | MultiplayerEndReason;

/**
 * Where the visitor's link to the world's room stands. "idle" is solo, or
 * nothing attempted yet: there is no connection to report. "failed" is an
 * attempt that did not get in; "lost" is a room that closed underneath us
 * for a reason the client was not told.
 */
export type MultiplayerConnection =
    | Exclude<MultiplayerAdmission, "rejoining">
    | "lost";

export type MultiplayerConnectionEvent =
    /** An attempt to join starts. */
    | { type: "connect" }
    /** The attempt got in. */
    | { type: "joined" }
    /** The attempt did not get in. */
    | { type: "failed" }
    /** The attempt was closed or replaced before it finished. */
    | { type: "cancelled" }
    /** The room was closed for a reason the visitor did not choose. */
    | { type: "ended"; reason: MultiplayerEndReason }
    /** The visitor asked to join again: the old room is closed first. */
    | { type: "rejoin" }
    /** The connections were closed. Says nothing about why. */
    | { type: "closed" }
    /** The visitor picked solo. */
    | { type: "solo" };

const END_REASONS: readonly string[] = [
    "removed",
    "password-changed",
    "inactive",
];

export const isEndReason = (
    connection: MultiplayerAdmission | MultiplayerConnection
): connection is MultiplayerEndReason => END_REASONS.includes(connection);

export function connectionTransition(
    state: MultiplayerAdmission,
    event: MultiplayerConnectionEvent
): MultiplayerAdmission {
    switch (event.type) {
        case "connect":
            return "connecting";
        case "joined":
            return state === "connecting" ? "connected" : state;
        case "failed":
            return state === "connecting" ? "failed" : state;
        case "cancelled":
            return state === "connecting" || state === "rejoining"
                ? "idle"
                : state;
        case "ended":
            // Only a room the visitor was in, or on the way into, can end.
            return state === "connecting" || state === "connected"
                ? event.reason
                : state;
        case "rejoin":
            return "rejoining";
        case "closed":
            return isEndReason(state) || state === "rejoining" ? state : "idle";
        case "solo":
            return "idle";
        default:
            return state;
    }
}

/** The stored state as the visitor is told it. */
export function reportedConnection(
    admission: MultiplayerAdmission,
    /** The joined room closed underneath the visitor. */
    lost: boolean
): MultiplayerConnection {
    if (admission === "rejoining") return "connecting";
    return admission === "connected" && lost ? "lost" : admission;
}

/**
 * What the visitor can do to get back in: join again, or give the world's
 * new password first. Nothing for someone a moderator removed.
 */
export type MultiplayerRecovery = "rejoin" | "password";

export function connectionRecovery(
    connection: MultiplayerConnection
): MultiplayerRecovery | null {
    switch (connection) {
        case "failed":
        case "lost":
        case "inactive":
            return "rejoin";
        case "password-changed":
            return "password";
        default:
            return null;
    }
}
