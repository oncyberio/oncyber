// The Vite settings a game gets from `oncyber/vite`: every SDK name a game
// imports is mapped to a file that exists.
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { oncyberGame, sdkAliases } from "../vite.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function mapped(name) {
    for (const { find, replacement } of sdkAliases())
        if (find.test(name)) return name.replace(find, replacement);
    return null;
}

test("every SDK import of the starter's source resolves", () => {
    const source = join(repo, "games/lantern-tag/src");
    const names = new Set(
        readdirSync(source).flatMap((file) =>
            [
                ...readFileSync(join(source, file), "utf8").matchAll(
                    /["'](@oncyber\/[^"']+)["']/g
                ),
            ].map((match) => match[1])
        )
    );
    assert.ok(names.size >= 15);
    for (const name of names) {
        const path = mapped(name);
        assert.ok(path && existsSync(path), `${name} -> ${path}`);
    }
});

test("the names whose file is spelled differently, and the kits", () => {
    for (const [name, file] of [
        ["@oncyber/game-runtime", "games/runtime/src/index.ts"],
        [
            "@oncyber/game-runtime/keys-browser",
            "games/runtime/src/keysBrowser.ts",
        ],
        [
            "@oncyber/game-runtime/device-controls",
            "games/runtime/src/deviceControls.ts",
        ],
        [
            "@oncyber/game-runtime/device-check",
            "games/runtime/src/deviceCheck.ts",
        ],
        ["@oncyber/game-runtime/page", "games/runtime/src/page.ts"],
        ["@oncyber/avatar-kit", "games/kits/avatar/src/index.ts"],
        ["@oncyber/avatar-kit/page", "games/kits/avatar/src/page.ts"],
        ["@oncyber/kit-locomotion", "games/kits/locomotion/src/index.ts"],
        ["@oncyber/game-ui", "games/kits/ui/src/index.ts"],
        ["@oncyber/game-ui/oncyber-ui.css", "games/kits/ui/oncyber-ui.css"],
    ])
        assert.equal(mapped(name), join(repo, file), name);
    assert.equal(mapped("three"), null);
});

test("a game's config: relative URLs, ./dist, and the game's own settings added", () => {
    const config = oncyberGame();
    assert.equal(config.base, "./");
    assert.equal(config.build.outDir, "dist");
    assert.equal(config.build.assetsInlineLimit, 0);
    assert.deepEqual(config.resolve.dedupe, ["three", "@pixiv/three-vrm"]);
    // The SDK is bundled as source, never pre-bundled as a dependency.
    assert.ok(config.optimizeDeps.exclude.includes("@oncyber/game-runtime"));
    const plugin = { name: "mine" };
    const own = oncyberGame({
        plugins: [plugin],
        resolve: { alias: { "@": "/src" }, dedupe: ["lil-gui"] },
        build: { sourcemap: true },
        server: { port: 5000 },
    });
    assert.deepEqual(own.plugins, [plugin]);
    assert.deepEqual(own.resolve.alias[0], { find: "@", replacement: "/src" });
    assert.equal(own.resolve.alias.length, sdkAliases().length + 1);
    assert.deepEqual(own.resolve.dedupe, [
        "three",
        "@pixiv/three-vrm",
        "lil-gui",
    ]);
    assert.equal(own.build.outDir, "dist");
    assert.equal(own.build.sourcemap, true);
    assert.equal(own.server.port, 5000);
    assert.ok(own.server.fs.allow.length >= 2);
});
