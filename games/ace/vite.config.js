import { resolve } from "node:path";
import { defineConfig } from "vite";

// The loading and pausing helpers are TypeScript source in games/runtime.
const runtime = resolve("../runtime/src");

// Built straight into the frontend's static games folder; /games/ace
// iframes /games/ace/index.html.
export default defineConfig({
    base: "./",
    resolve: {
        alias: [
            {
                find: /^@oncyber\/game-runtime\/(loading|pausing)$/,
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
