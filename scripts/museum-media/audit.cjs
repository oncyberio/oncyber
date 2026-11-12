const fs = require("node:fs");
const dir =
        process.env.GALLERY_MEDIA_DIR ||
        require("node:path").join(
            require("node:os").tmpdir(),
            "oncyber-museum-media"
        ),
    root = require("node:path").resolve(__dirname, "../..");
const g = JSON.parse(fs.readFileSync(dir + "/before.json"));
const norm = (u) =>
    typeof u === "string"
        ? u.replace(/^ipfs:\/\//, "https://cyber.mypinata.cloud/ipfs/")
        : null;
const rows = Object.entries(g.artworks)
    .filter(([, a]) => /^(image|video|panorama)\//.test(a.data?.mime_type))
    .map(([id, a]) => ({
        id,
        name: a.data.name,
        mime: a.data.mime_type,
        urls: [
            ...new Set(
                (a.data.mime_type.startsWith("video")
                    ? [
                          a.data.dcompressed_animation_url,
                          a.data.animation_url,
                          a.data.animation_original_url,
                          a.data.original_animation_url,
                      ]
                    : [
                          a.data.dcompressed_image_url,
                          a.data.compressed_image_url,
                          a.data.image_url,
                          a.data.image_original_url,
                      ]
                )
                    .map(norm)
                    .filter(Boolean)
            ),
        ],
    }));
const results = new Map();
let cursor = 0;
async function probe(url) {
    const start = Date.now();
    try {
        const r = await fetch(url, {
            headers: { Range: "bytes=0-1023" },
            signal: AbortSignal.timeout(12000),
        });
        const x = {
            status: r.status,
            type: r.headers.get("content-type"),
            bytes:
                r.headers.get("content-range") ||
                r.headers.get("content-length"),
            ms: Date.now() - start,
        };
        await r.body?.cancel();
        return x;
    } catch (e) {
        return { error: e.name, ms: Date.now() - start };
    }
}
const urls = [...new Set(rows.flatMap((r) => r.urls))];
async function worker() {
    while (cursor < urls.length) {
        const u = urls[cursor++];
        results.set(u, await probe(u));
        if (results.size % 20 === 0)
            console.log("Probed", results.size, "/", urls.length);
    }
}
(async () => {
    await Promise.all(Array.from({ length: 6 }, worker));
    const report = rows.map((r) => ({
        ...r,
        probes: r.urls.map((url) => ({ url, ...results.get(url) })),
    }));
    fs.writeFileSync(dir + "/audit.json", JSON.stringify(report, null, 2), {
        mode: 0o600,
    });
    const summary = {
        artworks: rows.length,
        urls: urls.length,
        primaryFailed: report.filter((r) => !(r.probes[0]?.status < 300))
            .length,
        noWorkingSource: report
            .filter((r) => !r.probes.some((p) => p.status < 300))
            .map((r) => ({
                id: r.id,
                name: r.name,
                mime: r.mime,
                probes: r.probes,
            })),
        large: report
            .filter((r) =>
                r.probes.some(
                    (p) => parseInt(p.bytes?.split("/").at(-1)) > 5000000
                )
            )
            .map((r) => ({ name: r.name, probes: r.probes })),
    };
    fs.writeFileSync(
        dir + "/audit-summary.json",
        JSON.stringify(summary, null, 2)
    );
    console.log(JSON.stringify(summary, null, 2));
})().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
});
