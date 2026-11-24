/**
 * Structured data (schema.org JSON-LD) for search engines and AI assistants:
 * what a page is, who made it and where it sits in the site. Every address
 * is on SEARCH_ORIGIN, the same one the canonical link names.
 */
import { SHARE_IMAGE_PATH, SITE_NAME } from "./siteMeta";
import { searchUrl, siteUrl, spacePath } from "./siteUrl";
import type { SpaceContent } from "./spaceContent";

type Json = Record<string, unknown>;

const CONTEXT = "https://schema.org";

/** Stable ids so pages can point at the one site and organisation. */
const siteId = () => searchUrl("/#website");
const orgId = () => searchUrl("/#organization");

export const SITE_SOCIALS = [
    "https://twitter.com/oncyber",
    "https://www.instagram.com/oncyber",
    "https://github.com/oncyberio/oncyber",
    "https://discord.gg/YTpSRnB65U",
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

/**
 * What to call a space: its own name, or "<creator>'s space" for one that was
 * never named. Without this an unnamed space had no heading, no structured
 * data and an empty link-preview title.
 */
export function spaceName(space: SpaceForSearch): string {
    const name = plainText(space?.info?.headline);
    if (name) return name;
    const creator = spaceCreator(space);
    return creator ? `${creator.name}'s space` : "";
}

/** A space: the page, the 3D work it shows, its creator and its place in the site. */
export function spaceStructuredData(
    space: SpaceForSearch,
    {
        path,
        description,
        image,
        featuring = [],
        content,
    }: {
        /** The page's canonical path, when it differs from the space's own. */
        path?: string;
        description?: string;
        image?: string;
        featuring?: string[];
        /** What the space holds (see utils/spaceContent.ts). */
        content?: SpaceContent;
    } = {}
): Json | null {
    const name = spaceName(space);
    if (!space?.id || !name) return null;
    const url = searchUrl(path || spacePath(space));
    const artists = content ? content.artists : featuredNames(featuring);
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
                dateModified: content?.modified,
                mainEntity: { "@id": `${url}#space` },
                breadcrumb: breadcrumbs([
                    { name: SITE_NAME, path: "/" },
                    ...(creator ? [creator] : []),
                    { name, path: path || spacePath(space) },
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
                keywords: artists.slice(0, 20).join(", "),
                genre: "3D space",
                dateCreated: content?.created,
                dateModified: content?.modified,
                interactionStatistic:
                    content?.visits > 0
                        ? {
                              "@type": "InteractionCounter",
                              interactionType: {
                                  "@type": "ViewAction",
                              },
                              userInteractionCount: content.visits,
                          }
                        : undefined,
                // The words on its walls, as the work's own text.
                text: content?.texts.slice(0, 6).join(" ").slice(0, 1500),
                // The works on show.
                hasPart: content?.artworks.slice(0, 25).map((work) =>
                    compact({
                        "@type": "VisualArtwork",
                        name: work.name,
                        description: work.description,
                        image: work.image,
                        creator: work.creator
                            ? { "@type": "Person", name: work.creator }
                            : undefined,
                        isPartOf: work.collection
                            ? {
                                  "@type": "Collection",
                                  name: work.collection,
                              }
                            : undefined,
                    })
                ),
                publisher: { "@id": orgId() },
            }),
        ],
    };
}

/** A docs page: an article in the docs section, or its questions and answers. */
export function docStructuredData(doc: {
    slug: string;
    title: string;
    description?: string;
    faq?: { question: string; answer: string }[];
}): Json {
    const path = doc.slug ? `/docs/${doc.slug}` : "/docs";
    const url = searchUrl(path);
    return {
        "@context": CONTEXT,
        "@type": doc.faq?.length ? "FAQPage" : "TechArticle",
        "@id": url,
        ...(doc.faq?.length
            ? {
                  mainEntity: doc.faq.map(({ question, answer }) => ({
                      "@type": "Question",
                      name: question,
                      acceptedAnswer: { "@type": "Answer", text: answer },
                  })),
              }
            : {}),
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

/** The about page: the questions people ask about the site, answered. */
export function aboutStructuredData(
    faq: { question: string; answer: string }[]
): Json {
    const url = searchUrl("/about");
    return {
        "@context": CONTEXT,
        "@type": ["AboutPage", "FAQPage"],
        "@id": url,
        url,
        name: `About ${SITE_NAME}`,
        isPartOf: { "@id": siteId() },
        about: { "@id": orgId() },
        mainEntity: faq.map(({ question, answer }) => ({
            "@type": "Question",
            name: question,
            acceptedAnswer: { "@type": "Answer", text: answer },
        })),
    };
}

/** The spaces the home page features, as a list. */
export function featuredSpacesStructuredData(
    cards: { title?: string; href?: string; imageUrls?: string[] }[]
): Json | null {
    const items = (cards || [])
        .filter(
            (card) =>
                plainText(card?.title) &&
                typeof card?.href === "string" &&
                card.href.startsWith("/")
        )
        .slice(0, 30);
    if (!items.length) return null;
    return {
        "@context": CONTEXT,
        "@type": "ItemList",
        "@id": searchUrl("/#featured"),
        name: `Featured spaces on ${SITE_NAME}`,
        numberOfItems: items.length,
        itemListElement: items.map((card, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: plainText(card.title),
            url: searchUrl(card.href),
            ...(isHttpUrl(card.imageUrls?.[0])
                ? { image: card.imageUrls[0] }
                : {}),
        })),
    };
}

/**
 * JSON for a script tag. "<" is escaped so text from a space or profile
 * (a title holding "</script>") cannot close the tag.
 */
export function jsonLdScript(data: Json): string {
    return JSON.stringify(data).replace(/</g, "\\u003c");
}
