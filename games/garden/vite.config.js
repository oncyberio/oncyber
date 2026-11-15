import { appendFileSync, createReadStream, existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

// The browser host (index.html) builds with Vite into the frontend's static
// games folder; the UI page is bundled into one self-contained ui.html by
// scripts/build-ui.mjs, so its sandboxed (opaque-origin) frame loads nothing.
// The game lifecycle runtime is TypeScript source in games/runtime.
const runtime = resolve("../runtime/src");
// Renderer-free parts of the optional avatar kit: the check's inspect answer
// and the draw probe. The garden draws avatars with its own DOM-free reader.
const avatarKit = resolve("../kits/avatar/src");

// Standalone dev serves the lobby's files from the frontend's public folder.
const lobbyFiles = {
    name: "lobby-files",
    configureServer(server) {
        server.middlewares.use("/lobby", (req, res, next) => {
            const file = resolve("../../frontend/public/lobby", `.${req.url.split("?")[0]}`);
            if (!file.startsWith(resolve("../../frontend/public/lobby")) || !existsSync(file)) return next();
            res.setHeader("Content-Type", "application/json");
            createReadStream(file).pipe(res);
        });
    },
};

// Dev-only: ?log makes the host post diagnostics here (device simulators).
const devLog = {
    name: "dev-log",
    configureServer(server) {
        server.middlewares.use("/__log", (req, res) => {
            let body = "";
            req.on("data", (c) => (body += c));
            req.on("end", () => {
                appendFileSync(resolve(".device.log"), `${new Date().toISOString()} ${body}\n`);
                res.end("ok");
            });
        });
    },
};

export default defineConfig({
    base: "./",
    plugins: [lobbyFiles, devLog],
    resolve: {
        alias: [
            { find: /^@oncyber\/game-runtime\/safe-area$/, replacement: `${runtime}/safe-area.ts` },
            { find: /^@oncyber\/avatar-kit\/page$/, replacement: `${avatarKit}/page.ts` },
            { find: /^@oncyber\/avatar-kit\/probe$/, replacement: `${avatarKit}/probe.js` },
            { find: /^@oncyber\/game-runtime\/results$/, replacement: `${runtime}/results.ts` },
            { find: /^@oncyber\/game-runtime\/device-check$/, replacement: `${runtime}/deviceCheck.ts` },
            { find: /^@oncyber\/game-runtime\/device-controls$/, replacement: `${runtime}/deviceControls.ts` },
            { find: /^@oncyber\/game-runtime\/audio-browser$/, replacement: `${runtime}/audio-browser.ts` },
            { find: /^@oncyber\/game-runtime\/check$/, replacement: `${runtime}/check.ts` },
            { find: /^@oncyber\/game-runtime\/(loading|pausing)$/, replacement: `${runtime}/$1.ts` },
            { find: /^@oncyber\/game-runtime\/browser$/, replacement: `${runtime}/browser.ts` },
            { find: /^@oncyber\/game-runtime\/voice$/, replacement: `${runtime}/voice.ts` },
            { find: /^@oncyber\/game-runtime\/keys-browser$/, replacement: `${runtime}/keysBrowser.ts` },
            { find: /^@oncyber\/game-runtime$/, replacement: `${runtime}/index.ts` },
        ],
    },
    // The UI page runs in an opaque-origin sandbox; dev modules need CORS.
    server: { cors: { origin: "*" }, fs: { allow: [".."] } },
    build: {
        outDir: "../../frontend/public/games/garden",
        emptyOutDir: true,
        assetsInlineLimit: 0,
        chunkSizeWarningLimit: 1600,
        rollupOptions: { input: { index: resolve("index.html") } },
    },
});
