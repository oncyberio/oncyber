import { resolve } from "node:path";
import { defineConfig } from "vite";

// Built straight into the frontend's static games folder; /games/ace
// iframes /games/ace/index.html.
// The Oncyber game runtime is TypeScript source in games/runtime.
const runtime = resolve("../runtime/src");

export default defineConfig({
    base: "./",
    resolve: {
        alias: [
            {
                find: /^@oncyber\/game-runtime\/(.+)$/,
                replacement: `${runtime}/$1.ts`,
            },
        ],
    },
    server: { fs: { allow: [".."] } },
    build: {
        outDir: "../../frontend/public/games/ace",
        emptyOutDir: true,
        assetsInlineLimit: 0,
        chunkSizeWarningLimit: 1200,
    },
});
