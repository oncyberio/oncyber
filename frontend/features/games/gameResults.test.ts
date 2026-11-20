import fixtures from "../../../games/runtime/test/results.fixtures.json";
import {
    GameResultLedger,
    gameResultOutcome,
    isPartyResultPacket,
    judgeMatchResult,
    partyResultPacket,
    readPartyResultOutcome,
    resultMembers,
    resultOutcome,
    readGameResult,
    readPartyResultPacket,
    summarizeGameResult,
    withSelfName,
} from "./gameResults";

const valid = fixtures.valid;

// The same fixtures run against the game side in
// games/runtime/test/results.test.mjs: both must agree on what is valid.
test("the page accepts and refuses the same results as the game runtime", () => {
    expect(readGameResult({ ...valid, extra: "dropped" })).toEqual({
        ok: true,
        result: valid,
    });
    for (const { name, patch } of fixtures.alsoValid)
        expect([name, readGameResult({ ...valid, ...patch }).ok]).toEqual([
            name,
            true,
        ]);
    for (const { error, patch } of fixtures.invalid)
        expect([patch, readGameResult({ ...valid, ...patch })]).toEqual([
            patch,
            { ok: false, error },
        ]);
    for (const value of [null, "x", 3, []])
        expect(readGameResult(value).ok).toBe(false);
});

test("outcome and summary are told from the result alone", () => {
    expect(gameResultOutcome(valid as any)).toBe("win");
    expect(gameResultOutcome({ ...valid, winner: 1 } as any)).toBe("loss");
    expect(gameResultOutcome({ ...valid, winner: null } as any)).toBe("draw");
    expect(summarizeGameResult(valid as any)).toEqual({
        match: valid.match,
        headline: "Ada beat Rally",
        score: "2 – 1",
        format: "cpu",
    });
    expect(summarizeGameResult({ ...valid, winner: 1 } as any)).toMatchObject({
        headline: "Rally beat Ada",
        score: "1 – 2",
    });
    expect(
        summarizeGameResult({ ...valid, winner: null } as any).headline
    ).toBe("Ada and Rally drew");
    const doubles = readGameResult({
        ...valid,
        ...fixtures.alsoValid[1].patch,
    });
    expect(doubles.ok && summarizeGameResult(doubles.result).headline).toBe(
        "Blues beat Reds"
    );
});

test("a match of more than two sides names the winner only", () => {
    const side = (id: string, kind: string, score: number) => ({
        score,
        players: [{ id, name: id, kind }],
    });
    const race = readGameResult({
        ...valid,
        format: "race",
        teams: [
            side("Pip", "self", 1),
            side("Kip", "cpu", 3),
            side("Rusty", "cpu", 4),
        ],
        winner: 2,
    });
    expect(race.ok && summarizeGameResult(race.result)).toMatchObject({
        headline: "Rusty won",
        score: "",
    });
});

test("the visitor is named as the page knows them", () => {
    const named = withSelfName(valid as any, "  Grace  ");
    expect(summarizeGameResult(named).headline).toBe("Grace beat Rally");
    expect(named.teams[1]).toEqual(valid.teams[1]);
    expect(withSelfName(valid as any, "")).toBe(valid);
    expect(withSelfName(valid as any, undefined)).toBe(valid);
});

test("a visit takes one result per match", () => {
    const ledger = new GameResultLedger();
    expect(ledger.accept(valid).ok).toBe(true);
    expect(ledger.accept(valid)).toEqual({
        ok: false,
        error: "RESULT_ALREADY_REPORTED",
    });
    expect(ledger.accept({ ...valid, match: "another-match" }).ok).toBe(true);
    expect(ledger.accept({ ...valid, winner: 7 })).toEqual({
        ok: false,
        error: "RESULT_WINNER",
    });
});

test("the party packet carries only short display text", () => {
    const packet = partyResultPacket(summarizeGameResult(valid as any));
    expect(isPartyResultPacket(packet)).toBe(true);
    expect(readPartyResultPacket(packet)).toEqual({
        match: valid.match,
        headline: "Ada beat Rally",
        score: "2 – 1",
        format: "cpu",
    });
    expect(isPartyResultPacket({ k: "m-end" })).toBe(false);
    expect(readPartyResultPacket({ type: "oncyber:party-result" })).toBeNull();
    expect(
        readPartyResultPacket({
            type: "oncyber:party-result",
            summary: { match: "m", headline: "x".repeat(500), score: 4 },
        })
    ).toEqual({ match: "m", headline: "x".repeat(160), score: "", format: "" });
});

// A 1 v 1 between two members of a party: each browser reports it under the
// same match id, with the teams in room-id order (docs/games/results.md).
const versus = (self: "m1" | "m2", patch: Record<string, unknown> = {}) =>
    ({
        match: "v_0123456789",
        format: "singles",
        durationSeconds: self === "m1" ? 91.2 : 91.6,
        teams: [
            {
                score: 2,
                players: [
                    {
                        id: "m1",
                        name: self === "m1" ? "You" : "Ada",
                        kind: self === "m1" ? "self" : "peer",
                    },
                ],
            },
            {
                score: 1,
                players: [
                    {
                        id: "m2",
                        name: self === "m2" ? "You" : "Bo",
                        kind: self === "m2" ? "self" : "peer",
                    },
                ],
            },
        ],
        winner: 0,
        ...patch,
    } as any);
const roster = (self: string) => ({
    self,
    members: [{ id: "m1" }, { id: "m2" }, { id: "m3" }],
});

test("both sides of a match report the same outcome, whoever is self", () => {
    expect(resultOutcome(versus("m1"))).toEqual(resultOutcome(versus("m2")));
    expect(resultOutcome(versus("m1"))).toEqual({
        match: "v_0123456789",
        format: "singles",
        teams: [
            { score: 2, players: ["m1"] },
            { score: 1, players: ["m2"] },
        ],
        winner: 0,
    });
    expect(resultMembers(versus("m1"))).toEqual(["m1", "m2"]);
    expect(resultMembers(valid as any)).toEqual(["self"]);
});

test("a match is agreed when every player's report matches", () => {
    const mine = versus("m1");
    const theirs = { member: "m2", outcome: resultOutcome(versus("m2")) };
    // Alone so far: not agreed, and nobody disputes it.
    expect(judgeMatchResult(mine, roster("m1"), [])).toMatchObject({
        status: "incomplete",
        trust: "solo-unverified",
        missing: ["m2"],
    });
    expect(judgeMatchResult(mine, roster("m1"), [theirs])).toMatchObject({
        status: "agreed",
        trust: "party-agreed",
        members: ["m1", "m2"],
    });
    // The other side says it won: a dispute, never ranked.
    expect(
        judgeMatchResult(mine, roster("m1"), [
            {
                member: "m2",
                outcome: resultOutcome(versus("m2", { winner: 1 })),
            },
        ])
    ).toMatchObject({ status: "disputed", trust: "solo-unverified" });
    // A member who didn't play, or a report in the visitor's own name,
    // stands behind nothing.
    expect(
        judgeMatchResult(mine, roster("m1"), [
            { member: "m3", outcome: resultOutcome(mine) },
            { member: "m1", outcome: resultOutcome(mine) },
        ])
    ).toMatchObject({ status: "incomplete", missing: ["m2"] });
});

test("solo matches and matches the room can't vouch for stay unverified", () => {
    // Against the CPU: one person, nobody to agree with.
    expect(judgeMatchResult(valid as any, roster("m1"), [])).toMatchObject({
        status: "solo",
        trust: "solo-unverified",
    });
    const theirs = { member: "m2", outcome: resultOutcome(versus("m2")) };
    // No party room, a player the room doesn't know, or a visitor who is
    // not the side the game calls self.
    for (const room of [
        null,
        { self: "m1", members: [{ id: "m1" }] },
        roster("m2"),
    ])
        expect(judgeMatchResult(versus("m1"), room, [theirs]).trust).toBe(
            "solo-unverified"
        );
});

test("the party packet carries the outcome for the other members' pages", () => {
    const mine = versus("m1");
    const packet = partyResultPacket(
        summarizeGameResult(mine),
        resultOutcome(mine)
    );
    expect(readPartyResultOutcome(packet)).toEqual(resultOutcome(mine));
    expect(readPartyResultPacket(packet).match).toBe(mine.match);
    // A packet from a page without one, or with one too large to compare.
    expect(
        readPartyResultOutcome(partyResultPacket(summarizeGameResult(mine)))
    ).toBeNull();
    expect(
        readPartyResultOutcome({
            type: "oncyber:party-result",
            summary: {},
            outcome: "x".repeat(5000),
        })
    ).toBeNull();
});
