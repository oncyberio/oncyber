const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const sharp = require("sharp");
const { pinataResizeURL, auditPinataImage } = require("./cdn.cjs");
const { repairArtwork } = require("./media.cjs");
const data = { mime_type: "image/png", image_url: "https://cyber.mypinata.cloud/ipfs/cid?filename=art.png" };

test("Pinata audit excludes movies, animation and untrusted hosts", () => {
    const url = new URL(pinataResizeURL(data));
    assert.equal(url.searchParams.get("img-width"), "384");
    assert.equal(url.searchParams.get("img-fit"), "scale-down");
    assert.equal(url.searchParams.get("filename"), "art.png");
    for (const patch of [{ mime_type: "video/mp4" }, { mime_type: "image/gif" },
        { animation_url: "https://example.com/movie.mp4" },
        { image_url: "https://cyber.mypinata.cloud.evil.test/ipfs/cid" },
        { image_url: "https://user:pass@cyber.mypinata.cloud/ipfs/cid" },
        { image_url: "https://cyber.mypinata.cloud/ipfs/cid?filename=art.gif" }])
        assert.equal(pinataResizeURL({ ...data, ...patch }), null);
});
test("healthy resized image is decoded and reused without provider or production writes", async () => {
    const downloadImpl = async (_url, file, limits) => {
        assert.equal(limits.maxBytes, 4194304); assert.equal(limits.timeoutMs, 12000);
        await sharp({ create: { width: 384, height: 192, channels: 3, background: "red" } }).png().toFile(file);
        return { bytes: (await fs.stat(file)).size };
    };
    const result = await repairArtwork({ gallery: { artworks: { a: { data } } }, artworkId: "a", apply: true,
        auditCDN: d => auditPinataImage(d, { downloadImpl }),
        db: new Proxy({}, { get: () => assert.fail("Unexpected database access") }),
        bucket: new Proxy({}, { get: () => assert.fail("Unexpected cloud upload") }),
        provider: { get: () => assert.fail("Unexpected provider request") },
    });
    assert.equal(result.status, "audited-cdn"); assert.equal(result.width, 384);
});
test("unresized originals, invalid responses and failed transformations are not marked healthy", async () => {
    for (const downloadImpl of [async (_url, file) => {
        await sharp({ create: { width: 500, height: 500, channels: 3, background: "red" } }).png().toFile(file); return { bytes: 1000 };
    }, async (_url, file) => { await fs.writeFile(file, "<html>error</html>"); return { bytes: 18 }; },
    async () => { throw Error("Media HTTP 415"); }]) {
        assert.equal(await auditPinataImage(data, { downloadImpl }), null);
    }
});
test("failed CDN audit retains recovery path instead of declaring completion", async () => {
    const nft = { ...data, blockchain: "ethereum", contract_address: "0x" + "a".repeat(40), token_id: "1" };
    await assert.rejects(repairArtwork({ gallery: { artworks: { a: { data: nft } } }, artworkId: "a", apply: true,
        ref: { path: "exhibits/test" }, auditCDN: async () => null,
        provider: { get: async () => { throw Error("recovery reached"); } },
    }), /recovery reached/);
});

test("Pinata reuse follows viewer fallback fields and legacy gateway normalization", () => {
    const url = pinataResizeURL({ mime_type: "image/png", image_url: "https://retired.test/a",
        image_original_url: "https://polar-mountain-96590.herokuapp.com/https://opensea.mypinata.cloud/ipfs/cid?filename=a.png" });
    assert.equal(new URL(url).hostname, "cyber.mypinata.cloud");
    assert.equal(new URL(url).pathname, "/ipfs/cid");
});

test("temporary CDN failure defers the artwork instead of duplicating it in cloud storage", async () => {
    for (const error of [Object.assign(Error("Aborted"), { code: "ABORT_ERR" }), Error("Media HTTP 429"), Error("Media HTTP 503")]) {
        const result = await repairArtwork({ gallery: { artworks: { a: { data } } }, artworkId: "a", apply: true,
            auditCDN: d => auditPinataImage(d, { downloadImpl: async () => { throw error; } }),
            provider: { get: () => assert.fail("provider request during CDN outage") },
        });
        assert.equal(result.status, "unresolved"); assert.equal(result.reason, "cdn-temporarily-unavailable");
    }
});
