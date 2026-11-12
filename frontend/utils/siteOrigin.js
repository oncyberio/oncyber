// The site's own origin, for absolute URLs that crawlers need (link preview
// images). Computed once at build time from Vercel's build environment, so
// production points at the production domain and each preview at its own
// branch URL. Local builds use the dev server.
function siteOrigin(env = process.env) {
    if (env.VERCEL_ENV === "production")
        return `https://${env.VERCEL_PROJECT_PRODUCTION_URL || "oncyber.io"}`;
    const host = env.VERCEL_BRANCH_URL || env.VERCEL_URL;
    return host ? `https://${host}` : "http://localhost:13000";
}

module.exports = { siteOrigin };
