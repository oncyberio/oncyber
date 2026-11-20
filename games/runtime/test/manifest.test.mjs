import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
    formatsForParty,
    validateArrival,
    validateGameJson,
    validateParty,
} from "../src/manifest.ts";

const party = {
    sizes: [1, 4],
    formats: [
        { id: "singles", label: "1 v 1", sizes: [2] },
        { id: "doubles", label: "2 v 2", sizes: [4] },
        { id: "cpu", label: "Solo", sizes: [1, 2, 3, 4] },
    ],
};
const runtime = {
    profile: "portable-v1",
    version: "1",
    capabilities: [],
    assets: [],
    input: { jump: { keyboard: ["Space"] } },
};
const messages = (findings) => findings.map((f) => f.message);

test("arrival says whether the visitor lands walking", () => {
    assert.deepEqual(validateArrival({ walkable: true }), []);
    assert.equal(validateArrival({ walkable: "yes" }).length, 1);
    assert.equal(validateArrival("walkable").length, 1);
});

test("party sizes are a range within 1 to 8 and every size has a format", () => {
    assert.deepEqual(validateParty(party), []);
    assert.match(validateParty({ ...party, sizes: [0, 9] })[0], /party\.sizes/);
    assert.match(validateParty({ ...party, sizes: [3, 2] })[0], /party\.sizes/);
    assert.match(
        validateParty({
            sizes: [1, 2],
            formats: [{ id: "solo", label: "Solo", sizes: [1] }],
        })[0],
        /party of 2 has no format/
    );
    assert.match(
        validateParty({
            sizes: [1, 1],
            formats: [{ id: "duo", label: "Duo", sizes: [1, 2] }],
        })[0],
        /outside party\.sizes/
    );
});

test("formats need distinct ids, a label and distinct sizes", () => {
    const bad = validateParty({
        sizes: [1, 2],
        formats: [
            { id: "Solo!", label: "Solo", sizes: [1, 2] },
            { id: "duo", label: "", sizes: [2, 2] },
            { id: "duo", label: "Duo", sizes: [2] },
        ],
    });
    assert.equal(bad.length, 4);
    assert.equal(validateParty({ sizes: [1, 1], formats: [] }).length, 1);
});

test("a listed game must declare arrival, party and a usable runtime block", () => {
    assert.deepEqual(
        validateGameJson(
            { name: "G", arrival: { walkable: false }, party, runtime },
            { requireContract: true }
        ),
        []
    );
    assert.deepEqual(validateGameJson({ name: "G" }), []);
    assert.deepEqual(
        messages(
            validateGameJson({ name: "G" }, { requireContract: true })
        ).map((m) => m.split(" ")[0]),
        ["arrival", "party"]
    );
    assert.match(
        messages(
            validateGameJson({
                name: "G",
                runtime: { ...runtime, input: { "bad name": {} } },
            })
        )[0],
        /action names/
    );
    assert.match(
        messages(
            validateGameJson({
                name: "G",
                runtime: { ...runtime, input: { go: { keyboard: ["w"] } } },
            })
        )[0],
        /KeyboardEvent\.code/
    );
    assert.equal(validateGameJson([])[0].code, "MANIFEST_INVALID");
});

test("formats for a party follow the manifest's order", () => {
    assert.deepEqual(
        formatsForParty(party, 4).map((f) => f.id),
        ["doubles", "cpu"]
    );
    assert.deepEqual(formatsForParty(party, 7), []);
});

for (const id of ["ace", "garden"])
    test(`${id}'s game.json meets the contract`, () => {
        const json = JSON.parse(
            readFileSync(
                new URL(`../../${id}/game.json`, import.meta.url),
                "utf8"
            )
        );
        assert.deepEqual(validateGameJson(json, { requireContract: true }), []);
    });
