#!/usr/bin/env node
// Create a game from Bloom Garden, with the brief, manifest and bot stub
// the checks expect.
//
//   node scripts/games/new.mjs <id> [--name "Display Name"]
//
// Writes games/<id>/ (a copy of games/garden, renamed), games/<id>/BRIEF.md
// (from games/BRIEF.md), bot.json and scenario.json stubs, a game.json whose
// party statement is still to write, the game's saved keys in
// frontend/features/games/savedData.declared.json, and an entry in
// frontend/features/games/catalog.ts.
// The new game passes the contract, keys and manifest checks as it is (it
// is the garden, renamed) and fails `pnpm games:check <id>` on its brief,
// its party statement and its bot until they are written: that is the
// starting line, not a bug.
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
function swap(text, from, to, path, times) {
    const found = text.split(from).length - 1;
    if (!found || (times !== undefined && found !== times))
        throw new Error(
            `${path}: expected to find ${JSON.stringify(from)}${
                times === undefined ? "" : ` ${times} time(s), found ${found}`
            }; the Garden template changed`
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
    // The garden still speaks `garden:<kind>` to the page and names
    // itself to the runtime's helpers; the copy speaks as itself.
    edit(at("src/host/host.js"), (t) =>
        swap(
            t,
            'const PREFIX = "garden:"',
            `const PREFIX = "${id}:"`,
            "src/host/host.js",
            1
        )
    );
    edit(at("src/host/browser.js"), (t) =>
        swap(
            swap(t, '"garden"', `"${id}"`, "src/host/browser.js", 5),
            'prefix: "garden:"',
            `prefix: "${id}:"`,
            "src/host/browser.js",
            1
        )
    );
    edit(at("src/ui/main.js"), (t) =>
        swap(t, 'game: "garden"', `game: "${id}"`, "src/ui/main.js", 1)
    );
    edit(at("src/game/result.js"), (t) =>
        swap(t, "`garden-${", `\`${id}-\${`, "src/game/result.js", 1)
    );

    const manifest = JSON.parse(readFileSync(at("game.json"), "utf8"));
    // The formats stay the garden's (one shared activity, valid under the
    // contract) until the game has its own; what late, dropped and extra
    // players get is for the author to say, and the check waits for it.
    const todo = (what) => `TODO: say what ${what} (docs/games/party.md).`;
    writeFileSync(
        at("game.json"),
        JSON.stringify(
            {
                ...manifest,
                name,
                format: "match",
                party: {
                    ...manifest.party,
                    late: todo("a member who arrives late gets"),
                    dropped: todo("happens when a member drops"),
                    extra: todo("members a match does not seat get"),
                },
            },
            null,
            2
        ) + "\n"
    );
    // The page and the server know a game's saved keys through this file
    // (docs/games/saved-data.md): the copy declares what the garden does.
    const declared = join(
        root,
        "frontend/features/games/savedData.declared.json"
    );
    if (existsSync(declared)) {
        const all = JSON.parse(readFileSync(declared, "utf8"));
        if (all.garden) {
            all[id] = all.garden;
            writeFileSync(declared, JSON.stringify(all, null, 4) + "\n");
        }
    }
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
            { until: { screen: "match" }, timeoutMs: 10000 },
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
  2. Write the brief's formats into games/${id}/game.json "party" (formats, solo,
     play, late, dropped, extra); after changing "saved", run
     node scripts/games/saved-data.mjs sync.
  3. npm --prefix games/${id} ci, build the game, write bot.json's play and leave
     and scenario.json's steps.
  4. pnpm games:publish ${id} until it passes; that is done (docs/games/good-game.md).`);
}
