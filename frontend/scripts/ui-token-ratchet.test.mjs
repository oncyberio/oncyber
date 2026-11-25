import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import {
    BASELINE_PATH,
    colourLiterals,
    compare,
    scan,
} from "./ui-token-ratchet.mjs";

test("finds hex and functional colours, one per literal", () => {
    const found = colourLiterals(
        [
            'color: "#fff",',
            "background: linear-gradient(#0b0d12, rgba(0, 0, 0, 0.4));",
            "border: 1px solid hsl(210 10% 20%);",
        ].join("\n")
    );
    assert.deepEqual(
        found.map((f) => f.line),
        [1, 2, 2, 3]
    );
});

test("leaves tokens, ids and other hashes alone", () => {
    const source = [
        "color: baseTokens.ink.primary,",
        "background: var(--oc-surface);",
        'href="#section-2"',
        'const id = "#g7";',
        "const issue = `#12345`;",
    ].join("\n");
    assert.deepEqual(colourLiterals(source), []);
});

test("a file of 3D colours says so once, where it opens", () => {
    const paint = ['const wall = "#c9c1e8";', 'const bed = "#e8b93a";'];
    assert.deepEqual(
        colourLiterals(
            ["// tokens-ok-file: paint for a 3D room", ...paint].join("\n")
        ),
        []
    );
    // Said without a reason, or far below the opening, it exempts nothing.
    assert.equal(
        colourLiterals(["// tokens-ok-file:", ...paint].join("\n")).length,
        2
    );
    assert.equal(
        colourLiterals(
            [
                ...paint,
                ...Array(60).fill("const n = 1;"),
                "// tokens-ok-file: too late",
            ].join("\n")
        ).length,
        2
    );
});

test("accepts a stated exception on the line or the one above", () => {
    assert.deepEqual(
        colourLiterals('emissive: "#ffd23f", // tokens-ok: a 3D material'),
        []
    );
    assert.deepEqual(
        colourLiterals('// tokens-ok: partner brand mark\nfill="#1da1f2"'),
        []
    );
    // An exception has to say why.
    assert.equal(colourLiterals('fill="#1da1f2" // tokens-ok:').length, 1);
});

test("fails a file that gains colours and a new file with any", () => {
    const { raised, lowered } = compare(
        { "ui/a.tsx": 2, "ui/b.tsx": 3, "ui/gone.tsx": 1 },
        { "ui/a.tsx": 3, "ui/b.tsx": 1, "ui/new.tsx": 1 }
    );
    assert.deepEqual(raised.map((r) => r.file).sort(), [
        "ui/a.tsx",
        "ui/new.tsx",
    ]);
    assert.deepEqual(lowered.map((r) => r.file).sort(), [
        "ui/b.tsx",
        "ui/gone.tsx",
    ]);
});

test("the repository is at or under its baseline", () => {
    assert.ok(existsSync(BASELINE_PATH), "run check:tokens:update once");
    const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
    assert.deepEqual(compare(baseline, scan().counts).raised, []);
});
