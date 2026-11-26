// The sound stage against small fixture games in headless Chromium:
//   node --test scripts/games/sound-check.test.mjs
// Every test here needs the browser: without Playwright they are skipped on
// a person's machine and fail in CI (test/browser.mjs).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { stripTypeScriptTypes } from "node:module";
import { dirname, resolve } from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";
import { soundHarness, soundStage } from "./sound-check.mjs";
import { browserForTests } from "./test/browser.mjs";

const { chromium, skip } = browserForTests();

const sdk = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../games/runtime/src"
);
// A game that hums. `wiring` decides where the hum goes.
const game = (wiring) => `<!doctype html><script type="module">
import { connectGameAudio } from "/sdk/audio-browser.ts";
const audio = connectGameAudio("fixture");
const context = audio.context, hum = context.createOscillator(), level = context.createGain();
level.gain.value = 0.2;
hum.connect(level);
${wiring}
hum.start();
</script>`;
const GAMES = {
    routed: game("level.connect(audio.output);"),
    around: game("level.connect(context.destination);"),
    both: game(
        "level.connect(audio.output); level.connect(context.destination);"
    ),
    // Its own context and its own mute: the page can't reach it.
    private: `<!doctype html><script>const context = new AudioContext(), hum = context.createOscillator();
hum.connect(context.destination); hum.start(); addEventListener("pointerdown", () => context.resume());</script>`,
};
const page = (
    name,
    allow
) => `<!doctype html><iframe id="game" sandbox="allow-scripts" allow="${allow}" src="/game/${name}"></iframe>
<script>const frame = document.getElementById("game");</script>${soundHarness(
    "fixture"
)}`;

let server, browser, origin;
before(async () => {
    server = createServer((req, res) => {
        const url = new URL(req.url, "http://localhost");
        const [, kind, name] = url.pathname.split("/");
        const send = (type, body) =>
            res
                .writeHead(200, {
                    "content-type": type,
                    "access-control-allow-origin": "*",
                })
                .end(body);
        if (kind === "page")
            return send(
                "text/html",
                page(name, url.searchParams.get("allow") ?? "autoplay")
            );
        if (kind === "game" && GAMES[name])
            return send("text/html", GAMES[name]);
        if (kind === "sdk" && /^[a-z-]+\.ts$/.test(name))
            return send(
                "text/javascript",
                stripTypeScriptTypes(readFileSync(resolve(sdk, name), "utf8"))
            );
        res.writeHead(404).end();
    });
    await new Promise((done) => server.listen(0, "127.0.0.1", done));
    origin = `http://127.0.0.1:${server.address().port}`;
    if (!skip) browser = await chromium.launch();
});
after(async () => {
    await browser?.close();
    server?.close();
});

async function run(name, { required = false, allow } = {}) {
    const tab = await browser.newPage();
    try {
        await tab.goto(
            `${origin}/page/${name}${
                allow === undefined ? "" : `?allow=${allow}`
            }`
        );
        await tab.waitForTimeout(300);
        const report = { status: "passed", stages: [] };
        await soundStage(tab, report, { required });
        return { report: report.status, ...report.stages[0] };
    } finally {
        await tab.close();
    }
}

test("a game routed through the SDK output passes", { skip }, async () => {
    const stage = await run("routed", { required: true });
    assert.equal(stage.status, "passed", stage.error);
    assert.equal(stage.facts.audioBypass, 0);
});
test("sound that goes around the output fails", { skip }, async () => {
    assert.match((await run("around")).error, /^SOUND_NOT_ROUTED/);
    const both = await run("both");
    assert.deepEqual([both.report, both.status], ["failed", "failed"]);
    assert.match(both.error, /^SOUND_BYPASS/);
});
test(
    "a game with no SDK output is skipped, or fails when it declares audio",
    { skip },
    async () => {
        const skipped = await run("private");
        assert.deepEqual(
            [skipped.report, skipped.status],
            ["passed", "skipped"]
        );
        assert.match(skipped.error, /no SDK sound output/);
        assert.match(
            (await run("private", { required: true })).error,
            /^SOUND_NOT_CONNECTED/
        );
    }
);
test(
    "the page's gesture only reaches a frame that is allowed to autoplay",
    { skip },
    async () => {
        assert.match(
            (await run("routed", { allow: "" })).error,
            /^SOUND_LOCKED/
        );
    }
);
