const { test } = require("node:test");
const assert = require("node:assert/strict");
const { runLocalBatch, limitsFrom } = require("./local-batch.cjs");
const { runConfig } = require("./config.cjs");
const { repairArtwork, mediaFingerprint } = require("./media.cjs");
function fixture({ size = 3, artworkCount = 1 } = {}) {
    const ids = Array.from({ length: size }, (_, n) => `g${n}`);
    const values = { project: "prod", bucket: "cache", run: "existing", apply: true };
    const gallery = { artworks: Object.fromEntries(Array.from({ length: artworkCount }, (_, n) => [String(n), { data: { image_url: `https://example.com/${n}`, mime_type: "image/png" } }])) };
    const data = new Map([["galleryMaintenanceRuns/existing", runConfig(values, ids, 1)], ...ids.map(id => [`exhibits/${id}`, gallery])]);
    const writes = [];
    function ref(path) { return { path, id: path.split("/").pop(), collection: n => ({ doc: id => ref(`${path}/${n}/${id}`) }),
        get: async () => ({ data: () => data.get(path), exists: data.has(path) }),
        set: async (v, options) => { writes.push(path); data.set(path, options?.merge ? { ...data.get(path), ...v } : v); },
    }; }
    return { ids, values, data, writes, db: { collection: n => ({ doc: id => ref(`${n}/${id}`) }) }, bucket: {},
        index: async () => ({ status: "indexed" }), repair: async () => ({ status: "repaired" }),
        providerFactory: () => ({}), report: () => {},
    };
}
test("local gallery cap preserves remaining work and resumes completed checkpoints", async () => {
    const f = fixture();
    const first = await runLocalBatch({ ...f, limits: limitsFrom({ "max-galleries": "1" }) });
    assert.equal(first.completed, 1); assert.equal(first.status, "bounded-stop");
    const second = await runLocalBatch({ ...f, limits: limitsFrom({ "max-galleries": "1" }) });
    assert.equal(second.resumed, 1); assert.equal(second.completed, 1);
    assert.equal(f.data.get("galleryMaintenanceRuns/existing/galleries/g2"), undefined);
});
test("artwork cap never marks a partially repaired gallery complete", async () => {
    const f = fixture({ size: 1, artworkCount: 3 });
    const result = await runLocalBatch({ ...f, limits: limitsFrom({ "max-artworks": "1" }) });
    assert.equal(result.artworks, 1);
    assert.equal(f.data.get("galleryMaintenanceRuns/existing/galleries/g0").status, "partial");
    assert.equal(result.completed, 0);
    const resumed = await runLocalBatch({ ...f, limits: limitsFrom({ "max-artworks": "2" }) });
    assert.equal(resumed.artworks, 2); assert.equal(resumed.completed, 1);
});
test("size failures stop a gallery and stay blocked on the next local run", async () => {
    const f = fixture({ size: 1 });
    f.data.set("exhibits/g0", { ...f.data.get("exhibits/g0"), padding: "x".repeat(1048576) });
    const result = await runLocalBatch({ ...f, index: () => assert.fail("oversized gallery reached indexer") });
    assert.equal(result.blocked, 1);
    assert.equal(f.data.get("galleryMaintenanceRuns/existing/galleries/g0").status, "blocked-document-size");
    assert.equal((await runLocalBatch(f)).skipped, 1);
});
test("dry runs write no checkpoints and mismatched manifests are rejected", async () => {
    const f = fixture();
    await runLocalBatch({ ...f, values: { ...f.values, apply: false } });
    assert.deepEqual(f.writes, []);
    await assert.rejects(runLocalBatch({ ...f, ids: ["other"] }), /configuration differs/);
    for (const invalid of ["0", "-1", "NaN", "1.5"]) assert.throws(() => limitsFrom({ "max-requests": invalid }));
});
test("media size preflight avoids provider/download work, and prospective patch is checked transactionally", async () => {
    const gallery = { artworks: { a: { data: { mime_type: "image/png", image_url: "https://example.com/a" } } }, padding: "x".repeat(1048576) };
    await assert.rejects(repairArtwork({ gallery, ref: { path: "exhibits/a" }, artworkId: "a", apply: true, provider: { get: () => assert.fail("provider called") } }), /size review/);
    delete gallery.padding;
    const cache = { version: 1, width: 100, height: 100, previewUrl: "https://cache/a", sourceHash: mediaFingerprint(gallery.artworks.a.data) };
    const db = { collection: () => ({ doc: () => ({ get: async () => ({ data: () => ({ cache }) }) }) }),
        runTransaction: fn => fn({ get: async () => ({ data: () => ({ ...gallery, padding: "x".repeat(1048576) }) }),
            update: () => assert.fail("oversized update"), set: () => assert.fail("audit written without update"),
        }),
    };
    await assert.rejects(repairArtwork({ gallery, ref: { path: "exhibits/a" }, artworkId: "a", apply: true, db, provider: {} }), /size review/);
});

test("provider request exhaustion leaves resumable partial state", async () => {
    const f = fixture({ size: 1 });
    const result = await runLocalBatch({ ...f, limits: limitsFrom({ "max-requests": "2" }),
        providerFactory: ({ beforeRequest }) => ({ get: beforeRequest }),
        index: async ({ provider }) => { provider.get(); provider.get(); provider.get(); },
    });
    assert.equal(result.status, "bounded-stop"); assert.equal(result.requests, 2);
    assert.equal(f.data.get("galleryMaintenanceRuns/existing/galleries/g0").status, "partial");
    assert.equal(result.artworks, 0);
});
test("runtime is enforced before a provider cache read", async () => {
    const f = fixture({ size: 1 }); let time = 0;
    const result = await runLocalBatch({ ...f, now: () => time, limits: limitsFrom({ "max-seconds": "1" }),
        providerFactory: ({ cache }) => ({ get: key => cache.get(key) }),
        index: async ({ provider }) => { time = 1001; await provider.get("uncached"); },
    });
    assert.equal(result.status, "bounded-stop"); assert.equal(result.requests, 0);
    assert.equal(f.data.get("galleryMaintenanceRuns/existing/galleries/g0").status, "partial");
    assert.equal(f.writes.length, 1);
});

test("CDN audits are checkpointed and reused after a partial batch", async () => {
    const f = fixture({ size: 1, artworkCount: 2 });
    const first = await runLocalBatch({ ...f, repair: async () => ({ status: "audited-cdn" }), limits: limitsFrom({ "max-artworks": "1" }) });
    assert.equal(first.reusedCDN, 1); assert.equal(first.completed, 0);
    const second = await runLocalBatch({ ...f, repair: async () => ({ status: "audited-cdn" }), limits: limitsFrom({ "max-artworks": "1" }) });
    assert.equal(second.artworks, 1); assert.equal(second.completed, 1);
});

test("reviewed retry is restricted to one selected gallery and retains budgets", async () => {
    const f = fixture();
    for (const id of f.ids) f.data.set(`galleryMaintenanceRuns/existing/galleries/${id}`, { status: "needs-review" });
    const result = await runLocalBatch({ ...f, values: { ...f.values, "retry-gallery": "g1" } });
    assert.equal(result.completed, 1); assert.equal(result.galleries, 1);
    assert.equal(f.data.get("galleryMaintenanceRuns/existing/galleries/g0").status, "needs-review");
    assert.equal(f.data.get("galleryMaintenanceRuns/existing/galleries/g2").status, "needs-review");
    await assert.rejects(runLocalBatch({ ...f, values: { ...f.values, "retry-gallery": "unknown" } }), /not in this task/);
});

test("partial resumes preserve failed artwork for review without repeating expensive repair", async () => {
    const f = fixture({ size: 1, artworkCount: 2 });
    await runLocalBatch({ ...f, repair: async () => ({ status: "unresolved" }), limits: limitsFrom({ "max-artworks": "1" }) });
    const next = await runLocalBatch({ ...f, limits: limitsFrom({ "max-artworks": "1" }) });
    assert.equal(next.artworks, 1); assert.equal(next.unresolved, 1); assert.equal(next.completed, 0);
    assert.equal(f.data.get("galleryMaintenanceRuns/existing/galleries/g0").status, "needs-review");
    const retry = await runLocalBatch({ ...f, values: { ...f.values, "retry-gallery": "g0" } });
    assert.equal(retry.artworks, 1); assert.equal(retry.completed, 1);
});
