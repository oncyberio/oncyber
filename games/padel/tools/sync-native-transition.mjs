// Bundle the native Oncyber transition into this standalone game without a runtime
// dependency on the frontend checkout. Run again when the shared effect changes.
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";
const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(
  here,
  "../../../../oncyber/web/frontend/features/lobby"
);
await build({
  stdin: {
    contents:
      'export { createWorldCubeReveal } from "./worldCubeReveal.ts"; export { createTravelGlowTexture, sampleTravelGlowAngle } from "./travelGlowTexture.ts";',
    resolveDir: source,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "browser",
  outfile: path.resolve(here, "../src/native-world-reveal.js"),
  banner: {
    js: "// Generated from Oncyber features/lobby/{worldCubeReveal,travelGlowTexture}.ts.\n// Sync with: node worlds/tennis/tools/sync-native-transition.mjs\n// Shared native geometry transition; edit the source, not this bundle.",
  },
});
