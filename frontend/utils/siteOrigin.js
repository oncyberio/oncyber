// The site's own origin, for absolute URLs that crawlers need (link preview
// images). Computed once at build time from Vercel's build environment, so
// production points at the production domain and each preview at its own
// branch URL. Local builds use the dev server.
/** @param {Record<string, string | undefined>} [env] */
function siteOrigin(env = process.env) {
    if (env.VERCEL_ENV === "production")
        return `https://${
            env.VERCEL_PROJECT_PRODUCTION_URL || "www.oncyber.com"
        }`;
    const host = env.VERCEL_BRANCH_URL || env.VERCEL_URL;
    return host ? `https://${host}` : "http://localhost:13000";
}

/**
 * The branch whose previews try what is off everywhere else: worlds in a
 * frame and world scripts. Once it has merged, nothing is named by this and
 * every deployment goes by its own settings again.
 */
const TRIAL_BRANCH = "games-dev";

/** @param {Record<string, string | undefined>} [env] */
function trialPreview(env = process.env) {
    return (
        env.VERCEL_ENV === "preview" &&
        env.VERCEL_GIT_COMMIT_REF === TRIAL_BRANCH
    );
}

/**
 * The world host for a preview of the trial branch
 * (docs/plans/framed-worlds.md). Worlds in a frame need a second host of
 * the same app, and a preview has one already: Vercel serves each
 * deployment at its own address as well as at its branch's. The branch's
 * address is the site (siteOrigin above) and the deployment's own is the
 * world host. Empty anywhere else: worlds are framed only where
 * NEXT_PUBLIC_WORLD_ORIGIN says so.
 *
 * @param {Record<string, string | undefined>} [env]
 */
function previewWorldOrigin(env = process.env) {
    if (!trialPreview(env)) return "";
    const site = env.VERCEL_BRANCH_URL;
    const own = env.VERCEL_URL;
    return site && own && site !== own ? `https://${own}` : "";
}

module.exports = { siteOrigin, previewWorldOrigin, trialPreview };
