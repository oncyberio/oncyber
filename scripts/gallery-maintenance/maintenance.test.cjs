const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { mediaURL, publicIP, retiredURL } = require("./network.cjs");
const { optimize, probe } = require("./optimize.cjs");
const { mediaFingerprint, candidates } = require("./media.cjs");
const sharp = require("sharp"),
    exec = promisify(execFile);

test("media downloads reject local/private targets and normalize original IPFS sources", () => {
    for (const ip of [
        "127.0.0.1",
        "10.1.2.3",
        "169.254.169.254",
        "172.16.1.1",
        "192.168.1.2",
        "100.64.0.1",
        "::1",
        "::ffff:127.0.0.1",
        "fc00::1",
    ])
        assert.equal(publicIP(ip), false, ip);
    for (const url of [
        "file:///etc/passwd",
        "http://localhost/a",
        "https://127.0.0.1/a",
        "https://u:p@example.com/a",
        "http://example.com:22/a",
    ])
        assert.equal(mediaURL(url), null);
    assert.equal(publicIP("8.8.8.8"), true);
    assert.equal(
        mediaURL("ipfs://ipfs/abc/image.png"),
        "https://cyber.mypinata.cloud/ipfs/abc/image.png"
    );
    assert.equal(
        retiredURL("https://res.cloudinary.com/oncyber-io/image/upload/a.png"),
        true
    );
    assert.equal(
        retiredURL("https://res.cloudinary.com/other/image/upload/a.png"),
        false
    );
});
test("derived cache writes do not invalidate source guards, but a changed NFT or URL does", () => {
    const d = {
        mime_type: "image/gif",
        image_url: "https://example.com/a.gif",
        blockchain: "ethereum",
        contract_address: "0x" + "a".repeat(40),
        token_id: "0",
    };
    const fingerprint = mediaFingerprint(d);
    assert.equal(
        mediaFingerprint({
            ...d,
            mime_type: "video/mp4",
            dcompressed_animation_url: "https://cache/movie.mp4",
            mediaCache: { originalMime: d.mime_type },
        }),
        fingerprint
    );
    assert.notEqual(mediaFingerprint({ ...d, token_id: "1" }), fingerprint);
    assert.notEqual(
        mediaFingerprint({ ...d, image_url: "https://example.com/b.gif" }),
        fingerprint
    );
    assert.ok(
        !candidates(d, { image_url: "javascript:bad" }).image.includes(
            "javascript:bad"
        )
    );
});
test("image derivatives preserve aspect ratio and alpha; animations retain full duration", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "media-fixture-"));
    try {
        const png = path.join(dir, "original.png");
        await sharp({
            create: {
                width: 1200,
                height: 600,
                channels: 4,
                background: { r: 50, g: 100, b: 150, alpha: 0.5 },
            },
        })
            .png()
            .toFile(png);
        const image = await optimize(png, dir);
        const preview = await sharp(image.preview).metadata();
        assert.equal(preview.width, 384);
        assert.equal(preview.height, 192);
        assert.equal(preview.hasAlpha, true);
        const video = path.join(dir, "original.mp4");
        await exec("ffmpeg", [
            "-y",
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            "color=c=red:s=160x90:r=10:d=1",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            video,
        ]);
        const movie = await optimize(video, dir),
            out = await probe(movie.animation);
        assert.equal(movie.mimeType, "video/mp4");
        assert.ok(Math.abs(Number(out.format.duration) - 1) < 0.1);
    } finally {
        await fs.rm(dir, { recursive: true, force: true });
    }
});

test("resuming binds selection, task count and pilot limits to the saved run", async () => {
    const { runConfig, bindRun } = require("./config.cjs");
    const values = { project: "prod", bucket: "cache" },
        config = runConfig(values, ["a", "b"], 2);
    let saved;
    const tx = {
        get: async () => ({ data: () => saved }),
        set: (_ref, value) => {
            saved = value;
        },
    };
    const db = { runTransaction: (fn) => fn(tx) };
    await bindRun(db, {}, config);
    await bindRun(db, {}, config);
    for (const changed of [
        runConfig(values, ["b", "a"], 2),
        runConfig(values, ["a", "b"], 1),
        runConfig({ ...values, "asset-limit": "3" }, ["a", "b"], 2),
    ])
        await assert.rejects(bindRun(db, {}, changed), /configuration differs/);
    assert.throws(
        () => runConfig({ ...values, "asset-limit": "NaN" }, ["a"], 1),
        /positive integer/
    );
});

test("media transaction rejects a concurrent source, visibility or custom-media edit", async () => {
    const { repairArtwork, mediaFingerprint } = require("./media.cjs");
    const data = {
        mime_type: "image/png",
        image_url: "https://example.com/a.png",
        blockchain: "none",
    };
    const gallery = { artworks: { a: { data } } };
    const cache = {
        version: 1,
        sourceHash: mediaFingerprint(data),
        originalMime: "image/png",
        width: 100,
        height: 50,
        previewUrl: "https://storage.googleapis.com/cache/preview.webp",
        imageUrl: "https://storage.googleapis.com/cache/image.webp",
    };
    for (const latest of [
        { ...gallery, isPublic: false },
        {
            artworks: {
                a: {
                    data: { ...data, image_url: "https://example.com/new.png" },
                },
            },
        },
        { artworks: { a: { data, visible: false } } },
        {
            artworks: {
                a: {
                    data,
                    overwrite: { url: "https://example.com/custom.png" },
                },
            },
        },
    ]) {
        const db = {
            collection: () => ({
                doc: () => ({ get: async () => ({ data: () => ({ cache }) }) }),
            }),
            runTransaction: async (fn) =>
                fn({
                    get: async () => ({ data: () => latest }),
                    update: () => assert.fail("concurrent edit overwritten"),
                    set: () => assert.fail("unexpected write"),
                }),
        };
        assert.equal(
            (
                await repairArtwork({
                    db,
                    ref: { id: "gallery" },
                    artworkId: "a",
                    provider: {},
                    bucket: {},
                    runId: "test",
                    apply: true,
                    gallery,
                })
            ).status,
            "changed-during-repair"
        );
    }
});

test("saved-credit cloud runs cannot resume enrichment or accidentally repair media", async () => {
    const { runConfig, bindRun } = require("./config.cjs");
    const values = { project: "prod", bucket: "cache", "artists-only": true };
    const enriched = runConfig(values, ["a"], 1);
    assert.deepEqual(
        runConfig({ ...values, "stored-only": false }, ["a"], 1),
        enriched
    );
    const stored = runConfig({ ...values, "stored-only": true }, ["a"], 1);
    assert.notEqual(stored.configHash, enriched.configHash);
    assert.equal(stored.storedOnly, true);
    assert.throws(
        () => runConfig({ project: "prod", "stored-only": true }, ["a"], 1),
        /requires --artists-only/
    );
    const db = {
        runTransaction: (fn) =>
            fn({ get: async () => ({ data: () => stored }) }),
    };
    await assert.rejects(bindRun(db, {}, enriched), /configuration differs/);
});
