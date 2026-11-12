// Reproducible cross-origin browser check. No API keys or account required.
// Run from repository root: node scripts/content-host-preview.mjs
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = new URL("../", import.meta.url);
const paths = {
    "/": "frontend/features/content-host/fixtures/three.html",
    "/security.html": "frontend/features/content-host/fixtures/security.html",
    "/oncyber-content.js": "frontend/public/oncyber-content.js",
    "/three.module.js": "node_modules/three/build/three.module.js",
    "/three.core.js": "node_modules/three/build/three.core.js",
};
const server = createServer(async (req, res) => {
    const path = paths[new URL(req.url, "http://localhost").pathname];
    if (!path || req.method !== "GET") {
        res.writeHead(404);
        res.end();
        return;
    }
    try {
        const bytes = await readFile(fileURLToPath(new URL(path, root)));
        res.writeHead(200, {
            "content-type": path.endsWith(".html")
                ? "text/html; charset=utf-8"
                : "text/javascript; charset=utf-8",
            "access-control-allow-origin": "*",
            "cache-control": "no-store",
        });
        res.end(bytes);
    } catch {
        res.writeHead(500);
        res.end("Preview asset unavailable");
    }
});
server.listen(13001, "127.0.0.1", () =>
    console.log(
        "Content fixture: http://127.0.0.1:13001 — open via http://localhost:13000/play"
    )
);
