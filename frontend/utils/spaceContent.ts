/**
 * What a space holds, read from its own data, as plain text: the words on
 * its walls, the works it shows with their artists and collections, and
 * the spaces its portals lead to. A space is drawn on a canvas, so this is
 * the only form in which a search engine, an AI assistant or a screen
 * reader can know what is inside.
 */
import { featuredNames, plainText } from "./structuredData";

export interface SpaceArtwork {
    name: string;
    creator?: string;
    collection?: string;
    description?: string;
    image?: string;
}

export interface SpaceContent {
    /** Text placed in the space (wall labels, titles, stories). */
    texts: string[];
    /** Named works on show. */
    artworks: SpaceArtwork[];
    /** Artists and collections featured. */
    artists: string[];
    /** Ids of the spaces its portals lead to. */
    portals: string[];
    visits?: number;
    /** ISO dates (YYYY-MM-DD). */
    created?: string;
    modified?: string;
}

export const SPACE_CONTENT_LIMITS = {
    texts: 24,
    textLength: 600,
    textTotal: 5000,
    artworks: 48,
    description: 220,
    artists: 40,
    portals: 30,
};

const FILE_NAME = /\.[a-z0-9]{2,5}$/i;
/** Wallets and account ids stand in for a name when a creator has none. */
const ACCOUNT_ID =
    /^(0x[0-9a-f]{6,}|tz[123][A-Za-z0-9]{20,}|[A-Za-z0-9]{24,})$/i;
/** Placeholders marketplaces put where a real name is missing. */
const PLACEHOLDER =
    /^(opensea collection|unidentified contract|no description provided\.?|untitled|null|undefined)$/i;
const SPACE_ID = /^[A-Za-z0-9]{10,40}$/;

function named(value: unknown, max = 120): string {
    const text = plainText(value, max);
    return !text || PLACEHOLDER.test(text) ? "" : text;
}

function personName(value: unknown): string {
    const text = named(value, 80);
    return ACCOUNT_ID.test(text) ? "" : text;
}

function isoDate(value: unknown): string | undefined {
    const ms =
        typeof value === "number"
            ? value
            : typeof value === "string"
            ? new Date(value).getTime()
            : typeof (value as any)?._seconds === "number"
            ? (value as any)._seconds * 1000
            : NaN;
    return Number.isFinite(ms) && ms > 0
        ? new Date(ms).toISOString().slice(0, 10)
        : undefined;
}

const httpUrl = (value: unknown): string | undefined =>
    typeof value === "string" &&
    /^https?:\/\//i.test(value) &&
    value.length < 600
        ? value
        : undefined;

export function spaceContent(space: any): SpaceContent {
    const limits = SPACE_CONTENT_LIMITS;
    const items: any[] = Object.values(space?.artworks || {});

    // Wall texts: the longest first (stories before one-word signs).
    const seenText = new Set<string>();
    let textTotal = 0;
    const texts = items
        .filter((item) => item?.data?.mime_type === "cyber/text")
        .map((item) => plainText(item.data.text, limits.textLength))
        .filter(
            (text) =>
                text.length >= 3 &&
                !seenText.has(text.toLowerCase()) &&
                !!seenText.add(text.toLowerCase())
        )
        .sort((a, b) => b.length - a.length)
        .slice(0, limits.texts)
        .filter((text) => (textTotal += text.length) <= limits.textTotal);

    // Works: anything with a real name that is not a wall text, an embed
    // or an upload still called by its file name.
    const seenWork = new Set<string>();
    const artworks: SpaceArtwork[] = [];
    for (const item of items) {
        const data = item?.data;
        const type = String(data?.mime_type || "");
        if (!data || type.startsWith("cyber/") || type.startsWith("embed/"))
            continue;
        const name = named(data.name);
        if (!name || FILE_NAME.test(name)) continue;
        const creator = personName(data.creator?.user?.username);
        const collection = named(data.collection?.name);
        const key = `${name}|${creator}|${collection}`.toLowerCase();
        if (seenWork.has(key)) continue;
        seenWork.add(key);
        const description = named(data.description, limits.description);
        const image = httpUrl(data.image_preview_url || data.image_url);
        artworks.push({
            name,
            ...(creator ? { creator } : {}),
            ...(collection ? { collection } : {}),
            ...(description && description !== name ? { description } : {}),
            ...(image ? { image } : {}),
        });
        if (artworks.length >= limits.artworks) break;
    }

    const artists = featuredNames([
        ...(Array.isArray(space?.artistSearch?.names)
            ? space.artistSearch.names
            : []),
        ...artworks.map((work) => work.creator),
        ...artworks.map((work) => work.collection),
    ])
        .filter((name) => !ACCOUNT_ID.test(name) && !PLACEHOLDER.test(name))
        .slice(0, limits.artists);

    const portals = [
        ...new Set(
            Object.values(space?.portals || {})
                .map((portal: any) => portal?.exhibitId)
                .filter(
                    (id): id is string =>
                        typeof id === "string" &&
                        SPACE_ID.test(id) &&
                        id !== space?.id
                )
        ),
    ].slice(0, limits.portals);

    const visits = Number(space?.number_of_visits);
    const created = isoDate(space?.createdAt);
    const modified =
        isoDate(space?.lastContentUpdatedAt) || isoDate(space?.lastUpdatedAt);
    return {
        texts,
        artworks,
        artists,
        portals,
        ...(Number.isFinite(visits) && visits > 0 ? { visits } : {}),
        ...(created ? { created } : {}),
        ...(modified ? { modified } : {}),
    };
}

/** "Name by creator (collection)", as one line. */
export function artworkLine(work: SpaceArtwork): string {
    return [
        work.name,
        work.creator ? ` by ${work.creator}` : "",
        work.collection && work.collection !== work.creator
            ? ` (${work.collection})`
            : "",
    ].join("");
}
