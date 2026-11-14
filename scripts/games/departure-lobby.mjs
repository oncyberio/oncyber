// The real seam for `pnpm games:check <id> --lobby <url>`: travel from a
// running lobby into the game, leave, and record the frames either side of
// the return, one at a time on a stepped clock. Needs the app on the
// development server (games are listed in Explore there) and a lobby server:
//
//   pnpm dev   +   npm --prefix multiplayer run lobby:dev
//   pnpm games:check ace --lobby http://localhost:13000
//
// See docs/games/departure.md.

// The app turns away browsers that announce themselves as automated.
const USER_AGENT =
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const STEP_MS = 1000 / 60;
// Frames are compared without the page's own interface over them.
const HIDE_INTERFACE =
    "button, nextjs-portal, [role=status], [role=dialog] { visibility: hidden !important; }";

/**
 * Returns `{ frames }`: screenshots from the moment the game has answered
 * `departure` the last three frames the game showed and
 * the first three the lobby showed, each `{ png, side: "game" | "lobby",
 * step }`, one animation frame apart. The last "game" frame and the first
 * "lobby" frame are the seam.
 */
export async function recordLobbyTrip({
    browser,
    lobbyUrl,
    id,
    title,
    viewport,
    log = () => {},
}) {
    // A browser of its own, without the check's WebGPU flags: headless
    // Chromium has no adapter, and the lobby's WebGL 2 path draws the same frames.
    const own = await browser
        .browserType()
        .launch({
            channel: process.env.PW_CHANNEL || undefined,
            args: ["--ignore-gpu-blocklist"],
        });
    const context = await own.newContext({ viewport, userAgent: USER_AGENT });
    const page = await context.newPage();
    try {
        await page.clock.install();
        const url = new URL("/", lobbyUrl);
        url.searchParams.set("lobby", "1");
        url.searchParams.set("renderer", "webgl");
        await page.goto(url.href, {
            waitUntil: "domcontentloaded",
            timeout: 180_000,
        });
        const machine = '[data-machine="lobby-journey"]';
        const journey = () =>
            page.evaluate(
                (selector) => ({
                    ...document.querySelector(selector)?.dataset,
                }),
                machine
            );
        await page.waitForSelector(`${machine}[data-ready]`, {
            timeout: 180_000,
        });
        await page.click('button[aria-label="Search worlds"]');
        await page.click(
            `button[aria-label="Enter ${title}"], a[aria-label="Enter ${title}"], button:has-text("Enter ${title}")`,
            { timeout: 60_000 }
        );
        log("travelling to the game");
        await page.waitForSelector(`${machine}[data-state="entered"]`, {
            state: "attached",
            timeout: 240_000,
        });
        const game = () =>
            page
                .frames()
                .find((frame) =>
                    frame.url().includes(`/games/${id}/index.html`)
                );
        if (!game())
            throw new Error("the game's frame is not in the lobby page");
        // Let the arrival finish: the visitor stands up, then can walk.
        await page.waitForTimeout(3000);
        // The page's clock, not this process's: it may have run slow while loading.
        // With room to spare: real time keeps passing until the pause lands.
        await page.clock.pauseAt(
            (await page.evaluate(() => Date.now())) + 5000
        );
        log("leaving");
        await game().evaluate(
            (type) => parent.postMessage({ type }, "*"),
            `${id}:exit`
        );
        // A display paints after the animation frame's callbacks and before
        // later tasks. So each step lets pending messages and commits land,
        // runs one animation frame and captures at once. A capture is only
        // a frame a display would show when the page was on the same side
        // (game or lobby) before the frame ran, after it, and after the
        // capture: the lobby is unhidden by a commit that lands after the
        // frame that drew it, and its canvas is first seen one frame later.
        const side = (now) =>
            now.state === "idle" ||
            (now.state === "returning" && !("returnPreparing" in now))
                ? "lobby"
                : "game";
        const game_ = [],
            lobby = [];
        for (let step = 0; step < 600 && lobby.length < 3; step++) {
            await new Promise((resolve) => setTimeout(resolve, 40));
            const before = side(await journey());
            await page.clock.runFor(STEP_MS);
            if (side(await journey()) !== before) continue;
            const png = await page.screenshot({ style: HIDE_INTERFACE });
            if (side(await journey()) !== before) continue;
            (before === "lobby" ? lobby : game_).push({
                png,
                side: before,
                step,
            });
            if (game_.length > 3) game_.shift();
        }
        const frames = [...game_, ...lobby];
        return { frames };
    } finally {
        await own.close();
    }
}
