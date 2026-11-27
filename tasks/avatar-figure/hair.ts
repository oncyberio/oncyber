/**
 * Makes the hair figures wear: one small GLB per cut in
 * frontend/public/models/hair/ (see figure/hairFiles.ts for the list),
 * each taken from another model's hair.
 *
 *   cd tasks/avatar-figure
 *   npm run hair -- /folder/with/the/models [cut]
 *
 * The folder holds the models the list names (`Sakurada Fumiriya.vrm`,
 * `AvatarSample_A.vrm`, ...); a cut whose model is missing is skipped.
 * Give a cut's id to make that one only. Each model's sha256 is printed,
 * to tell later which file a cut was made from.
 */
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, "../..");
const need = createRequire(import.meta.url);
const { build } = need("esbuild") as typeof import("esbuild");

const models = process.argv[2] && path.resolve(process.argv[2]);
if (!models || !existsSync(models))
    throw new Error("Give the folder that holds the models");

const three = path.join(ROOT, "node_modules/three");
const bundle = path.join(HERE, "out", "hair.mjs");
await build({
    entryPoints: [path.join(HERE, "hair/make.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: bundle,
    target: "node22",
    logLevel: "error",
    nodePaths: [
        path.join(ROOT, "node_modules"),
        path.join(ROOT, "frontend/node_modules"),
    ],
    // One copy of three, the build the app uses.
    alias: {
        "three/webgpu": path.join(three, "build/three.webgpu.js"),
        "three/tsl": path.join(three, "build/three.tsl.js"),
        "three/examples/jsm/loaders/GLTFLoader.js": path.join(
            three,
            "examples/jsm/loaders/GLTFLoader.js"
        ),
        three: path.join(three, "build/three.webgpu.js"),
    },
});
const run = spawnSync(
    process.execPath,
    [bundle, models, process.argv[3] || ""],
    {
        stdio: "inherit",
        env: { ...process.env, HAIR_ROOT: ROOT },
    }
);
process.exit(run.status ?? 1);
