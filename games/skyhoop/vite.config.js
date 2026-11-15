import { resolve } from "node:path";
import { defineConfig } from "vite";

// Built into the frontend's static games folder; /games/skyhoop frames
// /games/skyhoop/index.html. The lifecycle runtime is TypeScript source in
// games/runtime.
const runtime = resolve("../runtime/src");

export default defineConfig({
    base: "./",
    resolve: {
        alias: [
            { find: /^@oncyber\/game-runtime\/check$/, replacement: `${runtime}/check.ts` },
            { find: /^@oncyber\/game-runtime\/browser$/, replacement: `${runtime}/browser.ts` },
            { find: /^@oncyber\/game-runtime$/, replacement: `${runtime}/index.ts` },
        ],
    },
    server: { fs: { allow: [".."] } },
    build: {
        outDir: "../../frontend/public/games/skyhoop",
        emptyOutDir: true,
        assetsInlineLimit: 0,
        chunkSizeWarningLimit: 2000,
        rollupOptions: { input: { index: resolve("index.html") } },
    },
});
