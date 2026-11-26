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

// Hosts under these belong to whoever was given the name in front of
// them: two of them are two sites, not one.
const SHARED_SUFFIXES = [
    "vercel.app",
    "netlify.app",
    "pages.dev",
    "web.app",
    "firebaseapp.com",
    "github.io",
    "fly.dev",
    "herokuapp.com",
];

/**
 * Whether two origins look like one site to a browser: the same name
 * under the same ending (www.oncyber.com and worlds.oncyber.com). The
 * world host must not be: cookies set for the whole name would reach it,
 * and a browser may run the two in one process
 * (docs/plans/framed-worlds.md). A guess from the names alone, good
 * enough to warn with; it does not know every ending there is.
 *
 * @param {string} first
 * @param {string} second
 */
function looksSameSite(first, second) {
    const name = (origin) => {
        try {
            const host = new URL(origin).hostname.toLowerCase();
            // An address or a bare machine name is a site by itself.
            if (/^[\d.]+$/.test(host) || host.includes(":")) return host;
            const labels = host.split(".");
            if (labels.length < 2) return host;
            const shared = SHARED_SUFFIXES.find((suffix) =>
                host.endsWith(`.${suffix}`)
            );
            const keep = shared ? shared.split(".").length + 1 : 2;
            return labels.slice(-keep).join(".");
        } catch {
            return "";
        }
    };
    const one = name(first);
    return !!one && one === name(second);
}

module.exports = {
    siteOrigin,
    previewWorldOrigin,
    trialPreview,
    looksSameSite,
};
