import { resolve } from "node:path";
import { defineConfig } from "vite";

// The runtime (the lifecycle, the shared party, roster and match-channel
// modules, the loading and pausing helpers, and the on-screen controls and
// gamepad mapping built from game.json) is TypeScript source in games/runtime; the game bundles what
// it imports.
const runtime = resolve("../runtime/src");
// The optional avatar kit is TypeScript source in games/kits/avatar; the game
// bundles it and supplies three.js, so there is one copy of each.
const kit = resolve("../kits/avatar");

// Built into the frontend's static folder for game builds; the page at
// /games/padel frames /game-builds/padel/index.html.
export default defineConfig({
  base: "./",
  resolve: {
    alias: [
      {
        find: /^@oncyber\/game-runtime\/(browser|check|page|party|roster|match|partyLink|results|loading|pausing|saved|arrival|bot|health)$/,
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
        find: /^@oncyber\/game-runtime\/audio-browser$/,
        replacement: `${runtime}/audio-browser.ts`,
      },
      {
        find: /^@oncyber\/game-runtime\/voice$/,
        replacement: `${runtime}/voice.ts`,
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
        find: /^@oncyber\/game-runtime$/,
        replacement: `${runtime}/index.ts`,
      },
      // The locomotion kit is TypeScript source in games/kits too.
      {
        find: /^@oncyber\/kit-locomotion$/,
        replacement: resolve("../kits/locomotion/src/index.ts"),
      },
      // Oncyber's optional UI kit for menus (games/kits/ui).
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
    target: "es2022",
    outDir: "../../frontend/public/game-builds/padel",
    emptyOutDir: true,
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1800,
  },
});
