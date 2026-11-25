import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
    allProducts,
    declaredProducts,
    productStaticFindings,
} from "./products.mjs";

const products = {
    "gold-racket": {
        name: " Gold racket ",
        price: "2.5",
        kind: "permanent",
        art: "ignored",
    },
};

test("the synced entry keeps the name, the price as written and the kind", () => {
    assert.deepEqual(declaredProducts(products), {
        "gold-racket": { name: "Gold racket", price: "2.5", kind: "permanent" },
    });
    assert.deepEqual(declaredProducts(undefined), {});
});

test("a game with nothing to sell and nothing synced has no findings", () => {
    assert.deepEqual(
        productStaticFindings({ id: "garden", manifest: {} }, {}),
        []
    );
});

test("broken products are named; a changed price must be synced", () => {
    const broken = productStaticFindings(
        {
            id: "ace",
            manifest: {
                products: { x: { name: "X", price: 1, kind: "permanent" } },
            },
        },
        {}
    );
    assert.equal(broken[0].code, "PRODUCTS_INVALID");
    const manifest = { products };
    assert.equal(
        productStaticFindings({ id: "ace", manifest }, {})[0].code,
        "PRODUCTS_NOT_SYNCED"
    );
    const synced = { ace: declaredProducts(products) };
    assert.deepEqual(
        productStaticFindings({ id: "ace", manifest }, synced),
        []
    );
    const dearer = {
        products: { "gold-racket": { ...products["gold-racket"], price: "9" } },
    };
    assert.equal(
        productStaticFindings({ id: "ace", manifest: dearer }, synced)[0].code,
        "PRODUCTS_NOT_SYNCED"
    );
    // A game that stopped selling still has a stale entry to remove.
    assert.equal(
        productStaticFindings({ id: "ace", manifest: {} }, synced)[0].code,
        "PRODUCTS_NOT_SYNCED"
    );
});

test("sync reads every game folder and lists only games that sell", () => {
    const dir = mkdtempSync(join(tmpdir(), "oncyber-products-"));
    try {
        for (const [id, json] of [
            ["ace", { name: "Ace", products }],
            ["garden", { name: "Garden" }],
        ]) {
            mkdirSync(join(dir, id));
            writeFileSync(join(dir, id, "game.json"), JSON.stringify(json));
        }
        mkdirSync(join(dir, "kits"));
        assert.deepEqual(allProducts(dir), { ace: declaredProducts(products) });
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
