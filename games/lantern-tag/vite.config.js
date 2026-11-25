import { resolve } from "node:path";
import { defineConfig } from "vite";

// The lifecycle runtime and the kits are TypeScript source in games/runtime
// and games/kits; the game bundles what it imports. Built straight into the
// frontend's static games folder: /games/lantern-tag frames its index.html.
const runtime = resolve("../runtime/src");
const avatarKit = resolve("../kits/avatar");
export default defineConfig({
    base: "./",
    resolve: {
        alias: [
            {
                find: /^@oncyber\/game-runtime\/keys-browser$/,
                replacement: `${runtime}/keysBrowser.ts`,
            },
            {
                find: /^@oncyber\/game-runtime\/device-controls$/,
                replacement: `${runtime}/deviceControls.ts`,
            },
            {
                find: /^@oncyber\/game-runtime\/device-check$/,
                replacement: `${runtime}/deviceCheck.ts`,
            },
            {
                find: /^@oncyber\/game-runtime\/(.+)$/,
                replacement: `${runtime}/$1.ts`,
            },
            {
                find: /^@oncyber\/game-runtime$/,
                replacement: `${runtime}/index.ts`,
            },
            {
                find: /^@oncyber\/kit-locomotion$/,
                replacement: resolve("../kits/locomotion/src/index.ts"),
            },
            {
                find: /^@oncyber\/game-ui\/(.*)$/,
                replacement: `${resolve("../kits/ui")}/$1`,
            },
            {
                find: /^@oncyber\/game-ui$/,
                replacement: resolve("../kits/ui/src/index.ts"),
            },
            {
                find: /^@oncyber\/avatar-kit\/page$/,
                replacement: `${avatarKit}/src/page.ts`,
            },
            {
                find: /^@oncyber\/avatar-kit\/motion\/(.*)$/,
                replacement: `${avatarKit}/motion/$1`,
            },
            {
                find: /^@oncyber\/avatar-kit$/,
                replacement: `${avatarKit}/src/index.ts`,
            },
        ],
        dedupe: ["three", "@pixiv/three-vrm"],
    },
    server: { fs: { allow: ["..", "../../frontend/features/lobby"] } },
    build: {
        outDir: "../../frontend/public/games/lantern-tag",
        emptyOutDir: true,
        assetsInlineLimit: 0,
        chunkSizeWarningLimit: 1400,
    },
});
