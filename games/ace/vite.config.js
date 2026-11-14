import { resolve } from "node:path";
import { defineConfig } from "vite";

// Built straight into the frontend's static games folder; /games/ace
// iframes /games/ace/index.html.
export default defineConfig({
    base: "./",
    // The Oncyber game runtime is TypeScript source in games/runtime.
    resolve: {
        alias: [
            {
                find: /^@oncyber\/game-runtime\/(.+)$/,
                replacement: `${resolve("../runtime/src")}/$1.ts`,
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
