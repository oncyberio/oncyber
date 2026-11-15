// A loopback server for a local releases folder, with the headers a release
// host must send: the game's frame has an opaque origin, so its files are
// fetched in CORS mode; the game reaches only its own files and the hosts
// its release declared (the policy built from the release's network.json,
// docs/games/trust.md); and a release never changes, so it caches forever.
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const { NETWORK_FILE, releaseContentSecurityPolicy } = createRequire(
    import.meta.url
)(
    join(
        dirname(fileURLToPath(import.meta.url)),
        "../../../frontend/features/games/networkPolicy.js"
    )
);

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
};

/**
 * The Content-Security-Policy for the files of the release in `folder`:
 * the game's policy from its network.json, and a sandbox, so a release
 * opened directly still runs without the host's origin.
 */
export function releasePolicy(folder, options = {}) {
    let published = null;
    try {
        published = JSON.parse(
            readFileSync(join(folder, NETWORK_FILE), "utf8")
        );
    } catch {
        // No declaration in the release: its own files only.
    }
    return releaseContentSecurityPolicy(published, options);
}

/**
 * Serve `root` under `prefix` (and `pages`, a map of path to HTML).
 * `reportUri` is added to each release's policy, for a check that collects
 * violations.
 */
export function serveReleases({
    root,
    prefix = "/api/games/releases/",
    pages = {},
    reportUri,
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
            // <root>/<game>/<release>/: the policy is the release's own.
            "content-security-policy": releasePolicy(
                join(
                    root,
                    ...path
                        .slice(root.length + 1)
                        .split(sep)
                        .slice(0, 2)
                ),
                { reportUri }
            ),
        });
        res.end(readFileSync(path));
    });
    return new Promise((done) =>
        server.listen(0, "127.0.0.1", () => done(server))
    );
}
