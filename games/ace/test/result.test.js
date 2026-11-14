import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, startMatch, update } from "../src/engine.js";
import { cpuMatchReport } from "../src/result.js";
import { createResults } from "../../runtime/src/results.ts";

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
    assert.equal(result.format, "cpu");
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
                    match: engine.match,
                    name: "Ada",
                    foe: "Rally",
                    difficulty: "rookie",
                })
            ),
        /RESULT_NO_OPEN_MATCH/
    );
});
