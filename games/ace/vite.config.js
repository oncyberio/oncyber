import { resolve } from "node:path";
import { defineConfig } from "vite";

const runtime = resolve("../runtime/src");

// Built straight into the frontend's static games folder; /games/ace
// iframes /games/ace/index.html.
export default defineConfig({
    base: "./",
    resolve: {
        alias: [
            {
                find: /^@oncyber\/game-runtime\/(browser|check|page)$/,
                replacement: `${runtime}/$1.ts`,
            },
            {
                find: /^@oncyber\/game-runtime\/keys-browser$/,
                replacement: `${runtime}/keysBrowser.ts`,
            },
            {
                find: /^@oncyber\/game-runtime\/safe-area$/,
                replacement: `${runtime}/safe-area.ts`,
            },
            {
                find: /^@oncyber\/game-runtime$/,
                replacement: `${runtime}/index.ts`,
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
