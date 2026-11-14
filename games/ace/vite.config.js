import { resolve } from "node:path";
import { defineConfig } from "vite";

// Built straight into the frontend's static games folder; /games/ace
// iframes /games/ace/index.html.
export default defineConfig({
    base: "./",
    // Field health comes from the shared runtime (TypeScript source).
    resolve: {
        alias: [
            {
                find: /^@oncyber\/game-runtime\/health$/,
                replacement: resolve("../runtime/src/health.ts"),
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
