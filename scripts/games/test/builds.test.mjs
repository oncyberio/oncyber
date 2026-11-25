// A game's build is committed (frontend/public/games/<id>/), so it can fall
// behind what it was built from. This test fails when it has: when the
// runtime, a kit the game uses or the game's own source changed after the
// build, or when the committed files are not the ones that build wrote.
// The rule and the record are scripts/games/build-record.mjs.
import assert from "node:assert/strict";
import {
    cpSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
    BUILD_RECORD,
    buildDrift,
    gameIds,
    gameInputs,
    gameKits,
    writeBuildRecord,
} from "../build-record.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

test("every committed build was built from the source beside it", () => {
    const games = gameIds(repo);
    assert.ok(games.length >= 4, `only ${games.length} games found`);
    const drift = games.flatMap((id) => buildDrift(repo, id));
    assert.deepEqual(drift, [], `\n${drift.join("\n")}\n`);
});

test("every game's build writes its record", () => {
    for (const id of gameIds(repo)) {
        const { scripts } = JSON.parse(
            readFileSync(join(repo, "games", id, "package.json"), "utf8")
        );
        assert.match(
            scripts.build,
            new RegExp(`build-record\\.mjs ${id}$`),
            `games/${id}/package.json: the build must end by writing its record`
        );
    }
});

/** A small repository: one game, the runtime, two kits, and its build. */
function fake() {
    const root = mkdtempSync(join(tmpdir(), "oncyber-builds-"));
    const write = (path, text) => {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), text);
    };
    write("games/pong/game.json", "{}");
    write("games/pong/package.json", "{}");
    write(
        "games/pong/vite.config.js",
        'const ui = "../kits/ui"; // and the runtime'
    );
    write("games/pong/src/game.js", "export const a = 1;");
    write("games/pong/src/game.test.js", "test");
    write("games/pong/test/round.test.js", "test");
    write("games/pong/README.md", "# Pong");
    write("games/pong/node_modules/three/index.js", "three");
    write("games/pong/.check/screenshot.png", "png");
    write("games/runtime/src/keys.ts", "export const KEYS = 1;");
    write("games/runtime/test/keys.test.mjs", "test");
    write("games/kits/ui/src/index.ts", "export const ui = 1;");
    write("games/kits/ui/fonts/a.woff2", "font");
    write("games/kits/ui/README.md", "# UI");
    write("games/kits/ui/scripts/generate.mjs", "generate");
    write("games/kits/avatar/src/index.ts", "export const avatar = 1;");
    write("frontend/public/games/pong/index.html", "<!doctype html>");
    write("frontend/public/games/pong/assets/index-abc.js", "built");
    // What the check writes beside the build is not the build's.
    write("frontend/public/games/pong/check.json", "{}");
    write("frontend/public/games/pong/network.json", "{}");
    write("frontend/public/games/pong/credits.json", "{}");
    return { root, write };
}

test("a build's inputs are the game, the runtime and the kits it names", () => {
    const { root } = fake();
    try {
        assert.deepEqual(gameKits(root, "pong"), ["ui"]);
        assert.deepEqual(gameInputs(root, "pong"), [
            "games/kits/ui/fonts/a.woff2",
            "games/kits/ui/src/index.ts",
            "games/pong/game.json",
            "games/pong/package.json",
            "games/pong/src/game.js",
            "games/pong/vite.config.js",
            "games/runtime/src/keys.ts",
        ]);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test("a build is stale when any input changed, appeared or went", () => {
    const { root, write } = fake();
    try {
        // No record at all: nobody can say what it was built from.
        assert.match(buildDrift(root, "pong")[0], /has no record/);
        const record = writeBuildRecord(root, "pong");
        assert.deepEqual(Object.keys(record.outputs), [
            "assets/index-abc.js",
            "index.html",
        ]);
        assert.deepEqual(buildDrift(root, "pong"), []);
        // What the build does not read changes nothing.
        write("games/pong/README.md", "# Pong, again");
        write("games/pong/test/round.test.js", "another test");
        write("games/kits/avatar/src/index.ts", "export const avatar = 2;");
        write("games/kits/ui/README.md", "# UI, again");
        assert.deepEqual(buildDrift(root, "pong"), []);

        // The runtime moved on: the case this check exists for.
        write("games/runtime/src/keys.ts", "export const KEYS = 2;");
        const drift = buildDrift(root, "pong");
        assert.match(
            drift[0],
            /frontend\/public\/games\/pong was built before games\/runtime\/src\/keys\.ts changed/
        );
        assert.match(drift.at(-1), /pnpm games:publish pong/);
        write("games/runtime/src/keys.ts", "export const KEYS = 1;");
        assert.deepEqual(buildDrift(root, "pong"), []);

        write("games/kits/ui/src/index.ts", "export const ui = 2;");
        assert.match(
            buildDrift(root, "pong")[0],
            /kits\/ui\/src\/index\.ts changed/
        );
        write("games/kits/ui/src/index.ts", "export const ui = 1;");

        write("games/pong/src/extra.js", "export const b = 2;");
        assert.match(buildDrift(root, "pong")[0], /src\/extra\.js existed/);
        rmSync(join(root, "games/pong/src/extra.js"));

        rmSync(join(root, "games/pong/src/game.js"));
        assert.match(
            buildDrift(root, "pong")[0],
            /src\/game\.js, which is gone/
        );
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test("the committed files must be the build the record describes", () => {
    const { root, write } = fake();
    try {
        writeBuildRecord(root, "pong");
        // The check's own files come and go without the build changing.
        write("frontend/public/games/pong/check.json", '{"status":"passed"}');
        write("frontend/public/games/pong/thumbnail.jpg", "jpg");
        assert.deepEqual(buildDrift(root, "pong"), []);

        // The record committed without the build, or the other way round.
        write("frontend/public/games/pong/assets/index-abc.js", "rebuilt");
        assert.match(
            buildDrift(root, "pong")[0],
            /is not the build its record describes: assets\/index-abc\.js differs/
        );
        write("frontend/public/games/pong/assets/index-abc.js", "built");
        write("frontend/public/games/pong/assets/old-xyz.js", "left over");
        assert.match(
            buildDrift(root, "pong")[0],
            /holds assets\/old-xyz\.js, which the recorded build did not write/
        );
        rmSync(join(root, "frontend/public/games/pong/assets/old-xyz.js"));

        // A release.json from an earlier build names other files.
        write(
            "frontend/public/games/pong/release.json",
            JSON.stringify({
                files: [{ path: "index.html", sha256: "0".repeat(64) }],
            })
        );
        assert.match(
            buildDrift(root, "pong")[0],
            /release\.json lists index\.html with another hash/
        );

        // A game that was never built has nothing to fall behind.
        cpSync(join(root, "games/pong"), join(root, "games/new-game"), {
            recursive: true,
        });
        assert.ok(existsSync(join(root, "games/new-game", BUILD_RECORD)));
        assert.deepEqual(buildDrift(root, "new-game"), []);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});
