#!/usr/bin/env node
// Pre-commit formatting: Prettier on the staged files only, and only on
// files that were already Prettier-formatted before this commit (or are new).
//
// - A file that was not Prettier-formatted at HEAD is left exactly as staged,
//   so touching one line of an old file does not reformat all of it.
// - A file with unstaged changes as well is left alone too: formatting and
//   re-adding it would stage those other changes.
// - Formatted files are re-added, so the commit contains the formatted text.
// - Nothing here fails the commit; problems are printed and skipped.
//
// Skip the hook for one commit with `git commit --no-verify`, or HUSKY=0.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const git = (args, options = {}) =>
    execFileSync("git", args, {
        encoding: "utf8",
        maxBuffer: 1 << 28,
        ...options,
    });

/** Parses `git diff --name-status -z` output into { path, from } entries. */
export function parseNameStatus(output) {
    const parts = output.split("\0").filter((part) => part !== "");
    const entries = [];
    for (let i = 0; i < parts.length; ) {
        const status = parts[i++];
        if (status.startsWith("R") || status.startsWith("C")) {
            const from = parts[i++];
            entries.push({ status: status[0], from, path: parts[i++] });
        } else {
            const file = parts[i++];
            entries.push({ status: status[0], from: file, path: file });
        }
    }
    return entries;
}

/** The text of `file` at HEAD, or null when HEAD has no such file. */
function headText(root, file) {
    try {
        return git(["show", `HEAD:${file}`], {
            cwd: root,
            stdio: ["ignore", "pipe", "ignore"],
        });
    } catch {
        return null;
    }
}

export async function formatStaged({ root, prettier, log = console.log }) {
    const staged = parseNameStatus(
        git(
            [
                "diff",
                "--cached",
                "--name-status",
                "-z",
                "-M",
                "--diff-filter=ACMR",
            ],
            { cwd: root }
        )
    );
    const unstaged = new Set(
        git(["diff", "--name-only", "-z"], { cwd: root })
            .split("\0")
            .filter(Boolean)
    );
    const ignorePath = path.join(root, ".prettierignore");
    const result = {
        formatted: [],
        unchanged: [],
        skippedLegacy: [],
        skippedPartial: [],
        failed: [],
    };

    for (const entry of staged) {
        const file = path.join(root, entry.path);
        const info = await prettier.getFileInfo(file, { ignorePath });
        if (info.ignored || !info.inferredParser) continue;

        if (unstaged.has(entry.path)) {
            result.skippedPartial.push(entry.path);
            continue;
        }

        const options = {
            ...((await prettier.resolveConfig(file, { editorconfig: true })) ||
                {}),
            filepath: file,
        };

        try {
            const before = headText(root, entry.from);
            if (before !== null && !(await prettier.check(before, options))) {
                result.skippedLegacy.push(entry.path);
                continue;
            }
            const text = readFileSync(file, "utf8");
            const output = await prettier.format(text, options);
            if (output === text) {
                result.unchanged.push(entry.path);
                continue;
            }
            writeFileSync(file, output);
            git(["add", "--", entry.path], { cwd: root });
            result.formatted.push(entry.path);
        } catch (error) {
            result.failed.push(entry.path);
            log(
                `prettier: could not format ${entry.path}: ${
                    String(error?.message || error).split("\n")[0]
                }`
            );
        }
    }

    for (const file of result.formatted) log(`prettier: formatted ${file}`);
    if (result.skippedLegacy.length) {
        log(
            "prettier: left as staged (not Prettier-formatted before this commit):"
        );
        for (const file of result.skippedLegacy) log(`  ${file}`);
    }
    if (result.skippedPartial.length) {
        log("prettier: left as staged (it also has unstaged changes):");
        for (const file of result.skippedPartial) log(`  ${file}`);
    }
    return result;
}

const isMain =
    process.argv[1] &&
    fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
    const root = git(["rev-parse", "--show-toplevel"]).trim();
    // Prettier from this repository's install (root devDependency).
    const here = path.dirname(fileURLToPath(import.meta.url));
    const require = createRequire(path.join(here, "..", "package.json"));
    let prettier;
    try {
        prettier = require("prettier");
    } catch {
        console.log(
            "prettier: not installed (run pnpm install); skipping formatting."
        );
        process.exit(0);
    }
    formatStaged({ root, prettier }).then(
        () => process.exit(0),
        (error) => {
            console.log(`prettier: skipped (${error?.message || error})`);
            process.exit(0);
        }
    );
}
