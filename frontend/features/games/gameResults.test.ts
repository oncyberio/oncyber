import fixtures from "../../../games/runtime/test/results.fixtures.json";
import {
    GameResultLedger,
    gameResultOutcome,
    isPartyResultPacket,
    partyResultPacket,
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
