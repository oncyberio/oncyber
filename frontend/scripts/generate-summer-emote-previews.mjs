#!/usr/bin/env node
/** Offline CPU skinning/rasterization of the actual Summer VRM and native clips. */
import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "package.json"));
const THREE = require("three");
const sharp = require("sharp");
const prettier = require("prettier");
const args = process.argv.slice(2);
const onlyIndex = args.indexOf("--only");
const only = onlyIndex < 0 ? null : args[onlyIndex + 1].split(",");
const STILL_SIZE = 192;
const MOTION_SIZE = 160;
const SUPERSAMPLE = 2;
const FPS = 12;
const MAX_DURATION = 6;
const entries = [
    ["WAVING", 0.9],
    ["HIPHOP", 0.75],
    ["MOONWALK", 0.48],
    ["TECHNO", 0.42],
    ["SHUFFLING", 1.6],
    ["CHAABI", 0.5],
    ["CHAABI2", 0.4],
    ["SEXY", 4.2],
    ["DEATH", 3.3],
    ["PRAYING", 1.4],
    ["WANNAROCK", 1.5],
    ["CRIP", 1],
    ["SITTING", 0.05],
    ["FLOORSITTING", 0.05],
    ["SITTALKING", 1.2],
];
const output = path.join(root, "public/lobby/emote-previews/summer");
await mkdir(output, { recursive: true });
const modelPath = "public/models/summer_unlit_fixed.vrm";
const modelBytes = await readFile(path.join(root, modelPath));
const jsonLength = modelBytes.readUInt32LE(12);
const gltf = JSON.parse(modelBytes.subarray(20, 20 + jsonLength));
const binary = modelBytes.subarray(20 + jsonLength + 8);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const clips = {
    ...JSON.parse(
        await readFile(
            path.join(root, "public/lobby/native-avatar-emotes.json")
        )
    ),
    ...JSON.parse(
        await readFile(
            path.join(root, "public/lobby/native-avatar-motion.json")
        )
    ),
};
const sourceHash = hash(modelBytes);
const generatorHash = hash(await readFile(fileURLToPath(import.meta.url)));
const clipsHash = hash(JSON.stringify(clips));
if (args.includes("--check")) {
    const saved = JSON.parse(
        await readFile(path.join(output, "manifest.json"))
    );
    if (
        saved.modelSha256 !== sourceHash ||
        saved.generatorSha256 !== generatorHash ||
        saved.clipsSha256 !== clipsHash
    )
        throw new Error(
            "Preview inputs or generator changed; regenerate the Summer previews."
        );
    if (
        Object.keys(saved.previews).sort().join(",") !==
        entries
            .map(([name]) => name)
            .sort()
            .join(",")
    )
        throw new Error("Summer previews do not cover every native emote.");
    let bytes = 0;
    for (const [name] of entries) {
        const preview = saved.previews[name];
        for (const kind of ["still", "motion"]) {
            const url = preview[kind];
            const [asset, version] = url.split("?v=");
            const data = await readFile(path.join(root, "public", asset));
            if (hash(data).slice(0, 10) !== version)
                throw new Error(`Changed ${kind} asset: ${name}`);
            const info = await sharp(data).metadata();
            const size = kind === "still" ? STILL_SIZE : MOTION_SIZE;
            if (
                info.format !== "webp" ||
                info.width !== size ||
                info.height !== size ||
                !info.hasAlpha
            )
                throw new Error(
                    `Invalid transparent WebP dimensions: ${name} ${kind}`
                );
            bytes += data.length;
        }
    }
    console.log(
        `Verified ${
            entries.length
        } Summer icons and animations, source hashes, content versions, alpha and dimensions (${Math.round(
            bytes / 1024
        )}KB).`
    );
    process.exit(0);
}
const types = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const readers = {
    5121: [1, "getUint8"],
    5123: [2, "getUint16"],
    5125: [4, "getUint32"],
    5126: [4, "getFloat32"],
};
function accessor(index) {
    const spec = gltf.accessors[index];
    const view = gltf.bufferViews[spec.bufferView];
    const [bytes, reader] = readers[spec.componentType];
    const size = types[spec.type];
    const stride = view.byteStride || bytes * size;
    const offset = (view.byteOffset || 0) + (spec.byteOffset || 0);
    const data = new DataView(
        binary.buffer,
        binary.byteOffset,
        binary.byteLength
    );
    const values = new Float64Array(spec.count * size);
    for (let row = 0; row < spec.count; row++)
        for (let column = 0; column < size; column++)
            values[row * size + column] = data[reader](
                offset + row * stride + column * bytes,
                true
            );
    return values;
}
const primitive = gltf.meshes[0].primitives[0];
const position = accessor(primitive.attributes.POSITION);
const normal = accessor(primitive.attributes.NORMAL);
const uv = accessor(primitive.attributes.TEXCOORD_0);
const joints = accessor(primitive.attributes.JOINTS_0);
const weights = accessor(primitive.attributes.WEIGHTS_0);
const indices = accessor(primitive.indices);
const skin = gltf.skins[0];
const bind = accessor(skin.inverseBindMatrices);
const inverseBind = skin.joints.map((_, i) =>
    new THREE.Matrix4().fromArray(bind, i * 16)
);
const nodes = gltf.nodes.map((node) => {
    const object = new THREE.Object3D();
    object.name = (node.name || "").replace("mixamorig:", "mixamorig");
    if (node.translation) object.position.fromArray(node.translation);
    if (node.rotation) object.quaternion.fromArray(node.rotation);
    if (node.scale) object.scale.fromArray(node.scale);
    if (node.matrix)
        new THREE.Matrix4()
            .fromArray(node.matrix)
            .decompose(object.position, object.quaternion, object.scale);
    return object;
});
gltf.nodes.forEach((node, index) =>
    node.children?.forEach((child) => nodes[index].add(nodes[child]))
);
const scene = new THREE.Group();
gltf.scenes[gltf.scene || 0].nodes.forEach((node) => scene.add(nodes[node]));
scene.updateMatrixWorld(true);
const rest = nodes.map((node) => ({
    position: node.position.clone(),
    quaternion: node.quaternion.clone(),
    scale: node.scale.clone(),
}));
const hips = scene.getObjectByName("mixamorigHips");
const hipScale =
    hips.getWorldPosition(new THREE.Vector3()).y / 96.74480000054845;
const material = gltf.materials[primitive.material];
const textureIndex = material.pbrMetallicRoughness.baseColorTexture.index;
const image = gltf.images[gltf.textures[textureIndex].source];
const imageView = gltf.bufferViews[image.bufferView];
const tex = await sharp(
    binary.subarray(
        imageView.byteOffset,
        imageView.byteOffset + imageView.byteLength
    )
)
    .resize(512, 512)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
const texData = tex.data;
const softTex = await sharp(
    binary.subarray(
        imageView.byteOffset,
        imageView.byteOffset + imageView.byteLength
    )
)
    .resize(512, 512)
    .median(5)
    .ensureAlpha()
    .raw()
    .toBuffer();
const texWidth = tex.info.width;
const texHeight = tex.info.height;
const yaw = Math.PI - 0.43;
const pitch = 0.08;
let cy = Math.cos(yaw),
    sy = Math.sin(yaw);
const cp = Math.cos(pitch),
    sp = Math.sin(pitch);
const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));
const matrices = skin.joints.map(() => new THREE.Matrix4());
const vertexCount = position.length / 3;

function sample(mixer, action, time, duration) {
    action.paused = false;
    action.enabled = true;
    mixer.setTime(Math.min(time, duration - 0.00001));
    scene.updateMatrixWorld(true);
    skin.joints.forEach((node, i) =>
        matrices[i].multiplyMatrices(nodes[node].matrixWorld, inverseBind[i])
    );
    const origin = hips.getWorldPosition(new THREE.Vector3());
    const vertices = new Float32Array(vertexCount * 6);
    for (let v = 0; v < vertexCount; v++) {
        const p = v * 3,
            w = v * 4,
            at = v * 6;
        let x = 0,
            y = 0,
            z = 0,
            nx = 0,
            ny = 0,
            nz = 0;
        for (let part = 0; part < 4; part++) {
            const weight = weights[w + part];
            if (!weight) continue;
            const m = matrices[joints[w + part]].elements;
            x +=
                weight *
                (m[0] * position[p] +
                    m[4] * position[p + 1] +
                    m[8] * position[p + 2] +
                    m[12]);
            y +=
                weight *
                (m[1] * position[p] +
                    m[5] * position[p + 1] +
                    m[9] * position[p + 2] +
                    m[13]);
            z +=
                weight *
                (m[2] * position[p] +
                    m[6] * position[p + 1] +
                    m[10] * position[p + 2] +
                    m[14]);
            nx +=
                weight *
                (m[0] * normal[p] +
                    m[4] * normal[p + 1] +
                    m[8] * normal[p + 2]);
            ny +=
                weight *
                (m[1] * normal[p] +
                    m[5] * normal[p + 1] +
                    m[9] * normal[p + 2]);
            nz +=
                weight *
                (m[2] * normal[p] +
                    m[6] * normal[p + 1] +
                    m[10] * normal[p + 2]);
        }
        x -= origin.x;
        z -= origin.z;
        const vx = cy * x + sy * z,
            vz = -sy * x + cy * z;
        vertices[at] = vx;
        vertices[at + 1] = -(cp * y - sp * vz);
        vertices[at + 2] = sp * y + cp * vz;
        const vnx = cy * nx + sy * nz,
            vnz = -sy * nx + cy * nz;
        vertices[at + 3] = vnx;
        vertices[at + 4] = cp * ny - sp * vnz;
        vertices[at + 5] = sp * ny + cp * vnz;
    }
    return vertices;
}

function render(vertices, bounds, size) {
    const dim = size * SUPERSAMPLE;
    const pixels = Buffer.alloc(dim * dim * 4);
    const depths = new Float32Array(dim * dim).fill(-Infinity);
    const scale =
        (dim * 0.9) /
        Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
    const centerX = (bounds.maxX + bounds.minX) / 2;
    const centerY = (bounds.maxY + bounds.minY) / 2;
    const screen = new Float32Array(vertexCount * 3);
    for (let v = 0; v < vertexCount; v++) {
        screen[v * 3] = dim / 2 + (vertices[v * 6] - centerX) * scale;
        screen[v * 3 + 1] =
            dim * 0.48 + (vertices[v * 6 + 1] - centerY) * scale;
        screen[v * 3 + 2] = vertices[v * 6 + 2];
    }
    for (let face = 0; face < indices.length; face += 3) {
        const ia = indices[face],
            ib = indices[face + 1],
            ic = indices[face + 2];
        const a = ia * 3,
            b = ib * 3,
            c = ic * 3;
        const ax = screen[a],
            ay = screen[a + 1],
            bx = screen[b],
            by = screen[b + 1],
            cx = screen[c],
            cy = screen[c + 1];
        const denominator = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
        if (Math.abs(denominator) < 0.00001) continue;
        const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
        const maxX = Math.min(dim - 1, Math.ceil(Math.max(ax, bx, cx)));
        const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
        const maxY = Math.min(dim - 1, Math.ceil(Math.max(ay, by, cy)));
        for (let py = minY; py <= maxY; py++)
            for (let px = minX; px <= maxX; px++) {
                const wa =
                    ((by - cy) * (px + 0.5 - cx) +
                        (cx - bx) * (py + 0.5 - cy)) /
                    denominator;
                const wb =
                    ((cy - ay) * (px + 0.5 - cx) +
                        (ax - cx) * (py + 0.5 - cy)) /
                    denominator;
                const wc = 1 - wa - wb;
                if (wa < -0.000001 || wb < -0.000001 || wc < -0.000001)
                    continue;
                const depth =
                    wa * screen[a + 2] +
                    wb * screen[b + 2] +
                    wc * screen[c + 2];
                const pixel = py * dim + px;
                if (depth <= depths[pixel]) continue;
                depths[pixel] = depth;
                const tx = clamp(
                    Math.round(
                        (wa * uv[ia * 2] + wb * uv[ib * 2] + wc * uv[ic * 2]) *
                            (texWidth - 1)
                    ),
                    0,
                    texWidth - 1
                );
                const ty = clamp(
                    Math.round(
                        (wa * uv[ia * 2 + 1] +
                            wb * uv[ib * 2 + 1] +
                            wc * uv[ic * 2 + 1]) *
                            (texHeight - 1)
                    ),
                    0,
                    texHeight - 1
                );
                const ti = (ty * texWidth + tx) * 4;
                // Preserve the signature crisp X goggles; remove fine fabric print
                // and texture grain from the smaller clothing silhouette.
                const restY =
                    wa * position[ia * 3 + 1] +
                    wb * position[ib * 3 + 1] +
                    wc * position[ic * 3 + 1];
                const color = restY > 1.48 ? texData : softTex;
                const red = color[ti] / 255,
                    green = color[ti + 1] / 255,
                    blue = color[ti + 2] / 255;
                const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
                const dark = Math.max(red, green, blue) < 0.24;
                const base = dark ? 29 : 231;
                const nx =
                    wa * vertices[ia * 6 + 3] +
                    wb * vertices[ib * 6 + 3] +
                    wc * vertices[ic * 6 + 3];
                const ny =
                    wa * vertices[ia * 6 + 4] +
                    wb * vertices[ib * 6 + 4] +
                    wc * vertices[ic * 6 + 4];
                const nz =
                    wa * vertices[ia * 6 + 5] +
                    wb * vertices[ib * 6 + 5] +
                    wc * vertices[ic * 6 + 5];
                const length = Math.hypot(nx, ny, nz) || 1;
                const light =
                    0.76 +
                    0.3 *
                        Math.max(
                            0,
                            (-0.42 * nx + 0.58 * ny + 0.7 * nz) / length
                        );
                const value = clamp(Math.round(base * light), 0, 252);
                const at = pixel * 4;
                pixels[at] = value;
                pixels[at + 1] = Math.min(255, value + (dark ? 1 : 2));
                pixels[at + 2] = Math.min(255, value + (dark ? 3 : 5));
                pixels[at + 3] = 255;
            }
    }
    return sharp(pixels, {
        raw: { width: dim, height: dim, channels: 4 },
    }).resize(size, size);
}

const manifest = {};
const temp = await mkdtemp(path.join(os.tmpdir(), "summer-emotes-"));
try {
    for (const [name, restTime] of entries.filter(
        ([name]) => !only || only.includes(name)
    )) {
        const source = clips[name];
        // Sit Talking faces the opposite way in its authored clip. Keep its
        // signature Summer goggles readable without changing the actual pose.
        const previewYaw = yaw;
        cy = Math.cos(previewYaw);
        sy = Math.sin(previewYaw);
        nodes.forEach((node, i) => {
            node.position.copy(rest[i].position);
            node.quaternion.copy(rest[i].quaternion);
            node.scale.copy(rest[i].scale);
        });
        const tracks = source.tracks
            .filter(
                (track) =>
                    track.name.endsWith(".quaternion") ||
                    track.name === "mixamorigHips.position"
            )
            .map((track) => ({
                ...track,
                values: track.values.map((value, index) =>
                    track.name.endsWith(".quaternion")
                        ? index % 4 === 0 || index % 4 === 2
                            ? -value
                            : value
                        : value * hipScale * (index % 3 === 1 ? 1 : -1)
                ),
            }));
        const mixer = new THREE.AnimationMixer(scene);
        const action = mixer.clipAction(
            THREE.AnimationClip.parse({ ...source, tracks })
        );
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
        action.play();
        if (name === "SITTALKING") {
            mixer.setTime(restTime);
            scene.updateMatrixWorld(true);
            const facing = new THREE.Vector3(0, 0, -1).applyQuaternion(
                scene
                    .getObjectByName("mixamorigHead")
                    .getWorldQuaternion(new THREE.Quaternion())
            );
            const faceYaw = Math.atan2(-facing.x, facing.z) - 0.28;
            cy = Math.cos(faceYaw);
            sy = Math.sin(faceYaw);
        }
        const duration = Math.min(MAX_DURATION, source.duration);
        const start = Math.max(
            0,
            Math.min(source.duration - duration, restTime - duration / 2)
        );
        const count = Math.max(2, Math.ceil(duration * FPS));
        const frames = Array.from({ length: count }, (_, frame) =>
            sample(
                mixer,
                action,
                start + (frame / (count - 1)) * duration,
                source.duration
            )
        );
        const still = sample(mixer, action, restTime, source.duration);
        const featured = Math.max(
            0,
            Math.min(
                count - 1,
                Math.round(((restTime - start) / duration) * (count - 1))
            )
        );
        frames.push(...frames.splice(0, featured));
        frames[0] = still;
        const bounds = {
            minX: Infinity,
            maxX: -Infinity,
            minY: Infinity,
            maxY: -Infinity,
        };
        for (const frame of [...frames, still])
            for (let i = 0; i < frame.length; i += 6) {
                bounds.minX = Math.min(bounds.minX, frame[i]);
                bounds.maxX = Math.max(bounds.maxX, frame[i]);
                bounds.minY = Math.min(bounds.minY, frame[i + 1]);
                bounds.maxY = Math.max(bounds.maxY, frame[i + 1]);
            }
        const stem = name.toLowerCase();
        const stillBytes = await render(still, bounds, STILL_SIZE)
            .webp({ quality: 91, alphaQuality: 100, effort: 6 })
            .toBuffer();
        await writeFile(path.join(output, `${stem}.webp`), stillBytes);
        const framePaths = [];
        // Each animation is a short browser-native transparent WebP, not a huge
        // decoded sprite atlas or a runtime Three.js scene.
        for (let i = 0; i < frames.length; i++) {
            const filename = path.join(temp, `${stem}-${i}.png`);
            await render(frames[i], bounds, MOTION_SIZE).png().toFile(filename);
            framePaths.push(filename);
        }
        const motionPath = path.join(output, `${stem}-motion.webp`);
        const frameDelay = Math.round((duration * 1000) / count);
        execFileSync(
            "img2webp",
            [
                "-loop",
                "0",
                "-mixed",
                "-q",
                "83",
                "-m",
                "4",
                "-d",
                String(Math.max(40, frameDelay)),
                ...framePaths,
                "-o",
                motionPath,
            ],
            { stdio: "pipe" }
        );
        const motionBytes = await readFile(motionPath);
        manifest[name] = {
            still: `/lobby/emote-previews/summer/${stem}.webp?v=${hash(
                stillBytes
            ).slice(0, 10)}`,
            motion: `/lobby/emote-previews/summer/${stem}-motion.webp?v=${hash(
                motionBytes
            ).slice(0, 10)}`,
            width: STILL_SIZE,
            height: STILL_SIZE,
            duration: Math.round(duration * 1000) / 1000,
        };
        mixer.stopAllAction();
        mixer.uncacheRoot(scene);
        console.log(
            `${name}: ${
                Math.round((stillBytes.length / 1024) * 10) / 10
            }KB still, ${Math.round(
                motionBytes.length / 1024
            )}KB animated (${count}frames)`
        );
    }
} finally {
    await rm(temp, { recursive: true, force: true });
}
const metadata = {
    model: modelPath,
    modelSha256: sourceHash,
    generatorSha256: generatorHash,
    clipsSha256: clipsHash,
    fps: FPS,
    motionSize: MOTION_SIZE,
    stillSize: STILL_SIZE,
    previews: manifest,
};
await writeFile(
    path.join(output, only ? "preview-manifest.json" : "manifest.json"),
    JSON.stringify(metadata, null, 2) + "\n"
);
if (!only) {
    const filename = path.join(root, "features/lobby/summerEmoteData.ts");
    const text = `// Generated by scripts/generate-summer-emote-previews.mjs.\n// Actual Summer VRM mesh SHA-256: ${sourceHash}\nexport const SUMMER_EMOTE_PREVIEWS: Record<string, { still: string; motion: string; width: number; height: number; duration: number }> = ${JSON.stringify(
        manifest
    )};\n`;
    await writeFile(
        filename,
        await prettier.format(text, {
            ...(await prettier.resolveConfig(filename, { editorconfig: true })),
            parser: "typescript",
        })
    );
}
