#!/usr/bin/env node
// Copies the lobby's animation clips into the kit, so games play the same
// motion the lobby does. Run after the lobby's files change:
//   npm run motion            write motion/*.json
//   npm run motion -- --check exit 1 when they are out of date
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const lobby = resolve(here, "../../../../frontend/public/lobby");
const out = resolve(here, "../motion");
// The emotes a game gets by default: short loops, under 300 KiB together.
// The lobby's full set is 2.3 MiB; a game that wants more can pass its own.
export const KIT_EMOTES = ["HIPHOP", "MOONWALK", "PRAYING", "SITTING"];

export function build() {
    const locomotion = readFileSync(
        resolve(lobby, "native-avatar-motion.json"),
        "utf8"
    );
    const all = JSON.parse(
        readFileSync(resolve(lobby, "native-avatar-emotes.json"), "utf8")
    );
    const emotes = JSON.stringify(
        Object.fromEntries(KIT_EMOTES.map((name) => [name, all[name]]))
    );
    return { "locomotion.json": locomotion, "emotes.json": emotes };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const check = process.argv.includes("--check");
    let stale = 0;
    for (const [name, text] of Object.entries(build())) {
        const path = resolve(out, name);
        let current = "";
        try {
            current = readFileSync(path, "utf8");
        } catch {}
        if (current === text) continue;
        stale++;
        if (check)
            console.error(
                `avatar kit: motion/${name} is out of date; run npm run motion`
            );
        else writeFileSync(path, text);
    }
    process.exit(check && stale ? 1 : 0);
}
