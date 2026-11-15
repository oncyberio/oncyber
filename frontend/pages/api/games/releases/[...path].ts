import type { NextApiRequest, NextApiResponse } from "next";
import { createReadStream } from "fs";
import { readFile, stat } from "fs/promises";
import { extname, resolve, sep } from "path";
import { localReleasesDir } from "@features/games/gameReleaseServer";
import {
    NETWORK_FILE,
    releaseContentSecurityPolicy,
} from "@features/games/networkPolicy";

/**
 * Serves the local releases folder (see localReleasesDir): the files of
 * /api/games/releases/<game>/<release>/<path>. It answers only where that
 * folder is on, and only for files inside it. Releases are public, never
 * change, and are fetched in CORS mode by the game's opaque-origin frame.
 *
 * It sends what every host of releases must (docs/games/releases.md):
 * `Access-Control-Allow-Origin: *`, and the game's own
 * Content-Security-Policy, built from the `network.json` the release
 * carries exactly as next.config.js builds it for a committed build
 * (docs/games/trust.md), with a sandbox added.
 */
const TYPES: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".json": "application/json",
    ".css": "text/css",
    ".wasm": "application/wasm",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".glb": "model/gltf-binary",
    ".vrm": "model/gltf-binary",
    ".ktx2": "image/ktx2",
    ".mp3": "audio/mpeg",
    ".ogg": "audio/ogg",
    ".wav": "audio/wav",
    ".woff2": "font/woff2",
};
const GAME_ID = /^[a-z0-9][a-z0-9-]{0,62}$/;
const RELEASE_ID = /^[0-9a-f]{16}$/;

export const config = { api: { responseLimit: false } };

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const root = localReleasesDir();
    const parts = ([] as string[]).concat(req.query.path ?? []);
    const [game, release, ...rest] = parts;
    if (
        !root ||
        (req.method !== "GET" && req.method !== "HEAD") ||
        !GAME_ID.test(game ?? "") ||
        !RELEASE_ID.test(release ?? "") ||
        !rest.length ||
        rest.some((part) => !part || part === "." || part === "..")
    )
        return res.status(404).end();
    const folder = resolve(root, game, release);
    const file = resolve(folder, ...rest);
    const found = file.startsWith(folder + sep)
        ? await stat(file).catch(() => null)
        : null;
    if (!found?.isFile()) return res.status(404).end();
    res.setHeader(
        "Content-Type",
        TYPES[extname(file).toLowerCase()] ?? "application/octet-stream"
    );
    res.setHeader("Content-Length", found.size);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("X-Content-Type-Options", "nosniff");
    // The game reaches its own files and the hosts its release declared,
    // nothing else; opened directly, it still runs without this site's
    // origin. A release never changes, so neither does its policy.
    const published = await readFile(resolve(folder, NETWORK_FILE), "utf8")
        .then(JSON.parse)
        .catch(() => null);
    res.setHeader(
        "Content-Security-Policy",
        releaseContentSecurityPolicy(published)
    );
    if (req.method === "HEAD") return res.status(200).end();
    res.status(200);
    createReadStream(file).pipe(res);
}
