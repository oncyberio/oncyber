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
            const link = data?.info?.customLink;
            return {
                id,
                name,
                path:
                    link && !isReservedLink(link)
                        ? `/${link}`
                        : `/spaces/${encodeURIComponent(id)}`,
                visits: Number(data?.number_of_visits) || 0,
            };
        })
        .filter(({ name }) => name)
        .sort((a, b) => b.visits - a.visits)
        .slice(0, max)
        .map(({ id, name, path }) => ({ id, name, path }));
}

/**
 * Other public spaces by the same owner, for the links a space page gives
 * to its creator's other work. Read when a space's cached view is filled
 * (at most once a day per space), never per pageview. A failure lists
 * nothing.
 */
export async function ownerSpaceLinks(
    ownerId: string,
    exceptId: string,
    store = db,
    { read = OWNER_SPACES_READ, listed = OWNER_SPACES_LISTED } = {}
): Promise<OwnerSpaceLink[]> {
    if (!ownerId) return [];
    try {
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
 * its HTML. One bounded read, kept ten minutes per server.
 */
export async function profileSpaceLinks(
    ownerId: string,
    store = db,
    now = Date.now()
): Promise<OwnerSpaceLink[]> {
    if (!ownerId) return [];
    const hit = profileCache.get(ownerId);
    if (hit && now - hit.at < PROFILE_CACHE_MS) return hit.links;
    const links = await ownerSpaceLinks(ownerId, "", store, {
        read: PROFILE_SPACES_READ,
        listed: PROFILE_SPACES_LISTED,
    });
    if (profileCache.size >= 500) profileCache.clear();
    profileCache.set(ownerId, { at: now, links });
    return links;
}
