/** Names and defaults the head tags and structured data share. */

/** The site's name as search results and link previews show it. */
export const SITE_NAME = "oncyber";

export const SITE_TITLE = "oncyber: forever";

export const SITE_DESCRIPTION =
    "A multiverse for creators, oncyber is the easiest way for artists and collectors to show their digital assets (NFTs) in fully immersive experiences (3D/VR), for free.";

// Link previews (X, iMessage, Slack, ...) need an absolute image URL. The
// image ships in public/, so it is served from the deployment that rendered
// the page (NEXT_PUBLIC_SITE_ORIGIN, set in next.config.js).
export const SHARE_IMAGE_PATH = "/brand/share-card.png";

/**
 * Pages whose address search engines should credit even though they set no
 * canonical of their own: the same path on the search origin, without the
 * query or the /ja prefix. Dynamic pages (spaces, profiles, docs) set theirs.
 */
export const CANONICAL_ROUTES = new Map([
    ["/", "/"],
    // The landing under its working name is the home page.
    ["/landing-carousel", "/"],
    ["/about", "/about"],
    ["/feed", "/feed"],
    ["/privacy", "/privacy"],
    ["/studio", "/studio"],
]);

/**
 * Titles and descriptions for pages that would otherwise repeat the home
 * page's: a search result should say which page it is.
 */
export const PAGE_META: Record<string, { title: string; description: string }> =
    {
        "/about": {
            title: "About oncyber: 3D spaces you make and visit in the browser",
            description:
                "Oncyber is a place on the web to make and visit 3D spaces: virtual art galleries, worlds built in the browser and a shared lobby. What it is and how it works.",
        },
        "/studio": {
            title: "Studio · oncyber",
            description:
                "Build your 3D space in the browser: pick a gallery or a world, place your art and publish it for anyone to visit, for free.",
        },
        "/privacy": {
            title: "Privacy notice · oncyber",
            description:
                "How oncyber collects, uses and protects your personal information.",
        },
    };
