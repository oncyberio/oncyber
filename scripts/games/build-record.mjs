#!/usr/bin/env node
// What a game's committed build was made from, and the check that it still
// is. A build under frontend/public/games/<id>/ is committed, so it can fall
// behind the source it was built from: the runtime changes, the build does
// not, and the site serves the old one. This file keeps the two together.
//
//   node scripts/games/build-record.mjs <id>          write games/<id>/build.json
//   node scripts/games/build-record.mjs --check [id]  exit 1 when a build is stale
//
// Every game's `npm run build` ends by writing the record (see its
// package.json), so `pnpm games:publish <id>` does too. The record lists:
//
//   inputs   every file the build is made from, with its hash: the game's
//            own folder, the runtime (games/runtime/src) and each kit the
//            game names (games/kits/<kit>)
//   outputs  every file the build wrote, with its hash
//
// `pnpm games:test` (scripts/games/test/builds.test.mjs) fails when an input
// has changed since, when one was added or removed, or when the committed
// build is not the files the record lists. The fix is always the same:
// `pnpm games:publish <id>`, which builds, checks and records, then commit
// games/<id>/build.json with frontend/public/games/<id>/.
//
// A file here counts as an input even when the game does not import it (a
// runtime module it never uses): the rule has to be one a person can check
// by reading it, and rebuilding a game that did not need it costs minutes.
import { createHash } from "node:crypto";
import {
    existsSync,
    readdirSync,
    readFileSync,
    statSync,
    writeFileSync,
} from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** The record, beside the game's source. Never an input to itself. */
export const BUILD_RECORD = "build.json";
/** Folders that are installed or generated, in a game or a kit. */
const NOT_SOURCE_DIRS = new Set([
    "node_modules",
    ".check",
    ".oncyber",
    "dist",
    "test",
]);
/** Files of a game's folder the build does not read. */
const NOT_SOURCE_FILES = new Set([
    BUILD_RECORD,
    "README.md",
    "BRIEF.md",
    ".gitignore",
    ".device.log",
]);
/** Files of a kit's folder a game's build does not read. */
const NOT_KIT_FILES = new Set([
    "README.md",
    "package.json",
    "package-lock.json",
]);
/** A kit's own tools (its generators), not what a game bundles. */
const NOT_KIT_DIRS = new Set([...NOT_SOURCE_DIRS, "scripts"]);
const TEST_FILE = /\.test\.m?[jt]s$/;
const TEXT_FILE = /\.(js|mjs|ts|json|html|css)$/;
/**
 * In the build's folder but not written by the build: the check's reports,
 * and the two files the check writes from game.json before it lists the
 * release (scripts/games/releases/storage.mjs, credits.mjs).
 */
const NOT_OUTPUTS = new Set([
    "check.json",
    "release.json",
    "thumbnail.jpg",
    "network.json",
    "credits.json",
]);

const slashes = (path) => path.split(sep).join("/");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function walk(dir, skipDirs, skipFiles, base = dir) {
    if (!existsSync(dir)) return [];
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory())
            return skipDirs.has(entry.name)
                ? []
                : walk(path, skipDirs, skipFiles, base);
        return skipFiles.has(entry.name) || TEST_FILE.test(entry.name)
            ? []
            : [path];
    });
}

/** The ids of the games in `root`: every games/<id>/ with a game.json. */
export function gameIds(root = repo) {
    const games = join(root, "games");
    if (!existsSync(games)) return [];
    return readdirSync(games, { withFileTypes: true })
        .filter(
            (entry) =>
                entry.isDirectory() &&
                existsSync(join(games, entry.name, "game.json"))
        )
        .map((entry) => entry.name)
        .sort();
}

/** The kits a game names anywhere in its own files (`kits/<name>`). */
export function gameKits(root, id) {
    const kits = join(root, "games/kits");
    if (!existsSync(kits)) return [];
    const names = readdirSync(kits, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
    const text = walk(
        join(root, "games", id),
        NOT_SOURCE_DIRS,
        NOT_SOURCE_FILES
    )
        .filter((path) => TEXT_FILE.test(path))
        .map((path) => readFileSync(path, "utf8"))
        .join("\n");
    return names
        .filter((name) => new RegExp(`kits/${name}(?![a-z0-9-])`).test(text))
        .sort();
}

/** Every file a build of `id` is made from, as paths from `root`. */
export function gameInputs(root, id) {
    return [
        ...walk(join(root, "games", id), NOT_SOURCE_DIRS, NOT_SOURCE_FILES),
        ...walk(join(root, "games/runtime/src"), NOT_SOURCE_DIRS, new Set()),
        ...gameKits(root, id).flatMap((kit) =>
            walk(join(root, "games/kits", kit), NOT_KIT_DIRS, NOT_KIT_FILES)
        ),
    ]
        .map((path) => slashes(path.slice(root.length + 1)))
        .sort();
}

/** Where a game's committed build is. */
export const buildFolder = (root, id) =>
    join(root, "frontend/public/games", id);

/** Every file the build wrote, as paths from the build's folder. */
export function buildOutputs(root, id) {
    const out = buildFolder(root, id);
    return walk(out, new Set(), new Set())
        .map((path) => slashes(path.slice(out.length + 1)))
        .filter((path) => !NOT_OUTPUTS.has(path))
        .sort();
}

const hashes = (base, paths, length) =>
    Object.fromEntries(
        paths.map((path) => [
            path,
            sha256(readFileSync(join(base, path))).slice(0, length),
        ])
    );

/** The record of the build that is in the build's folder now. */
export function buildRecord(root, id) {
    return {
        version: 1,
        game: id,
        about: "What frontend/public/games/<game>/ was built from, written by the game's build (scripts/games/build-record.mjs). pnpm games:test fails when an input changed since or the build is not these outputs; rebuild with pnpm games:publish <game> and commit both.",
        // Enough of each hash to tell two versions of a file apart.
        inputs: hashes(root, gameInputs(root, id), 16),
        outputs: hashes(buildFolder(root, id), buildOutputs(root, id), 64),
    };
}

export function writeBuildRecord(root, id) {
    const record = buildRecord(root, id);
    writeFileSync(
        join(root, "games", id, BUILD_RECORD),
        JSON.stringify(record, null, 2) + "\n"
    );
    return record;
}

const some = (list) =>
    list.slice(0, 4).join(", ") +
    (list.length > 4 ? ` and ${list.length - 4} more` : "");

/**
 * Why the committed build of `id` is not a build of the source beside it:
 * one line per reason, empty when it is. A game with no build yet has
 * nothing to fall behind.
 */
export function buildDrift(root, id) {
    const out = buildFolder(root, id);
    if (!existsSync(join(out, "index.html"))) return [];
    const shown = `frontend/public/games/${id}`;
    const fix = `Rebuild and check it: pnpm games:publish ${id}, then commit games/${id}/${BUILD_RECORD} with ${shown}/.`;
    const path = join(root, "games", id, BUILD_RECORD);
    let record = null;
    try {
        record = JSON.parse(readFileSync(path, "utf8"));
    } catch {
        // Missing or unreadable: reported below.
    }
    if (!record || typeof record.inputs !== "object" || !record.outputs)
        return [
            `${shown} has no record of what it was built from (games/${id}/${BUILD_RECORD}). ${fix}`,
        ];
    const problems = [];
    const now = hashes(root, gameInputs(root, id), 16);
    const changed = Object.keys(now).filter(
        (file) => file in record.inputs && record.inputs[file] !== now[file]
    );
    const added = Object.keys(now).filter((file) => !(file in record.inputs));
    const removed = Object.keys(record.inputs).filter((file) => !(file in now));
    if (changed.length)
        problems.push(`${shown} was built before ${some(changed)} changed.`);
    if (added.length)
        problems.push(`${shown} was built before ${some(added)} existed.`);
    if (removed.length)
        problems.push(
            `${shown} was built from ${some(removed)}, which ${
                removed.length > 1 ? "are" : "is"
            } gone.`
        );
    const built = hashes(out, buildOutputs(root, id), 64);
    const differs = Object.keys(record.outputs).filter(
        (file) => built[file] !== record.outputs[file]
    );
    const unknown = Object.keys(built).filter(
        (file) => !(file in record.outputs)
    );
    if (differs.length)
        problems.push(
            `${shown} is not the build its record describes: ${some(differs)} ${
                differs.length > 1 ? "differ" : "differs"
            } or ${differs.length > 1 ? "are" : "is"} missing.`
        );
    if (unknown.length)
        problems.push(
            `${shown} holds ${some(
                unknown
            )}, which the recorded build did not write.`
        );
    // The release the page names (release.json) must be these same files.
    const release = join(out, "release.json");
    if (existsSync(release) && !differs.length && !unknown.length) {
        let listed = [];
        try {
            listed = JSON.parse(readFileSync(release, "utf8")).files ?? [];
        } catch {
            problems.push(`${shown}/release.json cannot be read.`);
        }
        const stale = listed
            .filter(
                (file) =>
                    !existsSync(join(out, file.path)) ||
                    !statSync(join(out, file.path)).isFile() ||
                    sha256(readFileSync(join(out, file.path))) !== file.sha256
            )
            .map((file) => file.path);
        if (stale.length)
            problems.push(
                `${shown}/release.json lists ${some(
                    stale
                )} with another hash: it is the release of an earlier build.`
            );
    }
    return problems.length ? [...problems, fix] : [];
}

if (
    process.argv[1] &&
    import.meta.url === pathToFileURL(process.argv[1]).href
) {
    const args = process.argv.slice(2);
    const check = args.includes("--check");
    const [id] = args.filter((arg) => !arg.startsWith("--"));
    if (check) {
        const lines = (id ? [id] : gameIds(repo)).flatMap((game) =>
            buildDrift(repo, game)
        );
        for (const line of lines) console.error(`games: ${line}`);
        process.exit(lines.length ? 1 : 0);
    }
    if (
        !/^[a-z0-9][a-z0-9-]{0,62}$/.test(id ?? "") ||
        !existsSync(join(repo, "games", id, "game.json"))
    ) {
        console.error(
            "usage: node scripts/games/build-record.mjs <id> | --check [id]"
        );
        process.exit(2);
    }
    if (!existsSync(join(buildFolder(repo, id), "index.html"))) {
        console.error(`games: frontend/public/games/${id} is not built`);
        process.exit(1);
    }
    const record = writeBuildRecord(repo, id);
    console.log(
        `games/${id}/${BUILD_RECORD}: ${
            Object.keys(record.inputs).length
        } inputs, ${Object.keys(record.outputs).length} files built`
    );
}
