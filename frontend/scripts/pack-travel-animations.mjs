#!/usr/bin/env node
/**
 * Pack the four user-supplied Mixamo FBX travel animations into animation-only LCP1.
 * Usage: node frontend/scripts/pack-travel-animations.mjs --input /path/to/fbx-directory [--output /path]
 * Source byte hashes and the rest rig are pinned in public/lobby/travel/source-manifest.json.
 * No FBX loader, source rigs, or conversion dependency is shipped to the browser.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gzipSync, brotliCompressSync } from "node:zlib";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "../package.json"));
const {
    ObjectLoader,
    Quaternion,
    Vector3,
    LoadingManager,
    Texture,
} = require("three");
const { FBXLoader } = await import(
    pathToFileURL(
        require.resolve("three/examples/jsm/loaders/FBXLoader.js")
    )
);
// FBX image descriptors are parsed, but their bytes are never decoded or kept.
globalThis.window ||= { URL: { createObjectURL: () => "unused-fbx-texture" } };
const args = process.argv.slice(2);
const option = (name, fallback) => {
    const index = args.indexOf(name);
    return index < 0 ? fallback : args[index + 1];
};
const input = option("--input");
if (!input)
    throw new Error("Supply --input containing the four pinned FBX files.");
const output = option("--output", path.join(here, "../public/lobby/travel"));
const sourceManifestPath = option(
    "--source-manifest",
    path.join(here, "../public/lobby/travel/source-manifest.json")
);
const group = option("--group", "travel");
if (!/^[a-z][a-z0-9-]*$/.test(group)) throw new Error("Invalid pack group");
const provenance = JSON.parse(await readFile(sourceManifestPath, "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const round = (number, digits = 6) => Number(number.toFixed(digits));
const clamp = (number, min, max) => Math.max(min, Math.min(max, number));
const canonicalName = (name) => name.replace(/^mixamorig\d*:?/, "mixamorig");
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
].map((bone) => "mixamorig" + bone);
const rigBytes = await readFile(
    path.resolve(here, "../..", provenance.referenceRig.path)
);
if (sha256(rigBytes) !== provenance.referenceRig.sha256)
    throw new Error(
        "Reference rig changed; review source normalization before repacking."
    );
const rig = new ObjectLoader().parse(JSON.parse(rigBytes));
rig.updateMatrixWorld(true);
const targetHipsHeight = rig
    .getObjectByName("mixamorigHips")
    .getWorldPosition(new Vector3()).y;

function interpolate(a, b, t, quaternion) {
    if (quaternion)
        return new Quaternion()
            .fromArray(a)
            .slerp(new Quaternion().fromArray(b), t)
            .normalize()
            .toArray();
    return a.map((value, i) => value + (b[i] - value) * t);
}
function error(a, b, quaternion) {
    return quaternion
        ? 2 *
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
        : Math.hypot(...a.map((value, i) => value - b[i]));
}
function sample(track, time) {
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
function reduce(track) {
    const tolerance = track.quaternion ? Math.PI / 1000 : 0.06;
    const keep = new Set([0, track.times.length - 1]);
    function visit(lo, hi) {
        let worst = tolerance,
            index = -1;
        for (let i = lo + 1; i < hi; i++) {
            const distance = error(
                track.values[i],
                interpolate(
                    track.values[lo],
                    track.values[hi],
                    (track.times[i] - track.times[lo]) /
                        (track.times[hi] - track.times[lo]),
                    track.quaternion
                ),
                track.quaternion
            );
            if (distance > worst) {
                worst = distance;
                index = i;
            }
        }
        if (index >= 0) {
            keep.add(index);
            visit(lo, index);
            visit(index, hi);
        }
    }
    visit(0, track.times.length - 1);
    const indices = [...keep].sort((a, b) => a - b);
    return {
        times: indices.map((i) => track.times[i]),
        values: indices.map((i) => track.values[i]),
    };
}

const clips = [];
let maximumRetargetFkErrorCm = 0;
for (const spec of provenance.clips) {
    const bytes = await readFile(path.join(input, spec.source));
    if (sha256(bytes) !== spec.sha256)
        throw new Error("Source changed: " + spec.source);
    // Animation extraction never needs textures, including embedded FBX images.
    // Some supplied files include a complete skinned model rather than a rig.
    const manager = new LoadingManager();
    manager.addHandler(/.*/, {
        setPath() {
            return this;
        },
        load() {
            return new Texture();
        },
    });
    const asset = new FBXLoader(manager).parse(
        bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength
        ),
        ""
    );
    const takes = asset.animations.filter(
        (clip) => clip.duration > 0 && clip.tracks.length
    );
    if (takes.length !== 1)
        throw new Error("Expected a single authored take: " + spec.source);
    asset.updateMatrixWorld(true);
    const raw = takes[0];
    const sourceBones = new Map();
    asset.traverse((node) => {
        // FBX skin clusters can add same-name zero-length children. Animation
        // binding selects the first node; replacing it with a duplicate twists
        // the normalized rest basis and can create parent cycles.
        const name = canonicalName(node.name);
        if (node.isBone && !sourceBones.has(name)) sourceBones.set(name, node);
    });
    for (const name of boneNames)
        if (!sourceBones.has(name)) throw new Error("Missing bone: " + name);
    const rest = new Map(
        [...sourceBones].map(([name, bone]) => [
            name,
            {
                position: bone.getWorldPosition(new Vector3()),
                world: bone.getWorldQuaternion(new Quaternion()),
                parentWorld: bone.parent.getWorldQuaternion(new Quaternion()),
                local: bone.quaternion.clone(),
            },
        ])
    );
    const sourceHipsHeight = rest.get("mixamorigHips").position.y;
    const hipsScale = targetHipsHeight / sourceHipsHeight;
    const tracks = [];
    const originalTracks = new Map();
    for (const original of raw.tracks) {
        const [rawName, property] = original.name.split(".");
        const boneName = canonicalName(rawName);
        if (
            !boneNames.includes(boneName) ||
            (property !== "quaternion" &&
                !(boneName === "mixamorigHips" && property === "position"))
        )
            throw new Error("Unreviewed FBX track: " + original.name);
        const quaternion = property === "quaternion";
        const size = quaternion ? 4 : 3;
        const times = Array.from(original.times);
        const originalValues = times.map((_, i) =>
            Array.from(original.values.slice(i * size, (i + 1) * size))
        );
        if (!times.length || times[0] !== 0 || times.at(-1) > raw.duration)
            throw new Error("Invalid source timeline: " + original.name);
        if (times.at(-1) < raw.duration) {
            times.push(raw.duration);
            originalValues.push([...originalValues.at(-1)]);
        }
        const values = originalValues.map((v) => {
            if (!quaternion) return v.map((component) => component * hipsScale);
            // Convert authored local rotations into the identity-rest VRM basis.
            // Merely removing the FBX's mixamorig9 prefix twists shoulders and knees.
            const basis = rest.get(boneName);
            return basis.parentWorld
                .clone()
                .multiply(new Quaternion().fromArray(v))
                .multiply(basis.world.clone().invert())
                .normalize()
                .toArray();
        });
        if (quaternion)
            for (let i = 1; i < values.length; i++) {
                if (
                    new Quaternion()
                        .fromArray(values[i])
                        .dot(new Quaternion().fromArray(values[i - 1])) < 0
                )
                    values[i] = values[i].map((value) => -value);
            }
        tracks.push({
            name: `${boneName}.${property}`,
            quaternion,
            times,
            values,
        });
        originalTracks.set(boneName + "." + property, {
            quaternion,
            times,
            values: originalValues,
        });
    }
    tracks.sort(
        (a, b) =>
            boneNames.indexOf(a.name.split(".")[0]) -
                boneNames.indexOf(b.name.split(".")[0]) ||
            a.name.localeCompare(b.name)
    );
    if (tracks.length !== boneNames.length + 1)
        throw new Error("Incomplete animation: " + spec.source);

    // An independent forward-kinematics oracle verifies the rest-basis conversion
    // against the loaded skeleton, including every finger joint, before packing.
    for (let frame = 0; frame <= Math.ceil(raw.duration * 60); frame++) {
        const time = Math.min(raw.duration, frame / 60);
        for (const [name, bone] of sourceBones) {
            const q = originalTracks.get(name + ".quaternion");
            if (q) bone.quaternion.fromArray(sample(q, time));
        }
        sourceBones
            .get("mixamorigHips")
            .position.fromArray(
                sample(originalTracks.get("mixamorigHips.position"), time)
            );
        asset.updateMatrixWorld(true);
        const reconstructed = new Map();
        function reconstruct(name) {
            if (reconstructed.has(name)) return reconstructed.get(name);
            const bone = sourceBones.get(name),
                basis = rest.get(name);
            const parentName = canonicalName(bone.parent.name);
            const parent = sourceBones.has(parentName)
                ? reconstruct(parentName)
                : { position: new Vector3(), quaternion: new Quaternion() };
            const track = tracks.find((t) => t.name === name + ".quaternion");
            const q = track
                ? new Quaternion().fromArray(sample(track, time))
                : new Quaternion();
            const position =
                name === "mixamorigHips"
                    ? new Vector3().fromArray(
                          sample(
                              originalTracks.get("mixamorigHips.position"),
                              time
                          )
                      )
                    : basis.position
                          .clone()
                          .sub(
                              sourceBones.has(parentName)
                                  ? rest.get(parentName).position
                                  : new Vector3()
                          )
                          .applyQuaternion(parent.quaternion)
                          .add(parent.position);
            const result = {
                position,
                quaternion: parent.quaternion.clone().multiply(q),
            };
            reconstructed.set(name, result);
            return result;
        }
        for (const name of boneNames)
            maximumRetargetFkErrorCm = Math.max(
                maximumRetargetFkErrorCm,
                reconstruct(name).position.distanceTo(
                    sourceBones.get(name).getWorldPosition(new Vector3())
                )
            );
    }

    // The character controller owns travel. Anchor each clip in place while
    // retaining authored sway and the absolute crouch height across all clips.
    // Do not subtract the first Y value: that would erase the loaded crouch pose.
    const hips = tracks.find((t) => t.name === "mixamorigHips.position");
    const first = [...hips.values[0]],
        last = [...hips.values.at(-1)];
    hips.values.forEach((v, i) => {
        for (const axis of [0, 2])
            v[axis] -=
                first[axis] +
                ((last[axis] - first[axis]) * hips.times[i]) / raw.duration;
    });
    clips.push({
        ...spec,
        duration: raw.duration,
        tracks,
        metadata: {
            sourceName: spec.source,
            ...(spec.holdTime !== undefined ? { holdTime: spec.holdTime } : {}),
            duration: raw.duration,
            loop: spec.loop,
            sourceHipsHeightCm: round(sourceHipsHeight),
            referenceHipsHeightCm: round(targetHipsHeight),
            hipsHeightRangeCm: [
                round(Math.min(...hips.values.map((v) => v[1]))),
                round(Math.max(...hips.values.map((v) => v[1]))),
            ],
        },
    });
}
// Allow 0.5 mm for float32 FBX keys and normalized quaternion interpolation.
if (maximumRetargetFkErrorCm > 0.05)
    throw new Error("Retarget FK error: " + maximumRetargetFkErrorCm + " cm");

const blocks = [],
    descriptors = [];
let offset = 0,
    sourceKeys = 0,
    packedKeys = 0;
for (const clip of clips) {
    const descriptor = {
        name: clip.name,
        duration: clip.duration,
        loop: clip.loop,
        tracks: [],
    };
    for (const track of clip.tracks) {
        const reduced = reduce(track),
            components = track.quaternion ? 4 : 3;
        sourceKeys += track.times.length;
        packedKeys += reduced.times.length;
        const min = Array.from({ length: components }, (_, c) =>
            Math.min(...reduced.values.map((v) => v[c]))
        );
        const max = Array.from({ length: components }, (_, c) =>
            Math.max(...reduced.values.map((v) => v[c]))
        );
        const bytes = Buffer.alloc(reduced.times.length * (2 + components * 2));
        reduced.times.forEach((time, i) => {
            let cursor = i * (2 + components * 2);
            bytes.writeUInt16LE(
                Math.round((time / clip.duration) * 65535),
                cursor
            );
            cursor += 2;
            reduced.values[i].forEach((value, c) => {
                if (track.quaternion)
                    bytes.writeInt16LE(
                        Math.round(clamp(value, -1, 1) * 32767),
                        cursor
                    );
                else
                    bytes.writeUInt16LE(
                        Math.round(
                            ((value - min[c]) / (max[c] - min[c] || 1)) * 65535
                        ),
                        cursor
                    );
                cursor += 2;
            });
        });
        descriptor.tracks.push({
            bone: boneNames.indexOf(track.name.split(".")[0]),
            kind: track.quaternion ? "q" : "p",
            offset,
            count: reduced.times.length,
            ...(!track.quaternion ? { min, max } : {}),
        });
        blocks.push(bytes);
        offset += bytes.length;
    }
    descriptors.push(descriptor);
}
const header = Buffer.from(
    JSON.stringify({ version: 1, bones: boneNames, clips: descriptors })
);
const prefix = Buffer.alloc(8);
prefix.write("LCP1");
prefix.writeUInt32LE(header.length, 4);
const bytes = Buffer.concat([prefix, header, ...blocks]);

// Exercise the actual browser decoder and compare its results against the
// uncompressed, retargeted authored curves, not an independent decoder copy.
const typescript = require("typescript");
const decoderSource = await readFile(
    path.join(here, "../features/lobby/cc0LocomotionPack.ts"),
    "utf8"
);
const decoderJs = typescript.transpileModule(decoderSource, {
    compilerOptions: {
        target: typescript.ScriptTarget.ES2022,
        module: typescript.ModuleKind.ESNext,
    },
}).outputText;
const { decodeCC0LocomotionPack } = await import(
    "data:text/javascript;base64," + Buffer.from(decoderJs).toString("base64")
);
const decoded = decodeCC0LocomotionPack(bytes);
let maxAngle = 0,
    maxPosition = 0;
for (const clip of clips)
    for (const track of clip.tracks) {
        const raw = decoded.clips[clip.name].tracks.find(
            (t) => t.name === track.name
        );
        const components = track.quaternion ? 4 : 3;
        const unpacked = {
            quaternion: track.quaternion,
            times: raw.times,
            values: raw.times.map((_, i) =>
                raw.values.slice(i * components, (i + 1) * components)
            ),
        };
        const checkTimes = new Set([
            ...track.times,
            ...Array.from(
                { length: Math.ceil(clip.duration * 120) + 1 },
                (_, i) => Math.min(clip.duration, i / 120)
            ),
        ]);
        for (const time of checkTimes) {
            const distance = error(
                sample(track, time),
                sample(unpacked, time),
                track.quaternion
            );
            if (track.quaternion) maxAngle = Math.max(maxAngle, distance);
            else maxPosition = Math.max(maxPosition, distance);
        }
    }
if (maxAngle > (0.25 * Math.PI) / 180 || maxPosition > 0.1)
    throw new Error(
        `Compression error bound failed: ${maxAngle} rad, ${maxPosition} cm`
    );
const hash = sha256(bytes),
    filename = `${group}.${hash.slice(0, 12)}.lcp`;
const pack = {
    group,
    file: filename,
    sha256: hash,
    bytes: bytes.length,
    gzipBytes: gzipSync(bytes, { level: 9 }).length,
    brotliBytes: brotliCompressSync(bytes).length,
    sourceFbxBytes: provenance.clips.reduce(
        (total, clip) => total + clip.bytes,
        0
    ),
    uncompressedFloatJsonBytes: Buffer.byteLength(
        JSON.stringify(
            clips.map((clip) => ({
                name: clip.name,
                duration: clip.duration,
                tracks: clip.tracks,
            }))
        )
    ),
    sourceKeys,
    packedKeys,
    measuredMaxAngularErrorDegrees: round((maxAngle * 180) / Math.PI),
    measuredMaxPositionErrorCm: round(maxPosition),
    measuredMaxRetargetFkErrorCm: round(maximumRetargetFkErrorCm, 9),
    clips: Object.fromEntries(clips.map((clip) => [clip.name, clip.metadata])),
};
await mkdir(output, { recursive: true });
await writeFile(path.join(output, filename), bytes);
await writeFile(
    path.join(output, "manifest.json"),
    JSON.stringify(
        {
            version: 1,
            format: "LCP1",
            provenance: "source-manifest.json",
            packs: [pack],
        },
        null,
        2
    ) + "\n"
);
console.log(JSON.stringify(pack, null, 2));
