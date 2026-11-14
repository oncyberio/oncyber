import test from "node:test";
import assert from "node:assert/strict";
import { buildLineup, partyFormats, sideLabel } from "../src/party.js";

const players = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
const ids = (formats) => formats.map((f) => f.id);

test("formats follow the party size", () => {
    assert.deepEqual(ids(partyFormats(1)), ["cpu"]);
    assert.deepEqual(ids(partyFormats(2)), ["singles", "cpu"]);
    assert.deepEqual(ids(partyFormats(3)), ["tournament", "cpu"]);
    assert.deepEqual(ids(partyFormats(4)), ["doubles", "tournament", "cpu"]);
    assert.deepEqual(ids(partyFormats(6)), ["tournament", "cpu"]);
    assert.deepEqual(ids(partyFormats(NaN)), ["cpu"]);
});

test("every member builds the same draw from the party id", () => {
    const a = buildLineup("tournament", players(4), "party-abc");
    const b = buildLineup("tournament", [...players(4)].reverse(), "party-abc");
    assert.deepEqual(a, b);
    const other = buildLineup("tournament", players(4), "party-xyz");
    assert.equal(other.rounds.length, 2);
});

test("four players: doubles makes two teams, a tournament two semis and a final", () => {
    const doubles = buildLineup("doubles", players(4), "s");
    assert.equal(doubles.teams.length, 2);
    assert.equal(new Set(doubles.teams.flat().map((p) => p.id)).size, 4);
    const cup = buildLineup("tournament", players(4), "s");
    assert.deepEqual(cup.rounds.map((r) => r.name), ["Semi-finals", "Final"]);
    assert.equal(cup.rounds[0].matches.length, 2);
    assert.equal(sideLabel(cup.rounds[1].matches[0][0], cup.rounds), "Winner of semi-final 1");
    assert.equal(sideLabel(doubles.teams[0]), doubles.teams[0].map((p) => p.name).join(" & "));
});

test("three play a round robin; odd knockouts give a bye; everyone is drawn once", () => {
    const three = buildLineup("tournament", players(3), "s");
    assert.equal(three.rounds.length, 3);
    for (const n of [5, 6, 7, 8]) {
        const cup = buildLineup("tournament", players(n), "s");
        const first = cup.rounds[0].matches.flat().filter((s) => s.id);
        const byes = n % 2;
        assert.equal(first.length, n - byes);
        assert.equal(cup.rounds.at(-1).name, "Final");
        assert.equal(cup.rounds.at(-1).matches.length, 1);
    }
});

test("formats that don't fit the party return no lineup", () => {
    assert.equal(buildLineup("doubles", players(3), "s"), null);
    assert.equal(buildLineup("singles", players(4), "s"), null);
    assert.equal(buildLineup("cpu", players(2), "s"), null);
});
