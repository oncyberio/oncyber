/* Bounded, resumable media preparation. This phase does not write to Firestore. */
const fs = require("node:fs"),
    path = require("node:path"),
    crypto = require("node:crypto");
const { execFile } = require("node:child_process"),
    { promisify } = require("node:util");
const run = promisify(execFile),
    root = require("node:path").resolve(__dirname, "../.."),
    dir =
        process.env.GALLERY_MEDIA_DIR ||
        require("node:path").join(
            require("node:os").tmpdir(),
            "oncyber-museum-media"
        );
const sharp = require(root + "/node_modules/sharp");
sharp.concurrency(1);
const g = JSON.parse(fs.readFileSync(dir + "/before.json")),
    audit = JSON.parse(fs.readFileSync(dir + "/audit.json"));
const apiKey =
    process.env.OPENSEA_X_API_KEY ||
    fs
        .readFileSync(root + "/frontend/env.ts", "utf8")
        .match(/OPENSEA_X_API_KEY:\s*["']([^"']+)/)?.[1];
const outDir = dir + "/prepared";
fs.mkdirSync(outDir, { recursive: true, mode: 0o700 });
const norm = (u) =>
    typeof u === "string"
        ? u
              .replace("https://polar-mountain-96590.herokuapp.com/", "")
              .replace(
                  /^ipfs:\/\/(?:ipfs\/)?/,
                  "https://cyber.mypinata.cloud/ipfs/"
              )
        : null;
const valid = (u) => {
    if (typeof u === "string" && u.startsWith("data:image/")) return true;
    try {
        const x = new URL(u);
        return (
            x.protocol === "https:" &&
            !/^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[)/.test(x.hostname)
        );
    } catch {
        return false;
    }
};
async function download(url) {
    if (!valid(url)) throw Error("Invalid media URL");
    if (url.startsWith("data:image/")) {
        const [header, ...parts] = url.split(",");
        const buffer = header.includes(";base64")
            ? Buffer.from(parts.join(","), "base64")
            : Buffer.from(decodeURIComponent(parts.join(",")));
        if (buffer.length > 8 * 1024 * 1024)
            throw Error("Embedded image too large");
        return { buffer, mime: header.slice(5).split(";")[0] };
    }
    const res = await fetch(url, { signal: AbortSignal.timeout(45000) });
    if (!res.ok) throw Error("HTTP " + res.status);
    const max = 64 * 1024 * 1024;
    if (+res.headers.get("content-length") > max) {
        await res.body.cancel();
        throw Error("File too large");
    }
    let size = 0,
        parts = [];
    for await (const part of res.body) {
        size += part.length;
        if (size > max) throw Error("File too large");
        parts.push(part);
    }
    return {
        buffer: Buffer.concat(parts),
        mime: res.headers.get("content-type")?.split(";")[0],
    };
}
async function metadata(d, force = false) {
    let local = {};
    try {
        if (d.token_metadata?.startsWith("data:application/json;base64,"))
            local = JSON.parse(
                Buffer.from(d.token_metadata.split(",")[1], "base64").toString()
            );
    } catch {}
    if (!force && (local.image || local.animation_url)) return local;
    const contract = d.contract_address || d.token_address,
        token = String(d.token_id),
        chain = d.blockchain === "polygon" ? "matic" : d.blockchain;
    if (
        !/^(ethereum|matic|base|optimism|arbitrum)$/.test(chain) ||
        !/^0x[0-9a-f]{40}$/i.test(contract) ||
        !/^\d+$/.test(token)
    )
        return local;
    const key = crypto
            .createHash("sha256")
            .update(chain + contract + token)
            .digest("hex"),
        p = dir + "/metadata-" + key + ".json";
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p));
    const r = await fetch(
        `https://api.opensea.io/api/v2/chain/${chain}/contract/${contract}/nfts/${token}`,
        { headers: { "x-api-key": apiKey }, signal: AbortSignal.timeout(15000) }
    );
    if (!r.ok) throw Error("Metadata HTTP " + r.status);
    const n = (await r.json()).nft || {};
    local = {
        image: n.display_image_url || n.image_url || n.original_image_url,
        animation_url:
            n.display_animation_url ||
            n.animation_url ||
            n.original_animation_url,
    };
    fs.writeFileSync(p, JSON.stringify(local), { mode: 0o600 });
    return local;
}
const inflight = new Map();
let cursor = 0,
    done = 0;
const report = [];
async function prepare(row) {
    const d = g.artworks[row.id].data,
        identity = `${d.blockchain}:${String(
            d.contract_address || d.token_address || ""
        ).toLowerCase()}:${d.token_id}`;
    const key = crypto
            .createHash("sha256")
            .update(identity)
            .digest("hex")
            .slice(0, 24),
        p = outDir + "/" + key + ".json";
    if (fs.existsSync(p)) {
        const r = JSON.parse(fs.readFileSync(p));
        if (r.images?.length) return { ...r, id: row.id, name: row.name };
    }
    if (inflight.has(key))
        return { ...(await inflight.get(key)), id: row.id, name: row.name };
    const task = (async () => {
        let candidates = row.probes
            .filter((p) => p.status < 300)
            .map((p) => p.url);
        // Prefer a surviving original to a previously downscaled legacy copy.
        const original = norm(
            row.mime.startsWith("video")
                ? d.animation_original_url || d.original_animation_url
                : d.image_original_url
        );
        if (candidates.includes(original))
            candidates = [
                original,
                ...candidates.filter((u) => u !== original),
            ];
        let result,
            source,
            failures = [];
        async function trySources(urls) {
            for (const u of [...new Set(urls.map(norm).filter(valid))]) {
                try {
                    const file = await download(u);
                    if (!file.buffer.length) throw Error("Empty file");
                    if (file.mime?.startsWith("image/")) {
                        const meta = await sharp(file.buffer, {
                            limitInputPixels: 250000000,
                        }).metadata();
                        if (meta.width * meta.height > 100000000)
                            throw Error("Source exceeds decode pixel budget");
                    }
                    result = file;
                    source = u;
                    return;
                } catch (e) {
                    failures.push({ url: u, error: e.message });
                }
            }
        }
        await trySources(candidates);
        if (!result) {
            const m = await metadata(d);
            await trySources(
                row.mime.startsWith("video")
                    ? [m.animation_url, m.image]
                    : [m.image, m.animation_url]
            );
        }
        if (!result) {
            const m = await metadata(d, true);
            await trySources(
                row.mime.startsWith("video")
                    ? [m.animation_url, m.image]
                    : [m.image, m.animation_url]
            );
        }
        if (!result)
            throw Error("No source survived " + JSON.stringify(failures));
        const base = outDir + "/" + key,
            input = base + ".source";
        fs.writeFileSync(input, result.buffer, { mode: 0o600 });
        let meta;
        try {
            meta = await sharp(result.buffer, {
                limitInputPixels: 100000000,
            }).metadata();
        } catch {}
        const animated =
            (meta?.pages || 1) > 1 || result.mime?.startsWith("video/");
        const prepared = {
            version: 1,
            identity,
            source,
            sourceMime: result.mime,
            sourceBytes: result.buffer.length,
            images: [],
            originalMime: d.mime_type,
        };
        let poster = result.buffer;
        if (animated) {
            const movie = base + ".mp4";
            let inputArgs = ["-i", input];
            if (meta?.format === "webp" && meta.pages > 1) {
                if (meta.pages > 600)
                    throw Error("Animation exceeds 600-frame budget");
                const frameDir = base + "-frames";
                fs.mkdirSync(frameDir, { recursive: true });
                let lines = ["ffconcat version 1.0"];
                for (let page = 0; page < meta.pages; page++) {
                    const name = String(page).padStart(4, "0") + ".png";
                    await sharp(result.buffer, {
                        page,
                        pages: 1,
                        limitInputPixels: 100000000,
                    })
                        .resize(720, 720, {
                            fit: "inside",
                            withoutEnlargement: true,
                        })
                        .png()
                        .toFile(frameDir + "/" + name);
                    lines.push(
                        `file '${name}'`,
                        `duration ${
                            Math.max(10, meta.delay?.[page] || 100) / 1000
                        }`
                    );
                }
                lines.push(
                    `file '${String(meta.pages - 1).padStart(4, "0")}.png'`
                );
                fs.writeFileSync(
                    frameDir + "/frames.txt",
                    lines.join("\n") + "\n"
                );
                inputArgs = [
                    "-f",
                    "concat",
                    "-safe",
                    "1",
                    "-i",
                    frameDir + "/frames.txt",
                ];
            }
            await run(
                process.env.FFMPEG || "ffmpeg",
                [
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-y",
                    ...inputArgs,
                    "-map",
                    "0:v:0",
                    "-map",
                    "0:a?",
                    "-vf",
                    "scale=720:720:force_original_aspect_ratio=decrease:force_divisible_by=2,fps=30",
                    "-c:v",
                    "libx264",
                    "-threads",
                    "2",
                    "-preset",
                    "fast",
                    "-crf",
                    "22",
                    "-pix_fmt",
                    "yuv420p",
                    "-c:a",
                    "aac",
                    "-b:a",
                    "128k",
                    "-movflags",
                    "+faststart",
                    movie,
                ],
                { timeout: 180000, maxBuffer: 1024 * 1024 }
            );
            const posterPath = base + ".poster.png";
            await run(
                process.env.FFMPEG || "ffmpeg",
                [
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-y",
                    "-i",
                    movie,
                    "-frames:v",
                    "1",
                    posterPath,
                ],
                { timeout: 20000, maxBuffer: 1024 * 1024 }
            );
            poster = fs.readFileSync(posterPath);
            const m = await sharp(poster).metadata();
            prepared.animation = {
                file: path.basename(movie),
                mime: "video/mp4",
                width: m.width,
                height: m.height,
                bytes: fs.statSync(movie).size,
            };
        }
        for (const size of [
            256,
            d.mime_type.startsWith("panorama") ? 2048 : 1024,
        ]) {
            const file = base + "-" + size + ".webp";
            const { data, info } = await sharp(poster, {
                limitInputPixels: 100000000,
                density: 144,
            })
                .rotate()
                .resize(size, size, { fit: "inside", withoutEnlargement: true })
                .webp({ quality: 85 })
                .toBuffer({ resolveWithObject: true });
            fs.writeFileSync(file, data, { mode: 0o600 });
            prepared.images.push({
                file: path.basename(file),
                mime: "image/webp",
                width: info.width,
                height: info.height,
                bytes: data.length,
            });
        }
        prepared.sourceHash = crypto
            .createHash("sha256")
            .update(result.buffer)
            .digest("hex");
        fs.writeFileSync(p, JSON.stringify(prepared, null, 2), { mode: 0o600 });
        return prepared;
    })();
    inflight.set(key, task);
    return { ...(await task), id: row.id, name: row.name };
}
async function worker() {
    while (cursor < audit.length) {
        const row = audit[cursor++];
        try {
            const p = await prepare(row);
            report.push(p);
            console.log(
                ++done + "/" + audit.length,
                "prepared",
                row.name,
                p.sourceBytes,
                "→",
                p.images.reduce((n, i) => n + i.bytes, 0) +
                    (p.animation?.bytes || 0)
            );
        } catch (e) {
            report.push({ id: row.id, name: row.name, error: e.message });
            console.log(
                ++done + "/" + audit.length,
                "unresolved",
                row.name,
                e.message.slice(0, 180)
            );
        }
        fs.writeFileSync(
            dir + "/prepared-report.json",
            JSON.stringify(report, null, 2),
            { mode: 0o600 }
        );
    }
}
Promise.all([worker(), worker(), worker()])
    .then(() =>
        console.log(
            "DONE",
            JSON.stringify({
                prepared: report.filter((r) => r.images).length,
                unresolved: report
                    .filter((r) => r.error)
                    .map((r) => ({
                        name: r.name,
                        error: r.error.slice(0, 180),
                    })),
            })
        )
    )
    .catch((e) => {
        console.error(e.message);
        process.exitCode = 1;
    });
