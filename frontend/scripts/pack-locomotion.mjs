#!/usr/bin/env node
/** Pack the original lobby locomotion bakes. Sources and hashes are pinned in source-manifest.json.
 * node frontend/scripts/pack-locomotion.mjs --input /path/to/downloaded-json [--output /path]
 * Same LCP1 format as the comparison pack: shared decoder, no runtime conversion dependency.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gzipSync, brotliCompressSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { styleLocomotion } from "./style-locomotion.mjs";
import { readPackedIdle, oncyberIdleWithHands } from "./idle-variants.mjs";
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "../package.json"));
const { Quaternion } = require("three");
const args = process.argv.slice(2);
const option = (name, fallback) => {
    const i = args.indexOf(name);
    return i < 0 ? fallback : args[i + 1];
};
const input = option("--input");
if (!input)
    throw new Error("Supply --input containing the source JSON files.");
const output = option("--output", path.join(here, "../public/lobby/locomotion"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const round = (n, places = 6) => Number(n.toFixed(places));
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const provenance = JSON.parse(
    await readFile(
        path.join(here, "../public/lobby/locomotion/source-manifest.json"),
        "utf8"
    )
);
// Pin the local Oncyber walk too; only its body curves enter the core pack.
const walkSource = await readFile(
    path.resolve(here, "../..", provenance.derivation.walk.path)
);
if (sha256(walkSource) !== provenance.derivation.walk.sha256)
    throw new Error("Oncyber walk source changed");
const oncyberWalk = JSON.parse(walkSource)[provenance.derivation.walk.clip];
const boneNames = [
    "Hips",
    "Spine",
    "Spine1",
    "Spine2",
    "Neck",
    "Head",
    ...["Left", "Right"].flatMap((side) =>
        [
            "Shoulder",
            "Arm",
            "ForeArm",
            "Hand",
            ...["Thumb", "Index", "Middle", "Ring", "Pinky"].flatMap((finger) =>
                [1, 2, 3].map((joint) => `Hand${finger}${joint}`)
            ),
            "UpLeg",
            "Leg",
            "Foot",
            "ToeBase",
        ].map((bone) => side + bone)
    ),
].map((n) => "mixamorig" + n);
function qError(a, b) {
    return (
        2 *
        Math.acos(
            clamp(
                Math.abs(
                    new Quaternion()
                        .fromArray(a)
                        .dot(new Quaternion().fromArray(b))
                ),
                0,
                1
            )
        )
    );
}
function interpolate(a, b, t, quaternion) {
    if (quaternion)
        return new Quaternion()
            .fromArray(a)
            .slerp(new Quaternion().fromArray(b), t)
            .normalize()
            .toArray();
    return a.map((v, i) => v + (b[i] - v) * t);
}
function error(a, b, quaternion) {
    return quaternion ? qError(a, b) : Math.hypot(...a.map((v, i) => v - b[i]));
}
function reduceTrack(times, values, quaternion) {
    // RDP uses the actual interpolation the runtime will use, not componentwise quaternion error.
    const tolerance = quaternion ? Math.PI / 1000 : 0.06; // 0.18 degrees / 0.6 mm in source centimeters.
    const keep = new Set([0, times.length - 1]);
    const visit = (lo, hi) => {
        let worst = tolerance,
            index = -1;
        for (let i = lo + 1; i < hi; i++) {
            const e = error(
                values[i],
                interpolate(
                    values[lo],
                    values[hi],
                    (times[i] - times[lo]) / (times[hi] - times[lo]),
                    quaternion
                ),
                quaternion
            );
            if (e > worst) {
                worst = e;
                index = i;
            }
        }
        if (index >= 0) {
            keep.add(index);
            visit(lo, index);
            visit(index, hi);
        }
    };
    visit(0, times.length - 1);
    const indices = [...keep].sort((a, b) => a - b);
    return {
        times: indices.map((i) => times[i]),
        values: indices.map((i) => values[i]),
    };
}
function sampleTrack(track, time) {
    let hi = 1;
    while (hi < track.times.length && track.times[hi] < time) hi++;
    hi = Math.min(hi, track.times.length - 1);
    const lo = Math.max(0, hi - 1);
    return interpolate(
        track.values[lo],
        track.values[hi],
        clamp(
            (time - track.times[lo]) / (track.times[hi] - track.times[lo] || 1),
            0,
            1
        ),
        track.quaternion
    );
}

const clips = [];
function appendClip(raw, spec) {
    const tracks = raw.tracks
        .filter(
            (t) =>
                boneNames.includes(t.name.split(".")[0]) &&
                (t.name.endsWith(".quaternion") ||
                    t.name === "mixamorigHips.position")
        )
        .map((t) => {
            const quaternion = t.name.endsWith(".quaternion"),
                size = quaternion ? 4 : 3;
            const times = Array.from(t.times),
                values = times.map((_, i) =>
                    t.values.slice(i * size, (i + 1) * size)
                );
            if (quaternion) {
                for (let i = 0; i < values.length; i++) {
                    const q = new Quaternion().fromArray(values[i]).normalize();
                    if (
                        i &&
                        q.dot(new Quaternion().fromArray(values[i - 1])) < 0
                    )
                        q.set(-q.x, -q.y, -q.z, -q.w);
                    values[i] = q.toArray();
                }
            }
            // The app exports rounded times; anchor the endpoints to the exact duration.
            times[0] = 0;
            times[times.length - 1] = raw.duration;
            return { name: t.name, quaternion, times, values };
        });
    clips.push({
        ...spec,
        duration: raw.duration,
        tracks,
        metadata: {
            sourceName: spec.source,
            ...(["IDLE", "WALK"].includes(spec.name)
                ? { derivation: spec.name.toLowerCase() }
                : {}),
            duration: raw.duration,
            loop: spec.loop,
        },
    });
}
let relaxedIdle;
for (const spec of provenance.clips) {
    const bytes = await readFile(path.join(input, spec.source + ".json"));
    if (sha256(bytes) !== spec.sha256)
        throw new Error("Locomotion source changed: " + spec.source);
    const raw = styleLocomotion(JSON.parse(bytes), spec.name, oncyberWalk);
    if (spec.name === "IDLE") relaxedIdle = raw;
    appendClip(raw, spec);
}
const idleSource = provenance.derivation.idleVariants;
const cc0Bytes = await readFile(
    path.resolve(here, "../..", idleSource.cc0.path)
);
if (sha256(cc0Bytes) !== idleSource.cc0.sha256)
    throw new Error("CC0 idle source changed");
appendClip(oncyberIdleWithHands(JSON.parse(walkSource).IDLE, relaxedIdle), {
    name: "IDLE_ONCYBER",
    source: "Oncyber IDLE + relaxed fingers",
    group: "core",
    loop: true,
});
appendClip(readPackedIdle(cc0Bytes), {
    name: "IDLE_CC0",
    source: "Quaternius Idle_Loop (CC0-1.0)",
    group: "core",
    loop: true,
});
await mkdir(output, { recursive: true });
const packMetadata = [];
for (const group of ["core", "air"]) {
    const blocks = [],
        descriptors = [];
    let offset = 0,
        maxAngle = 0,
        maxPosition = 0,
        sourceKeys = 0,
        packedKeys = 0;
    const selected = clips.filter((c) => c.group === group);
    for (const clip of selected) {
        const descriptor = {
            name: clip.name,
            duration: clip.duration,
            loop: clip.loop,
            tracks: [],
        };
        for (const track of clip.tracks) {
            sourceKeys += track.times.length;
            const reduced = reduceTrack(
                track.times,
                track.values,
                track.quaternion
            );
            packedKeys += reduced.times.length;
            const components = track.quaternion ? 4 : 3;
            const min = Array.from({ length: components }, (_, c) =>
                Math.min(...reduced.values.map((v) => v[c]))
            );
            const max = Array.from({ length: components }, (_, c) =>
                Math.max(...reduced.values.map((v) => v[c]))
            );
            const bytes = Buffer.alloc(
                reduced.times.length * (2 + components * 2)
            );
            const decoded = {
                quaternion: track.quaternion,
                times: [],
                values: [],
            };
            reduced.times.forEach((time, i) => {
                let cursor = i * (2 + components * 2);
                const qt = Math.round((time / clip.duration) * 65535);
                bytes.writeUInt16LE(qt, cursor);
                cursor += 2;
                decoded.times.push((qt / 65535) * clip.duration);
                const v = reduced.values[i].map((n, c) => {
                    const quantized = track.quaternion
                        ? Math.round(clamp(n, -1, 1) * 32767)
                        : Math.round(
                              ((n - min[c]) / (max[c] - min[c] || 1)) * 65535
                          );
                    if (track.quaternion) bytes.writeInt16LE(quantized, cursor);
                    else bytes.writeUInt16LE(quantized, cursor);
                    cursor += 2;
                    return track.quaternion
                        ? quantized / 32767
                        : min[c] + (quantized / 65535) * (max[c] - min[c]);
                });
                decoded.values.push(
                    track.quaternion
                        ? new Quaternion().fromArray(v).normalize().toArray()
                        : v
                );
            });
            for (
                let frame = 0;
                frame <= Math.ceil(clip.duration * 120);
                frame++
            ) {
                const time = Math.min(clip.duration, frame / 120),
                    e = error(
                        sampleTrack(track, time),
                        sampleTrack(decoded, time),
                        track.quaternion
                    );
                if (track.quaternion) maxAngle = Math.max(maxAngle, e);
                else maxPosition = Math.max(maxPosition, e);
            }
            const d = {
                bone: boneNames.indexOf(track.name.split(".")[0]),
                kind: track.quaternion ? "q" : "p",
                offset,
                count: reduced.times.length,
            };
            if (!track.quaternion) {
                d.min = min;
                d.max = max;
            }
            descriptor.tracks.push(d);
            blocks.push(bytes);
            offset += bytes.length;
        }
        descriptors.push(descriptor);
    }
    if (maxAngle > (0.25 * Math.PI) / 180 || maxPosition > 0.1)
        throw new Error(
            `Compression error bound failed: ${maxAngle} rad, ${maxPosition} cm`
        );
    const header = Buffer.from(
        JSON.stringify({ version: 1, bones: boneNames, clips: descriptors })
    );
    const prefix = Buffer.alloc(8);
    prefix.write("LCP1");
    prefix.writeUInt32LE(header.length, 4);
    const bytes = Buffer.concat([prefix, header, ...blocks]);
    const hash = sha256(bytes),
        filename = `${group}.${hash.slice(0, 12)}.lcp`;
    await writeFile(path.join(output, filename), bytes);
    const comparison = Buffer.from(
        JSON.stringify(
            Object.fromEntries(
                selected.map((clip) => [
                    clip.name,
                    {
                        name: clip.name,
                        duration: clip.duration,
                        tracks: clip.tracks.map((t) => ({
                            name: t.name,
                            type: t.quaternion ? "quaternion" : "vector",
                            times: t.times,
                            values: t.values.flat(),
                        })),
                    },
                ])
            )
        )
    );
    packMetadata.push({
        group,
        file: filename,
        sha256: hash,
        bytes: bytes.length,
        gzipBytes: gzipSync(bytes, { level: 9 }).length,
        brotliBytes: brotliCompressSync(bytes).length,
        uncompressedFloatJsonBytes: comparison.length,
        sourceKeys,
        packedKeys,
        measuredMaxAngularErrorDegrees: round((maxAngle * 180) / Math.PI),
        measuredMaxPositionErrorCm: round(maxPosition),
        clips: Object.fromEntries(selected.map((c) => [c.name, c.metadata])),
    });
}

await writeFile(
    path.join(output, "manifest.json"),
    JSON.stringify(
        {
            version: 1,
            format: "LCP1",
            provenance: "source-manifest.json",
            packs: packMetadata,
        },
        null,
        2
    ) + "\n"
);
console.log(
    JSON.stringify(
        packMetadata.map(
            ({
                group,
                file,
                bytes,
                gzipBytes,
                measuredMaxAngularErrorDegrees,
                measuredMaxPositionErrorCm,
            }) => ({
                group,
                file,
                bytes,
                gzipBytes,
                measuredMaxAngularErrorDegrees,
                measuredMaxPositionErrorCm,
            })
        ),
        null,
        2
    )
);
