#!/usr/bin/env node
// What games sell: the products part of `pnpm games:check`, and the sync.
//
//   node scripts/games/products.mjs sync   write frontend/features/games/products.declared.json
//
// The page and the server know a game's products only through the synced
// file: the price charged is the one in it, never one a game sends. So the
// check fails when game.json and that file disagree. See
// docs/games/purchases.md.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { readProducts } from "../../games/runtime/src/purchases.ts";
import { standalone } from "./layout.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DECLARED = join(root, "frontend/features/games/products.declared.json");

/** A game's products as the synced file holds them: name, price, kind. */
export function declaredProducts(value) {
    const read = readProducts(value);
    if (!read.ok) return {};
    return Object.fromEntries(
        Object.keys(read.products).map((id) => [
            id,
            {
                name: read.products[id].name,
                price: value[id].price,
                kind: read.products[id].kind,
            },
        ])
    );
}

/** What the synced file should hold: every game that sells something. */
export function allProducts(gamesDir = join(root, "games")) {
    const all = {};
    for (const entry of readdirSync(gamesDir, { withFileTypes: true }).sort(
        (a, b) => a.name.localeCompare(b.name)
    )) {
        const file = join(gamesDir, entry.name, "game.json");
        if (!entry.isDirectory() || !existsSync(file)) continue;
        const products = declaredProducts(
            JSON.parse(readFileSync(file, "utf8")).products
        );
        if (Object.keys(products).length) all[entry.name] = products;
    }
    return all;
}

/** Findings any reading of game.json can tell, before the game runs. */
export function productStaticFindings({ id, manifest }, synced) {
    const read = readProducts(manifest?.products);
    if (!read.ok)
        return read.findings.map((message) => ({
            code: "PRODUCTS_INVALID",
            message,
        }));
    const known =
        synced ??
        (existsSync(DECLARED)
            ? JSON.parse(readFileSync(DECLARED, "utf8"))
            : {});
    // The synced file is the repository's; a game outside it has none.
    if (
        !standalone() &&
        !isDeepStrictEqual(
            known[id] ?? {},
            declaredProducts(manifest?.products)
        )
    )
        return [
            {
                code: "PRODUCTS_NOT_SYNCED",
                message:
                    "game.json `products` differs from what the page charges; run `node scripts/games/products.mjs sync` and commit the file",
            },
        ];
    return [];
}

// Run directly: sync.
if (
    process.argv[1] &&
    resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
    if (process.argv[2] === "sync") {
        writeFileSync(DECLARED, JSON.stringify(allProducts(), null, 4) + "\n");
        console.log("wrote frontend/features/games/products.declared.json");
    } else {
        console.error("usage: products.mjs sync");
        process.exit(2);
    }
}
