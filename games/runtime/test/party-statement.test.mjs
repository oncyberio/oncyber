import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
    partyStatement,
    statedOptions,
} from "../../../scripts/games/party-check.mjs";
import { partyFormats } from "../src/party.ts";

// The options by size are the contract's `party.formats`.
const formats = (sizes) =>
    Object.entries(sizes).map(([id, list]) => ({ id, label: id, sizes: list }));
const SIZES = {
    singles: [2],
    doubles: [4],
    tournament: [3, 4, 5, 6, 7, 8],
    solo: [1, 2, 3, 4, 5, 6, 7, 8],
};
const statement = (change = {}) => ({
    party: {
        sizes: [1, 8],
        formats: formats(SIZES),
        solo: "solo",
        play: "singles",
        late: "A late member is offered Watch and Solo.",
        dropped: "The CPU takes their side and the match goes on.",
        extra: "A match seats two; the rest watch or play solo.",
        ...change,
    },
});
const messages = (manifest) => partyStatement(manifest).map((f) => f.message);

test("a complete statement has no findings", () => {
    assert.deepEqual(partyStatement(statement()), []);
});

test("a game with no statement is told what to state", () => {
    const [finding] = partyStatement({ name: "X" });
    assert.equal(finding.code, "PARTY_STATEMENT");
    assert.match(finding.message, /late, dropped and extra/);
});

test("every size needs options and a solo option", () => {
    const found = messages(
        statement({
            formats: formats({
                ...SIZES,
                tournament: [4, 5, 6, 7, 8],
                solo: [1, 2, 4],
            }),
        })
    );
    assert.ok(found.some((m) => /a party of 3 is offered nothing/.test(m)));
    for (const size of [5, 6, 7, 8])
        assert.ok(
            found.some((m) =>
                m.startsWith(`a party of ${size} has no solo option`)
            )
        );
});

test("late, dropped and extra each need a sentence", () => {
    const found = messages(statement({ late: "", dropped: "tbd" }));
    assert.equal(found.length, 2);
    assert.match(found[0], /party\.late/);
    assert.match(found[1], /party\.dropped/);
});

test("two and four must be offered different things, unless the game says why not", () => {
    const same = statement({
        formats: formats({ solo: SIZES.solo }),
        play: undefined,
    });
    assert.match(messages(same)[0], /same options/);
    same.party.shared = "One garden for everyone, whatever the count.";
    assert.deepEqual(partyStatement(same), []);
});

test("play must be something a party of two is offered", () => {
    assert.match(messages(statement({ play: "doubles" }))[0], /party\.play/);
});

test("the games in the repository state their parties, and Ace's matches the shared formats", () => {
    for (const id of ["ace", "garden", "padel"]) {
        const manifest = JSON.parse(
            readFileSync(
                new URL(`../../${id}/game.json`, import.meta.url),
                "utf8"
            )
        );
        assert.deepEqual(partyStatement(manifest), [], id);
        if (id !== "ace") continue;
        // The formats on offer are the ones game.json declares for each size.
        for (let size = 1; size <= 8; size++)
            assert.deepEqual(
                statedOptions(manifest.party, size),
                partyFormats(size).map((f) => f.id),
                `party of ${size}`
            );
    }
});
