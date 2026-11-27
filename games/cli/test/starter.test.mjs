// The starter `oncyber new` writes is a complete contract game: nothing in
// it still names the template, and it passes every check that needs no
// browser as it is created.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
    existsSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    rmSync,
    statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createStarter, packageSpec, starterProblem } from "../lib/starter.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const dir = mkdtempSync(join(tmpdir(), "oncyber-starter-"));
after(() => rmSync(dir, { recursive: true, force: true }));
const target = join(dir, "sky-run");
const made = createStarter({ target, id: "sky-run", name: "Sky Run" });
const read = (file) => readFileSync(join(target, file), "utf8");
const all = (at = target) =>
    readdirSync(at).flatMap((name) =>
        statSync(join(at, name)).isDirectory()
            ? all(join(at, name))
            : [join(at, name)]
    );

test("the starter has every file a game is held to, and none of the template's leftovers", () => {
    for (const file of [
        "BRIEF.md",
        "README.md",
        ".gitignore",
        "game.json",
        "bot.json",
        "scenario.json",
        "index.html",
        "package.json",
        "vite.config.js",
        "src/game.js",
        "src/host.js",
        "src/world.js",
        "src/round.js",
        "src/match.js",
        "test/round.test.js",
        "public/licenses/three-MIT.txt",
    ])
        assert.ok(existsSync(join(target, file)), file);
    assert.deepEqual(
        made.files,
        all()
            .map((path) => path.slice(target.length + 1))
            .sort()
    );
    for (const file of ["package-lock.json", "node_modules", ".check", "dist"])
        assert.ok(!existsSync(join(target, file)), file);
    for (const path of all())
        if (/\.(js|json|html|css|md)$/.test(path))
            assert.doesNotMatch(
                readFileSync(path, "utf8"),
                /lantern-tag|Lantern Tag|%[A-Z]+%/,
                path
            );
});

test("the starter is named as asked, and speaks as itself", () => {
    const manifest = JSON.parse(read("game.json"));
    assert.equal(manifest.name, "Sky Run");
    // The site sets a published game's rooms itself.
    assert.deepEqual(manifest.page, { crowdLabel: "in the courtyard" });
    const pkg = JSON.parse(read("package.json"));
    assert.equal(pkg.name, "sky-run");
    assert.deepEqual(pkg.oncyber, { id: "sky-run" });
    assert.equal(pkg.scripts.build, "vite build");
    assert.match(pkg.devDependencies.oncyber, /^file:/);
    assert.ok(pkg.dependencies.three);
    assert.match(read("src/host.js"), /game: "sky-run"/);
    assert.match(read("index.html"), /<title>Sky Run — Oncyber<\/title>/);
    assert.match(
        read("BRIEF.md"),
        /^# Brief: Sky Run\n\n> \*\*Starter brief\.\*\*/
    );
    assert.match(read("README.md"), /^# Sky Run\n/);
});

test("the config is a few lines, and the source says where to start", () => {
    const config = read("vite.config.js");
    assert.match(config, /from "oncyber\/vite"/);
    assert.ok(config.split("\n").length < 10);
    for (const [file, word] of [
        ["src/world.js", "the world"],
        ["src/round.js", "the rules"],
        ["src/match.js", "the party's match"],
        ["src/game.js", "the game the page runs"],
    ])
        assert.ok(read(file).startsWith(`// STARTER: ${word}`), file);
});

test("as created, the starter passes the brief, party, bot and contract checks", async () => {
    const { readGameFiles, staticFindings } = await import(
        join(repo, "scripts/games/process.mjs")
    );
    const { contractFindings } = await import(
        join(repo, "scripts/games/contract-check.mjs")
    );
    const { checkListing } = await import(
        join(repo, "scripts/games/listing.mjs")
    );
    const manifest = JSON.parse(read("game.json"));
    assert.deepEqual(
        await staticFindings({ manifest, files: readGameFiles(target) }),
        []
    );
    const contract = contractFindings({
        root: repo,
        id: "sky-run",
        manifest,
        source: target,
        listed: true,
    });
    assert.deepEqual(contract.findings, []);
    assert.deepEqual(checkListing(manifest).findings, []);
});

test("the starter's own tests pass where it was created", () => {
    const run = spawnSync(
        process.execPath,
        ["--test", "test/round.test.js", "test/match.test.js"],
        { cwd: target, encoding: "utf8" }
    );
    assert.equal(run.status, 0, run.stdout + run.stderr);
});

test("an id or a name that would not survive is refused, and nothing is overwritten", () => {
    assert.match(starterProblem({ id: "Sky", name: "x" }), /lowercase/);
    assert.match(starterProblem({ id: "ab", name: "x" }), /3 to 32/);
    assert.match(
        starterProblem({ id: "9lives", name: "x" }),
        /starting with a letter/
    );
    assert.match(
        starterProblem({ id: "sky-run", name: 'Sky "Run"' }),
        /plain text/
    );
    assert.match(starterProblem({ id: "sky-run", name: "<b>" }), /plain text/);
    assert.equal(
        starterProblem({ id: "sky-run", name: "Sky Run 2: Night" }),
        null
    );
    // The site's own rules for an id, said at creation.
    assert.match(
        starterProblem({ id: "sky--run", name: "x" }),
        /single dashes/
    );
    assert.match(
        starterProblem({ id: "sky-run-", name: "x" }),
        /single dashes/
    );
    assert.match(starterProblem({ id: "sky-party", name: "x" }), /-party/);
    assert.throws(
        () => createStarter({ target, id: "sky-run" }),
        /already exists/
    );
    assert.throws(
        () => createStarter({ target: join(dir, "Bad"), id: "Bad" }),
        /lowercase/
    );
    assert.ok(!existsSync(join(dir, "Bad")));
});

test("a new game names this package by where it is installed", () => {
    assert.match(
        packageSpec(join(repo, "games/some-game")),
        /^file:\.\.\/cli$/
    );
    assert.match(
        packageSpec("/somewhere/far/away/from/here/game"),
        /^file:\/.*games\/cli$/
    );
});
