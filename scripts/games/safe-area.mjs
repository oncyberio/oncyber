// The safe-area stage of `pnpm games:check` (see docs/games/safe-area.md).
//
// Opens the game under stand-ins for what the Oncyber page floats over it
// (the social controls where the catalog puts them, and the party chat the
// lobby keeps on screen), at a desktop and two phone viewport sizes. For
// each size it measures the overlays, sends the game the same insets the
// real page would (frontend/features/games/safeArea.ts), in the form the
// game greeted in (docs/games/contract.md), asks the game where
// its HUD is (`inspect().hud`, through "oncyber:hud-request") and fails when a
// HUD rectangle shares pixels with an overlay.
//
// A game that never answers is reported as "unreported", which doesn't fail
// the check: it hasn't adopted the safe area yet.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { GAME_MESSAGE_PREFIX } from "../../games/runtime/src/contract.ts";

export const SAFE_AREA_VIEWPORTS = [
    { name: "desktop", width: 1280, height: 720, touch: false },
    { name: "phone", width: 390, height: 844, touch: true },
    { name: "phone-landscape", width: 844, height: 390, touch: true },
];

const css = (style) =>
    Object.entries(style)
        .map(
            ([key, value]) =>
                `${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}:${
                    typeof value === "number" ? `${value}px` : value
                }`
        )
        .join(";");

/**
 * The stand-in page. The overlays copy the placement and box of the real
 * ones: the controls group in GamePage.tsx (with the game's `controlsStyle`
 * from the catalog), LobbyConversationSurface.tsx, collapsed, as it sits
 * over a game a party travelled to, and the Credits button
 * (GameCredits.tsx). Keep them in step with those files.
 */
export function safeAreaHarness(id, controlsStyle) {
    const pill =
        "border:0;border-radius:999px;padding:8px 14px;font:inherit;color:#fff;background:rgba(255,255,255,0.12)";
    return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>safe area</title>
<style>
html,body{margin:0;height:100%;background:#000}
main{position:fixed;inset:0;color:#fff}
iframe{border:0;width:100%;height:100%;display:block}
#party-chat{position:absolute;z-index:21;left:24px;bottom:max(20px,calc(env(safe-area-inset-bottom) + 8px));width:340px;max-width:calc(100% - 32px);font:14px system-ui,sans-serif}
#party-chat button{display:flex;align-items:center;gap:8px;padding:8px 11px;background:#17191ee8;border:1px solid #ffffff15;border-radius:11px;font-size:12px;margin:5px 0;color:inherit}
@media (max-width:850px){#party-chat{left:16px}}
@media (max-width:550px){#party-chat{width:min(280px,calc(100% - 32px))}}
</style>
<main>
<iframe id="game" sandbox="allow-scripts allow-pointer-lock" referrerpolicy="no-referrer" allow="gamepad" src="/games/${id}/index.html"></iframe>
<div data-game-overlay="controls" style="${css({
        position: "absolute",
        ...controlsStyle,
    })};display:flex;align-items:center;gap:8px;padding:6px;border-radius:999px;background:rgba(10,12,18,0.72);font:600 13px/1 Inter,system-ui,sans-serif;white-space:nowrap">
<span style="padding:0 10px;opacity:0.85">8 in your party</span><button style="${pill}">Mic off</button><button style="${pill}">Sound on</button><button style="${pill}">Lobby</button>
</div>
<div id="party-chat" data-game-overlay="party-chat"><button>Your parties</button></div>
<button data-game-overlay="credits" data-game-overlay-edge="bottom" style="position:absolute;right:12px;bottom:10px;border:0;border-radius:999px;padding:6px 10px;font:500 11px/1 Inter,system-ui,sans-serif;color:rgba(255,255,255,0.7);background:rgba(10,12,18,0.45)">Credits</button>
</main>
<script>
const frame = document.getElementById("game");
window.__hud = {};
addEventListener("message", (event) => {
    if (event.source !== frame.contentWindow) return;
    const type = event.data && event.data.type;
    if (typeof type !== "string") return;
    if (type === "oncyber:hud-report") window.__hud[event.data.request] = event.data;
    if (type.endsWith(":hello")) {
        // The game is answered in the form it greeted in: oncyber:game:<kind>
        // from a contract game, <id>:<kind> from a build before it.
        const prefix = (window.__prefix = type.slice(0, -"hello".length));
        frame.contentWindow.postMessage({ type: prefix + "identity", name: "Check", pfp: "", avatarUrl: "", storage: {} }, "*");
        // A contract game waits for its visit: a direct one, alone.
        if (prefix === ${JSON.stringify(GAME_MESSAGE_PREFIX)})
            frame.contentWindow.postMessage({ type: prefix + "enter", arrival: { from: "direct", view: null }, trip: null }, "*");
    }
    if (type.endsWith(":ready")) {
        window.__ready = true;
        frame.contentWindow.postMessage({ type: type.slice(0, -"ready".length) + "entered" }, "*");
    }
    if (type.endsWith(":error")) window.__gameError = String(event.data.message || "error");
});
</script>`;
}

/** Overlay boxes relative to the game frame, as the real page measures them. */
const measure = (page) =>
    page.evaluate(() => {
        const box = document.getElementById("game").getBoundingClientRect();
        const round = (n) => Math.round(n * 10) / 10;
        return {
            width: Math.round(box.width),
            height: Math.round(box.height),
            overlays: [...document.querySelectorAll("[data-game-overlay]")].map(
                (element) => {
                    const rect = element.getBoundingClientRect();
                    const edge = element.getAttribute("data-game-overlay-edge");
                    return {
                        ...(edge ? { edge } : {}),
                        id: element.getAttribute("data-game-overlay"),
                        x: round(rect.left - box.left),
                        y: round(rect.top - box.top),
                        width: round(rect.width),
                        height: round(rect.height),
                    };
                }
            ),
        };
    });

/** Sends the insets, then asks for the HUD until the game answers or `waitMs` passes. */
async function askGame(page, id, area, request, waitMs) {
    const deadline = Date.now() + waitMs;
    for (;;) {
        const report = await page.evaluate(
            ({ id, area, request }) => {
                const target = document.getElementById("game").contentWindow;
                target.postMessage(
                    {
                        type: `${window.__prefix ?? `${id}:`}safe-area`,
                        ...area,
                    },
                    "*"
                );
                target.postMessage(
                    { type: "oncyber:hud-request", request },
                    "*"
                );
                return new Promise((resolve) =>
                    setTimeout(
                        () => resolve(window.__hud[request] ?? null),
                        250
                    )
                );
            },
            { id, area, request }
        );
        if (report || Date.now() > deadline) return report;
    }
}

export async function checkSafeArea({ browser, origin, id, shots }) {
    const { computeSafeInsets, CONTROLS_PLACEMENT } = await import(
        "../../frontend/features/games/safeArea.ts"
    );
    const {
        findHudOverlaps,
        outsideSafeArea,
        readHudRects,
        readSafeInsets,
        sameInsets,
    } = await import("../../games/runtime/src/safe-area.ts");
    const { GAMES } = await import(
        "../../frontend/features/games/catalog.generated.ts"
    );
    const entry = Object.hasOwn(GAMES, id) ? GAMES[id] : null;
    if (entry?.ownPage)
        return {
            status: "skipped",
            reason: "the game has its own page, not the shared one",
            viewports: [],
            findings: [],
        };
    const html = safeAreaHarness(id, {
        ...CONTROLS_PLACEMENT,
        ...entry?.controlsStyle,
    });
    const url = `${origin}/__safe-area`;
    const viewports = [];
    const findings = [];
    let answered = false;
    // One boot per kind of device; the phone is then turned on its side,
    // which is also a resize the game has to follow.
    for (const touch of [false, true]) {
        const sizes = SAFE_AREA_VIEWPORTS.filter((v) => v.touch === touch);
        const context = await browser.newContext({
            viewport: { width: sizes[0].width, height: sizes[0].height },
            hasTouch: touch,
            isMobile: touch,
        });
        try {
            const page = await context.newPage();
            await page.route(url, (route) =>
                route.fulfill({ contentType: "text/html", body: html })
            );
            await page.goto(url);
            const booted = await page
                .waitForFunction(
                    () => window.__ready || window.__gameError,
                    null,
                    { timeout: 120_000 }
                )
                .then(
                    () => page.evaluate(() => !window.__gameError),
                    () => false
                );
            if (!booted) {
                findings.push({
                    code: "SAFE_AREA_BOOT",
                    message: `the game did not get ready under the page's overlays (${sizes[0].name})`,
                });
                continue;
            }
            for (const [index, size] of sizes.entries()) {
                if (index)
                    await page.setViewportSize({
                        width: size.width,
                        height: size.height,
                    });
                // Let the game lay out (and finish entrance animations).
                await page.waitForTimeout(1200);
                const { width, height, overlays } = await measure(page);
                const insets = computeSafeInsets(width, height, overlays);
                // The first question waits for a game that is still wiring up.
                const report = await askGame(
                    page,
                    id,
                    { insets, width, height },
                    `${size.name}-${Date.now()}`,
                    answered || index ? 3000 : 8000
                );
                mkdirSync(shots, { recursive: true });
                await page.screenshot({
                    path: join(shots, `safe-area-${size.name}.png`),
                });
                if (!report) {
                    viewports.push({
                        name: size.name,
                        width,
                        height,
                        insets,
                        overlays,
                        hud: null,
                        overlaps: [],
                        outside: [],
                    });
                    continue;
                }
                answered = true;
                const hud = readHudRects(report.hud);
                const overlaps = findHudOverlaps(hud, overlays);
                const held = readSafeInsets(report.insets);
                viewports.push({
                    name: size.name,
                    width,
                    height,
                    insets,
                    overlays,
                    hud,
                    overlaps,
                    outside: outsideSafeArea(hud, insets, width, height),
                });
                for (const o of overlaps)
                    findings.push({
                        code: "SAFE_AREA_OVERLAP",
                        message: `${size.name} ${width}x${height}: "${o.hud}" is under the page's ${o.overlay} (${o.area} px² shared)`,
                    });
                if (!held || !sameInsets(held, insets))
                    findings.push({
                        code: "SAFE_AREA_IGNORED",
                        message: `${
                            size.name
                        } ${width}x${height}: the game holds insets ${JSON.stringify(
                            held
                        )}, the page sent ${JSON.stringify(insets)}`,
                    });
                if (!hud.length)
                    findings.push({
                        code: "SAFE_AREA_EMPTY",
                        message: `${size.name} ${width}x${height}: inspect().hud lists no rectangles`,
                    });
            }
        } finally {
            await context.close();
        }
    }
    const status = findings.length
        ? "failed"
        : answered
        ? "passed"
        : "unreported";
    return { status, viewports, findings };
}

/** One line per viewport for the console. */
export function describeSafeArea(result) {
    if (!result) return [];
    if (result.status === "skipped")
        return [`safe area: skipped (${result.reason})`];
    if (result.status === "unreported")
        return [
            "safe area: the game doesn't report its HUD (inspect().hud); see docs/games/safe-area.md",
        ];
    return result.viewports.map((v) => {
        const i = v.insets;
        return `safe area ${v.name} ${v.width}x${v.height}: insets ${i.top}/${
            i.right
        }/${i.bottom}/${i.left}, ${v.hud?.length ?? 0} HUD boxes, ${
            v.overlaps.length
        } under an overlay`;
    });
}
