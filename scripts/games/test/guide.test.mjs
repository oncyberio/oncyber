// The agent's guide to building a game (games/llms.txt) must stay true:
// every path it names exists, every import it shows resolves, every doc
// page of an SDK area is linked, and the copy the site serves is the file.
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
    GUIDE_SOURCE,
    GUIDE_TARGET,
    guidePage,
    sameText,
} from "../docs-sync.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (path) => readFileSync(join(repo, path), "utf8");
const guide = read(GUIDE_SOURCE);

test("every path the guide names exists", () => {
    const paths = [
        ...guide.matchAll(/`((?:docs|games|frontend|scripts)\/[^`\s]+)`/g),
    ]
        .map((match) => match[1].replace(/<id>/g, "lantern-tag"))
        .filter((path) => !path.includes("<"));
    assert.ok(paths.length > 20);
    for (const path of new Set(paths))
        assert.ok(existsSync(join(repo, path)), `${path} does not exist`);
});

test("every import the guide shows resolves in the SDK", () => {
    // The names a game's Vite config maps differently from their file.
    const renamed = {
        "keys-browser": "keysBrowser",
        "device-controls": "deviceControls",
        "device-check": "deviceCheck",
    };
    const imports = new Set(
        [...guide.matchAll(/@oncyber\/[a-z-]+(?:\/[a-zA-Z.-]+)?/g)].map(
            (match) => match[0]
        )
    );
    assert.ok(imports.size >= 8);
    for (const name of imports) {
        const [, pkg, sub] = /^@oncyber\/([a-z-]+)(?:\/(.+))?$/.exec(name);
        const file =
            pkg === "game-runtime"
                ? !sub
                    ? "games/runtime/src/index.ts"
                    : `games/runtime/src/${renamed[sub] ?? sub}.ts`
                : pkg === "avatar-kit"
                ? "games/kits/avatar"
                : pkg === "kit-locomotion"
                ? "games/kits/locomotion/src/index.ts"
                : pkg === "game-ui"
                ? `games/kits/ui/${sub ?? ""}`
                : null;
        assert.ok(file && existsSync(join(repo, file)), `${name}: ${file}`);
    }
});

test("the guide links every page about an SDK area", () => {
    // Pages about running and shipping games, not about writing one.
    const operations = [
        "field-health.md",
        "releases.md",
        "trust.md",
        "listing.md",
    ];
    for (const page of readdirSync(join(repo, "docs/games")))
        if (page.endsWith(".md") && !operations.includes(page))
            assert.ok(
                guide.includes(`docs/games/${page}`),
                `games/llms.txt does not mention docs/games/${page}`
            );
});

test("the guide names every command it relies on", () => {
    const scripts = JSON.parse(read("package.json")).scripts;
    for (const [, name] of guide.matchAll(/pnpm (games:[a-z:]+)/g))
        assert.ok(scripts[name], `pnpm ${name} is not a script`);
});

test("the site serves the guide as written", () => {
    assert.ok(
        sameText(read(GUIDE_TARGET), guidePage(guide)),
        "run node scripts/games/docs-sync.mjs"
    );
});
