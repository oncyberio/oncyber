import { resolve } from "node:path";
import { defineConfig } from "vite";

// Built straight into the frontend's static games folder; /games/ace
// iframes /games/ace/index.html.
export default defineConfig({
    base: "./",
    // Oncyber's optional UI kit for menus (games/kits/ui).
    resolve: { alias: { "@oncyber/game-ui": resolve("../kits/ui") } },
    build: {
        outDir: "../../frontend/public/games/ace",
        emptyOutDir: true,
        assetsInlineLimit: 0,
        chunkSizeWarningLimit: 1200,
    },
});
