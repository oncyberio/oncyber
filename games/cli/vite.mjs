// The Vite settings of an Oncyber game:
//
//   // vite.config.js
//   import { oncyberGame } from "oncyber/vite";
//   export default oncyberGame();
//
// It maps the SDK's names (@oncyber/game-runtime/*, @oncyber/avatar-kit,
// @oncyber/kit-locomotion, @oncyber/game-ui) to the source this package
// carries, which the game bundles, and builds to ./dist with relative URLs
// so the build runs from any release address. Pass your own Vite settings
// to add to these: oncyberGame({ plugins: [...] }).
import { SDK } from "./lib/paths.mjs";

const runtime = `${SDK}/games/runtime/src`;
const kits = `${SDK}/games/kits`;

/** The SDK's import names, as Vite aliases. */
export const sdkAliases = () => [
    // Three modules whose file is not named as they are imported.
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
    { find: /^@oncyber\/game-runtime$/, replacement: `${runtime}/index.ts` },
    {
        find: /^@oncyber\/kit-locomotion$/,
        replacement: `${kits}/locomotion/src/index.ts`,
    },
    { find: /^@oncyber\/game-ui\/(.*)$/, replacement: `${kits}/ui/$1` },
    { find: /^@oncyber\/game-ui$/, replacement: `${kits}/ui/src/index.ts` },
    {
        find: /^@oncyber\/avatar-kit\/page$/,
        replacement: `${kits}/avatar/src/page.ts`,
    },
    {
        find: /^@oncyber\/avatar-kit\/motion\/(.*)$/,
        replacement: `${kits}/avatar/motion/$1`,
    },
    {
        find: /^@oncyber\/avatar-kit$/,
        replacement: `${kits}/avatar/src/index.ts`,
    },
];

const plain = (value) =>
    value !== null &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype;

/** `extra` over `base`: objects merge, lists join, anything else replaces. */
function merge(base, extra) {
    const merged = { ...base };
    for (const [key, value] of Object.entries(extra ?? {})) {
        const before = merged[key];
        merged[key] =
            Array.isArray(before) && Array.isArray(value)
                ? [...before, ...value]
                : plain(before) && plain(value)
                ? merge(before, value)
                : value;
    }
    return merged;
}

/** A game's Vite config. `extra` is added to it. */
export function oncyberGame(extra = {}) {
    const { alias, ...resolveExtra } = extra.resolve ?? {};
    // The game's own aliases first, in either of Vite's two forms.
    const own = Array.isArray(alias)
        ? alias
        : Object.entries(alias ?? {}).map(([find, replacement]) => ({
              find,
              replacement,
          }));
    return merge(
        {
            // Relative URLs: a release is loaded from an address of its own.
            base: "./",
            resolve: {
                alias: [...own, ...sdkAliases()],
                // The kits import three from the game's own node_modules.
                dedupe: ["three", "@pixiv/three-vrm"],
            },
            server: { fs: { allow: [process.cwd(), SDK] } },
            // The SDK is source the game bundles, not a dependency to
            // pre-bundle: an installed package sits under node_modules,
            // where the dev server would otherwise take it for one.
            optimizeDeps: {
                exclude: [
                    "@oncyber/game-runtime",
                    "@oncyber/avatar-kit",
                    "@oncyber/kit-locomotion",
                    "@oncyber/game-ui",
                ],
            },
            build: {
                outDir: "dist",
                emptyOutDir: true,
                assetsInlineLimit: 0,
                chunkSizeWarningLimit: 1400,
            },
        },
        { ...extra, resolve: resolveExtra }
    );
}

export default oncyberGame;
