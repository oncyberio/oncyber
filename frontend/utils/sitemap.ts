/**
 * The sitemap, built from the spaces themselves (see pages/api/sitemap).
 *
 * Spaces are split by the first character of their document id: Firestore
 * ids are random, so each of the 62 parts holds about 1/62 of all spaces,
 * far under the 50,000-URL limit of one sitemap file, and each part is one
 * bounded read.
 */
import { isReservedLink } from "@utils/reservedLinks";
import { isPublicSpace, PUBLIC_SPACE_FIELDS } from "@utils/spaceVisibility";

const KEYS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** One sitemap part per leading id character. */
export const SPACE_SHARDS = [...KEYS];

/** Most URLs one sitemap file may list. */
export const SITEMAP_MAX_URLS = 50000;

/**
 * The ids a part covers, as a half-open range [start, end). The parts cover
 * every id between them: the first has no lower bound and the last no upper
 * bound, so ids starting with other characters still land somewhere.
 */
export function shardRange(
    key: string
): { start: string | null; end: string | null } | null {
    const index = KEYS.indexOf(key);
    if (key.length !== 1 || index < 0) return null;
    return {
        start: index === 0 ? null : key,
        end: index === KEYS.length - 1 ? null : KEYS[index + 1],
    };
}

/** The fields a sitemap entry reads, for Firestore `select()`. */
export const SITEMAP_SPACE_FIELDS = [
    "info.customLink",
    "info.headline",
    "lastContentUpdatedAt",
    "lastUpdatedAt",
    "createdAt",
    ...PUBLIC_SPACE_FIELDS,
];

function isoDate(value: any): string | null {
    let ms: number | null = null;
    if (typeof value === "number") ms = value;
    else if (typeof value?.toMillis === "function") ms = value.toMillis();
    else if (typeof value?._seconds === "number") ms = value._seconds * 1000;
    else if (typeof value === "string" || value instanceof Date)
        ms = new Date(value).getTime();
    if (ms == null || !Number.isFinite(ms) || ms <= 0) return null;
    return new Date(ms).toISOString().slice(0, 10);
}

export interface SitemapEntry {
    loc: string;
    lastmod?: string;
}

/**
 * A space's sitemap entry, or null for one that shouldn't be listed: not
 * public, or never named (an empty draft has neither a title nor a link).
 */
export function spaceSitemapEntry(
    id: string,
    data: any,
    origin: string
): SitemapEntry | null {
    if (!isPublicSpace(data)) return null;
    const link = data?.info?.customLink;
    const headline = data?.info?.headline;
    if (!link && !(typeof headline === "string" && headline.trim()))
        return null;
    // A link the site's own pages answer never opens the space.
    const path =
        link && !isReservedLink(link)
            ? `/${link}`
            : `/spaces/${encodeURIComponent(id)}`;
    const lastmod =
        isoDate(data?.lastContentUpdatedAt) ||
        isoDate(data?.lastUpdatedAt) ||
        isoDate(data?.createdAt);
    return { loc: origin + path, ...(lastmod ? { lastmod } : {}) };
}

const escapeXml = (text: string) =>
    text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

export function urlsetXml(entries: SitemapEntry[]): string {
    const urls = entries
        .slice(0, SITEMAP_MAX_URLS)
        .map(
            (entry) =>
                `  <url><loc>${escapeXml(entry.loc)}</loc>${
                    entry.lastmod ? `<lastmod>${entry.lastmod}</lastmod>` : ""
                }</url>`
        )
        .join("\n");
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function sitemapIndexXml(locs: string[]): string {
    const items = locs
        .map((loc) => `  <sitemap><loc>${escapeXml(loc)}</loc></sitemap>`)
        .join("\n");
    return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</sitemapindex>\n`;
}

/** The parts the sitemap index lists: site pages, then the space parts. */
export function sitemapParts(origin: string): string[] {
    return [
        `${origin}/sitemaps/pages.xml`,
        ...SPACE_SHARDS.map((key) => `${origin}/sitemaps/spaces-${key}.xml`),
    ];
}

/** Caching for sitemap responses: a day at the CDN, a week stale. */
export const SITEMAP_CACHE_CONTROL =
    "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";
