const fs = require("fs"),
    root = require("node:path").resolve(__dirname, "../.."),
    dir =
        process.env.GALLERY_MEDIA_DIR ||
        require("node:path").join(
            require("node:os").tmpdir(),
            "oncyber-museum-media"
        );
const sharp = require(root + "/node_modules/sharp"),
    g = JSON.parse(fs.readFileSync(dir + "/before.json"));
const key = fs
    .readFileSync(root + "/frontend/env.ts", "utf8")
    .match(/OPENSEA_X_API_KEY:\s*["']([^"']+)/)[1];
const rows = Object.entries(g.artworks).filter(([, a]) =>
    /^(model\/|text\/html)/.test(a.data.mime_type)
);
async function get(url) {
    const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw Error("HTTP " + r.status);
    const b = Buffer.from(await r.arrayBuffer());
    if (b.length > 64 * 1024 * 1024) throw Error("Too large");
    return { buffer: b, mime: r.headers.get("content-type") };
}
(async () => {
    const report = [];
    for (const [id, a] of rows) {
        const d = a.data,
            record = { id, name: d.name, mime: d.mime_type };
        let source;
        for (const u of [
            d.dcompressed_animation_url,
            d.animation_original_url,
        ]) {
            if (!u) continue;
            try {
                source = { url: u, ...(await get(u)) };
                break;
            } catch (e) {
                console.log(d.name, "candidate failed", e.message);
            }
        }
        if (!source) {
            const r = await fetch(
                `https://api.opensea.io/api/v2/chain/ethereum/contract/${d.contract_address}/nfts/${d.token_id}`,
                {
                    headers: { "x-api-key": key },
                    signal: AbortSignal.timeout(15000),
                }
            );
            if (!r.ok) throw Error("OpenSea " + r.status);
            const n = (await r.json()).nft;
            const url = n.display_animation_url || n.animation_url;
            source = { url, ...(await get(url)) };
        }
        record.source = source.url;
        record.bytes = source.buffer.length;
        record.type = source.mime;
        if (d.mime_type.startsWith("model")) {
            if (source.buffer.subarray(0, 4).toString() !== "glTF")
                throw Error("Not GLB");
            record.verified = true;
        } else {
            const html = source.buffer.toString();
            if (!/<html|<!doctype|<script|<svg/i.test(html))
                throw Error("Not HTML");
            fs.writeFileSync(dir + "/checks-8454.html", source.buffer, {
                mode: 0o600,
            });
            record.verified = true;
            record.externalScripts = [
                ...html.matchAll(/<script[^>]*src=["']([^"']+)/g),
            ].map((m) => m[1]);
            let poster;
            for (const u of [d.dcompressed_image_url, d.image_url]) {
                try {
                    poster = await get(u);
                    await sharp(poster.buffer).metadata();
                    break;
                } catch {
                    poster = null;
                }
            }
            if (!poster) throw Error("Missing HTML poster");
            record.images = [];
            for (const size of [256, 1024]) {
                const file = "checks-8454-" + size + ".webp";
                const { data, info } = await sharp(poster.buffer)
                    .resize(size, size, {
                        fit: "inside",
                        withoutEnlargement: true,
                    })
                    .webp({ quality: 85 })
                    .toBuffer({ resolveWithObject: true });
                fs.writeFileSync(dir + "/prepared/" + file, data);
                record.images.push({
                    file,
                    mime: "image/webp",
                    width: info.width,
                    height: info.height,
                    bytes: data.length,
                });
            }
        }
        report.push(record);
        console.log(record);
    }
    fs.writeFileSync(dir + "/extras.json", JSON.stringify(report, null, 2), {
        mode: 0o600,
    });
})().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
});
