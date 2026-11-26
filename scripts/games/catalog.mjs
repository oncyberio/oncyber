#!/usr/bin/env node
// Write frontend/features/games/catalog.generated.ts from games/*/game.json,
// and the games' slugs beside it (catalog.slugs.json), which the site's
// reserved links read.
//
//   node scripts/games/catalog.mjs           write the catalog
//   node scripts/games/catalog.mjs --check   exit 1 when it is out of date
//
// See docs/games/listing.md.
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
    CATALOG_PATH,
    SLUGS_PATH,
    buildCatalog,
    catalogStale,
    readManifests,
    renderCatalog,
    renderSlugs,
    reservedSiteLinks,
} from "./listing.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

if (process.argv.includes("--check")) {
    const stale = catalogStale(root);
    if (stale) {
        console.error(`games: ${stale}`);
        process.exit(1);
    }
    console.log("games: catalog is up to date");
    process.exit(0);
}

let catalog;
try {
    catalog = buildCatalog(readManifests(root), {
        reserved: reservedSiteLinks(root),
    });
} catch (error) {
    console.error(`games: ${error.message}`);
    process.exit(1);
}
const path = join(root, CATALOG_PATH);
let source = renderCatalog(catalog);
// Formatted like the rest of the repository when Prettier is installed; the
// freshness check reads the `source:` line, not the layout.
try {
    const prettier = createRequire(join(root, "package.json"))("prettier");
    const options =
        (await prettier.resolveConfig(path, { editorconfig: true })) ?? {};
    source = await prettier.format(source, { ...options, filepath: path });
} catch {
    // Unformatted output is still valid TypeScript.
}
writeFileSync(path, source);
writeFileSync(join(root, SLUGS_PATH), renderSlugs(catalog));
console.log(
    `games: wrote ${CATALOG_PATH} (${Object.keys(catalog.games).join(", ")})`
);
