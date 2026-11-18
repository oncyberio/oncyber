// Saves the avatar lab's contact sheet (one avatar from fixed angles) as a
// PNG, for comparing an authored avatar with its reference picture.
//
//   pnpm dev                                   # in another terminal
//   node frontend/scripts/avatar-lab-shot.mjs tinker out.png
//   node frontend/scripts/avatar-lab-shot.mjs moth out.png "views=0,90&focus=head"
//
// Needs Playwright with a Chromium; it is not one of this repository's
// dependencies (`npm i -g playwright && npx playwright install chromium`).
// It only ever opens the local dev server. The site's bot filter turns
// headless browsers away, so the page is asked for with a desktop browser's
// user agent; that is the one thing this script changes about the request.
import { createRequire } from "node:module";

// `require` also finds a Playwright installed globally (NODE_PATH).
const { chromium } = createRequire(import.meta.url)("playwright");

const [id, out = "avatar-lab.png", extra = ""] = process.argv.slice(2);
if (!id) {
    console.error("usage: avatar-lab-shot.mjs <authored id> [out.png] [query]");
    process.exit(1);
}
const origin = process.env.AVATAR_LAB_ORIGIN || "http://localhost:13000";
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    console.error("This script only opens a local dev server.");
    process.exit(1);
}
const browser = await chromium.launch({
    // Software GL, so it also runs on machines without a GPU.
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
try {
    const page = await browser.newPage({
        viewport: { width: 1600, height: 720 },
        userAgent:
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    });
    page.on("pageerror", (error) => console.error(String(error)));
    await page.goto(
        `${origin}/dev/avatar-lab?renderer=webgl&avatar=${encodeURIComponent(
            id
        )}&${extra}`,
        { waitUntil: "domcontentloaded", timeout: 180000 }
    );
    await page.waitForFunction(
        () =>
            ["ready", "failed"].includes(
                document.documentElement.dataset.avatarLab
            ),
        null,
        { timeout: 180000 }
    );
    const state = await page.evaluate(
        () => document.documentElement.dataset.avatarLab
    );
    if (state !== "ready") throw new Error("The lab failed to draw.");
    await (await page.$("canvas")).screenshot({ path: out });
    console.log(`Saved ${out}`);
} finally {
    await browser.close();
}
