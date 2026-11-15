#!/usr/bin/env node
// Asset rights for games: the `credits` stage of games:check, and the games
// section of THIRD_PARTY_NOTICES.md.
//
//   node scripts/games/credits.mjs            rewrite the notices section
//   node scripts/games/credits.mjs --check    exit 1 if it is out of date
//
// The rules live in games/runtime/src/credits.ts (pure, tested) and the
// licence allow list in games/licenses.json. This file only reads the disk.
// Docs: docs/games/credits.md.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { GENERATED_THUMBNAIL } from "./listing.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const NOTICES = join(root, "THIRD_PARTY_NOTICES.md");
const { NETWORK_FILE } = createRequire(import.meta.url)(
    join(root, "frontend/features/games/networkPolicy.js")
);

/**
 * Files the check writes beside a build, which need no credit: its reports,
 * the card picture it captures from the running game (listing.mjs) and the
 * network declaration it writes from game.json (networkCheck.mjs).
 */
const REPORTS = new Set([
    "check.json",
    "release.json",
    "credits.json",
    GENERATED_THUMBNAIL,
    NETWORK_FILE,
]);

async function rules() {
    try {
        return await import(
            pathToFileURL(join(root, "games/runtime/src/credits.ts")).href
        );
    } catch (error) {
        if (error?.code === "ERR_UNKNOWN_FILE_EXTENSION")
            throw new Error(
                "the credits check loads TypeScript source and needs Node 22.18 or newer"
            );
        throw error;
    }
}

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

function listFiles(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        return entry.isDirectory() ? listFiles(path) : [path];
    });
}

/** Text means valid UTF-8 with no NUL byte; anything else is a binary file. */
function isText(bytes) {
    if (bytes.includes(0)) return false;
    try {
        new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        return true;
    } catch {
        return false;
    }
}

function builtFiles(out) {
    if (!existsSync(out)) return [];
    return listFiles(out)
        .map((path) => relative(out, path).split(sep).join("/"))
        .filter((path) => !REPORTS.has(path))
        .sort()
        .map((path) => {
            const bytes = readFileSync(join(out, path));
            return { path, bytes: bytes.length, text: isText(bytes) };
        });
}

/** The licence each installed dependency declares, when the game's packages are installed. */
function declaredLicenses(source, dependencies) {
    const found = {};
    for (const name of Object.keys(dependencies)) {
        const path = join(source, "node_modules", name, "package.json");
        if (!existsSync(path)) continue;
        const license = readJson(path).license;
        if (typeof license === "string") found[name] = license;
    }
    return found;
}

/** Audit one game's build against its game.json. Reads only. */
export async function auditGame(id) {
    const { auditCredits } = await rules();
    const source = join(root, "games", id);
    const manifest = readJson(join(source, "game.json"));
    const packagePath = join(source, "package.json");
    const dependencies = existsSync(packagePath)
        ? readJson(packagePath).dependencies ?? {}
        : {};
    return auditCredits({
        game: id,
        name: manifest.name ?? id,
        credits: manifest.credits,
        files: builtFiles(join(root, "frontend/public/games", id)),
        licenses: readJson(join(root, "games/licenses.json")),
        dependencies,
        declaredLicenses: declaredLicenses(source, dependencies),
    });
}

function gameIds() {
    return readdirSync(join(root, "games"), { withFileTypes: true })
        .filter(
            (entry) =>
                entry.isDirectory() &&
                existsSync(join(root, "games", entry.name, "game.json"))
        )
        .map((entry) => entry.name)
        .sort();
}

/** THIRD_PARTY_NOTICES.md with the games section as the manifests say it should be. */
async function expectedNotices() {
    const { creditsNotices, spliceNotices } = await rules();
    const games = [];
    for (const id of gameIds()) games.push((await auditGame(id)).published);
    return spliceNotices(readFileSync(NOTICES, "utf8"), creditsNotices(games));
}

/**
 * The `credits` stage of games:check. Writes credits.json beside the build
 * (what the page's credits panel reads) and returns blocking findings and
 * non-blocking warnings.
 */
export async function checkCredits(id) {
    const audit = await auditGame(id);
    const findings = [...audit.findings];
    if (!findings.length) {
        writeFileSync(
            join(root, "frontend/public/games", id, "credits.json"),
            JSON.stringify(audit.published, null, 2) + "\n"
        );
        if ((await expectedNotices()) !== readFileSync(NOTICES, "utf8"))
            findings.push({
                code: "NOTICES_STALE",
                message:
                    "THIRD_PARTY_NOTICES.md does not match the games' credits; run `pnpm games:credits` and commit it",
            });
    }
    return {
        findings,
        warnings: audit.warnings,
        thirdParty: audit.published.credits.length,
        own: audit.published.own,
    };
}

if (
    process.argv[1] &&
    resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
    const expected = await expectedNotices();
    const current = readFileSync(NOTICES, "utf8");
    if (process.argv.includes("--check")) {
        if (expected !== current) {
            console.error(
                "games: THIRD_PARTY_NOTICES.md is out of date; run `pnpm games:credits`"
            );
            process.exit(1);
        }
        console.log("games: THIRD_PARTY_NOTICES.md matches the games' credits");
    } else {
        if (expected !== current) writeFileSync(NOTICES, expected);
        console.log(
            expected === current
                ? "games: THIRD_PARTY_NOTICES.md already up to date"
                : "games: wrote the games section of THIRD_PARTY_NOTICES.md"
        );
    }
}
