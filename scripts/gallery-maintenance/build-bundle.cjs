#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { readGallerySelection } = require("../gallery-selection.cjs");
const [manifest, output] = process.argv.slice(2);
if (!manifest || !output)
    throw Error("Usage: node build-bundle.cjs MANIFEST EMPTY_OUTPUT_DIRECTORY");
const root = path.resolve(__dirname, "../..");
const destination = path.resolve(output);
const selection = JSON.parse(fs.readFileSync(manifest, "utf8"));
readGallerySelection(manifest, selection.projectId);
if (fs.existsSync(destination) && fs.readdirSync(destination).length)
    throw Error("Deployment output must be empty");
function copy(source, relative) {
    const target = path.join(destination, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
}
for (const file of ["Dockerfile", "package.json", "package-lock.json"])
    copy(path.join(__dirname, file), file);
for (const file of [
    "run.cjs",
    "config.cjs",
    "media.cjs",
    "cdn.cjs",
    "network.cjs",
    "optimize.cjs",
])
    copy(path.join(__dirname, file), `scripts/gallery-maintenance/${file}`);
for (const file of ["core.js", "opensea.js", "indexer.js", "document-size.js", "artists.json"])
    copy(
        path.join(root, "cloud-functions/artist-index", file),
        `cloud-functions/artist-index/${file}`
    );
copy(
    path.join(root, "scripts/gallery-selection.cjs"),
    "scripts/gallery-selection.cjs"
);
copy(manifest, "top-1000.json");
console.log(`Deployment bundle: ${destination}`);
