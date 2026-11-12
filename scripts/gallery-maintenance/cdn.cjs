const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const sharp = require("sharp");
const { download } = require("./network.cjs");

function pinataResizeURL(data) {
    // Animation sources must go through the movie/poster path, not a still-image audit.
    if (!/^(image|panorama)\//.test(data.mime_type || "") ||
        /image\/(gif|apng)/i.test(data.mime_type) ||
        [data.animation_url, data.animation_original_url, data.original_animation_url].some(Boolean)) return null;
    // Match the viewer's saved image alternatives and legacy Pinata normalization.
    for (const raw of [data.dcompressed_image_url, data.compressed_image_url,
        data.image_url, data.image_original_url]) {
        if (typeof raw !== "string") continue;
        try {
            const normalized = raw.replace(/^https:\/\/polar-mountain-96590\.herokuapp\.com\//, "")
                .replace(/^https:\/\/opensea\.mypinata\.cloud\//, "https://cyber.mypinata.cloud/");
            const url = new URL(normalized);
            if (url.protocol !== "https:" || url.hostname !== "cyber.mypinata.cloud" ||
                !url.pathname.startsWith("/ipfs/") || url.username || url.password || url.port) continue;
            if (/\.(gif|apng|mp4|webm|mov)(?:$|\?)/i.test(url.pathname + "?" + url.searchParams.get("filename"))) continue;
            url.searchParams.set("img-width", "384");
            url.searchParams.set("img-height", "384");
            url.searchParams.set("img-fit", "scale-down");
            return url.href;
        } catch { /* Check the next viewer fallback. */ }
    }
    return null;
}

async function auditPinataImage(data, { downloadImpl = download } = {}) {
    const url = pinataResizeURL(data);
    if (!url) return null;
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "oncyber-pinata-audit-"));
    try {
        const file = path.join(dir, "thumbnail");
        const fetched = await downloadImpl(url, file, { maxBytes: 4 * 1024 * 1024, timeoutMs: 12000 });
        const image = sharp(file, { limitInputPixels: 384 * 384 });
        const info = await image.metadata();
        if (!info.width || !info.height || info.width > 384 || info.height > 384 ||
            (info.pages || 1) !== 1 || !["jpeg", "png", "webp", "avif"].includes(info.format)) return null;
        // Decode the response: HTTP 200 alone might be an error page or corrupt file.
        await image.raw().toBuffer();
        return { status: "audited-cdn", optimization: "existing-pinata-resize", url,
            width: info.width, height: info.height, bytes: fetched.bytes };
    } catch (error) {
        // A temporary CDN outage is not a reason to create a duplicate cloud copy.
        if (["ABORT_ERR", "ENOTFOUND", "EAI_AGAIN", "ECONNRESET", "ETIMEDOUT", "ECONNREFUSED"].includes(error.code) ||
            error.name === "AbortError" || /Media HTTP (408|429|5\d\d)\b/.test(error.message)) {
            return { status: "unresolved", reason: "cdn-temporarily-unavailable", attempts: [{ url, error: error.message.slice(0, 300) }] };
        }
        // Definitively unsupported or invalid transformations need recovery.
        return null;
    } finally { await fs.rm(dir, { recursive: true, force: true }); }
}
module.exports = { pinataResizeURL, auditPinataImage };
