/**
 * The title, description and address a space page gives search engines and
 * link previews. Spaces rank on their own names, so the title is the
 * space's name and nothing else.
 */
import { GET_SINGLE_DISPLAY_EXPERIENCE } from "./partnerships/singledisplay";
import { spacePath } from "./siteUrl";
import { uploadName } from "./spaceContent";
import { plainText } from "./structuredData";

export interface SpaceSeo {
    title: string;
    /** For the description tag: one line. */
    description: string;
    /** For link previews: the creator's own text when there is one. */
    socialDescription: string;
    keywords: string;
    /** Names read from the works on show (artists, collections, titles). */
    featuring: string[];
    /** The page's path for search engines, with the query that picks its content. */
    canonicalPath: string;
}

/**
 * Spaces that show one work chosen by the address ("/art-blocks?id=172000777")
 * are a page per work: the id belongs in the address search engines keep.
 */
export function singleDisplayQuery(
    space: any,
    query: Record<string, unknown> = {}
): string {
    const link = space?.info?.customLink;
    if (!link || !GET_SINGLE_DISPLAY_EXPERIENCE({ custom_link: link }))
        return "";
    const safe = (value: unknown) =>
        typeof value === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(value)
            ? value
            : "";
    const id = safe(query.id);
    if (!id) return "";
    const contract = safe(query.contract);
    return (
        "?" +
        new URLSearchParams({
            ...(contract ? { contract } : {}),
            id,
        }).toString()
    );
}

/**
 * A work's name as a description should show it: an upload goes by its file
 * name without the extension ("PEDRO.jpg" is "PEDRO"), and a camera or
 * machine name is no name.
 */
function workName(name: unknown): string | null {
    if (typeof name !== "string" || !name) return null;
    return /\.[a-z0-9]{2,5}$/i.test(name) ? uploadName(name) || null : name;
}

export function spaceSeo(
    space: any,
    {
        ownerName,
        query,
    }: { ownerName?: string | null; query?: Record<string, unknown> } = {}
): SpaceSeo {
    const info = space?.info || {};
    const creatorName = ownerName || space?.owner?.slice?.(0, 5);
    const title =
        info.headline || `${creatorName}'s Untitled ${info.room} - oncyber`;
    const base = info.description
        ? info.description + "\n\n"
        : `Immerse yourself in ${creatorName}'s ${info.headline || info.room}.`;
    const names = Object.values(space?.artworks || {})
        .map((item: any) => {
            const data = item?.data;
            return (
                data?.creator?.user?.username ||
                data?.contract?.name ||
                workName(data?.name) ||
                null
            );
        })
        .filter((name) => name);
    const featuring = names.filter(
        (name, index) => names.indexOf(name) === index
    );
    const keywords = featuring.join(", ");
    const completion =
        names.length > 0
            ? "\nFeaturing NFTs from " +
              (keywords.length > 130
                  ? keywords
                        .slice(0, 130 - base.length)
                        .split(",")
                        .slice(0, -1)
                        .join(",")
                  : keywords) +
              " and many more"
            : "";
    const full =
        base.length < 160
            ? base + completion
            : base.slice(0, 160).split(" ").slice(0, -1).join(" ");
    return {
        title,
        // One line: a description's own line breaks read as run-together
        // words in a search result.
        description: plainText(full),
        socialDescription: info.description || full,
        keywords,
        featuring,
        canonicalPath: spacePath(space) + singleDisplayQuery(space, query),
    };
}
