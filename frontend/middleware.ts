import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Bot blocking at the edge.
//
// Runs before getServerSideProps, so a blocked request costs ~0 Firestore
// reads. ~78% of pageviews are bots (PostHog), dominated by the Sogou web
// spider enumerating /art-blocks — each hit drives exhibit-SSR reads
// (exhibits.customLink, exhibits/*/kitbash, exhibits/*/portals, users.walletId).
//
// Classification uses explicit bot names + safe generic crawler tokens
// (spider|crawl|slurp|scraper|scrapy|headless) — deliberately NOT bare "bot",
// so device names like "Cubot" and real Yandex/Baidu *app* users don't match.
// ---------------------------------------------------------------------------

// Abusive crawlers / SEO scrapers with no value to oncyber — blocked on EVERY
// route (pages + /api + exhibits). This is the main Firestore-read driver.
// NOTE: every token here is either a full crawler name or a string a real
// browser can never emit. "sogou (web|inst) spider" (NOT bare "sogou", which
// would hit real Sogou Browser users); no "bytedance" (would hit real TikTok
// in-app users via "BytedanceWebview" — we keep only the "bytespider" crawler).
const NAMED_SCRAPER =
    /(sogou (web|inst) spider|baiduspider|yandexbot|ahrefsbot|semrushbot|mj12bot|dotbot|petalbot|bytespider|dataforseobot|blexbot|barkrowler|megaindex|serpstatbot|seznambot|zoominfobot|mojeekbot|magpie-crawler|diffbot|imagesiftbot|sitecheckerbot|semanticscholarbot|webzio|domcop|linkdexbot|aspiegelbot)/i;

// Generic automation / scraping tools — blocked on PAGES but allowed on /api so
// legitimate server-to-server / webhook callers (Stripe, Privy, the multiplayer
// server, our own SSR fetches with axios/node-fetch UAs) don't break.
// Library/runtime tokens a real browser never sends (browsers forbid scripts
// from setting User-Agent). Dropped okhttp/java/httpclient — too generic, can be
// legit Android/JVM app traffic. axios/node-fetch only appear server-side
// (in-browser axios uses the real browser UA).
const TOOL =
    /(curl\/|wget\/|python-requests|python-urllib|aiohttp|httpx|scrapy|go-http-client|libwww|node-fetch|axios\/|headlesschrome|phantomjs|puppeteer|playwright|selenium|masscan|zgrab)/i;

// Everything bot-like: the two sets above + AI assistants + social previews +
// search engines + generic crawler tokens. Used ONLY on the catalog pages,
// where no bot is wanted at all.
const ANY_BOT =
    /(sogou (web|inst) spider|baiduspider|yandexbot|ahrefs|semrush|mj12|dotbot|petalbot|bytespider|dataforseo|blexbot|barkrowler|megaindex|serpstatbot|seznambot|zoominfo|mojeek|diffbot|imagesift|googlebot|google-extended|bingbot|bingpreview|duckduckbot|applebot|gptbot|chatgpt-user|oai-searchbot|claudebot|claude-user|anthropic-ai|perplexitybot|perplexity-user|amazonbot|facebookexternalhit|facebookcatalog|meta-externalagent|twitterbot|discordbot|slackbot|linkedinbot|telegrambot|redditbot|pinterest|skypeuripreview|vkshare|embedly|iframely|spider|crawler|crawl|slurp|scraper|scrapy|headless|python-requests|curl\/|wget\/|go-http-client|libwww|node-fetch|axios\/|phantomjs|puppeteer|playwright|selenium)/i;

// Heavy catalog pages — no bot (incl. AI assistants) needs these.
const CATALOG = /^\/(templates|marketplace)(\/|$)/i;

function deny() {
    return new NextResponse("Automated access is not allowed.", {
        status: 403,
        headers: { "cache-control": "no-store" },
    });
}

export function middleware(req: NextRequest) {
    const ua = req.headers.get("user-agent") || "";
    const path = req.nextUrl.pathname;
    const isApi = path.startsWith("/api/");

    // 1. Catalog pages: block ALL bots (and empty UA).
    if (CATALOG.test(path) && (!ua || ANY_BOT.test(ua))) {
        return deny();
    }

    // 2. Abusive scrapers (Sogou et al.): block everywhere, including /api and
    //    exhibits — they drive the bulk of the bot Firestore reads.
    if (NAMED_SCRAPER.test(ua)) {
        return deny();
    }

    // 3. Generic scraping tools: block on pages, but leave /api open so legit
    //    server-to-server / webhook callers keep working.
    if (!isApi && TOOL.test(ua)) {
        return deny();
    }

    return NextResponse.next();
}

export const config = {
    // Everything except Next internals, the PostHog /ingest proxy, and static
    // files (any path containing a dot). `/api` is intentionally included so
    // bots can't drive reads via API routes (e.g. /api/me) either.
    // `/` is listed explicitly — the negative-lookahead pattern below does not
    // match the bare root route on its own (known Next.js matcher quirk).
    matcher: ["/", "/((?!_next/|ingest/|.*\\.).*)"],
};
