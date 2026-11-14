import { defineConfig } from "vite";

// Built straight into the frontend's static games folder; /games/padel
// iframes /games/padel/index.html.
export default defineConfig({
  base: "./",
  resolve: { dedupe: ["three", "@pixiv/three-vrm"] },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1800,
    outDir: "../../frontend/public/games/padel",
    emptyOutDir: true,
  },
});
