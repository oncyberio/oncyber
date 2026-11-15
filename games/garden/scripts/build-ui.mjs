// Bundle the UI page into a single self-contained ui.html (script and styles
// inline), for its sandboxed frame or a native WebView.
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const runtime = resolve(root, "../runtime/src");
const out = resolve(root, "../../frontend/public/games/garden/ui.html");
const result = await build({
    entryPoints: [resolve(root, "src/ui/main.js")],
    bundle: true,
    format: "esm",
    target: "es2020",
    minify: true,
    write: false,
    outdir: "out",
    alias: {
        "@oncyber/game-runtime/browser": `${runtime}/browser.ts`,
        "@oncyber/game-runtime/keys-browser": `${runtime}/keysBrowser.ts`,
    },
});
const js = result.outputFiles.find((f) => f.path.endsWith(".js")).text;
const css = result.outputFiles.find((f) => f.path.endsWith(".css"))?.text || "";
let html = readFileSync(resolve(root, "ui.html"), "utf8");
html = html.replace("</head>", () => `<style>${css}</style></head>`);
html = html.replace(/<script type="module" src="[^"]*"><\/script>/, () => `<script type="module">${js.replace(/<\/script/g, "<\\/script")}</script>`);
writeFileSync(out, html);
console.log(`ui.html ${(html.length / 1024).toFixed(0)} KiB`);
