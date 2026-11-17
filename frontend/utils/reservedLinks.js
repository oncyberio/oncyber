// Names a space can't take as its custom link (oncyber.com/<link>).
//
// The site's own top-level pages win over custom links, so a space that took
// one of these names would have a link that never opens it. The same goes
// for the redirects in next.config.js. Plain CommonJS: next.config.js reads
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
    "gl",
    "ingest",
    "ja",
    "landing-carousel",
    "marketplace",
    "mints",
    "privacy",
    "spaces",
    "studio",
    "template",
    "templates",
    "upload",
    "uploader",
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

const RESERVED = new Set([...APP_PATHS, ...Object.keys(PAGE_REDIRECTS)]);

/** Is this custom link taken by the site itself? */
function isReservedLink(link) {
    return typeof link === "string" && RESERVED.has(link.trim().toLowerCase());
}

module.exports = { APP_PATHS, PAGE_REDIRECTS, isReservedLink };
