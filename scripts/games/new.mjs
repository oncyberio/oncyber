#!/usr/bin/env node
// Create a game from Lantern Tag, with the brief, manifest and bot stub
// the checks expect.
//
//   node scripts/games/new.mjs <id> [--name "Display Name"]
//
// Lantern Tag (games/lantern-tag) is the small worked example of the current
// contract: connectPage(), every kit, saved results and a party's match. It
// is the same template `oncyber new` starts a game outside the repository
// from (games/cli/lib/starter.mjs), so both ways in begin on the same code.
//
// Writes games/<id>/ (a copy of games/lantern-tag, renamed), games/<id>/BRIEF.md
// (from games/BRIEF.md), bot.json and scenario.json stubs, a game.json whose
// party statement is still to write, any saved keys the template declares
// in frontend/features/games/saved/savedData.declared.json, and a listing whose
// entry goes into the generated catalog
// (frontend/features/games/catalog.generated.ts, docs/games/listing.md).
// The new game passes the contract, keys and manifest checks as it is (it
// is Lantern Tag, renamed) and fails `pnpm games:check <id>` on its brief,
// its party statement and its bot until they are written: that is the
// starting line, not a bug.
import {
    cpSync,
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
    CATALOG_PATH,
    SLUGS_PATH,
    buildCatalog,
    readManifests,
    renderCatalog,
    renderSlugs,
    reservedSiteLinks,
} from "./listing.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
/** The template, and how it names itself in its own files. */
const TEMPLATE_ID = "lantern-tag";
const TEMPLATE_NAME = "Lantern Tag";
const SKIP = new Set([
    "node_modules",
    ".check",
    ".oncyber",
    ".device.log",
    "dist",
    // What a build of the template was made from (build-record.mjs).
    "build.json",
    "README.md",
    "BRIEF.md",
    "bot.json",
    "scenario.json",
]);
const TEXT = /\.(js|mjs|ts|json|html|css|md)$/;

function swap(text, from, to, path) {
    if (!text.includes(from))
        throw new Error(
            `${path}: expected to find ${JSON.stringify(from)}; it changed`
        );
    return text.split(from).join(to);
}

function walk(dir, base = dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        if (SKIP.has(entry.name)) return [];
        const path = join(dir, entry.name);
        return entry.isDirectory()
            ? walk(path, base)
            : [relative(base, path).split("\\").join("/")];
    });
}

export function createGame({ root = repo, id, name = id }) {
    if (!/^[a-z][a-z0-9-]{1,31}$/.test(id ?? ""))
        throw new Error(
            "the id is 2 to 32 lowercase letters, digits or dashes, starting with a letter"
        );
    if (/["\\<>&`$\n\r]/.test(name) || !name.trim())
        throw new Error("the name is plain text");
    const template = join(root, "games", TEMPLATE_ID);
    const target = join(root, "games", id);
    const catalog = join(root, CATALOG_PATH);
    if (existsSync(target)) throw new Error(`games/${id} already exists`);
    if (
        existsSync(catalog) &&
        new RegExp(`\\bid"?: "${id}"`).test(readFileSync(catalog, "utf8"))
    )
        throw new Error(`${id} is already in the catalog`);
    if (!existsSync(join(template, "game.json")))
        throw new Error(`games/${TEMPLATE_ID} (the template) is missing`);

    // Every file speaks as the new game: its id (the build folder, the
    // package name, its social room) and its name (titles and labels).
    const rename = (text) =>
        text.split(TEMPLATE_ID).join(id).split(TEMPLATE_NAME).join(name);
    const at = (file) => join(target, file);
    for (const path of walk(template)) {
        mkdirSync(dirname(at(path)), { recursive: true });
        if (TEXT.test(path))
            writeFileSync(
                at(path),
                rename(readFileSync(join(template, path), "utf8"))
            );
        else cpSync(join(template, path), at(path));
    }

    const manifest = JSON.parse(readFileSync(at("game.json"), "utf8"));
    // The formats stay the template's (a solo round and a party's, valid
    // under the contract) until the game has its own; what late, dropped
    // and extra players get is for the author to say, and the check waits
    // for it.
    const todo = (what) => `TODO: say what ${what} (docs/games/party.md).`;
    const { socialRoom } = manifest.page ?? {};
    writeFileSync(
        at("game.json"),
        JSON.stringify(
            {
                ...manifest,
                name,
                // The card is the new game's own: no shared room, and the
                // check takes its thumbnail (docs/games/listing.md).
                listing: {
                    tagline: "a new game",
                    description: `${name}: a new game made from the starter. Say here what the player does.`,
                    // As many as the template's formats seat, until the
                    // game has formats of its own.
                    players: manifest.listing?.players ?? { min: 1, max: 1 },
                    tags: ["new"],
                },
                // Chat and voice still need a room of the game's own.
                page: socialRoom ? { socialRoom } : {},
                format: "match",
                party: {
                    ...manifest.party,
                    late: todo("a member who arrives late gets"),
                    dropped: todo("happens when a member drops"),
                    extra: todo("members a match does not seat get"),
                },
            },
            null,
            4
        ) + "\n"
    );
    // The page and the server know a game's saved keys through this file
    // (docs/games/saved-data.md): the copy declares what the template does.
    const declared = join(
        root,
        "frontend/features/games/saved/savedData.declared.json"
    );
    if (existsSync(declared)) {
        const all = JSON.parse(readFileSync(declared, "utf8"));
        if (all[TEMPLATE_ID]) {
            all[id] = all[TEMPLATE_ID];
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
            { hold: "up", ms: 700 },
            { press: "interact" },
            { until: { screen: "menu" }, timeoutMs: 10000 },
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
        `# ${name}\n\nCreated with \`pnpm games:new ${id}\` from ${TEMPLATE_NAME}, the starter game. Start with [BRIEF.md](BRIEF.md);\nthe rules are in [docs/games/good-game.md](../../docs/games/good-game.md) and the SDK's guide is [games/llms.txt](../llms.txt).\n\n` +
            "```sh\nnpm ci\nnpm run dev                 # standalone, with live reload\n" +
            `pnpm games:publish ${id}    # from the repository root: build, check, release\n\`\`\`\n`
    );
    // The site's catalog is generated from the manifests.
    const built = buildCatalog(readManifests(root), {
        reserved: reservedSiteLinks(root),
    });
    writeFileSync(catalog, renderCatalog(built));
    writeFileSync(join(root, SLUGS_PATH), renderSlugs(built));
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
    console.log(`games/${id} created from Lantern Tag, the starter game. Next:
  0. Read games/llms.txt: what is required, what is optional, and the helper
     for each. The copy speaks the current contract; change its world, its
     rules and its party's match (src/world.js, src/round.js, src/match.js).
  1. Fill in games/${id}/BRIEF.md before writing code.
  2. Write the brief's formats into games/${id}/game.json "party" (formats, solo,
     play, late, dropped, extra); after changing "saved", run
     node scripts/games/saved-data.mjs sync.
  3. npm --prefix games/${id} ci, build the game, write bot.json's play and leave
     and scenario.json's steps.
  4. pnpm games:publish ${id} until it passes; that is done (docs/games/good-game.md).`);
}
