/** @jest-environment node */
import {
    assertDestinationStatusMove,
    canMoveDestinationStatus,
    DESTINATION_STATUSES,
    NEW_DESTINATION,
} from "./destinationStatus";
import type { DestinationStatusActor } from "./destinationStatus";

// Every legal move, written out here on purpose rather than read from the
// module: [from, to, who, what it is]. Anything not listed must be refused.
const LEGAL: Array<[string | null, string, DestinationStatusActor, string]> = [
    [NEW_DESTINATION, "tested", "owner", "a new destination is a draft"],
    ["tested", "submitted", "owner", "submit for review"],
    ["submitted", "tested", "owner", "cancel the review"],
    ["rejected", "submitted", "owner", "resubmit after a rejection"],
    ["rejected", "tested", "owner", "back to a draft after a rejection"],
    ["verified", "submitted", "owner", "resubmit before minting"],
    ["verified", "tested", "owner", "withdraw before minting"],
    ["verified", "failed", "owner", "the mint could not be saved"],
    ["verified", "active", "mint", "publish after minting"],
    ["failed", "active", "mint", "publish a mint that was saved late"],
];

const ACTORS: DestinationStatusActor[] = ["owner", "mint", "review"];
const FROM = [NEW_DESTINATION, ...DESTINATION_STATUSES];
const key = (from, to, actor) => `${actor}: ${from ?? "(new)"} -> ${to}`;
const legal = new Set(LEGAL.map(([from, to, actor]) => key(from, to, actor)));

test("the statuses are the five typed ones and the mint dialog's failed", () => {
    expect([...DESTINATION_STATUSES].sort()).toEqual([
        "active",
        "failed",
        "rejected",
        "submitted",
        "tested",
        "verified",
    ]);
});

test.each(LEGAL)("%s -> %s is allowed for %s (%s)", (from, to, actor) => {
    expect(canMoveDestinationStatus(from, to, actor)).toBe(true);
    expect(() => assertDestinationStatusMove(from, to, actor)).not.toThrow();
});

describe("every other move by an owner, with or without a mint", () => {
    const cases = [];
    for (const actor of ["owner", "mint"] as DestinationStatusActor[])
        for (const from of FROM)
            for (const to of DESTINATION_STATUSES)
                if (from !== to && !legal.has(key(from, to, actor)))
                    cases.push([actor, from ?? "(new)", to, from]);

    test("the whole table is covered", () => {
        // 2 actors x 7 starting points x 6 targets, minus writing the status
        // a destination already has (2 x 6), minus the legal moves.
        expect(cases.length).toBe(2 * 7 * 6 - 2 * 6 - LEGAL.length);
    });

    test.each(cases)("%s: %s -> %s is refused", (actor, _name, to, from) => {
        expect(canMoveDestinationStatus(from, to, actor)).toBe(false);
        expect(() => assertDestinationStatusMove(from, to, actor)).toThrow();
    });
});

test.each(["verified", "rejected", "active"])(
    "an owner can never set %s, whatever the destination is now",
    (to) => {
        for (const from of FROM.filter((from) => from !== to)) {
            expect(canMoveDestinationStatus(from, to, "owner")).toBe(false);
        }
    }
);

test("a mint publishes only what review verified, and sets nothing else", () => {
    for (const from of ["tested", "submitted", "rejected", NEW_DESTINATION]) {
        expect(canMoveDestinationStatus(from, "active", "mint")).toBe(false);
    }
    for (const to of ["tested", "submitted", "rejected", "failed"]) {
        expect(canMoveDestinationStatus("verified", to, "mint")).toBe(false);
        expect(canMoveDestinationStatus("active", to, "mint")).toBe(false);
    }
});

test("review may make any move between known statuses", () => {
    for (const from of FROM)
        for (const to of DESTINATION_STATUSES)
            expect(canMoveDestinationStatus(from, to, "review")).toBe(true);
});

test.each(ACTORS)(
    "writing the status a destination already has is not a move (%s)",
    (actor) => {
        for (const status of DESTINATION_STATUSES)
            expect(canMoveDestinationStatus(status, status, actor)).toBe(true);
    }
);

test.each(ACTORS)("an unknown or missing target is refused (%s)", (actor) => {
    for (const to of ["published", "", null, undefined, 1, ["active"], {}]) {
        expect(canMoveDestinationStatus("tested", to, actor)).toBe(false);
        expect(canMoveDestinationStatus(NEW_DESTINATION, to, actor)).toBe(
            false
        );
    }
});

test("a stored destination with no or an unknown status can only become a draft", () => {
    expect(canMoveDestinationStatus(undefined, "tested", "owner")).toBe(true);
    for (const to of DESTINATION_STATUSES.filter((to) => to !== "tested")) {
        expect(canMoveDestinationStatus(undefined, to, "owner")).toBe(false);
        expect(canMoveDestinationStatus(undefined, to, "mint")).toBe(false);
    }
    for (const to of DESTINATION_STATUSES) {
        expect(canMoveDestinationStatus("published", to, "owner")).toBe(false);
        expect(canMoveDestinationStatus("toString", to, "owner")).toBe(false);
        expect(canMoveDestinationStatus("published", to, "mint")).toBe(false);
    }
});

test("a refusal says which move was refused", () => {
    expect(() =>
        assertDestinationStatusMove("tested", "verified", "owner")
    ).toThrow('Destination status cannot change from "tested" to "verified".');
    expect(() =>
        assertDestinationStatusMove(NEW_DESTINATION, "active", "owner")
    ).toThrow('A new destination starts as "tested", not "active".');
    expect(() =>
        assertDestinationStatusMove("tested", undefined, "owner")
    ).toThrow('Destination status cannot change from "tested" to no status.');
});
