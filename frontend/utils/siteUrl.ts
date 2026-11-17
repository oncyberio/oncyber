/**
 * Absolute links to this site, and recognising links to it.
 *
 * The origin comes from NEXT_PUBLIC_SITE_ORIGIN, which next.config.js sets at
 * build time from utils/siteOrigin.js: the production domain in production,
 * the branch URL on previews, the dev server locally.
 */

const DEFAULT_ORIGIN = "https://www.oncyber.com";

/** e.g. "https://www.oncyber.com", without a trailing slash. */
export const SITE_ORIGIN = (
    process.env.NEXT_PUBLIC_SITE_ORIGIN || DEFAULT_ORIGIN
).replace(/\/+$/, "");

/** The site's host as people write it, e.g. "oncyber.com". */
export const SITE_DISPLAY_HOST = new URL(SITE_ORIGIN).host.replace(
    /^www\./,
    ""
);

/** An absolute URL on this site for a path such as "/starrynight". */
export function siteUrl(path = "/"): string {
    return SITE_ORIGIN + (path.startsWith("/") ? path : `/${path}`);
}

// The domain search results show today. The site also answers on
// oncyber.com; until the move is made, both name this one as the original.
const DEFAULT_SEARCH_ORIGIN = "https://oncyber.io";

const PRODUCTION_HOSTS = new Set([
    "oncyber.com",
    "www.oncyber.com",
    "oncyber.io",
    "www.oncyber.io",
]);

/**
 * The origin search engines should credit, without a trailing slash:
 * NEXT_PUBLIC_SEARCH_ORIGIN when it is set, else oncyber.io on the
 * production site. Previews, local builds and other deployments credit
 * themselves.
 */
export function searchOrigin(
    value = process.env.NEXT_PUBLIC_SEARCH_ORIGIN,
    site = SITE_ORIGIN
): string {
    const fallback = PRODUCTION_HOSTS.has(new URL(site).host)
        ? DEFAULT_SEARCH_ORIGIN
        : site;
    const raw = (value || "").trim();
    if (!raw) return fallback;
    try {
        const url = new URL(raw);
        return url.protocol === "https:" || url.protocol === "http:"
            ? url.origin
            : fallback;
    } catch {
        return fallback;
    }
}

export const SEARCH_ORIGIN = searchOrigin();

/**
 * The address of a page for search engines and link previews (the canonical
 * link, og:url, the sitemap): the same path on SEARCH_ORIGIN.
 */
export function searchUrl(path = "/"): string {
    return SEARCH_ORIGIN + (path.startsWith("/") ? path : `/${path}`);
}

/** The path of a space: its custom link when it has one. */
export function spacePath(space: {
    id?: string;
    info?: { customLink?: string | null };
}): string {
    const slug = space?.info?.customLink;
    return slug ? `/${slug}` : `/spaces/${space?.id}`;
}

/** The public link to a space: its custom link when it has one. */
export function spaceUrl(space: {
    id?: string;
    info?: { customLink?: string | null };
}): string {
    return siteUrl(spacePath(space));
}

// Every domain the site has answered on. Links people saved or pasted from
// any of them still point at the same spaces and profiles.
const SITE_HOSTS = new Set([
    "oncyber.com",
    "www.oncyber.com",
    "oncyber.io",
    "www.oncyber.io",
]);

/** Is this host one of the site's own (any domain, or the current build's)? */
export function isSiteHost(host: string): boolean {
    const h = (host || "").toLowerCase();
    return SITE_HOSTS.has(h) || h === new URL(SITE_ORIGIN).host;
}

/**
 * The path and query of a link to this site ("/starrynight?coords=..."), or
 * null when the link points elsewhere. Accepts links without a scheme
 * ("oncyber.com/starrynight").
 */
export function sitePath(link: string): string | null {
    const raw = (link || "").trim();
    if (!raw) return null;
    try {
        const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
        if (!isSiteHost(url.host)) return null;
        return url.pathname + url.search;
    } catch {
        return null;
    }
}
