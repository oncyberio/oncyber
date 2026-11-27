import { test } from "node:test";
import assert from "node:assert/strict";
import { matchReport, resultMatchId } from "../src/game/result.js";
import { createResults } from "../../runtime/src/results.ts";

const entrant = (c, n, cpu = 0) => ({ o: cpu ? "" : "room-1", c, n, cpu });

test("a race reports places as scores and the first across the line as winner", () => {
    const sent = [];
    const results = createResults(
        (r) => sent.push(r),
        () => 0
    );
    const match = {
        id: "solo-m3x9k2",
        kind: "race",
        entrants: [
            entrant("b1", "Pip"),
            entrant("cpu-Moss", "Moss", 1),
            entrant("cpu-Fern", "Fern", 1),
            entrant("b9", "Dot"),
        ],
        result: { places: [2, 1, 4, 3], times: [31.2, 30.1, 40, 35] },
    };
    results.begin(resultMatchId(match.id));
    const result = results.report(matchReport(match, 0));
    assert.equal(sent.length, 1);
    assert.equal(result.match, "garden-solo-m3x9k2");
    assert.equal(result.format, "race");
    assert.equal(result.winner, 1);
    assert.deepEqual(
        result.teams.map((t) => t.score),
        [3, 4, 1, 2]
    );
    assert.deepEqual(
        result.teams.map((t) => t.players[0].kind),
        ["self", "cpu", "cpu", "peer"]
    );
});

test("a bout reports its winner; a spectator reports nothing", () => {
    const results = createResults(
        () => {},
        () => 0
    );
    const match = {
        id: "abc_DEF-1",
        kind: "bout",
        entrants: [entrant("b1", "Pip"), entrant("b2", "Rex")],
        result: { winner: 1, reason: "ko" },
    };
    results.begin(resultMatchId(match.id));
    const result = results.report(matchReport(match, 1));
    assert.equal(result.format, "bout");
    assert.equal(result.winner, 1);
    assert.deepEqual(
        result.teams.map((t) => [t.score, t.players[0].kind]),
        [
            [0, "peer"],
            [1, "self"],
        ]
    );
    assert.equal(matchReport(match, -1), null);
    assert.match(resultMatchId("we!rd id/…"), /^[A-Za-z0-9_-]{6,64}$/);
});
