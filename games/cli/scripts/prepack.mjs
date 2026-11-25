#!/usr/bin/env node
// Make the package self-contained before `npm pack`: copy the parts of the
// repository a game needs into sdk/, laid out as they are in the repository
// so the check tool runs from there unchanged. `--clean` removes the copy
// (postpack): nothing here is committed.
//
//   sdk/games/runtime/         the lifecycle runtime (TypeScript source)
//   sdk/games/kits/            the avatar, locomotion and UI kits
//   sdk/games/lantern-tag/     the starter game's template
//   sdk/games/llms.txt, BRIEF.md, licenses.json
//   sdk/scripts/games/         the check tool
//   sdk/frontend/features/games/   the page's rules the check tool loads
//   sdk/frontend/features/lobby/   the lobby's motion code the avatar kit plays
//   sdk/docs/games/, sdk/docs/games.md
import {
    cpSync,
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pkg = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repo = resolve(pkg, "../..");
const out = join(pkg, "sdk");

rmSync(out, { recursive: true, force: true });
if (process.argv.includes("--clean")) process.exit(0);
if (!existsSync(join(repo, "scripts/games/games.mjs"))) {
    console.error(
        "oncyber: pack this package from a checkout of the repository (games/cli)"
    );
    process.exit(1);
}

const NEVER = new Set([
    "node_modules",
    ".check",
    ".oncyber",
    ".device.log",
    "dist",
    "package-lock.json",
]);
/** Copy a folder, leaving out installed and generated files and `skip`. */
function copy(from, { skip = () => false } = {}) {
    cpSync(join(repo, from), join(out, from), {
        recursive: true,
        filter: (path) =>
            !NEVER.has(basename(path)) &&
            !skip(
                path
                    .slice(repo.length + 1)
                    .split("\\")
                    .join("/")
            ),
    });
}
function write(path, text) {
    mkdirSync(dirname(join(out, path)), { recursive: true });
    writeFileSync(join(out, path), text);
}
const isTest = (path) =>
    /\.test\.m?[jt]s$/.test(path) || /(^|\/)test(\/|$)/.test(path);

copy("games/runtime", { skip: isTest });
copy("games/kits", {
    skip: (path) =>
        // The avatar check loads one fixture; the other tests stay behind.
        (isTest(path) &&
            !"games/kits/avatar/test/fixtures/square.vrm".startsWith(path)) ||
        /^games\/kits\/[^/]+\/scripts(\/|$)/.test(path) ||
        // The lobby's motion clips have no recorded licence
        // (games/licenses.json), so they are not redistributed.
        /^games\/kits\/avatar\/motion\/.+/.test(path),
});
// The avatar kit plays the lobby's own motion code, imported from the
// frontend (games/kits/avatar/src/lobby.ts): copy it and what it imports.
const lobbyMotion = new Set();
const follow = (path) => {
    if (lobbyMotion.has(path) || !existsSync(join(repo, path))) return;
    lobbyMotion.add(path);
    const text = readFileSync(join(repo, path), "utf8");
    for (const [, spec] of text.matchAll(/from\s+"(\.{1,2}\/[^"]+)"/g)) {
        const next = join(dirname(path), spec).split("\\").join("/");
        follow(next.endsWith(".ts") ? next : `${next}.ts`);
    }
};
follow("games/kits/avatar/src/lobby.ts");
for (const path of lobbyMotion)
    if (path.startsWith("frontend/features/lobby/")) copy(path);
copy("games/lantern-tag");
copy("scripts/games", {
    skip: (path) => isTest(path) || path.startsWith("scripts/games/fixtures"),
});
copy("docs/games");
for (const file of ["docs/games.md", "games/llms.txt", "games/BRIEF.md"])
    copy(file);

// The licence list without the repository's per-game exceptions: an
// exception is a person's decision about one of its games.
const licenses = JSON.parse(
    readFileSync(join(repo, "games/licenses.json"), "utf8")
);
write(
    "games/licenses.json",
    JSON.stringify({ ...licenses, exceptions: [] }, null, 4) + "\n"
);

// The page's own rules, which the check tool loads so the game is held to
// what the page really does. Each is a file with no imports.
const scripts = [];
const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (path.endsWith(".mjs"))
            scripts.push({ path, text: readFileSync(path, "utf8") });
    }
};
walk(join(out, "scripts/games"));
const GENERATED = "frontend/features/games/catalog.generated.ts";
// Named by path (read, or imported): the page's rules, and the lobby's
// movement constants the locomotion check compares a game's walk with.
const pageFiles = new Set(
    scripts.flatMap(({ text }) =>
        [
            ...text.matchAll(
                /(?:frontend\/features\/games|multiplayer\/protocol)\/[\w.-]+\.(?:ts|js)\b/g
            ),
        ]
            .map((match) => match[0])
            .filter((path) => existsSync(join(repo, path)))
    )
);
pageFiles.delete(GENERATED);
for (const path of pageFiles) {
    const text = readFileSync(join(repo, path), "utf8");
    if (/^\s*import\s(?!type\b)|\brequire\(\s*["']\./m.test(text)) {
        console.error(
            `oncyber: ${path} imports other files; the package copies it alone. Add what it imports to scripts/prepack.mjs`
        );
        process.exit(1);
    }
    copy(path);
}
// The repository's catalog lists its own games. Outside it there is none.
write(
    GENERATED,
    "// The catalog of the Oncyber repository's own games is not part of this\n// package: a game made outside it is not in a catalog.\nexport const GAMES = {};\n"
);

// The copy is laid out like the repository, whose root is not an ES module
// package: the plain .js files the check tool requires are CommonJS there.
write(
    "package.json",
    JSON.stringify({ name: "oncyber-sdk-files", private: true }, null, 2) + "\n"
);

// Every file the check tool imports by a relative path must have come
// along: a new import of something outside the copy fails the pack here,
// not a creator's check later.
const missing = [];
for (const { path, text } of scripts)
    for (const [, specifier] of text
        // Types are erased, so nothing is loaded for them.
        .replace(/^.*\bimport type\b.*$/gm, "")
        .matchAll(
            /(?:\bfrom|\bimport|\brequire)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/g
        ))
        if (!existsSync(resolve(dirname(path), specifier)))
            missing.push(`${path.slice(out.length + 1)} imports ${specifier}`);
if (missing.length) {
    console.error(
        `oncyber: the package would be incomplete:\n  ${missing.join(
            "\n  "
        )}\nAdd what is imported to scripts/prepack.mjs`
    );
    rmSync(out, { recursive: true, force: true });
    process.exit(1);
}

console.log(
    `oncyber: wrote sdk/ (${
        [...pageFiles].length
    } page files, the runtime, the kits, the check tool, the docs and the starter)`
);
