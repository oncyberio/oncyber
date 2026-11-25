import test from "node:test";
import assert from "node:assert/strict";
import {
    connectPurchases,
    createPurchases,
    formatPrice,
    readPrice,
    readProducts,
    readPurchaseOutcome,
    readPurchaseRequest,
} from "../src/purchases.ts";

const declared = {
    "gold-racket": { name: "Gold racket", price: "2.50", kind: "permanent" },
    "coins-100": { name: "100 coins", price: "0.99", kind: "consumable" },
};

test("a price is dollars as text, read to cents without rounding", () => {
    assert.equal(readPrice("2.50"), 250);
    assert.equal(readPrice("2.5"), 250);
    assert.equal(readPrice("5"), 500);
    assert.equal(readPrice("0.10"), 10);
    assert.equal(readPrice("100.00"), 10000);
    for (const bad of [2.5, "0.09", "100.01", "1.999", "-1", "1e2", " 1", ""])
        assert.equal(readPrice(bad), null, String(bad));
    assert.equal(formatPrice(250), "$2.50");
    assert.equal(formatPrice(5), "$0.05");
});

test("products are read from game.json, and a game with none is fine", () => {
    assert.deepEqual(readProducts(undefined), { ok: true, products: {} });
    const read = readProducts(declared);
    assert.equal(read.ok, true);
    assert.deepEqual(read.products["gold-racket"], {
        id: "gold-racket",
        name: "Gold racket",
        cents: 250,
        kind: "permanent",
    });
});

test("each broken product is named", () => {
    const read = readProducts({
        Bad: { name: "x", price: "1", kind: "permanent" },
        free: { name: "Free", price: "0", kind: "permanent" },
        odd: { name: "", price: "1.00", kind: "rental" },
    });
    assert.equal(read.ok, false);
    assert.equal(read.findings.length, 4);
    assert.match(read.findings[0], /product id "Bad"/);
    assert.equal(readProducts([]).ok, false);
});

test("a request names a declared-looking product and an id", () => {
    assert.deepEqual(
        readPurchaseRequest({ request: "abc123", product: "coins-100", x: 1 }),
        { request: "abc123", product: "coins-100" }
    );
    assert.equal(
        readPurchaseRequest({ request: "a", product: "coins-100" }),
        null
    );
    assert.equal(
        readPurchaseRequest({ request: "abc123", product: "Coins" }),
        null
    );
    assert.equal(readPurchaseRequest(null), null);
});

test("an answer the game can't read is never a purchase", () => {
    assert.deepEqual(
        readPurchaseOutcome({ bought: true, order: "order-1" }, "p"),
        {
            bought: true,
            product: "p",
            order: "order-1",
        }
    );
    for (const odd of [
        null,
        {},
        { bought: true },
        { bought: "true", order: "order-1" },
        { bought: false, reason: "made-up" },
    ])
        assert.deepEqual(readPurchaseOutcome(odd, "p"), {
            bought: false,
            product: "p",
            reason: "unavailable",
        });
    assert.equal(
        readPurchaseOutcome({ bought: false, reason: "cancelled" }, "p").reason,
        "cancelled"
    );
});

test("buy asks the page once, and only for a declared product", async () => {
    const asked = [];
    let release;
    const purchases = createPurchases(
        {
            buy: (request) =>
                new Promise((resolve) => {
                    asked.push(request);
                    release = resolve;
                }),
            owned: async () => ({ products: ["gold-racket", "unknown", 3] }),
        },
        readProducts(declared).products
    );
    assert.deepEqual(await purchases.buy("sword"), {
        bought: false,
        product: "sword",
        reason: "undeclared",
    });
    const first = purchases.buy("coins-100");
    // A second ask while the first is open never reaches the page.
    assert.equal((await purchases.buy("coins-100")).reason, "busy");
    assert.equal(asked.length, 1);
    assert.deepEqual(purchases.inspect(), { asked: 1, bought: 0, pending: 1 });
    release({ bought: true, order: "order-42" });
    assert.deepEqual(await first, {
        bought: true,
        product: "coins-100",
        order: "order-42",
    });
    assert.deepEqual(purchases.inspect(), { asked: 1, bought: 1, pending: 0 });
    assert.deepEqual(await purchases.owned(), ["gold-racket"]);
});

test("a transport that fails is a refusal, not a throw", async () => {
    const purchases = createPurchases(
        {
            buy: () => Promise.reject(new Error("gone")),
            owned: () => Promise.reject(new Error("gone")),
        },
        readProducts(declared).products
    );
    assert.equal((await purchases.buy("coins-100")).reason, "unavailable");
    assert.deepEqual(await purchases.owned(), []);
});

function frame() {
    const listeners = new Set();
    const posted = [];
    const parent = { postMessage: (message) => posted.push(message) };
    const win = {
        parent,
        addEventListener: (_, listener) => listeners.add(listener),
        removeEventListener: (_, listener) => listeners.delete(listener),
    };
    const fromPage = (data, source = parent) =>
        listeners.forEach((listener) => listener({ source, data }));
    return { win, posted, fromPage };
}

test("embedded, the game asks the page and takes only the page's answer", async () => {
    const { win, posted, fromPage } = frame();
    const purchases = connectPurchases({ products: declared, window: win });
    const buying = purchases.buy("gold-racket");
    assert.equal(posted.length, 1);
    assert.equal(posted[0].type, "oncyber:game:purchase");
    assert.equal(posted[0].product, "gold-racket");
    // Not the page: ignored.
    fromPage(
        {
            type: "oncyber:game:purchase-result",
            request: posted[0].request,
            bought: true,
            order: "forged-1",
        },
        {}
    );
    fromPage({
        type: "oncyber:game:purchase-result",
        request: posted[0].request,
        bought: true,
        order: "order-7",
    });
    assert.deepEqual(await buying, {
        bought: true,
        product: "gold-racket",
        order: "order-7",
    });
    const owning = purchases.owned();
    assert.equal(posted[1].type, "oncyber:game:owned");
    fromPage({
        type: "oncyber:game:owned-result",
        request: posted[1].request,
        products: ["gold-racket"],
    });
    assert.deepEqual(await owning, ["gold-racket"]);
    // The page went away mid-purchase: nothing was bought.
    const open = purchases.buy("coins-100");
    purchases.dispose();
    assert.equal((await open).reason, "unavailable");
});

test("on its own a game can try its flow, and nothing is charged", async () => {
    const win = {};
    win.parent = win;
    const purchases = connectPurchases({ products: declared, window: win });
    const first = await purchases.buy("gold-racket");
    assert.equal(first.bought, true);
    assert.match(first.order, /^test-/);
    assert.equal((await purchases.buy("gold-racket")).reason, "already-owned");
    assert.equal((await purchases.buy("coins-100")).bought, true);
    assert.equal((await purchases.buy("coins-100")).bought, true);
    assert.deepEqual(await purchases.owned(), ["gold-racket"]);
    const refusing = connectPurchases({
        products: declared,
        window: win,
        standalone: "refuse",
    });
    assert.equal((await refusing.buy("coins-100")).reason, "unavailable");
});
