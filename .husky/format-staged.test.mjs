// Run with: node --test .husky/format-staged.test.mjs (from the repo root).
// Builds a throwaway git repository in the system temp folder; never touches
// this checkout.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatStaged, parseNameStatus } from "./format-staged.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const prettier = createRequire(path.join(here, "..", "package.json"))(
    "prettier"
);

const CLEAN = "export const a = 1;\n";
const MESSY = "export const   a=1\n";
const LEGACY = "export  const legacy =  1\nexport const other = 2;\n";

function repo() {
    const root = mkdtempSync(path.join(tmpdir(), "format-staged-"));
    const git = (...args) =>
        execFileSync("git", args, { cwd: root, encoding: "utf8" });
    git("init", "-q");
    git("config", "user.email", "test@example.invalid");
    git("config", "user.name", "Test");
    git("config", "commit.gpgsign", "false");
    git("config", "core.hooksPath", "/dev/null");
    const write = (file, text) => writeFileSync(path.join(root, file), text);
    const read = (file) => readFileSync(path.join(root, file), "utf8");
    const staged = (file) => git("show", `:${file}`);
    write(
        ".editorconfig",
        "root = true\n[*]\nindent_size = 4\nindent_style = space\n"
    );
    write(".prettierignore", "ignored.js\n");
    write("clean.js", CLEAN);
    write("legacy.js", LEGACY);
    write("partial.js", CLEAN);
    write("ignored.js", CLEAN);
    write("untouched.js", CLEAN);
    git("add", ".");
    git("commit", "-q", "-m", "start");
    return { root, git, write, read, staged };
}

const quiet = () => undefined;

test("a file that was formatted stays formatted, and is re-staged", async () => {
    const r = repo();
    try {
        r.write("clean.js", MESSY);
        r.git("add", "clean.js");
        const result = await formatStaged({
            root: r.root,
            prettier,
            log: quiet,
        });
        assert.deepEqual(result.formatted, ["clean.js"]);
        assert.equal(r.read("clean.js"), CLEAN);
        assert.equal(r.staged("clean.js"), CLEAN);
    } finally {
        rmSync(r.root, { recursive: true, force: true });
    }
});

test("a file that was not formatted before is left as staged", async () => {
    const r = repo();
    try {
        const edited = LEGACY.replace("other = 2", "other = 3");
        r.write("legacy.js", edited);
        r.git("add", "legacy.js");
        const result = await formatStaged({
            root: r.root,
            prettier,
            log: quiet,
        });
        assert.deepEqual(result.skippedLegacy, ["legacy.js"]);
        assert.equal(r.read("legacy.js"), edited);
        assert.equal(r.staged("legacy.js"), edited);
    } finally {
        rmSync(r.root, { recursive: true, force: true });
    }
});

test("a new file is formatted; a renamed old one is not", async () => {
    const r = repo();
    try {
        r.write("new.ts", "const  b : number=2\n");
        r.git("mv", "legacy.js", "moved.js");
        r.git("add", "new.ts");
        const result = await formatStaged({
            root: r.root,
            prettier,
            log: quiet,
        });
        assert.deepEqual(result.formatted, ["new.ts"]);
        assert.equal(r.staged("new.ts"), "const b: number = 2;\n");
        assert.deepEqual(result.skippedLegacy, ["moved.js"]);
        assert.equal(r.staged("moved.js"), LEGACY);
    } finally {
        rmSync(r.root, { recursive: true, force: true });
    }
});

test("a file with unstaged changes too is left alone", async () => {
    const r = repo();
    try {
        r.write("partial.js", MESSY);
        r.git("add", "partial.js");
        r.write("partial.js", MESSY + "export const   later=2\n");
        const result = await formatStaged({
            root: r.root,
            prettier,
            log: quiet,
        });
        assert.deepEqual(result.skippedPartial, ["partial.js"]);
        assert.equal(r.staged("partial.js"), MESSY);
        assert.equal(r.read("partial.js"), MESSY + "export const   later=2\n");
    } finally {
        rmSync(r.root, { recursive: true, force: true });
    }
});

test("ignored, unstaged and unparseable files are not touched", async () => {
    const r = repo();
    try {
        r.write("ignored.js", MESSY);
        r.write("untouched.js", MESSY);
        r.write("broken.js", "export const = ;\n");
        r.git("add", "ignored.js", "broken.js");
        const logged = [];
        const result = await formatStaged({
            root: r.root,
            prettier,
            log: (line) => logged.push(line),
        });
        assert.deepEqual(result.formatted, []);
        assert.deepEqual(result.failed, ["broken.js"]);
        assert.equal(r.staged("ignored.js"), MESSY);
        assert.equal(r.read("untouched.js"), MESSY);
        assert.equal(r.staged("broken.js"), "export const = ;\n");
        assert.ok(logged.some((line) => line.includes("broken.js")));
    } finally {
        rmSync(r.root, { recursive: true, force: true });
    }
});

test("name-status output with renames parses", () => {
    assert.deepEqual(
        parseNameStatus("M\0a.js\0R100\0old.js\0new.js\0A\0b.ts\0"),
        [
            { status: "M", from: "a.js", path: "a.js" },
            { status: "R", from: "old.js", path: "new.js" },
            { status: "A", from: "b.ts", path: "b.ts" },
        ]
    );
});
