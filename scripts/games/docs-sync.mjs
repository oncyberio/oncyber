#!/usr/bin/env node
// Keep the in-app copy of "What a good game does" (served at /docs/good-game
// and listed in /llms.txt) equal to docs/games/good-game.md.
//
//   node scripts/games/docs-sync.mjs           write frontend/content/docs/good-game.md
//   node scripts/games/docs-sync.mjs --check   exit 1 when it is out of date
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, posix, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const SOURCE = "docs/games/good-game.md";
export const TARGET = "frontend/content/docs/good-game.md";

const FRONT = `---
title: What a good game does
description: Rules for coding agents building a game for Oncyber - arrival, the lobby handoff, parties, the solo path, the bot, and the checks that define done.
order: 6
---

`;

/** The in-app page: front matter, and repository links as plain paths. */
export function inAppPage(source) {
    const body = source.replace(
        /\[([^\]]+)\]\((?!https?:|\/|#)([^)]+)\)/g,
        (_, text, href) => {
            const path = posix.normalize(
                posix.join(posix.dirname(SOURCE), href)
            );
            return text.endsWith(posix.basename(path)) || text === href
                ? `\`${path}\``
                : `${text} (\`${path}\`)`;
        }
    );
    return FRONT + body;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    const page = inAppPage(readFileSync(join(repo, SOURCE), "utf8"));
    if (process.argv.includes("--check")) {
        if (readFileSync(join(repo, TARGET), "utf8") !== page) {
            console.error(
                `${TARGET} is out of date; run node scripts/games/docs-sync.mjs`
            );
            process.exit(1);
        }
    } else writeFileSync(join(repo, TARGET), page);
}
