import { resolve } from "node:path";
import { defineConfig } from "vite";

// The Oncyber runtime is TypeScript source in games/runtime; Ace uses its
// input layer (keyboard, on-screen controls, gamepad) from game.json.
const runtime = resolve("../runtime/src");

// Built straight into the frontend's static games folder; /games/ace
// iframes /games/ace/index.html.
export default defineConfig({
    base: "./",
    resolve: {
        alias: [
            {
                find: /^@oncyber\/game-runtime\/browser$/,
                replacement: `${runtime}/browser.ts`,
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
