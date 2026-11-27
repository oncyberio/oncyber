// The starter game `oncyber new` writes: Lantern Tag (games/lantern-tag in
// the repository, a small contract game that uses every kit and passes
// every check), renamed, with a brief that says it is the starter's and
// notes in the source where a creator changes the world, the rules and the
// party's match. The template has one source: Lantern Tag itself. Only the
// few files a game outside the repository needs differently are kept here,
// in starter/.
import {
    cpSync,
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { PACKAGE, sdk } from "./paths.mjs";
import { idProblem } from "./project.mjs";

/** The contract's id (docs/games/publishing.md), starting with a letter. */
export const STARTER_ID = /^[a-z][a-z0-9-]{2,31}$/;
const TEMPLATE_ID = "lantern-tag";
const TEMPLATE_NAME = "Lantern Tag";

/** Not copied: installed and generated files, and what starter/ replaces. */
const SKIP = new Set([
    "node_modules",
    ".check",
    ".oncyber",
    ".device.log",
    "dist",
    // What the template's committed build was made from: the repository's
    // own record (scripts/games/build-record.mjs), not a game's file.
    "build.json",
    "package-lock.json",
    "package.json",
    "vite.config.js",
    "README.md",
    ".gitignore",
]);
const TEXT = /\.(js|mjs|ts|json|html|css|md)$/;

/** Where a creator starts changing things, said at the top of each file. */
const NOTES = {
    "src/world.js": [
        "STARTER: the world. Everything a visitor sees is built in this file from",
        "code. Change the look here: the ground, the walls, the light, the sky.",
        "Where things stand (the posts, the yard's size) comes from src/round.js.",
    ],
    "src/round.js": [
        "STARTER: the rules. One round, as plain data and pure functions: what is",
        "in play, how a point is scored, when the round ends and who won. Change",
        "the game here first, and keep test/round.test.js passing (npm test).",
    ],
    "src/match.js": [
        "STARTER: the party's match. Who runs a round when several people play,",
        "how the others follow it, and what a late or dropped member gets. Keep",
        'game.json "party" and BRIEF.md saying what this file does.',
    ],
    "src/game.js": [
        "STARTER: the game the page runs: screens, input, drawing, leaving. It",
        "joins the world (src/world.js), the rules (src/round.js) and the",
        "party's match (src/match.js). The lifecycle it implements is in the",
        "contract page: `oncyber docs contract`.",
    ],
};

const BRIEF_NOTE = (name) =>
    `> **Starter brief.** This describes ${name} as \`oncyber new\` created it: the\n` +
    "> starter game, unchanged. Rewrite each section for your own game before\n" +
    "> you change the code; the check holds the game to what is written here.\n" +
    "> How to write one: `oncyber docs brief`.\n";

function walk(dir, base = dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        if (SKIP.has(entry.name)) return [];
        const path = join(dir, entry.name);
        return entry.isDirectory()
            ? walk(path, base)
            : [relative(base, path).split("\\").join("/")];
    });
}

/** The words starter/ leaves for the new game's id and name. */
const fill = (text, { id, name }) =>
    text.split("%ID%").join(id).split("%NAME%").join(name);

/**
 * How a new game's package.json names this package. It is not on npm, so
 * the game points at where this copy is installed: a short relative path
 * when it is nearby (a parent folder's node_modules), else the full one.
 */
export function packageSpec(target) {
    const near = relative(resolve(target), PACKAGE).split("\\").join("/");
    return `file:${
        near && near.split("/").filter((part) => part === "..").length <= 3
            ? near
            : PACKAGE
    }`;
}

/** What `name` may be: it is written into HTML, JSON and Markdown as is. */
export function starterProblem({ id, name }) {
    if (!STARTER_ID.test(id ?? ""))
        return "the id is 3 to 32 lowercase letters, digits or dashes, starting with a letter";
    if (idProblem(id)) return idProblem(id);
    if (
        typeof name !== "string" ||
        !name.trim() ||
        name.length > 60 ||
        /["\\<>&`$\n\r]/.test(name)
    )
        return "the name is plain text, at most 60 characters";
    return null;
}

/**
 * Write the starter game into `target`.
 *
 * @param {{ target: string, id: string, name?: string, template?: string,
 *   overlay?: string, pkg?: string }} options
 *   `template` is Lantern Tag's folder, `overlay` the files kept in
 *   starter/, `pkg` the dependency the game's package.json names for this
 *   package (a version once it is on npm; until then a `file:` path).
 * @returns {{ target: string, files: string[] }}
 */
export function createStarter({
    target,
    id,
    name = id,
    template = sdk("games", TEMPLATE_ID),
    overlay = join(PACKAGE, "starter"),
    pkg = packageSpec(target),
}) {
    const problem = starterProblem({ id, name });
    if (problem) throw new Error(problem);
    target = resolve(target);
    if (existsSync(target) && readdirSync(target).length)
        throw new Error(`${basename(target)} already exists and is not empty`);
    if (!existsSync(join(template, "game.json")))
        throw new Error("the starter template is missing from this package");
    mkdirSync(target, { recursive: true });
    const rename = (text) =>
        text.split(TEMPLATE_ID).join(id).split(TEMPLATE_NAME).join(name);
    const files = [];
    const write = (path, text) => {
        mkdirSync(dirname(join(target, path)), { recursive: true });
        writeFileSync(join(target, path), text);
        files.push(path);
    };

    for (const path of walk(template)) {
        if (!TEXT.test(path)) {
            mkdirSync(dirname(join(target, path)), { recursive: true });
            cpSync(join(template, path), join(target, path));
            files.push(path);
            continue;
        }
        let text = rename(readFileSync(join(template, path), "utf8"));
        if (NOTES[path])
            text =
                NOTES[path].map((line) => `// ${line}\n`).join("") +
                "//\n" +
                text;
        if (path === "BRIEF.md")
            text = text.replace(/^(# .*\n)/, `$1\n${BRIEF_NOTE(name)}`);
        if (path === "game.json") {
            const manifest = JSON.parse(text);
            // The site sets a published game's rooms itself.
            const { crowdLabel } = manifest.page ?? {};
            manifest.page = crowdLabel ? { crowdLabel } : {};
            text = JSON.stringify(manifest, null, 4) + "\n";
        }
        write(path, text);
    }

    const from = JSON.parse(
        readFileSync(join(template, "package.json"), "utf8")
    );
    write(
        "package.json",
        JSON.stringify(
            {
                name: id,
                version: "0.1.0",
                private: true,
                type: "module",
                // The id the game is checked and published under.
                oncyber: { id },
                scripts: {
                    dev: "vite --host 127.0.0.1",
                    build: "vite build",
                    test: "node --test test/*.test.js",
                    check: "oncyber check",
                },
                dependencies: from.dependencies,
                devDependencies: { ...from.devDependencies, oncyber: pkg },
            },
            null,
            2
        ) + "\n"
    );
    for (const file of readdirSync(overlay))
        write(
            // npm leaves a file named .gitignore out of a package.
            file === "gitignore" ? ".gitignore" : file,
            fill(readFileSync(join(overlay, file), "utf8"), { id, name })
        );
    return { target, files: files.sort() };
}
