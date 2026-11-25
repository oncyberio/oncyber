// node --test scripts/games/keysCheck.test.mjs
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire, stripTypeScriptTypes } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
    keysBrowserCheck,
    keysScan,
    scanText,
    stripComments,
} from "./keysCheck.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const codes = (findings) => findings.map((f) => f.code);

test("flags raw key listeners however they are attached", () => {
    assert.deepEqual(
        codes(scanText(`window.addEventListener("keydown", f);`)),
        ["RAW_KEY_LISTENER"]
    );
    assert.deepEqual(codes(scanText(`el.addEventListener( 'keyup' , f)`)), [
        "RAW_KEY_LISTENER",
    ]);
    assert.deepEqual(codes(scanText("on(window, `keypress`, f)")), [
        "RAW_KEY_LISTENER",
    ]);
    assert.deepEqual(codes(scanText(`document.onkeydown = f`)), [
        "RAW_KEY_LISTENER",
    ]);
    assert.deepEqual(codes(scanText(`<body onkeyup="go()">`)), [
        "RAW_KEY_LISTENER",
    ]);
    assert.deepEqual(
        codes(scanText(`for (const t of ["keydown", "keyup"]) add(t)`)),
        ["RAW_KEY_LISTENER", "RAW_KEY_LISTENER"]
    );
    assert.deepEqual(codes(scanText(`canvas.requestPointerLock();`)), [
        "RAW_POINTER_LOCK",
    ]);
    assert.deepEqual(
        codes(scanText(`await navigator.keyboard.lock(["Escape"])`)),
        ["RAW_KEYBOARD_LOCK"]
    );
});

test("reports the file and line, and leaves comments and other events alone", () => {
    const text = `// no "keydown" listeners here\n/* window.addEventListener("keyup") */\nconst url = "https://x/keydown";\nwindow.addEventListener("pointerdown", f);\nwindow.addEventListener("keydown", g);\n<!-- onkeydown -->`;
    const findings = scanText(text, "src/input.js");
    assert.equal(findings.length, 1);
    assert.equal(findings[0].line, 5);
    assert.match(findings[0].message, /^src\/input\.js:5 /);
    assert.equal(
        stripComments(text).split("\n").length,
        text.split("\n").length
    );
    assert.deepEqual(
        scanText(`keys.lockPointer(canvas); const keydown = 1; input.keyboard`),
        []
    );
});

test("Ace and Garden take keys only as declared actions", async () => {
    for (const id of ["ace", "garden"]) {
        const manifest = JSON.parse(
            readFileSync(join(root, "games", id, "game.json"), "utf8")
        );
        const scan = await keysScan({ id, manifest });
        assert.deepEqual(scan.findings, [], id);
        assert.equal(scan.legacy, false);
    }
});

test("reserved bindings in game.json are findings; a legacy game's are warnings", async () => {
    const source = join(here, "fixtures");
    const bad = { input: { pause: { keyboard: ["Escape"] } } };
    const reserved = (list) =>
        codes(list).filter((code) => code.startsWith("KEY_"));
    assert.deepEqual(
        reserved(
            (await keysScan({ id: "fixture", manifest: bad, source })).findings
        ),
        ["KEY_RESERVED"]
    );
    const legacy = await keysScan({
        id: "fixture",
        manifest: { ...bad, keysCheck: { legacy: true } },
        source,
    });
    assert.deepEqual(
        [legacy.findings, reserved(legacy.warnings)],
        [[], ["KEY_RESERVED"]]
    );
});

// The browser half against a tiny game: once following the rule, once breaking it.
let chromium;
try {
    ({ chromium } = createRequire(import.meta.url)("playwright"));
} catch {
    /* no Playwright here: the browser tests are skipped */
}
const manifest = {
    input: {
        right: { keyboard: ["KeyD"] },
        hit: { keyboard: ["Space", "KeyJ"] },
    },
    keysCheck: { move: "KeyD" },
};

async function withFixture(query, run) {
    const files = {
        "/games/fixture/index.html": [
            "text/html",
            readFileSync(join(here, "fixtures/keys-game.html"), "utf8").replace(
                "location.search",
                JSON.stringify(query)
            ),
        ],
        "/games/fixture/keysBrowser.ts": [
            "text/javascript",
            stripTypeScriptTypes(
                readFileSync(
                    join(root, "games/runtime/src/keysBrowser.ts"),
                    "utf8"
                )
            ),
        ],
        "/games/fixture/keys.ts": [
            "text/javascript",
            stripTypeScriptTypes(
                readFileSync(join(root, "games/runtime/src/keys.ts"), "utf8")
            ),
        ],
    };
    const server = createServer((req, res) => {
        const file = files[new URL(req.url, "http://x").pathname];
        res.writeHead(file ? 200 : 404, {
            "content-type": file?.[0] ?? "text/plain",
            "access-control-allow-origin": "*",
        });
        res.end(file?.[1] ?? "");
    });
    await new Promise((done) => server.listen(0, "127.0.0.1", done));
    const browser = await chromium.launch({
        channel: process.env.PW_CHANNEL || undefined,
    });
    try {
        return await run(browser, `http://127.0.0.1:${server.address().port}`);
    } finally {
        await browser.close();
        server.close();
    }
}

test("browser: a game on the binder passes", { skip: !chromium }, async () => {
    const result = await withFixture("", (browser, origin) =>
        keysBrowserCheck({
            browser,
            origin,
            id: "fixture",
            manifest,
            timeoutMs: 20_000,
        })
    );
    assert.deepEqual(result.findings, []);
    assert.deepEqual(
        result.steps.map((s) => [s.step, s.delivered > 0, s.moved]),
        [
            ["play", true, true],
            ["typing", false, false],
            ["menu", false, false],
            ["resumed", true, true],
        ]
    );
});

test(
    "browser: a raw key listener is caught moving the player while the visitor types",
    { skip: !chromium },
    async () => {
        const result = await withFixture("?leak", (browser, origin) =>
            keysBrowserCheck({
                browser,
                origin,
                id: "fixture",
                manifest,
                timeoutMs: 20_000,
            })
        );
        assert.ok(
            codes(result.findings).includes("KEYS_MOVED_WHILE_TYPING"),
            JSON.stringify(result.findings)
        );
        assert.ok(
            codes(result.findings).includes("KEYS_MOVED_IN_MENU"),
            JSON.stringify(result.findings)
        );
    }
);

test(
    "browser: the pointer lock goes to the page on pause and comes back on the next click",
    { skip: !chromium },
    async () => {
        await withFixture("?lock", async (browser, origin) => {
            const { harnessPage } = await import("./keysCheck.mjs");
            const page = await browser.newPage({
                viewport: { width: 640, height: 360 },
            });
            await harnessPage(page, "fixture");
            await page.goto(`${origin}/__keys`);
            await page.waitForFunction(() => window.__keys.ready);
            const state = async () => ({
                ...(await page.evaluate(() => window.__probe())),
                page: await page.evaluate(() => ({
                    menu: window.__keys.menu,
                    paused: window.__host.paused,
                    active: document.activeElement.id,
                })),
            });
            await page.mouse.click(320, 100);
            await page.waitForTimeout(300);
            if (!(await state()).locked)
                return test.skip?.("this browser grants no pointer lock");
            // The page's chat takes focus: the game lets go of the cursor.
            await page.focus("#chat");
            await page.waitForTimeout(300);
            let s = await state();
            assert.deepEqual(
                [s.locked, s.paused, s.page.active],
                [false, true, "chat"]
            );
            // The lock was the game's to give: the page's menu did not open.
            assert.equal(s.page.menu, false);
            await page.keyboard.press("Escape");
            await page.waitForTimeout(300);
            s = await state();
            assert.deepEqual([s.locked, s.paused], [false, false]);
            // Back on the visitor's next click, with no call from the game.
            await page.mouse.click(320, 100);
            await page.waitForTimeout(300);
            assert.equal((await state()).locked, true);
            await page.close();
        });
    }
);
