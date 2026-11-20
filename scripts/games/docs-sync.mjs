#!/usr/bin/env node
// Keep the in-app copies of the games docs equal to their sources: "What a
// good game does" (docs/games/good-game.md, served at /docs/good-game) and
// the agent's guide (games/llms.txt, served at /docs/build-a-game). Both are
// listed in /llms.txt.
//
//   node scripts/games/docs-sync.mjs           write the copies in frontend/content/docs/
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

/** Prettier pads tables its own way; compare the words, not the padding. */
export const sameText = (a, b) => {
    const words = (text) =>
        text.replace(/[ \t]+/g, " ").replace(/-{3,}/g, "---");
    return words(a) === words(b);
};

// The agent's guide to building a game: the SDK's own games/llms.txt, served
// at /docs/build-a-game, at /games/llms.txt and listed first in /llms.txt.
export const GUIDE_SOURCE = "games/llms.txt";
export const GUIDE_TARGET = "frontend/content/docs/build-a-game.md";
const GUIDE_FRONT = `---
title: Build a game
description: Start here to make a game for Oncyber - what a game must do, what is optional (lobby arrival, avatars, animations, walking, parties, voice, results, saved data, menus) and the SDK helper for each.
order: 5.5
---

`;

/** The guide as an in-app page: front matter, then the file as written. */
export const guidePage = (source) => GUIDE_FRONT + source;

/** Each in-app copy: where it is written and what it should say. */
export const pages = () => [
    {
        target: TARGET,
        page: inAppPage(readFileSync(join(repo, SOURCE), "utf8")),
    },
    {
        target: GUIDE_TARGET,
        page: guidePage(readFileSync(join(repo, GUIDE_SOURCE), "utf8")),
    },
];

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    let stale = false;
    for (const { target, page } of pages()) {
        if (!process.argv.includes("--check"))
            writeFileSync(join(repo, target), page);
        else if (!sameText(readFileSync(join(repo, target), "utf8"), page)) {
            console.error(
                `${target} is out of date; run node scripts/games/docs-sync.mjs`
            );
            stale = true;
        }
    }
    if (stale) process.exit(1);
}
