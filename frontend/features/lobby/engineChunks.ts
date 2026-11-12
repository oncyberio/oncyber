/**
 * The world engine's production files, for the lobby to prefetch while it is
 * idle (docs/plans/lobby-world-shell.md, step 1).
 *
 * Server-only: `pages/_document.tsx` reads Next's own manifests from the build
 * folder and writes the list into the lobby's HTML as JSON. The browser side
 * is `enginePrefetch.ts`. Nothing here runs in the browser.
 *
 * The list is every file a trip's destination frame downloads beyond what the
 * lobby page already loaded: the engine's three lazy chunk groups (the gate's
 * DisplayScene, the renderer, the world) and the world pages' own scripts.
 */
import fs from "fs";
import path from "path";
import { ENGINE_CHUNKS_ELEMENT_ID } from "./enginePrefetch";

export { ENGINE_CHUNKS_ELEMENT_ID };

/** The `import()` calls that load the engine, as Next's
 * `react-loadable-manifest.json` names them (`<file> -> <request>`, the file
 * relative to `pages/`). Matched by ending, so the prefix may change. */
export const ENGINE_IMPORTS = [
    "components/_3DExhibit-v2/displyUI/Exhibit3DGate.tsx -> ./DisplayScene",
    "components/_3DExhibit-v2/three/api.js -> @3renderer",
    "components/_3DExhibit-v2/three/states.js -> ./world3D.js",
    "components/_3DExhibit-v2/three/states.js -> ./events/mediator.js",
];

/** The routes a lobby trip opens in its frame (lobbyJourneyProtocol). */
export const WORLD_ROUTES = ["/[slug]", "/spaces/[id]", "/mints/[slug]"];

/** The pages that host the lobby, where `_document` writes the list. */
export const LOBBY_PAGES = ["/", "/landing-carousel"];

type LoadableManifest = Record<string, { files?: unknown }>;
type BuildManifest = {
    pages?: Record<string, unknown>;
    polyfillFiles?: unknown;
};

const files = (value: unknown): string[] =>
    Array.isArray(value)
        ? value.filter((file): file is string => typeof file === "string")
        : [];

/**
 * The engine's files that `page` does not load itself, as URLs. Only built
 * scripts and stylesheets under `static/`; anything else is left out.
 */
export function listEngineChunks(
    loadable: LoadableManifest,
    build: BuildManifest,
    page: string,
    assetPrefix = ""
): string[] {
    const pages = build?.pages || {};
    const loaded = new Set([
        ...files(build?.polyfillFiles),
        ...files(pages["/_app"]),
        ...files(pages[page]),
    ]);
    const wanted = new Set<string>();
    const keys = Object.keys(loadable || {});
    for (const engineImport of ENGINE_IMPORTS) {
        for (const key of keys) {
            if (key === engineImport || key.endsWith(`/${engineImport}`))
                files(loadable[key]?.files).forEach((file) => wanted.add(file));
        }
    }
    for (const route of WORLD_ROUTES)
        files(pages[route]).forEach((file) => wanted.add(file));
    return Array.from(wanted)
        .filter(
            (file) => !loaded.has(file) && /^static\/.+\.(?:js|css)$/.test(file)
        )
        .map((file) => `${assetPrefix || ""}/_next/${encodeURI(file)}`);
}

let cached: { distDir: string; loadable: LoadableManifest } | null = null;

/**
 * The list for a lobby page, or null: outside production, on other pages,
 * or when the manifest cannot be read (the lobby then prefetches nothing).
 */
export function readEngineChunks(
    page: string,
    build: BuildManifest,
    assetPrefix?: string
): string[] | null {
    if (process.env.NODE_ENV !== "production") return null;
    if (!LOBBY_PAGES.includes(page)) return null;
    try {
        const distDir = path.join(
            process.cwd(),
            process.env.NEXT_DIST_DIR || ".next"
        );
        if (cached?.distDir !== distDir)
            cached = {
                distDir,
                loadable: JSON.parse(
                    fs.readFileSync(
                        path.join(distDir, "react-loadable-manifest.json"),
                        "utf8"
                    )
                ),
            };
        const list = listEngineChunks(
            cached.loadable,
            build,
            page,
            assetPrefix
        );
        return list.length ? list : null;
    } catch {
        return null;
    }
}

/** JSON that is safe inside a `<script>` element. */
export function serializeEngineChunks(list: string[]) {
    return JSON.stringify(list).replace(/</g, "\\u003c");
}
