/**
 * What a gallery or world template page ("/destinations/<slug>", and its
 * mint page) tells search engines and link previews. These pages draw the
 * empty space on a canvas and had no title or description of their own.
 */
import { SITE_NAME } from "./siteMeta";
import { plainText } from "./structuredData";
import { cloudinary } from "./urlUtils";

export interface DestinationSeo {
    name: string;
    title: string;
    description: string;
    /** The description as paragraphs, for the page's text. */
    paragraphs: string[];
    author: string;
    image: string | null;
    path: string;
}

/** Old listings open with a pointer to their own address; it says nothing. */
const SELF_POINTER = /^\s*Visit the space at \S+\s*/i;

export function destinationSeo(
    destination: any,
    kind: "space" | "mint" = "space"
): DestinationSeo | null {
    const name = plainText(destination?.name, 120);
    const slug = destination?.slug;
    if (!name || typeof slug !== "string" || !slug) return null;
    const author = plainText(destination.author?.name, 80);
    const text = String(destination.description ?? "").replace(
        SELF_POINTER,
        ""
    );
    const paragraphs = text
        .slice(0, 3000)
        .split(/\n\s*\n|\n/)
        .map((paragraph) => plainText(paragraph))
        .filter(Boolean);
    const summary =
        plainText(text, 160) ||
        `${name}, a 3D space${
            author ? ` by ${author}` : ""
        } on ${SITE_NAME} to visit and make your own.`;
    const image =
        [destination.thumbnail, destination.image].find(
            (url) =>
                typeof url === "string" &&
                /^https?:\/\//i.test(url) &&
                !cloudinary.isBrokenCloudinaryUrl(url)
        ) || null;
    return {
        name,
        title:
            kind === "mint"
                ? `Mint ${name} · ${SITE_NAME}`
                : `${name} · 3D space on ${SITE_NAME}`,
        description: summary,
        paragraphs,
        author,
        image,
        path: `/${
            kind === "mint" ? "mints" : "destinations"
        }/${encodeURIComponent(slug)}`,
    };
}
