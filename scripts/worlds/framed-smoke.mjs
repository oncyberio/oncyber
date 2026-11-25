#!/usr/bin/env node
// A two-minute check of worlds in a frame against a deployed address, so a
// change can be tried without building anything here: push, let the preview
// build, run this.
//
//   node scripts/worlds/framed-smoke.mjs --base https://<preview-host> [--world /6529sunshine]
//
// It opens a world as a guest and checks, in order: the page frames the
// world from another host; the world cannot reach the page; the visitor
// can enter (the dock appears); searching for another world travels there,
// framed; Back returns. It prints one line per step and exits 1 on the
// first that fails.
//
// Needs Playwright with a Chromium (`npx playwright install chromium`).
// PLAYWRIGHT_FROM=<a folder that has it> if it is not installed here.
// Without a GPU the browser draws in software: slower, and enough for this.

import { createRequire } from "node:module";

const args = process.argv.slice(2);
const option = (name, fallback) => {
    const at = args.indexOf(`--${name}`);
    return at >= 0 && args[at + 1] ? args[at + 1] : fallback;
};
const base = option("base", "").replace(/\/$/, "");
const start = option("world", "/6529sunshine");
if (!/^https?:\/\//.test(base)) {
    console.error("usage: framed-smoke.mjs --base <address> [--world /path]");
    process.exit(2);
}

let chromium;
try {
    ({ chromium } = createRequire(
        process.env.PLAYWRIGHT_FROM || import.meta.url
    )("playwright"));
} catch {
    console.error("Playwright not found: npm i -D playwright, then try again.");
    process.exit(2);
}

const browser = await chromium.launch({
    args: [
        "--use-angle=swiftshader",
        "--ignore-gpu-blocklist",
        "--enable-unsafe-swiftshader",
        "--site-per-process",
    ],
});
const page = await (
    await browser.newContext({
        viewport: { width: 1280, height: 760 },
        // A plain browser: the site turns automated clients away.
        userAgent:
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
    })
).newPage();

const siteHost = new URL(base).host;
/** The world's frame: a frame of this page served from another host. */
const worldFrame = () =>
    page
        .frames()
        .find(
            (frame) =>
                frame !== page.mainFrame() &&
                frame.parentFrame() === page.mainFrame() &&
                /^https?:/.test(frame.url()) &&
                new URL(frame.url()).host !== siteHost &&
                new URL(frame.url()).pathname !== "/world-warmup"
        );
const dock = () =>
    page.evaluate(() =>
        [...document.querySelectorAll("[data-experience-action]")].map(
            (element) => element.dataset.experienceAction
        )
    );
const until = async (test, seconds) => {
    const end = Date.now() + seconds * 1000;
    while (Date.now() < end) {
        const value = await Promise.resolve()
            .then(test)
            .catch(() => null);
        if (value) return value;
        await page.waitForTimeout(1500);
    }
    return null;
};
const step = async (name, test) => {
    const began = Date.now();
    const value = await test();
    const took = `${Math.round((Date.now() - began) / 1000)}s`;
    if (!value) {
        console.log(`FAILED  ${name} (${took})`);
        await browser.close();
        process.exit(1);
    }
    console.log(`ok      ${name} (${took})`);
    return value;
};
/** The entry control follows the pointer: move, let it follow, click. */
const enter = () =>
    until(async () => {
        if ((await dock()).length) return true;
        await page.mouse.move(640, 400);
        await page.waitForTimeout(2500);
        await page.mouse.click(644, 404);
        await page.waitForTimeout(3000);
        await worldFrame()?.evaluate(() => document.exitPointerLock?.());
        return (await dock()).length > 0;
    }, 90);

await page.goto(`${base}${start}?renderer=webgl`, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
});
await step("the page frames the world from another host", () =>
    until(() => worldFrame(), 60)
);
await step("the world cannot reach the page", () =>
    worldFrame().evaluate(() => {
        try {
            return !window.top.document;
        } catch {
            return true;
        }
    })
);
await step("the visitor can enter", enter);
await step("search lists other worlds", async () => {
    await page.evaluate(() =>
        document
            .querySelector('[data-experience-action="search"] button')
            ?.click()
    );
    return until(
        () =>
            worldFrame().evaluate(
                () =>
                    document.querySelectorAll("#lobby-explore a[href]").length >
                    1
            ),
        30
    );
});
const before = new URL(page.url()).pathname;
await step("picking one travels there, framed", async () => {
    await worldFrame().evaluate((here) => {
        const link = [
            ...document.querySelectorAll("#lobby-explore a[href]"),
        ].find(
            (element) =>
                element.offsetParent !== null &&
                element.getAttribute("href").startsWith("/") &&
                element.getAttribute("href") !== here
        );
        link?.click();
    }, before);
    return until(
        async () => new URL(page.url()).pathname !== before && worldFrame(),
        60
    );
});
await step("the visitor can enter the second world", enter);
await step("Back returns to the first world, framed", async () => {
    await page.goBack({ waitUntil: "domcontentloaded" });
    return until(
        async () => new URL(page.url()).pathname === before && worldFrame(),
        60
    );
});
console.log("worlds in a frame: all steps passed");
await browser.close();
