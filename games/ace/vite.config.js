import { resolve } from "node:path";
import { defineConfig } from "vite";

// The runtime (the lifecycle, and the shared party, roster and match-channel
// modules) is TypeScript source in games/runtime; the game bundles what it
// imports.
const runtime = resolve("../runtime/src");
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
                find: /^@oncyber\/game-runtime\/(browser|check|page|party|roster|match|partyLink)$/,
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
                find: /^@oncyber\/game-runtime\/departure$/,
                replacement: `${runtime}/departure.ts`,
            },
            {
                find: /^@oncyber\/game-runtime\/voice$/,
                replacement: `${runtime}/voice.ts`,
            },
            {
                find: /^@oncyber\/game-runtime$/,
                replacement: `${runtime}/index.ts`,
            },
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
