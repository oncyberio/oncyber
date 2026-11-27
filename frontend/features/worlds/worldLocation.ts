/**
 * Where a framed world says it is (docs/plans/framed-worlds.md, slice 2).
 * A world walks, and takes portals without leaving its frame, so it tells
 * the page its address and the page keeps the address bar on it. The page
 * believes the address only: which space that is, it looks up itself.
 */
import { publicExperienceHref } from "@utils/experienceLocation";

export interface WorldLocation {
    /** Path, query and fragment, on the site. */
    href: string;
    pathname: string;
    /** The space this address names: by id (`/spaces/<id>`) or by its link. */
    space: { id: string } | { link: string };
}

const BY_ID = /^\/spaces\/([A-Za-z0-9_-]{1,64})$/;
// One segment that is not a profile (`/@name`) or the app's own.
const BY_LINK = /^\/(?!@|api$|_next$|spaces$|studio$)([^/]{1,200})$/;

/** The address of a world on this site, or null for anything else. */
export function readWorldLocation(
    value: unknown,
    origin: string
): WorldLocation | null {
    const href = publicExperienceHref(value, origin);
    if (!href) return null;
    const pathname = new URL(href, origin).pathname;
    const id = BY_ID.exec(pathname)?.[1];
    if (id) return { href, pathname, space: { id } };
    const link = BY_LINK.exec(pathname)?.[1];
    return link
        ? { href, pathname, space: { link: decodeURIComponent(link) } }
        : null;
}

/**
 * The id of a space named by id, or by its link or room label, asked of
 * the site itself. Null when
 * there is no such space or the site cannot say.
 */
export async function worldSpaceId(
    space: WorldLocation["space"],
    request: typeof fetch = fetch
): Promise<string | null> {
    if ("id" in space) return space.id;
    try {
        const response = await request(
            `/api/world-access?space=${encodeURIComponent(space.link)}`
        );
        const body = response.ok ? await response.json() : null;
        return typeof body?.id === "string" ? body.id : null;
    } catch {
        return null;
    }
}
