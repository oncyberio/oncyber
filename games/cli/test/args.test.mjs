import assert from "node:assert/strict";
import { test } from "node:test";
import { COMMANDS, HELP, UsageError, parseArgs } from "../lib/args.mjs";

test("a command, its arguments and its flags", () => {
    assert.deepEqual(parseArgs(["new", "sky-run", "--name", "Sky Run"]), {
        command: "new",
        args: ["sky-run"],
        flags: { name: "Sky Run" },
        rest: [],
    });
    assert.deepEqual(parseArgs(["new", "--name=Sky Run", "sky-run"]).flags, {
        name: "Sky Run",
    });
    assert.deepEqual(parseArgs(["check", "--video", "--headed"]).flags, {
        video: true,
        headed: true,
    });
    assert.deepEqual(parseArgs(["unpublish", "sky-run"]).args, ["sky-run"]);
    assert.deepEqual(parseArgs(["docs"]).args, []);
    assert.deepEqual(parseArgs(["docs", "party"]).args, ["party"]);
});

test("what follows -- goes to the game's own dev server", () => {
    assert.deepEqual(parseArgs(["dev", "--", "--port", "5000"]), {
        command: "dev",
        args: [],
        flags: {},
        rest: ["--port", "5000"],
    });
    assert.throws(() => parseArgs(["build", "--", "x"]), UsageError);
});

test("help and version, wherever they are asked", () => {
    for (const argv of [
        [],
        ["help"],
        ["--help"],
        ["publish", "--help"],
        ["-h"],
    ])
        assert.equal(parseArgs(argv).command, "help");
    assert.equal(parseArgs(["--version"]).command, "version");
});

test("mistakes are usage errors, not guesses", () => {
    assert.throws(() => parseArgs(["frob"]), /unknown command: frob/);
    assert.throws(() => parseArgs(["new"]), /usage: oncyber new <id>/);
    assert.throws(() => parseArgs(["new", "a", "b"]), /usage/);
    assert.throws(() => parseArgs(["unpublish"]), /usage: oncyber unpublish/);
    assert.throws(() => parseArgs(["check", "--fast"]), /has no --fast/);
    assert.throws(
        () => parseArgs(["new", "a", "--name"]),
        /--name needs a value/
    );
    assert.throws(
        () => parseArgs(["new", "a", "--name", "--video"]),
        /--name needs a value/
    );
    assert.throws(() => parseArgs(["check", "--video=1"]), /takes no value/);
    assert.throws(() => parseArgs(["publish", "extra"]), /usage/);
});

test("the help names every command", () => {
    for (const command of Object.keys(COMMANDS))
        assert.match(HELP, new RegExp(`oncyber ${command}\\b`), command);
    for (const variable of ["ONCYBER_BASE_URL", "ONCYBER_SESSION_TOKEN"])
        assert.ok(HELP.includes(variable), variable);
});
