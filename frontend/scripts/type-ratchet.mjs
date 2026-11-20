#!/usr/bin/env node
// Type-check ratchet for the frontend.
//
// The frontend has a few hundred known `tsc --noEmit` errors. This script
// runs the type check, reduces every error to "file + error code" (line
// numbers move with every edit, so they are left out), and compares that
// multiset with the committed baseline:
//
//   - any entry that is new, or more frequent than in the baseline, fails
//     the check (exit 1) and is printed;
//   - entries that went away are printed so the baseline can be lowered;
//   - `--update` rewrites the baseline from the current errors (exit 0).
//
// Usage (from frontend/):
//   node scripts/type-ratchet.mjs                 run tsc and compare
//   node scripts/type-ratchet.mjs --update        run tsc and save the result
//   node scripts/type-ratchet.mjs --from-log FILE compare a saved tsc output
//   node scripts/type-ratchet.mjs --from-log FILE --update
//
// No dependencies beyond Node and the workspace's own `typescript`.

import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The one knob: heap for the type check, in MB. The frontend needs about
// 10 GB; override with TYPECHECK_HEAP_MB on a smaller or larger machine.
export const DEFAULT_HEAP_MB = 10240;

const here = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND = path.resolve(here, "..");
export const BASELINE_PATH = path.join(here, "type-baseline.json");

// `file(line,col): error TS1234: message`, as tsc prints with --pretty false.
const LOCATED = /^(.+?)\((\d+),(\d+)\): error (TS\d+):/;
// Errors with no file, such as a bad tsconfig option.
const GLOBAL = /^error (TS\d+):/;

/** One key per error: "file TS1234". */
export function errorKey(file, code) {
    return `${file.replace(/\\/g, "/")} ${code}`;
}

/** tsc output text -> Map of "file TS1234" -> count. */
export function parseTscOutput(text) {
    const counts = new Map();
    for (const raw of String(text).split(/\r?\n/)) {
        const line = raw.replace(/\x1b\[[0-9;]*m/g, "");
        const located = LOCATED.exec(line);
        const global = located ? null : GLOBAL.exec(line);
        if (!located && !global) continue;
        const key = located
            ? errorKey(located[1], located[4])
            : errorKey("<global>", global[1]);
        counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
}

/** Total number of errors in a counts map. */
export function total(counts) {
    let n = 0;
    for (const count of counts.values()) n += count;
    return n;
}

/**
 * What changed between two counts maps. `added` lists entries that are new
 * or more frequent now (with how many more), `removed` the reverse.
 */
export function compare(baseline, current) {
    const added = [];
    const removed = [];
    const keys = new Set([...baseline.keys(), ...current.keys()]);
    for (const key of [...keys].sort()) {
        const before = baseline.get(key) || 0;
        const now = current.get(key) || 0;
        if (now > before) added.push({ key, count: now - before });
        if (now < before) removed.push({ key, count: before - now });
    }
    return { added, removed };
}

/** Counts map -> the committed JSON shape (sorted, so diffs stay small). */
export function toBaseline(counts) {
    const errors = {};
    for (const key of [...counts.keys()].sort()) errors[key] = counts.get(key);
    return { total: total(counts), errors };
}

/** The committed JSON shape -> counts map. */
export function fromBaseline(json) {
    const counts = new Map();
    for (const [key, count] of Object.entries(json?.errors || {})) {
        if (Number.isInteger(count) && count > 0) counts.set(key, count);
    }
    return counts;
}

export function readBaseline(file = BASELINE_PATH) {
    if (!existsSync(file)) return new Map();
    return fromBaseline(JSON.parse(readFileSync(file, "utf8")));
}

export function writeBaseline(counts, file = BASELINE_PATH) {
    writeFileSync(file, JSON.stringify(toBaseline(counts), null, 4) + "\n");
}

/** A human summary of a comparison, and whether it passes. */
export function report({ added, removed }, current) {
    const lines = [];
    const show = (entries) =>
        entries.map(
            ({ key, count }) => `  ${key}${count > 1 ? ` (x${count})` : ""}`
        );
    if (added.length) {
        lines.push(
            `New type errors (${added.reduce(
                (n, e) => n + e.count,
                0
            )}), not in the baseline:`,
            ...show(added),
            "",
            "Fix them, or if they are intended, run `pnpm -C frontend check:types:update` and commit the baseline."
        );
    }
    if (removed.length) {
        lines.push(
            `Errors that went away (${removed.reduce(
                (n, e) => n + e.count,
                0
            )}); lower the baseline with \`pnpm -C frontend check:types:update\`:`,
            ...show(removed)
        );
    }
    lines.push(`Type errors now: ${total(current)}.`);
    return { ok: added.length === 0, text: lines.join("\n") };
}

/** Runs `tsc --noEmit` for the frontend and resolves with its output. */
export function runTsc({ heapMb = DEFAULT_HEAP_MB, cwd = FRONTEND } = {}) {
    const require = createRequire(path.join(cwd, "package.json"));
    const tsc = require.resolve("typescript/lib/tsc.js");
    const args = [
        `--max-old-space-size=${heapMb}`,
        tsc,
        "--noEmit",
        "--pretty",
        "false",
        "-p",
        path.join(cwd, "tsconfig.json"),
    ];
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, args, { cwd });
        let out = "";
        child.stdout.on("data", (chunk) => (out += chunk));
        child.stderr.on("data", (chunk) => process.stderr.write(chunk));
        child.on("error", reject);
        child.on("close", (code, signal) => resolve({ code, signal, out }));
    });
}

async function main(argv) {
    const update = argv.includes("--update");
    const logIndex = argv.indexOf("--from-log");
    let text;
    if (logIndex !== -1) {
        const file = argv[logIndex + 1];
        if (!file) throw new Error("--from-log needs a file");
        text = readFileSync(file, "utf8");
    } else {
        const heapMb = Number(process.env.TYPECHECK_HEAP_MB) || DEFAULT_HEAP_MB;
        console.log(`Running tsc --noEmit (heap ${heapMb} MB)…`);
        const { code, signal, out } = await runTsc({ heapMb });
        text = out;
        // tsc exits 0 with no errors. Diagnostics exit 2 on a fresh incremental
        // build and 1 when cached errors are replayed without emitting output.
        // Require actual diagnostics for either error status; a crash or an
        // interrupted compiler is not a type-check result.
        const parsed = parseTscOutput(out);
        if (
            signal ||
            (code !== 0 && code !== 1 && code !== 2) ||
            (code !== 0 && !parsed.size)
        ) {
            process.stdout.write(out);
            console.error(
                `tsc did not finish (exit ${code}${
                    signal ? `, ${signal}` : ""
                }). ` + `If it ran out of memory, raise TYPECHECK_HEAP_MB.`
            );
            return 2;
        }
    }

    const current = parseTscOutput(text);
    if (update) {
        writeBaseline(current);
        console.log(
            `Baseline saved: ${total(current)} errors in ${path.relative(
                process.cwd(),
                BASELINE_PATH
            )}.`
        );
        return 0;
    }
    const result = report(compare(readBaseline(), current), current);
    console.log(result.text);
    return result.ok ? 0 : 1;
}

if (
    process.argv[1] &&
    fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
    main(process.argv.slice(2)).then(
        (code) => process.exit(code),
        (err) => {
            console.error(err?.message || err);
            process.exit(2);
        }
    );
}
