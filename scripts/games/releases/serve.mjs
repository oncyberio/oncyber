// A loopback server for a local releases folder, with the headers a release
// host must send: the game's frame has an opaque origin, so its files are
// fetched in CORS mode, and a release never changes, so it caches forever.
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";

export const RELEASE_TYPES = {
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
    ".bin": "application/octet-stream",
};

export const RELEASE_HEADERS = {
    "access-control-allow-origin": "*",
    "cache-control": "public, max-age=31536000, immutable",
    "x-content-type-options": "nosniff",
    // Opened directly, a release still runs without this site's origin.
    "content-security-policy": "sandbox allow-scripts allow-pointer-lock",
};

/** Serve `root` under `prefix` (and `pages`, a map of path to HTML). */
export function serveReleases({
    root,
    prefix = "/api/games/releases/",
    pages = {},
}) {
    root = resolve(root);
    const server = createServer((req, res) => {
        const url = new URL(req.url, "http://localhost");
        if (Object.hasOwn(pages, url.pathname)) {
            res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
            return res.end(pages[url.pathname]);
        }
        let path = null;
        try {
            if (url.pathname.startsWith(prefix))
                path = resolve(
                    root,
                    decodeURIComponent(url.pathname.slice(prefix.length))
                );
        } catch {}
        if (
            !path ||
            !path.startsWith(root + sep) ||
            !existsSync(path) ||
            !statSync(path).isFile()
        ) {
            res.writeHead(404);
            return res.end();
        }
        res.writeHead(200, {
            "content-type":
                RELEASE_TYPES[extname(path).toLowerCase()] ??
                "application/octet-stream",
            ...RELEASE_HEADERS,
        });
        res.end(readFileSync(path));
    });
    return new Promise((done) =>
        server.listen(0, "127.0.0.1", () => done(server))
    );
}
