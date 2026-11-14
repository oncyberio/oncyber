import { resolve } from "node:path";
import { defineConfig } from "vite";

// The optional avatar kit is TypeScript source in games/kits/avatar; the game
// bundles it and supplies three.js, so there is one copy of each.
const kit = resolve("../kits/avatar");

// Built straight into the frontend's static games folder; /games/ace
// iframes /games/ace/index.html.
export default defineConfig({
    base: "./",
    resolve: {
        alias: [
            {
                find: /^@oncyber\/avatar-kit\/page$/,
                replacement: `${kit}/src/page.ts`,
            },
            {
                find: /^@oncyber\/avatar-kit\/motion\/(.*)$/,
                replacement: `${kit}/motion/$1`,
            },
            {
                find: /^@oncyber\/avatar-kit$/,
                replacement: `${kit}/src/index.ts`,
            },
        ],
        dedupe: ["three", "@pixiv/three-vrm"],
    },
    server: { fs: { allow: [".."] } },
    build: {
        outDir: "../../frontend/public/games/ace",
        emptyOutDir: true,
        assetsInlineLimit: 0,
        chunkSizeWarningLimit: 1200,
    },
});
