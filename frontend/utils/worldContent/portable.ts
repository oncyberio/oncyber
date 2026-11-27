/**
 * A space and the world it is built on, as plain data that can leave the
 * site for a copy somewhere else: `pnpm world import` puts one into the
 * local stack (local-dev/import.mjs), for debugging a real space without
 * touching it.
 *
 * What is left out is what a copy has no use for or no right to: the
 * people who may edit the real space, the owner's other spaces, and
 * anything cached into the view for the page. Password secrets are not in
 * the view to begin with (utils/worldPassword/publicGating).
 *
 * Pure: no database, so it can be tested as it is.
 */
import { stripExhibitSecrets } from "@utils/worldPassword/publicGating";

/** Fields of the cached view that are not the space itself. */
const VIEW_ONLY = [
    "id",
    "ownerName",
    "ownerSpaces",
    "ownerData",
    "portalExhibits",
    "portalsDestinations",
    "otherOwners",
    "pendingTransaction",
] as const;

export interface PortableSpace {
    id: string;
    /** The space's document, with its kitbash and portals folded in. */
    space: Record<string, any>;
    /** The world it is built on, when that is a stored one. */
    destination: { id: string; doc: Record<string, any> } | null;
}

export function portableSpace(exhibit: Record<string, any>) {
    const space: Record<string, any> = { ...stripExhibitSecrets(exhibit) };
    for (const field of VIEW_ONLY) delete space[field];
    // Who else may edit the real space is theirs, not the copy's.
    space.editors = [];
    return space;
}

export function portableDestination(
    destination: Record<string, any> | null | undefined
): PortableSpace["destination"] {
    if (!destination) return null;
    const { _id, id, author, ...doc } = destination;
    return {
        id: String(_id ?? id ?? doc.slug),
        doc: {
            ...doc,
            // A name to show, and no way to reach the person.
            author: {
                id: author?.id ?? "",
                userId: author?.userId ?? "",
                ...(author?.name ? { name: author.name } : {}),
                ...(author?.username ? { username: author.username } : {}),
            },
        },
    };
}

/** Rooms the app itself defines ("@@empty"): there is no document to copy. */
export const isBuiltInRoom = (room: unknown) =>
    typeof room !== "string" || !room || room.startsWith("@@");
