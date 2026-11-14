import { resolve } from "node:path";
import { defineConfig } from "vite";

// Built straight into the frontend's static games folder; /games/ace
// iframes /games/ace/index.html.
export default defineConfig({
    base: "./",
    // The locomotion kit is TypeScript source in games/kits; games bundle it.
    resolve: {
        alias: {
            "@oncyber/kit-locomotion": resolve(
                "../kits/locomotion/src/index.ts"
            ),
        },
    },
    build: {
        outDir: "../../frontend/public/games/ace",
        emptyOutDir: true,
        assetsInlineLimit: 0,
        chunkSizeWarningLimit: 1200,
    },
});
