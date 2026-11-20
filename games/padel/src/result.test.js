import test from "node:test";
import assert from "node:assert/strict";
import { createMatchResults, doublesReport } from "./result.js";

test("a doubles report names the visitor once, the three NPCs as cpu, and the simulation's winner", () => {
    const report = doublesReport({
        format: "doubles",
        score: [7, 4],
        winner: 0,
        name: "Ada",
        npcs: ["Leo", "Noa", "Mika"],
        difficulty: "practice",
    });
    assert.equal(report.format, "doubles");
    assert.equal(report.winner, 0);
    assert.deepEqual(
        report.teams.map((team) => team.score),
        [7, 4]
    );
    const players = report.teams.flatMap((team) => team.players);
    assert.equal(players.filter((p) => p.kind === "self").length, 1);
    assert.deepEqual(
        players.map((p) => `${p.name}:${p.kind}`),
        ["Ada:self", "Leo:cpu", "Noa:cpu", "Mika:cpu"]
    );
    assert.equal(new Set(players.map((p) => p.id)).size, 4);
    assert.equal(
        doublesReport({
            format: "doubles",
            score: [0, 0],
            winner: null,
            npcs: ["Leo", "Noa", "Mika"],
            difficulty: "practice",
        }).teams[0].players[0].name,
        "You"
    );
});

test("one report per finished match; a match left or restarted reports nothing", async () => {
    const calls = [];
    const results = createMatchResults(async (operation, value) => {
        calls.push([operation, value]);
    });
    const match = { winner: null };
    const report = () => ({ winner: match.winner });
    assert.equal(results.settle(match, report), false, "no match is open");
    results.begin();
    assert.equal(results.settle(match, report), false, "not finished yet");
    results.abandon();
    results.abandon();
    match.winner = 1;
    assert.equal(results.settle(match, report), false, "an abandoned match");
    match.winner = null;
    results.begin();
    match.winner = 0;
    assert.equal(results.settle(match, report), true);
    assert.equal(results.settle(match, report), false, "never twice");
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.deepEqual(
        calls.map(([operation]) => operation),
        ["begin", "abandon", "begin", "report"]
    );
    assert.deepEqual(calls[3][1], { winner: 0 });
    assert.deepEqual(results.inspect(), { matchOpen: false, resultsSent: 1 });
});
