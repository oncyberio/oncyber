/**
 * Structured data (schema.org JSON-LD) for search engines and AI assistants:
 * what a page is, who made it and where it sits in the site. Every address
 * is on SEARCH_ORIGIN, the same one the canonical link names.
 */
import { SHARE_IMAGE_PATH, SITE_NAME } from "./siteMeta";
import { searchUrl, siteUrl, spacePath } from "./siteUrl";

type Json = Record<string, unknown>;

const CONTEXT = "https://schema.org";

/** Stable ids so pages can point at the one site and organisation. */
const siteId = () => searchUrl("/#website");
const orgId = () => searchUrl("/#organization");

export const SITE_SOCIALS = [
    "https://twitter.com/oncyber",
    "https://www.instagram.com/oncyber",
    "https://github.com/oncyberio/oncyber",
];

/** One line of plain text: no markup, no line breaks, capped at a word. */
export function plainText(value: unknown, max = 0): string {
    const text = String(value ?? "")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    if (!max || text.length <= max) return text;
    const cut = text.slice(0, max);
    const words = cut.slice(0, cut.lastIndexOf(" "));
    return (words || cut).replace(/[\s,;:.–-]+$/, "") + "…";
}

/**
 * Names worth listing as what a space features: artists and collections,
 * not the file names of uploads ("sares-5.glb", "punk.jpg").
 */
export function featuredNames(names: unknown[]): string[] {
    const seen = new Set<string>();
    return names
        .map((name) => plainText(name))
        .filter(
            (name) =>
                name &&
                !/\.[a-z0-9]{2,5}$/i.test(name) &&
                !seen.has(name.toLowerCase()) &&
                !!seen.add(name.toLowerCase())
        );
}

/** Drops empty values so no property is sent without content. */
function compact<T extends Json>(node: T): T {
    return Object.fromEntries(
        Object.entries(node).filter(
            ([, value]) =>
                value !== undefined &&
                value !== null &&
                value !== "" &&
                !(Array.isArray(value) && !value.length)
        )
    ) as T;
}

const isHttpUrl = (value: unknown): value is string =>
    typeof value === "string" && /^https?:\/\//i.test(value);

/** The site and the organisation behind it; sent with the home page. */
export function siteStructuredData(description: string): Json {
    return {
        "@context": CONTEXT,
        "@graph": [
            {
                "@type": "Organization",
                "@id": orgId(),
                name: SITE_NAME,
                url: searchUrl("/"),
                logo: siteUrl("/brand/oncyber-original.svg"),
                image: siteUrl(SHARE_IMAGE_PATH),
                description,
                sameAs: SITE_SOCIALS,
            },
            {
                "@type": "WebSite",
                "@id": siteId(),
                name: SITE_NAME,
                alternateName: ["Oncyber", "oncyber.io"],
                url: searchUrl("/"),
                description,
                publisher: { "@id": orgId() },
                potentialAction: {
                    "@type": "SearchAction",
                    target: {
                        "@type": "EntryPoint",
                        urlTemplate: searchUrl("/?q={search_term_string}"),
                    },
                    "query-input": "required name=search_term_string",
                },
            },
        ],
    };
}

function breadcrumbs(items: { name: string; path: string }[]): Json {
    return {
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: item.name,
            item: searchUrl(item.path),
        })),
    };
}

export interface SpaceForSearch {
    id?: string;
    owner?: string;
    ownerName?: string | null;
    info?: {
        headline?: string;
        description?: string;
        customLink?: string | null;
    };
}

/** The creator of a space, as shown to visitors, and their profile path. */
export function spaceCreator(space: SpaceForSearch): {
    name: string;
    path: string;
} | null {
    if (space?.ownerName)
        return {
            name: `@${space.ownerName}`,
            path: `/@${space.ownerName}`,
        };
    if (typeof space?.owner === "string" && space.owner)
        return {
            name:
                space.owner.length > 12
                    ? `${space.owner.slice(0, 6)}…${space.owner.slice(-4)}`
                    : space.owner,
            path: `/@${space.owner}`,
        };
    return null;
}

/** A space: the page, the 3D work it shows, its creator and its place in the site. */
export function spaceStructuredData(
    space: SpaceForSearch,
    {
        description,
        image,
        featuring = [],
    }: { description?: string; image?: string; featuring?: string[] } = {}
): Json | null {
    const name = plainText(space?.info?.headline);
    if (!space?.id || !name) return null;
    const url = searchUrl(spacePath(space));
    const creator = spaceCreator(space);
    const person = creator && {
        "@type": "Person",
        name: creator.name,
        url: searchUrl(creator.path),
    };
    const text = plainText(description || space.info?.description, 500);
    return {
        "@context": CONTEXT,
        "@graph": [
            compact({
                "@type": "WebPage",
                "@id": url,
                url,
                name,
                description: text,
                isPartOf: { "@id": siteId() },
                primaryImageOfPage: isHttpUrl(image) ? image : undefined,
                mainEntity: { "@id": `${url}#space` },
                breadcrumb: breadcrumbs([
                    { name: SITE_NAME, path: "/" },
                    ...(creator ? [creator] : []),
                    { name, path: spacePath(space) },
                ]),
            }),
            compact({
                "@type": "CreativeWork",
                "@id": `${url}#space`,
                name,
                description: text,
                url,
                image: isHttpUrl(image) ? image : undefined,
                creator: person || undefined,
                // What a visitor finds inside, by artist or collection name.
                keywords: featuredNames(featuring).slice(0, 20).join(", "),
                genre: "3D space",
                publisher: { "@id": orgId() },
            }),
        ],
    };
}

export interface ProfileForSearch {
    id?: string;
    username?: string;
    avatar?: string;
}

/** A creator's profile page. */
export function profileStructuredData(
    profile: ProfileForSearch,
    description?: string
): Json | null {
    const handle = profile?.username || profile?.id;
    if (!handle) return null;
    const url = searchUrl(`/@${handle}`);
    const name = profile.username
        ? `@${profile.username}`
        : `${profile.id.slice(0, 6)}…${profile.id.slice(-4)}`;
    return {
        "@context": CONTEXT,
        "@type": "ProfilePage",
        "@id": url,
        url,
        name: `${name} on ${SITE_NAME}`,
        description,
        isPartOf: { "@id": siteId() },
        mainEntity: compact({
            "@type": "Person",
            "@id": `${url}#person`,
            name,
            alternateName: profile.username || undefined,
            identifier: profile.id,
            url,
            image: isHttpUrl(profile.avatar) ? profile.avatar : undefined,
        }),
        breadcrumb: breadcrumbs([
            { name: SITE_NAME, path: "/" },
            { name, path: `/@${handle}` },
        ]),
    };
}

/** A docs page: an article in the docs section. */
export function docStructuredData(doc: {
    slug: string;
    title: string;
    description?: string;
}): Json {
    const path = doc.slug ? `/docs/${doc.slug}` : "/docs";
    const url = searchUrl(path);
    return {
        "@context": CONTEXT,
        "@type": "TechArticle",
        "@id": url,
        url,
        headline: doc.title,
        description: plainText(doc.description),
        inLanguage: "en",
        isPartOf: { "@id": siteId() },
        publisher: { "@id": orgId() },
        author: { "@id": orgId() },
        breadcrumb: breadcrumbs([
            { name: SITE_NAME, path: "/" },
            { name: "Docs", path: "/docs" },
            ...(doc.slug ? [{ name: doc.title, path }] : []),
        ]),
    };
}

/**
 * JSON for a script tag. "<" is escaped so text from a space or profile
 * (a title holding "</script>") cannot close the tag.
 */
export function jsonLdScript(data: Json): string {
    return JSON.stringify(data).replace(/</g, "\\u003c");
}
