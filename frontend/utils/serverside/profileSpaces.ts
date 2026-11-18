import { db } from "@utils/firebaseAdmin";
import { isReservedLink } from "@utils/reservedLinks";
import { isPublicSpace, PUBLIC_SPACE_FIELDS } from "@utils/spaceVisibility";

/** A creator's public space, as a link on their profile. */
export interface ProfileSpaceLink {
    id: string;
    name: string;
    path: string;
}

/** Most spaces read for one profile, and most links listed. */
export const PROFILE_SPACES_READ = 30;
export const PROFILE_SPACES_LISTED = 24;

const FIELDS = [
    "info.headline",
    "info.customLink",
    "number_of_visits",
    ...PUBLIC_SPACE_FIELDS,
];

/** The links to list from a creator's spaces: public, named, most visited first. */
export function profileSpaceLinks(
    docs: { id: string; data: any }[],
    max = PROFILE_SPACES_LISTED
): ProfileSpaceLink[] {
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

const CACHE_MS = 10 * 60 * 1000;
const CACHE_MAX = 500;
const cache = new Map<string, { at: number; links: ProfileSpaceLink[] }>();

/**
 * The public spaces a profile page links to in its HTML, so search engines
 * and assistants that do not run the page's script can still follow a
 * creator to their spaces. One bounded read, kept for ten minutes per
 * server; a failure lists nothing rather than failing the page.
 */
export async function profileSpaces(
    ownerId: string,
    store = db,
    now = Date.now()
): Promise<ProfileSpaceLink[]> {
    if (!ownerId) return [];
    const hit = cache.get(ownerId);
    if (hit && now - hit.at < CACHE_MS) return hit.links;
    try {
        const snapshot = await store
            .collection("exhibits")
            .where("owner", "==", ownerId)
            .select(...FIELDS)
            .limit(PROFILE_SPACES_READ)
            .get();
        const links = profileSpaceLinks(
            snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() }))
        );
        if (cache.size >= CACHE_MAX) cache.clear();
        cache.set(ownerId, { at: now, links });
        return links;
    } catch (error) {
        console.error("[profile spaces]", error?.message || error);
        return [];
    }
}
