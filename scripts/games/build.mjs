#!/usr/bin/env node
// Build one game, or every game, without checking it.
//
//   pnpm games:build <id>     npm run build in games/<id>
//   pnpm games:build          every game, one after another
//
// A game's own build writes its record (games/<id>/build.json, see
// build-record.mjs), so `pnpm games:test` knows what the committed build was
// made from. A build clears the game's check.json and release.json: this is
// for trying a change. To ship one, `pnpm games:publish <id>` builds, checks
// and writes the release.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gameIds } from "./build-record.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const [id] = process.argv.slice(2);
if (id !== undefined && !gameIds(repo).includes(id)) {
    console.error(
        `games: no games/${id}/game.json\nusage: pnpm games:build [id]   (${gameIds(
            repo
        ).join(", ")})`
    );
    process.exit(2);
}
for (const game of id ? [id] : gameIds(repo)) {
    const source = join(repo, "games", game);
    if (!existsSync(join(source, "node_modules"))) {
        console.error(
            `games: games/${game} has no node_modules; run npm --prefix games/${game} ci`
        );
        process.exit(1);
    }
    execFileSync("npm", ["run", "build"], { cwd: source, stdio: "inherit" });
}
