#!/usr/bin/env node
/**
 * Generate lightweight 2D previews from the exact native emote clips and rest rig.
 * Run: node frontend/scripts/generate-emote-previews.mjs [--check]
 * No rig, Three.js, or source animation JSON is loaded by the picker at runtime.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const require = createRequire(path.join(root, "package.json"));
const {
    ObjectLoader,
    AnimationMixer,
    AnimationClip,
    Vector3,
    LoopOnce,
} = require("three");
const check = process.argv.includes("--check");
const prettier = require("prettier");
const sourcePaths = [
    "public/lobby/native-avatar-emotes.json",
    "public/lobby/native-avatar-motion.json",
    "components/_3DExhibit-v2/three/factory/player/instanceavatarvrm/baker/baserig.json",
];
const sources = await Promise.all(
    sourcePaths.map((name) => readFile(path.join(root, name), "utf8"))
);
const clips = { ...JSON.parse(sources[0]), ...JSON.parse(sources[1]) };
const rigJSON = JSON.parse(sources[2]);
const sourceHash = createHash("sha256")
    .update(sources.join("\n"))
    .digest("hex");
const names = [
    "WAVING",
    "HIPHOP",
    "MOONWALK",
    "TECHNO",
    "SHUFFLING",
    "CHAABI",
    "CHAABI2",
    "SEXY",
    "DEATH",
    "PRAYING",
    "WANNAROCK",
    "CRIP",
    "SITTING",
    "FLOORSITTING",
    "SITTALKING",
];
// Deliberate, characteristic poses, sampled from the original clips in seconds.
const restTimes = [
    0.9, 0.75, 0.48, 0.42, 1.6, 0.5, 0.4, 4.2, 3.3, 1.4, 1.5, 1, 0.05, 0.05,
    1.2,
];
const joints = [
    "Hips",
    "Spine2",
    "Neck",
    "Head",
    "HeadTop_End",
    ...["Left", "Right"].flatMap((side) =>
        [
            "Arm",
            "ForeArm",
            "Hand",
            "HandMiddle1",
            "UpLeg",
            "Leg",
            "Foot",
            "ToeBase",
        ].map((name) => side + name)
    ),
];
const yaw = -0.43;
const pitch = 0.1;
const round = (value) => Math.round(value * 10) / 10;
const output = path.join(root, "public/lobby/emote-previews");
if (!check) await mkdir(output, { recursive: true });
const generated = {};
let totalBytes = 0;

async function emit(filename, contents) {
    if (check) {
        const previous = await readFile(filename, "utf8");
        if (previous !== contents)
            throw new Error(`Stale preview: ${filename}`);
    } else await writeFile(filename, contents);
    totalBytes += Buffer.byteLength(contents);
}

for (const [index, name] of names.entries()) {
    const source = clips[name];
    if (!source) throw new Error(`Missing native emote: ${name}`);
    const rig = new ObjectLoader().parse(rigJSON);
    // Native clips target a normalized VRM rig: only rotations and hip
    // translation are applied by loadmixamoanimation.js. Reconstruct that
    // normalized rest rig here; the FBX rig has rotated local bone axes.
    rig.updateMatrixWorld(true);
    const rest = new Map();
    rig.traverse((bone) =>
        rest.set(bone, bone.getWorldPosition(new Vector3()))
    );
    rig.traverse((bone) => {
        if (!bone.isBone) return;
        bone.position.copy(rest.get(bone)).sub(rest.get(bone.parent));
        bone.quaternion.identity();
        bone.scale.setScalar(1);
    });
    rig.updateMatrixWorld(true);
    const mixer = new AnimationMixer(rig);
    const clip = AnimationClip.parse({
        ...source,
        tracks: source.tracks.filter(
            (track) =>
                track.name.endsWith(".quaternion") ||
                track.name === "mixamorigHips.position"
        ),
    });
    const action = mixer.clipAction(clip);
    action.setLoop(LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    const bones = joints.map((joint) =>
        rig.getObjectByName(`mixamorig${joint}`)
    );
    if (bones.some((bone) => !bone)) throw new Error(`Incomplete rig: ${name}`);
    const sample = (time) => {
        action.paused = false;
        action.enabled = true;
        mixer.setTime(Math.min(time, source.duration - 0.00001));
        rig.updateMatrixWorld(true);
        const origin = bones[0].getWorldPosition(new Vector3());
        return bones.map((bone) => {
            const point = bone.getWorldPosition(new Vector3());
            // Root travel belongs in the world; keep the thumbnail in its card.
            point.x -= origin.x;
            point.z -= origin.z;
            const x = Math.cos(yaw) * point.x + Math.sin(yaw) * point.z;
            const z = -Math.sin(yaw) * point.x + Math.cos(yaw) * point.z;
            const y = Math.cos(pitch) * point.y - Math.sin(pitch) * z;
            return [x, -y, Math.sin(pitch) * point.y + Math.cos(pitch) * z];
        });
    };
    const duration = Math.min(6, source.duration);
    // Long dances get a faithful six-second excerpt around the featured pose.
    const start = Math.max(
        0,
        Math.min(source.duration - duration, restTimes[index] - duration / 2)
    );
    const count = Math.max(2, Math.ceil(duration * 16));
    const rawFrames = Array.from({ length: count }, (_, frame) =>
        sample(start + (frame / Math.max(1, count - 1)) * duration)
    );
    const rawStill = sample(restTimes[index]);
    const points = [...rawFrames, rawStill].flat();
    const xMin = Math.min(...points.map((point) => point[0]));
    const xMax = Math.max(...points.map((point) => point[0]));
    const yMin = Math.min(...points.map((point) => point[1]));
    const yMax = Math.max(...points.map((point) => point[1]));
    const scale = Math.min(0.64, 86 / (xMax - xMin), 86 / (yMax - yMin));
    const centerX = (xMin + xMax) / 2;
    const centerY = (yMin + yMax) / 2;
    const project = (frame) =>
        frame.flatMap(([x, y, z]) => [
            round(60 + (x - centerX) * scale),
            round(54 + (y - centerY) * scale),
            round(z * scale),
        ]);
    const still = project(rawStill);
    const frames = rawFrames.map(project);
    const restFrame = Math.max(
        0,
        Math.min(
            count - 1,
            Math.round(((restTimes[index] - start) / duration) * (count - 1))
        )
    );
    const payload = { duration: round(duration), restFrame, frames };
    const bytes = JSON.stringify(payload) + "\n";
    const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 10);
    generated[name] = {
        scale: round(scale),
        still,
        url: `/lobby/emote-previews/${name.toLowerCase()}.json?v=${hash}`,
    };
    await emit(path.join(output, `${name.toLowerCase()}.json`), bytes);
    mixer.stopAllAction();
    mixer.uncacheRoot(rig);
}
const staticData = `// Generated by scripts/generate-emote-previews.mjs; do not hand-edit.\n// Native clip / rest-rig SHA-256: ${sourceHash}\nexport const EMOTE_POSES: Record<string, { scale: number; still: number[]; url: string }> = ${JSON.stringify(
    generated
)};\n`;
await emit(
    path.join(root, "features/lobby/emotePoseData.ts"),
    await prettier.format(staticData, {
        ...(await prettier.resolveConfig(
            path.join(root, "features/lobby/emotePoseData.ts"),
            { editorconfig: true }
        )),
        parser: "typescript",
    })
);
console.log(
    `${check ? "Verified" : "Generated"} ${
        names.length
    } real-clip emote previews, ${Math.round(
        totalBytes / 1024
    )} KB total; animation JSON loads only on hover/focus.`
);
