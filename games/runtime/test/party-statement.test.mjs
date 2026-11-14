import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { partyStatement } from "../../../scripts/games/party-check.mjs";
import { partyFormats } from "../src/party.ts";

const statement = (change = {}) => ({
    party: {
        solo: "solo",
        sizes: {
            1: ["solo"],
            2: ["singles", "solo"],
            3: ["tournament", "solo"],
            4: ["doubles", "tournament", "solo"],
            "5-8": ["tournament", "solo"],
        },
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
    const sizes = { ...statement().party.sizes };
    delete sizes["3"];
    sizes["5-8"] = ["tournament"];
    const found = messages(statement({ sizes }));
    assert.ok(found.some((m) => /sizes\["3"\]/.test(m)));
    assert.ok(found.some((m) => /"5-8"\] has no solo option/.test(m)));
});

test("late, dropped and extra each need a sentence", () => {
    const found = messages(statement({ late: "", dropped: "tbd" }));
    assert.equal(found.length, 2);
    assert.match(found[0], /party\.late/);
    assert.match(found[1], /party\.dropped/);
});

test("two and four must be offered different things, unless the game says why not", () => {
    const sizes = Object.fromEntries(
        ["1", "2", "3", "4", "5-8"].map((k) => [k, ["solo"]])
    );
    const same = statement({ sizes, play: undefined });
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
        for (const [key, size] of Object.entries({
            1: 1,
            2: 2,
            3: 3,
            4: 4,
            "5-8": 6,
        }))
            assert.deepEqual(
                manifest.party.sizes[key],
                partyFormats(size).map((f) => f.id)
            );
    }
});
