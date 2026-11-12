// Run with: node --test scripts/type-ratchet.test.mjs (from frontend/)
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
    compare,
    fromBaseline,
    parseTscOutput,
    readBaseline,
    report,
    toBaseline,
    total,
    writeBaseline,
} from "./type-ratchet.mjs";

// The shape tsc prints with --pretty false: a located first line, then
// indented detail lines that belong to it.
const LOG = `components/a.tsx(28,33): error TS2769: No overload matches this call.
  Overload 1 of 2, '(props: { slot?: string }): ReactElement', gave the following error.
    Type '{ isLight: any; }' is not assignable to type 'IntrinsicAttributes'.
components/a.tsx(40,1): error TS2769: No overload matches this call.
utils/b.ts(11,13): error TS2741: Property 'streams' is missing.
utils\\win.ts(1,1): error TS2304: Cannot find name 'x'.
error TS5023: Unknown compiler option 'foo'.
exit 2
`;

test("each error becomes file + code, and repeats are counted", () => {
    const counts = parseTscOutput(LOG);
    assert.deepEqual(Object.fromEntries(counts), {
        "components/a.tsx TS2769": 2,
        "utils/b.ts TS2741": 1,
        "utils/win.ts TS2304": 1,
        "<global> TS5023": 1,
    });
    assert.equal(total(counts), 5);
});

test("coloured output parses the same", () => {
    const coloured = "\x1b[96mutils/b.ts\x1b[0m(11,13): error TS2741: x";
    assert.deepEqual(Object.fromEntries(parseTscOutput(coloured)), {
        "utils/b.ts TS2741": 1,
    });
});

test("moving an error to another line is not a change", () => {
    const before = parseTscOutput("utils/b.ts(11,13): error TS2741: x");
    const after = parseTscOutput("utils/b.ts(90,2): error TS2741: x");
    assert.deepEqual(compare(before, after), { added: [], removed: [] });
});

test("a new error, or one more of a known kind in a file, fails", () => {
    const baseline = parseTscOutput(LOG);
    const now = parseTscOutput(
        LOG +
            "components/a.tsx(50,1): error TS2769: again\n" +
            "features/new.ts(1,1): error TS2322: new\n"
    );
    const result = compare(baseline, now);
    assert.deepEqual(result.added, [
        { key: "components/a.tsx TS2769", count: 1 },
        { key: "features/new.ts TS2322", count: 1 },
    ]);
    assert.deepEqual(result.removed, []);
    const summary = report(result, now);
    assert.equal(summary.ok, false);
    assert.match(summary.text, /features\/new\.ts TS2322/);
});

test("errors that went away are listed and do not fail", () => {
    const baseline = parseTscOutput(LOG);
    const now = parseTscOutput("components/a.tsx(28,33): error TS2769: x");
    const result = compare(baseline, now);
    assert.deepEqual(result.added, []);
    assert.deepEqual(result.removed, [
        { key: "<global> TS5023", count: 1 },
        { key: "components/a.tsx TS2769", count: 1 },
        { key: "utils/b.ts TS2741", count: 1 },
        { key: "utils/win.ts TS2304", count: 1 },
    ]);
    const summary = report(result, now);
    assert.equal(summary.ok, true);
    assert.match(summary.text, /went away \(4\)/);
});

test("a clean run against a clean baseline passes", () => {
    const summary = report(compare(new Map(), new Map()), new Map());
    assert.equal(summary.ok, true);
    assert.match(summary.text, /Type errors now: 0\./);
});

test("the baseline file round-trips, sorted, and ignores junk", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "type-ratchet-"));
    try {
        const file = path.join(dir, "baseline.json");
        const counts = parseTscOutput(LOG);
        writeBaseline(counts, file);
        const json = JSON.parse(readFileSync(file, "utf8"));
        assert.equal(json.total, 5);
        assert.deepEqual(Object.keys(json.errors), [
            "<global> TS5023",
            "components/a.tsx TS2769",
            "utils/b.ts TS2741",
            "utils/win.ts TS2304",
        ]);
        assert.deepEqual(readBaseline(file), counts);
        assert.deepEqual(
            fromBaseline({ errors: { "a.ts TS1": 0, "b.ts TS2": "x" } }),
            new Map()
        );
        assert.deepEqual(toBaseline(new Map()), { total: 0, errors: {} });
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test("a missing baseline means every error is new", () => {
    const missing = readBaseline(path.join(tmpdir(), "no-such-baseline.json"));
    assert.equal(missing.size, 0);
});

test("the committed baseline parses", () => {
    const committed = readBaseline();
    assert.ok(committed.size > 0);
    for (const [key, count] of committed) {
        assert.match(key, / TS\d+$/);
        assert.ok(Number.isInteger(count) && count > 0);
    }
});
