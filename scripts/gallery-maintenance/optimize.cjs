const fs = require("node:fs/promises");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const sharp = require("sharp");
const exec = promisify(execFile);
sharp.cache(false);
sharp.concurrency(1);

async function probe(file) {
    const { stdout } = await exec(
        "ffprobe",
        [
            "-v",
            "error",
            "-protocol_whitelist",
            "file,pipe",
            "-show_streams",
            "-show_format",
            "-of",
            "json",
            file,
        ],
        { timeout: 20000, maxBuffer: 2 * 1024 * 1024 }
    );
    return JSON.parse(stdout);
}

async function optimize(file, dir, { panorama = false } = {}) {
    const preview = path.join(dir, "preview.webp"),
        image = path.join(dir, "image.webp");
    let info;
    try {
        info = await sharp(file, { limitInputPixels: 80000000 }).metadata();
    } catch {}
    // Decode, never trust the HTTP content type or filename extension.
    if (info && (info.pages || 1) === 1) {
        if (info.format === "svg") {
            const svg = await fs.readFile(file, "utf8");
            if (
                /(?:href\s*=\s*["'](?!#|data:)|url\s*\(\s*(?!#|data:))/i.test(
                    svg
                )
            )
                throw new Error("SVG has external resource references");
        }
        await sharp(file, { limitInputPixels: 80000000 })
            .rotate()
            .resize({
                width: panorama ? 1024 : 384,
                height: panorama ? 512 : 384,
                fit: "inside",
                withoutEnlargement: true,
            })
            .webp({ quality: 82 })
            .toFile(preview);
        await sharp(file, { limitInputPixels: 80000000 })
            .rotate()
            .resize({
                width: panorama ? 4096 : 2048,
                height: panorama ? 2048 : 2048,
                fit: "inside",
                withoutEnlargement: true,
            })
            .webp({ quality: 92 })
            .toFile(image);
        return {
            preview,
            image,
            mimeType: panorama ? "panorama/jpg" : "image/webp",
            width: info.width,
            height: info.height,
        };
    }
    const media = await probe(file);
    const video = media.streams?.find((s) => s.codec_type === "video");
    if (!video) throw new Error("Source is not a decodable image or animation");
    const duration = Number(media.format?.duration || video.duration || 0);
    if (!duration || !Number.isFinite(duration) || duration > 900)
        throw new Error("Animation duration unsupported (maximum 15 minutes)");
    // Preserve transparent animation using VP9 alpha; opaque video uses MP4.
    const alpha =
        info?.hasAlpha ||
        /^(yuva|rgba|argb|bgra)/.test(video.pix_fmt || "") ||
        video.tags?.alpha_mode === "1";
    const animation = path.join(
        dir,
        alpha ? "animation.webm" : "animation.mp4"
    );
    const base = [
        "-nostdin",
        "-y",
        "-v",
        "error",
        "-threads",
        "1",
        "-protocol_whitelist",
        "file,pipe",
        ...(alpha && video.codec_name === "vp9" ? ["-c:v", "libvpx-vp9"] : []),
        "-i",
        file,
    ];
    const frame = path.join(dir, "frame.png");
    await exec(
        "ffmpeg",
        [
            ...base,
            "-frames:v",
            "1",
            "-vf",
            "scale=w='min(384,iw)':h='min(384,ih)':force_original_aspect_ratio=decrease",
            frame,
        ],
        { timeout: 30000, maxBuffer: 1024 * 1024 }
    );
    await sharp(frame).webp({ quality: 82 }).toFile(preview);
    await exec(
        "ffmpeg",
        [
            ...base,
            "-map",
            "0:v:0",
            "-map",
            "0:a?",
            "-vf",
            "scale=w='min(1280,iw)':h='min(1280,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
            ...(alpha
                ? [
                      "-c:v",
                      "libvpx-vp9",
                      "-pix_fmt",
                      "yuva420p",
                      "-auto-alt-ref",
                      "0",
                      "-deadline",
                      "good",
                      "-cpu-used",
                      "4",
                      "-b:v",
                      "0",
                      "-crf",
                      "30",
                      "-c:a",
                      "libopus",
                  ]
                : [
                      "-c:v",
                      "libx264",
                      "-pix_fmt",
                      "yuv420p",
                      "-preset",
                      "fast",
                      "-crf",
                      "23",
                      "-movflags",
                      "+faststart",
                      "-c:a",
                      "aac",
                      "-b:a",
                      "128k",
                  ]),
            "-threads",
            "1",
            animation,
        ],
        { timeout: 240000, maxBuffer: 1024 * 1024 }
    );
    const output = await probe(animation),
        outDuration = Number(output.format?.duration);
    if (
        !Number.isFinite(outDuration) ||
        Math.abs(outDuration - duration) > Math.max(0.3, duration * 0.01)
    )
        throw new Error("Optimized animation duration changed");
    return {
        preview,
        animation,
        mimeType: alpha ? "video/webm" : "video/mp4",
        width: video.width,
        height: video.height,
        duration,
    };
}

module.exports = { optimize, probe };
