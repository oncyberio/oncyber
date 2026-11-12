import {
    connectionRecovery,
    connectionTransition as step,
    isEndReason,
    reportedConnection,
    type MultiplayerAdmission,
    type MultiplayerConnection,
    type MultiplayerConnectionEvent,
    type MultiplayerEndReason,
} from "./multiplayerConnection";

const connect: MultiplayerConnectionEvent = { type: "connect" };
const joined: MultiplayerConnectionEvent = { type: "joined" };
const failed: MultiplayerConnectionEvent = { type: "failed" };
const cancelled: MultiplayerConnectionEvent = { type: "cancelled" };
const rejoin: MultiplayerConnectionEvent = { type: "rejoin" };
const closed: MultiplayerConnectionEvent = { type: "closed" };
const solo: MultiplayerConnectionEvent = { type: "solo" };
const ended = (reason: MultiplayerEndReason): MultiplayerConnectionEvent => ({
    type: "ended",
    reason,
});

const REASONS: MultiplayerEndReason[] = [
    "removed",
    "password-changed",
    "inactive",
];
const STATES: MultiplayerAdmission[] = [
    "idle",
    "rejoining",
    "connecting",
    "connected",
    "failed",
    ...REASONS,
];

type Row = [
    string,
    MultiplayerAdmission,
    MultiplayerConnectionEvent,
    MultiplayerAdmission
];

test.each<Row>([
    ["an attempt starts", "idle", connect, "connecting"],
    ["it gets in", "connecting", joined, "connected"],
    ["it does not get in", "connecting", failed, "failed"],
    ["it is cancelled", "connecting", cancelled, "idle"],
    ["a failed attempt is tried again", "failed", connect, "connecting"],
    ["the visitor picks solo", "connected", solo, "idle"],
    ["the connections are closed", "connected", closed, "idle"],
    ["closing forgets a failed attempt", "failed", closed, "idle"],
    ["closing with nothing open", "idle", closed, "idle"],
    [
        "a moderator removes the visitor",
        "connected",
        ended("removed"),
        "removed",
    ],
    [
        "the password changes",
        "connected",
        ended("password-changed"),
        "password-changed",
    ],
    ["the visitor was away", "connected", ended("inactive"), "inactive"],
    ["an attempt can end too", "connecting", ended("inactive"), "inactive"],
    // Solo by choice, or a failed attempt, had no room to end.
    ["nothing ends in solo", "idle", ended("password-changed"), "idle"],
    ["nothing ends after a failure", "failed", ended("inactive"), "failed"],
    // The first reason is the one that closed the room.
    ["a second reason is ignored", "removed", ended("inactive"), "removed"],
    // What a closed attempt reports afterwards cannot bring the room back.
    ["a late join after closing", "idle", joined, "idle"],
    ["a late failure after closing", "idle", failed, "idle"],
    ["a late join after an ending", "removed", joined, "removed"],
    ["a late cancel after an ending", "inactive", cancelled, "inactive"],
    // Joining again closes the old room first, then starts an attempt.
    [
        "the visitor joins again after being away",
        "inactive",
        rejoin,
        "rejoining",
    ],
    ["after a lost room", "connected", rejoin, "rejoining"],
    ["after a failed attempt", "failed", rejoin, "rejoining"],
    ["closing the old room does not end it", "rejoining", closed, "rejoining"],
    ["the next attempt starts", "rejoining", connect, "connecting"],
    ["it could not start", "rejoining", cancelled, "idle"],
    [
        "no room is open to end meanwhile",
        "rejoining",
        ended("removed"),
        "rejoining",
    ],
    ["the old room cannot report a join", "rejoining", joined, "rejoining"],
])("%s", (_name, state, event, next) => {
    expect(step(state, event)).toBe(next);
});

test.each(REASONS)(
    "%s stays through the close that follows it, until the next attempt or solo",
    (reason) => {
        expect(step(reason, closed)).toBe(reason);
        expect(step(step(reason, closed), closed)).toBe(reason);
        expect(step(reason, connect)).toBe("connecting");
        expect(step(reason, solo)).toBe("idle");
    }
);

test("an attempt can start, and solo can be picked, from anywhere", () => {
    for (const state of STATES) {
        expect(step(state, connect)).toBe("connecting");
        expect(step(state, solo)).toBe("idle");
    }
});

test("an event that does not apply returns the same state", () => {
    for (const state of STATES)
        expect(step(state, { type: "unknown" } as any)).toBe(state);
});

test("the visitor is told lost for a room that closed underneath them, and connecting while joining again", () => {
    for (const state of STATES) {
        const told = state === "rejoining" ? "connecting" : state;
        expect(reportedConnection(state, false)).toBe(told);
        expect(reportedConnection(state, true)).toBe(
            state === "connected" ? "lost" : told
        );
    }
});

test.each<[MultiplayerConnection, ReturnType<typeof connectionRecovery>]>([
    ["idle", null],
    ["connecting", null],
    ["connected", null],
    ["failed", "rejoin"],
    ["lost", "rejoin"],
    ["inactive", "rejoin"],
    ["password-changed", "password"],
    // A moderator's decision: there is no way back to offer.
    ["removed", null],
])("from %s the visitor can %s", (connection, recovery) => {
    expect(connectionRecovery(connection)).toBe(recovery);
    expect(isEndReason(connection)).toBe(REASONS.includes(connection as any));
});
