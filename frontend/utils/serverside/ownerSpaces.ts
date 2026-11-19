import { db } from "@utils/firebaseAdmin";
import { isReservedLink } from "@utils/reservedLinks";
import { isPublicSpace, PUBLIC_SPACE_FIELDS } from "@utils/spaceVisibility";

/** A creator's public space, as a link from another of their spaces. */
export interface OwnerSpaceLink {
    id: string;
    name: string;
    path: string;
}

/** Most sibling spaces read for, and listed on, one space page. */
export const OWNER_SPACES_READ = 13;
export const OWNER_SPACES_LISTED = 12;

const FIELDS = [
    "info.headline",
    "info.customLink",
    "number_of_visits",
    ...PUBLIC_SPACE_FIELDS,
];

/** The links to list from a creator's spaces: public, named, most visited first. */
export function spaceLinks(
    docs: { id: string; data: any }[],
    max = OWNER_SPACES_LISTED
): OwnerSpaceLink[] {
    return docs
        .filter(({ data }) => isPublicSpace(data))
        .map(({ id, data }) => {
            const name = String(data?.info?.headline ?? "")
                .replace(/\s+/g, " ")
                .trim();
            // Stored links are not all clean: one that starts with a slash
            // or a backslash would point off the site, so it is encoded
            // like the landing's own card links.
            const link =
                typeof data?.info?.customLink === "string"
                    ? data.info.customLink.replace(/^[/\\]+/, "")
                    : "";
            return {
                id,
                name,
                path:
                    link && !isReservedLink(link)
                        ? `/${encodeURIComponent(link)}`
                        : `/spaces/${encodeURIComponent(id)}`,
                visits: Number(data?.number_of_visits) || 0,
            };
        })
        .filter(({ name }) => name)
        .sort((a, b) => b.visits - a.visits)
        .slice(0, max)
        .map(({ id, name, path }) => ({ id, name, path }));
}

/** One bounded read of an owner's spaces. Throws when the read fails. */
async function readOwnerSpaceLinks(
    ownerId: string,
    exceptId: string,
    store: typeof db,
    read: number,
    listed: number
): Promise<OwnerSpaceLink[]> {
    // The read is capped before the spaces are ranked: ordering by visits
    // in the query would leave out older spaces that have no visit count.
    const snapshot = await store
        .collection("exhibits")
        .where("owner", "==", ownerId)
        .select(...FIELDS)
        .limit(read)
        .get();
    return spaceLinks(
        snapshot.docs
            .filter((doc) => doc.id !== exceptId)
            .map((doc) => ({ id: doc.id, data: doc.data() })),
        listed
    );
}

/**
 * Other public spaces by the same owner, for the links a space page gives
 * to its creator's other work. Read when a space's cached view is filled
 * (at most once a day per space), never per pageview, so a space made
 * private or unlisted can stay listed on its siblings for up to a day. A
 * failure lists nothing.
 */
export async function ownerSpaceLinks(
    ownerId: string,
    exceptId: string,
    store = db,
    { read = OWNER_SPACES_READ, listed = OWNER_SPACES_LISTED } = {}
): Promise<OwnerSpaceLink[]> {
    if (!ownerId) return [];
    try {
        return await readOwnerSpaceLinks(
            ownerId,
            exceptId,
            store,
            read,
            listed
        );
    } catch (error) {
        console.error("[owner spaces]", error?.message || error);
        return [];
    }
}

/** Most spaces read for, and listed on, a profile link's page. */
export const PROFILE_SPACES_READ = 30;
export const PROFILE_SPACES_LISTED = 24;

const PROFILE_CACHE_MS = 10 * 60 * 1000;
const profileCache = new Map<string, { at: number; links: OwnerSpaceLink[] }>();

/**
 * A person's public spaces, for the links their profile page carries in
 * its HTML. One bounded read, kept ten minutes per server: a space made
 * private or unlisted leaves the list within that time. A failed read
 * lists nothing and is not kept, so the next visit reads again.
 */
export async function profileSpaceLinks(
    ownerId: string,
    store = db,
    now = Date.now()
): Promise<OwnerSpaceLink[]> {
    if (!ownerId) return [];
    const hit = profileCache.get(ownerId);
    if (hit && now - hit.at < PROFILE_CACHE_MS) return hit.links;
    let links: OwnerSpaceLink[];
    try {
        links = await readOwnerSpaceLinks(
            ownerId,
            "",
            store,
            PROFILE_SPACES_READ,
            PROFILE_SPACES_LISTED
        );
    } catch (error) {
        console.error("[profile spaces]", error?.message || error);
        return [];
    }
    if (profileCache.size >= 500) profileCache.clear();
    profileCache.set(ownerId, { at: now, links });
    return links;
}
