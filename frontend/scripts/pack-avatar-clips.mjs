#!/usr/bin/env node
/**
 * Pack the avatar motion clips (baker/animations/compute2.json) into the
 * compact binary the avatar bakers load (baker/animations/compute2.bin):
 * the container from baker/clipCodec.js, gzip compressed, because static
 * hosts do not compress binary files on the way out. The browser inflates it
 * with DecompressionStream.
 *
 *     node frontend/scripts/pack-avatar-clips.mjs          # write the file
 *     node frontend/scripts/pack-avatar-clips.mjs --check  # verify only
 *
 * Run it whenever compute2.json changes; the tests fail until you do. The
 * script refuses to write a file that does not decode to exactly the numbers
 * three reads from the JSON (Float32 times and values, float64 durations).
 */
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gzipSync, gunzipSync, brotliCompressSync, constants } from "node:zlib";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const baker = path.join(
    here,
    "../components/_3DExhibit-v2/three/factory/player/instanceavatarvrm/baker"
);
const sourceFile = path.join(baker, "animations/compute2.json");
const outputFile = path.join(baker, "animations/compute2.bin");
const { encodeAvatarClips, decodeAvatarClips, readAvatarClipHeader } =
    await import(pathToFileURL(path.join(baker, "clipCodec.js")).href);

const check = process.argv.includes("--check");
const json = await readFile(sourceFile);
const sha256 = createHash("sha256").update(json).digest("hex");
const clips = JSON.parse(json);

function verify(container) {
    const decoded = decodeAvatarClips(container);
    if (decoded.length !== clips.length) throw new Error("Clip count differs");
    clips.forEach((clip, c) => {
        const out = decoded[c];
        for (const key of ["name", "duration", "uuid", "blendMode"])
            if (!Object.is(out[key], clip[key]))
                throw new Error(`${clip.name}: ${key} differs`);
        if (out.tracks.length !== clip.tracks.length)
            throw new Error(`${clip.name}: track count differs`);
        clip.tracks.forEach((track, t) => {
            const got = out.tracks[t];
            if (got.name !== track.name || got.type !== track.type)
                throw new Error(`${clip.name}/${track.name}: header differs`);
            for (const key of ["times", "values"]) {
                const expected = Buffer.from(
                    Float32Array.from(track[key]).buffer
                );
                if (!expected.equals(Buffer.from(got[key].buffer)))
                    throw new Error(
                        `${clip.name}/${track.name}: ${key} differ`
                    );
            }
        });
    });
}

if (check) {
    const container = gunzipSync(await readFile(outputFile));
    const { header } = readAvatarClipHeader(container);
    if (header.source?.sha256 !== sha256)
        throw new Error(
            "compute2.bin is stale: run node frontend/scripts/pack-avatar-clips.mjs"
        );
    verify(container);
    console.log("compute2.bin matches compute2.json");
} else {
    const container = encodeAvatarClips(clips, {
        source: {
            file: "animations/compute2.json",
            sha256,
            generatedBy: "frontend/scripts/pack-avatar-clips.mjs",
        },
    });
    verify(container);
    const packed = gzipSync(container, { level: 9 });
    await writeFile(outputFile, packed);
    const brotli = (bytes) =>
        brotliCompressSync(bytes, {
            params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
        }).length;
    console.table({
        "compute2.json": {
            bytes: json.length,
            gzip: gzipSync(json, { level: 9 }).length,
            brotli: brotli(json),
        },
        "container (uncompressed)": {
            bytes: container.length,
            gzip: packed.length,
            brotli: brotli(container),
        },
        "compute2.bin (shipped)": { bytes: packed.length },
    });
}
