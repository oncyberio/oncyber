import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
    auditResults,
    createResults,
    readMatchResult,
    resultOutcome,
} from "../src/results.ts";

const fixtures = JSON.parse(
    readFileSync(new URL("./results.fixtures.json", import.meta.url), "utf8")
);
const teams = fixtures.valid.teams;

test("a valid result reads back clean; each broken rule names itself", () => {
    const read = readMatchResult({
        ...fixtures.valid,
        extra: "dropped",
        teams: [{ ...teams[0], junk: 1 }, teams[1]],
    });
    assert.deepEqual(read, { ok: true, result: fixtures.valid });
    for (const { name, patch } of fixtures.alsoValid)
        assert.equal(
            readMatchResult({ ...fixtures.valid, ...patch }).ok,
            true,
            name
        );
    for (const { error, patch } of fixtures.invalid)
        assert.deepEqual(
            readMatchResult({ ...fixtures.valid, ...patch }),
            { ok: false, error },
            JSON.stringify(patch)
        );
    for (const value of [null, "x", 3, []])
        assert.equal(readMatchResult(value).ok, false);
});

test("outcome is told from the reporting visitor's side", () => {
    assert.equal(resultOutcome(fixtures.valid), "win");
    assert.equal(resultOutcome({ ...fixtures.valid, winner: 1 }), "loss");
    assert.equal(resultOutcome({ ...fixtures.valid, winner: null }), "draw");
});

test("a match sends exactly one result, timed from begin()", () => {
    const sent = [];
    let clock = 1000;
    const results = createResults(
        (r) => sent.push(r),
        () => clock
    );
    assert.throws(
        () => results.report({ format: "cpu", teams, winner: 0 }),
        /RESULT_NO_OPEN_MATCH/
    );
    const match = results.begin();
    assert.match(match, /^[0-9a-f]{24}$/);
    assert.deepEqual(results.inspect(), { matchOpen: true, resultsSent: 0 });
    clock += 61500;
    const result = results.report({ format: "cpu", teams, winner: 0 });
    assert.deepEqual(sent, [
        { match, format: "cpu", durationSeconds: 61.5, teams, winner: 0 },
    ]);
    assert.equal(result, sent[0]);
    // The same match cannot report again.
    assert.throws(
        () => results.report({ format: "cpu", teams, winner: 0 }),
        /RESULT_NO_OPEN_MATCH/
    );
    assert.deepEqual(results.inspect(), { matchOpen: false, resultsSent: 1 });
});

test("an invalid report throws and leaves the match open; an abandoned match sends nothing", () => {
    const sent = [];
    const results = createResults(
        (r) => sent.push(r),
        () => 0
    );
    assert.equal(results.begin("shared-match-1"), "shared-match-1");
    assert.throws(
        () => results.report({ format: "cpu", teams, winner: 5 }),
        /RESULT_WINNER/
    );
    assert.equal(results.inspect().matchOpen, true);
    results.abandon();
    assert.throws(
        () => results.report({ format: "cpu", teams, winner: 0 }),
        /RESULT_NO_OPEN_MATCH/
    );
    assert.throws(() => results.begin("no"), /RESULT_MATCH_ID/);
    assert.equal(sent.length, 0);
});

test("the check's audit wants one valid result per finished match", () => {
    assert.deepEqual(auditResults([fixtures.valid], true), {
        ok: true,
        findings: [],
        results: [fixtures.valid],
    });
    assert.match(auditResults([], true).findings[0], /without a result/);
    assert.equal(auditResults([], false).ok, true);
    const twice = auditResults([fixtures.valid, fixtures.valid], true);
    assert.equal(twice.ok, false);
    assert.match(twice.findings.join("\n"), /reported more than once/);
    assert.match(twice.findings.join("\n"), /exactly one/);
    assert.match(
        auditResults([{ ...fixtures.valid, winner: 9 }], true).findings[0],
        /RESULT_WINNER/
    );
});
