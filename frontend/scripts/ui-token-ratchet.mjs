#!/usr/bin/env node
// Design-token ratchet for the frontend's interface code.
//
// Interface code takes its colours from the design tokens
// (frontend/styles/tokens/, docs/brand/tokens.md), not from values written
// in place. Older files still carry colours of their own, so this script
// counts the colour literals in each interface file and compares the
// counts with the committed baseline:
//
//   - a file with more literals than its baseline fails the check (exit 1)
//     and its new lines are printed; a new file's baseline is zero;
//   - files that now have fewer are printed so the baseline can be lowered;
//   - `--update` rewrites the baseline from the current counts (exit 0).
//
// A line that truly needs its own colour (a 3D material, a brand mark, a
// test fixture drawn on screen) says so: put `tokens-ok: <why>` in a
// comment on that line or the one above it. A file that is nothing but
// such colours (paint for a 3D scene, the colour names a world script may
// use) says so once, in the comment it opens with: `tokens-ok-file: <why>`.
//
// Usage (from frontend/):
//   node scripts/ui-token-ratchet.mjs
//   node scripts/ui-token-ratchet.mjs --update

import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND = path.resolve(here, "..");
export const BASELINE_PATH = path.join(here, "ui-token-baseline.json");

/** Where interface code lives. The token and brand files are the source. */
export const ROOTS = ["features", "components", "ui", "pages"];
const EXTENSIONS = /\.(tsx?|jsx?|css|scss)$/;
const SKIPPED = /(\.test\.|\.generated\.|\.d\.ts$|(^|\/)node_modules\/)/;

// #rgb, #rgba, #rrggbb, #rrggbbaa, and rgb()/hsl() with or without alpha.
const COLOUR =
    /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-zA-Z_-])|\b(?:rgb|hsl)a?\(/g;
const ALLOWED = /tokens-ok:\s*\S/;
const ALLOWED_FILE = /tokens-ok-file:\s*\S/;
/** How far into a file its opening comment may reach. */
const OPENING_LINES = 40;

/** The colour literals in a file's text, as `{ line, text }` (1-based). */
export function colourLiterals(source) {
    const lines = String(source).split(/\r?\n/);
    if (lines.slice(0, OPENING_LINES).some((line) => ALLOWED_FILE.test(line)))
        return [];
    const found = [];
    lines.forEach((text, index) => {
        const count = (text.match(COLOUR) || []).length;
        if (!count) return;
        if (ALLOWED.test(text) || ALLOWED.test(lines[index - 1] ?? "")) return;
        for (let i = 0; i < count; i++)
            found.push({ line: index + 1, text: text.trim() });
    });
    return found;
}

/** Baseline and current counts -> what rose and what fell. */
export function compare(baseline, current) {
    const raised = [];
    const lowered = [];
    for (const [file, count] of Object.entries(current)) {
        const before = baseline[file] ?? 0;
        if (count > before) raised.push({ file, before, count });
        else if (count < before) lowered.push({ file, before, count });
    }
    for (const [file, before] of Object.entries(baseline))
        if (!(file in current)) lowered.push({ file, before, count: 0 });
    return { raised, lowered };
}

function walk(dir, out = []) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name !== "node_modules") walk(full, out);
        } else if (EXTENSIONS.test(entry.name)) out.push(full);
    }
    return out;
}

export function scan(frontend = FRONTEND) {
    const counts = {};
    const literals = {};
    for (const root of ROOTS) {
        const dir = path.join(frontend, root);
        if (!existsSync(dir)) continue;
        for (const full of walk(dir)) {
            const file = path.relative(frontend, full).replace(/\\/g, "/");
            if (SKIPPED.test(file)) continue;
            const found = colourLiterals(readFileSync(full, "utf8"));
            if (!found.length) continue;
            counts[file] = found.length;
            literals[file] = found;
        }
    }
    return { counts, literals };
}

function main() {
    const { counts, literals } = scan();
    const sorted = Object.fromEntries(
        Object.entries(counts).sort(([a], [b]) => (a < b ? -1 : 1))
    );
    if (process.argv.includes("--update")) {
        writeFileSync(BASELINE_PATH, JSON.stringify(sorted, null, 4) + "\n");
        console.log(
            `Baseline saved: ${
                Object.keys(sorted).length
            } files with their own colours.`
        );
        return;
    }
    const baseline = existsSync(BASELINE_PATH)
        ? JSON.parse(readFileSync(BASELINE_PATH, "utf8"))
        : {};
    const { raised, lowered } = compare(baseline, sorted);
    if (lowered.length)
        console.log(
            `${lowered.length} file(s) use fewer colours of their own than the baseline. Lower it with: pnpm -C frontend check:tokens:update`
        );
    if (!raised.length) {
        console.log("No new colours outside the design tokens.");
        return;
    }
    console.error(
        "Colours written in place instead of taken from the design tokens:\n"
    );
    for (const { file, before, count } of raised) {
        console.error(`${file}: ${count} (baseline ${before})`);
        for (const { line, text } of literals[file].slice(0, 12))
            console.error(`    ${line}: ${text.slice(0, 110)}`);
    }
    console.error(
        "\nUse the tokens in frontend/styles/tokens/ (docs/brand/tokens.md; browse them at /dev/tokens).\nIf a line truly needs its own colour, add a comment `tokens-ok: <why>` on it or above it."
    );
    process.exit(1);
}

if (
    process.argv[1] &&
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
    main();
