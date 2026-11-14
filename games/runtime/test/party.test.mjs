import assert from "node:assert/strict";
import test from "node:test";
import {
    buildLineup,
    knockout,
    oneVOne,
    partyFormats,
    roundRobin,
    seededDraw,
    sideLabel,
    teams,
} from "../src/party.ts";

const players = (n) =>
    Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
const ids = (formats) => formats.map((f) => f.id);

test("formats follow the party size and always end with a solo option", () => {
    assert.deepEqual(ids(partyFormats(1)), ["solo"]);
    assert.deepEqual(ids(partyFormats(2)), ["singles", "solo"]);
    assert.deepEqual(ids(partyFormats(3)), ["tournament", "solo"]);
    assert.deepEqual(ids(partyFormats(4)), ["doubles", "tournament", "solo"]);
    assert.deepEqual(ids(partyFormats(6)), ["tournament", "solo"]);
    assert.deepEqual(ids(partyFormats(NaN)), ["solo"]);
    for (let n = 1; n <= 8; n++) {
        const formats = partyFormats(n);
        assert.equal(formats.filter((f) => f.solo).length, 1);
        assert.equal(formats.at(-1).solo, true);
    }
    assert.equal(
        partyFormats(2, { label: "Solo vs CPU" }).at(-1).label,
        "Solo vs CPU"
    );
});

test("every member builds the same draw from the party id, whatever order they list players in", () => {
    for (const build of [knockout, roundRobin]) {
        const a = build(players(6), "party-abc");
        const b = build([...players(6)].reverse(), "party-abc");
        assert.deepEqual(a, b);
    }
    assert.deepEqual(
        seededDraw(players(8), "x"),
        seededDraw(players(8).reverse(), "x")
    );
    const orders = new Set(
        ["a", "b", "c", "d", "e", "f"].map((seed) =>
            seededDraw(players(8), seed)
                .map((p) => p.id)
                .join()
        )
    );
    assert.ok(orders.size > 1, "different seeds give different draws");
});

test("1 v 1 and teams fit only their count", () => {
    assert.equal(oneVOne(players(2), "s").rounds[0].matches[0].length, 2);
    assert.equal(oneVOne(players(3), "s"), null);
    const doubles = teams(players(4), "s");
    assert.equal(doubles.teams.length, 2);
    assert.equal(new Set(doubles.teams.flat().map((p) => p.id)).size, 4);
    assert.equal(
        sideLabel(doubles.teams[0]),
        doubles.teams[0].map((p) => p.name).join(" & ")
    );
    assert.equal(teams(players(6), "s", 3).teams[0].length, 3);
    assert.equal(teams(players(3), "s"), null);
});

test("a round robin plays every pair exactly once", () => {
    for (const n of [3, 4, 5, 6, 7, 8]) {
        const pairs = roundRobin(players(n), "s").rounds.map((r) =>
            r.matches[0]
                .map((p) => p.id)
                .sort()
                .join("-")
        );
        assert.equal(pairs.length, (n * (n - 1)) / 2);
        assert.equal(new Set(pairs).size, pairs.length);
    }
});

test("a knockout draws everyone once, gives odd counts a bye and ends in a final", () => {
    const cup = knockout(players(4), "s");
    assert.deepEqual(
        cup.rounds.map((r) => r.name),
        ["Semi-finals", "Final"]
    );
    assert.equal(
        sideLabel(cup.rounds[1].matches[0][0], cup.rounds),
        "Winner of semi-final 1"
    );
    for (const n of [5, 6, 7, 8]) {
        const draw = knockout(players(n), "s");
        const first = draw.rounds[0].matches.flat().filter((s) => s.id);
        assert.equal(first.length, n - (n % 2));
        assert.equal(draw.rounds.at(-1).name, "Final");
        assert.equal(draw.rounds.at(-1).matches.length, 1);
    }
});

test("buildLineup maps format ids to draws; formats that don't fit return null", () => {
    assert.equal(buildLineup("tournament", players(3), "s").rounds.length, 3);
    assert.equal(
        buildLineup("tournament", players(5), "s").rounds.at(-1).name,
        "Final"
    );
    assert.equal(buildLineup("doubles", players(3), "s"), null);
    assert.equal(buildLineup("singles", players(4), "s"), null);
    assert.equal(buildLineup("solo", players(2), "s"), null);
});
