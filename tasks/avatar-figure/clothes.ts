/**
 * Makes the outfits figures wear: one GLB per outfit in
 * frontend/public/models/clothes/ (see clothes/outfits.ts), every garment
 * cut to the figure's own body and bound to its bones.
 *
 *   cd tasks/avatar-figure
 *   npm run clothes [-- outfit]
 */
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, "../..");
const need = createRequire(import.meta.url);
const { build } = need("esbuild") as typeof import("esbuild");

const three = path.join(ROOT, "node_modules/three");
const bundle = path.join(HERE, "out", "clothes.mjs");
await build({
    entryPoints: [path.join(HERE, "clothes/make.ts")],
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
    ["--max-old-space-size=8192", bundle, process.argv[2] || ""],
    { stdio: "inherit", env: { ...process.env, CLOTHES_ROOT: ROOT } }
);
process.exit(run.status ?? 1);
