// The file list, the release id and the listing entry the command sends
// are the ones the repository's own publishing computes.
import assert from "node:assert/strict";
import {
    cpSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { describeRelease, readAdvice, readCheck } from "../lib/publish.mjs";
import { readProject } from "../lib/project.mjs";
import { standinReleaseId } from "./standin.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const built = join(repo, "frontend/public/game-builds/lantern-tag");
const manifest = JSON.parse(
    readFileSync(join(repo, "games/lantern-tag/game.json"), "utf8")
);
const committed = JSON.parse(readFileSync(join(built, "release.json"), "utf8"));

test("a committed build gives the files and the release id pnpm games:publish wrote", async () => {
    const release = await describeRelease({
        id: "lantern-tag",
        out: built,
        manifest,
    });
    // Path, size and SHA-256 as the repository lists them; the MD5 beside
    // them is for a site's storage to check an upload by, and is no part
    // of the release id.
    assert.deepEqual(
        release.files.map(({ md5, ...file }) => file),
        committed.files
    );
    for (const file of release.files) assert.match(file.md5, /^[0-9a-f]{32}$/);
    assert.equal(release.release, committed.release);
    // The same id by the rule written out in the docs, not the shared code.
    assert.equal(standinReleaseId(release.files), committed.release);
    assert.equal(
        release.bytes,
        committed.files.reduce((sum, file) => sum + file.bytes, 0)
    );
    // What the contract says is not hashed.
    const paths = release.files.map((file) => file.path);
    for (const report of ["check.json", "release.json", "thumbnail.jpg"])
        assert.ok(!paths.includes(report), report);
    for (const part of ["index.html", "network.json", "credits.json"])
        assert.ok(paths.includes(part), part);
    assert.equal(release.thumbnail, "thumbnail.jpg");
});

test("the listing entry is the one pnpm games:catalog generates", async () => {
    const { entry } = await describeRelease({
        id: "lantern-tag",
        out: built,
        manifest,
    });
    const { GAMES: games } = await import(
        join(repo, "frontend/features/games/catalog.generated.ts")
    );
    assert.deepEqual(entry, games["lantern-tag"]);
    for (const field of [
        "title",
        "tagline",
        "description",
        "players",
        "partySizes",
        "devices",
        "tags",
        "crowdLabel",
    ])
        assert.ok(entry[field] !== undefined, field);
});

test("a build with no index.html, or a manifest with no listing, is refused before anything is sent", async () => {
    const dir = mkdtempSync(join(tmpdir(), "oncyber-cli-"));
    try {
        await assert.rejects(
            describeRelease({ id: "some-game", out: dir, manifest }),
            /oncyber build/
        );
        writeFileSync(join(dir, "index.html"), "<!doctype html>");
        await assert.rejects(
            describeRelease({
                id: "some-game",
                out: dir,
                manifest: { name: "x" },
            }),
            /game\.json: .*listing/
        );
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test("the check's word is taken only for the build it checked", async () => {
    const dir = mkdtempSync(join(tmpdir(), "oncyber-cli-"));
    try {
        assert.throws(
            () => readCheck({ reports: dir }, "0".repeat(16)),
            /oncyber check/
        );
        const write = (report) =>
            writeFileSync(join(dir, "check.json"), JSON.stringify(report));
        write({ status: "failed", hosted: { release: committed.release } });
        assert.throws(
            () => readCheck({ reports: dir }, committed.release),
            /failed/
        );
        write({
            status: "passed",
            checkedAt: "2026-11-17T00:00:00.000Z",
            hosted: { release: "f".repeat(16) },
        });
        assert.throws(
            () => readCheck({ reports: dir }, committed.release),
            /changed after/
        );
        write({
            status: "passed",
            checkedAt: "2026-11-17T00:00:00.000Z",
            hosted: { release: committed.release },
        });
        assert.deepEqual(readCheck({ reports: dir }, committed.release), {
            status: "passed",
            checkedAt: "2026-11-17T00:00:00.000Z",
            release: committed.release,
        });
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test("the game is the current folder; its id is package.json's, else the folder's name", () => {
    const dir = mkdtempSync(join(tmpdir(), "oncyber-cli-"));
    try {
        assert.throws(() => readProject(dir), /no game\.json here/);
        const game = join(dir, "sky-run");
        cpSync(
            join(repo, "games/lantern-tag/game.json"),
            join(game, "game.json")
        );
        const project = readProject(game);
        assert.equal(project.id, "sky-run");
        assert.equal(project.out, join(game, "dist"));
        assert.equal(project.reports, join(game, ".oncyber"));
        writeFileSync(
            join(game, "package.json"),
            JSON.stringify({ oncyber: { id: "other-id" } })
        );
        assert.equal(readProject(game).id, "other-id");
        writeFileSync(
            join(game, "package.json"),
            JSON.stringify({ oncyber: { id: "No" } })
        );
        assert.throws(() => readProject(game), /not a game id/);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test("what the check advised is read back for the publish to repeat", () => {
    const dir = mkdtempSync(join(tmpdir(), "oncyber-cli-"));
    try {
        // Never checked, or a report from before there was advice: nothing.
        assert.deepEqual(readAdvice({ reports: dir }), []);
        writeFileSync(join(dir, "check.json"), JSON.stringify({}));
        assert.deepEqual(readAdvice({ reports: dir }), []);
        const warnings = [
            {
                code: "SCENE_TRIANGLES_PHONE",
                message: "a frame draws 240,000 triangles.",
            },
        ];
        writeFileSync(
            join(dir, "check.json"),
            JSON.stringify({ status: "passed", warnings: [...warnings, null] })
        );
        assert.deepEqual(readAdvice({ reports: dir }), warnings);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
