import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, startMatch, update } from "../src/engine.js";
import {
    cpuMatchReport,
    createMatchResults,
    versusMatchReport,
} from "../src/result.js";
import { createResults } from "../../runtime/src/results.ts";
import { partyFormats } from "../../runtime/src/party.ts";

// The format ids are the shared party formats' (docs/games/party.md).
const SOLO = partyFormats(1).find((f) => f.solo).id;
const SINGLES = partyFormats(2)[0].id;

test("a finished CPU match reports exactly one valid result", () => {
    const sent = [];
    let clock = 0;
    const results = createResults(
        (r) => sent.push(r),
        () => clock
    );
    const engine = createEngine({
        difficulty: "rookie",
        games: 1,
        seed: 7,
        autoHuman: true,
    });
    startMatch(engine);
    results.begin();
    const idle = { move: { x: 0, z: 0 }, aim: { x: 0, y: 0 }, press: null };
    let ended = 0;
    for (let i = 0; i < 60 * 60 * 20 && !ended; i++) {
        clock += 1000 / 60;
        for (const event of update(engine, idle, 1 / 60))
            if (event.type === "match") {
                ended++;
                results.report(
                    cpuMatchReport({
                        format: SOLO,
                        match: engine.match,
                        name: "Ada",
                        selfId: "",
                        foe: "Rally",
                        difficulty: "rookie",
                    })
                );
            }
    }
    assert.equal(ended, 1);
    assert.equal(sent.length, 1);
    const [result] = sent;
    assert.equal(result.format, "solo");
    assert.equal(result.winner, engine.match.winner);
    assert.deepEqual(
        result.teams.map((t) => t.score),
        engine.match.games
    );
    assert.deepEqual(
        result.teams.map((t) => t.players[0].kind),
        ["self", "cpu"]
    );
    assert.ok(result.durationSeconds > 5);
    assert.throws(
        () =>
            results.report(
                cpuMatchReport({
                    format: SOLO,
                    match: engine.match,
                    name: "Ada",
                    foe: "Rally",
                    difficulty: "rookie",
                })
            ),
        /RESULT_NO_OPEN_MATCH/
    );
});

test("both sides of a 1 v 1 report the same teams under the shared format id", () => {
    const names = { "room-b": "Bo", "room-a": "Ada" };
    const report = (selfId, match) =>
        versusMatchReport({
            format: SINGLES,
            match,
            players: ["room-b", "room-a"],
            selfId,
            nameOf: (id) => names[id],
        });
    // Each screen has its own visitor on side 0: Ada won 2 games to 1.
    const ada = report("room-a", { games: [2, 1], winner: 0 });
    const bo = report("room-b", { games: [1, 2], winner: 1 });
    assert.equal(ada.format, "singles");
    const plain = (r) => ({
        ...r,
        teams: r.teams.map((t) => ({
            score: t.score,
            players: t.players.map(({ id, name }) => ({ id, name })),
        })),
    });
    assert.deepEqual(plain(ada), plain(bo));
    assert.deepEqual(
        ada.teams.map((t) => [t.players[0].id, t.score]),
        [
            ["room-a", 2],
            ["room-b", 1],
        ]
    );
    assert.equal(ada.winner, 0);
    assert.deepEqual(
        [ada, bo].map((r) => r.teams.map((t) => t.players[0].kind)),
        [
            ["self", "peer"],
            ["peer", "self"],
        ]
    );
});

test("a match reports once when it has a winner, and nothing when it is left", async () => {
    const sent = [];
    const results = createResults((r) => sent.push(r));
    const calls = [];
    const reporter = createMatchResults(async (operation, value) => {
        calls.push(operation);
        if (operation === "begin")
            return results.begin(value.match || undefined);
        if (operation === "report") return results.report(value).match;
        results.abandon();
        return true;
    });
    const report = (match) => () =>
        cpuMatchReport({
            format: SOLO,
            match,
            name: "Ada",
            selfId: "room-a",
            foe: "Rally",
            difficulty: "pro",
        });
    const live = { games: [0, 0], winner: null };
    const won = { games: [2, 0], winner: 0 };

    // No match open: a winner on the court (the title's demo) is not a result.
    assert.equal(reporter.settle(won, report(won)), false);
    reporter.begin();
    assert.equal(reporter.settle(live, report(live)), false);
    assert.equal(reporter.settle(won, report(won)), true);
    // The same finished match, frame after frame: still one.
    assert.equal(reporter.settle(won, report(won)), false);
    // A rematch right away opens its own match.
    reporter.begin();
    reporter.abandon();
    assert.equal(reporter.settle(won, report(won)), false);
    // A 1 v 1: opened under the shared id, kept through a change of hands,
    // never opened for a spectator.
    reporter.versus({ role: "guest", resume: false }, "ace-shared-01");
    reporter.versus({ role: "authority", resume: true }, "ace-other-02");
    assert.equal(reporter.settle(won, report(won)), true);
    reporter.versus({ role: "watch", resume: false }, "ace-shared-03");
    assert.equal(reporter.settle(won, report(won)), false);
    await new Promise((resolve) => setTimeout(resolve));
    assert.deepEqual(calls, [
        "begin",
        "report",
        "begin",
        "abandon",
        "begin",
        "report",
    ]);
    assert.deepEqual(
        sent.map((r) => [r.format, r.winner]),
        [
            ["solo", 0],
            ["solo", 0],
        ]
    );
    assert.equal(sent[1].match, "ace-shared-01");
    assert.deepEqual(reporter.inspect(), { matchOpen: false, resultsSent: 2 });
});
