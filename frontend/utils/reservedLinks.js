// Names a space can't take as its custom link (oncyber.com/<link>).
//
// The site's own top-level pages win over custom links, so a space that took
// one of these names would have a link that never opens it. The same goes
// for the redirects in next.config.js, and for the slugs of the site's own
// games. Plain CommonJS: next.config.js reads
// it too.

/** Top-level paths the app answers itself (pages/, redirects, rewrites, locales). */
const APP_PATHS = [
    "_next",
    "about",
    "api",
    "cli-auth",
    "collections",
    "create",
    "design",
    "destinations",
    "dev",
    "discover",
    "docs",
    "en",
    "exhibits",
    "explore",
    "feed",
    // The committed game builds (public/game-builds/<id>/).
    "game-builds",
    "games",
    "gl",
    "ingest",
    "ja",
    "landing-carousel",
    "marketplace",
    "mints",
    "privacy",
    "sitemap.xml",
    "spaces",
    "studio",
    "template",
    "templates",
    "upload",
    "uploader",
    "world-warmup",
];

/**
 * Addresses people guess or old sites linked to, with the page they lead to.
 * Search engines still send visitors to these (PostHog, 2026).
 */
const PAGE_REDIRECTS = {
    contact: "/about",
    "contact-us": "/about",
    "about-us": "/about",
};

/**
 * The short addresses of the site's own games, `{ "<slug>": "<game id>" }`:
 * a catalogued game with a slug is at /<slug> as well as /games/<id>
 * (docs/games/listing.md). Generated from each game.json by
 * `pnpm games:catalog`. A slug is the site's own address like any page
 * above, so no space can take one. (A game published from outside the
 * repository keeps its slug in the registry, which the procedures that
 * claim a link ask: features/games/gameSlugServer.ts.)
 */
const GAME_SLUGS = require("../features/games/catalog.slugs.json");

const RESERVED = new Set([
    ...APP_PATHS,
    ...Object.keys(PAGE_REDIRECTS),
    ...Object.keys(GAME_SLUGS),
]);

/** Is this custom link taken by the site itself? */
function isReservedLink(link) {
    return typeof link === "string" && RESERVED.has(link.trim().toLowerCase());
}

module.exports = { APP_PATHS, PAGE_REDIRECTS, GAME_SLUGS, isReservedLink };
