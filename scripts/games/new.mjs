#!/usr/bin/env node
// Create a game from Bloom Garden, with the brief, manifest and bot stub
// the checks expect.
//
//   node scripts/games/new.mjs <id> [--name "Display Name"]
//
// Writes games/<id>/ (a copy of games/garden, renamed), games/<id>/BRIEF.md
// (from games/BRIEF.md), bot.json and scenario.json stubs, a game.json with
// an empty party offer, and an entry in frontend/features/games/catalog.ts.
// The new game fails `pnpm games:check <id>` until the brief is filled in
// and the bot plays a match: that is the starting line, not a bug.
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SKIP = new Set([
    "node_modules",
    ".check",
    ".device.log",
    "dist",
    "README.md",
    "BRIEF.md",
    "bot.json",
    "scenario.json",
]);

const edit = (path, change) =>
    writeFileSync(path, change(readFileSync(path, "utf8")));
function swap(text, from, to, path) {
    if (!text.includes(from))
        throw new Error(
            `${path}: expected to find ${JSON.stringify(
                from
            )}; the Garden template changed`
        );
    return text.split(from).join(to);
}

export function createGame({ root = repo, id, name = id }) {
    if (!/^[a-z][a-z0-9-]{1,31}$/.test(id ?? ""))
        throw new Error(
            "the id is 2 to 32 lowercase letters, digits or dashes, starting with a letter"
        );
    if (/["\\\n]/.test(name) || !name.trim())
        throw new Error("the name is plain text");
    const template = join(root, "games/garden");
    const target = join(root, "games", id);
    const catalog = join(root, "frontend/features/games/catalog.ts");
    if (existsSync(target)) throw new Error(`games/${id} already exists`);
    if (new RegExp(`^    ${id}: \\{`, "m").test(readFileSync(catalog, "utf8")))
        throw new Error(`${id} is already in the catalog`);

    cpSync(template, target, {
        recursive: true,
        filter: (path) => path === template || !SKIP.has(basename(path)),
    });
    const at = (file) => join(target, file);
    edit(at("package.json"), (t) =>
        swap(t, "@oncyber-games/garden", `@oncyber-games/${id}`, "package.json")
    );
    edit(at("package-lock.json"), (t) =>
        swap(
            t,
            "@oncyber-games/garden",
            `@oncyber-games/${id}`,
            "package-lock.json"
        )
    );
    edit(at("vite.config.js"), (t) =>
        swap(
            t,
            "frontend/public/games/garden",
            `frontend/public/games/${id}`,
            "vite.config.js"
        )
    );
    edit(at("scripts/build-ui.mjs"), (t) =>
        swap(
            t,
            "frontend/public/games/garden",
            `frontend/public/games/${id}`,
            "scripts/build-ui.mjs"
        )
    );
    edit(at("src/host/host.js"), (t) =>
        swap(
            swap(
                t,
                'const PREFIX = "garden:"',
                `const PREFIX = "${id}:"`,
                "src/host/host.js"
            ),
            "bloom-garden:",
            `${id}:`,
            "src/host/host.js"
        )
    );

    const manifest = JSON.parse(readFileSync(at("game.json"), "utf8"));
    const todo = "TODO";
    writeFileSync(
        at("game.json"),
        JSON.stringify(
            {
                ...manifest,
                name,
                format: "match",
                party: { 1: todo, 2: todo, 3: todo, 4: todo, "5-8": todo },
            },
            null,
            2
        ) + "\n"
    );
    writeFileSync(
        at("BRIEF.md"),
        swap(
            readFileSync(join(root, "games/BRIEF.md"), "utf8"),
            "TODO game name",
            name,
            "games/BRIEF.md"
        )
    );
    // The bot walks and starts with the template's actions; playing a match
    // is for the game's author to write.
    const bot = {
        version: 1,
        arrival: [
            { hold: "forward", ms: 700 },
            { press: "interact" },
            { until: { screen: "match" } },
        ],
        play: [],
        leave: [],
    };
    writeFileSync(at("bot.json"), JSON.stringify(bot, null, 4) + "\n");
    const scenario = {
        version: 1,
        steps: [
            { type: "wait", frames: 30 },
            { type: "assert", key: "booted", equals: true },
        ],
    };
    writeFileSync(
        at("scenario.json"),
        JSON.stringify(scenario, null, 4) + "\n"
    );
    writeFileSync(
        at("README.md"),
        `# ${name}\n\nCreated with \`pnpm games:new ${id}\` from Bloom Garden. Start with [BRIEF.md](BRIEF.md);\nthe rules are in [docs/games/good-game.md](../../docs/games/good-game.md).\n\n` +
            "```sh\nnpm ci\nnpm run dev                 # standalone, with live reload\n" +
            `pnpm games:publish ${id}    # from the repository root: build, check, release\n\`\`\`\n`
    );
    edit(catalog, (t) =>
        swap(
            t,
            "\n};\n\nexport function findGame",
            `\n    ${
                JSON.stringify(id).includes("-") ? JSON.stringify(id) : id
            }: {\n        id: "${id}",\n        title: "${name}",\n        tagline: "a new game",\n        room: null,\n        relay: false,\n        crowdLabel: "",\n    },\n};\n\nexport function findGame`,
            "catalog.ts"
        )
    );
    return {
        target,
        files: ["BRIEF.md", "game.json", "bot.json", "scenario.json"],
    };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    const [id, ...rest] = process.argv.slice(2);
    const flag = rest.indexOf("--name");
    try {
        createGame({ id, name: flag >= 0 ? rest[flag + 1] ?? "" : id });
    } catch (error) {
        console.error(
            `games: ${error.message}\nusage: pnpm games:new <id> [--name "Display Name"]`
        );
        process.exit(1);
    }
    console.log(`games/${id} created from Bloom Garden. Next:
  1. Fill in games/${id}/BRIEF.md before writing code.
  2. Copy the brief's formats into games/${id}/game.json "party".
  3. npm --prefix games/${id} ci, build the game, write bot.json's play and leave.
  4. pnpm games:publish ${id} until it passes; that is done (docs/games/good-game.md).`);
}
