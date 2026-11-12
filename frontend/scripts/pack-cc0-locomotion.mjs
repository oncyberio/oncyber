#!/usr/bin/env node
/**
 * Build the OPTIONAL Quaternius CC0 animation-only lobby pack.
 * Usage: node frontend/scripts/pack-cc0-locomotion.mjs --input '/path/to/Universal Animation Library[Standard]' [--output /path]
 * Uses installed three-vanilla for offline math only. No runtime decoder dependency.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gzipSync, brotliCompressSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "../package.json"));
const {
    Object3D,
    Quaternion,
    Vector3,
    ObjectLoader,
} = require("three");
const args = process.argv.slice(2);
const option = (name, fallback) => {
    const i = args.indexOf(name);
    return i < 0 ? fallback : args[i + 1];
};
const input = option("--input");
if (!input)
    throw new Error("Supply --input pointing to the extracted Standard pack.");
const output = option("--output", path.join(here, "../public/lobby/cc0"));
const baseRigFile = path.join(
    here,
    "../components/_3DExhibit-v2/three/factory/player/instanceavatarvrm/baker/baserig.json"
);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const round = (n, places = 6) => Number(n.toFixed(places));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const boneMap = {
    pelvis: "mixamorigHips",
    spine_01: "mixamorigSpine",
    spine_02: "mixamorigSpine1",
    spine_03: "mixamorigSpine2",
    neck_01: "mixamorigNeck",
    Head: "mixamorigHead",
};
for (const [suffix, side] of [
    ["l", "Left"],
    ["r", "Right"],
]) {
    for (const [source, target] of Object.entries({
        clavicle: "Shoulder",
        upperarm: "Arm",
        lowerarm: "ForeArm",
        hand: "Hand",
        thigh: "UpLeg",
        calf: "Leg",
        foot: "Foot",
        ball: "ToeBase",
    }))
        boneMap[`${source}_${suffix}`] = `mixamorig${side}${target}`;
    // Preserve the source's curled hand poses. Finger tracks are usually
    // constant and reduce to two keys, so keeping them is inexpensive.
    for (const [source, target] of Object.entries({
        thumb: "Thumb",
        index: "Index",
        middle: "Middle",
        ring: "Ring",
        pinky: "Pinky",
    }))
        for (const joint of [1, 2, 3])
            boneMap[
                `${source}_0${joint}_${suffix}`
            ] = `mixamorig${side}Hand${target}${joint}`;
}
const boneNames = Object.values(boneMap);
const selection = [
    { name: "IDLE", source: "Idle_Loop", group: "core", loop: true },
    { name: "WALK", source: "Walk_Loop", group: "core", loop: true },
    { name: "JOG", source: "Jog_Fwd_Loop", group: "core", loop: true },
    { name: "RUN", source: "Sprint_Loop", group: "core", loop: true },
    { name: "TAKEOFF", source: "Jump_Start", group: "jump", loop: false },
    { name: "JUMP", source: "Jump_Loop", group: "jump", loop: true },
    { name: "LAND", source: "Jump_Land", group: "jump", loop: false },
];

async function loadGlb(filename) {
    const bytes = await readFile(filename);
    if (
        bytes.toString("ascii", 0, 4) !== "glTF" ||
        bytes.readUInt32LE(4) !== 2 ||
        bytes.readUInt32LE(8) !== bytes.length
    )
        throw new Error("Invalid GLB");
    const jsonLength = bytes.readUInt32LE(12);
    const json = JSON.parse(bytes.toString("utf8", 20, 20 + jsonLength));
    const binStart = 20 + jsonLength + 8;
    const accessor = (index) => {
        const a = json.accessors[index];
        if (a.componentType !== 5126 || a.sparse)
            throw new Error("Only dense float source accessors are supported");
        const view = json.bufferViews[a.bufferView];
        const width = { SCALAR: 1, VEC3: 3, VEC4: 4 }[a.type];
        if (!width || view.buffer !== 0)
            throw new Error("Unexpected source accessor");
        const start = binStart + (view.byteOffset || 0) + (a.byteOffset || 0);
        const stride = view.byteStride || width * 4;
        return Array.from({ length: a.count }, (_, k) =>
            Array.from({ length: width }, (_, c) =>
                bytes.readFloatLE(start + k * stride + c * 4)
            )
        );
    };
    const nodes = json.nodes.map((n) => {
        const o = new Object3D();
        o.name = n.name;
        if (n.translation) o.position.fromArray(n.translation);
        if (n.rotation) o.quaternion.fromArray(n.rotation);
        if (n.scale) o.scale.fromArray(n.scale);
        return o;
    });
    json.nodes.forEach((n, i) =>
        n.children?.forEach((child) => nodes[i].add(nodes[child]))
    );
    const root = new Object3D();
    json.scenes[json.scene || 0].nodes.forEach((i) => root.add(nodes[i]));
    root.updateMatrixWorld(true);
    const rest = nodes.map((node) => ({
        position: node.position.clone(),
        quaternion: node.quaternion.clone(),
        scale: node.scale.clone(),
        worldPosition: node.getWorldPosition(new Vector3()),
        worldQuaternion: node.getWorldQuaternion(new Quaternion()),
        parentWorldQuaternion: node.parent.getWorldQuaternion(new Quaternion()),
    }));
    const byName = new Map(nodes.map((n, i) => [n.name, i]));
    const sample = (animation, time) => {
        nodes.forEach((n, i) => {
            n.position.copy(rest[i].position);
            n.quaternion.copy(rest[i].quaternion);
            n.scale.copy(rest[i].scale);
        });
        for (const channel of animation.channels) {
            const times = channel.times;
            let hi = 1;
            while (hi < times.length && times[hi][0] < time) hi++;
            hi = Math.min(hi, times.length - 1);
            const lo = Math.max(0, hi - 1);
            const t = clamp(
                (time - times[lo][0]) / (times[hi][0] - times[lo][0] || 1),
                0,
                1
            );
            const n = nodes[channel.node],
                values = channel.values;
            if (channel.path === "rotation")
                n.quaternion
                    .fromArray(values[lo])
                    .slerp(new Quaternion().fromArray(values[hi]), t)
                    .normalize();
            else
                n[channel.path === "translation" ? "position" : "scale"]
                    .fromArray(values[lo])
                    .lerp(new Vector3().fromArray(values[hi]), t);
        }
        root.updateMatrixWorld(true);
    };
    const animations = new Map(
        json.animations.map((a) => {
            const channels = a.channels.map((c) => {
                const sampler = a.samplers[c.sampler];
                if (sampler.interpolation && sampler.interpolation !== "LINEAR")
                    throw new Error("Unsupported source interpolation");
                return {
                    node: c.target.node,
                    path: c.target.path,
                    times: accessor(sampler.input),
                    values: accessor(sampler.output),
                };
            });
            return [
                a.name,
                {
                    channels,
                    duration: Math.max(
                        ...channels.map((c) => c.times.at(-1)[0])
                    ),
                },
            ];
        })
    );
    return { bytes, nodes, rest, byName, root, sample, animations };
}

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

const sourcePath = path.join(input, "Unreal-Godot/UAL1_Standard.glb");
const rootMotionPath = path.join(input, "Unreal-Godot/UAL1_Standard_RM.glb");
const source = await loadGlb(sourcePath);
const rootMotion = await loadGlb(rootMotionPath);
// This recipe is pinned to the freely distributed June 2026 Standard upload.
// A changed upstream export requires reviewing its rig and provenance first.
const expectedSources = [
    [
        source,
        "69591853d817488edaa8fd9bf8fc1d821eaeaf789f8627b3cd23b41c4ed67997",
    ],
    [
        rootMotion,
        "be684571ed655a1b892c2c07e6e2aeca053b606c442d34004adaf1d944090d01",
    ],
];
for (const [asset, expected] of expectedSources) {
    if (sha256(asset.bytes) !== expected)
        throw new Error(
            "Source changed: review upstream rig, license and provenance before updating the pinned hashes."
        );
}

const baseRig = new ObjectLoader().parse(
    JSON.parse(await readFile(baseRigFile, "utf8"))
);
baseRig.updateMatrixWorld(true);
const targetHipsHeight = baseRig
    .getObjectByName("mixamorigHips")
    .getWorldPosition(new Vector3()).y;
const hipsIndex = source.byName.get("pelvis");
const sourceHipsHeight = source.rest[hipsIndex].worldPosition.y;
const hipsScale = targetHipsHeight / sourceHipsHeight;
// Retarget to the identity-rest, world-axis normalized VRM basis. Renaming the
// Unreal bones without this conversion twists arms and flips knees.
for (const sourceName of Object.keys(boneMap)) {
    const i = source.byName.get(sourceName),
        r = source.rest[i];
    const identity = r.parentWorldQuaternion
        .clone()
        .multiply(r.quaternion)
        .multiply(r.worldQuaternion.clone().invert())
        .normalize();
    if (identity.angleTo(new Quaternion()) > 1e-5)
        throw new Error(`Invalid rest-basis conversion for ${sourceName}`);
}

let maximumFkErrorMeters = 0;
const clips = selection.map((spec) => {
    const animation = source.animations.get(spec.source),
        rm = rootMotion.animations.get(spec.source);
    if (!animation || !rm)
        throw new Error(`Source clip missing: ${spec.source}`);
    const duration = animation.duration;
    const samples = Math.round(duration * 30);
    const times = Array.from(
        { length: samples + 1 },
        (_, i) => (duration * i) / samples
    );
    const tracks = Object.entries(boneMap).map(([from, name]) => ({
        source: from,
        name: `${name}.quaternion`,
        quaternion: true,
        times,
        values: [],
    }));
    const hipsTrack = {
        name: "mixamorigHips.position",
        quaternion: false,
        times,
        values: [],
    };
    const footPositions = [];
    for (const time of times) {
        source.sample(animation, time);
        for (const track of tracks) {
            const i = source.byName.get(track.source),
                rest = source.rest[i];
            const q = rest.parentWorldQuaternion
                .clone()
                .multiply(source.nodes[i].quaternion)
                .multiply(rest.worldQuaternion.clone().invert())
                .normalize();
            if (
                track.values.length &&
                q.dot(new Quaternion().fromArray(track.values.at(-1))) < 0
            )
                q.set(-q.x, -q.y, -q.z, -q.w);
            track.values.push(q.toArray());
        }
        hipsTrack.values.push(
            source.nodes[hipsIndex]
                .getWorldPosition(new Vector3())
                .multiplyScalar(hipsScale)
                .toArray()
        );
        footPositions.push(
            ["l", "r"].map((side) =>
                source.nodes[source.byName.get(`ball_${side}`)]
                    .getWorldPosition(new Vector3())
                    .toArray()
            )
        );
        // FK oracle: reconstruct identity-rest bones from converted rotations.
        // Checks conversion and the error incurred by dropping animated limb translation.
        const world = new Map();
        function reconstruct(i) {
            if (world.has(i)) return world.get(i);
            const n = source.nodes[i],
                rest = source.rest[i];
            const parent = source.nodes.indexOf(n.parent);
            const p =
                parent < 0
                    ? { position: new Vector3(), quaternion: new Quaternion() }
                    : reconstruct(parent);
            const localQ = rest.parentWorldQuaternion
                .clone()
                .multiply(n.quaternion)
                .multiply(rest.worldQuaternion.clone().invert());
            const q = p.quaternion.clone().multiply(localQ);
            const position =
                i === hipsIndex
                    ? n.getWorldPosition(new Vector3())
                    : rest.worldPosition
                          .clone()
                          .sub(
                              parent < 0
                                  ? new Vector3()
                                  : source.rest[parent].worldPosition
                          )
                          .applyQuaternion(p.quaternion)
                          .add(p.position);
            const result = { position, quaternion: q };
            world.set(i, result);
            return result;
        }
        for (const name of Object.keys(boneMap)) {
            const i = source.byName.get(name);
            maximumFkErrorMeters = Math.max(
                maximumFkErrorMeters,
                reconstruct(i).position.distanceTo(
                    source.nodes[i].getWorldPosition(new Vector3())
                )
            );
        }
    }
    // Physics owns horizontal displacement. Preserve vertical bounce and lateral sway.
    const first = hipsTrack.values[0],
        last = hipsTrack.values.at(-1);
    const drift = [last[0] - first[0], last[2] - first[2]];
    hipsTrack.values.forEach((v, i) => {
        v[0] -= (drift[0] * i) / samples;
        v[2] -= (drift[1] * i) / samples;
    });
    tracks.push(hipsTrack);
    rootMotion.sample(rm, 0);
    const start = rootMotion.nodes[
        rootMotion.byName.get("pelvis")
    ].getWorldPosition(new Vector3());
    rootMotion.sample(rm, rm.duration);
    const end = rootMotion.nodes[
        rootMotion.byName.get("pelvis")
    ].getWorldPosition(new Vector3());
    const distance = Math.hypot(end.x - start.x, end.z - start.z);
    const floor = Math.min(
        ...footPositions.flatMap((pair) => pair.map((p) => p[1]))
    );
    const contactSamples = footPositions.map((pair, i) =>
        pair.map((p, side) => {
            const previous = footPositions[Math.max(0, i - 1)][side],
                next = footPositions[Math.min(samples, i + 1)][side];
            const vy =
                (next[1] - previous[1]) /
                (times[Math.min(samples, i + 1)] - times[Math.max(0, i - 1)] ||
                    1);
            return spec.name !== "JUMP" &&
                p[1] < floor + 0.035 &&
                Math.abs(vy) < 0.4
                ? 1
                : 0;
        })
    );
    const footSpeeds = [];
    for (let i = 1; i < samples; i++) {
        for (let side = 0; side < 2; side++) {
            if (!contactSamples[i][side]) continue;
            const before = footPositions[i - 1][side],
                after = footPositions[i + 1][side];
            footSpeeds.push(
                Math.hypot(after[0] - before[0], after[2] - before[2]) /
                    (times[i + 1] - times[i - 1])
            );
        }
    }
    footSpeeds.sort((a, b) => a - b);
    const contactRanges = (side) => {
        const ranges = [];
        let start = null;
        for (let i = 0; i <= samples + 1; i++) {
            if (i <= samples && contactSamples[i][side]) {
                if (start === null) start = i;
            } else if (start !== null) {
                ranges.push([
                    round(start / samples, 4),
                    round((i - 1) / samples, 4),
                ]);
                start = null;
            }
        }
        return ranges;
    };
    return {
        ...spec,
        duration,
        tracks,
        metadata: {
            sourceName: spec.source,
            duration: round(duration),
            loop: spec.loop,
            sourceRootDistanceMeters: round(distance),
            sourceSpeedMps: round(distance / duration),
            canonicalRootMotionSpeedMps: round(
                ((distance / duration) * hipsScale) / 100
            ),
            canonicalPlantedFootSpeedMps: footSpeeds.length
                ? round(
                      (footSpeeds[Math.floor(footSpeeds.length / 2)] *
                          hipsScale) /
                          100
                  )
                : null,
            contactSampleRate: round(samples / duration),
            contacts: { left: contactRanges(0), right: contactRanges(1) },
        },
    };
});
if (maximumFkErrorMeters > 0.005)
    throw new Error(`Retarget FK error ${maximumFkErrorMeters}m exceeds 5mm`);

await mkdir(output, { recursive: true });
const packMetadata = [];
for (const group of ["core", "jump"]) {
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
        filename = `quaternius-${group}.${hash.slice(0, 12)}.lcp`;
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
const manifest = {
    version: 1,
    enabledByDefault: false,
    format: "LCP1: JSON header, uint16 normalized key times, int16x4 normalized quaternions, uint16x3 ranged hips positions; little-endian",
    provenance: {
        author: "Quaternius",
        title: "Universal Animation Library — Standard",
        license: "CC0-1.0",
        licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
        page: "https://quaternius.com/packs/universalanimationlibrary.html",
        downloadPage: "https://quaternius.itch.io/universal-animation-library",
        upstreamUploadId: "17958403",
        upstreamUploadDate: "2026-06-16",
        retrievedOn: "2026-10-06",
        files: [
            {
                name: "UAL1_Standard.glb",
                bytes: source.bytes.length,
                sha256: sha256(source.bytes),
            },
            {
                name: "UAL1_Standard_RM.glb",
                bytes: rootMotion.bytes.length,
                sha256: sha256(rootMotion.bytes),
            },
        ],
    },
    rig: {
        coordinates:
            "Y-up, meters converted to canonical Mixamo centimeters; identity-rest normalized VRM rotations",
        sourceHipsHeightMeters: round(sourceHipsHeight),
        canonicalHipsHeightCm: round(targetHipsHeight),
        bodyBones: 22,
        fingerBones: 30,
        measuredMaxRestBasisFkErrorMeters: round(maximumFkErrorMeters, 9),
        omitted: [
            "meshes",
            "materials",
            "textures",
            "leaf bones",
            "scale tracks",
            "non-hips translation tracks",
            "unused clips",
        ],
    },
    validation: {
        denseComparisonHz: 120,
        maxAngularErrorDegrees: 0.25,
        maxPositionErrorCm: 0.1,
        reference:
            "30 Hz source interpolation after rest-basis conversion and planar drift removal; positional bound applies to hips, angular bound per joint (not end-effector world distance).",
        restBasisFk:
            "Source-skeleton forward kinematics compared against identity-rest reconstruction before key reduction, for every selected source frame.",
        contacts:
            "Heuristic toe-height and vertical-velocity intervals in normalized phase, before retargeting. Only apply while physically grounded. Air loop contacts are empty. Calibrate avatar soles after retargeting.",
        speeds: "Root-motion travel and median planted-toe travel are both recorded because source root motion does not necessarily match planted foot speed. Prefer planted-foot calibration for in-place playback; validate per-avatar ground speed.",
    },
    packs: packMetadata,
};
await writeFile(
    path.join(output, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n"
);
await writeFile(
    path.join(output, "LICENSE.txt"),
    await readFile(path.join(input, "License.txt"))
);
console.log(
    JSON.stringify(
        {
            rig: manifest.rig,
            packs: packMetadata.map(({ clips, ...stats }) => ({
                ...stats,
                clips: Object.keys(clips),
            })),
        },
        null,
        2
    )
);
