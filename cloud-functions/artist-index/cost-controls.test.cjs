const { test } = require("node:test");
const assert = require("node:assert/strict");
const { documentBytes, assertDocumentFits, isDocumentSizeError, SAFE_DOCUMENT_BYTES } = require("./document-size");
const { handleArtistEvent } = require("./handler");
const { indexGallery } = require("./indexer");
const { createOpenSea } = require("./opensea");
const log = { info() {}, warn() {} };
const gallery = { artworks: { a: { data: { creator: { username: "XCOPY" }, image_url: "https://example.com/a" } } } };
const event = { params: { exhibitId: "a" }, data: { before: { data: () => undefined }, after: { data: () => gallery, ref: {} } } };
test("size calculation matches published Firestore example and handles UTF-8, arrays, bytes, dates", () => {
    assert.equal(documentBytes({ type: "Personal", done: false, priority: 1, description: "Learn Cloud Firestore" }, "users/jeff/tasks/my_task_id"), 147);
    assert.equal(documentBytes({ x: "é" }) - documentBytes({ x: "a" }), 1);
    assert.ok(Number.isFinite(documentBytes({ x: [true, null, Buffer.alloc(3), new Date()] })));
    assert.throws(() => assertDocumentFits({ payload: "x".repeat(SAFE_DOCUMENT_BYTES) }), /size review/);
    assert.equal(isDocumentSizeError({ code: 3, message: "Document size (1048600 bytes) exceeds the maximum allowed size" }), true);
    assert.equal(isDocumentSizeError({ code: 3, message: "Malformed query" }), false);
});
test("automatic event indexing is saved-only and ignores its own and analytics writes", async () => {
    let calls = 0;
    await handleArtistEvent(event, { db: {}, logger: log, index: async options => {
        calls++; assert.equal(options.storedOnly, true); assert.equal(options.provider, undefined);
        return { status: "indexed" };
    } });
    await handleArtistEvent({ ...event, data: { ...event.data, before: { data: () => gallery }, after: { data: () => ({ ...gallery, number_of_visits: 9, artistSearch: {} }) } } }, {
        logger: log, index: () => assert.fail("unchanged source reindexed"),
    });
    assert.equal(calls, 1);
});
test("permanent size failures are acknowledged; transient failures remain retryable", async () => {
    const result = await handleArtistEvent(event, { logger: log, index: () => assertDocumentFits({ huge: "x".repeat(1048576) }) });
    assert.equal(result.status, "document-size-limit");
    await assert.rejects(handleArtistEvent(event, { logger: log, index: async () => { throw Error("unavailable"); } }), /unavailable/);
});
test("oversized index is rejected before provider requests or transaction updates", async () => {
    const data = { ...gallery, padding: "x".repeat(1048576) };
    const ref = { path: "exhibits/a", get: async () => ({ exists: true, data: () => data }) };
    await assert.rejects(indexGallery({ ref, apply: true,
        provider: { resolve: () => assert.fail("external call on oversized gallery") },
        db: { runTransaction: fn => fn({ get: ref.get, update: () => assert.fail("oversized write") }) },
    }), /size review/);
});
test("provider budget applies to retries, not just the first request", async () => {
    let calls = 0, attempts = 0;
    const provider = createOpenSea({ apiKey: "test", intervalMs: 0, wait: async () => {},
        beforeRequest: () => { if (attempts++ >= 2) throw Error("request budget"); },
        fetchImpl: async () => { calls++; return new Response("{}", { status: 429 }); },
    });
    await assert.rejects(provider.get("test"), /request budget/);
    assert.equal(calls, 2);
});
